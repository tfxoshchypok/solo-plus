import { describe, it, expect } from 'vitest'
import { MODULE_PX, moduleToX, xToModule, widthToPx } from '@/editor/geometry.js'
import { MODULE_WIDTH_MM } from '@/model/project-schema.js'

describe('geometry: модулі ↔ пікселі', () => {
  it('MODULE_WIDTH_MM дорівнює стандарту DIN 17,5 мм', () => {
    expect(MODULE_WIDTH_MM).toBe(17.5)
  })

  it('moduleToX лінійний від стартового слота', () => {
    expect(moduleToX(0)).toBe(0)
    expect(moduleToX(3)).toBe(3 * MODULE_PX)
  })

  it('xToModule примагнічує до найближчого слота', () => {
    expect(xToModule(0)).toBe(0)
    expect(xToModule(MODULE_PX * 2 + 1)).toBe(2)
    expect(xToModule(MODULE_PX * 2 + MODULE_PX * 0.6)).toBe(3)
  })

  it('xToModule(moduleToX(n)) === n (кругова стійкість)', () => {
    for (const n of [0, 1, 4, 12, 18]) {
      expect(xToModule(moduleToX(n))).toBe(n)
    }
  })

  it('widthToPx масштабує ширину в модулях', () => {
    expect(widthToPx(1)).toBe(MODULE_PX)
    expect(widthToPx(4)).toBe(4 * MODULE_PX)
  })
})
