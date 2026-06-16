import { describe, it, expect } from 'vitest'
import { presetToLoadItem } from '@/model/presets.js'

/** @typedef {import('@/db/db.js').AppliancePreset} AppliancePreset */

describe('model/presets: presetToLoadItem', () => {
  it('мапить пресет приладу у елемент навантаження', () => {
    /** @type {AppliancePreset} */
    const fridge = { id: 'fridge', name: 'Холодильник', category: 'kitchen', powerW: 150, cosPhi: 0.9, phases: 1 }
    expect(presetToLoadItem(fridge)).toEqual({ name: 'Холодильник', powerW: 150, cosPhi: 0.9 })
  })

  it('без cosPhi/quantity → лише name + powerW', () => {
    /** @type {AppliancePreset} */
    const lamp = { id: 'lamp', name: 'Лампа', category: 'lighting', powerW: 15 }
    expect(presetToLoadItem(lamp)).toEqual({ name: 'Лампа', powerW: 15 })
  })

  it('переносить кількість, якщо задана', () => {
    /** @type {AppliancePreset} */
    const p = { id: 'x', name: 'X', category: 'other', powerW: 100, quantity: 4 }
    expect(presetToLoadItem(p)).toEqual({ name: 'X', powerW: 100, quantity: 4 })
  })
})
