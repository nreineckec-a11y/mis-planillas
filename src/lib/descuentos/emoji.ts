import { norm } from '../text'

// Emoji por tipo de comida. Se elige por palabras clave (sin tildes ni mayúsculas),
// así un tipo nuevo o escrito distinto en el Excel igual recibe un emoji razonable.
// El orden importa: gana la primera regla que calce.
const REGLAS: [RegExp, string][] = [
  [/por confirmar|sin informacion/, '❔'],
  [/sushi|nikkei|japones|ramen/, '🍣'],
  [/pizz/, '🍕'],
  [/italian|pasta/, '🍝'],
  [/hamburgues|burger/, '🍔'],
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
  [/bistro|autor|gourmet/, '👨‍🍳'],
  [/buffet|tenedor libre/, '🍲'],
  [/rapida|completo|sandwich|pollo|hot ?dog/, '🌭'],
  [/saludable|bowl|vegan|vegetarian|ensalada/, '🥗'],
  [/helad/, '🍦'],
  [/pasteler|chocolat|torta|dulce|reposter/, '🍰'],
  [/cafe/, '☕'],
  [/jugo|snack|smoothie/, '🧃'],
  [/panaderi/, '🥖'],
  [/plataforma|varios|delivery/, '🛵'],
]

export const EMOJI_GENERICO = '🍽️'

export function emojiTipo(tipo: string): string {
  const t = norm(tipo)
  if (!t) return ''
  return REGLAS.find(([re]) => re.test(t))?.[1] ?? EMOJI_GENERICO
}

/** "🍕 Pizzería" (o el texto solo si viene vacío). */
export function conEmoji(tipo: string): string {
  const e = emojiTipo(tipo)
  return e ? `${e} ${tipo}` : tipo
}
