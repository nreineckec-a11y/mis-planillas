import { useSyncExternalStore } from 'react'
import { prefGuardar, prefLeer } from './storage'

/** Preferencia guardada y compartida entre pantallas (Ajustes la cambia, el resto la lee). */
function crearPref<T>(clave: string, porDefecto: T, alCambiar?: (v: T) => void) {
  const oyentes = new Set<() => void>()
  let valor = prefLeer<T>(clave, porDefecto)
  const fijar = (v: T) => {
    valor = v
    prefGuardar(clave, v)
    alCambiar?.(v)
    oyentes.forEach((cb) => cb())
  }
  const usar = (): [T, (v: T) => void] => [
    useSyncExternalStore(
      (cb) => {
        oyentes.add(cb)
        return () => oyentes.delete(cb)
      },
      () => valor,
    ),
    fijar,
  ]
  return { usar, leer: () => valor }
}

const fotos = crearPref<boolean>('fotos', true)
export const useMostrarFotos = fotos.usar

// ---------- Tema ----------

export type Tema = 'auto' | 'claro' | 'oscuro'

const oscuroDelSistema = () => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false

function aplicarTema(t: Tema) {
  const oscuro = t === 'oscuro' || (t === 'auto' && oscuroDelSistema())
  const html = document.documentElement
  html.classList.toggle('dark', oscuro)
  // Controles nativos (fecha, casillas, barras de desplazamiento) siguen al tema elegido.
  html.style.colorScheme = oscuro ? 'dark' : 'light'
}

const tema = crearPref<Tema>('tema', 'auto', aplicarTema)
export const useTema = tema.usar

/** Aplica el tema guardado antes de dibujar la app y sigue al teléfono en modo automático. */
export function iniciarTema() {
  aplicarTema(tema.leer())
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (tema.leer() === 'auto') aplicarTema('auto')
  })
}
