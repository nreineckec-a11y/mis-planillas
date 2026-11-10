import { describe, expect, it } from 'vitest'
import { esAmarillo, grupoCategoria, parsePeriodo, parseDescuentos, urlFoto } from '../src/lib/descuentos/parse'
import { parseFechasEspecificas } from '../src/lib/descuentos/fechas'
import { comerciosQueCalzan, descuentosDeDias, descuentosDelDia, FILTROS_VACIOS, resolverFotos, tablaComercio, valoresUnicos, zonasPorDefecto } from '../src/lib/descuentos/filtros'
import { libro } from './helpers'

const { datos, advertencias } = parseDescuentos(libro('descuentos.xlsx'), 2026)
const porComercio = (c: string) => datos.items.find((d) => d.comercio === c)!

describe('parser de Descuentos', () => {
  it('lee el periodo del título', () => {
    expect(datos.titulo).toBe('Descuentos de octubre 2026')
    expect(datos.periodo).toEqual({ y: 2026, m: 10 })
  })

  it('lee solo la hoja Por día, con encabezados en la fila 2', () => {
    expect(datos.items).toHaveLength(11)
    expect(advertencias.some((a) => a.mensaje.includes('Día no reconocido: "Feriado"'))).toBe(true)
  })

  it('porcentajes, monto fijo, topes', () => {
    expect(porComercio('Café Ñandú')).toMatchObject({ pct: 0.25, tope: null, tipoTope: 'Sin tope', dia: 1 })
    expect(porComercio('Bencina Demo')).toMatchObject({ pct: null, montoFijo: 5000, dia: 2 })
  })

  it('hipervínculos de la fuente', () => {
    expect(porComercio('Farmacia Ávila').fuente).toBe('https://example.com/ficha/5')
    expect(porComercio('Pizzería Falsa').fuente).toBe('https://example.com/ficha/11')
    expect(porComercio('Sushi Test').fuente).toBeNull()
  })

  it('marca no verificados por relleno amarillo', () => {
    expect(datos.items.filter((d) => d.noVerificado).map((d) => d.comercio)).toEqual(['Pizzería Falsa', 'Heladería Ficticia'])
  })

  it('agrupa categorías por el texto antes de " – "', () => {
    expect(grupoCategoria('Restaurante – Sabores 40% Visa')).toBe('Restaurante')
    expect(grupoCategoria('Salud - Farmacias')).toBe('Salud')
    expect(grupoCategoria('Cafetería')).toBe('Cafetería')
    expect(valoresUnicos(datos.items, 'categoriaGrupo')).toContain('Restaurante')
  })

  it('periodo y amarillo', () => {
    expect(parsePeriodo('Descuentos de Septiembre 2027')).toEqual({ y: 2027, m: 9 })
    expect(parsePeriodo('Descuentos')).toBeNull()
    expect(esAmarillo('FFF2CC')).toBe(true)
    expect(esAmarillo('FFFF00')).toBe(true)
    expect(esAmarillo('FFEB9C')).toBe(true)
    expect(esAmarillo('DDEBF7')).toBe(false)
    expect(esAmarillo('FFFFFF')).toBe(false)
    expect(esAmarillo('C6EFCE')).toBe(false)
  })
})

describe('fechas específicas', () => {
  const f = (s: string) => parseFechasEspecificas(s, 2026)?.map((x) => `${x.d}/${x.m}/${x.y}`) ?? null

  it('rangos', () => {
    expect(f('05 al 11 oct')).toEqual(['5/10/2026', '6/10/2026', '7/10/2026', '8/10/2026', '9/10/2026', '10/10/2026', '11/10/2026'])
    expect(f('30 oct al 2 nov')).toEqual(['30/10/2026', '31/10/2026', '1/11/2026', '2/11/2026'])
    expect(f('05-07 octubre')).toEqual(['5/10/2026', '6/10/2026', '7/10/2026'])
    expect(f('29 dic al 2 ene')).toEqual(['29/12/2026', '30/12/2026', '31/12/2026', '1/1/2027', '2/1/2027'])
  })

  it('listas', () => {
    expect(f('06, 13, 20 y 27 oct')).toEqual(['6/10/2026', '13/10/2026', '20/10/2026', '27/10/2026'])
    expect(f('Sábado 18 de octubre')).toEqual(['18/10/2026'])
    expect(f('15/10')).toEqual(['15/10/2026'])
    expect(f('31 oct y 1 nov')).toEqual(['31/10/2026', '1/11/2026'])
    expect(f('15 oct 2027')).toEqual(['15/10/2027'])
  })

  it('no adivina', () => {
    expect(f('fin de semana largo')).toBeNull()
    expect(f('05 al 11')).toBeNull()
    expect(f('31 nov')).toBeNull()
    expect(f('15/13')).toBeNull()
    expect(f('')).toBeNull()
  })
})

describe('vista Hoy', () => {
  const nombres = (fecha: { y: number; m: number; d: number }, filtros = FILTROS_VACIOS) => {
    const r = descuentosDelDia(datos.items, fecha, filtros)
    return { aplican: r.aplican.map((d) => `${d.comercio}|${d.tarjeta}`), revisar: r.revisar.map((d) => d.comercio) }
  }

  it('día de semana + todos los días + específicas, ordenado por % y tope', () => {
    // Martes 6 de octubre de 2026
    expect(nombres({ y: 2026, m: 10, d: 6 })).toEqual({
      aplican: ['Sushi Test|Banco Beta', 'Librería Prueba|Banco Alfa', 'Café Ñandú|Banco Beta', 'Farmacia Ávila|Banco Gamma'],
      revisar: ['Hotel Imaginario'],
    })
    // Lunes 12: la librería ya no aplica
    expect(nombres({ y: 2026, m: 10, d: 12 }).aplican).toEqual(['Restorán Uno|Banco Alfa', 'Restorán Uno|Banco Beta', 'Farmacia Ávila|Banco Gamma'])
  })

  it('filtros por tarjeta, zona y búsqueda sin tildes', () => {
    const base = { y: 2026, m: 10, d: 6 }
    expect(nombres(base, { ...FILTROS_VACIOS, zonas: zonasPorDefecto(valoresUnicos(datos.items, 'zona')) }).aplican).not.toContain('Farmacia Ávila|Banco Gamma')
    expect(nombres(base, { ...FILTROS_VACIOS, tarjetas: ['Banco Beta'] }).aplican).toEqual(['Sushi Test|Banco Beta', 'Café Ñandú|Banco Beta'])
    expect(nombres(base, { ...FILTROS_VACIOS, texto: 'nandu' }).aplican).toEqual(['Café Ñandú|Banco Beta'])
    expect(nombres(base, { ...FILTROS_VACIOS, texto: 'concepcion' }).aplican).toEqual(['Farmacia Ávila|Banco Gamma'])
  })
})

describe('buscar comercio', () => {
  it('tabla día × tarjeta con el mejor descuento', () => {
    const t = tablaComercio(datos.items, 'restoran uno')
    expect(t.tarjetas).toEqual(['Banco Alfa', 'Banco Beta'])
    expect(t.celdas['Banco Alfa'].map((d) => d?.pct ?? null)).toEqual([0.4, null, 0.4, null, null, null, null])
    expect(t.celdas['Banco Beta'].map((d) => d?.pct ?? null)).toEqual([0.2, null, null, null, null, null, null])
    const farmacia = tablaComercio(datos.items, 'Farmacia Ávila')
    expect(farmacia.celdas['Banco Gamma'].every((d) => d?.pct === 0.1)).toBe(true)
  })
})

describe('tipo de restaurante', () => {
  it('lee la columna por nombre aunque esté al final', () => {
    expect(porComercio('Restorán Uno').tipo).toBe('Italiano')
    expect(porComercio('Pizzería Falsa').tipo).toBe('Pizzería')
    expect(porComercio('Farmacia Ávila').tipo).toBe('')
  })

  it('lista de tipos con "Por confirmar" al final', () => {
    expect(valoresUnicos(datos.items, 'tipo')).toEqual(['Italiano', 'Pizzería', 'Sushi y nikkei', 'Por confirmar'])
  })

  it('filtra por tipo y busca por texto del tipo', () => {
    const lunes = { y: 2026, m: 10, d: 12 }
    const sel = (f: Partial<typeof FILTROS_VACIOS>) =>
      descuentosDelDia(datos.items, lunes, { ...FILTROS_VACIOS, ...f }).aplican.map((d) => `${d.comercio}|${d.tarjeta}`)
    expect(sel({ tipos: ['Italiano'] })).toEqual(['Restorán Uno|Banco Alfa', 'Restorán Uno|Banco Beta'])
    expect(sel({ tipos: ['Pizzería'] })).toEqual([])
    expect(sel({ texto: 'italia' })).toEqual(['Restorán Uno|Banco Alfa', 'Restorán Uno|Banco Beta'])
    expect(comerciosQueCalzan(datos.items, 'nikkei')).toEqual(['Sushi Test'])
  })

  it('archivos sin la columna siguen funcionando', () => {
    const r = parseDescuentos(libro('descuentos.xlsx'), 2026)
    expect(r.advertencias.some((a) => a.mensaje.includes('Tipo'))).toBe(false)
  })
})

describe('subcategoría, sector y zonas (estructura de noviembre)', () => {
  it('lee "Tipo / subcategoría" y también el nombre anterior "Tipo de restaurante"', () => {
    const v2 = parseDescuentos(libro('descuentos-v2.xlsx'), 2026).datos
    expect(v2.items.find((d) => d.comercio === 'Pizzería Falsa')!.tipo).toBe('Pizzería')
    expect(porComercio('Pizzería Falsa').tipo).toBe('Pizzería')
  })

  it('lee el sector, filtra por él y lo encuentra al buscar', () => {
    expect(porComercio('Sushi Test').sector).toBe('Oriente')
    expect(porComercio('Bencina Demo').sector).toBe('')
    const martes = { y: 2026, m: 10, d: 6 }
    const sel = (f: Partial<typeof FILTROS_VACIOS>) => descuentosDelDia(datos.items, martes, { ...FILTROS_VACIOS, ...f }).aplican.map((d) => d.comercio)
    expect(sel({ sectores: ['Providencia–Ñuñoa'] })).toEqual(['Café Ñandú'])
    expect(sel({ texto: 'oriente' })).toEqual(['Sushi Test'])
    expect(sel({ texto: 'biobio' })).toEqual(['Farmacia Ávila'])
  })

  it('zona por defecto: todas menos Regiones', () => {
    expect(zonasPorDefecto(['Online', 'Regiones', 'RM', 'RM + online', 'Todo Chile', 'Todo Chile + online'])).toEqual([
      'Online',
      'RM',
      'RM + online',
      'Todo Chile',
      'Todo Chile + online',
    ])
    expect(zonasPorDefecto(valoresUnicos(datos.items, 'zona'))).toEqual(['Online', 'RM', 'RM + online'])
  })
})

describe('fotos de los locales', () => {
  it('lee la columna Foto como texto, hipervínculo o función IMAGEN; solo https', () => {
    expect(porComercio('Restorán Uno').foto).toBe('https://fotos.test/restoran.png')
    expect(porComercio('Farmacia Ávila').foto).toBe('https://fotos.test/farmacia.png')
    expect(porComercio('Pizzería Falsa').foto).toBe('https://fotos.test/pizza.png')
    expect(urlFoto({ v: 'http://fotos.test/inseguro.png', formula: false })).toBeNull()
    expect(porComercio('Sushi Test').foto).toBe('https://fotos.test/roto.png')
    expect(porComercio('Farmacia Ávila').miniatura).toBe('https://fotos.test/farmacia-chica.png')
    expect(porComercio('Restorán Uno').miniatura).toBeNull()
  })
})

describe('fotos incrustadas en el Excel', () => {
  it('asocia la imagen anclada en la columna Foto a su fila y la guarda una sola vez', () => {
    const cafe = porComercio('Café Ñandú')
    const bencina = porComercio('Bencina Demo')
    expect(cafe.foto).toMatch(/^img:/)
    expect(bencina.foto).toBe(cafe.foto)
    expect(Object.keys(datos.imagenes ?? {})).toHaveLength(1)
    const resueltos = resolverFotos(datos)
    expect(resueltos.find((d) => d.comercio === 'Café Ñandú')!.foto).toMatch(/^data:image\/png;base64,iVBOR/)
    // Las demás filas no cambian.
    expect(resueltos.find((d) => d.comercio === 'Restorán Uno')!.foto).toBe('https://fotos.test/restoran.png')
  })
})

describe('varios días a la vez', () => {
  const lun = { y: 2026, m: 10, d: 12 }
  const mar = { y: 2026, m: 10, d: 13 }

  it('junta los días sin repetir y dice en cuáles aplica cada descuento', () => {
    const r = descuentosDeDias(datos.items, [lun, mar], FILTROS_VACIOS)
    const dias = Object.fromEntries(r.aplican.map((x) => [`${x.d.comercio}|${x.d.tarjeta}`, x.fechas.map((f) => f.d)]))
    expect(dias['Farmacia Ávila|Banco Gamma']).toEqual([12, 13]) // todos los días: una sola tarjeta
    expect(dias['Restorán Uno|Banco Alfa']).toEqual([12])
    expect(dias['Café Ñandú|Banco Beta']).toEqual([13])
    expect(dias['Sushi Test|Banco Beta']).toEqual([13]) // fecha específica
    expect(r.aplican.map((x) => x.d.pct)).toEqual([...r.aplican.map((x) => x.d.pct)].sort((a, b) => (b ?? -1) - (a ?? -1)))
    expect(r.revisar.map((d) => d.comercio)).toEqual(['Hotel Imaginario'])
  })

  it('une el mismo beneficio aunque venga en una fila por día', () => {
    const base = porComercio('Café Ñandú')
    const items = [base, { ...base, id: 999, dia: 0 as const }]
    const r = descuentosDeDias(items, [lun, mar], FILTROS_VACIOS)
    expect(r.aplican).toHaveLength(1)
    expect(r.aplican[0].fechas.map((f) => f.d)).toEqual([12, 13])
  })

  it('un solo día equivale a descuentosDelDia', () => {
    const uno = descuentosDeDias(datos.items, [mar], FILTROS_VACIOS).aplican.map((x) => x.d.id)
    expect(uno).toEqual(descuentosDelDia(datos.items, mar, FILTROS_VACIOS).aplican.map((d) => d.id))
  })
})
