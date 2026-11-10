import { useEffect, useMemo, useState } from 'react'
import { Card, Chip, Colapsable, Etiqueta, Header, Segmented, Sheet, Vacio, colorTarjeta, cx } from '../components/ui'
import { addDays, DIAS, MESES, today, weekday, type Ymd } from '../lib/dates'
import { clp, pct } from '../lib/format'
import type { Descuento } from '../lib/model'
import { comerciosQueCalzan, descuentosDelDia, tablaComercio, valoresUnicos, zonasPorDefecto, type Filtros } from '../lib/descuentos/filtros'
import { norm } from '../lib/text'
import { conEmoji, conEmojiCategoria, emojiCategoria, emojiTipo } from '../lib/descuentos/emoji'
import { useMostrarFotos } from '../lib/prefs'
import { prefGuardar, prefLeer } from '../lib/storage'
import { useDatos, useHoy } from '../state'

const LETRAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
type FiltrosGuardados = Omit<Filtros, 'texto'>
const SIN_FILTROS: FiltrosGuardados = { tarjetas: [], zonas: [], canales: [], categorias: [], tipos: [], sectores: [] }
const GRUPOS: { key: keyof FiltrosGuardados; plural: string }[] = [
  { key: 'tarjetas', plural: 'tarjetas' },
  { key: 'zonas', plural: 'zonas' },
  { key: 'sectores', plural: 'sectores' },
  { key: 'canales', plural: 'canales' },
  { key: 'categorias', plural: 'categorías' },
  { key: 'tipos', plural: 'tipos' },
]

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
      tipos: valoresUnicos(items, 'tipo'),
      sectores: valoresUnicos(items, 'sector'),
    }),
    [items],
  )
  const [guardados, setGuardados] = useState<FiltrosGuardados>(() => {
    const def: FiltrosGuardados = { ...SIN_FILTROS, zonas: zonasPorDefecto(opciones.zonas) }
    // Completa con los valores por defecto los campos que no existían en filtros guardados antiguos.
    return { ...def, ...prefLeer<Partial<FiltrosGuardados>>('filtros', {}) }
  })
  // Solo valores que existen en el Excel actual (un filtro viejo no debe vaciar la lista sin aviso).
  const vigentes = (key: keyof FiltrosGuardados) => guardados[key].filter((x) => opciones[key].includes(x))
  const filtros: FiltrosGuardados = {
    tarjetas: vigentes('tarjetas'),
    // Si el Excel cambió sus zonas y ninguna guardada existe, se vuelve a la zona por defecto.
    zonas: guardados.zonas.length > 0 && vigentes('zonas').length === 0 ? zonasPorDefecto(opciones.zonas) : vigentes('zonas'),
    canales: vigentes('canales'),
    categorias: vigentes('categorias'),
    tipos: vigentes('tipos'),
    sectores: vigentes('sectores'),
  }
  useEffect(() => prefGuardar('filtros', guardados), [guardados])

  const [texto, setTexto] = useState('')
  const [offset, setOffset] = useState(0)
  const [abrirFiltros, setAbrirFiltros] = useState(false)
  const fecha = addDays(hoy, offset)
  const { aplican, revisar } = descuentosDelDia(items, fecha, { ...filtros, texto })
  // Chips rápidos: categorías y, al elegir una, sus subcategorías; solo las que tienen descuento ese día.
  const contar = (ds: Descuento[], key: 'categoriaGrupo' | 'tipo', valores: string[], elegidos: string[]) => {
    const n = new Map<string, number>()
    for (const d of ds) if (d[key]) n.set(d[key], (n.get(d[key]) ?? 0) + 1)
    return valores.filter((v) => n.has(v) || elegidos.includes(v)).map((v) => ({ valor: v, n: n.get(v) ?? 0 }))
  }
  const catsDelDia = contar(descuentosDelDia(items, fecha, { ...filtros, categorias: [], tipos: [], texto }).aplican, 'categoriaGrupo', opciones.categorias, filtros.categorias)
  const tiposDelDia = contar(descuentosDelDia(items, fecha, { ...filtros, tipos: [], texto }).aplican, 'tipo', opciones.tipos, filtros.tipos)
  const mostrarTipos = filtros.categorias.length > 0 || filtros.tipos.length > 0
  // Tocar una categoría la deja como única elegida (o la quita) y limpia las subcategorías.
  const elegirCategoria = (c: string) =>
    setGuardados({ ...filtros, categorias: filtros.categorias.length === 1 && filtros.categorias[0] === c ? [] : [c], tipos: [] })
  const toggleTipo = (t: string) =>
    setGuardados({ ...filtros, tipos: filtros.tipos.includes(t) ? filtros.tipos.filter((x) => x !== t) : [...filtros.tipos, t] })

  const nFiltros = GRUPOS.filter((g) => filtros[g.key].length > 0).length
  const resumenFiltros = GRUPOS.filter((g) => filtros[g.key].length > 0)
    .map((g) => {
      const sel = filtros[g.key]
      if (sel.length <= 2) return sel.join(', ')
      // Muchos elegidos y pocos fuera: se dice lo que queda fuera ("sin Regiones").
      const fuera = opciones[g.key].filter((v) => !sel.includes(v))
      return fuera.length > 0 && fuera.length <= 2 ? `sin ${fuera.join(', ')}` : `${sel.length} ${g.plural}`
    })
    .join(' · ')
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
          placeholder="Comercio, comuna o tipo"
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-base dark:border-slate-700 dark:bg-slate-900"
        />
        <Chip active={nFiltros > 0} onClick={() => setAbrirFiltros(true)}>
          Filtros{nFiltros > 0 ? ` (${nFiltros})` : ''}
        </Chip>
      </div>
      {nFiltros > 0 && (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          Filtrando: {resumenFiltros}
        </p>
      )}

      {catsDelDia.length > 0 && (
        <FilaChips
          titulo="Categoría"
          todos={filtros.categorias.length === 0}
          onTodos={() => setGuardados({ ...filtros, categorias: [], tipos: [] })}
          valores={catsDelDia}
          activos={filtros.categorias}
          etiqueta={conEmojiCategoria}
          onToggle={elegirCategoria}
        />
      )}
      {mostrarTipos && tiposDelDia.length > 0 && (
        <FilaChips
          titulo="Tipo"
          todos={filtros.tipos.length === 0}
          onTodos={() => setGuardados({ ...filtros, tipos: [] })}
          valores={tiposDelDia}
          activos={filtros.tipos}
          etiqueta={conEmoji}
          onToggle={toggleTipo}
        />
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
        <GrupoFiltro titulo="Sector" valores={opciones.sectores} sel={filtros.sectores} onChange={(v) => setGuardados({ ...filtros, sectores: v })} />
        <GrupoFiltro titulo="Canal" valores={opciones.canales} sel={filtros.canales} onChange={(v) => setGuardados({ ...filtros, canales: v })} />
        <GrupoFiltro titulo="Categoría" valores={opciones.categorias} sel={filtros.categorias} onChange={(v) => setGuardados({ ...filtros, categorias: v })} etiqueta={conEmojiCategoria} />
        <GrupoFiltro titulo="Tipo / subcategoría" valores={opciones.tipos} sel={filtros.tipos} onChange={(v) => setGuardados({ ...filtros, tipos: v })} etiqueta={conEmoji} />
        <div className="sticky bottom-0 flex gap-2 bg-white py-3 dark:bg-slate-900">
          <button type="button" className="min-h-12 flex-1 rounded-xl border border-slate-300 font-semibold dark:border-slate-700" onClick={() => setGuardados(SIN_FILTROS)}>
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

function FilaChips({
  titulo,
  todos,
  onTodos,
  valores,
  activos,
  etiqueta,
  onToggle,
}: {
  titulo: string
  todos: boolean
  onTodos: () => void
  valores: { valor: string; n: number }[]
  activos: string[]
  etiqueta: (v: string) => string
  onToggle: (v: string) => void
}) {
  return (
    <div className="-mx-4 mt-3">
      <div className="px-4 text-xs font-semibold text-slate-500 dark:text-slate-400">{titulo}</div>
      <div className="mt-1 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label={titulo}>
        <Chip active={todos} onClick={onTodos} className="min-h-10 px-3">
          Todas
        </Chip>
        {valores.map(({ valor, n }) => (
          <Chip key={valor} active={activos.includes(valor)} onClick={() => onToggle(valor)} className="min-h-10 whitespace-nowrap px-3">
            {etiqueta(valor)} <span className="opacity-60">{n}</span>
          </Chip>
        ))}
      </div>
    </div>
  )
}

function GrupoFiltro({
  titulo,
  valores,
  sel,
  onChange,
  etiqueta = (v) => v,
}: {
  titulo: string
  valores: string[]
  sel: string[]
  onChange: (v: string[]) => void
  etiqueta?: (v: string) => string
}) {
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
            {etiqueta(v)}
          </Chip>
        ))}
      </div>
    </section>
  )
}

type DatosFoto = Pick<Descuento, 'foto' | 'tipo' | 'categoriaGrupo' | 'comercio'>

/** Emoji que reemplaza la foto: el de la subcategoría o, si no hay, el de la categoría. */
function emojiDe(d: DatosFoto): string {
  if (d.tipo && norm(d.tipo) !== 'por confirmar') return emojiTipo(d.tipo)
  return emojiCategoria(d.categoriaGrupo) || '🏷️'
}

/** Miniatura del local; si no hay foto (o no carga, o están desactivadas), un recuadro con emoji. */
function Miniatura({ d }: { d: DatosFoto }) {
  const [mostrar] = useMostrarFotos()
  const [fallo, setFallo] = useState(false)
  const conFoto = mostrar && d.foto && !fallo
  return (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 text-2xl dark:bg-slate-800">
      {conFoto ? (
        <img src={d.foto!} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFallo(true)} className="h-full w-full object-cover" />
      ) : (
        <span aria-hidden>{emojiDe(d)}</span>
      )}
    </div>
  )
}

/** Foto grande (detalle y buscar comercio); no muestra nada si no hay o no carga. */
function FotoGrande({ d }: { d: DatosFoto }) {
  const [mostrar] = useMostrarFotos()
  const [fallo, setFallo] = useState(false)
  if (!mostrar || !d.foto || fallo) return null
  return (
    <img
      src={d.foto}
      alt={`Foto de ${d.comercio}`}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFallo(true)}
      className="mb-3 aspect-video w-full rounded-2xl bg-slate-100 object-cover dark:bg-slate-800"
    />
  )
}

function TarjetaDescuento({ d, onClick }: { d: Descuento; onClick: () => void }) {
  return (
    <Card onClick={onClick} className="p-3">
      <div className="flex items-start gap-3">
        <Miniatura d={d} />
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
            {d.tipo && norm(d.tipo) !== 'por confirmar' && <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{conEmoji(d.tipo)}</span>}
            {(d.comuna || d.sector) && (
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {[d.comuna, d.sector].filter((x, i, xs) => x && (i === 0 || norm(x) !== norm(xs[0]))).join(' · ')}
              </span>
            )}
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
    ['Sector', d.sector],
    ['Zona', d.zona],
    ['Categoría', conEmojiCategoria(d.categoria)],
    ['Tipo / subcategoría', conEmoji(d.tipo)],
    ['Verificación', d.verificacion],
  ]
  return (
    <Sheet open onClose={onClose} titulo={d.comercio}>
      <FotoGrande key={d.id} d={d} />
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
  // Primer descuento con foto del comercio elegido.
  const fotoComercio = useMemo(() => (comercio ? items.find((d) => norm(d.comercio) === norm(comercio) && d.foto) : undefined), [items, comercio])
  // Tipo de comida y comuna para mostrar bajo cada comercio de la lista.
  const infoComercio = useMemo(() => {
    const m = new Map<string, string>()
    for (const d of items) {
      const k = norm(d.comercio)
      if (m.has(k)) continue
      const tipo = d.tipo && norm(d.tipo) !== 'por confirmar' ? conEmoji(d.tipo) : ''
      m.set(k, [tipo, d.comuna].filter(Boolean).join(' · '))
    }
    return m
  }, [items])

  return (
    <div className="px-4 pb-6">
      <input
        type="search"
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value)
          setComercio(null)
        }}
        placeholder="Comercio, comuna o tipo (ej: italiano)"
        className="mt-3 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base dark:border-slate-700 dark:bg-slate-900"
        autoFocus
      />
      {!comercio && texto && (
        <ul className="mt-3 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
          {encontrados.map((c) => (
            <li key={c}>
              <button type="button" onClick={() => setComercio(c)} className="min-h-12 w-full px-4 py-2 text-left">
                <span className="block">{c}</span>
                {infoComercio.get(norm(c)) && <span className="block text-xs text-slate-500 dark:text-slate-400">{infoComercio.get(norm(c))}</span>}
              </button>
            </li>
          ))}
          {encontrados.length === 0 && <li className="p-4 text-sm text-slate-500">Sin resultados en este mes.</li>}
        </ul>
      )}
      {!texto && <p className="mt-6 text-center text-sm text-slate-500">Escribe un comercio o un tipo de comida para ver qué día y con qué tarjeta conviene.</p>}

      {tabla && comercio && (
        <div className="mt-4">
          {fotoComercio && <FotoGrande key={comercio} d={fotoComercio} />}
          <h2 className="text-lg font-semibold">{comercio}</h2>
          {infoComercio.get(norm(comercio)) && <p className="text-sm text-slate-500 dark:text-slate-400">{infoComercio.get(norm(comercio))}</p>}
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
