import { describe, expect, it } from 'vitest'
import { captureScript, CAPTURE_SEPARATOR } from '../src/restart.js'

const script = captureScript('Google Chrome')
const body = script.slice(script.indexOf('tell application'))

describe('the capture script', () => {
  it('binds its separator outside the tell block', () => {
    expect(script.indexOf('set sep to (ASCII character 9)')).toBeLessThan(script.indexOf('tell application'))
  })

  /**
   * Chrome's terminology defines `tab`, so inside the tell block AppleScript's
   * `tab` constant resolves to Chrome's class and `& tab &` appends the literal
   * text "tab" - every URL then runs into the one before it and the capture is
   * unparseable.
   */
  it('never reads AppleScript\'s tab constant inside the tell block', () => {
    expect(body).not.toMatch(/&\s*tab\s*&/)
  })

  it('separates the URLs with what the parser splits on', () => {
    expect(CAPTURE_SEPARATOR).toBe('\t')
    expect(String.fromCharCode(9)).toBe(CAPTURE_SEPARATOR)
    expect(body).toContain('& sep & (URL of t)')
  })
})
