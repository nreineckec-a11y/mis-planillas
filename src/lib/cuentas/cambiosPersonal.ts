// Cambios hechos en la app sobre "Personal": cobros nuevos, pagos marcados y
// personas nuevas. Igual que en Trabajo, se guardan aparte del Excel y se
// descartan solos cuando el Excel cargado ya los incluye.
import { clp } from '../format'
import type { DatosPersonal, Direccion, ItemPersonal } from '../model'
import { norm } from '../text'

export interface CobroLocal {
  id: string
  creado: string
  persona: string
  concepto: string
  direccion: Direccion
  monto: number
  pagado: boolean
}

/** Cambio de "Pagado" sobre un ítem que viene del Excel. */
export interface MarcaPago {
  clave: string
  pagado: boolean
  cuando: string
  descripcion: string
}

export interface CambiosPersonal {
  cobros: CobroLocal[]
  pagos: MarcaPago[]
  personas: string[]
}

export interface ItemVista extends ItemPersonal {
  clave: string
  origen: 'excel' | 'app'
  pagadoExcel: boolean
  modificado: boolean
}

export interface PersonalVista {
  items: ItemVista[]
  personas: string[]
}

export const claveCobroLocal = (id: string) => `app:${id}`

export function totalCambiosPersonal(c: CambiosPersonal): number {
  return c.cobros.length + c.pagos.length + c.personas.length
}

/** Clave estable de cada ítem del Excel (no depende del número de fila). */
export function clavesPersonal(items: ItemPersonal[]): string[] {
  const vistos = new Map<string, number>()
  return items.map((i) => {
    const base = [norm(i.persona), norm(i.concepto), i.direccion ?? '', i.monto].join('|')
    const n = vistos.get(base) ?? 0
    vistos.set(base, n + 1)
    return `${base}#${n}`
  })
}

const dir = (d: Direccion | null) => (d === 'me_debe' ? 'me debe' : d === 'yo_debo' ? 'le debo' : 'sin dirección')
export const describirItem = (i: Pick<ItemPersonal, 'persona' | 'concepto' | 'direccion' | 'monto'>) =>
  `${i.persona} · ${i.concepto || 'sin concepto'} · ${dir(i.direccion)} ${clp(i.monto)}`

export function combinarPersonal(datos: DatosPersonal | null, c: CambiosPersonal): PersonalVista {
  const items = datos?.items ?? []
  const claves = clavesPersonal(items)
  const pagos = new Map(c.pagos.map((p) => [p.clave, p]))
  const vista: ItemVista[] = items.map((i, k) => {
    const m = pagos.get(claves[k])
    return { ...i, clave: claves[k], origen: 'excel', pagadoExcel: i.pagado, modificado: !!m, pagado: m ? m.pagado : i.pagado }
  })
  // Las personas escritas distinto ("ana" / "Ana") se unen a la grafía ya conocida.
  const personas = [...(datos?.personas ?? [])]
  const canon = new Map(personas.map((p) => [norm(p), p]))
  const agregar = (p: string) => {
    if (p.trim() && !canon.has(norm(p))) {
      canon.set(norm(p), p.trim())
      personas.push(p.trim())
    }
  }
  c.personas.forEach(agregar)
  c.cobros.forEach((x) => agregar(x.persona))
  c.cobros.forEach((x, k) =>
    vista.push({
      fila: -(k + 1),
      persona: canon.get(norm(x.persona)) ?? x.persona,
      concepto: x.concepto,
      direccion: x.direccion,
      monto: x.monto,
      pagado: x.pagado,
      clave: claveCobroLocal(x.id),
      origen: 'app',
      pagadoExcel: x.pagado,
      modificado: false,
    }),
  )
  return { items: vista, personas }
}

/** Marca como pagados (o pendientes) varios ítems, del Excel o agregados en la app. */
export function marcarPagado<C extends CambiosPersonal>(c: C, vista: PersonalVista, claves: string[], pagado: boolean, ahora = new Date()): C {
  const sel = new Set(claves)
  const cobros = c.cobros.map((x) => (sel.has(claveCobroLocal(x.id)) ? { ...x, pagado } : x))
  let pagos = c.pagos.filter((p) => !sel.has(p.clave))
  for (const i of vista.items) {
    if (!sel.has(i.clave) || i.origen !== 'excel' || i.pagadoExcel === pagado) continue
    pagos = [...pagos, { clave: i.clave, pagado, cuando: ahora.toISOString(), descripcion: describirItem(i) }]
  }
  return { ...c, cobros, pagos }
}

/** ¿El Excel tiene ya este cobro? Misma persona, monto y dirección, y concepto igual o contenido. */
function mismoCobro(i: ItemPersonal, x: CobroLocal): boolean {
  if (norm(i.persona) !== norm(x.persona) || i.monto !== x.monto || i.direccion !== x.direccion) return false
  const a = norm(i.concepto)
  const b = norm(x.concepto)
  return a === b || (!!a && !!b && (a.includes(b) || b.includes(a)))
}

export function reconciliarPersonal<C extends CambiosPersonal>(datos: DatosPersonal | null, c: C): { cambios: C; notas: string[] } {
  const items = datos?.items ?? []
  const claves = clavesPersonal(items)
  const cobros = c.cobros.filter((x) => !items.some((i) => mismoCobro(i, x)))
  let huerfanos = 0
  const pagos = c.pagos.filter((p) => {
    const k = claves.indexOf(p.clave)
    if (k < 0) {
      huerfanos++
      return true
    }
    return items[k].pagado !== p.pagado
  })
  const conocidas = new Set((datos?.personas ?? []).map(norm))
  const personas = c.personas.filter((p) => !conocidas.has(norm(p)))
  const notas: string[] = []
  const ya = c.cobros.length - cobros.length + (c.pagos.length - pagos.length)
  if (ya) notas.push(ya === 1 ? 'Personas: 1 cambio hecho en la app ya está en el Excel; lo quité de la app.' : `Personas: ${ya} cambios hechos en la app ya están en el Excel; los quité de la app.`)
  if (huerfanos)
    notas.push(
      huerfanos === 1
        ? 'Personas: 1 pago marcado no encuentra su ítem en el Excel (¿lo editaste?). Revísalo en Personas → cambios de la app.'
        : `Personas: ${huerfanos} pagos marcados no encuentran su ítem en el Excel (¿los editaste?). Revísalos en Personas → cambios de la app.`,
    )
  const quedan = cobros.length + pagos.length + personas.length
  if (quedan) notas.push(quedan === 1 ? 'Personas: queda 1 cambio por pasar al Excel.' : `Personas: quedan ${quedan} cambios por pasar al Excel.`)
  return { cambios: { ...c, cobros, pagos, personas }, notas }
}

export function pagoVigente(datos: DatosPersonal | null, p: MarcaPago): boolean {
  return clavesPersonal(datos?.items ?? []).includes(p.clave)
}

/** Texto para copiar y pasar los cambios a la hoja "Personal - Detalle". */
export function textoCambiosPersonal(datos: DatosPersonal | null, c: CambiosPersonal): string {
  const l: string[] = ['Cambios hechos en la app (Personas):']
  if (c.personas.length) l.push('', 'Personas nuevas (agregar a "Personal - Resumen"):', ...c.personas.map((p) => `• ${p}`))
  if (c.cobros.length) {
    l.push('', 'Cobros nuevos (Concepto | Persona | Dirección | Monto | Pagado):')
    for (const x of c.cobros) l.push(`• ${x.concepto || 'sin concepto'} | ${x.persona} | ${x.direccion === 'me_debe' ? 'Me debe' : 'Yo debo'} | ${x.monto} | ${x.pagado ? 'Sí' : 'No'}`)
  }
  if (c.pagos.length) {
    l.push('', 'Cambiar "Pagado":')
    for (const p of c.pagos) l.push(`• ${p.descripcion} → ${p.pagado ? 'Sí' : 'No'}${pagoVigente(datos, p) ? '' : ' ⚠︎ no lo encuentro en el Excel actual'}`)
  }
  return l.join('\n')
}
