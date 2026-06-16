import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@/db/db.js'
import { DEFAULT_CABLE_REFS } from '@/db/cable-seed.js'
import {
  listCableRefs,
  addCableRef,
  updateCableRef,
  removeCableRef,
  resetCableRefs,
} from '@/db/cables.js'

beforeEach(async () => {
  await db.cableRefs.clear()
})

describe('db/cables: CRUD', () => {
  it('addCableRef повертає id і зберігає запис', async () => {
    const id = await addCableRef({ material: 'cu', crossSectionMm2: 35, allowableCurrentA: 95, installMethod: 'conduit' })
    expect(typeof id).toBe('number')
    const all = await listCableRefs()
    expect(all).toHaveLength(1)
    expect(all[0].crossSectionMm2).toBe(35)
  })

  it('updateCableRef патчить поля за id', async () => {
    const id = await addCableRef({ material: 'cu', crossSectionMm2: 4, allowableCurrentA: 27, installMethod: 'conduit' })
    await updateCableRef(id, { allowableCurrentA: 30, material: 'al' })
    const rec = await db.cableRefs.get(id)
    expect(rec?.allowableCurrentA).toBe(30)
    expect(rec?.material).toBe('al')
    expect(rec?.crossSectionMm2).toBe(4) // не змінилось
  })

  it('removeCableRef видаляє запис', async () => {
    const id = await addCableRef({ material: 'cu', crossSectionMm2: 6, allowableCurrentA: 34, installMethod: 'conduit' })
    await removeCableRef(id)
    expect(await db.cableRefs.count()).toBe(0)
  })

  it('listCableRefs повертає всі записи', async () => {
    await addCableRef({ material: 'cu', crossSectionMm2: 1.5, allowableCurrentA: 16, installMethod: 'conduit' })
    await addCableRef({ material: 'al', crossSectionMm2: 2.5, allowableCurrentA: 16, installMethod: 'conduit' })
    expect(await listCableRefs()).toHaveLength(2)
  })

  it('resetCableRefs очищає й заливає типові', async () => {
    await addCableRef({ material: 'al', crossSectionMm2: 999, allowableCurrentA: 1, installMethod: 'x' })
    await resetCableRefs()
    const all = await listCableRefs()
    expect(all).toHaveLength(DEFAULT_CABLE_REFS.length)
    expect(all.every((r) => r.material === 'cu')).toBe(true)
  })
})
