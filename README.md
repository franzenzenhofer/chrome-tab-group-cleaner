# chrome-tab-group-cleaner

**Chrome has no bulk delete for saved tab groups. This is one.**

![Chrome's bookmarks bar filled end to end with identical green Claude tab group chips](docs/before.png)

*71 saved groups, 70 of them left behind by Claude in Chrome. Chrome removes them
one right-click at a time.*

![The same bookmarks bar with a single chip left on it](docs/after.png)

*After `delete --claude --orphans --restart`. The one group that is not Claude's
survives.*

## Install

As a Claude Code skill - the repo *is* the skill:

```bash
git clone https://github.com/franzenzenhofer/chrome-tab-group-cleaner.git \
  ~/.claude/skills/chrome-tab-group-cleaner
cd ~/.claude/skills/chrome-tab-group-cleaner && npm install && npm run build
```

Then ask for it: *"get rid of all these Claude tab groups"*.

Rather have your agent read it first? Paste this into Claude Code instead:

```text
Install https://github.com/franzenzenhofer/chrome-tab-group-cleaner as a global
Claude Code skill. First clone it somewhere temporary and read SKILL.md, README.md
and every file in src/, then tell me what it does, what it writes to, and anything
you find questionable - it deletes records from Chrome's profile database and can
quit my browser. If it looks wrong, stop and say so instead of installing.

If it checks out: clone it to ~/.claude/skills/chrome-tab-group-cleaner, run
npm install && npm run gates, and show me `node dist/cli.js list --all-profiles`.
Never delete without a --dry-run first, never quit my browser without telling me.
```

As a plain CLI: clone anywhere, `npm install && npm run build`, then
`node dist/cli.js --help`. Node 20+, one runtime dependency.

## Use

```bash
chrome-tab-group-cleaner list --all-profiles -v        # what is there
chrome-tab-group-cleaner delete --claude --dry-run     # what would go
chrome-tab-group-cleaner delete --claude --orphans --restart
chrome-tab-group-cleaner restore --backup ~/.chrome-tab-group-cleaner/backups/Default-...
```

Pick groups with `--all`, `--claude`, `--match <text>` or `--regex <pattern>`.
Then `--browser chrome|chromium|brave|edge`, `--profile <dir>`, `--all-profiles`,
`--orphans`, `--dry-run`, `--restart`, `--sync-tombstone`.

The browser must be quit for a delete: the store is locked, and a live browser
rewrites it from memory on exit. `--restart` quits it and reopens your tabs.
Every delete backs the whole store up first; `restore` puts it back.

## Where they live

```
<user data>/<Profile>/Sync Data/LevelDB     one key per entity: saved_tab_group-dt-<uuid>

{ 1: schema version, 2: SavedTabGroupSpecifics }

SavedTabGroupSpecifics { 1: guid, 2: created µs, 3: updated µs, 4: group, 5: tab }
  group { 2: title, 3: color, 4: position }
  tab   { 1: group guid, 2: position, 3: url, 4: title }
```

A group is a group entity **plus** its tab entities - delete only the group and
the tabs linger as orphans, which is how Chrome leaves them too (`--orphans`
sweeps those). `src/proto.ts` reads this wire format directly, no protobuf
dependency.

## Sync

A profile that syncs tab groups re-downloads a local delete, so `delete` refuses
it. `--sync-tombstone` commits the deletion instead: the data record goes, its
`sync_pb::EntityMetadata` stays with `is_deleted = 1` and `sequence_number =
acked_sequence_number + 1`, which the sync processor reads as a pending commit
and sends to the account.

```
1 client_tag_hash   2 server_id       3 is_deleted            4 sequence_number
5 acked_sequence_number               6 server_version
7 creation_time ms  8 modification_time ms                    9 specifics_hash
```

Those bytes are covered by tests, and the field numbers were read out of a live
store. Whether a given Chrome build accepts a tombstone it did not write itself
is not verified against a real account - worst case, the groups come back.

## Development

`npm run gates` - typecheck, lint, test, build. Tests build real LevelDB stores
and read them back, no mocks.

MIT
