// Genera los íconos PNG de la PWA a partir de public/icon.svg (usa Playwright/Chromium).
import { createRequire } from 'node:module'
// Playwright viene preinstalado globalmente; se carga con require para respetar NODE_PATH.
const { chromium } = createRequire(import.meta.url)('playwright')
import { readFileSync } from 'node:fs'

const svg = readFileSync('public/icon.svg', 'utf8')
const browser = await chromium.launch()
const page = await browser.newPage()
const render = async (size, file, { padding = 0, bg = 'transparent', radius = true } = {}) => {
  await page.setViewportSize({ width: size, height: size })
  const inner = size - padding * 2
  const s = radius ? svg : svg.replace('rx="112"', 'rx="0"')
  await page.setContent(
    `<html><body style="margin:0;background:${bg}"><div style="padding:${padding}px;width:${inner}px;height:${inner}px">${s.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</div></body></html>`,
  )
  await page.screenshot({ path: `public/${file}`, omitBackground: bg === 'transparent' })
}
await render(192, 'icon-192.png')
await render(512, 'icon-512.png')
await render(512, 'icon-maskable-512.png', { radius: false })
await render(180, 'apple-touch-icon.png', { radius: false })
await browser.close()
console.log('Íconos generados en public/')
