import { browserById, isRunning, profiles, type Browser, type Profile } from './browsers.js'
import { groupLine, heading, summary, tabLines } from './report.js'
import { selector, type Selection } from './select.js'
import { backup, deleteKeys, keysOf, readStore, restore } from './store.js'
import { captureWindows, quit, reopen, type OpenWindow } from './restart.js'

export interface Options extends Selection {
  browser: string
  profile?: string
  allProfiles?: boolean
  verbose?: boolean
  orphans?: boolean
  dryRun?: boolean
  restart?: boolean
  backup?: string
  /** Points at a user data directory other than the browser's own - for tests. */
  userDataDir?: string
}

const say = (line: string): void => { process.stdout.write(`${line}\n`) }

export function targets (options: Options): { browser: Browser, profiles: Profile[] } {
  const browser = browserById(options.browser)
  const all = profiles(browser, options.userDataDir)
  if (options.allProfiles) return { browser, profiles: all }
  const wanted = options.profile ?? 'Default'
  const found = all.filter((profile) => profile.dir === wanted)
  if (found.length === 0) {
    throw new Error(`no profile "${wanted}" - available: ${all.map((p) => `${p.dir} (${p.name})`).join(', ')}`)
  }
  return { browser, profiles: found }
}

export function listProfiles (options: Options): void {
  const browser = browserById(options.browser)
  const found = profiles(browser, options.userDataDir)
  say(`${browser.name}${isRunning(browser) ? ' (running)' : ''}`)
  for (const profile of found) {
    const sync = profile.syncsTabGroups ? '  [syncs tab groups - a local delete would be re-downloaded]' : ''
    say(`  ${profile.dir.padEnd(12)} ${profile.name}${profile.account ? ` (${profile.account})` : ''}${sync}`)
  }
}

export async function list (options: Options): Promise<void> {
  const { profiles: found } = targets(options)
  const match = options.all || options.claude || options.match || options.regex ? selector(options) : null
  for (const profile of found) {
    const contents = await readStore(profile.db)
    say(heading(profile))
    say(summary(contents))
    for (const group of match ? contents.groups.filter(match) : contents.groups) {
      say(groupLine(group))
      if (options.verbose) for (const line of tabLines(group)) say(line)
    }
  }
}

async function deleteInProfile (profile: Profile, options: Options): Promise<void> {
  const match = selector(options)
  const contents = await readStore(profile.db, options.dryRun === true)
  const doomed = contents.groups.filter(match)
  const orphanKeys = options.orphans ? contents.orphans.map((tab) => tab.key) : []
  const keys = [...keysOf(doomed), ...orphanKeys]

  say(heading(profile))
  for (const group of doomed) say(groupLine(group, options.dryRun ? 'would delete  ' : 'delete  '))
  if (orphanKeys.length > 0) say(`    ${options.dryRun ? 'would sweep' : 'sweep'} ${orphanKeys.length} orphan tab(s)`)
  if (keys.length === 0) { say('    nothing matched'); return }
  if (options.dryRun) { say(`    dry run - ${keys.length} key(s) would go`); return }
  if (profile.syncsTabGroups) {
    say('    SKIPPED: this profile syncs tab groups, so the delete would be re-downloaded.')
    say('    Turn "Tab groups" off in chrome://settings/syncSetup/advanced first.')
    return
  }

  const saved = backup(profile.db)
  await deleteKeys(profile.db, keys)
  say(`    deleted ${keys.length} key(s). Backup: ${saved}`)
}

export async function remove (options: Options): Promise<void> {
  const { browser, profiles: found } = targets(options)
  selector(options)

  let windows: OpenWindow[] = []
  const running = isRunning(browser)
  if (running && options.dryRun !== true) {
    if (options.restart !== true) {
      throw new Error(`${browser.name} is running - quit it first, or pass --restart to have it quit and reopen your tabs`)
    }
    windows = captureWindows(browser, profiles(browser, options.userDataDir))
    say(`capturing ${windows.length} window(s), quitting ${browser.name}`)
    await quit(browser, isRunning)
  }

  for (const profile of found) await deleteInProfile(profile, options)

  if (windows.length > 0) {
    say(`reopening ${windows.length} window(s)`)
    await reopen(browser, windows)
  }
}

export async function restoreBackup (options: Options): Promise<void> {
  if (options.backup === undefined) throw new Error('restore needs --backup <path to a backup directory>')
  const { browser, profiles: found } = targets(options)
  if (isRunning(browser)) throw new Error(`${browser.name} is running - quit it first`)
  if (found.length !== 1) throw new Error('restore takes exactly one --profile')
  const profile = found[0] as Profile
  const count = await restore(options.backup, profile.db)
  say(`restored ${count} saved tab group key(s) into ${profile.dir}`)
}
