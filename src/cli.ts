#!/usr/bin/env node
import { parseArgs } from 'node:util'
import { BROWSERS } from './browsers.js'
import { list, listProfiles, remove, restoreBackup, type Options } from './commands.js'

const USAGE = `chrome-tab-group-cleaner - bulk-delete Chrome's saved tab groups

  profiles                       list profiles and whether they sync tab groups
  list                           show saved tab groups and their tabs
  delete <selection>             delete saved tab groups
  restore --backup <dir>         put a backup's tab groups back

Selection (exactly one)
  --all                          every saved tab group
  --claude                       the groups Claude in Chrome leaves behind
  --match <text>                 title contains this text
  --regex <pattern>              title matches this pattern

Options
  --browser <id>                 ${BROWSERS.map((browser) => browser.id).join(' | ')}   (default chrome)
  --profile <dir>                profile directory, e.g. "Default" or "Profile 2"
  --user-data-dir <path>         a user data directory other than the browser's own
  --all-profiles                 every profile of that browser
  --orphans                      also sweep tabs whose group is already gone
  --dry-run                      print what would happen, touch nothing
  --restart                      quit the browser, act, reopen the same tabs (macOS)
  --verbose, -v                  with list: show each group's tabs

The browser must be quit for a delete: its LevelDB is locked, and a running
browser rewrites the store from memory when it exits.`

const OPTIONS = {
  browser: { type: 'string' as const, default: 'chrome' },
  profile: { type: 'string' as const },
  'user-data-dir': { type: 'string' as const },
  'all-profiles': { type: 'boolean' as const },
  all: { type: 'boolean' as const },
  claude: { type: 'boolean' as const },
  match: { type: 'string' as const },
  regex: { type: 'string' as const },
  orphans: { type: 'boolean' as const },
  'dry-run': { type: 'boolean' as const },
  restart: { type: 'boolean' as const },
  backup: { type: 'string' as const },
  verbose: { type: 'boolean' as const, short: 'v' },
  help: { type: 'boolean' as const, short: 'h' }
}

/** A closed pipe (`| head`) is a normal way for a CLI to end, not a crash. */
function ignoreClosedPipe (): void {
  process.stdout.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EPIPE') process.exit(0)
    throw error
  })
}

async function main (): Promise<void> {
  ignoreClosedPipe()
  const { values, positionals } = parseArgs({ options: OPTIONS, allowPositionals: true })
  if (values.help === true) { process.stdout.write(`${USAGE}\n`); return }

  const options: Options = {
    browser: values.browser as string,
    ...(values.profile === undefined ? {} : { profile: values.profile }),
    ...(values.match === undefined ? {} : { match: values.match }),
    ...(values.regex === undefined ? {} : { regex: values.regex }),
    ...(values.backup === undefined ? {} : { backup: values.backup }),
    ...(values['user-data-dir'] === undefined ? {} : { userDataDir: values['user-data-dir'] }),
    allProfiles: values['all-profiles'] === true,
    all: values.all === true,
    claude: values.claude === true,
    orphans: values.orphans === true,
    dryRun: values['dry-run'] === true,
    restart: values.restart === true,
    verbose: values.verbose === true
  }

  const command = positionals[0] ?? 'list'
  if (command === 'profiles') listProfiles(options)
  else if (command === 'list') await list(options)
  else if (command === 'delete') await remove(options)
  else if (command === 'restore') await restoreBackup(options)
  else throw new Error(`unknown command "${command}" - try --help`)
}

main().catch((error: unknown) => {
  process.stderr.write(`error: ${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
