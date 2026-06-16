import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@/db/db.js'
import { DEFAULT_APPLIANCE_PRESETS, seedAppliancePresets } from '@/db/appliance-presets-seed.js'
import {
  listAppliancePresets,
  putAppliancePreset,
  updateAppliancePreset,
  removeAppliancePreset,
  resetAppliancePresets,
} from '@/db/appliance-presets.js'

/** @typedef {import('@/db/db.js').AppliancePreset} AppliancePreset */

/** @type {AppliancePreset} */
const sample = { id: 'test-1', name: 'Тест', category: 'kitchen', powerW: 1500, cosPhi: 1, phases: 1 }

beforeEach(async () => {
  await db.appliancePresets.clear()
})

describe('db/appliance-presets: seed', () => {
  it('seedAppliancePresets заливає типові прилади', async () => {
    await seedAppliancePresets()
    expect(await db.appliancePresets.count()).toBe(DEFAULT_APPLIANCE_PRESETS.length)
  })

  it('seedAppliancePresets ідемпотентний — додає лише відсутні id', async () => {
    await seedAppliancePresets()
    await db.appliancePresets.delete(DEFAULT_APPLIANCE_PRESETS[0].id)
    await seedAppliancePresets()
    expect(await db.appliancePresets.count()).toBe(DEFAULT_APPLIANCE_PRESETS.length)
  })

  it('seedAppliancePresets не перетирає відредаговані значення наявних id', async () => {
    await seedAppliancePresets()
    await updateAppliancePreset(DEFAULT_APPLIANCE_PRESETS[0].id, { powerW: 9999 })
    await seedAppliancePresets()
    const rec = await db.appliancePresets.get(DEFAULT_APPLIANCE_PRESETS[0].id)
    expect(rec?.powerW).toBe(9999)
  })
})

describe('db/appliance-presets: CRUD', () => {
  it('putAppliancePreset додає і повертає id', async () => {
    const id = await putAppliancePreset(sample)
    expect(id).toBe('test-1')
    expect(await db.appliancePresets.count()).toBe(1)
  })

  it('putAppliancePreset перезаписує наявний id', async () => {
    await putAppliancePreset(sample)
    await putAppliancePreset({ ...sample, powerW: 2000 })
    const rec = await db.appliancePresets.get('test-1')
    expect(rec?.powerW).toBe(2000)
    expect(await db.appliancePresets.count()).toBe(1)
  })

  it('updateAppliancePreset патчить поля за id', async () => {
    await putAppliancePreset(sample)
    await updateAppliancePreset('test-1', { cosPhi: 0.8 })
    const rec = await db.appliancePresets.get('test-1')
    expect(rec?.cosPhi).toBe(0.8)
    expect(rec?.powerW).toBe(1500) // не змінилось
  })

  it('removeAppliancePreset видаляє запис', async () => {
    await putAppliancePreset(sample)
    await removeAppliancePreset('test-1')
    expect(await db.appliancePresets.count()).toBe(0)
  })

  it('listAppliancePresets сортує за категорією, потім назвою', async () => {
    await putAppliancePreset({ ...sample, id: 'b', name: 'Б', category: 'lighting' })
    await putAppliancePreset({ ...sample, id: 'a', name: 'А', category: 'appliance' })
    const list = await listAppliancePresets()
    expect(list.map((p) => p.id)).toEqual(['a', 'b'])
  })

  it('resetAppliancePresets очищає й заливає типові', async () => {
    await putAppliancePreset({ ...sample, id: 'custom', name: 'Своє' })
    await resetAppliancePresets()
    const list = await listAppliancePresets()
    expect(list).toHaveLength(DEFAULT_APPLIANCE_PRESETS.length)
    expect(list.find((p) => p.id === 'custom')).toBeUndefined()
  })
})
