import type { Cell, Sheet, Workbook } from './xlsx/reader'
import { cellText, norm } from './text'

export interface ColumnSpec {
  key: string
  /** Encabezados aceptados (se comparan normalizados). El primero es el oficial. */
  names: string[]
  required?: boolean
}

export interface Table {
  sheet: Sheet
  headerRow: number
  cols: Record<string, number>
  /** Filas de datos (índices absolutos de la hoja). */
  rowIndexes: number[]
  get(rowIdx: number, key: string): Cell | undefined
}

const stripParens = (s: string) => norm(s.replace(/\([^)]*\)/g, ''))

function matchHeader(header: string, spec: ColumnSpec): 0 | 1 | 2 {
  const h = norm(header)
  if (!h) return 0
  if (spec.names.some((n) => norm(n) === h)) return 2
  const hs = stripParens(header)
  if (spec.names.some((n) => stripParens(n) === hs)) return 1
  return 0
}

export function sheetByName(wb: Workbook, name: string): Sheet | undefined {
  return wb.sheets.find((s) => norm(s.name) === norm(name))
}

export function sheetsByPrefix(wb: Workbook, prefix: string): Sheet[] {
  return wb.sheets.filter((s) => norm(s.name).startsWith(norm(prefix)))
}

/** Busca la fila de encabezados por texto (primeras 40 filas) y mapea columnas por nombre. */
export function findTable(sheet: Sheet, specs: ColumnSpec[], maxScan = 40): Table | { missing: string[] } {
  const required = specs.filter((s) => s.required)
  let best: { row: number; cols: Record<string, number>; missing: string[] } | null = null

  for (let r = 0; r < Math.min(sheet.rows.length, maxScan); r++) {
    const row = sheet.rows[r]
    if (!row) continue
    const cols: Record<string, number> = {}
    for (const spec of specs) {
      let bestCol = -1
      let bestScore = 0
      row.forEach((cell, c) => {
        const score = matchHeader(cellText(cell), spec)
        if (score > bestScore) {
          bestScore = score
          bestCol = c
        }
      })
      if (bestCol >= 0) cols[spec.key] = bestCol
    }
    const missing = required.filter((s) => cols[s.key] === undefined).map((s) => s.names[0])
    if (!best || missing.length < best.missing.length) best = { row: r, cols, missing }
    if (missing.length === 0) break
  }

  if (!best || best.missing.length > 0) {
    return { missing: best?.missing ?? required.map((s) => s.names[0]) }
  }
  const { row: headerRow, cols } = best
  const rowIndexes: number[] = []
  for (let r = headerRow + 1; r < sheet.rows.length; r++) if (sheet.rows[r]) rowIndexes.push(r)
  return {
    sheet,
    headerRow,
    cols,
    rowIndexes,
    get: (rowIdx, key) => (cols[key] === undefined ? undefined : sheet.rows[rowIdx]?.[cols[key]]),
  }
}

export function isTable(t: Table | { missing: string[] }): t is Table {
  return 'sheet' in t
}

/**
 * Parámetros tipo "etiqueta en A → valor en B". Devuelve la celda del valor
 * para la primera etiqueta que calce (comparando el inicio, normalizado).
 */
export function findParam(sheet: Sheet, labels: string[], maxScan = 60): Cell | undefined {
  const wanted = labels.map(norm)
  for (let r = 0; r < Math.min(sheet.rows.length, maxScan); r++) {
    const row = sheet.rows[r]
    if (!row) continue
    for (let c = 0; c < Math.min(row.length, 6); c++) {
      const t = norm(cellText(row[c]))
      if (t && wanted.some((w) => t === w || t === `${w}:`)) return row[c + 1]
    }
  }
  return undefined
}

export function rowLabel(sheet: Sheet, rowIdx: number): string {
  return `${sheet.name}, fila ${rowIdx + 1}`
}
