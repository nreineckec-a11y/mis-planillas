// Lector mínimo de .xlsx (Office Open XML) que corre en el navegador.
// Lee solo lo que la app necesita: valores, si la celda es fórmula, relleno y
// hipervínculo. No evalúa fórmulas: los cálculos se rehacen en la app.
import { unzipSync, strFromU8 } from 'fflate'

export interface Cell {
  /** Valor tal como viene en el archivo (para fórmulas, el valor cacheado o null). */
  v: string | number | boolean | null
  /** true si la celda tiene fórmula. */
  formula: boolean
  /** Texto de la fórmula ('' si es fórmula compartida sin texto). */
  f?: string
  /** URL del hipervínculo (relación externa o función HIPERVINCULO). */
  link?: string
  /** Color de relleno sólido resuelto, en RRGGBB mayúsculas. */
  fill?: string
}

/** Imagen insertada en la hoja, anclada a una celda (esquina superior izquierda). */
export interface Imagen {
  row: number
  col: number
  /** Ruta dentro del .xlsx (ej. xl/media/image3.jpeg). */
  ruta: string
  mime: string
  datos: Uint8Array
}

export interface Sheet {
  name: string
  /** rows[fila][columna], 0-based, disperso. */
  rows: (Cell | undefined)[][]
  imagenes: Imagen[]
}

export interface Workbook {
  sheets: Sheet[]
  date1904: boolean
}

export class XlsxError extends Error {}

const NS_ANY = '*'

function parseXml(text: string): Document {
  const doc = new DOMParser().parseFromString(text, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new XlsxError('XML inválido dentro del archivo')
  }
  return doc
}

function els(node: Document | Element, local: string): Element[] {
  return Array.from(node.getElementsByTagNameNS(NS_ANY, local))
}

function children(node: Element, local: string): Element[] {
  return Array.from(node.children).filter((c) => c.localName === local)
}

function child(node: Element, local: string): Element | undefined {
  return children(node, local)[0]
}

/** Atributo r:id (namespace de relaciones), tolerando prefijos distintos. */
function relId(el: Element): string | null {
  for (const attr of Array.from(el.attributes)) {
    if (attr.localName === 'id' && attr.namespaceURI?.includes('relationships')) return attr.value
  }
  return el.getAttribute('r:id')
}

function resolvePath(base: string, target: string): string {
  if (target.startsWith('/')) return target.slice(1)
  const parts = base.split('/').slice(0, -1)
  for (const seg of target.split('/')) {
    if (seg === '..') parts.pop()
    else if (seg !== '.') parts.push(seg)
  }
  return parts.join('/')
}

function relsPathFor(part: string): string {
  const idx = part.lastIndexOf('/')
  return `${part.slice(0, idx)}/_rels/${part.slice(idx + 1)}.rels`
}

interface Rel {
  target: string
  external: boolean
}

function readRels(files: Record<string, Uint8Array>, part: string): Map<string, Rel> {
  const map = new Map<string, Rel>()
  const raw = files[relsPathFor(part)]
  if (!raw) return map
  for (const r of els(parseXml(strFromU8(raw)), 'Relationship')) {
    const external = r.getAttribute('TargetMode') === 'External'
    const target = r.getAttribute('Target') ?? ''
    map.set(r.getAttribute('Id') ?? '', { target: external ? target : resolvePath(part, target), external })
  }
  return map
}

/** "AB12" → { row: 11, col: 27 } (0-based). */
export function decodeRef(ref: string): { row: number; col: number } {
  const m = /^\$?([A-Z]+)\$?(\d+)$/i.exec(ref.trim())
  if (!m) throw new XlsxError(`Referencia de celda inválida: ${ref}`)
  let col = 0
  for (const ch of m[1].toUpperCase()) col = col * 26 + (ch.charCodeAt(0) - 64)
  return { row: Number(m[2]) - 1, col: col - 1 }
}

function textOf(si: Element): string {
  // Concatena todos los <t>, excepto los de guía fonética (<rPh>).
  return els(si, 't')
    .filter((t) => t.parentElement?.localName !== 'rPh')
    .map((t) => t.textContent ?? '')
    .join('')
}

// ---------- Colores ----------

const INDEXED: Record<number, string> = {
  // Paleta indexada clásica (solo las entradas más usadas).
  0: '000000', 1: 'FFFFFF', 2: 'FF0000', 3: '00FF00', 4: '0000FF', 5: 'FFFF00', 6: 'FF00FF', 7: '00FFFF',
  8: '000000', 9: 'FFFFFF', 10: 'FF0000', 11: '00FF00', 12: '0000FF', 13: 'FFFF00', 14: 'FF00FF', 15: '00FFFF',
  26: 'FFFFCC', 43: 'FFFF99', 51: 'FFCC00', 52: 'FF9900',
}

function rgbToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(0, 2), 16) / 255
  const g = parseInt(hex.slice(2, 4), 16) / 255
  const b = parseInt(hex.slice(4, 6), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h: number
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60
  else if (max === g) h = ((b - r) / d + 2) * 60
  else h = ((r - g) / d + 4) * 60
  return [h, s, l]
}

function hslToRgb(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]
  return [r, g, b]
    .map((v) => Math.round((v + m) * 255).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
}

/** Aplica el "tint" de Excel (−1 a 1) sobre la luminosidad. */
export function applyTint(hex: string, tint: number): string {
  if (!tint) return hex
  const [h, s, l] = rgbToHsl(hex)
  const nl = tint < 0 ? l * (1 + tint) : l * (1 - tint) + tint
  return hslToRgb(h, s, nl)
}

function readTheme(files: Record<string, Uint8Array>, themePart: string | undefined): string[] {
  const raw = themePart ? files[themePart] : undefined
  if (!raw) return []
  const doc = parseXml(strFromU8(raw))
  const scheme = els(doc, 'clrScheme')[0]
  if (!scheme) return []
  const order = ['dk1', 'lt1', 'dk2', 'lt2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink']
  const colors = order.map((name) => {
    const el = child(scheme, name)
    const c = el?.firstElementChild
    if (!c) return '000000'
    return (c.getAttribute('val') ?? c.getAttribute('lastClr') ?? '000000').toUpperCase()
  })
  // Excel indexa el tema como lt1, dk1, lt2, dk2, accent1…
  return [colors[1], colors[0], colors[3], colors[2], ...colors.slice(4)]
}

function resolveColor(el: Element | undefined, theme: string[]): string | undefined {
  if (!el) return undefined
  let hex: string | undefined
  const rgb = el.getAttribute('rgb')
  const th = el.getAttribute('theme')
  const idx = el.getAttribute('indexed')
  if (rgb) hex = rgb.slice(-6).toUpperCase()
  else if (th !== null) hex = theme[Number(th)]
  else if (idx !== null) hex = INDEXED[Number(idx)]
  if (!hex) return undefined
  const tint = Number(el.getAttribute('tint') ?? 0)
  return applyTint(hex, tint)
}

/** Relleno sólido por índice de estilo de celda (cellXfs). */
function readFills(files: Record<string, Uint8Array>, stylesPart: string | undefined, theme: string[]): (string | undefined)[] {
  const raw = stylesPart ? files[stylesPart] : undefined
  if (!raw) return []
  const doc = parseXml(strFromU8(raw))
  const fillsEl = els(doc, 'fills')[0]
  const fills = fillsEl
    ? children(fillsEl, 'fill').map((fill) => {
        const pf = child(fill, 'patternFill')
        if (!pf) return undefined
        const type = pf.getAttribute('patternType')
        if (!type || type === 'none') return undefined
        return resolveColor(child(pf, 'fgColor'), theme) ?? resolveColor(child(pf, 'bgColor'), theme)
      })
    : []
  const xfsEl = els(doc, 'cellXfs')[0]
  if (!xfsEl) return []
  return children(xfsEl, 'xf').map((xf) => fills[Number(xf.getAttribute('fillId') ?? 0)])
}

// ---------- Lectura principal ----------

const HYPERLINK_FN = /HYPERLINK\(\s*"([^"]+)"/i

export function readWorkbook(data: ArrayBuffer | Uint8Array): Workbook {
  let files: Record<string, Uint8Array>
  try {
    files = unzipSync(data instanceof Uint8Array ? data : new Uint8Array(data))
  } catch {
    throw new XlsxError('El archivo no es un .xlsx válido (¿es un .xls antiguo o está protegido con contraseña?)')
  }

  const wbPart = 'xl/workbook.xml'
  if (!files[wbPart]) throw new XlsxError('El archivo no es un libro de Excel (.xlsx)')
  const wb = parseXml(strFromU8(files[wbPart]))
  const wbRels = readRels(files, wbPart)

  const pr = els(wb, 'workbookPr')[0]
  const d1904 = pr?.getAttribute('date1904')
  const date1904 = d1904 === '1' || d1904 === 'true'

  let sharedPart: string | undefined
  let stylesPart: string | undefined
  let themePart: string | undefined
  for (const rel of wbRels.values()) {
    if (rel.target.endsWith('sharedStrings.xml')) sharedPart = rel.target
    else if (rel.target.endsWith('styles.xml')) stylesPart = rel.target
    else if (/theme\d*\.xml$/.test(rel.target)) themePart = rel.target
  }
  sharedPart ??= files['xl/sharedStrings.xml'] ? 'xl/sharedStrings.xml' : undefined
  stylesPart ??= files['xl/styles.xml'] ? 'xl/styles.xml' : undefined
  themePart ??= files['xl/theme/theme1.xml'] ? 'xl/theme/theme1.xml' : undefined

  const shared = sharedPart ? els(parseXml(strFromU8(files[sharedPart])), 'si').map(textOf) : []
  const theme = readTheme(files, themePart)
  const fills = readFills(files, stylesPart, theme)

  const sheets: Sheet[] = []
  for (const s of els(wb, 'sheet')) {
    const name = s.getAttribute('name') ?? ''
    const rel = wbRels.get(relId(s) ?? '')
    if (!rel || !files[rel.target]) continue
    sheets.push(readSheet(files, rel.target, name, shared, fills))
  }
  return { sheets, date1904 }
}

function readSheet(
  files: Record<string, Uint8Array>,
  part: string,
  name: string,
  shared: string[],
  fills: (string | undefined)[],
): Sheet {
  const doc = parseXml(strFromU8(files[part]))
  const rows: (Cell | undefined)[][] = []
  const sheetData = els(doc, 'sheetData')[0]
  let rowIdx = -1
  for (const rowEl of sheetData ? children(sheetData, 'row') : []) {
    const rAttr = rowEl.getAttribute('r')
    rowIdx = rAttr ? Number(rAttr) - 1 : rowIdx + 1
    const row: (Cell | undefined)[] = (rows[rowIdx] ??= [])
    let colIdx = -1
    for (const c of children(rowEl, 'c')) {
      const ref = c.getAttribute('r')
      colIdx = ref ? decodeRef(ref).col : colIdx + 1
      const t = c.getAttribute('t') ?? 'n'
      const fEl = child(c, 'f')
      const vEl = child(c, 'v')
      const raw = vEl?.textContent ?? null
      let v: Cell['v'] = null
      if (t === 's') v = raw === null ? null : (shared[Number(raw)] ?? null)
      else if (t === 'inlineStr') {
        const is = child(c, 'is')
        v = is ? textOf(is) : null
      } else if (t === 'b') v = raw === null ? null : raw === '1'
      else if (t === 'str' || t === 'd') v = raw
      else if (t === 'e') v = null
      else v = raw === null || raw === '' ? null : Number(raw)
      if (typeof v === 'string' && v === '') v = null

      const cell: Cell = { v, formula: !!fEl }
      if (fEl) {
        cell.f = fEl.textContent ?? ''
        const m = HYPERLINK_FN.exec(cell.f)
        if (m) cell.link = m[1]
      }
      const fill = fills[Number(c.getAttribute('s') ?? 0)]
      if (fill) cell.fill = fill
      if (v !== null || fEl || fill) row[colIdx] = cell
    }
  }

  // Hipervínculos (relaciones externas de la hoja).
  const rels = readRels(files, part)
  for (const h of els(doc, 'hyperlink')) {
    const ref = h.getAttribute('ref')
    const rel = rels.get(relId(h) ?? '')
    if (!ref || !rel?.external) continue
    const [a, b = a] = ref.split(':')
    const from = decodeRef(a)
    const to = decodeRef(b)
    for (let r = from.row; r <= to.row; r++) {
      for (let col = from.col; col <= to.col; col++) {
        const row = (rows[r] ??= [])
        const cell = (row[col] ??= { v: null, formula: false })
        cell.link = rel.target
      }
    }
  }

  return { name, rows, imagenes: readImagenes(files, doc, rels) }
}

const MIME: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp' }

/** Imágenes de la hoja (dibujos anclados a celdas: lo que hace "Insertar imagen" en Excel u openpyxl). */
function readImagenes(files: Record<string, Uint8Array>, doc: Document, rels: Map<string, Rel>): Imagen[] {
  const out: Imagen[] = []
  for (const d of els(doc, 'drawing')) {
    const rel = rels.get(relId(d) ?? '')
    if (!rel || rel.external || !files[rel.target]) continue
    const drawing = parseXml(strFromU8(files[rel.target]))
    const drawRels = readRels(files, rel.target)
    for (const anchor of [...els(drawing, 'twoCellAnchor'), ...els(drawing, 'oneCellAnchor')]) {
      const from = child(anchor, 'from')
      const blip = els(anchor, 'blip')[0]
      if (!from || !blip) continue
      const embed = Array.from(blip.attributes).find((a) => a.localName === 'embed')?.value
      const media = embed ? drawRels.get(embed) : undefined
      if (!media || media.external || !files[media.target]) continue
      const mime = MIME[media.target.split('.').pop()?.toLowerCase() ?? '']
      if (!mime) continue
      out.push({
        row: Number(child(from, 'row')?.textContent ?? -1),
        col: Number(child(from, 'col')?.textContent ?? -1),
        ruta: media.target,
        mime,
        datos: files[media.target],
      })
    }
  }
  return out
}
