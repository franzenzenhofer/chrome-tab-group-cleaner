import type { Group } from './store.js'

/**
 * Claude in Chrome names its group "Claude", prefixed with a status emoji
 * (✅ done, ⌛ working) and sometimes suffixed with the task, e.g.
 * "✅Claude dev tools MCP installation" or "Claude (MCP)".
 */
export const CLAUDE_PATTERN = /^[^\p{L}\p{N}]*claude\b/iu

export interface Selection {
  all?: boolean
  claude?: boolean
  match?: string
  regex?: string
}

export function selector (selection: Selection): (group: Group) => boolean {
  const chosen = [selection.all, selection.claude, selection.match, selection.regex].filter(Boolean)
  if (chosen.length === 0) throw new Error('nothing selected - pass --all, --claude, --match <text> or --regex <pattern>')
  if (chosen.length > 1) throw new Error('pick one of --all, --claude, --match, --regex')

  if (selection.all) return () => true
  if (selection.claude) return (group) => CLAUDE_PATTERN.test(group.title)
  if (selection.regex !== undefined) {
    const pattern = new RegExp(selection.regex, 'iu')
    return (group) => pattern.test(group.title)
  }
  const needle = (selection.match as string).toLowerCase()
  return (group) => group.title.toLowerCase().includes(needle)
}
