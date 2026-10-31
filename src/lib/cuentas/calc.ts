import { compareYmd, toDayNumber, type Ymd } from '../dates'
import { clp } from '../format'
import type { DatosPersonal, EstadoHE, FilaCompensatoria, FilaHorasExtra, HojaCompensatorias, HojaHorasExtra, ItemPersonal, Parametros } from '../model'

// ---------- Personal ----------

export function neto(i: ItemPersonal): number {
  if (i.direccion === 'me_debe') return i.monto
  if (i.direccion === 'yo_debo') return -i.monto
  return 0
}

export interface ResumenPersona {
  persona: string
  netoPendiente: number
  netoPagado: number
  pendientes: ItemPersonal[]
  pagados: ItemPersonal[]
}

export interface ResumenPersonal {
  meDebenPendiente: number
  yoDeboPendiente: number
  netoPendiente: number
  netoPagado: number
  personas: ResumenPersona[]
}

export function resumenPersonal(datos: DatosPersonal): ResumenPersonal {
  const porPersona = new Map<string, ResumenPersona>()
  for (const p of datos.personas) porPersona.set(p, { persona: p, netoPendiente: 0, netoPagado: 0, pendientes: [], pagados: [] })
  let meDeben = 0
  let yoDebo = 0
  let netoPagado = 0
  for (const i of datos.items) {
    let rp = porPersona.get(i.persona)
    if (!rp) porPersona.set(i.persona, (rp = { persona: i.persona, netoPendiente: 0, netoPagado: 0, pendientes: [], pagados: [] }))
    const n = neto(i)
    if (i.pagado) {
      rp.pagados.push(i)
      rp.netoPagado += n
      netoPagado += n
    } else {
      rp.pendientes.push(i)
      rp.netoPendiente += n
      if (i.direccion === 'me_debe') meDeben += i.monto
      if (i.direccion === 'yo_debo') yoDebo += i.monto
    }
  }
  const personas = [...porPersona.values()].sort(
    (a, b) => Math.abs(b.netoPendiente) - Math.abs(a.netoPendiente) || a.persona.localeCompare(b.persona, 'es'),
  )
  return { meDebenPendiente: meDeben, yoDeboPendiente: yoDebo, netoPendiente: meDeben - yoDebo, netoPagado, personas }
}

/** Texto para WhatsApp con el detalle pendiente de una persona. */
export function textoCobro(rp: ResumenPersona): string {
  const nombre = rp.persona
  const items = rp.pendientes.filter((i) => i.direccion)
  const teDebo = rp.netoPendiente < 0
  const mixto = items.some((i) => i.direccion === 'me_debe') && items.some((i) => i.direccion === 'yo_debo')
  const linea = (i: ItemPersonal) => {
    const concepto = i.concepto || 'Sin concepto'
    if (!mixto) return `• ${concepto}: ${clp(i.monto)}`
    const mio = i.direccion === 'yo_debo'
    // En un detalle mixto, los ítems en sentido contrario al total se muestran con signo negativo.
    const signo = mio === teDebo ? '' : '-'
    return `• ${concepto}: ${signo}${clp(i.monto)}${mio ? ' (te debo)' : ' (me debes)'}`
  }
  const encabezado = teDebo ? `Hola ${nombre}, te dejo el detalle de lo que te debo:` : `Hola ${nombre}, te dejo el detalle pendiente:`
  const total = teDebo ? `Total que te debo: ${clp(-rp.netoPendiente)}` : `Total: ${clp(rp.netoPendiente)}`
  return [encabezado, ...items.map(linea), total].join('\n')
}

// ---------- Horas extra ----------

export function factorDe(p: Parametros, recargo: 25 | 50 | null): number | null {
  if (recargo === 25) return p.factor25
  if (recargo === 50) return p.factor50
  return null
}

export function valorHoraHE(hoja: Parametros, f: { recargo: 25 | 50 | null }): number | null {
  const factor = factorDe(hoja, f.recargo)
  return factor === null || hoja.valorHora === null ? null : hoja.valorHora * factor
}

export function montoHE(hoja: HojaHorasExtra, f: FilaHorasExtra): number | null {
  const vh = valorHoraHE(hoja, f)
  return vh === null ? null : f.horas * vh
}

export interface TotalEstado {
  horas: number
  monto: number
  filas: number
  /** Filas cuyo monto no se pudo calcular. */
  sinMonto: number
}

export const ESTADOS_HE: EstadoHE[] = ['Pagado', 'No pagado', 'Programado']

export function totalesHE(hoja: HojaHorasExtra): Record<EstadoHE | 'Total', TotalEstado> {
  const vacio = (): TotalEstado => ({ horas: 0, monto: 0, filas: 0, sinMonto: 0 })
  const out = { Pagado: vacio(), 'No pagado': vacio(), Programado: vacio(), Total: vacio() }
  for (const f of hoja.filas) {
    const m = montoHE(hoja, f)
    for (const t of f.estado ? [out[f.estado], out.Total] : [out.Total]) {
      t.horas += f.horas
      t.filas += 1
      if (m === null) t.sinMonto += 1
      else t.monto += m
    }
  }
  return out
}

export function agruparPorMes(filas: FilaHorasExtra[]): { mes: string; filas: FilaHorasExtra[] }[] {
  const grupos: { mes: string; filas: FilaHorasExtra[] }[] = []
  for (const f of filas) {
    let g = grupos.find((x) => x.mes === f.mes)
    if (!g) grupos.push((g = { mes: f.mes, filas: [] }))
    g.filas.push(f)
  }
  return grupos
}

// ---------- Compensatorias ----------

export type EstadoComp = 'Realizada' | 'Programada'

export interface FilaCompCalc extends FilaCompensatoria {
  factor: number | null
  generadas: number | null
  estado: EstadoComp
  saldo: number | null
  equivalente: number | null
}

export function calcularComp(hoja: HojaCompensatorias, hoy: Ymd): FilaCompCalc[] {
  return hoja.filas.map((f) => {
    const factor = factorDe(hoja, f.recargo)
    const generadas = factor === null ? null : f.horasTrabajadas * factor
    const saldo = generadas === null ? null : generadas - f.horasTomadas
    return {
      ...f,
      factor,
      generadas,
      estado: compareYmd(f.fecha, hoy) <= 0 ? 'Realizada' : 'Programada',
      saldo,
      equivalente: saldo === null || hoja.valorHora === null ? null : saldo * hoja.valorHora,
    }
  })
}

export interface TotalComp {
  filas: number
  horasTrabajadas: number
  generadas: number
  tomadas: number
  saldo: number
  equivalente: number
  sinCalculo: number
}

export function totalesComp(filas: FilaCompCalc[]): Record<EstadoComp | 'Total', TotalComp> {
  const vacio = (): TotalComp => ({ filas: 0, horasTrabajadas: 0, generadas: 0, tomadas: 0, saldo: 0, equivalente: 0, sinCalculo: 0 })
  const out = { Realizada: vacio(), Programada: vacio(), Total: vacio() }
  for (const f of filas) {
    for (const t of [out[f.estado], out.Total]) {
      t.filas += 1
      t.horasTrabajadas += f.horasTrabajadas
      t.tomadas += f.horasTomadas
      if (f.generadas === null || f.saldo === null) t.sinCalculo += 1
      else {
        t.generadas += f.generadas
        t.saldo += f.saldo
      }
      t.equivalente += f.equivalente ?? 0
    }
  }
  return out
}

/** Próximas programadas (más cercana primero) y luego realizadas (más reciente primero). */
export function ordenarComp(filas: FilaCompCalc[]): FilaCompCalc[] {
  const prog = filas.filter((f) => f.estado === 'Programada').sort((a, b) => toDayNumber(a.fecha) - toDayNumber(b.fecha))
  const real = filas.filter((f) => f.estado === 'Realizada').sort((a, b) => toDayNumber(b.fecha) - toDayNumber(a.fecha))
  return [...prog, ...real]
}
