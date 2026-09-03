import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export interface Browser {
  id: string
  name: string
  /** Process name to look for while deciding whether it is safe to write. */
  process: Partial<Record<NodeJS.Platform, string>>
  userData: Partial<Record<NodeJS.Platform, string>>
}

const local = (): string => process.env['LOCALAPPDATA'] ?? join(homedir(), 'AppData/Local')

export const BROWSERS: Browser[] = [
  {
    id: 'chrome',
    name: 'Google Chrome',
    process: { darwin: 'Google Chrome', linux: 'chrome' },
    userData: {
      darwin: join(homedir(), 'Library/Application Support/Google/Chrome'),
      linux: join(homedir(), '.config/google-chrome'),
      win32: join(local(), 'Google/Chrome/User Data')
    }
  },
  {
    id: 'chromium',
    name: 'Chromium',
    process: { darwin: 'Chromium', linux: 'chromium' },
    userData: {
      darwin: join(homedir(), 'Library/Application Support/Chromium'),
      linux: join(homedir(), '.config/chromium'),
      win32: join(local(), 'Chromium/User Data')
    }
  },
  {
    id: 'brave',
    name: 'Brave Browser',
    process: { darwin: 'Brave Browser', linux: 'brave' },
    userData: {
      darwin: join(homedir(), 'Library/Application Support/BraveSoftware/Brave-Browser'),
      linux: join(homedir(), '.config/BraveSoftware/Brave-Browser'),
      win32: join(local(), 'BraveSoftware/Brave-Browser/User Data')
    }
  },
  {
    id: 'edge',
    name: 'Microsoft Edge',
    process: { darwin: 'Microsoft Edge', linux: 'msedge' },
    userData: {
      darwin: join(homedir(), 'Library/Application Support/Microsoft Edge'),
      linux: join(homedir(), '.config/microsoft-edge'),
      win32: join(local(), 'Microsoft/Edge/User Data')
    }
  }
]

export function browserById (id: string): Browser {
  const browser = BROWSERS.find((b) => b.id === id)
  if (!browser) throw new Error(`unknown browser "${id}" - use one of ${BROWSERS.map((b) => b.id).join(', ')}`)
  return browser
}

export function userDataDir (browser: Browser, override?: string): string {
  if (override !== undefined) return override
  const dir = browser.userData[process.platform]
  if (!dir) throw new Error(`${browser.name} is not supported on ${process.platform}`)
  return dir
}

/** A running browser holds the LevelDB lock and rewrites the store from memory when it exits. */
export function isRunning (browser: Browser): boolean {
  const name = browser.process[process.platform]
  if (!name) throw new Error(`cannot check for a running ${browser.name} on ${process.platform}`)
  try {
    execFileSync('pgrep', ['-x', name], { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

export interface Profile {
  dir: string
  name: string
  /** First name Chrome shows for a signed-in profile; part of the window title. */
  given: string
  account: string
  db: string
  syncsTabGroups: boolean
}

interface ProfileInfo { name?: string, user_name?: string, gaia_given_name?: string }
interface LocalState { profile?: { info_cache?: Record<string, ProfileInfo> } }
interface Preferences { sync?: { keep_everything_synced?: boolean, saved_tab_groups?: boolean } }

function readJson<T> (path: string): T | null {
  if (!existsSync(path)) return null
  return JSON.parse(readFileSync(path, 'utf8')) as T
}

/**
 * A profile that syncs tab groups re-downloads whatever is deleted locally, so
 * the local store is only the source of truth when both flags are off.
 */
function syncsTabGroups (profileDir: string): boolean {
  const prefs = readJson<Preferences>(join(profileDir, 'Preferences'))
  const sync = prefs?.sync
  return sync?.keep_everything_synced === true || sync?.saved_tab_groups === true
}

export function profiles (browser: Browser, override?: string): Profile[] {
  const root = userDataDir(browser, override)
  const state = readJson<LocalState>(join(root, 'Local State'))
  if (!state) throw new Error(`no ${browser.name} user data at ${root}`)
  return Object.entries(state.profile?.info_cache ?? {})
    .map(([dir, info]) => ({
      dir,
      name: info.name ?? dir,
      given: info.gaia_given_name ?? '',
      account: info.user_name ?? '',
      db: join(root, dir, 'Sync Data/LevelDB'),
      syncsTabGroups: syncsTabGroups(join(root, dir))
    }))
    .filter((profile) => existsSync(profile.db))
}
