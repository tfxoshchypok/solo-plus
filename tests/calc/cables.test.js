import { describe, it, expect } from 'vitest'
import { voltageDropPct, selectCable, cableForGroup } from '@/calc/cables.js'
import { defaultNorms } from '@/calc/norms.js'
import { DEFAULT_CABLE_REFS } from '@/db/cable-seed.js'

/** @typedef {import('@/model/project-schema.js').Group} Group */
/** @typedef {import('@/model/project-schema.js').GroupLoad} GroupLoad */
/** @typedef {import('@/db/db.js').CableRef} CableRef */

const N = defaultNorms() // 230/400 В, ρ_cu 0.0175, L 20 м, запас 1.0, ΔU 5%/3%
const REFS = /** @type {CableRef[]} */ ([...DEFAULT_CABLE_REFS]) // мідь у трубі 1.5…25

/** @param {string} id @param {Group['kind']} kind @param {GroupLoad} [load] @returns {Group} */
function grp(id, kind, load) {
  /** @type {Group} */
  const g = {
    id,
    kind,
    title: id,
    spec: { device: 'breaker', poles: 1, ratingA: 16, curve: 'C', widthModules: 1 },
  }
  if (load) g.load = load
  return g
}

describe('calc/cables: voltageDropPct', () => {
  it('1-фаза: 16 А, 2.5 мм², 20 м, мідь → ≈1.95%', () => {
    // 2·16·20·0.0175/2.5 = 4.48 В; 4.48/230·100
    expect(voltageDropPct(16, 2.5, 1, 'cu', N)).toBeCloseTo(1.948, 2)
  })

  it('3-фази: 30 А, 6 мм² → відносно лінійної 400 В', () => {
    // √3·30·20·0.0175/6 = 3.031 В; /400·100
    expect(voltageDropPct(30, 6, 3, 'cu', N)).toBeCloseTo(0.758, 2)
  })

  it('обернено пропорційна перерізу', () => {
    expect(voltageDropPct(16, 1.5, 1, 'cu', N)).toBeCloseTo(voltageDropPct(16, 3, 1, 'cu', N) * 2, 4)
  })

  it('нульовий струм/переріз → 0', () => {
    expect(voltageDropPct(0, 2.5, 1, 'cu', N)).toBe(0)
    expect(voltageDropPct(16, 0, 1, 'cu', N)).toBe(0)
  })
})

describe('calc/cables: selectCable', () => {
  it('бере найменший переріз, що проходить струм і ΔU', () => {
    const r = selectCable(16, { phases: 1 }, REFS, N)
    expect(r.status).toBe('ok')
    expect(r.crossSectionMm2).toBe(1.5) // допустимий 16 ≥ 16, ΔU 3.25% ≤ 5%
    expect(r.ampacityOk).toBe(true)
    expect(r.withinLimit).toBe(true)
  })

  it('освітлення (ліміт 3%) піднімає переріз через ΔU', () => {
    // 1.5 мм² дало б ΔU 3.25% > 3% → переходимо на 2.5 мм²
    const r = selectCable(16, { phases: 1, loadType: 'lighting' }, REFS, N)
    expect(r.status).toBe('ok')
    expect(r.crossSectionMm2).toBe(2.5)
    expect(r.voltageDropLimitPct).toBe(3)
  })

  it('запас по струму піднімає переріз', () => {
    const n125 = { ...N, cableReserveFactor: 1.25 } // 16 А → розрахунковий 20 А
    const r = selectCable(16, { phases: 1 }, REFS, n125)
    expect(r.designCurrentA).toBeCloseTo(20, 5)
    expect(r.crossSectionMm2).toBe(2.5) // 1.5(16А) не тягне 20 А, 2.5(21А) тягне
  })

  it('3-фазний підбір', () => {
    const r = selectCable(30, { phases: 3 }, REFS, N)
    expect(r.status).toBe('ok')
    expect(r.crossSectionMm2).toBe(6) // 4(27А) не тягне 30, 6(34А) тягне
  })

  it('завеликий струм → overcurrent на найбільшому перерізі', () => {
    const r = selectCable(100, { phases: 1 }, REFS, N)
    expect(r.status).toBe('overcurrent')
    expect(r.crossSectionMm2).toBe(25) // найбільший наявний
    expect(r.ampacityOk).toBe(false)
  })

  it('нульовий струм → no_load, без перерізу', () => {
    const r = selectCable(0, { phases: 1 }, REFS, N)
    expect(r.status).toBe('no_load')
    expect(r.ref).toBeNull()
  })

  it('порожній довідник → no_cable', () => {
    const r = selectCable(16, { phases: 1 }, [], N)
    expect(r.status).toBe('no_cable')
    expect(r.ref).toBeNull()
  })

  it('фільтрує за матеріалом (немає алюмінію → no_cable)', () => {
    const r = selectCable(16, { phases: 1, material: 'al' }, REFS, N)
    expect(r.status).toBe('no_cable')
  })

  it('реагує на змінений ліміт ΔU у нормативах', () => {
    // дуже жорсткий ліміт 1% → 1.5 мм² (3.25%) не проходить, бере 4 мм² (1.22%)
    const nStrict = { ...N, voltageDropMaxPct: 1.5 }
    const r = selectCable(16, { phases: 1 }, REFS, nStrict)
    expect(r.crossSectionMm2).toBe(4)
  })
})

describe('calc/cables: cableForGroup', () => {
  it('рахує струм групи й підбирає переріз', () => {
    // 2 кВт, cosφ 0.95, 1-фаза → ≈9.15 А → найменший 1.5 мм²
    const g = grp('g1', 'group', { phases: 1, items: [{ powerW: 2000, cosPhi: 0.95 }] })
    const r = cableForGroup(g, REFS, N)
    expect(r.status).toBe('ok')
    expect(r.crossSectionMm2).toBe(1.5)
  })

  it('група без навантаження → no_load', () => {
    const r = cableForGroup(grp('g0', 'group'), REFS, N)
    expect(r.status).toBe('no_load')
  })

  it('тип навантаження lighting звужує ліміт ΔU', () => {
    const g = grp('lt', 'group', { phases: 1, loadType: 'lighting', items: [{ powerW: 3200, cosPhi: 0.95 }] })
    const r = cableForGroup(g, REFS, N)
    expect(r.voltageDropLimitPct).toBe(3)
  })
})
