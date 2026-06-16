import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useProjectStore } from '@/stores/project.store.js'
import { useCalcStore } from '@/stores/calc.store.js'
import { db } from '@/db/db.js'
import { seedNorms } from '@/db/norms-seed.js'
import { seedCableRefs } from '@/db/cable-seed.js'

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('stores/calc', () => {
  it('без проєкту → result null', () => {
    expect(useCalcStore().result).toBeNull()
  })

  it('рахує струм і кабель для групи (дефолтні довідники)', () => {
    const project = useProjectStore()
    const calc = useCalcStore()
    project.createNew()
    const id = project.addGroup({ kind: 'group', load: { phases: 1, items: [{ powerW: 2000, cosPhi: 0.95 }] } })
    const gc = calc.byGroupId.get(id)
    expect(gc?.isConsumer).toBe(true)
    expect(gc?.currentA).toBeCloseTo(9.153, 2)
    expect(gc?.cable?.status).toBe('ok')
    expect(gc?.cable?.crossSectionMm2).toBe(1.5)
  })

  it('зведення по ввідному = сума струмів споживачів', () => {
    const project = useProjectStore()
    const calc = useCalcStore()
    project.createNew()
    project.addGroup({ kind: 'group', load: { phases: 1, items: [{ powerW: 2000, cosPhi: 0.95 }] } })
    project.addGroup({ kind: 'group', load: { phases: 1, items: [{ powerW: 2000, cosPhi: 0.95 }] } })
    expect(calc.incomer?.currentA).toBeCloseTo(2 * 9.153, 2)
  })

  it('реактивно перераховує після зміни групи', () => {
    const project = useProjectStore()
    const calc = useCalcStore()
    project.createNew()
    const id = project.addGroup({ kind: 'group', load: { phases: 1, items: [{ powerW: 2000 }] } })
    const before = calc.byGroupId.get(id)?.currentA ?? 0
    project.updateGroup(id, { load: { phases: 1, items: [{ powerW: 4000 }] } })
    const after = calc.byGroupId.get(id)?.currentA ?? 0
    expect(after).toBeCloseTo(before * 2, 2)
  })

  it('reloadRefs підтягує норми й перерізи з Dexie', async () => {
    await db.normRefs.clear()
    await db.cableRefs.clear()
    await seedNorms()
    await seedCableRefs()
    const calc = useCalcStore()
    await calc.reloadRefs()
    expect(calc.norms.voltagePhase).toBe(230)
    expect(calc.cableRefs.length).toBeGreaterThan(0)
  })
})
