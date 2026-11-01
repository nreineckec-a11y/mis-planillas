// Persistencia local en IndexedDB. Nada sale del dispositivo.
import type { Registro, Tipo } from './model'
import { SIN_CAMBIOS, type CambiosTrabajo } from './cuentas/cambios'

const DB = 'mis-planillas'
const STORE = 'registros'

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open()
  try {
    return await new Promise<T>((resolve, reject) => {
      const t = db.transaction(STORE, mode)
      const req = fn(t.objectStore(STORE))
      t.oncomplete = () => resolve(req.result)
      t.onerror = () => reject(t.error)
      t.onabort = () => reject(t.error)
    })
  } finally {
    db.close()
  }
}

export const guardar = (r: Registro) => tx('readwrite', (s) => s.put(r, r.tipo))
export const leer = (tipo: Tipo) => tx<Registro | undefined>('readonly', (s) => s.get(tipo))
export const borrar = async (tipo: Tipo) => {
  await tx('readwrite', (s) => s.delete(tipo))
  await tx('readwrite', (s) => s.delete(`archivo-${tipo}`))
}

/** Copia del Excel original, para volver a leerlo cuando la app aprenda a leer algo nuevo. */
export interface ArchivoGuardado {
  archivo: string
  fechaCarga: string
  datos: ArrayBuffer
}
export const guardarArchivo = (tipo: Tipo, a: ArchivoGuardado) => tx('readwrite', (s) => s.put(a, `archivo-${tipo}`))
export const leerArchivo = (tipo: Tipo) => tx<ArchivoGuardado | undefined>('readonly', (s) => s.get(`archivo-${tipo}`))

// Cambios hechos en la app (turnos agregados, marcas de pago): sobreviven a cargar un Excel nuevo.
const CLAVE_CAMBIOS = 'cambios-trabajo'
export const guardarCambios = (c: CambiosTrabajo) => tx('readwrite', (s) => s.put(c, CLAVE_CAMBIOS))
export async function leerCambios(): Promise<CambiosTrabajo> {
  const c = await tx<CambiosTrabajo | undefined>('readonly', (s) => s.get(CLAVE_CAMBIOS))
  return { ...SIN_CAMBIOS, ...c }
}

/** Pide al navegador no borrar los datos (importante en iOS). */
export async function pedirPersistencia(): Promise<boolean | null> {
  if (!navigator.storage?.persist) return null
  try {
    return (await navigator.storage.persisted()) || (await navigator.storage.persist())
  } catch {
    return null
  }
}

export async function estaPersistido(): Promise<boolean | null> {
  if (!navigator.storage?.persisted) return null
  try {
    return await navigator.storage.persisted()
  } catch {
    return null
  }
}

/** Preferencias menores (filtros recordados). Tolerante a almacenamiento bloqueado. */
export function prefLeer<T>(clave: string, porDefecto: T): T {
  try {
    const v = localStorage.getItem(`mp:${clave}`)
    return v === null ? porDefecto : (JSON.parse(v) as T)
  } catch {
    return porDefecto
  }
}

export function prefGuardar(clave: string, valor: unknown): void {
  try {
    localStorage.setItem(`mp:${clave}`, JSON.stringify(valor))
  } catch {
    /* sin almacenamiento: no se recuerda */
  }
}
