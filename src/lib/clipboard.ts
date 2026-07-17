// Best-effort copy: navigator.clipboard requires a secure context (https/localhost).
// Falls back to a hidden textarea so dev over plain http still works.
export function copyToClipboard(value: string): boolean {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(value)
      return true
    }
  } catch { /* fallthrough */ }
  try {
    const ta = document.createElement('textarea')
    ta.value = value
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
    return true
  } catch {
    return false
  }
}
