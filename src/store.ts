import { cpSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { ClassicLevel } from 'classic-level'
import { parseRecord, type GroupRecord, type TabRecord } from './proto.js'

export const KEY_PREFIX = 'saved_tab_group-'
const KEY_END = 'saved_tab_group.'
const DATA_PREFIX = `${KEY_PREFIX}dt-`

export type Store = ClassicLevel<string, Uint8Array>

export interface Group extends GroupRecord { key: string, tabs: Tab[] }
export interface Tab extends TabRecord { key: string }

export interface Contents {
  groups: Group[]
  /** Tabs whose group is already gone - Chrome leaves these behind by itself. */
  orphans: Tab[]
  /** Keys under the prefix that are not entity data, e.g. sync metadata. */
  other: string[]
}

function open (path: string): Store {
  return new ClassicLevel<string, Uint8Array>(path, { keyEncoding: 'utf8', valueEncoding: 'view' })
}

/**
 * Opens the store, falling back to a throwaway copy when the browser holds the
 * exclusive LOCK. Reads may use the copy; writes must not, so `snapshot` is off
 * for them and the open error surfaces instead.
 */
export async function openStore (path: string, snapshot: boolean): Promise<{ db: Store, temp: string | null }> {
  try {
    const db = open(path)
    await db.open({ createIfMissing: false })
    return { db, temp: null }
  } catch (error) {
    if (!snapshot) throw error
    const temp = mkdtempSync(join(tmpdir(), 'chrome-tab-group-cleaner-'))
    cpSync(path, temp, { recursive: true })
    rmSync(join(temp, 'LOCK'), { force: true })
    const db = open(temp)
    await db.open({ createIfMissing: false })
    return { db, temp }
  }
}

export async function closeStore (db: Store, temp: string | null): Promise<void> {
  await db.close()
  if (temp) rmSync(temp, { recursive: true, force: true })
}

export async function readContents (db: Store): Promise<Contents> {
  const groups = new Map<string, Group>()
  const tabs: Tab[] = []
  const other: string[] = []

  for await (const [key, value] of db.iterator({ gte: KEY_PREFIX, lt: KEY_END })) {
    if (!key.startsWith(DATA_PREFIX)) { other.push(key); continue }
    const record = parseRecord(value)
    if (record.kind === 'group' && record.guid) groups.set(record.guid, { ...record, key, tabs: [] })
    else if (record.kind === 'tab') tabs.push({ ...record, key })
  }

  const orphans: Tab[] = []
  for (const tab of tabs) {
    const group = tab.groupGuid === null ? undefined : groups.get(tab.groupGuid)
    ;(group?.tabs ?? orphans).push(tab)
  }
  for (const group of groups.values()) group.tabs.sort((a, b) => (a.position ?? 0) - (b.position ?? 0))

  return {
    groups: [...groups.values()].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
    orphans,
    other
  }
}

export const readStore = async (path: string, snapshot = true): Promise<Contents> => {
  const { db, temp } = await openStore(path, snapshot)
  try {
    return await readContents(db)
  } finally {
    await closeStore(db, temp)
  }
}

/** Deleting a group means deleting its tabs too, or they linger as orphans. */
export const keysOf = (groups: Group[]): string[] =>
  groups.flatMap((group) => [group.key, ...group.tabs.map((tab) => tab.key)])

export const backupRoot = (): string =>
  process.env['CHROME_TAB_GROUP_CLEANER_BACKUPS'] ?? join(homedir(), '.chrome-tab-group-cleaner/backups')

export function backup (dbPath: string): string {
  const profile = basename(dirname(dirname(dbPath)))
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const dest = join(backupRoot(), `${profile}-${stamp}`)
  mkdirSync(dirname(dest), { recursive: true })
  cpSync(dbPath, dest, { recursive: true })
  return dest
}

export async function deleteKeys (dbPath: string, keys: string[]): Promise<void> {
  const db = open(dbPath)
  await db.open({ createIfMissing: false })
  try {
    await db.batch(keys.map((key) => ({ type: 'del' as const, key })))
  } finally {
    await db.close()
  }
}

/**
 * Copies saved tab group entities from a backup back into a live store. Only
 * keys under the tab group prefix are touched - everything else in the sync
 * store (sessions, preferences, search engines) is left exactly as it is.
 */
export async function restore (backupPath: string, dbPath: string): Promise<number> {
  const source = open(backupPath)
  await source.open({ createIfMissing: false })
  const entries: Array<[string, Uint8Array]> = []
  for await (const [key, value] of source.iterator({ gte: KEY_PREFIX, lt: KEY_END })) entries.push([key, value])
  await source.close()

  const target = open(dbPath)
  await target.open({ createIfMissing: false })
  try {
    await target.batch(entries.map(([key, value]) => ({ type: 'put' as const, key, value })))
  } finally {
    await target.close()
  }
  return entries.length
}
