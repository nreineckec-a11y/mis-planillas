import { describe, expect, it } from 'vitest'
import { conEmoji, conEmojiCategoria, EMOJI_GENERICO, emojiCategoria, emojiTipo } from '../src/lib/descuentos/emoji'

describe('emoji por subcategoría', () => {
  it('asigna un emoji específico a cada subcategoría conocida', () => {
    const tipos: [string, string][] = [
      // Comida
      ['Árabe y kebab', '🥙'],
      ['Asiático (china, thai, india)', '🥡'],
      ['Bar y restobar', '🍸'],
      ['Bistró y cocina de autor', '👨‍🍳'],
      ['Buffet', '🍲'],
      ['Cafetería', '☕'],
      ['Carnes y parrilla', '🥩'],
      ['Chileno', '🥟'],
      ['Comida rápida (completos, sándwiches, pollo)', '🌭'],
      ['Francés', '🥐'],
      ['Hamburguesas', '🍔'],
      ['Heladería', '🍦'],
      ['Italiano', '🍝'],
      ['Mediterráneo', '🫒'],
      ['Mexicano y tex-mex', '🌮'],
      ['Pastelería y chocolatería', '🍰'],
      ['Peruano', '🍋'],
      ['Pescados y mariscos', '🦐'],
      ['Pizzería', '🍕'],
      ['Saludable y bowls', '🥗'],
      ['Snacks y jugos', '🧃'],
      ['Sushi y nikkei', '🍣'],
      ['Varios (plataforma)', '🛵'],
      ['Por confirmar', '❔'],
      // Supermercado
      ['Carnicería y pescadería', '🥩'],
      ['Supermercado y alimentos', '🛒'],
      ['Gourmet', '🧀'],
      ['Vinos', '🍷'],
      // Ropa
      ['Ropa y accesorios', '👕'],
      ['Deporte y outdoor', '🏃'],
      ['Calzado', '👟'],
      ['Ropa infantil', '👶'],
      // Hogar
      ['Hogar y deco', '🛋️'],
      ['Cocina y electro', '🍳'],
      ['Servicios', '🛠️'],
      ['Tecnología', '💻'],
      ['Juguetes', '🧸'],
      ['Energía solar', '☀️'],
      // Salud
      ['Estética', '💆'],
      ['Belleza y cosmética', '💄'],
      ['Óptica', '👓'],
      ['Clínicas y dental', '🦷'],
      ['Farmacia y cuidado', '💊'],
      ['Bienestar y fitness', '🧘'],
      // Viajes y autos
      ['Estacionamiento', '🅿️'],
      ['Arriendo de autos', '🚗'],
      ['Viajes y equipaje', '🧳'],
      ['Viajes y hoteles', '🏨'],
      ['Transporte', '🚌'],
      ['Taller y autos', '🔧'],
      ['Movilidad eléctrica', '🛴'],
      // Panoramas, mascotas, educación, bencina
      ['Entretención', '🎉'],
      ['Teatro y eventos', '🎭'],
      ['Streaming', '📺'],
      ['Cine', '🎬'],
      ['Tienda de mascotas', '🐾'],
      ['Idiomas y cursos', '🗣️'],
      ['Cursos y preuniversitario', '🎓'],
      ['Librería', '📚'],
      ['Gas', '🔥'],
      ['Bencina', '⛽'],
    ]
    expect(tipos.map(([t]) => [t, emojiTipo(t)])).toEqual(tipos)
  })

  it('tolera grafías distintas y valores nuevos', () => {
    expect(emojiTipo('PIZZERIA')).toBe('🍕')
    expect(emojiTipo('Cocina japonesa')).toBe('🍣')
    expect(emojiTipo('Comida etíope')).toBe(EMOJI_GENERICO)
    expect(emojiTipo('')).toBe('')
    expect(conEmoji('Italiano')).toBe('🍝 Italiano')
  })
})

describe('emoji por categoría', () => {
  it('asigna un emoji a cada categoría', () => {
    const cats: [string, string][] = [
      ['Restaurantes', '🍽️'],
      ['Delivery', '🛵'],
      ['Cafés, heladerías y pastelerías', '☕'],
      ['Supermercado, vinos y gourmet', '🛒'],
      ['Ropa, calzado y deporte', '👕'],
      ['Hogar, tecnología y servicios', '🏠'],
      ['Salud, belleza y bienestar', '💆'],
      ['Viajes, autos y estacionamientos', '✈️'],
      ['Panoramas y entretención', '🎭'],
      ['Mascotas', '🐾'],
      ['Educación y librerías', '📚'],
      ['Bencina y gas', '⛽'],
    ]
    expect(cats.map(([c]) => [c, emojiCategoria(c)])).toEqual(cats)
    expect(conEmojiCategoria('Restaurantes')).toBe('🍽️ Restaurantes')
  })
})
