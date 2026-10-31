import type { Sheet, Workbook } from '../xlsx/reader'
import { findParam, findTable, isTable, rowLabel, sheetByName, sheetsByPrefix, type ColumnSpec } from '../table'
import { cellNumber, cellText, norm, toNumber, toRecargo } from '../text'
import { MESES, parseDateValue } from '../dates'
import type {
  Advertencia,
  DatosCuentas,
  DatosPersonal,
  Direccion,
  EstadoHE,
  FilaCompensatoria,
  FilaHorasExtra,
  HojaCompensatorias,
  HojaHorasExtra,
  ItemPersonal,
  Parametros,
} from '../model'

export const HOJA_DETALLE = 'Personal - Detalle'
export const HOJA_RESUMEN = 'Personal - Resumen'
export const PREFIJO_TRABAJO = 'Trabajo - '
export const PREFIJO_HE = 'Trabajo - Horas extra'
export const PREFIJO_COMP = 'Trabajo - Compensatorias'

export interface ResultadoCuentas {
  datos: DatosCuentas
  filas: number
  advertencias: Advertencia[]
}

// ---------- Personal ----------

const COLS_PERSONAL: ColumnSpec[] = [
  { key: 'concepto', names: ['Concepto'], required: true },
  { key: 'persona', names: ['Persona'], required: true },
  { key: 'direccion', names: ['Dirección', 'Direccion'], required: true },
  { key: 'monto', names: ['Monto (CLP)', 'Monto'], required: true },
  { key: 'pagado', names: ['Pagado', '¿Pagado?'], required: true },
]

function parseDireccion(s: string): Direccion | null {
  const n = norm(s)
  if (n === 'me debe') return 'me_debe'
  if (n === 'yo debo' || n === 'le debo') return 'yo_debo'
  return null
}

export function parsePersonal(wb: Workbook, adv: Advertencia[]): DatosPersonal | null {
  const sheet = sheetsByPrefix(wb, HOJA_DETALLE)[0]
  if (!sheet) return null
  const table = findTable(sheet, COLS_PERSONAL)
  if (!isTable(table)) {
    adv.push({ donde: sheet.name, mensaje: `No encontré los encabezados: ${table.missing.join(', ')}` })
    return null
  }

  const items: ItemPersonal[] = []
  for (const r of table.rowIndexes) {
    const montoCell = table.get(r, 'monto')
    const monto = cellNumber(montoCell)
    const concepto = cellText(table.get(r, 'concepto'))
    const persona = cellText(table.get(r, 'persona'))
    if (monto === null) {
      if (cellText(montoCell)) adv.push({ donde: rowLabel(sheet, r), mensaje: `Monto no reconocido: "${cellText(montoCell)}"` })
      continue
    }
    const dirText = cellText(table.get(r, 'direccion'))
    const direccion = parseDireccion(dirText)
    const pagadoText = cellText(table.get(r, 'pagado'))
    const pagado = norm(pagadoText) === 'si'
    const donde = rowLabel(sheet, r)
    if (!persona) adv.push({ donde, mensaje: 'Fila con monto pero sin Persona' })
    if (!dirText) adv.push({ donde, mensaje: 'Fila con monto pero sin Dirección (no se suma al neto)' })
    else if (!direccion) adv.push({ donde, mensaje: `Dirección no reconocida: "${dirText}" (no se suma al neto)` })
    if (!pagadoText) adv.push({ donde, mensaje: 'Fila con monto pero sin Pagado (se cuenta como pendiente)' })
    else if (!pagado && norm(pagadoText) !== 'no')
      adv.push({ donde, mensaje: `Pagado no reconocido: "${pagadoText}" (se cuenta como pendiente)` })
    items.push({ fila: r + 1, concepto, persona: persona || '(sin persona)', direccion, monto, pagado })
  }

  // Personas: lista de la hoja de resumen (columna A desde la fila 2 hasta la primera vacía) + detalle.
  const personas: string[] = []
  const vistos = new Set<string>()
  const agregar = (p: string) => {
    const k = norm(p)
    if (k && !vistos.has(k)) {
      vistos.add(k)
      personas.push(p.trim())
    }
  }
  const resumen = sheetByName(wb, HOJA_RESUMEN)
  if (resumen) {
    for (let r = 1; r < resumen.rows.length; r++) {
      const t = cellText(resumen.rows[r]?.[0])
      if (!t) break
      agregar(t)
    }
  }
  items.forEach((i) => agregar(i.persona))
  // Unifica la grafía de las personas del detalle con la de la lista.
  const canon = new Map(personas.map((p) => [norm(p), p]))
  items.forEach((i) => (i.persona = canon.get(norm(i.persona)) ?? i.persona))

  return { items, personas }
}

// ---------- Parámetros ----------

function anioDe(sheet: Sheet): string | null {
  return /(\d{4})\s*$/.exec(sheet.name)?.[1] ?? null
}

/** Valor de un parámetro de entrada; las fórmulas se ignoran (no confiamos en el cache). */
function paramNumber(sheet: Sheet, labels: string[], ignorarFormulas: boolean): number | null {
  const c = findParam(sheet, labels)
  if (!c || (ignorarFormulas && c.formula)) return null
  return toNumber(c.v)
}

// ---------- Horas extra ----------

const COLS_HE: ColumnSpec[] = [
  { key: 'mes', names: ['Mes'], required: true },
  { key: 'fecha', names: ['Fecha'] },
  { key: 'detalle', names: ['Detalle'] },
  { key: 'horas', names: ['Horas'], required: true },
  { key: 'recargo', names: ['Recargo'], required: true },
  { key: 'estado', names: ['Estado'], required: true },
  { key: 'liquidacion', names: ['Liquidación en que se pagó', 'Liquidacion en que se pago', 'Liquidación'] },
  { key: 'observaciones', names: ['Observaciones'] },
]

function parseEstadoHE(s: string): EstadoHE | null {
  const n = norm(s)
  if (n === 'pagado' || n === 'pagada') return 'Pagado'
  if (n === 'no pagado' || n === 'no pagada' || n === 'pendiente') return 'No pagado'
  if (n === 'programado' || n === 'programada') return 'Programado'
  return null
}

function mesTexto(v: unknown, date1904: boolean): string {
  if (typeof v === 'number') {
    if (v >= 1 && v <= 12 && Number.isInteger(v)) return cap(MESES[v - 1])
    const ymd = parseDateValue(v, date1904)
    if (ymd) return cap(MESES[ymd.m - 1])
  }
  return String(v ?? '').trim()
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

function parseHorasExtra(wb: Workbook, sheet: Sheet, adv: Advertencia[]): HojaHorasExtra | null {
  const params: Parametros = {
    valorHora: paramNumber(sheet, ['Valor hora ordinaria'], false),
    factor25: paramNumber(sheet, ['Factor 25%'], false),
    factor50: paramNumber(sheet, ['Factor 50%'], false),
  }
  for (const [k, label] of [['valorHora', 'Valor hora ordinaria'], ['factor25', 'Factor 25%'], ['factor50', 'Factor 50%']] as const) {
    if (params[k] === null) adv.push({ donde: sheet.name, mensaje: `Falta el parámetro "${label}" (montos no calculados)` })
  }

  const table = findTable(sheet, COLS_HE)
  if (!isTable(table)) {
    adv.push({ donde: sheet.name, mensaje: `No encontré los encabezados: ${table.missing.join(', ')}` })
    return null
  }
  const filas: FilaHorasExtra[] = []
  let mesActual = ''
  for (const r of table.rowIndexes) {
    const mes = mesTexto(table.get(r, 'mes')?.v, wb.date1904)
    if (mes) mesActual = mes
    const horasCell = table.get(r, 'horas')
    const horas = cellNumber(horasCell)
    if (horas === null) {
      if (cellText(horasCell) && !horasCell?.formula)
        adv.push({ donde: rowLabel(sheet, r), mensaje: `Horas no reconocidas: "${cellText(horasCell)}"` })
      continue
    }
    const donde = rowLabel(sheet, r)
    const recargoText = cellText(table.get(r, 'recargo'))
    const recargo = toRecargo(table.get(r, 'recargo')?.v)
    if (recargo === null) adv.push({ donde, mensaje: `Recargo no reconocido: "${recargoText}" (monto no calculado)` })
    const estadoRaw = cellText(table.get(r, 'estado'))
    const estado = parseEstadoHE(estadoRaw)
    if (!estado) adv.push({ donde, mensaje: estadoRaw ? `Estado no reconocido: "${estadoRaw}"` : 'Fila sin Estado' })
    filas.push({
      fila: r + 1,
      mes: mes || mesActual || '(sin mes)',
      fecha: cellText(table.get(r, 'fecha')),
      detalle: cellText(table.get(r, 'detalle')),
      horas,
      recargo,
      estado,
      estadoRaw,
      liquidacion: cellText(table.get(r, 'liquidacion')),
      observaciones: cellText(table.get(r, 'observaciones')),
    })
  }
  return { hoja: sheet.name, anio: anioDe(sheet), ...params, filas }
}

// ---------- Compensatorias ----------

const COLS_COMP: ColumnSpec[] = [
  { key: 'fecha', names: ['Fecha'], required: true },
  { key: 'detalle', names: ['Detalle'] },
  { key: 'horasTrabajadas', names: ['Horas trabajadas'], required: true },
  { key: 'recargo', names: ['Recargo'], required: true },
  { key: 'horasTomadas', names: ['Horas ya tomadas', 'Horas tomadas'] },
  { key: 'observaciones', names: ['Observaciones'] },
]

function parseCompensatorias(
  wb: Workbook,
  sheet: Sheet,
  horasExtra: HojaHorasExtra[],
  adv: Advertencia[],
): HojaCompensatorias | null {
  const anio = anioDe(sheet)
  const ref = horasExtra.find((h) => h.anio === anio) ?? horasExtra[0]
  const params: Parametros = {
    valorHora: paramNumber(sheet, ['Valor hora ordinaria'], true) ?? ref?.valorHora ?? null,
    factor25: paramNumber(sheet, ['Factor 25% (semana)', 'Factor 25%'], true) ?? ref?.factor25 ?? null,
    factor50: paramNumber(sheet, ['Factor 50% (fds/feriado)', 'Factor 50%'], true) ?? ref?.factor50 ?? null,
  }
  for (const [k, label] of [['valorHora', 'Valor hora ordinaria'], ['factor25', 'Factor 25%'], ['factor50', 'Factor 50%']] as const) {
    if (params[k] === null) adv.push({ donde: sheet.name, mensaje: `Falta el parámetro "${label}" y no está en la hoja de horas extra` })
  }

  const table = findTable(sheet, COLS_COMP)
  if (!isTable(table)) {
    adv.push({ donde: sheet.name, mensaje: `No encontré los encabezados: ${table.missing.join(', ')}` })
    return null
  }
  const filas: FilaCompensatoria[] = []
  for (const r of table.rowIndexes) {
    const horasCell = table.get(r, 'horasTrabajadas')
    const horasTrabajadas = cellNumber(horasCell)
    if (horasTrabajadas === null) continue
    const donde = rowLabel(sheet, r)
    const fechaCell = table.get(r, 'fecha')
    const fecha = parseDateValue(fechaCell?.v, wb.date1904)
    if (!fecha) {
      adv.push({ donde, mensaje: `Fecha no reconocida: "${cellText(fechaCell)}" (fila ignorada)` })
      continue
    }
    const recargo = toRecargo(table.get(r, 'recargo')?.v)
    if (recargo === null)
      adv.push({ donde, mensaje: `Recargo no reconocido: "${cellText(table.get(r, 'recargo'))}" (horas generadas no calculadas)` })
    const tomadasCell = table.get(r, 'horasTomadas')
    const horasTomadas = cellNumber(tomadasCell) ?? 0
    if (cellText(tomadasCell) && cellNumber(tomadasCell) === null)
      adv.push({ donde, mensaje: `Horas ya tomadas no reconocidas: "${cellText(tomadasCell)}" (se usa 0)` })
    filas.push({
      fila: r + 1,
      fecha,
      detalle: cellText(table.get(r, 'detalle')),
      horasTrabajadas,
      recargo,
      horasTomadas,
      observaciones: cellText(table.get(r, 'observaciones')),
    })
  }
  return { hoja: sheet.name, anio, ...params, filas }
}

// ---------- Archivo completo ----------

export function parseCuentas(wb: Workbook): ResultadoCuentas {
  const advertencias: Advertencia[] = []
  const personal = parsePersonal(wb, advertencias)
  const horasExtra = sheetsByPrefix(wb, PREFIJO_HE)
    .map((s) => parseHorasExtra(wb, s, advertencias))
    .filter((h): h is HojaHorasExtra => h !== null)
  const compensatorias = sheetsByPrefix(wb, PREFIJO_COMP)
    .map((s) => parseCompensatorias(wb, s, horasExtra, advertencias))
    .filter((h): h is HojaCompensatorias => h !== null)
  const filas =
    (personal?.items.length ?? 0) +
    horasExtra.reduce((a, h) => a + h.filas.length, 0) +
    compensatorias.reduce((a, h) => a + h.filas.length, 0)
  return { datos: { personal, horasExtra, compensatorias }, filas, advertencias }
}
