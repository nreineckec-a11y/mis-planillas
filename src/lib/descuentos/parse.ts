import type { Workbook } from '../xlsx/reader'
import { findTable, isTable, rowLabel, sheetByName, type ColumnSpec } from '../table'
import { cellNumber, cellText, norm, toFraction, toNumber } from '../text'
import { MESES } from '../dates'
import type { Advertencia, DatosDescuentos, Descuento, DiaDcto } from '../model'
import { parseFechasEspecificas } from './fechas'

export const HOJA_POR_DIA = 'Por día'
export const HOJA_RESUMEN_DCTOS = 'Resumen'

export const COLS_DESCUENTOS: ColumnSpec[] = [
  { key: 'dia', names: ['Día', 'Dia'], required: true },
  { key: 'fechaEspecifica', names: ['Fecha específica', 'Fecha especifica', 'Fechas específicas'] },
  { key: 'pct', names: ['% dcto.', '% dcto', '% descuento', 'Descuento'], required: true },
  { key: 'montoFijo', names: ['Monto fijo'] },
  { key: 'tope', names: ['Tope ($)', 'Tope'] },
  { key: 'tipoTope', names: ['Tipo de tope'] },
  { key: 'tarjeta', names: ['Tarjeta'], required: true },
  { key: 'comercio', names: ['Comercio'], required: true },
  { key: 'categoria', names: ['Categoría', 'Categoria'] },
  { key: 'comuna', names: ['Comuna / región', 'Comuna / region', 'Comuna'] },
  { key: 'zona', names: ['Zona'] },
  { key: 'canal', names: ['Canal'] },
  { key: 'tarjetasAplican', names: ['Tarjetas que aplican'] },
  { key: 'vigencia', names: ['Vigencia'] },
  { key: 'condiciones', names: ['Condiciones'] },
  { key: 'verificacion', names: ['Verificación', 'Verificacion'] },
  { key: 'fuente', names: ['Fuente'] },
]

/** Relleno "dato no verificado": FFF2CC exacto o cualquier amarillo claro. */
export function esAmarillo(hex: string | undefined): boolean {
  if (!hex) return false
  if (hex === 'FFF2CC') return true
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  if (max - min < 25) return false // gris/blanco
  const l = (max + min) / 510
  let h: number
  if (max === r) h = (((g - b) / (max - min)) * 60 + 360) % 360
  else if (max === g) h = ((b - r) / (max - min) + 2) * 60
  else h = ((r - g) / (max - min) + 4) * 60
  return h >= 38 && h <= 65 && l >= 0.5
}

const DIA_MAP: Record<string, DiaDcto> = {
  lunes: 0, martes: 1, miercoles: 2, jueves: 3, viernes: 4, sabado: 5, domingo: 6,
  'todos los dias': 'todos', todos: 'todos', 'fechas especificas': 'especificas', 'fecha especifica': 'especificas',
}

export function parseDia(s: string): DiaDcto | null {
  const v = DIA_MAP[norm(s)]
  return v === undefined ? null : v
}

/** "Descuentos de octubre 2026" → { y: 2026, m: 10 }. */
export function parsePeriodo(titulo: string): { y: number; m: number } | null {
  const n = norm(titulo)
  const m = MESES.findIndex((mes) => n.includes(mes))
  const y = /\b(20\d{2})\b/.exec(n)
  if (m < 0 || !y) return null
  return { y: Number(y[1]), m: m + 1 }
}

/** "Restaurante – Sabores 40% Visa" → "Restaurante". */
export function grupoCategoria(cat: string): string {
  const g = cat.split(/\s[–—-]\s/)[0].trim()
  return g || cat.trim()
}

export interface ResultadoDescuentos {
  datos: DatosDescuentos
  filas: number
  advertencias: Advertencia[]
}

export function parseDescuentos(wb: Workbook, anioActual: number): ResultadoDescuentos {
  const advertencias: Advertencia[] = []
  const sheet = sheetByName(wb, HOJA_POR_DIA)
  if (!sheet) throw new Error(`No encontré la hoja "${HOJA_POR_DIA}"`)
  const table = findTable(sheet, COLS_DESCUENTOS)
  if (!isTable(table)) throw new Error(`En la hoja "${sheet.name}" faltan los encabezados: ${table.missing.join(', ')}`)

  // Título → mes del set.
  let titulo: string | null = null
  const resumen = sheetByName(wb, HOJA_RESUMEN_DCTOS)
  const a1 = cellText(resumen?.rows[0]?.[0])
  if (a1) titulo = a1
  const periodo = titulo ? parsePeriodo(titulo) : null
  if (!titulo) advertencias.push({ donde: HOJA_RESUMEN_DCTOS, mensaje: 'No encontré el título en Resumen!A1 (no se puede saber el mes del set)' })
  else if (!periodo) advertencias.push({ donde: HOJA_RESUMEN_DCTOS, mensaje: `No pude leer mes y año del título "${titulo}"` })
  const anio = periodo?.y ?? anioActual

  const items: Descuento[] = []
  for (const r of table.rowIndexes) {
    const comercio = cellText(table.get(r, 'comercio'))
    if (!comercio) continue
    const donde = rowLabel(sheet, r)
    const diaRaw = cellText(table.get(r, 'dia'))
    const dia = parseDia(diaRaw)
    if (dia === null) {
      advertencias.push({ donde, mensaje: `Día no reconocido: "${diaRaw}" (fila ignorada)` })
      continue
    }
    const pctCell = table.get(r, 'pct')
    const pct = pctCell ? toFraction(pctCell.v) : null
    const montoFijo = cellNumber(table.get(r, 'montoFijo'))
    if (pct === null && montoFijo === null) advertencias.push({ donde, mensaje: `"${comercio}" sin % ni monto fijo` })
    const fechaEspecifica = cellText(table.get(r, 'fechaEspecifica'))
    let fechas: Descuento['fechas'] = null
    if (dia === 'especificas') {
      fechas = parseFechasEspecificas(fechaEspecifica, anio)
      if (!fechas)
        advertencias.push({ donde, mensaje: `No pude interpretar la fecha específica "${fechaEspecifica}" (queda en "revisar")` })
    }
    const fuenteCell = table.get(r, 'fuente')
    let fuente = fuenteCell?.link ?? null
    const fuenteTxt = cellText(fuenteCell)
    if (!fuente && /^https?:\/\//i.test(fuenteTxt)) fuente = fuenteTxt
    if (fuente && !/^https?:\/\//i.test(fuente)) fuente = null
    const categoria = cellText(table.get(r, 'categoria'))
    const noVerificado = esAmarillo(table.get(r, 'tarjetasAplican')?.fill) || esAmarillo(table.get(r, 'verificacion')?.fill)

    items.push({
      id: items.length,
      fila: r + 1,
      dia,
      fechaEspecifica,
      fechas,
      pct: pct !== null && pct > 0 ? pct : null,
      montoFijo,
      tope: toNumber(table.get(r, 'tope')?.v),
      tipoTope: cellText(table.get(r, 'tipoTope')),
      tarjeta: cellText(table.get(r, 'tarjeta')),
      comercio,
      categoria,
      categoriaGrupo: categoria ? grupoCategoria(categoria) : '',
      comuna: cellText(table.get(r, 'comuna')),
      zona: cellText(table.get(r, 'zona')),
      canal: cellText(table.get(r, 'canal')),
      tarjetasAplican: cellText(table.get(r, 'tarjetasAplican')),
      vigencia: cellText(table.get(r, 'vigencia')),
      condiciones: cellText(table.get(r, 'condiciones')),
      verificacion: cellText(table.get(r, 'verificacion')),
      fuente,
      noVerificado,
    })
  }
  return { datos: { titulo, periodo, items }, filas: items.length, advertencias }
}
