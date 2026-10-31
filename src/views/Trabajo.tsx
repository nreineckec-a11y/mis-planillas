import { useMemo, useState } from 'react'
import { Card, Chip, Etiqueta, Header, Segmented, Vacio, cx } from '../components/ui'
import {
  agruparPorMes,
  calcularComp,
  ESTADOS_HE,
  montoHE,
  ordenarComp,
  totalesComp,
  totalesHE,
  valorHoraHE,
  type FilaCompCalc,
} from '../lib/cuentas/calc'
import { DIAS, formatYmdCorta, today, weekday } from '../lib/dates'
import { clp, horas } from '../lib/format'
import type { EstadoHE, HojaCompensatorias, HojaHorasExtra } from '../lib/model'
import { useDatos, useHoy } from '../state'

const COLOR_ESTADO: Record<string, string> = {
  Pagado: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200',
  'No pagado': 'bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200',
  Programado: 'bg-sky-100 text-sky-800 dark:bg-sky-900/60 dark:text-sky-200',
  Realizada: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200',
  Programada: 'bg-sky-100 text-sky-800 dark:bg-sky-900/60 dark:text-sky-200',
  otro: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
}

export default function Trabajo() {
  const { cuentas, cargando } = useDatos()
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

function HorasExtra({ hoja }: { hoja: HojaHorasExtra }) {
  const [filtro, setFiltro] = useState<EstadoHE | null>(null)
  const totales = useMemo(() => totalesHE(hoja), [hoja])
  const filas = filtro ? hoja.filas.filter((f) => f.estado === filtro) : hoja.filas
  const grupos = agruparPorMes(filas)

  return (
    <div className="px-4 pb-6">
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
      {filtro && (
        <p className="mt-2 text-sm">
          Mostrando <b>{filtro}</b>.{' '}
          <button type="button" className="font-semibold text-teal-700 underline dark:text-teal-400" onClick={() => setFiltro(null)}>
            Ver todos
          </button>
        </p>
      )}

      {grupos.map((g) => (
        <section key={g.mes} className="mt-5">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{g.mes}</h2>
          <div className="space-y-2">
            {g.filas.map((f) => {
              const m = montoHE(hoja, f)
              const vh = valorHoraHE(hoja, f)
              return (
                <Card key={f.fila} className="p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold">{f.detalle || 'Sin detalle'}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {f.fecha || 'sin fecha'} · {horas(f.horas)} al {f.recargo ? `${f.recargo}%` : '¿?'}
                        {vh !== null && ` · ${clp(vh)}/h`}
                      </div>
                      {f.liquidacion && <div className="text-xs text-slate-500 dark:text-slate-400">Liquidación: {f.liquidacion}</div>}
                      {f.observaciones && <div className="mt-1 text-xs italic text-slate-500 dark:text-slate-400">{f.observaciones}</div>}
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-bold tabular-nums">{m === null ? '—' : clp(m)}</div>
                      <Etiqueta className={cx('mt-1', COLOR_ESTADO[f.estado ?? 'otro'])}>{f.estado ?? (f.estadoRaw || 'Sin estado')}</Etiqueta>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        </section>
      ))}
      {grupos.length === 0 && <p className="py-8 text-center text-sm text-slate-500">Sin registros.</p>}
    </div>
  )
}

function Compensatorias({ hoja }: { hoja: HojaCompensatorias }) {
  const ahora = useHoy()
  const hoy = today(ahora)
  const filas = calcularComp(hoja, hoy)
  const t = totalesComp(filas)
  const ordenadas = ordenarComp(filas)
  const fmtH = (n: number) => horas(Math.round(n * 100) / 100)

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

      <h2 className="mt-5 mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Registro</h2>
      <div className="space-y-2">
        {ordenadas.map((f) => (
          <FilaComp key={f.fila} f={f} />
        ))}
        {ordenadas.length === 0 && <p className="py-8 text-center text-sm text-slate-500">Sin registros.</p>}
      </div>
    </div>
  )
}

function FilaComp({ f }: { f: FilaCompCalc }) {
  return (
    <Card className="p-3">
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
