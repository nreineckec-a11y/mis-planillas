import { describe, expect, it } from 'vitest'
import { conEmoji, EMOJI_GENERICO, emojiTipo } from '../src/lib/descuentos/emoji'

describe('emoji por tipo de comida', () => {
  it('asigna un emoji específico a los tipos conocidos', () => {
    const tipos: [string, string][] = [
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
    ]
    expect(tipos.map(([t]) => [t, emojiTipo(t)])).toEqual(tipos)
  })

  it('tolera grafías distintas y tipos nuevos', () => {
    expect(emojiTipo('PIZZERIA')).toBe('🍕')
    expect(emojiTipo('Cocina japonesa')).toBe('🍣')
    expect(emojiTipo('Comida etíope')).toBe(EMOJI_GENERICO)
    expect(emojiTipo('')).toBe('')
    expect(conEmoji('Italiano')).toBe('🍝 Italiano')
  })
})
