import { describe, expect, it } from 'vitest'
import { parseCuentas } from '../src/lib/cuentas/parse'
import { calcularComp, totalesComp, totalesHE } from '../src/lib/cuentas/calc'
import {
  claveLocal,
  combinarComp,
  combinarHE,
  marcarEstado,
  quitarMarca,
  reconciliar,
  SIN_CAMBIOS,
  textoCambios,
  type CambiosTrabajo,
  type TurnoCompLocal,
  type TurnoHELocal,
} from '../src/lib/cuentas/cambios'
import type { DatosCuentas } from '../src/lib/model'
import { libro } from './helpers'

const { datos } = parseCuentas(libro('cuentas.xlsx'))
const hojaHE = datos.horasExtra[0]
const hojaComp = datos.compensatorias[0]

const turno = (t: Partial<TurnoHELocal> = {}): TurnoHELocal => ({
  id: 't1',
  creado: '2026-11-01T00:00:00Z',
  anio: '2026',
  fecha: { y: 2026, m: 11, d: 5 },
  detalle: 'Turno noche',
  horas: 4,
  recargo: 50,
  estado: 'No pagado',
  liquidacion: '',
  observaciones: '',
  ...t,
})

describe('turnos agregados en la app', () => {
  it('se suman a la hoja y a los totales', () => {
    const c: CambiosTrabajo = { ...SIN_CAMBIOS, he: [turno(), turno({ id: 't2', fecha: { y: 2026, m: 5, d: 30 }, horas: 1, recargo: 25 })] }
    const h = combinarHE(hojaHE, c)
    expect(h.filas).toHaveLength(6)
    // El de mayo queda dentro del grupo de mayo; el de noviembre, al final.
    expect(h.filas.map((f) => `${f.mes}:${f.origen}`)).toEqual(['Mayo:excel', 'Mayo:excel', 'Mayo:app', 'Junio:excel', 'Junio:excel', 'Noviembre:app'])
    expect(h.filas[5]).toMatchObject({ fecha: '05.11', clave: claveLocal('t1') })
    const t = totalesHE(h)
    expect(t['No pagado']).toMatchObject({ horas: 7, monto: 30000 + 60000 + 12500 })
  })

  it('no se muestran en hojas de otro año', () => {
    expect(combinarHE(hojaHE, { ...SIN_CAMBIOS, he: [turno({ anio: '2027' })] }).filas).toHaveLength(4)
  })

  it('compensatorias agregadas entran al saldo', () => {
    const tc: TurnoCompLocal = { id: 'c1', creado: '', anio: '2026', fecha: { y: 2026, m: 10, d: 31 }, detalle: 'x', horasTrabajadas: 2, recargo: 50, horasTomadas: 0, observaciones: '' }
    const h = combinarComp(hojaComp, { ...SIN_CAMBIOS, comp: [tc] })
    const t = totalesComp(calcularComp(h, { y: 2026, m: 11, d: 1 }))
    expect(t.Realizada.saldo).toBe(9.25 + 3)
  })
})

describe('marcar como pagado', () => {
  it('marca filas del Excel y de la app de una vez', () => {
    const c0: CambiosTrabajo = { ...SIN_CAMBIOS, he: [turno()] }
    const h0 = combinarHE(hojaHE, c0)
    const reunion = h0.filas.find((f) => f.detalle === 'Reunión')!
    const c1 = marcarEstado(c0, h0, [reunion.clave, claveLocal('t1')], 'Pagado', 'Liq. noviembre', new Date('2026-11-01T12:00:00Z'))
    expect(c1.marcas).toHaveLength(1)
    expect(c1.marcas[0]).toMatchObject({ estado: 'Pagado', liquidacion: 'Liq. noviembre', descripcion: '20.05 (Mayo) · Reunión · 2 h · 50%' })
    expect(c1.he[0]).toMatchObject({ estado: 'Pagado', liquidacion: 'Liq. noviembre' })

    const h1 = combinarHE(hojaHE, c1)
    const r1 = h1.filas.find((f) => f.detalle === 'Reunión')!
    expect(r1).toMatchObject({ estado: 'Pagado', estadoExcel: 'No pagado', modificado: true, liquidacion: 'Liq. noviembre' })
    expect(totalesHE(h1)['No pagado'].monto).toBe(0)

    // Deshacer
    expect(quitarMarca(c1, '2026', r1.clave).marcas).toEqual([])
    // Volver al estado del Excel no deja una marca vacía
    expect(marcarEstado(c1, h1, [r1.clave], 'No pagado', '').marcas).toEqual([])
  })

  it('la clave no depende del número de fila', () => {
    const h = combinarHE(hojaHE, SIN_CAMBIOS)
    const movida = { ...hojaHE, filas: [hojaHE.filas[3], ...hojaHE.filas.slice(0, 3)].map((f, i) => ({ ...f, fila: 50 + i })) }
    const c = marcarEstado(SIN_CAMBIOS, h, [h.filas[1].clave], 'Pagado', '')
    expect(combinarHE(movida, c).filas.find((f) => f.detalle === 'Reunión')!.modificado).toBe(true)
  })
})

describe('al cargar un Excel nuevo', () => {
  const h = combinarHE(hojaHE, SIN_CAMBIOS)
  const reunion = h.filas.find((f) => f.detalle === 'Reunión')!
  const cambios: CambiosTrabajo = {
    he: [turno(), turno({ id: 't2', fecha: { y: 2026, m: 11, d: 12 }, horas: 3 })],
    comp: [],
    marcas: marcarEstado(SIN_CAMBIOS, h, [reunion.clave], 'Pagado', 'Liq. nov').marcas,
  }

  it('quita lo que ya aparece en el Excel y deja el resto', () => {
    const nuevo: DatosCuentas = structuredClone(datos)
    const he = nuevo.horasExtra[0]
    he.filas.find((f) => f.detalle === 'Reunión')!.estado = 'Pagado'
    he.filas.push({ ...he.filas[0], fila: 20, mes: 'Noviembre', fecha: '5.11', detalle: 'Turno noche (anotado)', horas: 4, recargo: 50, estado: 'No pagado' })
    const r = reconciliar(nuevo, cambios)
    expect(r.cambios.he.map((t) => t.id)).toEqual(['t2'])
    expect(r.cambios.marcas).toEqual([])
    expect(r.notas.join(' ')).toMatch(/1 turno de horas extra .* ya está en el Excel/)
    expect(r.notas.join(' ')).toMatch(/Queda 1 cambio/)
  })

  it('avisa si la fila marcada ya no se encuentra', () => {
    const nuevo: DatosCuentas = structuredClone(datos)
    nuevo.horasExtra[0].filas.find((f) => f.detalle === 'Reunión')!.detalle = 'Reunión clínica'
    const r = reconciliar(nuevo, cambios)
    expect(r.cambios.marcas).toHaveLength(1)
    expect(r.notas.join(' ')).toMatch(/no encuentra su fila/)
  })

  it('arma un resumen para pasar al Excel', () => {
    const texto = textoCambios(datos, cambios)
    expect(texto).toContain('Horas extra 2026: agregar')
    expect(texto).toContain('• Noviembre | 05.11 | Turno noche | 4 h | 50% | No pagado (≈ $60.000)')
    expect(texto).toContain('• 20.05 (Mayo) · Reunión · 2 h · 50% → Pagado (Liq. nov)')
  })
})
