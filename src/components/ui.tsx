import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { useDatos } from '../state'

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ')
}

export function Header({ titulo, sub, children }: { titulo: string; sub?: ReactNode; children?: ReactNode }) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/90 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
      <h1 className="text-xl font-bold tracking-tight">{titulo}</h1>
      {sub && <div className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{sub}</div>}
      {children}
    </header>
  )
}

export function Card({ children, className, onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  const base = 'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900'
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={cx(base, 'block w-full text-left active:scale-[0.99] active:bg-slate-50 dark:active:bg-slate-800', className)}>
        {children}
      </button>
    )
  return <div className={cx(base, className)}>{children}</div>
}

export function Stat({ label, value, tone, small }: { label: string; value: string; tone?: 'pos' | 'neg' | 'neutral'; small?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</div>
      <div
        className={cx(
          'truncate font-semibold tabular-nums',
          small ? 'text-base' : 'text-xl',
          tone === 'pos' && 'text-emerald-600 dark:text-emerald-400',
          tone === 'neg' && 'text-rose-600 dark:text-rose-400',
        )}
      >
        {value}
      </div>
    </div>
  )
}

export function Chip({
  children,
  active,
  onClick,
  className,
}: {
  children: ReactNode
  active?: boolean
  onClick?: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        'inline-flex min-h-11 shrink-0 items-center justify-center gap-1 rounded-full border px-4 text-sm font-medium transition-colors',
        active
          ? 'border-teal-700 bg-teal-700 text-white dark:border-teal-500 dark:bg-teal-600'
          : 'border-slate-300 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200',
        className,
      )}
    >
      {children}
    </button>
  )
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="mt-3 grid grid-flow-col gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={o.value === value}
          className={cx(
            'min-h-10 rounded-lg px-3 text-sm font-semibold',
            o.value === value ? 'bg-white text-slate-900 shadow dark:bg-slate-950 dark:text-white' : 'text-slate-500 dark:text-slate-400',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Hoja inferior modal. */
export function Sheet({ open, onClose, titulo, children }: { open: boolean; onClose: () => void; titulo: string; children: ReactNode }) {
  const id = useId()
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-labelledby={id}>
      <button type="button" aria-label="Cerrar" className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative max-h-[88vh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-white pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-xl dark:bg-slate-900">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-100 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
          <h2 id={id} className="text-lg font-semibold">
            {titulo}
          </h2>
          <button type="button" onClick={onClose} className="min-h-11 min-w-11 rounded-full text-2xl leading-none text-slate-500" aria-label="Cerrar">
            ×
          </button>
        </div>
        <div className="px-4 pt-3">{children}</div>
      </div>
    </div>
  )
}

export function BotonCargar({ texto = 'Cargar Excel', className }: { texto?: string; className?: string }) {
  const { importar, importando } = useDatos()
  const ref = useRef<HTMLInputElement>(null)
  return (
    <>
      <button
        type="button"
        disabled={importando}
        onClick={() => ref.current?.click()}
        className={cx('min-h-12 rounded-xl bg-teal-700 px-5 font-semibold text-white shadow active:bg-teal-800 disabled:opacity-60 dark:bg-teal-600', className)}
      >
        {importando ? 'Leyendo…' : texto}
      </button>
      <input
        ref={ref}
        type="file"
        multiple
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) void importar(e.target.files)
          e.target.value = ''
        }}
      />
    </>
  )
}

export function Vacio({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center px-6 py-16 text-center">
      <div className="mb-4 text-5xl" aria-hidden>
        📄
      </div>
      <h2 className="text-lg font-semibold">{titulo}</h2>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{texto}</p>
      <BotonCargar className="mt-6 w-full" />
    </div>
  )
}

export function Colapsable({ titulo, children, inicial = false }: { titulo: ReactNode; children: ReactNode; inicial?: boolean }) {
  const [abierto, setAbierto] = useState(inicial)
  return (
    <div>
      <button type="button" onClick={() => setAbierto(!abierto)} aria-expanded={abierto} className="flex min-h-11 w-full items-center justify-between text-left text-sm font-semibold text-slate-600 dark:text-slate-300">
        <span>{titulo}</span>
        <span aria-hidden className={cx('transition-transform', abierto && 'rotate-180')}>
          ⌄
        </span>
      </button>
      {abierto && children}
    </div>
  )
}

const PALETA = [
  'bg-sky-100 text-sky-800 dark:bg-sky-900/60 dark:text-sky-200',
  'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200',
  'bg-violet-100 text-violet-800 dark:bg-violet-900/60 dark:text-violet-200',
  'bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200',
  'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200',
  'bg-orange-100 text-orange-800 dark:bg-orange-900/60 dark:text-orange-200',
  'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-200',
  'bg-lime-100 text-lime-800 dark:bg-lime-900/60 dark:text-lime-200',
  'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/60 dark:text-fuchsia-200',
  'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/60 dark:text-cyan-200',
]

/** Color estable por nombre de tarjeta (sin nombres de bancos en el código). */
export function colorTarjeta(nombre: string): string {
  let h = 0
  for (const ch of nombre) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return PALETA[h % PALETA.length]
}

export function Etiqueta({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx('inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold', className)}>{children}</span>
}

export async function copiar(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto)
    return true
  } catch {
    const ta = document.createElement('textarea')
    ta.value = texto
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  }
}
