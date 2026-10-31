// Fechas como día calendario (sin hora ni zona horaria) para evitar los
// corrimientos de un día por los cambios de horario de Chile.

export interface Ymd {
  y: number
  m: number // 1–12
  d: number
}

export const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

/** 0 = lunes … 6 = domingo. */
export const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

/** Días desde 1970-01-01 (aritmética pura en UTC, sin depender de la zona local). */
export function toDayNumber({ y, m, d }: Ymd): number {
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000)
}

export function fromDayNumber(n: number): Ymd {
  const dt = new Date(n * 86400000)
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() }
}

/** Serial de Excel → día calendario. Ignora la fracción horaria. */
export function fromExcelSerial(serial: number, date1904 = false): Ymd {
  const days = Math.floor(serial + 1e-9)
  // 1900: el día 25569 es 1970-01-01 (incluye el bug del 29-02-1900).
  const offset = date1904 ? 24107 : 25569
  return fromDayNumber(days - offset)
}

export function isValidYmd({ y, m, d }: Ymd): boolean {
  if (m < 1 || m > 12 || d < 1) return false
  return d <= new Date(Date.UTC(y, m, 0)).getUTCDate()
}

/** Fecha desde serial, ISO o "dd-mm-aaaa" / "dd/mm/aaaa". */
export function parseDateValue(v: unknown, date1904 = false): Ymd | null {
  if (typeof v === 'number' && v > 0) return fromExcelSerial(v, date1904)
  if (typeof v !== 'string') return null
  const s = v.trim()
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (m) {
    const ymd = { y: +m[1], m: +m[2], d: +m[3] }
    return isValidYmd(ymd) ? ymd : null
  }
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/.exec(s)
  if (m) {
    const y = +m[3] < 100 ? 2000 + +m[3] : +m[3]
    const ymd = { y, m: +m[2], d: +m[1] }
    return isValidYmd(ymd) ? ymd : null
  }
  return null
}

/** Hoy según el reloj local del teléfono. */
export function today(now = new Date()): Ymd {
  return { y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() }
}

export function compareYmd(a: Ymd, b: Ymd): number {
  return toDayNumber(a) - toDayNumber(b)
}

/** 0 = lunes … 6 = domingo. */
export function weekday(ymd: Ymd): number {
  // 1970-01-01 fue jueves (3).
  return (((toDayNumber(ymd) + 3) % 7) + 7) % 7
}

export function addDays(ymd: Ymd, n: number): Ymd {
  return fromDayNumber(toDayNumber(ymd) + n)
}

export function formatYmd({ y, m, d }: Ymd): string {
  return `${String(d).padStart(2, '0')}-${String(m).padStart(2, '0')}-${y}`
}

export function formatYmdCorta({ m, d }: Ymd): string {
  return `${d} ${MESES[m - 1].slice(0, 3)}`
}
