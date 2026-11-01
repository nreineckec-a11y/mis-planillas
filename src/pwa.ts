import { registerSW } from 'virtual:pwa-register'

// En iPhone la app instalada puede quedar abierta días en segundo plano sin
// buscar versiones nuevas. Se revisa al abrirla, al volver a ella y cada hora;
// si hay una versión nueva, se instala y la página se recarga sola.
export function registrarActualizaciones() {
  if (!('serviceWorker' in navigator)) return
  registerSW({
    immediate: true,
    onRegisteredSW(_url, reg) {
      if (!reg) return
      const revisar = () => {
        if (navigator.onLine && !reg.installing) reg.update().catch(() => {})
      }
      document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && revisar())
      window.setInterval(revisar, 60 * 60 * 1000)
    },
  })
}
