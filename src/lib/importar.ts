import { readWorkbook, XlsxError, type Workbook } from './xlsx/reader'
import { findTable, isTable, sheetByName, sheetsByPrefix } from './table'
import { HOJA_DETALLE, PREFIJO_TRABAJO, parseCuentas } from './cuentas/parse'
import { COLS_DESCUENTOS, HOJA_POR_DIA, parseDescuentos } from './descuentos/parse'
import { PARSER, SCHEMA, type Advertencia, type Registro, type Tipo } from './model'

export type Deteccion = { tipo: Tipo } | { error: string }

export function detectarTipo(wb: Workbook): Deteccion {
  if (sheetsByPrefix(wb, HOJA_DETALLE).length || sheetsByPrefix(wb, PREFIJO_TRABAJO).length) return { tipo: 'cuentas' }
  const porDia = sheetByName(wb, HOJA_POR_DIA)
  if (porDia) {
    const t = findTable(porDia, COLS_DESCUENTOS.filter((c) => c.required))
    if (isTable(t)) return { tipo: 'descuentos' }
    return {
      error: `La hoja "${porDia.name}" existe, pero no encontré los encabezados: ${t.missing.join(', ')}.`,
    }
  }
  const hojas = wb.sheets.map((s) => `"${s.name}"`).join(', ') || '(ninguna)'
  return {
    error:
      `No reconozco este archivo. Esperaba una de estas estructuras:\n` +
      `• Cuentas: hojas que empiecen con "${HOJA_DETALLE}" o "${PREFIJO_TRABAJO}…".\n` +
      `• Descuentos: hoja "${HOJA_POR_DIA}" con encabezados Día, % dcto., Tarjeta, Comercio.\n` +
      `Hojas encontradas: ${hojas}.`,
  }
}

export type ResultadoImportacion =
  | { ok: true; archivo: string; registro: Registro; notas?: string[] }
  | { ok: false; archivo: string; error: string }

export function importarLibro(archivo: string, data: ArrayBuffer | Uint8Array, ahora = new Date()): ResultadoImportacion {
  let wb: Workbook
  try {
    wb = readWorkbook(data)
  } catch (e) {
    return { ok: false, archivo, error: e instanceof XlsxError ? e.message : 'No pude leer el archivo como Excel (.xlsx).' }
  }
  const det = detectarTipo(wb)
  if ('error' in det) return { ok: false, archivo, error: det.error }
  const base = { schema: SCHEMA, parser: PARSER[det.tipo], archivo, fechaCarga: ahora.toISOString() }
  try {
    if (det.tipo === 'cuentas') {
      const r = parseCuentas(wb)
      return { ok: true, archivo, registro: { ...base, tipo: 'cuentas', ...r } }
    }
    const r = parseDescuentos(wb, ahora.getFullYear())
    return { ok: true, archivo, registro: { ...base, tipo: 'descuentos', ...r } }
  } catch (e) {
    return { ok: false, archivo, error: e instanceof Error ? e.message : String(e) }
  }
}

export function resumenAdvertencias(adv: Advertencia[]): string {
  return adv.length === 1 ? '1 advertencia' : `${adv.length} advertencias`
}

/** ¿El registro se leyó con una versión anterior del parser o del formato? */
export function desactualizado(r: Registro): boolean {
  return r.schema !== SCHEMA || (r.parser ?? 1) < PARSER[r.tipo]
}

/** Completa campos agregados en versiones nuevas para registros guardados con una versión anterior. */
export function normalizarRegistro(r: Registro): Registro {
  if (r.tipo !== 'descuentos') return r
  return { ...r, datos: { ...r.datos, items: r.datos.items.map((d) => ({ ...d, tipo: d.tipo ?? '', sector: d.sector ?? '', foto: d.foto ?? null })) } }
}
