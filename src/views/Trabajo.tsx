import { useMemo, useState } from 'react'
import { Card, Chip, Etiqueta, Header, Segmented, Sheet, Vacio, copiar, cx } from '../components/ui'
import {
  agruparPorMes,
  calcularComp,
  ESTADOS_HE,
  factorDe,
  montoHE,
  ordenarComp,
  ordenarHE,
  textoFechaHE,
  type Orden,
  totalesComp,
  totalesHE,
  valorHoraHE,
  type FilaCompCalc,
} from '../lib/cuentas/calc'
import {
  claveLocal,
  combinarComp,
  combinarHE,
  marcaVigente,
  marcarEstado,
  mesDe,
  nuevoId,
  quitarMarca,
  textoCambios,
  totalCambios,
  describirHE,
  type FilaCompVista,
  type FilaHEVista,
  type HojaHEVista,
  type TurnoCompLocal,
  type TurnoHELocal,
} from '../lib/cuentas/cambios'
import { compareYmd, DIAS, formatYmd, formatYmdCorta, MESES, parseDateValue, toIsoDate, today, weekday, type Ymd } from '../lib/dates'
import { clp, horas } from '../lib/format'
import type { EstadoHE, HojaCompensatorias, HojaHorasExtra, Parametros } from '../lib/model'
import { toNumber } from '../lib/text'
import { prefGuardar, prefLeer } from '../lib/storage'
import { useDatos, useHoy } from '../state'

const COLOR_ESTADO: Record<string, string> = {
  Pagado: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200',
  'No pagado': 'bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200',
  Programado: 'bg-sky-100 text-sky-800 dark:bg-sky-900/60 dark:text-sky-200',
  Realizada: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200',
  Programada: 'bg-sky-100 text-sky-800 dark:bg-sky-900/60 dark:text-sky-200',
  otro: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
}
const CHIP_APP = 'bg-violet-100 text-violet-800 dark:bg-violet-900/60 dark:text-violet-200'
const INPUT = 'min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base dark:border-slate-700 dark:bg-slate-950'
const BOTON = 'min-h-12 w-full rounded-xl bg-teal-700 font-semibold text-white active:bg-teal-800 disabled:opacity-50 dark:bg-teal-600'
const BOTON_SEC = 'min-h-12 w-full rounded-xl border border-slate-300 font-semibold dark:border-slate-700'

const sugerirRecargo = (f: Ymd): 25 | 50 => (weekday(f) >= 5 ? 50 : 25)
const fmtH = (n: number) => horas(Math.round(n * 100) / 100)

export default function Trabajo() {
  const { cuentas, cargando, cambios } = useDatos()
  const [vista, setVista] = useState<'he' | 'comp'>('he')
  const he = cuentas?.datos.horasExtra ?? []
  const comp = cuentas?.datos.compensatorias ?? []
  const [anioHE, setAnioHE] = useState<string | null>(null)
  const [anioComp, setAnioComp] = useState<string | null>(null)

  if (cargando) return null
  if (!cuentas || (he.length === 0 && comp.length === 0))
    return (
      <>
        <Header titulo="Trabajo" />
        <Vacio
          titulo="Sin datos de trabajo"
          texto={cuentas ? 'El Excel de cuentas cargado no tiene hojas "Trabajo - Horas extra …" ni "Trabajo - Compensatorias …".' : 'Carga el Excel de cuentas (hojas "Trabajo - Horas extra <año>" y "Trabajo - Compensatorias <año>").'}
        />
      </>
    )

  // Por defecto, la hoja del año más reciente.
  const ultima = <T extends { anio: string | null }>(xs: T[]) => [...xs].sort((a, b) => (b.anio ?? '').localeCompare(a.anio ?? ''))[0]
  const hojaHE = he.find((h) => h.anio === anioHE) ?? ultima(he)
  const hojaComp = comp.find((h) => h.anio === anioComp) ?? ultima(comp)

  return (
    <>
      <Header titulo="Trabajo" sub={cuentas.archivo}>
        <Segmented
          value={vista}
          onChange={setVista}
          options={[
            { value: 'he', label: 'Horas extra' },
            { value: 'comp', label: 'Compensatorias' },
          ]}
        />
      </Header>
      {totalCambios(cambios) > 0 && <PanelCambios />}
      {vista === 'he' ? (
        hojaHE ? (
          <>
            <SelectorAnio hojas={he} actual={hojaHE.anio} onChange={setAnioHE} />
            <HorasExtra hoja={hojaHE} />
          </>
        ) : (
          <p className="p-8 text-center text-sm text-slate-500">No hay hoja de horas extra en el Excel.</p>
        )
      ) : hojaComp ? (
        <>
          <SelectorAnio hojas={comp} actual={hojaComp.anio} onChange={setAnioComp} />
          <Compensatorias hoja={hojaComp} />
        </>
      ) : (
        <p className="p-8 text-center text-sm text-slate-500">No hay hoja de compensatorias en el Excel.</p>
      )}
    </>
  )
}

function SelectorAnio({ hojas, actual, onChange }: { hojas: { anio: string | null; hoja: string }[]; actual: string | null; onChange: (a: string | null) => void }) {
  if (hojas.length < 2) return null
  return (
    <div className="flex gap-2 overflow-x-auto px-4 pt-3">
      {hojas.map((h) => (
        <Chip key={h.hoja} active={h.anio === actual} onClick={() => onChange(h.anio)} className="min-h-10 px-3">
          {h.anio ?? h.hoja}
        </Chip>
      ))}
    </div>
  )
}

// ---------- Orden por fecha ----------

/** Orden elegido (se recuerda entre visitas y es el mismo para horas extra y compensatorias). */
function useOrden(): [Orden, (o: Orden) => void] {
  const [orden, setOrden] = useState<Orden>(() => prefLeer<Orden>('ordenTrabajo', 'asc'))
  return [
    orden,
    (o) => {
      setOrden(o)
      prefGuardar('ordenTrabajo', o)
    },
  ]
}

function SelectorOrden({ orden, onChange }: { orden: Orden; onChange: (o: Orden) => void }) {
  return (
    <Segmented
      value={orden}
      onChange={onChange}
      options={[
        { value: 'asc', label: '↑ Antiguas primero' },
        { value: 'desc', label: '↓ Recientes primero' },
      ]}
    />
  )
}

// ---------- Cambios pendientes de pasar al Excel ----------

function PanelCambios() {
  const { cambios, cuentas, actualizarCambios } = useDatos()
  const [abierto, setAbierto] = useState(false)
  const [copiado, setCopiado] = useState<boolean | null>(null)
  const [confirmar, setConfirmar] = useState(false)
  if (!cuentas) return null
  const datos = cuentas.datos
  const n = totalCambios(cambios)
  const huerfanas = cambios.marcas.filter((m) => !marcaVigente(datos, m)).length

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="mx-4 mt-3 flex min-h-12 w-[calc(100%-2rem)] items-center justify-between gap-3 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-left text-sm text-violet-900 dark:border-violet-900 dark:bg-violet-950/60 dark:text-violet-100"
      >
        <span>
          <b>{n === 1 ? '1 cambio hecho' : `${n} cambios hechos`} en la app</b> {n === 1 ? 'aún no está' : 'aún no están'} en el Excel
          {huerfanas > 0 && <span className="block text-xs text-amber-700 dark:text-amber-400">⚠︎ {huerfanas} no encuentran su fila en el Excel</span>}
        </span>
        <span aria-hidden>›</span>
      </button>
      <Sheet open={abierto} onClose={() => setAbierto(false)} titulo="Cambios hechos en la app">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Se guardan en el teléfono y se mantienen aunque cargues un Excel nuevo. Cuando el Excel que cargues ya los incluya, la app los quita sola.
        </p>
        <ul className="mt-3 divide-y divide-slate-100 text-sm dark:divide-slate-800">
          {cambios.he.map((t) => (
            <ItemCambio key={t.id} etiqueta={`Horas extra ${t.anio ?? ''}`} texto={`${fechaTexto(t.fecha)} · ${t.detalle || 'sin detalle'} · ${horas(t.horas)} al ${t.recargo}% · ${t.estado}`} onQuitar={() => actualizarCambios((c) => ({ ...c, he: c.he.filter((x) => x.id !== t.id) }))} />
          ))}
          {cambios.marcas.map((m) => (
            <ItemCambio
              key={`${m.anio}|${m.clave}`}
              etiqueta={`Cambio de estado ${m.anio ?? ''}`}
              texto={`${m.descripcion} → ${m.estado}${m.liquidacion ? ` (${m.liquidacion})` : ''}`}
              aviso={marcaVigente(datos, m) ? undefined : 'No encuentro esta fila en el Excel actual; si ya anotaste el pago allá, quítalo.'}
              onQuitar={() => actualizarCambios((c) => quitarMarca(c, m.anio, m.clave))}
            />
          ))}
          {cambios.comp.map((t) => (
            <ItemCambio key={t.id} etiqueta={`Compensatoria ${t.anio ?? ''}`} texto={`${fechaTexto(t.fecha)} · ${t.detalle || 'sin detalle'} · ${horas(t.horasTrabajadas)} al ${t.recargo}%`} onQuitar={() => actualizarCambios((c) => ({ ...c, comp: c.comp.filter((x) => x.id !== t.id) }))} />
          ))}
        </ul>
        <div className="mt-4 space-y-2">
          <button type="button" className={BOTON} onClick={async () => setCopiado(await copiar(textoCambios(datos, cambios)))}>
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
                  await actualizarCambios((c) => ({ ...c, he: [], comp: [], marcas: [] }))
                  setConfirmar(false)
                  setAbierto(false)
                }}
              >
                Sí, descartar todo
              </button>
            </div>
          ) : (
            <button type="button" className="min-h-12 w-full rounded-xl border border-rose-300 font-semibold text-rose-700 dark:border-rose-800 dark:text-rose-400" onClick={() => setConfirmar(true)}>
              Descartar todos los cambios
            </button>
          )}
        </div>
      </Sheet>
    </>
  )
}

const fechaTexto = (f: Ymd) => `${DIAS[weekday(f)].slice(0, 3)} ${formatYmdCorta(f)}`

function ItemCambio({ etiqueta, texto, aviso, onQuitar }: { etiqueta: string; texto: string; aviso?: string; onQuitar: () => void }) {
  return (
    <li className="flex items-start justify-between gap-3 py-2">
      <div className="min-w-0">
        <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{etiqueta.trim()}</div>
        <div>{texto}</div>
        {aviso && <div className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">⚠︎ {aviso}</div>}
      </div>
      <button type="button" onClick={onQuitar} className="min-h-11 shrink-0 rounded-lg px-2 text-sm font-semibold text-rose-700 dark:text-rose-400">
        Deshacer
      </button>
    </li>
  )
}

// ---------- Horas extra ----------

function HorasExtra({ hoja: hojaExcel }: { hoja: HojaHorasExtra }) {
  const { cambios, actualizarCambios } = useDatos()
  const hoja = useMemo(() => combinarHE(hojaExcel, cambios), [hojaExcel, cambios])
  const [filtro, setFiltro] = useState<EstadoHE | null>(null)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [pagar, setPagar] = useState(false)
  const [editando, setEditando] = useState<TurnoHELocal | 'nuevo' | null>(null)
  const [estadoDe, setEstadoDe] = useState<FilaHEVista | null>(null)
  const totales = totalesHE(hoja)
  const [orden, setOrden] = useOrden()
  const filas = filtro ? hoja.filas.filter((f) => f.estado === filtro) : hoja.filas
  const grupos = agruparPorMes(ordenarHE(filas, hoja.anio, orden))
  const seleccionadas = hoja.filas.filter((f) => sel.has(f.clave))
  const montoSel = seleccionadas.reduce((a, f) => a + (montoHE(hoja, f) ?? 0), 0)

  const toggle = (clave: string) => {
    const s = new Set(sel)
    if (s.has(clave)) s.delete(clave)
    else s.add(clave)
    setSel(s)
  }
  const abrir = (f: FilaHEVista) => {
    if (f.origen === 'app') {
      const t = cambios.he.find((x) => claveLocal(x.id) === f.clave)
      if (t) setEditando(t)
    } else setEstadoDe(f)
  }

  return (
    <div className={cx('px-4', sel.size > 0 ? 'pb-28' : 'pb-6')}>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {ESTADOS_HE.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => setFiltro(filtro === e ? null : e)}
            aria-pressed={filtro === e}
            className={cx(
              'rounded-2xl border bg-white p-3 text-left shadow-sm dark:bg-slate-900',
              filtro === e ? 'border-teal-600 ring-2 ring-teal-600' : 'border-slate-200 dark:border-slate-800',
            )}
          >
            <Etiqueta className={COLOR_ESTADO[e]}>{e}</Etiqueta>
            <div className="mt-2 text-base font-bold tabular-nums">{clp(totales[e].monto)}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{horas(totales[e].horas)}</div>
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        Total {horas(totales.Total.horas)} · {clp(totales.Total.monto)} bruto estimado
        {hoja.valorHora !== null && ` · valor hora ordinaria ${clp(hoja.valorHora)}`}
        {totales.Total.sinMonto > 0 && ` · ${totales.Total.sinMonto} sin monto (revisa advertencias en Ajustes)`}
      </p>

      <button type="button" className={cx(BOTON, 'mt-3')} onClick={() => setEditando('nuevo')}>
        + Agregar turno
      </button>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Toca ☐ en los turnos que te pagaron para marcarlos juntos, o toca un turno para cambiar su estado.</p>

      {filtro && (
        <p className="mt-2 text-sm">
          Mostrando <b>{filtro}</b>.{' '}
          <button type="button" className="font-semibold text-teal-700 underline dark:text-teal-400" onClick={() => setFiltro(null)}>
            Ver todos
          </button>
        </p>
      )}

      <SelectorOrden orden={orden} onChange={setOrden} />

      {grupos.map((g) => (
        <section key={g.mes} className="mt-5">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{g.mes}</h2>
          <div className="space-y-2">
            {g.filas.map((f) => (
              <FilaHE key={f.clave} hoja={hoja} f={f} marcada={sel.has(f.clave)} onToggle={() => toggle(f.clave)} onAbrir={() => abrir(f)} />
            ))}
          </div>
        </section>
      ))}
      {grupos.length === 0 && <p className="py-8 text-center text-sm text-slate-500">Sin registros.</p>}

      {sel.size > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4rem)] z-30 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
          <div className="mx-auto flex max-w-xl items-center gap-3">
            <div className="min-w-0 flex-1 text-sm">
              <b>{sel.size === 1 ? '1 turno' : `${sel.size} turnos`}</b> · {clp(montoSel)}
              <button type="button" className="ml-2 text-xs font-semibold text-slate-500 underline" onClick={() => setSel(new Set())}>
                Quitar selección
              </button>
            </div>
            <button type="button" className="min-h-12 shrink-0 rounded-xl bg-emerald-600 px-4 font-semibold text-white active:bg-emerald-700" onClick={() => setPagar(true)}>
              ✓ Marcar pagados
            </button>
          </div>
        </div>
      )}

      {pagar && (
        <SheetPagar
          filas={seleccionadas}
          monto={montoSel}
          onClose={() => setPagar(false)}
          onConfirmar={async (liq) => {
            await actualizarCambios((c) => marcarEstado(c, hoja, [...sel], 'Pagado', liq))
            setSel(new Set())
            setPagar(false)
          }}
        />
      )}
      {estadoDe && <SheetEstado hoja={hoja} f={estadoDe} onClose={() => setEstadoDe(null)} />}
      {editando && <FormTurnoHE hoja={hoja} turno={editando === 'nuevo' ? null : editando} onClose={() => setEditando(null)} />}
    </div>
  )
}

function Check({ marcada, onToggle, etiqueta }: { marcada: boolean; onToggle: () => void; etiqueta: string }) {
  return (
    <button type="button" role="checkbox" aria-checked={marcada} aria-label={etiqueta} onClick={onToggle} className="flex min-h-11 min-w-11 shrink-0 items-start justify-center pt-0.5">
      <span
        className={cx(
          'flex h-6 w-6 items-center justify-center rounded-md border-2 text-sm font-bold',
          marcada ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-400 dark:border-slate-500',
        )}
      >
        {marcada ? '✓' : ''}
      </span>
    </button>
  )
}

function FilaHE({ hoja, f, marcada, onToggle, onAbrir }: { hoja: HojaHEVista; f: FilaHEVista; marcada: boolean; onToggle: () => void; onAbrir: () => void }) {
  const m = montoHE(hoja, f)
  const vh = valorHoraHE(hoja, f)
  const pagable = f.estado !== 'Pagado'
  return (
    <div className={cx('flex items-stretch rounded-2xl border bg-white shadow-sm dark:bg-slate-900', marcada ? 'border-emerald-500 ring-1 ring-emerald-500' : 'border-slate-200 dark:border-slate-800')}>
      {pagable ? <Check marcada={marcada} onToggle={onToggle} etiqueta={`Seleccionar ${f.detalle || f.fecha}`} /> : <span className="w-3 shrink-0" />}
      <button type="button" onClick={onAbrir} className="flex min-w-0 flex-1 items-start justify-between gap-3 py-3 pr-3 text-left active:opacity-70">
        <div className="min-w-0">
          <div className="font-semibold">{f.detalle || 'Sin detalle'}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {textoFechaHE(f) || 'sin fecha'} · {horas(f.horas)} al {f.recargo ? `${f.recargo}%` : '¿?'}
            {vh !== null && ` · ${clp(vh)}/h`}
          </div>
          {f.liquidacion && <div className="text-xs text-slate-500 dark:text-slate-400">Liquidación: {f.liquidacion}</div>}
          {f.observaciones && <div className="mt-1 text-xs italic text-slate-500 dark:text-slate-400">{f.observaciones}</div>}
          {f.origen === 'app' && <Etiqueta className={cx('mt-1', CHIP_APP)}>Agregado en la app</Etiqueta>}
          {f.modificado && <Etiqueta className={cx('mt-1', CHIP_APP)}>Cambiado en la app · Excel: {f.estadoExcel ?? 'sin estado'}</Etiqueta>}
        </div>
        <div className="shrink-0 text-right">
          <div className="font-bold tabular-nums">{m === null ? '—' : clp(m)}</div>
          <Etiqueta className={cx('mt-1', COLOR_ESTADO[f.estado ?? 'otro'])}>{f.estado ?? (f.estadoRaw || 'Sin estado')}</Etiqueta>
        </div>
      </button>
    </div>
  )
}

/** Sugerencias de liquidación: mes actual y anterior. */
function sugerenciasLiq(hoy: Ymd): string[] {
  const ant = hoy.m === 1 ? 12 : hoy.m - 1
  return [`Liq. ${MESES[hoy.m - 1]}`, `Liq. ${MESES[ant - 1]}`]
}

function CampoLiquidacion({ valor, onChange }: { valor: string; onChange: (v: string) => void }) {
  const hoy = today(useHoy())
  return (
    <label className="mt-3 block">
      <span className="text-sm font-medium">Liquidación en que se pagó (opcional)</span>
      <input className={cx(INPUT, 'mt-1')} value={valor} onChange={(e) => onChange(e.target.value)} placeholder={`Ej: ${sugerenciasLiq(hoy)[0]}`} />
      <div className="mt-2 flex flex-wrap gap-2">
        {sugerenciasLiq(hoy).map((s) => (
          <Chip key={s} active={valor === s} onClick={() => onChange(s)} className="min-h-10 px-3">
            {s}
          </Chip>
        ))}
      </div>
    </label>
  )
}

function SheetPagar({ filas, monto, onClose, onConfirmar }: { filas: FilaHEVista[]; monto: number; onClose: () => void; onConfirmar: (liq: string) => Promise<void> }) {
  const [liq, setLiq] = useState('')
  return (
    <Sheet open onClose={onClose} titulo="Marcar como pagados">
      <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
        {filas.map((f) => (
          <li key={f.clave} className="py-1.5">
            {describirHE(f)}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-sm font-semibold">Total: {clp(monto)}</p>
      <CampoLiquidacion valor={liq} onChange={setLiq} />
      <button type="button" className={cx(BOTON, 'mt-4')} onClick={() => onConfirmar(liq.trim())}>
        ✓ Marcar {filas.length === 1 ? '1 turno' : `${filas.length} turnos`} como pagados
      </button>
    </Sheet>
  )
}

function SheetEstado({ hoja, f, onClose }: { hoja: HojaHEVista; f: FilaHEVista; onClose: () => void }) {
  const { actualizarCambios } = useDatos()
  const [estado, setEstado] = useState<EstadoHE>(f.estado ?? 'No pagado')
  const [liq, setLiq] = useState(f.liquidacion)
  const m = montoHE(hoja, f)
  return (
    <Sheet open onClose={onClose} titulo={f.detalle || 'Turno'}>
      <p className="text-sm text-slate-600 dark:text-slate-300">
        {describirHE(f)}
        {m !== null && ` · ${clp(m)}`}
      </p>
      <p className="mt-1 text-xs text-slate-500">Viene del Excel (fila {f.fila}). Estado en el Excel: {f.estadoExcel ?? 'sin estado'}.</p>
      <Segmented value={estado} onChange={setEstado} options={ESTADOS_HE.map((e) => ({ value: e, label: e }))} />
      {estado === 'Pagado' && <CampoLiquidacion valor={liq} onChange={setLiq} />}
      <div className="mt-4 space-y-2">
        <button
          type="button"
          className={BOTON}
          onClick={async () => {
            await actualizarCambios((c) => marcarEstado(c, hoja, [f.clave], estado, liq.trim()))
            onClose()
          }}
        >
          Guardar
        </button>
        {f.modificado && (
          <button
            type="button"
            className={BOTON_SEC}
            onClick={async () => {
              await actualizarCambios((c) => quitarMarca(c, hoja.anio, f.clave))
              onClose()
            }}
          >
            Volver a lo del Excel ({f.estadoExcel ?? 'sin estado'})
          </button>
        )}
      </div>
    </Sheet>
  )
}

function CampoFecha({ valor, onChange }: { valor: Ymd; onChange: (f: Ymd) => void }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">Fecha</span>
      <input
        type="date"
        className={cx(INPUT, 'mt-1')}
        value={toIsoDate(valor)}
        onChange={(e) => {
          const f = parseDateValue(e.target.value)
          if (f) onChange(f)
        }}
      />
      <span className="mt-1 block text-xs text-slate-500">{DIAS[weekday(valor)]}</span>
    </label>
  )
}

function CampoNumero({ label, valor, onChange, sufijo }: { label: string; valor: string; onChange: (v: string) => void; sufijo?: string }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <div className="mt-1 flex items-center gap-2">
        <input inputMode="decimal" className={INPUT} value={valor} onChange={(e) => onChange(e.target.value)} placeholder="0" />
        {sufijo && <span className="text-sm text-slate-500">{sufijo}</span>}
      </div>
    </label>
  )
}

function CampoRecargo({ valor, onChange }: { valor: 25 | 50; onChange: (v: 25 | 50) => void }) {
  return (
    <div className="block">
      <span className="text-sm font-medium">Recargo</span>
      <Segmented
        value={String(valor) as '25' | '50'}
        onChange={(v) => onChange(v === '25' ? 25 : 50)}
        options={[
          { value: '25', label: '25% (semana)' },
          { value: '50', label: '50% (fds/feriado)' },
        ]}
      />
    </div>
  )
}

function CampoTexto({ label, valor, onChange, placeholder }: { label: string; valor: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <input className={cx(INPUT, 'mt-1')} value={valor} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </label>
  )
}

function AvisoAnio({ fecha, anio }: { fecha: Ymd; anio: string | null }) {
  if (!anio || String(fecha.y) === anio) return null
  return <p className="text-xs text-amber-700 dark:text-amber-400">⚠︎ La fecha es de {fecha.y}, pero el turno se agregará a la hoja {anio}.</p>
}

function FormTurnoHE({ hoja, turno, onClose }: { hoja: HojaHEVista; turno: TurnoHELocal | null; onClose: () => void }) {
  const { actualizarCambios } = useDatos()
  const hoy = today(useHoy())
  const [fecha, setFecha] = useState<Ymd>(turno?.fecha ?? hoy)
  const [horasTxt, setHorasTxt] = useState(turno ? String(turno.horas).replace('.', ',') : '')
  const [recargo, setRecargo] = useState<25 | 50>(turno?.recargo ?? sugerirRecargo(hoy))
  const [recargoTocado, setRecargoTocado] = useState(!!turno)
  const [detalle, setDetalle] = useState(turno?.detalle ?? '')
  const [estado, setEstado] = useState<EstadoHE>(turno?.estado ?? 'No pagado')
  const [estadoTocado, setEstadoTocado] = useState(!!turno)
  const [liq, setLiq] = useState(turno?.liquidacion ?? '')
  const [obs, setObs] = useState(turno?.observaciones ?? '')
  const [confirmarBorrar, setConfirmarBorrar] = useState(false)
  const h = toNumber(horasTxt.trim())
  const valido = h !== null && h > 0 && h <= 24
  const monto = valido && hoja.valorHora !== null && factorDe(hoja, recargo) !== null ? h * hoja.valorHora * factorDe(hoja, recargo)! : null

  const cambiarFecha = (f: Ymd) => {
    setFecha(f)
    if (!recargoTocado) setRecargo(sugerirRecargo(f))
    if (!estadoTocado) setEstado(compareYmd(f, hoy) > 0 ? 'Programado' : 'No pagado')
  }

  const guardar = async () => {
    if (!valido) return
    const t: TurnoHELocal = {
      id: turno?.id ?? nuevoId(),
      creado: turno?.creado ?? new Date().toISOString(),
      anio: hoja.anio,
      fecha,
      detalle: detalle.trim(),
      horas: h,
      recargo,
      estado,
      liquidacion: estado === 'Pagado' ? liq.trim() : '',
      observaciones: obs.trim(),
    }
    await actualizarCambios((c) => ({ ...c, he: turno ? c.he.map((x) => (x.id === t.id ? t : x)) : [...c.he, t] }))
    onClose()
  }

  return (
    <Sheet open onClose={onClose} titulo={turno ? 'Editar turno' : 'Agregar turno de horas extra'}>
      <div className="space-y-4">
        <CampoFecha valor={fecha} onChange={cambiarFecha} />
        <AvisoAnio fecha={fecha} anio={hoja.anio} />
        <CampoNumero label="Horas" valor={horasTxt} onChange={setHorasTxt} sufijo="h" />
        <CampoRecargo
          valor={recargo}
          onChange={(v) => {
            setRecargo(v)
            setRecargoTocado(true)
          }}
        />
        <CampoTexto label="Detalle" valor={detalle} onChange={setDetalle} placeholder="Ej: Turno extra" />
        <div>
          <span className="text-sm font-medium">Estado</span>
          <Segmented
            value={estado}
            onChange={(v) => {
              setEstado(v)
              setEstadoTocado(true)
            }}
            options={ESTADOS_HE.map((e) => ({ value: e, label: e }))}
          />
          {estado === 'Pagado' && <CampoLiquidacion valor={liq} onChange={setLiq} />}
        </div>
        <CampoTexto label="Observaciones (opcional)" valor={obs} onChange={setObs} />
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {mesDe(fecha)} · Monto estimado: <b>{monto === null ? '—' : clp(monto)}</b>
        </p>
        <button type="button" className={BOTON} disabled={!valido} onClick={guardar}>
          {turno ? 'Guardar cambios' : 'Agregar turno'}
        </button>
        {!valido && horasTxt && <p className="text-xs text-rose-600">Indica las horas como número (ej: 4 o 2,5).</p>}
        {turno && <BotonEliminar confirmar={confirmarBorrar} setConfirmar={setConfirmarBorrar} onEliminar={async () => {
          await actualizarCambios((c) => ({ ...c, he: c.he.filter((x) => x.id !== turno.id) }))
          onClose()
        }} />}
      </div>
    </Sheet>
  )
}

function BotonEliminar({ confirmar, setConfirmar, onEliminar }: { confirmar: boolean; setConfirmar: (v: boolean) => void; onEliminar: () => Promise<void> }) {
  return confirmar ? (
    <div className="flex gap-2">
      <button type="button" className={BOTON_SEC} onClick={() => setConfirmar(false)}>
        Cancelar
      </button>
      <button type="button" className="min-h-12 w-full rounded-xl bg-rose-600 font-semibold text-white" onClick={onEliminar}>
        Sí, eliminar
      </button>
    </div>
  ) : (
    <button type="button" className="min-h-12 w-full rounded-xl border border-rose-300 font-semibold text-rose-700 dark:border-rose-800 dark:text-rose-400" onClick={() => setConfirmar(true)}>
      Eliminar turno
    </button>
  )
}

// ---------- Compensatorias ----------

function Compensatorias({ hoja: hojaExcel }: { hoja: HojaCompensatorias }) {
  const { cambios } = useDatos()
  const ahora = useHoy()
  const hoy = today(ahora)
  const hoja = useMemo(() => combinarComp(hojaExcel, cambios), [hojaExcel, cambios])
  const filas = calcularComp(hoja, hoy)
  const t = totalesComp(filas)
  const [orden, setOrden] = useOrden()
  const ordenadas = ordenarComp(filas, orden)
  const [editando, setEditando] = useState<TurnoCompLocal | 'nuevo' | null>(null)

  return (
    <div className="px-4 pb-6">
      <Card className="mt-3">
        <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Saldo a favor actual</div>
        <div className="text-4xl font-bold tabular-nums text-teal-700 dark:text-teal-400">{fmtH(t.Realizada.saldo)}</div>
        <div className="text-sm text-slate-600 dark:text-slate-300">≈ {clp(t.Realizada.equivalente)}</div>
        {t.Programada.filas > 0 && (
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            + {fmtH(t.Programada.saldo)} cuando se realicen los {t.Programada.filas === 1 ? 'turno programado' : `${t.Programada.filas} turnos programados`}
          </p>
        )}
        {t.Total.sinCalculo > 0 && <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">{t.Total.sinCalculo} fila(s) sin cálculo por recargo no reconocido.</p>}
      </Card>

      <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-right text-xs tabular-nums">
          <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            <tr>
              <th className="px-2 py-2 text-left font-medium" />
              <th className="px-2 py-2 font-medium">Realizadas</th>
              <th className="px-2 py-2 font-medium">Programadas</th>
              <th className="px-2 py-2 font-medium">Total año</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {(
              [
                ['Trabajadas', (x: typeof t.Total) => fmtH(x.horasTrabajadas)],
                ['Generadas', (x: typeof t.Total) => fmtH(x.generadas)],
                ['Tomadas', (x: typeof t.Total) => fmtH(x.tomadas)],
                ['Saldo', (x: typeof t.Total) => fmtH(x.saldo)],
                ['Equivalente', (x: typeof t.Total) => clp(x.equivalente)],
              ] as const
            ).map(([label, fn]) => (
              <tr key={label}>
                <th className="px-2 py-2 text-left font-medium text-slate-500 dark:text-slate-400">{label}</th>
                <td className="px-2 py-2">{fn(t.Realizada)}</td>
                <td className="px-2 py-2">{fn(t.Programada)}</td>
                <td className="px-2 py-2 font-semibold">{fn(t.Total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        {hoja.valorHora !== null && `Valor hora ${clp(hoja.valorHora)}. `}Estado según la fecha de hoy en el teléfono.
      </p>

      <button type="button" className={cx(BOTON, 'mt-3')} onClick={() => setEditando('nuevo')}>
        + Agregar turno
      </button>

      <h2 className="mt-5 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Registro</h2>
      <SelectorOrden orden={orden} onChange={setOrden} />
      <div className="mb-2" />
      <div className="space-y-2">
        {ordenadas.map((f) => (
          <FilaComp
            key={`${f.origen}:${f.idLocal ?? f.fila}`}
            f={f}
            onAbrir={
              f.origen === 'app'
                ? () => {
                    const tl = cambios.comp.find((x) => x.id === f.idLocal)
                    if (tl) setEditando(tl)
                  }
                : undefined
            }
          />
        ))}
        {ordenadas.length === 0 && <p className="py-8 text-center text-sm text-slate-500">Sin registros.</p>}
      </div>
      {editando && <FormTurnoComp hoja={hoja} turno={editando === 'nuevo' ? null : editando} onClose={() => setEditando(null)} />}
    </div>
  )
}

function FilaComp({ f, onAbrir }: { f: FilaCompCalc<FilaCompVista>; onAbrir?: () => void }) {
  return (
    <Card className="p-3" onClick={onAbrir}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold">
            {DIAS[weekday(f.fecha)]} {formatYmdCorta(f.fecha)}
          </div>
          <div className="text-sm">{f.detalle || 'Sin detalle'}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {horas(f.horasTrabajadas)} al {f.recargo ? `${f.recargo}%` : '¿?'}
            {f.factor !== null && ` (×${f.factor})`} → {f.generadas === null ? '—' : horas(f.generadas)}
            {f.horasTomadas > 0 && ` · tomadas ${horas(f.horasTomadas)}`}
          </div>
          {f.observaciones && <div className="mt-1 text-xs italic text-slate-500 dark:text-slate-400">{f.observaciones}</div>}
          {f.origen === 'app' && <Etiqueta className={cx('mt-1', CHIP_APP)}>Agregado en la app</Etiqueta>}
        </div>
        <div className="shrink-0 text-right">
          <div className="font-bold tabular-nums">{f.saldo === null ? '—' : horas(f.saldo)}</div>
          {f.equivalente !== null && <div className="text-xs text-slate-500">{clp(f.equivalente)}</div>}
          <Etiqueta className={cx('mt-1', COLOR_ESTADO[f.estado])}>{f.estado}</Etiqueta>
        </div>
      </div>
    </Card>
  )
}

function FormTurnoComp({ hoja, turno, onClose }: { hoja: Parametros & { anio: string | null }; turno: TurnoCompLocal | null; onClose: () => void }) {
  const { actualizarCambios } = useDatos()
  const hoy = today(useHoy())
  const [fecha, setFecha] = useState<Ymd>(turno?.fecha ?? hoy)
  const [horasTxt, setHorasTxt] = useState(turno ? String(turno.horasTrabajadas).replace('.', ',') : '')
  const [recargo, setRecargo] = useState<25 | 50>(turno?.recargo ?? sugerirRecargo(hoy))
  const [recargoTocado, setRecargoTocado] = useState(!!turno)
  const [tomadasTxt, setTomadasTxt] = useState(turno?.horasTomadas ? String(turno.horasTomadas).replace('.', ',') : '')
  const [detalle, setDetalle] = useState(turno?.detalle ?? '')
  const [obs, setObs] = useState(turno?.observaciones ?? '')
  const [confirmarBorrar, setConfirmarBorrar] = useState(false)
  const h = toNumber(horasTxt.trim())
  const tomadas = tomadasTxt.trim() ? toNumber(tomadasTxt.trim()) : 0
  const valido = h !== null && h > 0 && h <= 24 && tomadas !== null && tomadas >= 0
  const factor = factorDe(hoja, recargo)
  const generadas = valido && factor !== null ? h * factor : null

  const guardar = async () => {
    if (!valido) return
    const t: TurnoCompLocal = {
      id: turno?.id ?? nuevoId(),
      creado: turno?.creado ?? new Date().toISOString(),
      anio: hoja.anio,
      fecha,
      detalle: detalle.trim(),
      horasTrabajadas: h,
      recargo,
      horasTomadas: tomadas,
      observaciones: obs.trim(),
    }
    await actualizarCambios((c) => ({ ...c, comp: turno ? c.comp.map((x) => (x.id === t.id ? t : x)) : [...c.comp, t] }))
    onClose()
  }

  return (
    <Sheet open onClose={onClose} titulo={turno ? 'Editar turno' : 'Agregar turno compensatorio'}>
      <div className="space-y-4">
        <CampoFecha
          valor={fecha}
          onChange={(f) => {
            setFecha(f)
            if (!recargoTocado) setRecargo(sugerirRecargo(f))
          }}
        />
        <AvisoAnio fecha={fecha} anio={hoja.anio} />
        <CampoNumero label="Horas trabajadas" valor={horasTxt} onChange={setHorasTxt} sufijo="h" />
        <CampoRecargo
          valor={recargo}
          onChange={(v) => {
            setRecargo(v)
            setRecargoTocado(true)
          }}
        />
        <CampoTexto label="Detalle" valor={detalle} onChange={setDetalle} placeholder="Ej: Turno domingo" />
        <CampoNumero label="Horas ya tomadas (opcional)" valor={tomadasTxt} onChange={setTomadasTxt} sufijo="h" />
        <CampoTexto label="Observaciones (opcional)" valor={obs} onChange={setObs} />
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {formatYmd(fecha)} · {compareYmd(fecha, hoy) <= 0 ? 'Realizada' : 'Programada'} · Genera: <b>{generadas === null ? '—' : horas(generadas)}</b>
        </p>
        <button type="button" className={BOTON} disabled={!valido} onClick={guardar}>
          {turno ? 'Guardar cambios' : 'Agregar turno'}
        </button>
        {!valido && horasTxt && <p className="text-xs text-rose-600">Indica las horas como número (ej: 4 o 2,5).</p>}
        {turno && (
          <BotonEliminar
            confirmar={confirmarBorrar}
            setConfirmar={setConfirmarBorrar}
            onEliminar={async () => {
              await actualizarCambios((c) => ({ ...c, comp: c.comp.filter((x) => x.id !== turno.id) }))
              onClose()
            }}
          />
        )}
      </div>
    </Sheet>
  )
}
