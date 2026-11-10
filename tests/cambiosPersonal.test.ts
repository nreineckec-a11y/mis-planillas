import { describe, expect, it } from 'vitest'
import { parseCuentas } from '../src/lib/cuentas/parse'
import { resumenPersonal } from '../src/lib/cuentas/calc'
import { reconciliar, SIN_CAMBIOS, type CambiosTrabajo } from '../src/lib/cuentas/cambios'
import { claveCobroLocal, combinarPersonal, marcarPagado, textoCambiosPersonal, type CobroLocal } from '../src/lib/cuentas/cambiosPersonal'
import type { DatosCuentas } from '../src/lib/model'
import { libro } from './helpers'

const { datos } = parseCuentas(libro('cuentas.xlsx'))
const personal = datos.personal!

const cobro = (x: Partial<CobroLocal> = {}): CobroLocal => ({
  id: 'c1',
  creado: '',
  persona: 'Ana Ficticia',
  concepto: 'Helado',
  direccion: 'me_debe',
  monto: 3000,
  pagado: false,
  ...x,
})
const neto = (c: CambiosTrabajo, persona: string) => resumenPersonal(combinarPersonal(personal, c)).personas.find((p) => p.persona === persona)!.netoPendiente

describe('Personas: cambios en la app', () => {
  it('cobros nuevos y personas nuevas se suman', () => {
    const c: CambiosTrabajo = { ...SIN_CAMBIOS, cobros: [cobro(), cobro({ id: 'c2', persona: 'Nueva Persona', monto: 1000 })], personas: ['Otra Persona'] }
    const v = combinarPersonal(personal, c)
    expect(v.personas).toEqual(expect.arrayContaining(['Nueva Persona', 'Otra Persona']))
    expect(neto(c, 'Ana Ficticia')).toBe(255000 + 3000)
    expect(neto(c, 'Nueva Persona')).toBe(1000)
    // "ana ficticia" escrito distinto se une a la persona existente.
    expect(neto({ ...SIN_CAMBIOS, cobros: [cobro({ persona: 'ana ficticia' })] }, 'Ana Ficticia')).toBe(258000)
  })

  it('marca cobros específicos como pagados y se puede deshacer', () => {
    const c0: CambiosTrabajo = { ...SIN_CAMBIOS, cobros: [cobro()] }
    const v0 = combinarPersonal(personal, c0)
    const computador = v0.items.find((i) => i.concepto === 'Computador')!
    const c1 = marcarPagado(c0, v0, [computador.clave, claveCobroLocal('c1')], true, new Date('2026-11-10T12:00:00Z'))
    expect(c1.pagos).toHaveLength(1)
    expect(c1.cobros[0].pagado).toBe(true)
    expect(neto(c1, 'Ana Ficticia')).toBe(255000 - 275000)
    const v1 = combinarPersonal(personal, c1)
    expect(v1.items.find((i) => i.concepto === 'Computador')).toMatchObject({ pagado: true, pagadoExcel: false, modificado: true })
    // Volver a pendiente deja todo como en el Excel, sin marcas vacías.
    expect(marcarPagado(c1, v1, [computador.clave], false).pagos).toEqual([])
    // Un ítem pagado en el Excel se puede volver a pendiente.
    const cine = v0.items.find((i) => i.concepto === 'Entradas cine')!
    expect(marcarPagado(c0, v0, [cine.clave], false).pagos[0]).toMatchObject({ pagado: false })
  })

  it('al cargar un Excel nuevo quita lo que ya está y deja lo demás', () => {
    const v = combinarPersonal(personal, SIN_CAMBIOS)
    const cena = v.items.find((i) => i.concepto === 'Cena')!
    const c: CambiosTrabajo = {
      ...SIN_CAMBIOS,
      cobros: [cobro(), cobro({ id: 'c2', concepto: 'Pan', monto: 500 })],
      pagos: marcarPagado(SIN_CAMBIOS, v, [cena.clave], true).pagos,
      personas: ['Diego Sinmovimientos', 'Nueva Persona'],
    }
    const nuevo: DatosCuentas = structuredClone(datos)
    nuevo.personal!.items.find((i) => i.concepto === 'Cena')!.pagado = true
    nuevo.personal!.items.push({ fila: 30, concepto: 'Helado (anotado)', persona: 'Ana Ficticia', direccion: 'me_debe', monto: 3000, pagado: false })
    const r = reconciliar(nuevo, c)
    expect(r.cambios.cobros.map((x) => x.id)).toEqual(['c2'])
    expect(r.cambios.pagos).toEqual([])
    expect(r.cambios.personas).toEqual(['Nueva Persona'])
    expect(r.notas.join(' ')).toMatch(/Personas: 2 cambios .* ya están en el Excel/)
    expect(r.notas.join(' ')).toMatch(/Personas: quedan 2 cambios/)
  })

  it('arma el resumen para el Excel', () => {
    const v = combinarPersonal(personal, SIN_CAMBIOS)
    const cena = v.items.find((i) => i.concepto === 'Cena')!
    const c = { ...SIN_CAMBIOS, cobros: [cobro()], pagos: marcarPagado(SIN_CAMBIOS, v, [cena.clave], true).pagos, personas: ['Nueva Persona'] }
    const t = textoCambiosPersonal(personal, c)
    expect(t).toContain('• Nueva Persona')
    expect(t).toContain('• Helado | Ana Ficticia | Me debe | 3000 | No')
    expect(t).toContain('• Ana Ficticia · Cena · le debo $25.000 → Sí')
  })
})
