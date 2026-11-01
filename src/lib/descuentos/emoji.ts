import { norm } from '../text'

// Emojis por subcategoría y por categoría. Se eligen por palabras clave (sin
// tildes ni mayúsculas), así un valor nuevo o escrito distinto en el Excel igual
// recibe uno razonable. El orden importa: gana la primera regla que calce.
const SUBCATEGORIAS: [RegExp, string][] = [
  [/por confirmar|sin informacion/, '❔'],
  // Comida
  [/sushi|nikkei|japones|ramen/, '🍣'],
  [/pizz/, '🍕'],
  [/italian|pasta/, '🍝'],
  [/hamburgues|burger/, '🍔'],
  [/carnicer/, '🥩'],
  [/carne|parrill|asado|steak/, '🥩'],
  [/pescado|marisco|cevich/, '🦐'],
  [/peruan/, '🍋'],
  [/mexican|tex-mex|taco/, '🌮'],
  [/arabe|kebab|shawarma|libanes/, '🥙'],
  [/asiatic|china|chino|thai|india|coreano|wok/, '🥡'],
  [/mediterran|grieg/, '🫒'],
  [/frances|crepe/, '🥐'],
  [/chilen|empanad/, '🥟'],
  [/bar\b|restobar|cerveza|pub|coctel/, '🍸'],
  [/bistro|autor/, '👨‍🍳'],
  [/buffet|tenedor libre/, '🍲'],
  [/rapida|completo|sandwich|pollo|hot ?dog/, '🌭'],
  [/saludable|bowl|vegan|vegetarian|ensalada/, '🥗'],
  [/helad/, '🍦'],
  [/pasteler|chocolat|torta|dulce|reposter/, '🍰'],
  [/cafe/, '☕'],
  [/jugo|snack|smoothie/, '🧃'],
  [/panaderi/, '🥖'],
  [/vino|licor|cerveceria/, '🍷'],
  [/gourmet|queso|deli/, '🧀'],
  [/supermerc|aliment|almacen/, '🛒'],
  [/plataforma|varios|delivery/, '🛵'],
  // Ropa y deporte
  [/infantil|bebe|nino/, '👶'],
  [/calzado|zapat/, '👟'],
  [/deporte|outdoor|running/, '🏃'],
  [/ropa|accesorio|vestuario|moda/, '👕'],
  // Hogar y tecnología
  [/juguete/, '🧸'],
  [/solar|energia/, '☀️'],
  [/cocina|electro/, '🍳'],
  [/tecnolog|computa|celular/, '💻'],
  [/hogar|deco|mueble/, '🛋️'],
  [/servicio/, '🛠️'],
  // Salud y belleza
  [/optica|lente/, '👓'],
  [/dental|clinica|medic/, '🦷'],
  [/farmacia|cuidado/, '💊'],
  [/fitness|bienestar|gimnasio|yoga/, '🧘'],
  [/belleza|cosmetic|maquilla|perfum/, '💄'],
  [/estetica|spa|peluquer|masaje/, '💆'],
  // Viajes y autos
  [/estacionamiento|parking/, '🅿️'],
  [/taller|mecanic/, '🔧'],
  [/movilidad|scooter|bicicleta/, '🛴'],
  [/arriendo de auto|rent a car|\bautos?\b/, '🚗'],
  [/equipaje|maleta/, '🧳'],
  [/hotel|alojamiento/, '🏨'],
  [/transporte|bus\b|traslado/, '🚌'],
  [/viaje|vuelo|turismo/, '✈️'],
  // Panoramas
  [/streaming/, '📺'],
  [/\bcine\b/, '🎬'],
  [/teatro|evento|concierto/, '🎭'],
  [/entreten|panorama|juego/, '🎉'],
  // Otros
  [/mascota|veterinari/, '🐾'],
  [/idioma/, '🗣️'],
  [/curso|preuniversitario|educac/, '🎓'],
  [/librer|libro/, '📚'],
  [/\bgas\b/, '🔥'],
  [/bencina|combustible/, '⛽'],
]

const CATEGORIAS: [RegExp, string][] = [
  [/restaur/, '🍽️'],
  [/delivery/, '🛵'],
  [/cafe|helad|pasteler/, '☕'],
  [/supermerc|vino|gourmet|aliment/, '🛒'],
  [/ropa|calzado|vestuario/, '👕'],
  [/hogar|tecnolog/, '🏠'],
  [/salud|belleza|bienestar/, '💆'],
  [/viaje|auto|estacionamiento/, '✈️'],
  [/panorama|entreten|cultura/, '🎭'],
  [/mascota/, '🐾'],
  [/educac|librer/, '📚'],
  [/bencina|gas|combustible/, '⛽'],
]

export const EMOJI_GENERICO = '🏷️'

function buscar(reglas: [RegExp, string][], valor: string): string {
  const t = norm(valor)
  if (!t) return ''
  return reglas.find(([re]) => re.test(t))?.[1] ?? EMOJI_GENERICO
}

export const emojiTipo = (tipo: string) => buscar(SUBCATEGORIAS, tipo)
export const emojiCategoria = (cat: string) => buscar(CATEGORIAS, cat)

/** "🍕 Pizzería" (o el texto solo si viene vacío). */
export function conEmoji(tipo: string): string {
  const e = emojiTipo(tipo)
  return e ? `${e} ${tipo}` : tipo
}

export function conEmojiCategoria(cat: string): string {
  const e = emojiCategoria(cat)
  return e ? `${e} ${cat}` : cat
}
