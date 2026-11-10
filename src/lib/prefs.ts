import { useSyncExternalStore } from 'react'
import { prefGuardar, prefLeer } from './storage'

// Preferencia "Mostrar fotos", compartida entre pantallas (Ajustes la cambia, Descuentos la lee).
const oyentes = new Set<() => void>()
let fotos = prefLeer<boolean>('fotos', true)

export function useMostrarFotos(): [boolean, (v: boolean) => void] {
  const valor = useSyncExternalStore(
    (cb) => {
      oyentes.add(cb)
      return () => oyentes.delete(cb)
    },
    () => fotos,
  )
  return [
    valor,
    (v) => {
      fotos = v
      prefGuardar('fotos', v)
      oyentes.forEach((cb) => cb())
    },
  ]
}
