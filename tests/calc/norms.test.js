import { describe, it, expect } from 'vitest'
import { toNorms, defaultNorms } from '@/calc/norms.js'
import { DEFAULT_NORMS } from '@/db/norms-seed.js'

/** @typedef {import('@/db/db.js').NormRef} NormRef */

describe('calc/norms: defaultNorms', () => {
  it('усі поля — скінченні числа', () => {
    const n = defaultNorms()
    for (const v of Object.values(n)) expect(Number.isFinite(v)).toBe(true)
  })

  it('дзеркалить значення з DEFAULT_NORMS', () => {
    const n = defaultNorms()
    expect(n.voltagePhase).toBe(230)
    expect(n.voltageLine).toBe(400)
    expect(n.cosPhiDefault).toBe(0.95)
    expect(n.resistivityCu).toBe(0.0175)
  })
})

describe('calc/norms: toNorms (чиста)', () => {
  it('повний набір записів → ті самі числа', () => {
    const n = toNorms([...DEFAULT_NORMS])
    expect(n).toEqual(defaultNorms())
  })

  it('часткові дані → відсутні поля беруть дефолт', () => {
    /** @type {NormRef[]} */
    const partial = [{ key: 'voltage.phase', category: 'voltage', value: 220 }]
    const n = toNorms(partial)
    expect(n.voltagePhase).toBe(220) // з БД
    expect(n.voltageLine).toBe(400) // дефолт
    expect(n.cosPhiDefault).toBe(0.95) // дефолт
  })

  it('порожній масив → усі дефолти', () => {
    expect(toNorms([])).toEqual(defaultNorms())
  })

  it('нечислове/зіпсоване значення → дефолт для поля', () => {
    /** @type {NormRef[]} */
    const broken = [
      { key: 'voltage.phase', category: 'voltage', value: /** @type {any} */ ('abc') },
      { key: 'resistivity.cu', category: 'resistivity', value: /** @type {any} */ (null) },
    ]
    const n = toNorms(broken)
    expect(n.voltagePhase).toBe(230)
    expect(n.resistivityCu).toBe(0.0175)
  })

  it('числовий рядок приводиться до числа', () => {
    /** @type {NormRef[]} */
    const strish = [{ key: 'cable.length.default', category: 'cable', value: /** @type {any} */ ('30') }]
    expect(toNorms(strish).cableLengthDefault).toBe(30)
  })
})
