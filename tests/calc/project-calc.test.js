import { describe, it, expect } from 'vitest'
import { calcProject } from '@/calc/project-calc.js'
import { defaultNorms } from '@/calc/norms.js'
import { DEFAULT_CABLE_REFS } from '@/db/cable-seed.js'

/** @typedef {import('@/model/project-schema.js').Project} Project */
/** @typedef {import('@/model/project-schema.js').Group} Group */
/** @typedef {import('@/model/project-schema.js').GroupLoad} GroupLoad */
/** @typedef {import('@/db/db.js').CableRef} CableRef */

const N = defaultNorms()
const REFS = /** @type {CableRef[]} */ ([...DEFAULT_CABLE_REFS])

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

/** Навантаження лінії з одного приладу. @param {number} powerW @param {{phases?:1|3, cosPhi?:number, loadType?:string, demandFactor?:number}} [opts] @returns {import('@/model/project-schema.js').GroupLoad} */
function ld(powerW, opts = {}) {
  /** @type {import('@/model/project-schema.js').LoadItem} */
  const item = { powerW }
  if (opts.cosPhi != null) item.cosPhi = opts.cosPhi
  /** @type {import('@/model/project-schema.js').GroupLoad} */
  const load = { items: [item] }
  if (opts.phases != null) load.phases = opts.phases
  if (opts.loadType != null) load.loadType = opts.loadType
  if (opts.demandFactor != null) load.demandFactor = opts.demandFactor
  return load
}

/** @param {Group[]} groups @param {Partial<Project['supply']>} [supply] @returns {Project} */
function proj(groups, supply) {
  return {
    schemaVersion: '1.3',
    project: { id: 'p1', name: 'test' },
    supply: { phases: 1, voltage: 230, ...supply },
    enclosure: { type: 'surface', ip: 'IP40', reserveTargetPct: 20, rows: [] },
    groups,
    placements: [],
    busbars: { neutral: { present: true }, pe: { present: true } },
  }
}

describe('calc/project-calc: calcProject', () => {
  it('рахує струм і кабель для груп-споживачів', () => {
    const r = calcProject(proj([grp('g1', 'group', ld(2000, { cosPhi: 0.95, phases: 1 }))]), N, REFS)
    expect(r.groups).toHaveLength(1)
    expect(r.groups[0].groupId).toBe('g1')
    expect(r.groups[0].isConsumer).toBe(true)
    expect(r.groups[0].currentA).toBeCloseTo(9.153, 2)
    expect(r.groups[0].cable?.status).toBe('ok')
    expect(r.groups[0].cable?.crossSectionMm2).toBe(1.5)
  })

  it('окремий ПЗВ — не споживач, без кабелю', () => {
    const r = calcProject(proj([grp('rcd', 'rcd'), grp('g1', 'group', ld(2000))]), N, REFS)
    expect(r.groups[0].isConsumer).toBe(false)
    expect(r.groups[0].cable).toBeNull()
    expect(r.groups[1].isConsumer).toBe(true)
    expect(r.groups[1].cable).not.toBeNull()
  })

  it('зберігає порядок груп як у проєкті', () => {
    const r = calcProject(proj([grp('a', 'group'), grp('b', 'group'), grp('c', 'group')]), N, REFS)
    expect(r.groups.map((g) => g.groupId)).toEqual(['a', 'b', 'c'])
  })

  it('ввідний: сума струмів споживачів + свій кабель', () => {
    const r = calcProject(
      proj([
        grp('g1', 'group', ld(2000, { cosPhi: 0.95, phases: 1 })),
        grp('g2', 'group', ld(2000, { cosPhi: 0.95, phases: 1 })),
      ]),
      N,
      REFS,
    )
    expect(r.incomer.currentA).toBeCloseTo(2 * 9.153, 2)
    expect(r.incomer.cable.status).toBe('ok')
  })

  it('фазність ввідного береться з supply.phases', () => {
    const r1 = calcProject(proj([grp('g1', 'group', ld(2000, { phases: 1 }))], { phases: 1 }), N, REFS)
    expect(r1.incomer.cable.voltageDropLimitPct).toBe(5)
    // 3-ф ввід рахує ΔU відносно лінійної напруги — перевіряємо через струм > 0
    const r3 = calcProject(proj([grp('g1', 'group', ld(5000, { phases: 3 }))], { phases: 3 }), N, REFS)
    expect(r3.incomer.currentA).toBeGreaterThan(0)
  })

  it('phaseMismatch: 3-ф група на 1-ф вводі — помилка, решта — ні', () => {
    // 3-ф група + 1-ф ввід → невідповідність
    const bad = calcProject(proj([grp('g1', 'group', ld(2000, { phases: 3 }))], { phases: 1 }), N, REFS)
    expect(bad.groups[0].phaseMismatch).toBe(true)
    // 3-ф група + 3-ф ввід → ок
    const ok3 = calcProject(proj([grp('g1', 'group', ld(2000, { phases: 3 }))], { phases: 3 }), N, REFS)
    expect(ok3.groups[0].phaseMismatch).toBe(false)
    // 1-ф група + 1-ф ввід → ок (нормальний випадок)
    const ok1 = calcProject(proj([grp('g1', 'group', ld(2000, { phases: 1 }))], { phases: 1 }), N, REFS)
    expect(ok1.groups[0].phaseMismatch).toBe(false)
    // окремий ПЗВ (не споживач) → завжди false
    const rcd = calcProject(proj([grp('rcd', 'rcd')], { phases: 1 }), N, REFS)
    expect(rcd.groups[0].phaseMismatch).toBe(false)
  })

  it('номінал ввідного: ratingA з supply.main, ratingOk за струмом', () => {
    const groups = [grp('g1', 'group', ld(2000, { phases: 1 }))] // ≈9.15 А
    const ok = calcProject(
      proj(groups, { main: { device: 'breaker', poles: 1, ratingA: 40, curve: 'C', widthModules: 1 } }),
      N,
      REFS,
    )
    expect(ok.incomer.ratingA).toBe(40)
    expect(ok.incomer.ratingOk).toBe(true)
    const over = calcProject(
      proj(groups, { main: { device: 'breaker', poles: 1, ratingA: 6, curve: 'C', widthModules: 1 } }),
      N,
      REFS,
    )
    expect(over.incomer.ratingOk).toBe(false)
    // без supply.main → ratingA null, ratingOk true
    const none = calcProject(proj(groups), N, REFS)
    expect(none.incomer.ratingA).toBeNull()
    expect(none.incomer.ratingOk).toBe(true)
  })

  it('зведена потужність проєкту: Σ груп vs допустима', () => {
    const groups = [
      grp('g1', 'group', ld(2000, { phases: 1 })),
      grp('g2', 'group', ld(3000, { phases: 1 })),
    ]
    // без допустимої → withinLimit true
    const r = calcProject(proj(groups), N, REFS)
    expect(r.power.powerW).toBe(5000)
    expect(r.power.availablePowerW).toBeNull()
    expect(r.power.withinLimit).toBe(true)
    // допустима 4000 < 5000 → перевищення
    const over = calcProject(proj(groups, { availablePowerW: 4000 }), N, REFS)
    expect(over.power.availablePowerW).toBe(4000)
    expect(over.power.withinLimit).toBe(false)
  })

  it('зведена потужність враховує коефіцієнт попиту групи', () => {
    const groups = [grp('g1', 'group', ld(4000, { phases: 1, demandFactor: 0.5 }))]
    expect(calcProject(proj(groups), N, REFS).power.powerW).toBe(2000)
  })

  it('порожній / null проєкт → порожній результат, ввідний no_load', () => {
    const empty = calcProject(proj([]), N, REFS)
    expect(empty.groups).toEqual([])
    expect(empty.incomer.currentA).toBe(0)
    expect(empty.incomer.cable.status).toBe('no_load')
    expect(calcProject(null, N, REFS).groups).toEqual([])
  })

  it('детермінований: однаковий вхід → ідентичний результат', () => {
    const p = proj([grp('g1', 'group', ld(3000, { phases: 1 }))])
    expect(calcProject(p, N, REFS)).toEqual(calcProject(p, N, REFS))
  })

  it('перераховує 60 груп швидко (бенчмарк T2.3)', () => {
    const groups = Array.from({ length: 60 }, (_, i) =>
      grp(`g${i}`, 'group', ld(1000 + i * 50, { cosPhi: 0.95, phases: i % 3 === 0 ? 3 : 1 })),
    )
    const t0 = performance.now()
    const r = calcProject(proj(groups), N, REFS)
    const ms = performance.now() - t0
    expect(r.groups).toHaveLength(60)
    expect(r.groups.every((g) => g.cable !== null)).toBe(true)
    expect(ms).toBeLessThan(2000) // чиста логіка — мікросекунди; воркер лишає UI вільним
  })
})
