import { readdirSync, rmSync } from 'node:fs'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { backup, backupRoot, deleteKeys, keysOf, readStore, restore } from '../src/store.js'
import { groupValue, key, makeStore, tabValue } from './fixture.js'

const backups = mkdtempSync(join(tmpdir(), 'ctgc-backups-'))
process.env['CHROME_TAB_GROUP_CLEANER_BACKUPS'] = backups
afterEach(() => { rmSync(backups, { recursive: true, force: true }) })

const fixture = async (): Promise<string> => makeStore([
  [key('g1'), groupValue('g1', '✅Claude', 5, 1)],
  [key('t1'), tabValue({ guid: 't1', group: 'g1', url: 'https://claude.ai/a', title: 'New chat - Claude', position: 0 })],
  [key('t2'), tabValue({ guid: 't2', group: 'g1', url: 'https://claude.ai/b', title: 'New chat - Claude', position: 1 })],
  [key('g2'), groupValue('g2', 'App Store analytics review', 1, 2)],
  [key('t3'), tabValue({ guid: 't3', group: 'g2', url: 'https://appstoreconnect.apple.com/', title: 'App Store Connect', position: 0 })],
  [key('t4'), tabValue({ guid: 't4', group: 'gone', url: 'https://example.com/', title: 'Orphan', position: 0 })],
  ['saved_tab_group-GlobalMetadata', Uint8Array.from([1, 2, 3])],
  ['sessions-dt-something', Uint8Array.from([4, 5, 6])]
])

describe('readStore', () => {
  it('hangs tabs off their group and keeps the rest apart', async () => {
    const contents = await readStore(await fixture())
    expect(contents.groups.map((group) => group.title)).toEqual(['✅Claude', 'App Store analytics review'])
    expect(contents.groups[0]?.tabs.map((tab) => tab.url)).toEqual(['https://claude.ai/a', 'https://claude.ai/b'])
    expect(contents.orphans.map((tab) => tab.title)).toEqual(['Orphan'])
    expect(contents.other).toEqual(['saved_tab_group-GlobalMetadata'])
  })

  it('orders groups by position', async () => {
    const path = await makeStore([
      [key('a'), groupValue('a', 'second', 1, 9)],
      [key('b'), groupValue('b', 'first', 1, 2)]
    ])
    expect((await readStore(path)).groups.map((group) => group.title)).toEqual(['first', 'second'])
  })
})

describe('deleteKeys', () => {
  it('takes a group with its tabs and leaves everything else alone', async () => {
    const path = await fixture()
    const before = await readStore(path)
    const claude = before.groups.filter((group) => group.title.includes('Claude'))
    expect(keysOf(claude)).toHaveLength(3)

    await deleteKeys(path, keysOf(claude))
    const after = await readStore(path)
    expect(after.groups.map((group) => group.title)).toEqual(['App Store analytics review'])
    expect(after.orphans).toHaveLength(1)
    expect(after.other).toEqual(['saved_tab_group-GlobalMetadata'])
  })

  it('sweeps orphan tabs when asked to', async () => {
    const path = await fixture()
    const contents = await readStore(path)
    await deleteKeys(path, contents.orphans.map((tab) => tab.key))
    expect((await readStore(path)).orphans).toHaveLength(0)
  })
})

describe('backup and restore', () => {
  it('puts deleted groups back without disturbing other data types', async () => {
    const path = await fixture()
    const saved = backup(path)
    expect(readdirSync(backupRoot())).toHaveLength(1)

    const contents = await readStore(path)
    await deleteKeys(path, keysOf(contents.groups))
    expect((await readStore(path)).groups).toHaveLength(0)

    const restored = await restore(saved, path)
    expect(restored).toBe(7)
    const back = await readStore(path)
    expect(back.groups.map((group) => group.title)).toEqual(['✅Claude', 'App Store analytics review'])
    expect(back.groups[0]?.tabs).toHaveLength(2)
  })
})
