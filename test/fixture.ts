import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ClassicLevel } from 'classic-level'
import { encode, text, type Field, type Message } from '../src/proto.js'

/** Wraps specifics the way Chrome's DataTypeStore does: { 1: schema, 2: payload }. */
const wrap = (specifics: Message): Uint8Array =>
  encode(new Map<number, Field>([[1, 1n], [2, encode(specifics)]]))

export const groupValue = (guid: string, title: string, color: number, position: number): Uint8Array =>
  wrap(new Map<number, Field>([
    [1, text(guid)],
    [2, 13430587546400020n],
    [3, 13432944983918979n],
    [4, encode(new Map<number, Field>([[2, text(title)], [3, BigInt(color)], [4, BigInt(position)]]))]
  ]))

export interface TabSpec { guid: string, group: string, url: string, title: string, position: number }

export const tabValue = ({ guid, group, url, title, position }: TabSpec): Uint8Array =>
  wrap(new Map<number, Field>([
    [1, text(guid)],
    [2, 13430587546400020n],
    [3, 13432944983918979n],
    [5, encode(new Map<number, Field>([[1, text(group)], [2, BigInt(position)], [3, text(url)], [4, text(title)]]))]
  ]))

export const key = (guid: string): string => `saved_tab_group-dt-${guid}`

export async function makeStore (entries: Array<[string, Uint8Array]>): Promise<string> {
  const path = join(mkdtempSync(join(tmpdir(), 'ctgc-test-')), 'LevelDB')
  const db = new ClassicLevel<string, Uint8Array>(path, { keyEncoding: 'utf8', valueEncoding: 'view' })
  await db.open()
  await db.batch(entries.map(([k, value]) => ({ type: 'put' as const, key: k, value })))
  await db.close()
  return path
}
