import type { Ymd } from './dates'

export type Tipo = 'cuentas' | 'descuentos'

export interface Advertencia {
  donde: string
  mensaje: string
}

// ---------- Cuentas ----------

export type Direccion = 'me_debe' | 'yo_debo'

export interface ItemPersonal {
  fila: number
  concepto: string
  persona: string
  direccion: Direccion | null
  monto: number
  pagado: boolean
}

export interface DatosPersonal {
  items: ItemPersonal[]
  personas: string[]
}

export type EstadoHE = 'Pagado' | 'No pagado' | 'Programado'

export interface FilaHorasExtra {
  fila: number
  mes: string
  fecha: string
  detalle: string
  horas: number
  recargo: 25 | 50 | null
  estado: EstadoHE | null
  estadoRaw: string
  liquidacion: string
  observaciones: string
}

export interface Parametros {
  valorHora: number | null
  factor25: number | null
  factor50: number | null
}

export interface HojaHorasExtra extends Parametros {
  hoja: string
  anio: string | null
  filas: FilaHorasExtra[]
}

export interface FilaCompensatoria {
  fila: number
  fecha: Ymd
  detalle: string
  horasTrabajadas: number
  recargo: 25 | 50 | null
  horasTomadas: number
  observaciones: string
}

export interface HojaCompensatorias extends Parametros {
  hoja: string
  anio: string | null
  filas: FilaCompensatoria[]
}

export interface DatosCuentas {
  personal: DatosPersonal | null
  horasExtra: HojaHorasExtra[]
  compensatorias: HojaCompensatorias[]
}

// ---------- Descuentos ----------

/** 0 = lunes … 6 = domingo. */
export type DiaDcto = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 'todos' | 'especificas'

export interface Descuento {
  id: number
  fila: number
  dia: DiaDcto
  fechaEspecifica: string
  /** Fechas parseadas de "Fecha específica"; null si no se pudo interpretar. */
  fechas: Ymd[] | null
  pct: number | null
  montoFijo: number | null
  tope: number | null
  tipoTope: string
  tarjeta: string
  comercio: string
  categoria: string
  categoriaGrupo: string
  /** "Tipo de restaurante" (Pizzería, Italiano…); '' si no viene. */
  tipo: string
  comuna: string
  zona: string
  canal: string
  tarjetasAplican: string
  vigencia: string
  condiciones: string
  verificacion: string
  fuente: string | null
  noVerificado: boolean
}

export interface DatosDescuentos {
  titulo: string | null
  periodo: { y: number; m: number } | null
  items: Descuento[]
}

// ---------- Almacenamiento ----------

export const SCHEMA = 1

interface RegistroBase {
  schema: number
  archivo: string
  fechaCarga: string
  filas: number
  advertencias: Advertencia[]
}

export interface RegistroCuentas extends RegistroBase {
  tipo: 'cuentas'
  datos: DatosCuentas
}

export interface RegistroDescuentos extends RegistroBase {
  tipo: 'descuentos'
  datos: DatosDescuentos
}

export type Registro = RegistroCuentas | RegistroDescuentos
