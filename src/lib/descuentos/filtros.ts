import { weekday, type Ymd } from '../dates'
import type { DatosDescuentos, Descuento } from '../model'
import { norm } from '../text'

export interface Filtros {
  tarjetas: string[]
  zonas: string[]
  canales: string[]
  categorias: string[]
  tipos: string[]
  sectores: string[]
  texto: string
}

export const FILTROS_VACIOS: Filtros = { tarjetas: [], zonas: [], canales: [], categorias: [], tipos: [], sectores: [], texto: '' }

/** Por defecto se muestran todas las zonas menos estas (equivale al antiguo "RM/online"). */
const ZONAS_FUERA_POR_DEFECTO = ['regiones', 'region', 'solo regiones']
export const zonasPorDefecto = (zonas: string[]) => zonas.filter((z) => !ZONAS_FUERA_POR_DEFECTO.includes(norm(z)))

/** Coincidencia de texto libre: comercio, comuna, sector o tipo (sin tildes ni mayúsculas). */
export function calzaTexto(d: Descuento, texto: string): boolean {
  const t = norm(texto)
  return !t || [d.comercio, d.comuna, d.sector, d.tipo].some((x) => norm(x).includes(t))
}

export function pasaFiltros(d: Descuento, f: Filtros): boolean {
  if (f.tarjetas.length && !f.tarjetas.includes(d.tarjeta)) return false
  if (f.zonas.length && !f.zonas.includes(d.zona)) return false
  if (f.canales.length && !f.canales.includes(d.canal)) return false
  if (f.categorias.length && !f.categorias.includes(d.categoriaGrupo)) return false
  if (f.tipos.length && !f.tipos.includes(d.tipo)) return false
  if (f.sectores.length && !f.sectores.includes(d.sector)) return false
  return calzaTexto(d, f.texto)
}

/** Tope para ordenar: sin tope declarado cuenta como el mejor. */
function topeOrden(d: Descuento): number {
  if (d.tope !== null) return d.tope
  return norm(d.tipoTope).includes('sin tope') ? Infinity : 0
}

export function compararDescuentos(a: Descuento, b: Descuento): number {
  const pa = a.pct ?? -1
  const pb = b.pct ?? -1
  if (pb !== pa) return pb - pa
  const ma = a.montoFijo ?? 0
  const mb = b.montoFijo ?? 0
  if (mb !== ma) return mb - ma
  const ta = topeOrden(a)
  const tb = topeOrden(b)
  if (tb !== ta) return tb > ta ? 1 : -1
  return a.comercio.localeCompare(b.comercio, 'es')
}

export interface DelDia {
  aplican: Descuento[]
  revisar: Descuento[]
}

/** Descuentos que aplican a una fecha: su día de semana + todos los días + fechas específicas que la incluyen. */
export function descuentosDelDia(items: Descuento[], fecha: Ymd, f: Filtros): DelDia {
  const wd = weekday(fecha)
  const aplican: Descuento[] = []
  const revisar: Descuento[] = []
  for (const d of items) {
    if (!pasaFiltros(d, f)) continue
    if (d.dia === wd || d.dia === 'todos') aplican.push(d)
    else if (d.dia === 'especificas') {
      if (d.fechas === null) revisar.push(d)
      else if (d.fechas.some((x) => x.y === fecha.y && x.m === fecha.m && x.d === fecha.d)) aplican.push(d)
    }
  }
  aplican.sort(compararDescuentos)
  revisar.sort(compararDescuentos)
  return { aplican, revisar }
}

export function valoresUnicos(items: Descuento[], key: 'tarjeta' | 'zona' | 'canal' | 'categoriaGrupo' | 'tipo' | 'sector'): string[] {
  const porConfirmar = (s: string) => (norm(s) === 'por confirmar' ? 1 : 0)
  return [...new Set(items.map((d) => d[key]).filter(Boolean))].sort((a, b) => porConfirmar(a) - porConfirmar(b) || a.localeCompare(b, 'es'))
}

// ---------- Buscar comercio ----------

export function comerciosQueCalzan(items: Descuento[], texto: string): string[] {
  const t = norm(texto)
  if (!t) return []
  const set = new Map<string, string>()
  for (const d of items) {
    const k = norm(d.comercio)
    if (calzaTexto(d, t)) set.set(k, set.get(k) ?? d.comercio)
  }
  return [...set.values()].sort((a, b) => a.localeCompare(b, 'es'))
}

export interface TablaComercio {
  tarjetas: string[]
  /** celdas[tarjeta][díaSemana 0–6] */
  celdas: Record<string, (Descuento | null)[]>
  especificas: Descuento[]
}

/** Para un comercio: mejor descuento por tarjeta y día de la semana. */
export function tablaComercio(items: Descuento[], comercio: string): TablaComercio {
  const k = norm(comercio)
  const propios = items.filter((d) => norm(d.comercio) === k)
  const celdas: Record<string, (Descuento | null)[]> = {}
  const especificas: Descuento[] = []
  for (const d of propios) {
    if (d.dia === 'especificas') {
      especificas.push(d)
      continue
    }
    const fila = (celdas[d.tarjeta] ??= [null, null, null, null, null, null, null])
    const dias = d.dia === 'todos' ? [0, 1, 2, 3, 4, 5, 6] : [d.dia]
    for (const i of dias) {
      const actual = fila[i]
      if (!actual || compararDescuentos(d, actual) < 0) fila[i] = d
    }
  }
  const tarjetas = Object.keys(celdas).sort((a, b) => a.localeCompare(b, 'es'))
  return { tarjetas, celdas, especificas: especificas.sort(compararDescuentos) }
}

/** Reemplaza "img:<clave>" por la foto incrustada correspondiente (sin copiarla). */
export function resolverFotos(datos: DatosDescuentos): Descuento[] {
  const imgs = datos.imagenes
  if (!imgs) return datos.items
  const r = (u: string | null) => (u?.startsWith('img:') ? (imgs[u.slice(4)] ?? null) : u)
  return datos.items.map((d) => (d.foto?.startsWith('img:') || d.miniatura?.startsWith('img:') ? { ...d, foto: r(d.foto), miniatura: r(d.miniatura) } : d))
}
