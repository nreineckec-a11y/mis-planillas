import { isValidYmd, toDayNumber, fromDayNumber, type Ymd } from '../dates'
import { norm } from '../text'

const MES_TOKENS: Record<string, number> = {
  ene: 1, enero: 1, feb: 2, febrero: 2, mar: 3, marzo: 3, abr: 4, abril: 4, may: 5, mayo: 5,
  jun: 6, junio: 6, jul: 7, julio: 7, ago: 8, agosto: 8, sep: 9, sept: 9, set: 9, septiembre: 9, setiembre: 9,
  oct: 10, octubre: 10, nov: 11, noviembre: 11, dic: 12, diciembre: 12,
}

const IGNORAR = new Set(['y', 'e', 'de', 'del', ',', '.', ';', 'el', 'los', 'dias', 'dia', 'desde'])
const RANGO = new Set(['al', 'a', '-', 'hasta'])
const DIAS_SEMANA = new Set(['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo', 'lun', 'mie', 'jue', 'vie', 'sab', 'dom'])

interface Parcial {
  d: number
  m?: number
  y?: number
}

type Item = { tipo: 'uno'; f: Parcial } | { tipo: 'rango'; desde: Parcial; hasta: Parcial }

/**
 * Interpreta textos como "05 al 11 oct", "06, 13, 20 y 27 oct", "30 oct al 2 nov",
 * "15/10" o "sábado 18 oct". Devuelve null si hay algo que no entiende: es
 * preferible mandar el descuento a "revisar" que adivinar.
 */
export function parseFechasEspecificas(texto: string, anioPorDefecto: number): Ymd[] | null {
  let s = norm(texto)
  if (!s) return null
  // dd/mm o dd-mm(-aaaa) → "dd <mes> [aaaa]" (si no sigue un mes: "05-11 oct" es un rango)
  let invalida = false
  s = s.replace(/\b(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?\b(?!\s*[a-z])/g, (_, d, m, y) => {
    const mes = Object.keys(MES_TOKENS).find((k) => MES_TOKENS[k] === Number(m) && k.length === 3)
    if (!mes) invalida = true
    return ` ${d} ${mes ?? ''} ${y ? (y.length === 2 ? `20${y}` : y) : ''} `
  })
  if (invalida) return null
  const tokens = s.match(/\d+|[a-zñ]+|[,;.-]/g) ?? []
  if (tokens.length === 0) return null

  const items: Item[] = []
  let rangoPendiente = false
  for (const tok of tokens) {
    if (/^\d+$/.test(tok)) {
      const n = Number(tok)
      if (n >= 1900) {
        // Año: aplica a los items sin año.
        for (const it of items) for (const p of partes(it)) p.y ??= n
        continue
      }
      if (n < 1 || n > 31) return null
      if (rangoPendiente) {
        const last = items.pop()
        if (!last || last.tipo !== 'uno') return null
        items.push({ tipo: 'rango', desde: last.f, hasta: { d: n } })
        rangoPendiente = false
      } else items.push({ tipo: 'uno', f: { d: n } })
    } else if (tok in MES_TOKENS) {
      const m = MES_TOKENS[tok]
      if (rangoPendiente) return null
      for (const it of items) {
        if (it.tipo === 'rango') {
          if (it.hasta.m === undefined) {
            it.hasta.m = m
            it.desde.m ??= m
          }
        } else it.f.m ??= m
      }
    } else if (RANGO.has(tok)) {
      if (items.length === 0 || rangoPendiente) return null
      rangoPendiente = true
    } else if (IGNORAR.has(tok) || DIAS_SEMANA.has(tok)) {
      continue
    } else return null
  }
  if (rangoPendiente || items.length === 0) return null

  const out: Ymd[] = []
  for (const it of items) {
    if (it.tipo === 'uno') {
      const f = completar(it.f, anioPorDefecto)
      if (!f) return null
      out.push(f)
    } else {
      const desde = completar(it.desde, anioPorDefecto)
      const hasta = completar(it.hasta, anioPorDefecto)
      if (!desde || !hasta) return null
      let a = toDayNumber(desde)
      let b = toDayNumber(hasta)
      // "28 dic al 3 ene": el término cae el año siguiente.
      if (b < a && desde.m > hasta.m && it.hasta.y === undefined) b = toDayNumber({ ...hasta, y: hasta.y + 1 })
      if (b < a || b - a > 62) return null
      for (; a <= b; a++) out.push(fromDayNumber(a))
    }
  }
  return out
}

function partes(it: Item): Parcial[] {
  return it.tipo === 'uno' ? [it.f] : [it.desde, it.hasta]
}

function completar(p: Parcial, anio: number): Ymd | null {
  if (p.m === undefined) return null
  const ymd = { y: p.y ?? anio, m: p.m, d: p.d }
  return isValidYmd(ymd) ? ymd : null
}
