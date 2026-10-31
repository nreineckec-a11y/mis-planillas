import type { Cell } from './xlsx/reader'

/** Minúsculas, sin tildes, guiones unificados y espacios colapsados. */
export function norm(s: unknown): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[‐-―−]/g, '-')
    .replace(/ /g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export function cellText(c: Cell | undefined): string {
  if (!c || c.v === null) return ''
  if (typeof c.v === 'boolean') return c.v ? 'VERDADERO' : 'FALSO'
  return String(c.v).trim()
}

/** Número desde número o texto ("$275.000", "1,5", "40%"). null si no se puede. */
export function toNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v !== 'string') return null
  let s = v.replace(/[$\s ]|clp/gi, '')
  if (!s) return null
  const pct = s.endsWith('%')
  if (pct) s = s.slice(0, -1)
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.')
  else if (/^-?\d+,\d+$/.test(s)) s = s.replace(',', '.')
  else if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '')
  const n = Number(s)
  if (!Number.isFinite(n)) return null
  return pct ? n / 100 : n
}

export function cellNumber(c: Cell | undefined): number | null {
  return c ? toNumber(c.v) : null
}

/**
 * Fracción desde 0.4, "40%" o 40 → 0.4. Los valores > 1 se asumen escritos en
 * puntos porcentuales.
 */
export function toFraction(v: unknown): number | null {
  const n = toNumber(v)
  if (n === null) return null
  return n > 1 ? n / 100 : n
}

/** Recargo 25% / 50% desde 0.25, "25%", 25. */
export function toRecargo(v: unknown): 25 | 50 | null {
  const f = toFraction(v)
  if (f === null) return null
  const pct = Math.round(f * 100)
  return pct === 25 ? 25 : pct === 50 ? 50 : null
}

export function includesNorm(haystack: string, needle: string): boolean {
  return norm(haystack).includes(norm(needle))
}
