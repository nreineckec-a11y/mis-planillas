const entero = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 })
const decimal = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 })

/** $275.000 / -$12.500 (sin decimales). */
export function clp(n: number): string {
  const r = Math.round(n)
  return `${r < 0 ? '-' : ''}$${entero.format(Math.abs(r))}`
}

/** Monto con signo explícito: +$1.000 / -$1.000. */
export function clpSigno(n: number): string {
  return Math.round(n) > 0 ? `+${clp(n)}` : clp(n)
}

/** 0.4 → "40%". */
export function pct(f: number): string {
  return `${decimal.format(Math.round(f * 1000) / 10)}%`
}

export function horas(n: number): string {
  return `${decimal.format(n)} h`
}

export function fechaHora(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' })
}
