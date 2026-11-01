import { useEffect, useState } from 'react'
import { Sheet, cx } from './components/ui'
import { resumenAdvertencias } from './lib/importar'
import { useDatos } from './state'
import Ajustes, { ListaAdvertencias } from './views/Ajustes'
import Descuentos from './views/Descuentos'
import Personas from './views/Personas'
import Trabajo from './views/Trabajo'

const TABS = [
  { id: 'descuentos', label: 'Descuentos', icon: '🏷️' },
  { id: 'personas', label: 'Personas', icon: '👥' },
  { id: 'trabajo', label: 'Trabajo', icon: '🕒' },
  { id: 'ajustes', label: 'Ajustes', icon: '⚙️' },
] as const
type TabId = (typeof TABS)[number]['id']

const tabDesdeHash = (): TabId => {
  const h = location.hash.replace('#/', '')
  return TABS.some((t) => t.id === h) ? (h as TabId) : 'descuentos'
}

export default function App() {
  const [tab, setTab] = useState<TabId>(tabDesdeHash)
  useEffect(() => {
    const onHash = () => setTab(tabDesdeHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  const ir = (id: TabId) => {
    if (id !== tab) window.location.hash = `#/${id}`
    window.scrollTo(0, 0)
  }

  return (
    <div className="mx-auto min-h-dvh max-w-xl pb-[calc(env(safe-area-inset-bottom)+4.5rem)]">
      <main>
        {tab === 'descuentos' && <Descuentos />}
        {tab === 'personas' && <Personas />}
        {tab === 'trabajo' && <Trabajo />}
        {tab === 'ajustes' && <Ajustes />}
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
        <ul className="mx-auto grid max-w-xl grid-cols-4">
          {TABS.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => ir(t.id)}
                aria-current={tab === t.id ? 'page' : undefined}
                className={cx(
                  'flex min-h-16 w-full flex-col items-center justify-center gap-0.5 text-xs font-medium',
                  tab === t.id ? 'text-teal-700 dark:text-teal-400' : 'text-slate-500 dark:text-slate-400',
                )}
              >
                <span aria-hidden className={cx('text-xl', tab !== t.id && 'opacity-60 grayscale')}>
                  {t.icon}
                </span>
                {t.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <ResultadoImportacion />
    </div>
  )
}

const NOMBRE_TIPO = { cuentas: 'Cuentas por cobrar', descuentos: 'Descuentos' }

function ResultadoImportacion() {
  const { ultimaImportacion, cerrarImportacion } = useDatos()
  if (!ultimaImportacion) return null
  return (
    <Sheet open onClose={cerrarImportacion} titulo="Resultado de la carga">
      <div className="space-y-3 pb-2">
        {ultimaImportacion.map((r, i) => (
          <div key={i} className={cx('rounded-xl border p-3', r.ok ? 'border-emerald-200 dark:border-emerald-900' : 'border-rose-200 dark:border-rose-900')}>
            <div className="truncate text-sm font-semibold">{r.archivo}</div>
            {r.ok ? (
              <>
                <p className="mt-1 text-sm">
                  ✓ {NOMBRE_TIPO[r.registro.tipo]}: {r.registro.filas} filas importadas, {resumenAdvertencias(r.registro.advertencias)}.
                </p>
                <ListaAdvertencias adv={r.registro.advertencias} />
                {r.notas?.map((n, j) => (
                  <p key={j} className="mt-2 rounded-lg bg-sky-50 px-2 py-1.5 text-xs text-sky-900 dark:bg-sky-950/60 dark:text-sky-200">
                    {n}
                  </p>
                ))}
              </>
            ) : (
              <p className="mt-1 whitespace-pre-line text-sm text-rose-700 dark:text-rose-400">✗ {r.error}</p>
            )}
          </div>
        ))}
        <button type="button" onClick={cerrarImportacion} className="min-h-12 w-full rounded-xl bg-teal-700 font-semibold text-white dark:bg-teal-600">
          Listo
        </button>
      </div>
    </Sheet>
  )
}
