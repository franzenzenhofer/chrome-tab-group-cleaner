# chrome-tab-group-cleaner

Bulk-delete Chrome's **saved tab groups** - the pill-shaped chips in the bookmarks
bar and the rows behind the grid button next to them.

Chrome has no bulk delete for these. The only UI is right-click -> *Delete group*,
one group at a time. If something creates them automatically they pile up fast:
the [Claude in Chrome](https://chromewebstore.google.com/detail/claude/fcoeoabgfenejglbffodgkkbkcdhcgfn)
extension names its group `✅Claude` (and `⌛Claude` while a task runs) and leaves
one behind per session. This tool edits the store directly, so 70 of them go in
one command.

```
$ chrome-tab-group-cleaner delete --claude --orphans --restart

capturing 2 window(s), quitting Google Chrome

=== Default  (fullstackoptimization.com / franz@example.com)
    delete  "✅Claude"  [blue]  1 tab  999db2b7-2b83-4ef3-9e36-44440731b329
    delete  "✅Claude"  [purple]  1 tab  fed8ddf4-2940-4f3f-9271-9200767fd0d2
    ...
    sweep 95 orphan tab(s)
    deleted 271 key(s). Backup: ~/.chrome-tab-group-cleaner/backups/Default-2026-09-03T21-42-03-116Z
reopening 2 window(s)
```

## Install

```bash
git clone https://github.com/franzenzenhofer/chrome-tab-group-cleaner.git
cd chrome-tab-group-cleaner
npm install && npm run build
node dist/cli.js --help          # or: npm link, then chrome-tab-group-cleaner --help
```

Node 20+. One runtime dependency, `classic-level`, which ships prebuilt binaries.

## Use

```bash
chrome-tab-group-cleaner profiles                  # profiles, and which of them sync tab groups
chrome-tab-group-cleaner list --all-profiles -v    # every group, with its tabs

chrome-tab-group-cleaner delete --all              # every saved tab group
chrome-tab-group-cleaner delete --claude           # only what Claude in Chrome left behind
chrome-tab-group-cleaner delete --match workshop   # title contains "workshop"
chrome-tab-group-cleaner delete --regex '^Trail'   # title matches a pattern

chrome-tab-group-cleaner restore --backup ~/.chrome-tab-group-cleaner/backups/Default-...
```

| Option | |
|---|---|
| `--browser chrome\|chromium\|brave\|edge` | they all use the same store (default `chrome`) |
| `--profile <dir>` / `--all-profiles` | a profile directory such as `Default` or `Profile 2` |
| `--orphans` | also sweep tabs whose group is already gone - Chrome leaves plenty |
| `--dry-run` | print what would happen, touch nothing |
| `--restart` | quit the browser, delete, reopen the same tabs in the same profiles (macOS) |
| `--user-data-dir <path>` | a user data directory other than the browser's own |

**The browser must be quit for a delete.** Its LevelDB is locked exclusively, and
a running browser rewrites the store from memory when it exits - so a delete
underneath it would simply be undone. `list` works either way: it reads a
throwaway copy when the lock is held. `--restart` does the quit-and-reopen for you.

Every delete copies the whole store to `~/.chrome-tab-group-cleaner/backups/`
first (override with `CHROME_TAB_GROUP_CLEANER_BACKUPS`). `restore` puts only the
saved-tab-group keys back; nothing else in the store is touched.

## Sync

A profile that syncs tab groups re-downloads whatever you delete locally, so
`delete` refuses to touch one and says so. Turn *Tab groups* off in
`chrome://settings/syncSetup/advanced` first, or delete those in the UI. The tool
reads the profile's own `Preferences` to decide (`sync.keep_everything_synced`,
`sync.saved_tab_groups`), and `profiles` marks such profiles.

## Where saved tab groups live

One LevelDB per profile, shared with other sync data types:

```
<user data>/<Profile>/Sync Data/LevelDB
```

One key per entity, `saved_tab_group-dt-<uuid>`. The value is a DataTypeStore
wrapper around a `SavedTabGroupSpecifics` protobuf:

```
{ 1: schema version, 2: SavedTabGroupSpecifics }

SavedTabGroupSpecifics { 1: guid, 2: created µs, 3: updated µs, 4: group, 5: tab }
  group { 2: title, 3: color, 4: position }
  tab   { 1: group guid, 2: position, 3: url, 4: title }
```

Timestamps are Windows-epoch (1601) microseconds. Colors are one-based into
`grey, blue, red, yellow, green, pink, purple, cyan, orange`.

A group is a group entity **plus** its tab entities: delete only the group and the
tabs linger as orphans, which is exactly how Chrome's own housekeeping leaves
them. `src/proto.ts` reads this wire format directly - no protobuf dependency.

## Development

```bash
npm run gates      # typecheck, lint, test, build - all must pass
```

Tests build real LevelDB stores from the encoder and read them back. No mocks.

## Licence

MIT
