---
name: chrome-tab-group-cleaner
description: List and bulk-delete Chrome's saved tab groups by editing the profile store directly, no GUI clicking. Use when saved tab groups pile up in the bookmarks bar or the tab-groups grid - especially the "✅Claude" groups the Claude in Chrome extension leaves behind - or when the user says "get rid of these tab groups", "delete saved tab groups", "kill all tab groups", "clean up the tab group chips".
---

# Chrome saved tab group cleaner

Deletes Chrome's saved tab groups in the store instead of clicking through
right-click -> *Delete group* one at a time. Full background, storage format and
options: `README.md` next to this file.

## First run

```bash
cd "$(dirname "$0")" && npm install && npm run build
```

## Do this

```bash
node dist/cli.js profiles                                  # which profiles, and which sync
node dist/cli.js list --all-profiles -v                    # what is actually there
node dist/cli.js delete --claude --orphans --dry-run       # confirm the selection
node dist/cli.js delete --claude --orphans --restart       # quit Chrome, delete, reopen tabs
```

Selections are exclusive: `--all` (every group), `--claude` (the Claude in Chrome
leftovers), `--match <text>`, `--regex <pattern>`.

## Rules that matter

- **A delete needs the browser quit.** The LevelDB is locked, and a live browser
  rewrites the store from memory on exit. `--restart` quits it, deletes, and
  reopens every window in its own profile; without it the command refuses.
- **Read the profile first.** `list` works while the browser runs, so always show
  the user what will go before deleting.
- **Sync-enabled profiles are skipped** - a local delete there is re-downloaded.
  The command says so and names the setting to change.
- **Backups happen automatically** under `~/.chrome-tab-group-cleaner/backups/`.
  Undo is `node dist/cli.js restore --backup <that directory> --profile <dir>`
  with the browser quit.
- Deleting a group deletes its tabs too; `--orphans` also sweeps tabs whose group
  is already gone. Chrome accumulates those on its own.
