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

export interface MetadataSpec {
  clientTagHash?: string
  serverId?: string
  sequence?: number
  acked?: number
  specificsHash?: string
}

/**
 * sync_pb::EntityMetadata, shaped like the records a live Chrome store holds:
 * 1 client_tag_hash, 2 server_id, 3 is_deleted, 4 sequence_number,
 * 5 acked_sequence_number, 6 server_version, 7 created ms, 8 modified ms,
 * 9 specifics_hash, 13 possibly_trimmed_base_specifics.
 */
export const metadataValue = (spec: MetadataSpec = {}): Uint8Array =>
  encode(new Map<number, Field>([
    [1, text(spec.clientTagHash ?? '+7CLRdQyKhMe59nNzyw5gmNEc/c=')],
    [2, text(spec.serverId ?? 'Z:ADqtAZx61GDmIFAWyBB8+LVyRDCLPkdcqYXW04')],
    [3, 0n],
    [4, BigInt(spec.sequence ?? 0)],
    [5, BigInt(spec.acked ?? 0)],
    [6, 1457604868594122n],
    [7, 1457604868278n],
    [8, 1457604868594n],
    [9, text(spec.specificsHash ?? 'J6D0P44gKY3ay59wQlu/QnYOi3A=')],
    [13, new Uint8Array()]
  ]))

export const metaKey = (guid: string): string => `saved_tab_group-md-${guid}`
