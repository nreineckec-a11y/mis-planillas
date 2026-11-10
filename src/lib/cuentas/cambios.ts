// Cambios hechos en la app sobre la parte de Trabajo (turnos nuevos y marcas de
// pago). Se guardan aparte del Excel para no perderlos al cargar uno nuevo; al
// importar, los que ya aparecen en el Excel se descartan solos.
import { compareYmd, formatYmd, MESES, type Ymd } from '../dates'
import { clp, horas as fmtHoras } from '../format'
import { textoFechaHE } from './calc'
import type { DatosCuentas, EstadoHE, FilaCompensatoria, FilaHorasExtra, HojaCompensatorias, HojaHorasExtra } from '../model'
import { norm } from '../text'

export interface TurnoHELocal {
  id: string
  creado: string
  anio: string | null
  fecha: Ymd
  detalle: string
  horas: number
  recargo: 25 | 50
  estado: EstadoHE
  liquidacion: string
  observaciones: string
}

export interface TurnoCompLocal {
  id: string
  creado: string
  anio: string | null
  fecha: Ymd
  detalle: string
  horasTrabajadas: number
  recargo: 25 | 50
  horasTomadas: number
  observaciones: string
}

/** Cambio de estado sobre una fila que viene del Excel. */
export interface MarcaEstado {
  clave: string
  anio: string | null
  estado: EstadoHE
  liquidacion: string
  cuando: string
  /** Descripción legible de la fila, para el resumen y si deja de encontrarse en el Excel. */
  descripcion: string
}

export interface CambiosTrabajo {
  he: TurnoHELocal[]
  comp: TurnoCompLocal[]
  marcas: MarcaEstado[]
}

export const SIN_CAMBIOS: CambiosTrabajo = { he: [], comp: [], marcas: [] }

export function nuevoId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
export const mesDe = (f: Ymd) => cap(MESES[f.m - 1])
/** "05.11", el mismo estilo de texto que la columna Fecha del Excel. */
export const fechaCorta = (f: Ymd) => `${String(f.d).padStart(2, '0')}.${String(f.m).padStart(2, '0')}`

export function totalCambios(c: CambiosTrabajo): number {
  return c.he.length + c.comp.length + c.marcas.length
}

// ---------- Horas extra ----------

export interface FilaHEVista extends FilaHorasExtra {
  clave: string
  origen: 'excel' | 'app'
  /** Estado y liquidación originales del Excel (para mostrar qué cambió). */
  estadoExcel: EstadoHE | null
  modificado: boolean
}

export interface HojaHEVista extends HojaHorasExtra {
  filas: FilaHEVista[]
}

const claveBase = (anio: string | null, f: FilaHorasExtra) =>
  [anio ?? '', norm(f.mes), norm(f.fecha), norm(f.detalle), f.horas, f.recargo ?? ''].join('|')

/** Clave estable de cada fila del Excel (no depende del número de fila). */
export function clavesHE(hoja: HojaHorasExtra): string[] {
  const vistas = new Map<string, number>()
  return hoja.filas.map((f) => {
    const base = claveBase(hoja.anio, f)
    const n = vistas.get(base) ?? 0
    vistas.set(base, n + 1)
    return `${base}#${n}`
  })
}

export const claveLocal = (id: string) => `app:${id}`

export function describirHE(f: FilaHorasExtra): string {
  const cuando = [textoFechaHE(f) || 'sin fecha', f.mes && `(${f.mes})`].filter(Boolean).join(' ')
  return [cuando, f.detalle || 'sin detalle', fmtHoras(f.horas), f.recargo ? `${f.recargo}%` : ''].filter(Boolean).join(' · ')
}

export function turnoHEaFila(t: TurnoHELocal, fila: number): FilaHorasExtra {
  return {
    fila,
    mes: mesDe(t.fecha),
    fecha: fechaCorta(t.fecha),
    detalle: t.detalle,
    horas: t.horas,
    recargo: t.recargo,
    estado: t.estado,
    estadoRaw: t.estado,
    liquidacion: t.liquidacion,
    observaciones: t.observaciones,
  }
}

/** Hoja del Excel + marcas de estado + turnos agregados en la app. */
export function combinarHE(hoja: HojaHorasExtra, c: CambiosTrabajo): HojaHEVista {
  const marcas = new Map(c.marcas.filter((m) => m.anio === hoja.anio).map((m) => [m.clave, m]))
  const claves = clavesHE(hoja)
  const filas: FilaHEVista[] = hoja.filas.map((f, i) => {
    const m = marcas.get(claves[i])
    return {
      ...f,
      clave: claves[i],
      origen: 'excel',
      estadoExcel: f.estado,
      modificado: !!m,
      ...(m ? { estado: m.estado, estadoRaw: m.estado, liquidacion: m.liquidacion } : {}),
    }
  })
  const locales = c.he
    .filter((t) => t.anio === hoja.anio)
    .sort((a, b) => compareYmd(a.fecha, b.fecha))
    .map((t, i) => ({ ...turnoHEaFila(t, -(i + 1)), clave: claveLocal(t.id), origen: 'app' as const, estadoExcel: null, modificado: false }))
  // Los turnos nuevos van dentro de su mes si ya existe en el Excel; si no, al final.
  for (const l of locales) {
    let pos = -1
    filas.forEach((f, i) => norm(f.mes) === norm(l.mes) && (pos = i))
    if (pos >= 0) filas.splice(pos + 1, 0, l)
    else filas.push(l)
  }
  return { ...hoja, filas }
}

/** Cambia el estado de varias filas (del Excel o de la app). */
export function marcarEstado(
  c: CambiosTrabajo,
  hoja: HojaHEVista,
  claves: string[],
  estado: EstadoHE,
  liquidacion: string,
  ahora = new Date(),
): CambiosTrabajo {
  const sel = new Set(claves)
  const he = c.he.map((t) => (sel.has(claveLocal(t.id)) ? { ...t, estado, liquidacion: estado === 'Pagado' ? liquidacion : '' } : t))
  let marcas = c.marcas.filter((m) => !(m.anio === hoja.anio && sel.has(m.clave)))
  const originales = new Map(hoja.filas.map((f) => [f.clave, f]))
  for (const clave of claves) {
    const f = originales.get(clave)
    if (!f || f.origen !== 'excel') continue
    const liq = estado === 'Pagado' ? liquidacion : ''
    // Si vuelve a quedar como en el Excel, no hay nada que guardar.
    if (estado === f.estadoExcel && (estado !== 'Pagado' || !liq)) continue
    marcas = [...marcas, { clave, anio: hoja.anio, estado, liquidacion: liq, cuando: ahora.toISOString(), descripcion: describirHE(f) }]
  }
  return { ...c, he, marcas }
}

export function quitarMarca(c: CambiosTrabajo, anio: string | null, clave: string): CambiosTrabajo {
  return { ...c, marcas: c.marcas.filter((m) => !(m.anio === anio && m.clave === clave)) }
}

// ---------- Compensatorias ----------

export interface FilaCompVista extends FilaCompensatoria {
  origen: 'excel' | 'app'
  idLocal?: string
}

export function combinarComp(hoja: HojaCompensatorias, c: CambiosTrabajo): HojaCompensatorias & { filas: FilaCompVista[] } {
  const locales: FilaCompVista[] = c.comp
    .filter((t) => t.anio === hoja.anio)
    .map((t, i) => ({
      fila: -(i + 1),
      fecha: t.fecha,
      detalle: t.detalle,
      horasTrabajadas: t.horasTrabajadas,
      recargo: t.recargo,
      horasTomadas: t.horasTomadas,
      observaciones: t.observaciones,
      origen: 'app',
      idLocal: t.id,
    }))
  return { ...hoja, filas: [...hoja.filas.map((f) => ({ ...f, origen: 'excel' as const })), ...locales] }
}

// ---------- Al cargar un Excel nuevo ----------

const numeros = (s: string) => (s.match(/\d+/g) ?? []).map(Number)

/** ¿La fila del Excel corresponde a este turno agregado en la app? */
function mismoTurnoHE(f: FilaHorasExtra, t: TurnoHELocal): boolean {
  if (f.horas !== t.horas || f.recargo !== t.recargo) return false
  if (norm(f.mes) !== norm(mesDe(t.fecha))) return false
  return numeros(f.fecha).includes(t.fecha.d)
}

export function reconciliar(datos: DatosCuentas, c: CambiosTrabajo): { cambios: CambiosTrabajo; notas: string[] } {
  const notas: string[] = []

  const he = c.he.filter((t) => {
    const hoja = datos.horasExtra.find((h) => h.anio === t.anio)
    return !hoja?.filas.some((f) => mismoTurnoHE(f, t))
  })
  const heYa = c.he.length - he.length

  const comp = c.comp.filter((t) => {
    const hoja = datos.compensatorias.find((h) => h.anio === t.anio)
    return !hoja?.filas.some((f) => compareYmd(f.fecha, t.fecha) === 0 && f.horasTrabajadas === t.horasTrabajadas)
  })
  const compYa = c.comp.length - comp.length

  let marcasYa = 0
  let huerfanas = 0
  const marcas = c.marcas.filter((m) => {
    const hoja = datos.horasExtra.find((h) => h.anio === m.anio)
    if (!hoja) {
      huerfanas++
      return true
    }
    const i = clavesHE(hoja).indexOf(m.clave)
    if (i < 0) {
      // La fila cambió en el Excel: puede que ya se haya anotado el pago ahí.
      huerfanas++
      return true
    }
    if (hoja.filas[i].estado === m.estado) {
      marcasYa++
      return false
    }
    return true
  })

  const plural = (n: number, uno: string, varios: string) => (n === 1 ? uno : varios.replace('#', String(n)))
  if (heYa) notas.push(plural(heYa, '1 turno de horas extra agregado en la app ya está en el Excel; lo quité de la app.', '# turnos de horas extra agregados en la app ya están en el Excel; los quité de la app.'))
  if (compYa) notas.push(plural(compYa, '1 compensatoria agregada en la app ya está en el Excel; la quité de la app.', '# compensatorias agregadas en la app ya están en el Excel; las quité de la app.'))
  if (marcasYa) notas.push(plural(marcasYa, '1 cambio de estado ya está en el Excel; lo quité de la app.', '# cambios de estado ya están en el Excel; los quité de la app.'))
  if (huerfanas)
    notas.push(
      plural(huerfanas, '1 cambio de estado no encuentra su fila en el Excel (¿la editaste?). Revísalo en Trabajo → cambios de la app.', '# cambios de estado no encuentran su fila en el Excel (¿las editaste?). Revísalos en Trabajo → cambios de la app.'),
    )
  const pendientes = he.length + comp.length + marcas.length
  if (pendientes) notas.push(plural(pendientes, 'Queda 1 cambio de la app por pasar al Excel.', 'Quedan # cambios de la app por pasar al Excel.'))
  return { cambios: { he, comp, marcas }, notas }
}

/** ¿La marca encuentra su fila en el Excel actual? */
export function marcaVigente(datos: DatosCuentas, m: MarcaEstado): boolean {
  const hoja = datos.horasExtra.find((h) => h.anio === m.anio)
  return !!hoja && clavesHE(hoja).includes(m.clave)
}

/** Texto para copiar y pasar los cambios al Excel. */
export function textoCambios(datos: DatosCuentas, c: CambiosTrabajo): string {
  const lineas: string[] = ['Cambios hechos en la app (Trabajo):']
  const anios = [...new Set([...c.he.map((t) => t.anio), ...c.marcas.map((m) => m.anio), ...c.comp.map((t) => t.anio)])]
  for (const anio of anios) {
    const sufijo = anio ? ` ${anio}` : ''
    const nuevos = c.he.filter((t) => t.anio === anio).sort((a, b) => compareYmd(a.fecha, b.fecha))
    if (nuevos.length) {
      lineas.push('', `Horas extra${sufijo}: agregar`)
      for (const t of nuevos) {
        const hoja = datos.horasExtra.find((h) => h.anio === anio)
        const factor = hoja ? (t.recargo === 25 ? hoja.factor25 : hoja.factor50) : null
        const monto = hoja?.valorHora && factor ? t.horas * hoja.valorHora * factor : null
        lineas.push(
          `• ${mesDe(t.fecha)} | ${fechaCorta(t.fecha)} | ${t.detalle || 'sin detalle'} | ${fmtHoras(t.horas)} | ${t.recargo}% | ${t.estado}` +
            (t.liquidacion ? ` | ${t.liquidacion}` : '') +
            (t.observaciones ? ` | ${t.observaciones}` : '') +
            (monto !== null ? ` (≈ ${clp(monto)})` : ''),
        )
      }
    }
    const marcas = c.marcas.filter((m) => m.anio === anio)
    if (marcas.length) {
      lineas.push('', `Horas extra${sufijo}: cambiar estado`)
      for (const m of marcas)
        lineas.push(`• ${m.descripcion} → ${m.estado}${m.liquidacion ? ` (${m.liquidacion})` : ''}${marcaVigente(datos, m) ? '' : ' ⚠︎ no la encuentro en el Excel actual'}`)
    }
    const comp = c.comp.filter((t) => t.anio === anio).sort((a, b) => compareYmd(a.fecha, b.fecha))
    if (comp.length) {
      lineas.push('', `Compensatorias${sufijo}: agregar`)
      for (const t of comp)
        lineas.push(
          `• ${formatYmd(t.fecha)} | ${t.detalle || 'sin detalle'} | ${fmtHoras(t.horasTrabajadas)} | ${t.recargo}%` +
            (t.horasTomadas ? ` | tomadas ${fmtHoras(t.horasTomadas)}` : '') +
            (t.observaciones ? ` | ${t.observaciones}` : ''),
        )
    }
  }
  return lineas.join('\n')
}
