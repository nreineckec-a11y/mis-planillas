import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const SRC = join(__dirname, '..', 'src')

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? archivos(p) : [p]
  })
}

describe('privacidad', () => {
  const fuentes = archivos(SRC).map((p) => ({ p, src: readFileSync(p, 'utf8') }))

  it('el código no hace requests de red', () => {
    const prohibido = /\bfetch\s*\(|XMLHttpRequest|sendBeacon|new\s+WebSocket|EventSource|navigator\.share/
    const culpables = fuentes.filter((f) => prohibido.test(f.src)).map((f) => f.p)
    expect(culpables).toEqual([])
  })

  it('no hay URLs externas en el código salvo los enlaces que vienen del Excel', () => {
    const conUrl = fuentes.filter((f) => /https?:\/\/(?!www\.w3\.org)/.test(f.src)).map((f) => f.p)
    expect(conUrl).toEqual([])
  })

  it('index.html declara una CSP que bloquea conexiones externas', () => {
    const cfg = readFileSync(join(__dirname, '..', 'vite.config.ts'), 'utf8')
    expect(cfg).toMatch(/connect-src 'self'/)
  })
})
