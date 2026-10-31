import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { importarLibro, type ResultadoImportacion } from './lib/importar'
import { SCHEMA, type Registro, type RegistroCuentas, type RegistroDescuentos, type Tipo } from './lib/model'
import * as storage from './lib/storage'

interface Estado {
  cargando: boolean
  cuentas?: RegistroCuentas
  descuentos?: RegistroDescuentos
  /** Tipos guardados con un formato antiguo: hay que volver a cargar el Excel. */
  obsoletos: Tipo[]
  persistido: boolean | null
  ultimaImportacion: ResultadoImportacion[] | null
  importando: boolean
  importar: (files: FileList | File[]) => Promise<void>
  borrar: (tipo: Tipo) => Promise<void>
  cerrarImportacion: () => void
}

const Ctx = createContext<Estado | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const [cargando, setCargando] = useState(true)
  const [cuentas, setCuentas] = useState<RegistroCuentas>()
  const [descuentos, setDescuentos] = useState<RegistroDescuentos>()
  const [obsoletos, setObsoletos] = useState<Tipo[]>([])
  const [persistido, setPersistido] = useState<boolean | null>(null)
  const [ultimaImportacion, setUltima] = useState<ResultadoImportacion[] | null>(null)
  const [importando, setImportando] = useState(false)

  const aplicar = useCallback((r: Registro) => {
    if (r.tipo === 'cuentas') setCuentas(r)
    else setDescuentos(r)
  }, [])

  useEffect(() => {
    ;(async () => {
      const viejos: Tipo[] = []
      for (const tipo of ['cuentas', 'descuentos'] as const) {
        try {
          const r = await storage.leer(tipo)
          if (!r) continue
          if (r.schema !== SCHEMA) viejos.push(tipo)
          else aplicar(r)
        } catch {
          /* IndexedDB no disponible: la app parte vacía */
        }
      }
      setObsoletos(viejos)
      setPersistido(await storage.estaPersistido())
      setCargando(false)
    })()
  }, [aplicar])

  const importar = useCallback(
    async (files: FileList | File[]) => {
      setImportando(true)
      const resultados: ResultadoImportacion[] = []
      for (const file of Array.from(files)) {
        const r = importarLibro(file.name, await file.arrayBuffer())
        if (r.ok) {
          try {
            await storage.guardar(r.registro)
          } catch {
            resultados.push({ ok: false, archivo: file.name, error: 'Se leyó, pero no se pudo guardar en el teléfono (¿almacenamiento lleno o modo privado?).' })
            aplicar(r.registro)
            continue
          }
          aplicar(r.registro)
          setObsoletos((o) => o.filter((t) => t !== r.registro.tipo))
        }
        resultados.push(r)
      }
      if (resultados.some((r) => r.ok)) setPersistido(await storage.pedirPersistencia())
      setUltima(resultados)
      setImportando(false)
    },
    [aplicar],
  )

  const borrar = useCallback(async (tipo: Tipo) => {
    await storage.borrar(tipo)
    if (tipo === 'cuentas') setCuentas(undefined)
    else setDescuentos(undefined)
    setObsoletos((o) => o.filter((t) => t !== tipo))
  }, [])

  const value = useMemo<Estado>(
    () => ({
      cargando,
      cuentas,
      descuentos,
      obsoletos,
      persistido,
      ultimaImportacion,
      importando,
      importar,
      borrar,
      cerrarImportacion: () => setUltima(null),
    }),
    [cargando, cuentas, descuentos, obsoletos, persistido, ultimaImportacion, importando, importar, borrar],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useDatos(): Estado {
  const v = useContext(Ctx)
  if (!v) throw new Error('useDatos fuera de DataProvider')
  return v
}

/** Fecha de hoy; se actualiza si la app queda abierta pasada la medianoche o vuelve del segundo plano. */
export function useHoy() {
  const [ahora, setAhora] = useState(() => new Date())
  useEffect(() => {
    const tick = () => setAhora((prev) => (new Date().toDateString() === prev.toDateString() ? prev : new Date()))
    const id = window.setInterval(tick, 60_000)
    document.addEventListener('visibilitychange', tick)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [])
  return ahora
}
