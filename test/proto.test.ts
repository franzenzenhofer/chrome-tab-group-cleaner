import { describe, expect, it } from 'vitest'
import { colorName, decode, encode, parseRecord, text, windowsEpochToDate, type Field } from '../src/proto.js'
import { groupValue, tabValue } from './fixture.js'

describe('wire format', () => {
  it('round-trips varints and length-delimited fields', () => {
    const message = new Map<number, Field>([[1, text('hello')], [3, 300n], [7, 0n]])
    expect(decode(encode(message))).toEqual(message)
  })

  it('round-trips a varint that spans several bytes', () => {
    expect(decode(encode(new Map([[2, 13432944983918979n]]))).get(2)).toBe(13432944983918979n)
  })

  it('refuses a length that runs past the buffer', () => {
    expect(() => decode(Uint8Array.from([0x0a, 0x7f, 0x01]))).toThrow(/past the buffer/)
  })
})

describe('parseRecord', () => {
  it('reads a group', () => {
    const record = parseRecord(groupValue('88d006b6', '✅Claude', 5, 27))
    expect(record).toEqual({ kind: 'group', guid: '88d006b6', title: '✅Claude', color: 5, position: 27 })
  })

  it('reads a tab and the group it belongs to', () => {
    const record = parseRecord(tabValue({ guid: 'b6ba90a1', group: '88d006b6', url: 'https://claude.ai/', title: 'Claude', position: 0 }))
    expect(record).toEqual({
      kind: 'tab', guid: 'b6ba90a1', groupGuid: '88d006b6', position: 0, url: 'https://claude.ai/', title: 'Claude'
    })
  })

  it('calls anything else unknown rather than guessing', () => {
    expect(parseRecord(encode(new Map<number, Field>([[1, 1n], [2, encode(new Map<number, Field>([[1, text('x')]]))]])))).toEqual({
      kind: 'unknown', guid: 'x'
    })
  })
})

describe('presentation', () => {
  it('names colors the way Chrome does, one-based', () => {
    expect([1, 5, 9].map(colorName)).toEqual(['grey', 'green', 'orange'])
    expect(colorName(null)).toBe('unset')
  })

  it('reads Chrome timestamps as Windows-epoch microseconds', () => {
    expect(windowsEpochToDate(13432944983918979).toISOString()).toBe('2026-09-03T21:36:23.918Z')
  })
})
