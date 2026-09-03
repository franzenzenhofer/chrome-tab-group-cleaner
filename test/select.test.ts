import { describe, expect, it } from 'vitest'
import { selector, CLAUDE_PATTERN } from '../src/select.js'
import type { Group } from '../src/store.js'

const group = (title: string): Group =>
  ({ kind: 'group', guid: 'g', title, color: 1, position: 0, key: 'k', tabs: [] })

describe('the Claude preset', () => {
  it('catches every shape the extension writes', () => {
    for (const title of ['✅Claude', '⌛Claude', 'Claude', 'Claude (MCP)', '✅Claude dev tools MCP installation']) {
      expect(CLAUDE_PATTERN.test(title), title).toBe(true)
    }
  })

  it('leaves other groups alone', () => {
    for (const title of ['App Store analytics review', 'Claudia birthday', 'Anthropic Claude research', '']) {
      expect(CLAUDE_PATTERN.test(title), title).toBe(false)
    }
  })
})

describe('selector', () => {
  it('insists on exactly one selection', () => {
    expect(() => selector({})).toThrow(/nothing selected/)
    expect(() => selector({ all: true, claude: true })).toThrow(/pick one/)
  })

  it('matches on substring, case-insensitively', () => {
    const match = selector({ match: 'CLAUDE' })
    expect([group('✅Claude'), group('Workshop')].filter(match).map((g) => g.title)).toEqual(['✅Claude'])
  })

  it('matches on a regex', () => {
    const match = selector({ regex: '^trail' })
    expect([group('Trail levels'), group('A trail')].filter(match).map((g) => g.title)).toEqual(['Trail levels'])
  })

  it('takes everything with --all', () => {
    expect([group('a'), group('b')].filter(selector({ all: true }))).toHaveLength(2)
  })
})
