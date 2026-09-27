import { execFileSync } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import type { Browser, Profile } from './browsers.js'

export interface OpenWindow { profile: Profile, urls: string[] }

const osascript = (script: string): string =>
  execFileSync('osascript', ['-e', script], { encoding: 'utf8' })

function macApp (browser: Browser): string {
  if (process.platform !== 'darwin') throw new Error('--restart is macOS only; quit the browser yourself elsewhere')
  return browser.process['darwin'] as string
}

/**
 * Chrome puts the profile label after the window title: "Page - Google Chrome - Franz".
 * The label is the profile name, or "<given name> (<name>)" for a managed profile.
 * Tiers run from most to least specific, so a profile named "Franz" wins over
 * another profile whose account's given name is also "Franz".
 */
const labelTiers: Array<(profile: Profile) => string> = [
  (profile): string => profile.name,
  (profile): string => `${profile.given} (${profile.name})`,
  (profile): string => profile.given
]

export function profileFor (label: string, profiles: Profile[]): Profile {
  for (const labelOf of labelTiers) {
    const hits = profiles.filter((profile) => labelOf(profile) === label)
    if (hits.length === 1) return hits[0] as Profile
    if (hits.length > 1) {
      throw new Error(`"${label}" matches ${hits.length} profiles (${hits.map((hit) => hit.dir).join(', ')}) - quit the browser yourself and drop --restart`)
    }
  }
  throw new Error(`cannot tell which profile the window "${label}" belongs to - quit the browser yourself and drop --restart`)
}

/** Reads every open window: its tab URLs and the profile it belongs to. */
export function captureWindows (browser: Browser, profiles: Profile[]): OpenWindow[] {
  const app = macApp(browser)
  // Inside the browser's tell block `tab` names its tab class, not the character.
  const lines = osascript(`tell application "${app}"
    set sep to character id 9
    set out to ""
    repeat with w in windows
      set out to out & (title of active tab of w)
      repeat with t in tabs of w
        set out to out & sep & (URL of t)
      end repeat
      set out to out & linefeed
    end repeat
    return out
  end tell`).split('\n').filter((line) => line.length > 0)

  const titles = osascript(`tell application "System Events" to tell process "${app}" to get name of every window`)
    .split(', ').map((name) => name.trim())
  const marker = ` - ${browser.name} - `

  return lines.map((line, index) => {
    const [active = '', ...urls] = line.split('\t')
    const title = titles.find((name) => name.startsWith(active)) ?? titles[index]
    if (title === undefined || !title.includes(marker)) {
      throw new Error(`cannot read the profile of window "${active}" - quit the browser yourself and drop --restart`)
    }
    return { profile: profileFor(title.slice(title.indexOf(marker) + marker.length), profiles), urls }
  })
}

export async function quit (browser: Browser, running: (browser: Browser) => boolean): Promise<void> {
  osascript(`tell application "${macApp(browser)}" to quit`)
  for (let waited = 0; waited < 20_000 && running(browser); waited += 250) await delay(250)
  if (running(browser)) throw new Error(`${browser.name} did not quit`)
}

/** Reopens each captured window in its own profile. */
export async function reopen (browser: Browser, windows: OpenWindow[]): Promise<void> {
  const app = macApp(browser)
  for (const [index, open] of windows.entries()) {
    execFileSync('open', ['-na', app, '--args', `--profile-directory=${open.profile.dir}`, ...open.urls])
    if (index < windows.length - 1) await delay(4000)
  }
}
