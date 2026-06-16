import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@/db/db.js'
import { seedCableRefs, DEFAULT_CABLE_REFS } from '@/db/cable-seed.js'

beforeEach(async () => {
  await db.cableRefs.clear()
})

describe('db/cable-seed: seedCableRefs', () => {
  it('заливає всі дефолти у порожню БД', async () => {
    await seedCableRefs()
    expect(await db.cableRefs.count()).toBe(DEFAULT_CABLE_REFS.length)
  })

  it('idempotent: повторний виклик не дублює', async () => {
    await seedCableRefs()
    await seedCableRefs()
    expect(await db.cableRefs.count()).toBe(DEFAULT_CABLE_REFS.length)
  })

  it('додає лише відсутні комбінації (матеріал+переріз+метод)', async () => {
    await db.cableRefs.add({ material: 'cu', crossSectionMm2: 1.5, allowableCurrentA: 16, installMethod: 'conduit' })
    await seedCableRefs()
    expect(await db.cableRefs.count()).toBe(DEFAULT_CABLE_REFS.length)
  })

  it('не чіпає чужі записи (інший матеріал/метод)', async () => {
    await db.cableRefs.add({ material: 'al', crossSectionMm2: 2.5, allowableCurrentA: 16, installMethod: 'conduit' })
    await seedCableRefs()
    expect(await db.cableRefs.count()).toBe(DEFAULT_CABLE_REFS.length + 1)
  })

  it('усі дефолти — мідь у трубі з валідними числами', async () => {
    for (const r of DEFAULT_CABLE_REFS) {
      expect(r.material).toBe('cu')
      expect(r.installMethod).toBe('conduit')
      expect(r.crossSectionMm2).toBeGreaterThan(0)
      expect(r.allowableCurrentA).toBeGreaterThan(0)
    }
  })
})
