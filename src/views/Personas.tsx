import { useMemo, useState, type ReactNode } from 'react'
import { Card, Chip, Colapsable, Etiqueta, Header, Segmented, Sheet, Stat, Vacio, copiar, cx } from '../components/ui'
import { neto, resumenPersonal, textoCobro, type ResumenPersona } from '../lib/cuentas/calc'
import { nuevoId } from '../lib/cuentas/cambios'
import {
  claveCobroLocal,
  combinarPersonal,
  marcarPagado,
  pagoVigente,
  textoCambiosPersonal,
  totalCambiosPersonal,
  type CobroLocal,
  type ItemVista,
  type PersonalVista,
} from '../lib/cuentas/cambiosPersonal'
import { clp, clpSigno } from '../lib/format'
import type { Direccion } from '../lib/model'
import { norm, toNumber } from '../lib/text'
import { useDatos } from '../state'

const tono = (n: number): 'pos' | 'neg' | 'neutral' => (n > 0 ? 'pos' : n < 0 ? 'neg' : 'neutral')
const CHIP_APP = 'bg-violet-100 text-violet-800 dark:bg-violet-900/60 dark:text-violet-200'
const INPUT = 'min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base dark:border-slate-700 dark:bg-slate-950'
const BOTON = 'min-h-12 w-full rounded-xl bg-teal-700 font-semibold text-white active:bg-teal-800 disabled:opacity-50 dark:bg-teal-600'
const BOTON_SEC = 'min-h-12 w-full rounded-xl border border-slate-300 font-semibold dark:border-slate-700'
const BOTON_PELIGRO = 'min-h-12 w-full rounded-xl border border-rose-300 font-semibold text-rose-700 dark:border-rose-800 dark:text-rose-400'

export default function Personas() {
  const { cuentas, cargando, cambios } = useDatos()
  const [todas, setTodas] = useState(false)
  const [sel, setSel] = useState<string | null>(null)
  const [nuevo, setNuevo] = useState<{ persona: string } | CobroLocal | null>(null)
  const [nuevaPersona, setNuevaPersona] = useState(false)
  const personal = cuentas?.datos.personal ?? null
  const vista = useMemo(() => combinarPersonal(personal, cambios), [personal, cambios])
  const resumen = useMemo(() => resumenPersonal(vista), [vista])

  if (cargando) return null
  if (!cuentas)
    return (
      <>
        <Header titulo="Personas" />
        <Vacio titulo="Sin cuentas cargadas" texto='Carga el Excel de cuentas por cobrar (hojas "Personal - Detalle", "Trabajo - …").' />
      </>
    )

  const nuevas = new Set(cambios.personas.map(norm))
  const lista = todas ? resumen.personas : resumen.personas.filter((p) => Math.round(p.netoPendiente) !== 0 || nuevas.has(norm(p.persona)))
  const persona = resumen.personas.find((p) => p.persona === sel) ?? null

  return (
    <>
      <Header titulo="Personas" sub={cuentas.archivo} />
      {totalCambiosPersonal(cambios) > 0 && <PanelCambios />}
      <div className="px-4 pb-6">
        {!personal && <p className="mt-3 text-sm text-amber-700 dark:text-amber-400">El Excel cargado no tiene la hoja "Personal - Detalle"; lo que agregues queda solo en la app.</p>}
        <Card className="mt-3">
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Me deben" value={clp(resumen.meDebenPendiente)} tone="pos" small />
            <Stat label="Yo debo" value={clp(resumen.yoDeboPendiente)} tone="neg" small />
            <Stat label="Neto" value={clp(resumen.netoPendiente)} tone={tono(resumen.netoPendiente)} small />
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Pendiente. Ya pagado (neto): {clp(resumen.netoPagado)}</p>
        </Card>

        <div className="mt-3 grid grid-cols-[2fr_1fr] gap-2">
          <button type="button" className={BOTON} onClick={() => setNuevo({ persona: '' })}>
            + Nuevo cobro
          </button>
          <button type="button" className={BOTON_SEC} onClick={() => setNuevaPersona(true)}>
            + Persona
          </button>
        </div>

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
                  {nuevas.has(norm(p.persona)) && <Etiqueta className={cx('mt-1', CHIP_APP)}>Agregada en la app</Etiqueta>}
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
      {persona && (
        <DetallePersona
          key={persona.persona}
          p={persona}
          vista={vista}
          onClose={() => setSel(null)}
          onNuevoCobro={() => setNuevo({ persona: persona.persona })}
          onEditar={(c) => setNuevo(c)}
        />
      )}
      {nuevo && <FormCobro inicial={nuevo} personas={vista.personas} onClose={() => setNuevo(null)} />}
      {nuevaPersona && <FormPersona personas={vista.personas} onClose={() => setNuevaPersona(false)} onCreada={(p) => setSel(p)} />}
    </>
  )
}

function FilaItem({ i, marcada, onToggle, onAbrir, accion }: { i: ItemVista; marcada?: boolean; onToggle?: () => void; onAbrir?: () => void; accion?: ReactNode }) {
  const n = neto(i)
  const contenido = (
    <>
      <span className="min-w-0 text-sm">
        {i.concepto || <i className="text-slate-400">Sin concepto</i>}
        {!i.direccion && <span className="ml-1 text-xs text-amber-600">(sin dirección)</span>}
        {i.origen === 'app' && <Etiqueta className={cx('ml-1', CHIP_APP)}>nuevo</Etiqueta>}
        {i.modificado && <Etiqueta className={cx('ml-1', CHIP_APP)}>cambiado en la app</Etiqueta>}
      </span>
      <span className={cx('shrink-0 text-sm font-semibold tabular-nums', n > 0 && 'text-emerald-600 dark:text-emerald-400', n < 0 && 'text-rose-600 dark:text-rose-400')}>
        {i.direccion ? clpSigno(n) : clp(i.monto)}
      </span>
    </>
  )
  return (
    <li className="flex items-center gap-1">
      {onToggle && (
        <button type="button" role="checkbox" aria-checked={!!marcada} aria-label={`Seleccionar ${i.concepto || 'ítem'}`} onClick={onToggle} className="flex min-h-11 min-w-11 shrink-0 items-center justify-center">
          <span className={cx('flex h-6 w-6 items-center justify-center rounded-md border-2 text-sm font-bold', marcada ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-400 dark:border-slate-500')}>
            {marcada ? '✓' : ''}
          </span>
        </button>
      )}
      {onAbrir ? (
        <button type="button" onClick={onAbrir} className="flex min-h-11 min-w-0 flex-1 items-baseline justify-between gap-3 py-2 text-left">
          {contenido}
        </button>
      ) : (
        <div className="flex min-h-11 min-w-0 flex-1 items-baseline justify-between gap-3 py-2">{contenido}</div>
      )}
      {accion}
    </li>
  )
}

function DetallePersona({
  p,
  vista,
  onClose,
  onNuevoCobro,
  onEditar,
}: {
  p: ResumenPersona<ItemVista>
  vista: PersonalVista
  onClose: () => void
  onNuevoCobro: () => void
  onEditar: (c: CobroLocal) => void
}) {
  const { cambios, actualizarCambios } = useDatos()
  const [copiado, setCopiado] = useState<boolean | null>(null)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const toggle = (k: string) => {
    const s = new Set(sel)
    if (s.has(k)) s.delete(k)
    else s.add(k)
    setSel(s)
  }
  const marcar = async (claves: string[], pagado: boolean) => {
    await actualizarCambios((c) => marcarPagado(c, vista, claves, pagado))
    setSel(new Set())
    setCopiado(null)
  }
  const editar = (i: ItemVista) => {
    const c = cambios.cobros.find((x) => claveCobroLocal(x.id) === i.clave)
    if (c) onEditar(c)
  }
  const seleccionados = p.pendientes.filter((i) => sel.has(i.clave))
  const netoSel = seleccionados.reduce((a, i) => a + neto(i), 0)

  return (
    <Sheet open onClose={onClose} titulo={p.persona}>
      <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-300">Pendiente</h3>
      {p.pendientes.length ? (
        <>
          <p className="text-xs text-slate-500 dark:text-slate-400">Toca ☐ en lo que ya te pagaron (o pagaste) y luego "Marcar como pagado".</p>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {p.pendientes.map((i) => (
              <FilaItem key={i.clave} i={i} marcada={sel.has(i.clave)} onToggle={() => toggle(i.clave)} onAbrir={i.origen === 'app' ? () => editar(i) : undefined} />
            ))}
          </ul>
        </>
      ) : (
        <p className="py-2 text-sm text-slate-500">Nada pendiente.</p>
      )}
      <div className="mt-1 flex items-baseline justify-between border-t-2 border-slate-200 pt-2 dark:border-slate-700">
        <span className="font-semibold">Total {p.netoPendiente < 0 ? '(le debo)' : p.netoPendiente > 0 ? '(me debe)' : ''}</span>
        <span className={cx('text-lg font-bold tabular-nums', p.netoPendiente > 0 && 'text-emerald-600 dark:text-emerald-400', p.netoPendiente < 0 && 'text-rose-600 dark:text-rose-400')}>
          {clp(p.netoPendiente)}
        </span>
      </div>

      <div className="mt-4 space-y-2">
        {sel.size > 0 ? (
          <button type="button" className="min-h-12 w-full rounded-xl bg-emerald-600 font-semibold text-white active:bg-emerald-700" onClick={() => marcar([...sel], true)}>
            ✓ Marcar {sel.size === 1 ? '1 ítem' : `${sel.size} ítems`} como pagado ({clp(Math.abs(netoSel))})
          </button>
        ) : (
          p.pendientes.length > 1 && (
            <button type="button" className={BOTON_SEC} onClick={() => marcar(p.pendientes.map((i) => i.clave), true)}>
              ✓ Marcar todo como pagado
            </button>
          )
        )}
        {p.pendientes.some((i) => i.direccion) && (
          <button type="button" onClick={async () => setCopiado(await copiar(textoCobro(p)))} className={BOTON}>
            {copiado === true ? '✓ Copiado, pégalo en WhatsApp' : copiado === false ? 'No se pudo copiar' : 'Copiar cobro'}
          </button>
        )}
        <button type="button" className={BOTON_SEC} onClick={onNuevoCobro}>
          + Agregar cobro a {p.persona}
        </button>
      </div>

      {p.pagados.length > 0 && (
        <div className="mt-4 border-t border-slate-100 dark:border-slate-800">
          <Colapsable titulo={`Ya pagados (${p.pagados.length}) · neto ${clp(p.netoPagado)}`}>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {p.pagados.map((i) => (
                <FilaItem
                  key={i.clave}
                  i={i}
                  onAbrir={i.origen === 'app' ? () => editar(i) : undefined}
                  accion={
                    <button type="button" onClick={() => marcar([i.clave], false)} className="min-h-11 shrink-0 rounded-lg px-2 text-xs font-semibold text-slate-500 underline">
                      Volver a pendiente
                    </button>
                  }
                />
              ))}
            </ul>
          </Colapsable>
        </div>
      )}
    </Sheet>
  )
}

function FormCobro({ inicial, personas, onClose }: { inicial: { persona: string } | CobroLocal; personas: string[]; onClose: () => void }) {
  const { actualizarCambios } = useDatos()
  const existente = 'id' in inicial ? inicial : null
  const [persona, setPersona] = useState(inicial.persona)
  const [concepto, setConcepto] = useState(existente?.concepto ?? '')
  const [direccion, setDireccion] = useState<Direccion>(existente?.direccion ?? 'me_debe')
  const [montoTxt, setMontoTxt] = useState(existente ? String(existente.monto) : '')
  const [pagado, setPagado] = useState(existente?.pagado ?? false)
  const [confirmarBorrar, setConfirmarBorrar] = useState(false)
  const monto = toNumber(montoTxt.trim())
  const valido = !!persona.trim() && monto !== null && monto > 0
  const esNueva = !!persona.trim() && !personas.some((p) => norm(p) === norm(persona))

  const guardar = async () => {
    if (!valido) return
    const c: CobroLocal = {
      id: existente?.id ?? nuevoId(),
      creado: existente?.creado ?? new Date().toISOString(),
      persona: personas.find((p) => norm(p) === norm(persona)) ?? persona.trim(),
      concepto: concepto.trim(),
      direccion,
      monto: Math.round(monto),
      pagado,
    }
    await actualizarCambios((x) => ({ ...x, cobros: existente ? x.cobros.map((y) => (y.id === c.id ? c : y)) : [...x.cobros, c] }))
    onClose()
  }

  return (
    <Sheet open onClose={onClose} titulo={existente ? 'Editar cobro' : 'Nuevo cobro'}>
      <div className="space-y-4">
        <label className="block">
          <span className="text-sm font-medium">Persona</span>
          <input className={cx(INPUT, 'mt-1')} list="personas-conocidas" value={persona} onChange={(e) => setPersona(e.target.value)} placeholder="Nombre" autoComplete="off" />
          <datalist id="personas-conocidas">
            {personas.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
          {esNueva && <span className="mt-1 block text-xs text-violet-700 dark:text-violet-300">Se agregará como persona nueva.</span>}
        </label>
        <label className="block">
          <span className="text-sm font-medium">Concepto</span>
          <input className={cx(INPUT, 'mt-1')} value={concepto} onChange={(e) => setConcepto(e.target.value)} placeholder="Ej: Entradas al cine" />
        </label>
        <div>
          <span className="text-sm font-medium">Dirección</span>
          <Segmented
            value={direccion}
            onChange={setDireccion}
            options={[
              { value: 'me_debe', label: 'Me debe' },
              { value: 'yo_debo', label: 'Yo debo' },
            ]}
          />
        </div>
        <label className="block">
          <span className="text-sm font-medium">Monto (CLP)</span>
          <input className={cx(INPUT, 'mt-1')} inputMode="numeric" value={montoTxt} onChange={(e) => setMontoTxt(e.target.value)} placeholder="Ej: 25000" />
          {monto !== null && monto > 0 && <span className="mt-1 block text-xs text-slate-500">{clp(monto)}</span>}
        </label>
        <div>
          <span className="text-sm font-medium">Estado</span>
          <Segmented
            value={pagado ? 'si' : 'no'}
            onChange={(v) => setPagado(v === 'si')}
            options={[
              { value: 'no', label: 'Pendiente' },
              { value: 'si', label: 'Pagado' },
            ]}
          />
        </div>
        <button type="button" className={BOTON} disabled={!valido} onClick={guardar}>
          {existente ? 'Guardar cambios' : 'Agregar cobro'}
        </button>
        {!valido && montoTxt && monto === null && <p className="text-xs text-rose-600">Escribe el monto como número (ej: 25000 o 25.000).</p>}
        {existente &&
          (confirmarBorrar ? (
            <div className="flex gap-2">
              <button type="button" className={BOTON_SEC} onClick={() => setConfirmarBorrar(false)}>
                Cancelar
              </button>
              <button
                type="button"
                className="min-h-12 w-full rounded-xl bg-rose-600 font-semibold text-white"
                onClick={async () => {
                  await actualizarCambios((x) => ({ ...x, cobros: x.cobros.filter((y) => y.id !== existente.id) }))
                  onClose()
                }}
              >
                Sí, eliminar
              </button>
            </div>
          ) : (
            <button type="button" className={BOTON_PELIGRO} onClick={() => setConfirmarBorrar(true)}>
              Eliminar cobro
            </button>
          ))}
      </div>
    </Sheet>
  )
}

function FormPersona({ personas, onClose, onCreada }: { personas: string[]; onClose: () => void; onCreada: (p: string) => void }) {
  const { actualizarCambios } = useDatos()
  const [nombre, setNombre] = useState('')
  const existe = personas.some((p) => norm(p) === norm(nombre))
  return (
    <Sheet open onClose={onClose} titulo="Nueva persona">
      <div className="space-y-4">
        <label className="block">
          <span className="text-sm font-medium">Nombre</span>
          <input className={cx(INPUT, 'mt-1')} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre" autoFocus />
          {existe && <span className="mt-1 block text-xs text-amber-700 dark:text-amber-400">Ya existe una persona con ese nombre.</span>}
        </label>
        <button
          type="button"
          className={BOTON}
          disabled={!nombre.trim() || existe}
          onClick={async () => {
            const p = nombre.trim()
            await actualizarCambios((x) => ({ ...x, personas: [...x.personas, p] }))
            onClose()
            onCreada(p)
          }}
        >
          Agregar persona
        </button>
      </div>
    </Sheet>
  )
}

function PanelCambios() {
  const { cambios, cuentas, actualizarCambios } = useDatos()
  const [abierto, setAbierto] = useState(false)
  const [copiado, setCopiado] = useState<boolean | null>(null)
  const [confirmar, setConfirmar] = useState(false)
  const personal = cuentas?.datos.personal ?? null
  const n = totalCambiosPersonal(cambios)
  const huerfanos = cambios.pagos.filter((p) => !pagoVigente(personal, p)).length
  const item = (key: string, etiqueta: string, texto: string, onQuitar: () => void, aviso?: string) => (
    <li key={key} className="flex items-start justify-between gap-3 py-2">
      <div className="min-w-0">
        <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{etiqueta}</div>
        <div>{texto}</div>
        {aviso && <div className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">⚠︎ {aviso}</div>}
      </div>
      <button type="button" onClick={onQuitar} className="min-h-11 shrink-0 rounded-lg px-2 text-sm font-semibold text-rose-700 dark:text-rose-400">
        Deshacer
      </button>
    </li>
  )
  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="mx-4 mt-3 flex min-h-12 w-[calc(100%-2rem)] items-center justify-between gap-3 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-left text-sm text-violet-900 dark:border-violet-900 dark:bg-violet-950/60 dark:text-violet-100"
      >
        <span>
          <b>{n === 1 ? '1 cambio hecho' : `${n} cambios hechos`} en la app</b> {n === 1 ? 'aún no está' : 'aún no están'} en el Excel
          {huerfanos > 0 && <span className="block text-xs text-amber-700 dark:text-amber-400">⚠︎ {huerfanos} no encuentran su ítem en el Excel</span>}
        </span>
        <span aria-hidden>›</span>
      </button>
      <Sheet open={abierto} onClose={() => setAbierto(false)} titulo="Cambios hechos en la app">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Se guardan en el teléfono y se mantienen aunque cargues un Excel nuevo. Cuando el Excel que cargues ya los incluya, la app los quita sola.
        </p>
        <ul className="mt-3 divide-y divide-slate-100 text-sm dark:divide-slate-800">
          {cambios.personas.map((p) => item(`p:${p}`, 'Persona nueva', p, () => actualizarCambios((c) => ({ ...c, personas: c.personas.filter((x) => x !== p) }))))}
          {cambios.cobros.map((x) =>
            item(`c:${x.id}`, 'Cobro nuevo', `${x.persona} · ${x.concepto || 'sin concepto'} · ${x.direccion === 'me_debe' ? 'me debe' : 'le debo'} ${clp(x.monto)}${x.pagado ? ' · pagado' : ''}`, () =>
              actualizarCambios((c) => ({ ...c, cobros: c.cobros.filter((y) => y.id !== x.id) })),
            ),
          )}
          {cambios.pagos.map((m) =>
            item(
              `m:${m.clave}`,
              m.pagado ? 'Marcado como pagado' : 'Vuelto a pendiente',
              m.descripcion,
              () => actualizarCambios((c) => ({ ...c, pagos: c.pagos.filter((y) => y.clave !== m.clave) })),
              pagoVigente(personal, m) ? undefined : 'No encuentro este ítem en el Excel actual; si ya lo anotaste allá, quítalo.',
            ),
          )}
        </ul>
        <div className="mt-4 space-y-2">
          <button type="button" className={BOTON} onClick={async () => setCopiado(await copiar(textoCambiosPersonal(personal, cambios)))}>
            {copiado === true ? '✓ Copiado' : copiado === false ? 'No se pudo copiar' : 'Copiar resumen para pasar al Excel'}
          </button>
          {confirmar ? (
            <div className="flex gap-2">
              <button type="button" className={BOTON_SEC} onClick={() => setConfirmar(false)}>
                Cancelar
              </button>
              <button
                type="button"
                className="min-h-12 w-full rounded-xl bg-rose-600 font-semibold text-white"
                onClick={async () => {
                  await actualizarCambios((c) => ({ ...c, cobros: [], pagos: [], personas: [] }))
                  setConfirmar(false)
                  setAbierto(false)
                }}
              >
                Sí, descartar todo
              </button>
            </div>
          ) : (
            <button type="button" className={BOTON_PELIGRO} onClick={() => setConfirmar(true)}>
              Descartar los cambios de Personas
            </button>
          )}
        </div>
      </Sheet>
    </>
  )
}
