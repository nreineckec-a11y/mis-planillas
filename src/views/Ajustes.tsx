import { useState } from 'react'
import { BotonCargar, Card, Colapsable, Header } from '../components/ui'
import { fechaHora } from '../lib/format'
import { resumenAdvertencias } from '../lib/importar'
import type { Advertencia, Registro, Tipo } from '../lib/model'
import { useMostrarFotos } from '../lib/prefs'
import { useDatos } from '../state'

const NOMBRE: Record<Tipo, string> = { cuentas: 'Cuentas por cobrar', descuentos: 'Descuentos' }

export function ListaAdvertencias({ adv }: { adv: Advertencia[] }) {
  if (adv.length === 0) return null
  return (
    <ul className="mt-1 max-h-72 space-y-1 overflow-y-auto text-xs text-slate-600 dark:text-slate-300">
      {adv.map((a, i) => (
        <li key={i} className="rounded-lg bg-amber-50 px-2 py-1.5 dark:bg-amber-950/50">
          <span className="font-semibold">{a.donde}:</span> {a.mensaje}
        </li>
      ))}
    </ul>
  )
}

function Bloque({ tipo, r, obsoleto }: { tipo: Tipo; r?: Registro; obsoleto: boolean }) {
  const { borrar } = useDatos()
  const [confirmar, setConfirmar] = useState(false)
  return (
    <Card className="mt-3">
      <h2 className="font-semibold">{NOMBRE[tipo]}</h2>
      {obsoleto && <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">La app se actualizó: vuelve a cargar este Excel una vez para ver las novedades.</p>}
      {r ? (
        <>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="text-slate-500">Archivo</dt>
            <dd className="truncate">{r.archivo}</dd>
            <dt className="text-slate-500">Cargado</dt>
            <dd>{fechaHora(r.fechaCarga)}</dd>
            <dt className="text-slate-500">Filas</dt>
            <dd>{r.filas}</dd>
          </dl>
          {r.advertencias.length > 0 && (
            <div className="mt-2">
              <Colapsable titulo={resumenAdvertencias(r.advertencias)}>
                <ListaAdvertencias adv={r.advertencias} />
              </Colapsable>
            </div>
          )}
          {confirmar ? (
            <div className="mt-3 flex gap-2">
              <button type="button" className="min-h-11 flex-1 rounded-xl border border-slate-300 font-semibold dark:border-slate-700" onClick={() => setConfirmar(false)}>
                Cancelar
              </button>
              <button
                type="button"
                className="min-h-11 flex-1 rounded-xl bg-rose-600 font-semibold text-white"
                onClick={async () => {
                  await borrar(tipo)
                  setConfirmar(false)
                }}
              >
                Sí, borrar
              </button>
            </div>
          ) : (
            <button type="button" className="mt-3 min-h-11 w-full rounded-xl border border-rose-300 font-semibold text-rose-700 dark:border-rose-800 dark:text-rose-400" onClick={() => setConfirmar(true)}>
              Borrar datos
            </button>
          )}
        </>
      ) : (
        <p className="mt-1 text-sm text-slate-500">Sin datos cargados.</p>
      )}
    </Card>
  )
}

export default function Ajustes() {
  const { cuentas, descuentos, obsoletos, persistido } = useDatos()
  const [fotos, setFotos] = useMostrarFotos()
  return (
    <>
      <Header titulo="Ajustes" />
      <div className="px-4 pb-8">
        <Card className="mt-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Carga uno o ambos Excel (.xlsx). La app detecta cuál es cuál por sus hojas y reemplaza los datos anteriores de ese tipo.
          </p>
          <BotonCargar className="mt-3 w-full" />
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            En iPhone, carga los Excel desde la app instalada en la pantalla de inicio (no desde Safari): cada una guarda sus propios datos. Si el
            Excel te llegó por WhatsApp o correo, primero guárdalo en Archivos.
          </p>
        </Card>
        <Bloque tipo="descuentos" r={descuentos} obsoleto={obsoletos.includes('descuentos')} />
        <Bloque tipo="cuentas" r={cuentas} obsoleto={obsoletos.includes('cuentas')} />

        <Card className="mt-3 text-sm">
          <h2 className="font-semibold">Privacidad</h2>
          <p className="mt-1 text-slate-600 dark:text-slate-300">
            Los Excel se leen y guardan solo en este teléfono. La app no envía datos a ningún servidor y funciona sin conexión.
          </p>
          <label className="mt-3 flex min-h-11 items-center justify-between gap-3">
            <span>
              <span className="block font-medium">Mostrar fotos de los locales</span>
              <span className="block text-xs text-slate-500 dark:text-slate-400">
                Las fotos se descargan desde los enlaces de la columna "Foto" del Excel (ese sitio ve que se pidió la imagen, no tus datos). Las ya vistas
                quedan guardadas para verlas sin conexión.
              </span>
            </span>
            <input type="checkbox" className="h-6 w-6 shrink-0 accent-teal-700" checked={fotos} onChange={(e) => setFotos(e.target.checked)} />
          </label>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Almacenamiento persistente:{' '}
            {persistido === true ? 'concedido ✓' : persistido === false ? 'no concedido (el sistema podría borrar los datos si falta espacio)' : 'se pedirá al cargar un Excel'}
          </p>
        </Card>
        <p className="mt-4 text-center text-xs text-slate-400">
          Mis Planillas · versión {__APP_VERSION__}
          <br />
          Si el teléfono muestra una versión distinta a la del computador, cierra la app por completo y vuelve a abrirla con conexión.
        </p>
      </div>
    </>
  )
}
