// Genera Excel SINTÉTICOS para los tests (nombres y montos inventados).
// Uso: node scripts/make-fixtures.mjs [carpeta]   (por defecto tests/fixtures)
import ExcelJS from 'exceljs'
import { mkdirSync, writeFileSync } from 'node:fs'
import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate'
import { join } from 'node:path'

const out = process.argv[2] ?? 'tests/fixtures'
mkdirSync(out, { recursive: true })

const AMARILLO = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } }
// Mismo amarillo, pero elegido desde la paleta de tema (Oro, énfasis 4, claro 80%).
const AMARILLO_TEMA = { type: 'pattern', pattern: 'solid', fgColor: { theme: 7, tint: 0.7999816888943144 } }
const fecha = (y, m, d) => new Date(Date.UTC(y, m - 1, d))

async function cuentas() {
  const wb = new ExcelJS.Workbook()

  const det = wb.addWorksheet('Personal - Detalle')
  det.addRow(['Concepto', 'Persona', 'Dirección', 'Monto (CLP)', 'Neto', 'Pagado', 'clave'])
  const filas = [
    ['Computador', 'Ana Ficticia', 'Me debe', 275000, 'No'],
    ['Cena', 'Ana Ficticia', 'Yo debo', 25000, 'No'],
    ['Entradas cine', 'Ana Ficticia', 'Me debe', 18000, 'Sí'],
    ['Regalo', 'Bruno Inventado', 'Yo debo', 40000, 'No'],
    ['Taxi', 'Bruno Inventado', 'Me debe', 8000, null],
    ['Libro', 'Carla Ejemplo', null, 12000, 'No'],
    ['Pasajes', 'Carla Ejemplo', 'Me debe', 60000, 'Sí'],
    ['Pendiente de anotar', 'Carla Ejemplo', 'Me debe', null, 'No'],
    ['Almuerzo', 'ana ficticia ', 'Me debe', 5000, 'no'],
  ]
  filas.forEach(([c, p, d, m, pg], i) => {
    const r = i + 2
    det.addRow([c, p, d, m, { formula: `IF(C${r}="Me debe",D${r},-D${r})` }, pg, { formula: `B${r}&F${r}` }])
  })
  // Bloque de resumen en I:J (debe ignorarse).
  det.getCell('I1').value = 'Total'
  det.getCell('J1').value = { formula: 'SUM(E:E)', result: 999999 }

  const res = wb.addWorksheet('Personal - Resumen')
  ;['Persona', 'Ana Ficticia', 'Bruno Inventado', 'Carla Ejemplo', 'Diego Sinmovimientos'].forEach((v, i) => (res.getCell(`A${i + 1}`).value = v))
  res.getCell('A8').value = 'No Debe Leerse'
  res.getCell('B2').value = { formula: 'SUMIFS(...)' }

  wb.addWorksheet('Personal - Cobro').getCell('A1').value = { formula: 'HOY()' }

  const he = wb.addWorksheet('Trabajo - Horas extra 2026')
  he.getCell('A1').value = 'Valor hora ordinaria'
  he.getCell('B1').value = 10000
  he.getCell('A2').value = 'Factor 25%'
  he.getCell('B2').value = 1.25
  he.getCell('A3').value = 'Factor 50%'
  he.getCell('B3').value = 1.5
  he.getRow(5).values = ['Mes', 'Fecha', 'Detalle', 'Horas', 'Recargo', 'Valor hora', 'Monto bruto estimado', 'Estado', 'Liquidación en que se pagó', 'Observaciones']
  const heFilas = [
    ['Mayo', '14.05 y 15.05', 'Turno extra', 4, '25%', 'Pagado', 'Liq. junio', ''],
    [null, '20.05', 'Reunión', 2, 0.5, 'No pagado', '', 'Reclamar'],
    ['Junio', '03.06', 'Cobertura', 3, '50%', 'Programado', '', ''],
    ['Junio', '10.06', 'Raro', 1, '30%', 'Pagado', '', ''],
  ]
  heFilas.forEach(([mes, f, det2, h, rec, est, liq, obs], i) => {
    const r = 6 + i
    he.getRow(r).values = [mes, f, det2, h, rec, { formula: `$B$1*IF(E${r}="25%",$B$2,$B$3)` }, { formula: `D${r}*F${r}` }, est, liq, obs]
  })

  const co = wb.addWorksheet('Trabajo - Compensatorias 2026')
  co.getCell('A1').value = 'Factor 25% (semana)'
  co.getCell('B1').value = { formula: "'Trabajo - Horas extra 2026'!B2" }
  co.getCell('A2').value = 'Factor 50% (fds/feriado)'
  co.getCell('B2').value = { formula: "'Trabajo - Horas extra 2026'!B3" }
  co.getCell('A3').value = 'Valor hora ordinaria'
  co.getCell('B3').value = { formula: "'Trabajo - Horas extra 2026'!B1", result: 1 }
  co.getRow(5).values = ['Mes', 'Fecha', 'Día', 'Detalle', 'Horas trabajadas', 'Recargo', 'Factor', 'Horas compensatorias generadas', 'Estado', 'Horas ya tomadas', 'Saldo a favor', 'Observaciones']
  const coFilas = [
    [fecha(2026, 4, 5), 'Turno domingo (cambio de hora)', 4, '50%', 2],
    [fecha(2026, 9, 6), 'Turno domingo (cambio de hora)', 2, '25%', null],
    [fecha(2026, 10, 28), 'Turno hoy', 3, '25%', 1],
    [fecha(2026, 12, 5), 'Turno programado', 8, '50%', null],
  ]
  coFilas.forEach(([f, d, h, rec, tom], i) => {
    const r = 6 + i
    co.getRow(r).values = [
      { formula: `TEXT(B${r},"mmmm")` },
      f,
      { formula: `TEXT(B${r},"dddd")` },
      d,
      h,
      rec,
      { formula: `IF(F${r}="25%",$B$1,$B$2)` },
      { formula: `E${r}*G${r}` },
      { formula: `IF(B${r}<=TODAY(),"Realizada","Programada")`, result: 'Programada' },
      tom,
      { formula: `H${r}-J${r}` },
      '',
    ]
  })
  co.getCell('B6').numFmt = 'dd-mm-yyyy'

  await wb.xlsx.writeFile(join(out, 'cuentas.xlsx'))
}

/** Variante con columnas movidas/agregadas, encabezado desplazado y año 2027. */
async function cuentasVariante() {
  const wb = new ExcelJS.Workbook()
  const det = wb.addWorksheet('Personal - Detalle')
  det.getCell('A1').value = 'Mis cuentas'
  det.getRow(3).values = ['Notas', 'Persona', 'Monto (CLP)', 'Concepto', 'Pagado', 'Dirección']
  det.getRow(4).values = ['x', 'Eva Ficticia', '$12.500', 'Café', 'No', 'Me debe']
  det.getRow(5).values = ['', 'Eva Ficticia', 3000, 'Pan', 'Sí', 'Yo debo']

  const he = wb.addWorksheet('Trabajo - Horas extra 2027')
  he.getRow(8).values = ['Detalle', 'Mes', 'Horas', 'Extra', 'Recargo', 'Estado', 'Fecha']
  he.getRow(9).values = ['Turno', 'Enero', 2, 'z', '50%', 'No pagado', '02.01']
  he.getCell('A2').value = 'Valor hora ordinaria'
  he.getCell('B2').value = 8000
  he.getCell('A3').value = 'Factor 25%'
  he.getCell('B3').value = 1.25
  he.getCell('A4').value = 'Factor 50%'
  he.getCell('B4').value = 1.5
  await wb.xlsx.writeFile(join(out, 'cuentas-variante.xlsx'))
}

async function descuentos() {
  const wb = new ExcelJS.Workbook()
  const res = wb.addWorksheet('Resumen')
  res.getCell('A1').value = 'Descuentos de octubre 2026'
  res.getCell('A3').value = { formula: "COUNTA('Por día'!H:H)" }

  const pd = wb.addWorksheet('Por día')
  pd.getCell('A1').value = 'Listado por día'
  pd.getRow(2).values = [
    'Día', 'Fecha específica', '% dcto.', 'Monto fijo', 'Tope ($)', 'Tipo de tope', 'Tarjeta', 'Comercio', 'Categoría',
    'Comuna / región', 'Zona', 'Canal', 'Tarjetas que aplican', 'Vigencia', 'Condiciones', 'Verificación', 'Fuente',
    // Columna agregada después: queda al final para probar que se mapea por nombre.
    'Tipo de restaurante',
  ]
  const link = (n) => ({ text: 'Ver ficha', hyperlink: `https://example.com/ficha/${n}` })
  const filas = [
    ['Lunes', '', 0.4, null, 30000, 'Por transacción', 'Banco Alfa', 'Restorán Uno', 'Restaurante – Sabores 40% Alfa', 'Providencia', 'RM / online', 'Presencial', 'Alfa Visa, Alfa MC', 'Octubre', 'Solo lunes', 'Revisado', link(1)],
    ['Lunes', '', 0.2, null, 15000, 'Mensual', 'Banco Beta', 'Restorán Uno', 'Restaurante – Beta', 'Providencia', 'RM / online', 'Presencial', 'Beta Visa', 'Octubre', '', 'Revisado', link(2)],
    ['Miércoles', '', 0.4, null, 20000, 'Por transacción', 'Banco Alfa', 'Restorán Uno', 'Restaurante – Sabores 40% Alfa', 'Providencia', 'RM / online', 'Presencial', 'Alfa Visa', 'Octubre', '', 'Revisado', link(3)],
    ['Martes', '', 0.25, null, null, 'Sin tope', 'Banco Beta', 'Café Ñandú', 'Cafetería', 'Ñuñoa', 'RM / online', 'Presencial', 'Beta Visa', 'Octubre', '', 'Revisado', link(4)],
    ['Todos los días', '', 0.1, null, null, 'Sin tope', 'Banco Gamma', 'Farmacia Ávila', 'Salud – Farmacias', 'Concepción', 'Regiones', 'Presencial', 'Gamma Débito', 'Octubre', '', 'Revisado', link(5)],
    ['Fechas específicas', '05 al 11 oct', 0.3, null, 10000, 'Por transacción', 'Banco Alfa', 'Librería Prueba', 'Libros', 'Santiago', 'RM / online', 'Online', 'Alfa Visa', '05 al 11 oct', '', 'Revisado', link(6)],
    ['Fechas específicas', '06, 13, 20 y 27 oct', 0.5, null, 25000, 'Por transacción', 'Banco Beta', 'Sushi Test', 'Restaurante – Sushi', 'Las Condes', 'RM / online', 'Delivery', 'Beta Visa', 'Martes de octubre', '', 'Revisado', null],
    ['Fechas específicas', 'fin de semana largo', 0.2, null, null, '', 'Banco Gamma', 'Hotel Imaginario', 'Viajes', 'Pucón', 'Regiones', 'Online', 'Gamma Crédito', '', '', 'Revisado', link(8)],
    ['Miércoles', '', null, 5000, null, 'Por transacción', 'Banco Beta', 'Bencina Demo', 'Combustible – Descuento fijo', 'Maipú', 'RM / online', 'Presencial', 'Beta Visa', 'Octubre', 'Pago con app', 'Revisado', link(9)],
    ['Feriado', '', 0.15, null, null, '', 'Banco Alfa', 'Comercio Raro', 'Otros', '', 'RM / online', '', '', '', '', '', null],
    ['Jueves', '', 0.35, null, 12000, 'Mensual', 'Banco Alfa', 'Pizzería Falsa', 'Restaurante – Pizzas', 'Providencia', 'RM / online', 'Presencial', 'Por confirmar', 'Octubre', '', 'Revisado', { formula: 'HYPERLINK("https://example.com/ficha/11","Ver ficha")', result: 'Ver ficha' }],
    ['Viernes', '', 0.15, null, null, '', 'Banco Gamma', 'Heladería Ficticia', 'Postres', 'Ñuñoa', 'RM / online', 'Presencial', 'Gamma Débito', 'Octubre', '', 'Pendiente', link(12)],
  ]
  filas.forEach((v) => pd.addRow(v))
  // Tipo de restaurante (columna R): Restorán Uno = Italiano, Sushi Test = Sushi y nikkei, Pizzería Falsa = Pizzería.
  ;['R3', 'R4', 'R5'].forEach((c) => (pd.getCell(c).value = 'Italiano'))
  pd.getCell('R9').value = 'Sushi y nikkei'
  pd.getCell('R13').value = 'Pizzería'
  pd.getCell('R6').value = 'Por confirmar'
  // Fila de Pizzería: "Tarjetas que aplican" en amarillo ARGB; Heladería: "Verificación" amarillo de tema.
  pd.getCell('M13').fill = AMARILLO
  pd.getCell('P14').fill = AMARILLO_TEMA
  // Relleno no amarillo (no debe marcar).
  pd.getCell('M3').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDDEBF7' } }

  wb.addWorksheet('Banco Alfa').addRow(['Duplicado que no se lee'])
  // exceljs usa el tema de Office 2007 (énfasis 4 morado); se cambia al de Office 2013+
  // (énfasis 4 = FFC000) para que el amarillo de tema sea el que produce Excel actual.
  const files = unzipSync(new Uint8Array(await wb.xlsx.writeBuffer()))
  const theme = 'xl/theme/theme1.xml'
  files[theme] = strToU8(strFromU8(files[theme]).replace(/(<a:accent4>\s*<a:srgbClr val=")[0-9A-F]{6}/, '$1FFC000'))
  writeFileSync(join(out, 'descuentos.xlsx'), zipSync(files))
}

async function otro() {
  const wb = new ExcelJS.Workbook()
  wb.addWorksheet('Hoja1').addRow(['Nada', 'que', 'ver'])
  await wb.xlsx.writeFile(join(out, 'otro.xlsx'))
}

await Promise.all([cuentas(), cuentasVariante(), descuentos(), otro()])
console.log(`Fixtures sintéticos generados en ${out}`)
