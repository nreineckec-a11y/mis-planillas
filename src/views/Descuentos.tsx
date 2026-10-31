import { useEffect, useMemo, useState } from 'react'
import { Card, Chip, Colapsable, Etiqueta, Header, Segmented, Sheet, Vacio, colorTarjeta, cx } from '../components/ui'
import { addDays, DIAS, MESES, today, weekday, type Ymd } from '../lib/dates'
import { clp, pct } from '../lib/format'
import type { Descuento } from '../lib/model'
import { comerciosQueCalzan, descuentosDelDia, tablaComercio, valoresUnicos, type Filtros } from '../lib/descuentos/filtros'
import { norm } from '../lib/text'
import { prefGuardar, prefLeer } from '../lib/storage'
import { useDatos, useHoy } from '../state'

const LETRAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const ZONA_POR_DEFECTO = 'RM / online'

type FiltrosGuardados = Omit<Filtros, 'texto'>

function valorDescuento(d: Descuento): string {
  if (d.pct !== null) return pct(d.pct)
  if (d.montoFijo !== null) return clp(d.montoFijo)
  return '—'
}

function textoTope(d: Descuento): string {
  const partes = []
  if (d.tope !== null) partes.push(`Tope ${clp(d.tope)}`)
  if (d.tipoTope) partes.push(d.tipoTope)
  return partes.join(' · ') || 'Tope no informado'
}

export default function Descuentos() {
  const { descuentos, cargando } = useDatos()
  const [vista, setVista] = useState<'hoy' | 'buscar'>('hoy')
  const [detalle, setDetalle] = useState<Descuento | null>(null)
  const ahora = useHoy()
  const hoy = today(ahora)

  if (cargando) return null
  if (!descuentos)
    return (
      <>
        <Header titulo="Descuentos" />
        <Vacio titulo="Sin descuentos cargados" texto='Carga el Excel de descuentos (el que tiene la hoja "Por día").' />
      </>
    )

  const { periodo, titulo, items } = descuentos.datos
  const desactualizado = periodo && (periodo.y !== hoy.y || periodo.m !== hoy.m)

  return (
    <>
      <Header titulo="Descuentos" sub={titulo ?? descuentos.archivo}>
        <Segmented
          value={vista}
          onChange={setVista}
          options={[
            { value: 'hoy', label: 'Por día' },
            { value: 'buscar', label: 'Buscar comercio' },
          ]}
        />
      </Header>
      {desactualizado && (
        <div role="status" className="mx-4 mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
          Estos descuentos son de <b>{MESES[periodo.m - 1]} {periodo.y}</b>; carga el Excel nuevo.
        </div>
      )}
      {vista === 'hoy' ? <Hoy items={items} hoy={hoy} onDetalle={setDetalle} /> : <Buscar items={items} onDetalle={setDetalle} />}
      <DetalleDescuento d={detalle} onClose={() => setDetalle(null)} />
    </>
  )
}

function Hoy({ items, hoy, onDetalle }: { items: Descuento[]; hoy: Ymd; onDetalle: (d: Descuento) => void }) {
  const opciones = useMemo(
    () => ({
      tarjetas: valoresUnicos(items, 'tarjeta'),
      zonas: valoresUnicos(items, 'zona'),
      canales: valoresUnicos(items, 'canal'),
      categorias: valoresUnicos(items, 'categoriaGrupo'),
    }),
    [items],
  )
  const [guardados, setGuardados] = useState<FiltrosGuardados>(() => {
    const def = { tarjetas: [], canales: [], categorias: [], zonas: opciones.zonas.filter((z) => norm(z) === norm(ZONA_POR_DEFECTO)) }
    return prefLeer<FiltrosGuardados>('filtros', def)
  })
  // Solo valores que existen en el Excel actual (un filtro viejo no debe vaciar la lista sin aviso).
  const filtros: FiltrosGuardados = {
    tarjetas: guardados.tarjetas.filter((x) => opciones.tarjetas.includes(x)),
    zonas: guardados.zonas.filter((x) => opciones.zonas.includes(x)),
    canales: guardados.canales.filter((x) => opciones.canales.includes(x)),
    categorias: guardados.categorias.filter((x) => opciones.categorias.includes(x)),
  }
  useEffect(() => prefGuardar('filtros', guardados), [guardados])

  const [texto, setTexto] = useState('')
  const [offset, setOffset] = useState(0)
  const [abrirFiltros, setAbrirFiltros] = useState(false)
  const fecha = addDays(hoy, offset)
  const { aplican, revisar } = descuentosDelDia(items, fecha, { ...filtros, texto })

  const nFiltros = filtros.tarjetas.length + filtros.zonas.length + filtros.canales.length + filtros.categorias.length
  // Chips de los próximos 7 días, partiendo por hoy.
  const dias = [0, 1, 2, 3, 4, 5, 6].map((off) => {
    const f = addDays(hoy, off)
    const wd = weekday(f)
    return { letra: off === 0 ? 'Hoy' : LETRAS[wd], wd, off, fecha: f }
  })

  return (
    <div className="px-4 pb-6">
      <div className="mt-3 grid grid-cols-7 gap-1" role="group" aria-label="Día">
        {dias.map((d) => (
          <button
            key={d.wd}
            type="button"
            onClick={() => setOffset(d.off)}
            aria-pressed={d.off === offset}
            aria-label={`${DIAS[d.wd]} ${d.fecha.d}`}
            className={cx(
              'flex min-h-14 flex-col items-center justify-center rounded-xl text-sm font-semibold',
              d.off === offset ? 'bg-teal-700 text-white dark:bg-teal-600' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
            )}
          >
            <span>{d.letra}</span>
            <span className={cx('text-xs font-normal', d.off === offset ? 'text-teal-50' : 'text-slate-500 dark:text-slate-400')}>{d.fecha.d}</span>
          </button>
        ))}
      </div>
      <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
        {offset === 0 ? 'Hoy, ' : ''}
        {DIAS[weekday(fecha)].toLowerCase()} {fecha.d} de {MESES[fecha.m - 1]}
      </p>

      <div className="mt-2 flex gap-2">
        <input
          type="search"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Buscar comercio o comuna"
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-base dark:border-slate-700 dark:bg-slate-900"
        />
        <Chip active={nFiltros > 0} onClick={() => setAbrirFiltros(true)}>
          Filtros{nFiltros > 0 ? ` (${nFiltros})` : ''}
        </Chip>
      </div>
      {nFiltros > 0 && (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          Filtrando: {[...filtros.tarjetas, ...filtros.zonas, ...filtros.canales, ...filtros.categorias].join(' · ')}
        </p>
      )}

      <p className="mt-4 mb-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
        {aplican.length === 1 ? '1 descuento' : `${aplican.length} descuentos`}
      </p>
      <div className="space-y-2">
        {aplican.map((d) => (
          <TarjetaDescuento key={d.id} d={d} onClick={() => onDetalle(d)} />
        ))}
        {aplican.length === 0 && <p className="py-8 text-center text-sm text-slate-500">No hay descuentos con estos filtros.</p>}
      </div>

      {revisar.length > 0 && (
        <div className="mt-6">
          <Colapsable titulo={`Fechas específicas — revisar (${revisar.length})`}>
            <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">No pude interpretar la fecha de estos descuentos; revisa si aplican.</p>
            <div className="space-y-2">
              {revisar.map((d) => (
                <TarjetaDescuento key={d.id} d={d} onClick={() => onDetalle(d)} />
              ))}
            </div>
          </Colapsable>
        </div>
      )}

      <Sheet open={abrirFiltros} onClose={() => setAbrirFiltros(false)} titulo="Filtros">
        <GrupoFiltro titulo="Tarjeta" valores={opciones.tarjetas} sel={filtros.tarjetas} onChange={(v) => setGuardados({ ...filtros, tarjetas: v })} />
        <GrupoFiltro titulo="Zona" valores={opciones.zonas} sel={filtros.zonas} onChange={(v) => setGuardados({ ...filtros, zonas: v })} />
        <GrupoFiltro titulo="Canal" valores={opciones.canales} sel={filtros.canales} onChange={(v) => setGuardados({ ...filtros, canales: v })} />
        <GrupoFiltro titulo="Categoría" valores={opciones.categorias} sel={filtros.categorias} onChange={(v) => setGuardados({ ...filtros, categorias: v })} />
        <div className="sticky bottom-0 flex gap-2 bg-white py-3 dark:bg-slate-900">
          <button type="button" className="min-h-12 flex-1 rounded-xl border border-slate-300 font-semibold dark:border-slate-700" onClick={() => setGuardados({ tarjetas: [], zonas: [], canales: [], categorias: [] })}>
            Limpiar
          </button>
          <button type="button" className="min-h-12 flex-1 rounded-xl bg-teal-700 font-semibold text-white dark:bg-teal-600" onClick={() => setAbrirFiltros(false)}>
            Ver {aplican.length}
          </button>
        </div>
      </Sheet>
    </div>
  )
}

function GrupoFiltro({ titulo, valores, sel, onChange }: { titulo: string; valores: string[]; sel: string[]; onChange: (v: string[]) => void }) {
  if (valores.length === 0) return null
  const toggle = (v: string) => onChange(sel.includes(v) ? sel.filter((x) => x !== v) : [...sel, v])
  return (
    <section className="mb-4">
      <h3 className="mb-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
        {titulo} <span className="font-normal text-slate-400">{sel.length ? `· ${sel.length}` : '· todas'}</span>
      </h3>
      <div className="flex flex-wrap gap-2">
        {valores.map((v) => (
          <Chip key={v} active={sel.includes(v)} onClick={() => toggle(v)} className="min-h-10 px-3">
            {v}
          </Chip>
        ))}
      </div>
    </section>
  )
}

function TarjetaDescuento({ d, onClick }: { d: Descuento; onClick: () => void }) {
  return (
    <Card onClick={onClick} className="p-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-base font-semibold leading-snug">
            {d.comercio}
            {d.noVerificado && (
              <span className="ml-1 text-amber-600" title="Verificar en la ficha" aria-label="Verificar en la ficha">
                ⚠︎
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {d.tarjeta && <Etiqueta className={colorTarjeta(d.tarjeta)}>{d.tarjeta}</Etiqueta>}
            {d.comuna && <span className="text-xs text-slate-500 dark:text-slate-400">{d.comuna}</span>}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{textoTope(d)}</div>
          {d.dia === 'especificas' && d.fechaEspecifica && <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">📅 {d.fechaEspecifica}</div>}
        </div>
        <div className="shrink-0 text-right">
          <div className="text-2xl font-bold tabular-nums text-teal-700 dark:text-teal-400">{valorDescuento(d)}</div>
          {d.pct === null && d.montoFijo !== null && <div className="text-xs text-slate-500">monto fijo</div>}
        </div>
      </div>
    </Card>
  )
}

function DetalleDescuento({ d, onClose }: { d: Descuento | null; onClose: () => void }) {
  if (!d) return null
  const dia = typeof d.dia === 'number' ? DIAS[d.dia] : d.dia === 'todos' ? 'Todos los días' : `Fechas específicas: ${d.fechaEspecifica || '—'}`
  const filas: [string, string][] = [
    ['Día', dia],
    ['Descuento', `${valorDescuento(d)}${d.pct === null && d.montoFijo !== null ? ' (monto fijo)' : ''}`],
    ['Tope', textoTope(d)],
    ['Condiciones', d.condiciones],
    ['Tarjetas que aplican', d.tarjetasAplican],
    ['Vigencia', d.vigencia],
    ['Canal', d.canal],
    ['Comuna / región', d.comuna],
    ['Zona', d.zona],
    ['Categoría', d.categoria],
    ['Verificación', d.verificacion],
  ]
  return (
    <Sheet open onClose={onClose} titulo={d.comercio}>
      {d.tarjeta && <Etiqueta className={colorTarjeta(d.tarjeta)}>{d.tarjeta}</Etiqueta>}
      {d.noVerificado && (
        <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
          ⚠︎ Dato no verificado: revisa la ficha antes de usarlo.
        </div>
      )}
      <dl className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
        {filas
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k} className="py-2">
              <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">{k}</dt>
              <dd className="whitespace-pre-line text-sm">{v}</dd>
            </div>
          ))}
      </dl>
      {d.fuente ? (
        <a href={d.fuente} target="_blank" rel="noopener noreferrer" className="mt-4 flex min-h-12 items-center justify-center rounded-xl bg-teal-700 font-semibold text-white dark:bg-teal-600">
          Ver ficha ↗
        </a>
      ) : (
        <p className="mt-4 text-center text-sm text-slate-500">Sin enlace a la ficha.</p>
      )}
    </Sheet>
  )
}

function Buscar({ items, onDetalle }: { items: Descuento[]; onDetalle: (d: Descuento) => void }) {
  const [texto, setTexto] = useState('')
  const [comercio, setComercio] = useState<string | null>(null)
  const encontrados = useMemo(() => comerciosQueCalzan(items, texto).slice(0, 60), [items, texto])
  const tabla = useMemo(() => (comercio ? tablaComercio(items, comercio) : null), [items, comercio])

  return (
    <div className="px-4 pb-6">
      <input
        type="search"
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value)
          setComercio(null)
        }}
        placeholder="Nombre del comercio o comuna"
        className="mt-3 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base dark:border-slate-700 dark:bg-slate-900"
        autoFocus
      />
      {!comercio && texto && (
        <ul className="mt-3 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
          {encontrados.map((c) => (
            <li key={c}>
              <button type="button" onClick={() => setComercio(c)} className="min-h-12 w-full px-4 text-left">
                {c}
              </button>
            </li>
          ))}
          {encontrados.length === 0 && <li className="p-4 text-sm text-slate-500">Sin resultados en este mes.</li>}
        </ul>
      )}
      {!texto && <p className="mt-6 text-center text-sm text-slate-500">Escribe un comercio para ver qué día y con qué tarjeta conviene.</p>}

      {tabla && comercio && (
        <div className="mt-4">
          <h2 className="text-lg font-semibold">{comercio}</h2>
          {tabla.tarjetas.length > 0 && (
            <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
              <table className="w-full table-fixed text-center text-sm">
                <thead>
                  <tr className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    <th className="w-[30%] px-2 py-2 text-left font-medium">Tarjeta</th>
                    {LETRAS.map((l, i) => (
                      <th key={i} className="py-2 font-medium">
                        {l}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tabla.tarjetas.map((t) => {
                    const fila = tabla.celdas[t]
                    return (
                      <tr key={t} className="border-t border-slate-100 dark:border-slate-800">
                        <td className="px-2 py-2 text-left">
                          <Etiqueta className={cx(colorTarjeta(t), 'max-w-full truncate')}>{t}</Etiqueta>
                        </td>
                        {fila.map((d, i) => (
                          <td key={i} className="p-0">
                            {d ? (
                              <button type="button" onClick={() => onDetalle(d)} className="min-h-11 w-full text-xs font-bold tabular-nums text-teal-700 dark:text-teal-400">
                                {d.pct !== null ? Math.round(d.pct * 100) : d.montoFijo !== null ? '$' : '•'}
                              </button>
                            ) : (
                              <span className="text-slate-300 dark:text-slate-700">·</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <p className="border-t border-slate-100 px-3 py-2 text-left text-xs text-slate-500 dark:border-slate-800">Cifras en %; “$” = monto fijo. Toca una celda para ver el detalle.</p>
            </div>
          )}
          {tabla.especificas.length > 0 && (
            <div className="mt-4 space-y-2">
              <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-300">Fechas específicas</h3>
              {tabla.especificas.map((d) => (
                <TarjetaDescuento key={d.id} d={d} onClick={() => onDetalle(d)} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
