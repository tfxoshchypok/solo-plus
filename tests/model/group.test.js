import { describe, it, expect } from 'vitest'
import { groupWidthModules, groupPowerW, defaultSpec } from '@/model/group.js'

/** @typedef {import('@/model/project-schema.js').Group} Group */

/** @param {import('@/model/project-schema.js').ApparatusSpec} spec @returns {Group} */
const grp = (spec) => ({ id: 'g', kind: 'group', title: 'g', spec })

describe('model/group: groupWidthModules', () => {
  it('ширина групи = ширина її апарата', () => {
    expect(groupWidthModules(grp({ device: 'rcbo', poles: 2, ratingA: 16, widthModules: 2 }))).toBe(2)
  })

  it('відсутній spec → 0', () => {
    expect(groupWidthModules(/** @type {any} */ ({}))).toBe(0)
  })
})

describe('model/group: groupPowerW', () => {
  it('сумує потужність приладів (powerW × кількість)', () => {
    const load = { items: [{ powerW: 150 }, { powerW: 1500 }, { powerW: 500, quantity: 3 }] }
    expect(groupPowerW(load)).toBe(150 + 1500 + 1500)
  })

  it('порожній/відсутній перелік → 0', () => {
    expect(groupPowerW({ items: [] })).toBe(0)
    expect(groupPowerW(undefined)).toBe(0)
  })
})

describe('model/group: defaultSpec', () => {
  it('1-фаз. автомат C16, 1 модуль', () => {
    expect(defaultSpec()).toEqual({ device: 'breaker', poles: 1, ratingA: 16, curve: 'C', widthModules: 1 })
  })
})
