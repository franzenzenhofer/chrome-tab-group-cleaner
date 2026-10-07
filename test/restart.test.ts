import { describe, expect, it } from 'vitest'
import type { Profile } from '../src/browsers.js'
import { profileFor } from '../src/restart.js'

const profile = (dir: string, name: string, given: string): Profile =>
  ({ dir, name, given, account: '', db: '', syncsTabGroups: false })

const profiles = [
  profile('Default', 'fullstackoptimization.com', 'franz'),
  profile('Profile 2', 'Franz', 'Franz'),
  profile('Profile 9', 'example.com', 'Franz'),
  profile('Profile 8', 'fullstackoptimization.com', 'Arti')
]

describe('profileFor', () => {
  it('prefers a profile name over another profile\'s given name', () => {
    expect(profileFor('Franz', profiles).dir).toBe('Profile 2')
  })

  it('resolves the managed-profile label "<given> (<name>)"', () => {
    expect(profileFor('Arti (fullstackoptimization.com)', profiles).dir).toBe('Profile 8')
  })

  it('refuses a label that two profile names share', () => {
    expect(() => profileFor('fullstackoptimization.com', profiles)).toThrow(/matches 2 profiles/)
  })

  it('refuses a label no profile carries', () => {
    expect(() => profileFor('Nobody', profiles)).toThrow(/cannot tell/)
  })
})
