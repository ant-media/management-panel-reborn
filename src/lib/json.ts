// JSON.parse for user-supplied text: tolerates a UTF-8 BOM (Windows editors) and
// throws with the engine's message, appending a line number when the engine only
// reports a character position (older Safari; modern V8/Firefox already include it).
export function parseJsonText(text: string): unknown {
  const src = text.replace(/^\uFEFF/, '')
  try {
    return JSON.parse(src)
  } catch (e) {
    let msg = e instanceof Error ? e.message : String(e)
    if (!msg.includes('line')) {
      const pos = /position (\d+)/.exec(msg)
      if (pos) msg += ` (line ${src.slice(0, Number(pos[1])).split('\n').length})`
    }
    throw new Error(msg, { cause: e })
  }
}
