import type { CSSProperties } from 'react'

// Log messages can embed child-process output with ANSI escapes (e.g. a plugin relaying a
// sidecar's colored tracing log). SGR (`ESC[...m`) becomes styled segments; every other escape
// (cursor moves, erase, OSC titles/links, charset picks) is dropped so it never shows as text.

export type AnsiSegment = { text: string; style?: CSSProperties }

// Group 1 = SGR params. Other alternatives: any other CSI (or one cut off by the end of the text),
// OSC (BEL/ST-terminated, or cut at the line end), a two-byte or nF escape, or a lone ESC.
// eslint-disable-next-line no-control-regex
const ESCAPE_RE = /\x1b(?:\[([\d;:]*)m|\[[0-?]*[ -/]*(?:[@-~]|$)|\][^\x07\x1b\n]*(?:\x07|\x1b\\)?|[ -/]*[0-~])?/g

// Theme tokens keep the 8 base colors legible on both themes. Literal black/white would vanish on
// one of them, so they map to muted/primary ink. Bright variants (90-97, 100-107) reuse these.
const PALETTE = [
  'var(--fg-3)', 'var(--danger)', 'var(--ok)', 'var(--warn)',
  'var(--info)', 'oklch(0.65 0.2 330)', 'oklch(0.65 0.12 200)', 'var(--fg)',
]
const CUBE = [0, 95, 135, 175, 215, 255]

type Sgr = {
  fg: string; bg: string
  bold: boolean; dim: boolean; italic: boolean; underline: boolean; strike: boolean; inverse: boolean
}
const RESET: Sgr = { fg: '', bg: '', bold: false, dim: false, italic: false, underline: false, strike: false, inverse: false }

export function stripAnsi(text: string): string {
  return text.includes('\x1b') ? text.replace(ESCAPE_RE, '') : text
}

// Null when the text has no escapes: render it as-is.
export function parseAnsi(text: string): AnsiSegment[] | null {
  if (!text.includes('\x1b')) return null
  const out: AnsiSegment[] = []
  const sgr = { ...RESET }
  let lastKey = ''
  let pos = 0
  const emit = (end: number) => {
    if (end === pos) return
    const chunk = text.slice(pos, end)
    const key = `${sgr.fg}|${sgr.bg}|${+sgr.bold}${+sgr.dim}${+sgr.italic}${+sgr.underline}${+sgr.strike}${+sgr.inverse}`
    if (out.length && key === lastKey) out[out.length - 1].text += chunk
    else { out.push({ text: chunk, style: toStyle(sgr) }); lastKey = key }
  }
  for (const m of text.matchAll(ESCAPE_RE)) {
    emit(m.index)
    pos = m.index + m[0].length
    if (m[1] !== undefined) applySgr(sgr, m[1])
  }
  emit(text.length)
  return out
}

function applySgr(s: Sgr, params: string) {
  // Empty param means 0 (`ESC[m` is a reset). parseInt drops colon sub-params (`4:3` -> 4).
  const codes = params.split(';').map(p => parseInt(p, 10) || 0)
  for (let i = 0; i < codes.length; i++) {
    const c = codes[i]
    if (c === 0) Object.assign(s, RESET)
    else if (c === 1) s.bold = true
    else if (c === 2) s.dim = true
    else if (c === 3) s.italic = true
    else if (c === 4) s.underline = true
    else if (c === 7) s.inverse = true
    else if (c === 9) s.strike = true
    else if (c === 22) { s.bold = false; s.dim = false }
    else if (c === 23) s.italic = false
    else if (c === 24) s.underline = false
    else if (c === 27) s.inverse = false
    else if (c === 29) s.strike = false
    else if (c === 39) s.fg = ''
    else if (c === 49) s.bg = ''
    else if ((c >= 30 && c <= 37) || (c >= 90 && c <= 97)) s.fg = PALETTE[c % 10]
    else if ((c >= 40 && c <= 47) || (c >= 100 && c <= 107)) s.bg = PALETTE[c % 10]
    else if (c === 38 || c === 48) {
      const [color, used] = extendedColor(codes, i)
      if (color) s[c === 38 ? 'fg' : 'bg'] = color
      i += used
    }
  }
}

// `38;5;n` (xterm 256) or `38;2;r;g;b` (truecolor); same for 48. Returns the color (if valid)
// and how many params after the 38/48 it consumed.
function extendedColor(codes: number[], i: number): [color: string | undefined, used: number] {
  if (codes[i + 1] === 2) {
    return [i + 4 < codes.length ? `rgb(${codes[i + 2]},${codes[i + 3]},${codes[i + 4]})` : undefined, 4]
  }
  if (codes[i + 1] !== 5) return [undefined, 0]
  const n = codes[i + 2]
  if (n === undefined || n > 255) return [undefined, 2]
  if (n < 16) return [PALETTE[n % 8], 2]
  if (n >= 232) {
    const g = 8 + (n - 232) * 10
    return [`rgb(${g},${g},${g})`, 2]
  }
  const k = n - 16
  return [`rgb(${CUBE[Math.floor(k / 36)]},${CUBE[Math.floor(k / 6) % 6]},${CUBE[k % 6]})`, 2]
}

function toStyle(s: Sgr): CSSProperties | undefined {
  // Inverse with no explicit colors swaps the console's own ink and background.
  const color = s.inverse ? s.bg || 'var(--bg-2)' : s.fg
  const background = s.inverse ? s.fg || 'var(--fg-2)' : s.bg
  const deco = `${s.underline ? 'underline ' : ''}${s.strike ? 'line-through' : ''}`.trim()
  const st: CSSProperties = {}
  if (color) st.color = color
  if (background) st.backgroundColor = background
  if (s.bold) st.fontWeight = 600
  if (s.dim) st.opacity = 0.6
  if (s.italic) st.fontStyle = 'italic'
  if (deco) st.textDecoration = deco
  return Object.keys(st).length ? st : undefined
}
