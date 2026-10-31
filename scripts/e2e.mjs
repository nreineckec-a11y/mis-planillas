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
    await page.getByRole('button', { name: 'Buscar comercio' }).click()
    await page.getByPlaceholder('Nombre del comercio o comuna').fill('resto')
    await page.getByRole('button', { name: 'Restorán Uno' }).click()
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
