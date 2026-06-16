import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@/db/db.js'
import { seedNorms, DEFAULT_NORMS } from '@/db/norms-seed.js'
import { listNorms, getNorm, setNorm, resetNorms } from '@/db/norms.js'

beforeEach(async () => {
  await db.normRefs.clear()
})

describe('db/norms-seed: seedNorms', () => {
  it('заливає всі дефолти у порожню БД', async () => {
    await seedNorms()
    expect(await db.normRefs.count()).toBe(DEFAULT_NORMS.length)
  })

  it('idempotent: повторний виклик не дублює', async () => {
    await seedNorms()
    await seedNorms()
    expect(await db.normRefs.count()).toBe(DEFAULT_NORMS.length)
  })

  it('не перетирає змінене користувачем значення', async () => {
    await seedNorms()
    await setNorm('voltage.phase', 220)
    await seedNorms() // повторний seed
    expect((await getNorm('voltage.phase'))?.value).toBe(220)
  })

  it('додає лише відсутні ключі', async () => {
    await db.normRefs.add({ key: 'voltage.phase', category: 'voltage', value: 230 })
    await seedNorms()
    expect(await db.normRefs.count()).toBe(DEFAULT_NORMS.length)
  })
})

describe('db/norms: CRUD', () => {
  it('setNorm створює запис із category/description з дефолтів', async () => {
    await setNorm('cable.length.default', 25)
    const rec = await getNorm('cable.length.default')
    expect(rec?.value).toBe(25)
    expect(rec?.category).toBe('cable')
    expect(rec?.description).toBeTruthy()
  })

  it('setNorm зберігає наявні метадані запису', async () => {
    await db.normRefs.add({ key: 'voltage.phase', category: 'voltage', value: 230, description: 'custom' })
    await setNorm('voltage.phase', 240)
    const rec = await getNorm('voltage.phase')
    expect(rec?.value).toBe(240)
    expect(rec?.description).toBe('custom')
  })

  it('listNorms повертає всі записи', async () => {
    await seedNorms()
    const all = await listNorms()
    expect(all).toHaveLength(DEFAULT_NORMS.length)
  })

  it('resetNorms повертає таблицю до дефолтів', async () => {
    await seedNorms()
    await setNorm('voltage.phase', 999)
    await resetNorms()
    expect(await db.normRefs.count()).toBe(DEFAULT_NORMS.length)
    expect((await getNorm('voltage.phase'))?.value).toBe(230)
  })
})
