// Prueba de humo en Chromium a 375 px: carga los Excel sintéticos, recorre las
// pestañas, saca capturas y verifica que no haya requests fuera del propio sitio
// y que la app funcione sin conexión.
// Uso: npm run build && npm run fixtures && node scripts/e2e.mjs [carpeta-capturas]
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

const { chromium } = createRequire(import.meta.url)('playwright')
const shots = resolve(process.argv[2] ?? 'e2e-capturas')
mkdirSync(shots, { recursive: true })
const PORT = 4173
const ORIGEN = `http://localhost:${PORT}`

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe', detached: true })
await new Promise((ok, fail) => {
  server.stdout.on('data', (d) => d.toString().includes(String(PORT)) && ok())
  server.on('exit', () => fail(new Error('vite preview terminó')))
  setTimeout(() => fail(new Error('timeout esperando vite preview')), 20000)
})

const errores = []
const externas = []
const browser = await chromium.launch()
try {
  for (const esquema of ['light', 'dark']) {
    const ctx = await browser.newContext({
      viewport: { width: 375, height: 812 },
      deviceScaleFactor: 2,
      colorScheme: esquema,
      locale: 'es-CL',
      timezoneId: 'America/Santiago',
      permissions: ['clipboard-read', 'clipboard-write'],
    })
    // Fecha fija dentro del mes del set sintético (martes 6 de octubre de 2026).
    await ctx.clock.setFixedTime(new Date('2026-10-06T10:00:00-03:00'))
    const page = await ctx.newPage()
    page.on('request', (r) => {
      const u = r.url()
      if (!u.startsWith(ORIGEN) && !u.startsWith('data:')) externas.push(u)
    })
    page.on('pageerror', (e) => errores.push(`${esquema}: ${e.message}`))
    page.on('console', (m) => m.type() === 'error' && errores.push(`${esquema}: ${m.text()}`))
    const shot = (n) => page.screenshot({ path: join(shots, `${esquema}-${n}.png`) })

    await page.goto(ORIGEN)
    await page.getByText('Sin descuentos cargados').waitFor()
    await shot('01-vacio')

    await page.locator('input[type=file]').first().setInputFiles([
      'tests/fixtures/descuentos.xlsx',
      'tests/fixtures/cuentas.xlsx',
      'tests/fixtures/otro.xlsx',
    ])
    await page.getByText('Resultado de la carga').waitFor()
    await shot('02-resultado-carga')
    await page.getByRole('button', { name: 'Listo' }).click()

    await page.getByRole('button', { name: /^Martes 6/ }).click()
    await shot('03-descuentos-hoy')
    await page.getByText('Sushi Test').first().click()
    await shot('04-detalle-descuento')
    await page.getByRole('button', { name: 'Cerrar' }).last().click()
    await page.getByRole('button', { name: /^Filtros/ }).click()
    await shot('05-filtros')
    await page.getByRole('button', { name: /^Ver \d/ }).click()
    // Chips de tipo de comida.
    await page.getByRole('group', { name: 'Tipo de comida' }).getByRole('button', { name: /Sushi y nikkei/ }).click()
    await page.waitForTimeout(300) // deja terminar la transición de color de los chips
    if ((await page.getByRole('group', { name: 'Tipo de comida' }).getByRole('button', { name: /Sushi y nikkei/ }).getAttribute('aria-pressed')) !== 'true')
      errores.push('el chip de tipo de comida no quedó activo')
    if ((await page.getByText(/^\d+ descuentos?$/).innerText()) !== '1 descuento') errores.push('el filtro por tipo no filtró')
    await shot('17-tipo-comida')
    await page.getByRole('group', { name: 'Tipo de comida' }).getByRole('button', { name: 'Todos' }).click()
    await page.getByRole('button', { name: 'Buscar comercio' }).click()
    await page.getByPlaceholder(/^Comercio, comuna o tipo/).fill('italia')
    await page.getByRole('button', { name: /^Restorán Uno/ }).click()
    await shot('06-buscar-comercio')

    await page.getByRole('button', { name: /Personas/ }).click()
    await shot('07-personas')
    await page.getByText('Ana Ficticia').click()
    await page.getByRole('button', { name: 'Copiar cobro' }).click()
    await page.getByText('Copiado').waitFor()
    const portapapeles = await page.evaluate(() => navigator.clipboard.readText())
    if (!portapapeles.startsWith('Hola Ana Ficticia')) errores.push(`portapapeles inesperado: ${portapapeles}`)
    await shot('08-detalle-persona')
    await page.getByRole('button', { name: 'Cerrar' }).last().click()

    await page.getByRole('button', { name: /Trabajo/ }).click()
    await shot('09-horas-extra')

    // Agregar un turno de horas extra.
    await page.getByRole('button', { name: '+ Agregar turno' }).click()
    await page.locator('input[type=date]').fill('2026-10-10')
    await page.getByLabel(/^Horas/).fill('3,5')
    await page.getByLabel('Detalle').fill('Turno sábado')
    await shot('13-form-turno')
    await page.getByRole('button', { name: 'Agregar turno', exact: true }).click()
    await page.getByText('Turno sábado').waitFor()

    // Marcar dos turnos como pagados de una vez.
    await page.getByRole('checkbox', { name: 'Seleccionar Reunión' }).click()
    await page.getByRole('checkbox', { name: 'Seleccionar Turno sábado' }).click()
    await shot('14-seleccion')
    await page.getByRole('button', { name: '✓ Marcar pagados' }).click()
    await page.getByRole('button', { name: 'Liq. octubre' }).click()
    await page.getByRole('button', { name: /Marcar 2 turnos como pagados/ }).click()
    await page.getByText('2 cambios hechos en la app').waitFor()
    await shot('15-pagados')
    const pagado = await page.locator('button[aria-pressed]').filter({ hasText: 'Pagado' }).first().innerText()
    if (!pagado.includes('$132.500')) errores.push(`total pagado inesperado: ${pagado}`)

    // Al cargar de nuevo el mismo Excel, los cambios se mantienen.
    await page.getByRole('button', { name: /Ajustes/ }).click()
    await page.locator('input[type=file]').first().setInputFiles(['tests/fixtures/cuentas.xlsx'])
    await page.getByText('Quedan 2 cambios de la app por pasar al Excel.').waitFor()
    await page.getByRole('button', { name: 'Listo' }).click()
    await page.getByRole('button', { name: /Trabajo/ }).click()
    await page.getByText('Turno sábado').waitFor()
    await page.getByText('2 cambios hechos en la app').click()
    await shot('16-cambios-app')
    await page.getByRole('button', { name: 'Cerrar' }).last().click()

    await page.getByRole('button', { name: 'Compensatorias' }).click()
    await shot('10-compensatorias')
    await page.getByRole('button', { name: /Ajustes/ }).click()
    await shot('11-ajustes')

    if (esquema === 'light') {
      // Persistencia y modo avión: recargar sin red debe mostrar los datos.
      await page.evaluate(() => navigator.serviceWorker.ready)
      await page.reload()
      await page.evaluate(() => navigator.serviceWorker.ready)
      await ctx.setOffline(true)
      await page.goto(`${ORIGEN}/#/personas`)
      await page.getByText('Ana Ficticia').waitFor({ timeout: 5000 })
      await shot('12-sin-conexion')
      await ctx.setOffline(false)

      // Datos guardados por una versión anterior (sin "tipo" ni versión de parser).
      const envejecer = (borrarOriginal) =>
        page.evaluate(
          (borrarOriginal) =>
            new Promise((ok, mal) => {
              const req = indexedDB.open('mis-planillas', 1)
              req.onsuccess = () => {
                const t = req.result.transaction('registros', 'readwrite')
                const st = t.objectStore('registros')
                const g = st.get('descuentos')
                g.onsuccess = () => {
                  const r = g.result
                  delete r.parser
                  r.datos.items.forEach((d) => delete d.tipo)
                  st.put(r, 'descuentos')
                  if (borrarOriginal) st.delete('archivo-descuentos')
                }
                t.oncomplete = () => ok()
                t.onerror = () => mal(t.error)
              }
            }),
          borrarOriginal,
        )
      // a) Con la copia del Excel guardada: se relee solo y aparecen los tipos.
      await envejecer(false)
      await page.goto(`${ORIGEN}/#/descuentos`)
      await page.reload()
      await page.getByRole('group', { name: 'Tipo de comida' }).waitFor({ timeout: 5000 })
      if (await page.getByText('La app se actualizó.').count()) errores.push('aviso de actualizar visible aunque se pudo releer')
      // b) Sin copia (datos de la versión anterior): aviso para cargar el Excel una vez.
      await envejecer(true)
      await page.reload()
      await page.getByText('La app se actualizó.').waitFor({ timeout: 5000 })
      await shot('18-aviso-actualizar')
      await page.locator('input[type=file]').first().setInputFiles(['tests/fixtures/descuentos.xlsx'])
      await page.getByRole('button', { name: 'Listo' }).click()
      await page.getByRole('group', { name: 'Tipo de comida' }).waitFor({ timeout: 5000 })
      if (await page.getByText('La app se actualizó.').count()) errores.push('el aviso no desapareció tras cargar el Excel')
    }
    await ctx.close()
  }
} finally {
  await browser.close()
  process.kill(-server.pid)
}

console.log(`Capturas en ${shots}`)
if (externas.length) console.log('Requests externas:', externas)
if (errores.length) console.log('Errores:', errores)
if (externas.length || errores.length) process.exit(1)
console.log('OK: sin requests externas ni errores; funciona sin conexión.')
process.exit(0)
