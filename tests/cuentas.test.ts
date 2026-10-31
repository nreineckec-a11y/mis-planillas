import { describe, expect, it } from 'vitest'
import { parseCuentas } from '../src/lib/cuentas/parse'
import {
  agruparPorMes,
  calcularComp,
  montoHE,
  ordenarComp,
  resumenPersonal,
  textoCobro,
  totalesComp,
  totalesHE,
} from '../src/lib/cuentas/calc'
import { libro } from './helpers'

const { datos, advertencias } = parseCuentas(libro('cuentas.xlsx'))

describe('Personal', () => {
  const p = datos.personal!

  it('lee solo filas con monto', () => {
    expect(p.items).toHaveLength(8)
    expect(p.items.find((i) => i.concepto === 'Pendiente de anotar')).toBeUndefined()
  })

  it('lista de personas: resumen hasta la primera vacía + detalle, sin duplicar grafías', () => {
    expect(p.personas).toEqual(['Ana Ficticia', 'Bruno Inventado', 'Carla Ejemplo', 'Diego Sinmovimientos'])
    expect(p.items.filter((i) => i.persona === 'Ana Ficticia')).toHaveLength(4)
  })

  it('advierte filas sin Dirección o sin Pagado', () => {
    const msgs = advertencias.map((a) => `${a.donde}: ${a.mensaje}`)
    expect(msgs.some((m) => m.includes('fila 7') && m.includes('sin Dirección'))).toBe(true)
    expect(msgs.some((m) => m.includes('fila 6') && m.includes('sin Pagado'))).toBe(true)
  })

  it('calcula totales y neto por persona (ignora el resumen del Excel)', () => {
    const r = resumenPersonal(p)
    expect(r.meDebenPendiente).toBe(288000)
    expect(r.yoDeboPendiente).toBe(65000)
    expect(r.netoPendiente).toBe(223000)
    expect(r.netoPagado).toBe(78000)
    const por = Object.fromEntries(r.personas.map((x) => [x.persona, x.netoPendiente]))
    expect(por).toEqual({ 'Ana Ficticia': 255000, 'Bruno Inventado': -32000, 'Carla Ejemplo': 0, 'Diego Sinmovimientos': 0 })
    expect(r.personas[0].persona).toBe('Ana Ficticia')
  })

  it('arma el texto de cobro', () => {
    const r = resumenPersonal(p)
    const ana = r.personas.find((x) => x.persona === 'Ana Ficticia')!
    expect(textoCobro(ana)).toBe(
      [
        'Hola Ana Ficticia, te dejo el detalle pendiente:',
        '• Computador: $275.000 (me debes)',
        '• Cena: -$25.000 (te debo)',
        '• Almuerzo: $5.000 (me debes)',
        'Total: $255.000',
      ].join('\n'),
    )
    const bruno = r.personas.find((x) => x.persona === 'Bruno Inventado')!
    expect(textoCobro(bruno)).toMatch(/^Hola Bruno Inventado, te dejo el detalle de lo que te debo:/)
    expect(textoCobro(bruno)).toMatch(/Total que te debo: \$32\.000$/)
  })

  it('texto simple cuando todo va en un sentido', () => {
    const texto = textoCobro({
      persona: 'X',
      netoPendiente: 300,
      netoPagado: 0,
      pagados: [],
      pendientes: [
        { fila: 1, concepto: 'A', persona: 'X', direccion: 'me_debe', monto: 100, pagado: false },
        { fila: 2, concepto: 'B', persona: 'X', direccion: 'me_debe', monto: 200, pagado: false },
      ],
    })
    expect(texto).toBe('Hola X, te dejo el detalle pendiente:\n• A: $100\n• B: $200\nTotal: $300')
  })
})

describe('Horas extra', () => {
  const he = datos.horasExtra[0]

  it('lee parámetros por etiqueta y detecta el año', () => {
    expect(he).toMatchObject({ anio: '2026', valorHora: 10000, factor25: 1.25, factor50: 1.5 })
  })

  it('recalcula montos y arrastra el mes', () => {
    expect(he.filas.map((f) => [f.mes, f.fecha, montoHE(he, f)])).toEqual([
      ['Mayo', '14.05 y 15.05', 50000],
      ['Mayo', '20.05', 30000],
      ['Junio', '03.06', 45000],
      ['Junio', '10.06', null],
    ])
    expect(advertencias.some((a) => a.mensaje.includes('Recargo no reconocido: "30%"'))).toBe(true)
  })

  it('totaliza por estado y agrupa por mes', () => {
    const t = totalesHE(he)
    expect(t.Pagado).toMatchObject({ horas: 5, monto: 50000, sinMonto: 1 })
    expect(t['No pagado']).toMatchObject({ horas: 2, monto: 30000 })
    expect(t.Programado).toMatchObject({ horas: 3, monto: 45000 })
    expect(agruparPorMes(he.filas).map((g) => [g.mes, g.filas.length])).toEqual([
      ['Mayo', 2],
      ['Junio', 2],
    ])
  })
})

describe('Compensatorias', () => {
  const co = datos.compensatorias[0]

  it('toma parámetros de horas extra cuando son fórmulas (aunque tengan cache)', () => {
    expect(co).toMatchObject({ factor25: 1.25, factor50: 1.5, valorHora: 10000 })
  })

  it('lee fechas sin corrimiento en los cambios de horario', () => {
    expect(co.filas.map((f) => f.fecha)).toEqual([
      { y: 2026, m: 4, d: 5 },
      { y: 2026, m: 9, d: 6 },
      { y: 2026, m: 10, d: 28 },
      { y: 2026, m: 12, d: 5 },
    ])
  })

  it('estado según hoy (ignora el estado cacheado) y saldos', () => {
    const filas = calcularComp(co, { y: 2026, m: 10, d: 28 })
    expect(filas.map((f) => f.estado)).toEqual(['Realizada', 'Realizada', 'Realizada', 'Programada'])
    const t = totalesComp(filas)
    expect(t.Realizada).toMatchObject({ horasTrabajadas: 9, generadas: 12.25, tomadas: 3, saldo: 9.25, equivalente: 92500 })
    expect(t.Programada).toMatchObject({ generadas: 12, saldo: 12, equivalente: 120000 })
    expect(t.Total.saldo).toBe(21.25)
    expect(ordenarComp(filas).map((f) => f.fecha.m)).toEqual([12, 10, 9, 4])

    const antes = calcularComp(co, { y: 2026, m: 10, d: 27 })
    expect(antes[2].estado).toBe('Programada')
  })
})

describe('Estructura alterada', () => {
  const r = parseCuentas(libro('cuentas-variante.xlsx'))

  it('encuentra encabezados desplazados y columnas movidas', () => {
    expect(r.datos.personal!.items.map((i) => [i.concepto, i.monto, i.direccion, i.pagado])).toEqual([
      ['Café', 12500, 'me_debe', false],
      ['Pan', 3000, 'yo_debo', true],
    ])
  })

  it('detecta hojas del año siguiente por prefijo', () => {
    const he = r.datos.horasExtra[0]
    expect(he.anio).toBe('2027')
    expect(montoHE(he, he.filas[0])).toBe(24000)
    expect(r.datos.compensatorias).toEqual([])
  })
})
