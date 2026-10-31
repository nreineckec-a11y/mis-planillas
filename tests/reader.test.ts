import { describe, expect, it } from 'vitest'
import { applyTint, decodeRef } from '../src/lib/xlsx/reader'
import { sheetByName } from '../src/lib/table'
import { libro } from './helpers'

describe('lector xlsx', () => {
  it('decodifica referencias', () => {
    expect(decodeRef('A1')).toEqual({ row: 0, col: 0 })
    expect(decodeRef('AB12')).toEqual({ row: 11, col: 27 })
    expect(decodeRef('$Q$3')).toEqual({ row: 2, col: 16 })
  })

  it('lee hojas, textos compartidos y números', () => {
    const wb = libro('cuentas.xlsx')
    expect(wb.sheets.map((s) => s.name)).toContain('Personal - Detalle')
    const det = sheetByName(wb, 'Personal - Detalle')!
    expect(det.rows[0][0]?.v).toBe('Concepto')
    expect(det.rows[1][3]?.v).toBe(275000)
  })

  it('marca fórmulas y no inventa valores cuando no hay cache', () => {
    const det = sheetByName(libro('cuentas.xlsx'), 'Personal - Detalle')!
    expect(det.rows[1][4]).toMatchObject({ formula: true, v: null })
  })

  it('extrae hipervínculos externos y de la función HYPERLINK', () => {
    const pd = sheetByName(libro('descuentos.xlsx'), 'Por día')!
    expect(pd.rows[2][16]).toMatchObject({ v: 'Ver ficha', link: 'https://example.com/ficha/1' })
    expect(pd.rows[12][16]?.link).toBe('https://example.com/ficha/11')
  })

  it('resuelve rellenos ARGB y de tema con tinte', () => {
    const pd = sheetByName(libro('descuentos.xlsx'), 'Por día')!
    expect(pd.rows[12][12]?.fill).toBe('FFF2CC')
    expect(pd.rows[13][15]?.fill).toBe('FFF2CC')
    expect(pd.rows[2][12]?.fill).toBe('DDEBF7')
  })

  it('aplica tinte como Excel', () => {
    expect(applyTint('FFC000', 0.7999816888943144)).toBe('FFF2CC')
    expect(applyTint('4472C4', -0.25)).toBe('2F5597')
  })
})
