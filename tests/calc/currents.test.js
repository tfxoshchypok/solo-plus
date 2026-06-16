import { describe, it, expect } from 'vitest'
import { groupCurrentA, incomerCurrentA, groupCurrents } from '@/calc/currents.js'
import { defaultNorms } from '@/calc/norms.js'

/** @typedef {import('@/model/project-schema.js').Group} Group */
/** @typedef {import('@/model/project-schema.js').GroupLoad} GroupLoad */
/** @typedef {import('@/model/project-schema.js').LoadItem} LoadItem */

const N = defaultNorms() // 230/400 В, cosφ 0.95, demand 1.0

/** Навантаження лінії з переліку приладів. @param {1|3|undefined} phases @param {LoadItem[]} items @param {Partial<GroupLoad>} [extra] @returns {GroupLoad} */
function ld(phases, items, extra = {}) {
  return { items, ...(phases != null ? { phases } : {}), ...extra }
}

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

describe('calc/currents: groupCurrentA', () => {
  it('1-фаза: 2 кВт, cosφ=0.95, 230 В → ≈9.15 А', () => {
    expect(groupCurrentA(ld(1, [{ powerW: 2000, cosPhi: 0.95 }]), N)).toBeCloseTo(9.153, 2)
  })

  it('3-фази: 10 кВт, cosφ=0.9, 400 В → ≈16.04 А', () => {
    expect(groupCurrentA(ld(3, [{ powerW: 10000, cosPhi: 0.9 }]), N)).toBeCloseTo(16.037, 2)
  })

  it('cosφ за замовчуванням, коли не задано', () => {
    expect(groupCurrentA(ld(1, [{ powerW: 2000 }]), N)).toBeCloseTo(9.153, 2)
  })

  it('без phases вважається 1-фазним', () => {
    expect(groupCurrentA(ld(undefined, [{ powerW: 2000 }]), N)).toBeCloseTo(9.153, 2)
  })

  it('сумує кілька приладів на лінії', () => {
    // 2000 + 2000 Вт при cosφ дефолт → 2× струм
    expect(groupCurrentA(ld(1, [{ powerW: 2000 }, { powerW: 2000 }]), N)).toBeCloseTo(2 * 9.153, 2)
  })

  it('враховує кількість приладів (quantity)', () => {
    expect(groupCurrentA(ld(1, [{ powerW: 1000, quantity: 4 }]), N)).toBeCloseTo(4000 / (230 * 0.95), 2)
  })

  it('порожній/відсутній перелік приладів → 0', () => {
    expect(groupCurrentA(ld(1, []), N)).toBe(0)
    expect(groupCurrentA(undefined, N)).toBe(0)
  })

  it('прилад з нульовою/відʼємною потужністю не дає струму', () => {
    expect(groupCurrentA(ld(1, [{ powerW: 0 }, { powerW: -100 }]), N)).toBe(0)
  })

  it('некоректний cosφ приладу (0) → береться дефолт', () => {
    expect(groupCurrentA(ld(1, [{ powerW: 2000, cosPhi: 0 }]), N)).toBeCloseTo(9.153, 2)
  })

  it('реагує на змінені нормативи (напруга)', () => {
    const n220 = { ...N, voltagePhase: 220 }
    expect(groupCurrentA(ld(1, [{ powerW: 2000, cosPhi: 1 }]), n220)).toBeCloseTo(2000 / 220, 4)
  })
})

describe('calc/currents: incomerCurrentA', () => {
  it('сумує струми груп-споживачів', () => {
    const groups = [
      grp('g1', 'group', ld(1, [{ powerW: 2000, cosPhi: 0.95 }])),
      grp('g2', 'group', ld(1, [{ powerW: 2000, cosPhi: 0.95 }])),
    ]
    expect(incomerCurrentA(groups, N)).toBeCloseTo(2 * 9.153, 2)
  })

  it('окремий ПЗВ не входить у суму (захисний апарат без навантаження)', () => {
    const groups = [
      grp('rcd', 'rcd', ld(1, [{ powerW: 9999 }])),
      grp('g1', 'group', ld(1, [{ powerW: 2000, cosPhi: 0.95 }])),
    ]
    expect(incomerCurrentA(groups, N)).toBeCloseTo(9.153, 2)
  })

  it('застосовує коефіцієнт попиту групи', () => {
    const groups = [grp('g1', 'group', ld(1, [{ powerW: 2000, cosPhi: 0.95 }], { demandFactor: 0.5 }))]
    expect(incomerCurrentA(groups, N)).toBeCloseTo(9.153 * 0.5, 2)
  })

  it('порожній перелік → 0', () => {
    expect(incomerCurrentA([], N)).toBe(0)
  })
})

describe('calc/currents: groupCurrents', () => {
  it('повертає по запису на групу-споживача', () => {
    const groups = [
      grp('rcd', 'rcd'),
      grp('g1', 'group', ld(1, [{ powerW: 2000, cosPhi: 0.95 }])),
      grp('g2', 'group', ld(1, [{ powerW: 4000, cosPhi: 0.95 }])),
    ]
    const res = groupCurrents(groups, N)
    expect(res.map((r) => r.groupId)).toEqual(['g1', 'g2'])
    expect(res[0].currentA).toBeCloseTo(9.153, 2)
    expect(res[1].currentA).toBeCloseTo(18.306, 2)
  })
})
