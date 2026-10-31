import { describe, expect, it } from 'vitest'
import { importarLibro } from '../src/lib/importar'
import { fromExcelSerial, parseDateValue, weekday } from '../src/lib/dates'
import { clp, clpSigno, pct } from '../src/lib/format'
import { toNumber, toFraction, toRecargo, norm } from '../src/lib/text'
import { fixture } from './helpers'

describe('detección de tipo', () => {
  it('detecta por hojas, no por nombre de archivo', () => {
    const a = importarLibro('cualquier-nombre.xlsx', fixture('cuentas.xlsx'))
    const b = importarLibro('cuentas.xlsx', fixture('descuentos.xlsx'))
    expect(a.ok && a.registro.tipo).toBe('cuentas')
    expect(b.ok && b.registro.tipo).toBe('descuentos')
  })

  it('explica qué esperaba cuando no calza', () => {
    const r = importarLibro('otro.xlsx', fixture('otro.xlsx'))
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error).toContain('Personal - Detalle')
      expect(r.error).toContain('Por día')
      expect(r.error).toContain('"Hoja1"')
    }
  })

  it('rechaza archivos que no son xlsx', () => {
    const r = importarLibro('x.xlsx', new TextEncoder().encode('hola'))
    expect(r).toMatchObject({ ok: false })
  })

  it('el registro es serializable (IndexedDB)', () => {
    const r = importarLibro('d.xlsx', fixture('descuentos.xlsx'))
    expect(r.ok).toBe(true)
    if (r.ok) expect(structuredClone(r.registro)).toEqual(r.registro)
  })
})

describe('utilidades', () => {
  it('formato CLP y %', () => {
    expect(clp(275000)).toBe('$275.000')
    expect(clp(-12500.4)).toBe('-$12.500')
    expect(clp(0)).toBe('$0')
    expect(clpSigno(1000)).toBe('+$1.000')
    expect(pct(0.4)).toBe('40%')
    expect(pct(0.125)).toBe('12,5%')
  })

  it('números y recargos', () => {
    expect(toNumber('$275.000')).toBe(275000)
    expect(toNumber('1,5')).toBe(1.5)
    expect(toNumber('abc')).toBeNull()
    expect(toFraction('40%')).toBe(0.4)
    expect(toFraction(40)).toBe(0.4)
    expect(toFraction(0.4)).toBe(0.4)
    expect(toRecargo('25%')).toBe(25)
    expect(toRecargo(0.5)).toBe(50)
    expect(toRecargo('30%')).toBeNull()
    expect(norm('  Fechas  ESPECÍFICAS – x ')).toBe('fechas especificas - x')
  })

  it('fechas Excel sin zona horaria', () => {
    expect(fromExcelSerial(46117)).toEqual({ y: 2026, m: 4, d: 5 })
    expect(fromExcelSerial(46117.99)).toEqual({ y: 2026, m: 4, d: 5 })
    expect(fromExcelSerial(0, true)).toEqual({ y: 1904, m: 1, d: 1 })
    expect(parseDateValue('28-10-2026')).toEqual({ y: 2026, m: 10, d: 28 })
    expect(parseDateValue('2026-10-28T00:00:00')).toEqual({ y: 2026, m: 10, d: 28 })
    expect(weekday({ y: 2026, m: 10, d: 28 })).toBe(2) // miércoles
  })
})
