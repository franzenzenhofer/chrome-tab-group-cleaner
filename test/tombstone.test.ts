import { describe, expect, it } from 'vitest'
import { decode, encode, text, type Field } from '../src/proto.js'
import {
  ACKED_SEQUENCE_NUMBER, IS_DELETED, MODIFICATION_TIME, SEQUENCE_NUMBER, SPECIFICS_HASH,
  assertReadable, isTombstone, tombstone
} from '../src/tombstone.js'
import { metadataValue } from './fixture.js'

const NOW = 1_770_000_000_000

describe('tombstone', () => {
  it('marks the entity deleted with a commit still pending', () => {
    const written = decode(tombstone(metadataValue({ sequence: 4, acked: 4 }), 'k', NOW))
    expect(written.get(IS_DELETED)).toBe(1n)
    expect(written.get(SEQUENCE_NUMBER)).toBe(5n)
    expect(written.get(ACKED_SEQUENCE_NUMBER)).toBe(4n)
    expect(written.get(MODIFICATION_TIME)).toBe(BigInt(NOW))
  })

  it('drops the specifics hash, because there are no specifics any more', () => {
    expect(decode(tombstone(metadataValue(), 'k', NOW)).has(SPECIFICS_HASH)).toBe(false)
  })

  it('keeps the identity Chrome needs to commit against', () => {
    const before = decode(metadataValue())
    const after = decode(tombstone(metadataValue(), 'k', NOW))
    for (const field of [1, 2, 6, 7, 13]) expect(after.get(field)).toEqual(before.get(field))
  })

  it('bumps past a sequence number that is already ahead of the acked one', () => {
    const written = decode(tombstone(metadataValue({ sequence: 9, acked: 4 }), 'k', NOW))
    expect(written.get(SEQUENCE_NUMBER)).toBe(10n)
  })

  it('reads its own work as a tombstone', () => {
    expect(isTombstone(tombstone(metadataValue(), 'k', NOW))).toBe(true)
    expect(isTombstone(metadataValue())).toBe(false)
  })
})

describe('refusals', () => {
  it('refuses metadata with no client tag hash', () => {
    const value = encode(new Map<number, Field>([[2, text('server')], [5, 1n]]))
    expect(() => tombstone(value, 'saved_tab_group-md-x', NOW)).toThrow(/no client tag hash/)
  })

  it('refuses a record this reader cannot reproduce byte for byte', () => {
    // Two entries for field 4: decoding keeps the last, so re-encoding would lose one.
    const repeated = Uint8Array.from([...encode(new Map<number, Field>([[4, 1n]])), 0x20, 0x02])
    expect(() => assertReadable(repeated, 'k')).toThrow(/does not round-trip/)
  })

  it('accepts a record shaped like the ones Chrome writes', () => {
    expect(() => assertReadable(metadataValue(), 'k')).not.toThrow()
  })
})
