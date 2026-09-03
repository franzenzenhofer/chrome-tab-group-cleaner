import { colorName } from './proto.js'
import type { Profile } from './browsers.js'
import type { Contents, Group } from './store.js'

const plural = (count: number, word: string): string => `${count} ${word}${count === 1 ? '' : 's'}`

export const tabCount = (groups: Group[]): number => groups.reduce((total, group) => total + group.tabs.length, 0)

export function heading (profile: Profile): string {
  const account = profile.account ? ` / ${profile.account}` : ''
  const sync = profile.syncsTabGroups ? '  [syncs tab groups]' : ''
  return `\n=== ${profile.dir}  (${profile.name}${account})${sync}`
}

export function summary (contents: Contents): string {
  const parts = [plural(contents.groups.length, 'saved group'), plural(tabCount(contents.groups), 'tab')]
  if (contents.orphans.length > 0) parts.push(plural(contents.orphans.length, 'orphan tab'))
  if (contents.other.length > 0) parts.push(plural(contents.other.length, 'other key'))
  return `    ${parts.join(', ')}`
}

export function groupLine (group: Group, prefix = ''): string {
  return `    ${prefix}${JSON.stringify(group.title)}  [${colorName(group.color)}]  ${plural(group.tabs.length, 'tab')}  ${group.guid ?? '?'}`
}

export const tabLines = (group: Group): string[] =>
  group.tabs.map((tab) => `        - ${tab.title} :: ${tab.url}`)
