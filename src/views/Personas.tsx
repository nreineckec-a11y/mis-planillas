import { useMemo, useState } from 'react'
import { Card, Chip, Colapsable, Header, Sheet, Stat, Vacio, copiar, cx } from '../components/ui'
import { neto, resumenPersonal, textoCobro, type ResumenPersona } from '../lib/cuentas/calc'
import { clp, clpSigno } from '../lib/format'
import type { ItemPersonal } from '../lib/model'
import { useDatos } from '../state'

const tono = (n: number): 'pos' | 'neg' | 'neutral' => (n > 0 ? 'pos' : n < 0 ? 'neg' : 'neutral')

export default function Personas() {
  const { cuentas, cargando } = useDatos()
  const [todas, setTodas] = useState(false)
  const [sel, setSel] = useState<string | null>(null)
  const personal = cuentas?.datos.personal
  const resumen = useMemo(() => (personal ? resumenPersonal(personal) : null), [personal])

  if (cargando) return null
  if (!cuentas || !personal || !resumen)
    return (
      <>
        <Header titulo="Personas" />
        <Vacio
          titulo="Sin cuentas cargadas"
          texto={cuentas ? 'El Excel de cuentas cargado no tiene la hoja "Personal - Detalle".' : 'Carga el Excel de cuentas por cobrar (hojas "Personal - Detalle", "Trabajo - …").'}
        />
      </>
    )

  const lista = todas ? resumen.personas : resumen.personas.filter((p) => Math.round(p.netoPendiente) !== 0)
  const persona = resumen.personas.find((p) => p.persona === sel) ?? null

  return (
    <>
      <Header titulo="Personas" sub={cuentas.archivo} />
      <div className="px-4 pb-6">
        <Card className="mt-3">
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Me deben" value={clp(resumen.meDebenPendiente)} tone="pos" small />
            <Stat label="Yo debo" value={clp(resumen.yoDeboPendiente)} tone="neg" small />
            <Stat label="Neto" value={clp(resumen.netoPendiente)} tone={tono(resumen.netoPendiente)} small />
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Pendiente. Ya pagado (neto): {clp(resumen.netoPagado)}</p>
        </Card>

        <div className="mt-4 mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-300">{lista.length === 1 ? '1 persona' : `${lista.length} personas`}</h2>
          <Chip active={todas} onClick={() => setTodas(!todas)} className="min-h-10 px-3">
            Mostrar todas
          </Chip>
        </div>
        <div className="space-y-2">
          {lista.map((p) => (
            <Card key={p.persona} onClick={() => setSel(p.persona)} className="p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-semibold">{p.persona}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {p.pendientes.length === 1 ? '1 ítem pendiente' : `${p.pendientes.length} ítems pendientes`}
                  </div>
                </div>
                <div
                  className={cx(
                    'shrink-0 text-right text-lg font-bold tabular-nums',
                    p.netoPendiente > 0 && 'text-emerald-600 dark:text-emerald-400',
                    p.netoPendiente < 0 && 'text-rose-600 dark:text-rose-400',
                  )}
                >
                  {clp(p.netoPendiente)}
                  <div className="text-xs font-normal text-slate-500">{p.netoPendiente > 0 ? 'me debe' : p.netoPendiente < 0 ? 'le debo' : 'al día'}</div>
                </div>
              </div>
            </Card>
          ))}
          {lista.length === 0 && <p className="py-8 text-center text-sm text-slate-500">Nadie con saldo pendiente. 🎉</p>}
        </div>
      </div>
      {persona && <DetallePersona p={persona} onClose={() => setSel(null)} />}
    </>
  )
}

function FilaItem({ i }: { i: ItemPersonal }) {
  const n = neto(i)
  return (
    <li className="flex items-baseline justify-between gap-3 py-2">
      <span className="min-w-0 text-sm">
        {i.concepto || <i className="text-slate-400">Sin concepto</i>}
        {!i.direccion && <span className="ml-1 text-xs text-amber-600">(sin dirección)</span>}
      </span>
      <span className={cx('shrink-0 text-sm font-semibold tabular-nums', n > 0 && 'text-emerald-600 dark:text-emerald-400', n < 0 && 'text-rose-600 dark:text-rose-400')}>
        {i.direccion ? clpSigno(n) : clp(i.monto)}
      </span>
    </li>
  )
}

function DetallePersona({ p, onClose }: { p: ResumenPersona; onClose: () => void }) {
  const [copiado, setCopiado] = useState<boolean | null>(null)
  return (
    <Sheet open onClose={onClose} titulo={p.persona}>
      <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-300">Pendiente</h3>
      {p.pendientes.length ? (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {p.pendientes.map((i) => (
            <FilaItem key={i.fila} i={i} />
          ))}
        </ul>
      ) : (
        <p className="py-2 text-sm text-slate-500">Nada pendiente.</p>
      )}
      <div className="mt-1 flex items-baseline justify-between border-t-2 border-slate-200 pt-2 dark:border-slate-700">
        <span className="font-semibold">Total {p.netoPendiente < 0 ? '(le debo)' : p.netoPendiente > 0 ? '(me debe)' : ''}</span>
        <span className={cx('text-lg font-bold tabular-nums', p.netoPendiente > 0 && 'text-emerald-600 dark:text-emerald-400', p.netoPendiente < 0 && 'text-rose-600 dark:text-rose-400')}>
          {clp(p.netoPendiente)}
        </span>
      </div>

      {p.pendientes.some((i) => i.direccion) && (
        <button
          type="button"
          onClick={async () => setCopiado(await copiar(textoCobro(p)))}
          className="mt-4 min-h-12 w-full rounded-xl bg-teal-700 font-semibold text-white active:bg-teal-800 dark:bg-teal-600"
        >
          {copiado === true ? '✓ Copiado, pégalo en WhatsApp' : copiado === false ? 'No se pudo copiar' : 'Copiar cobro'}
        </button>
      )}

      {p.pagados.length > 0 && (
        <div className="mt-4 border-t border-slate-100 dark:border-slate-800">
          <Colapsable titulo={`Ya pagados (${p.pagados.length}) · neto ${clp(p.netoPagado)}`}>
            <ul className="divide-y divide-slate-100 opacity-70 dark:divide-slate-800">
              {p.pagados.map((i) => (
                <FilaItem key={i.fila} i={i} />
              ))}
            </ul>
          </Colapsable>
        </div>
      )}
    </Sheet>
  )
}
