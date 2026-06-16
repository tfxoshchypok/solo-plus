import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@/db/db.js'
import {
  addRecent,
  listRecent,
  removeRecent,
  clearRecent,
  sortByOpenedDesc,
  RECENT_LIMIT,
} from '@/db/recent.js'

beforeEach(async () => {
  await clearRecent()
})

describe('db/recent: sortByOpenedDesc (чиста)', () => {
  it('сортує за openedAt спадно', () => {
    const sorted = sortByOpenedDesc([
      { id: 'a', name: 'A', filePath: '/a', openedAt: '2026-01-01T00:00:00Z' },
      { id: 'b', name: 'B', filePath: '/b', openedAt: '2026-03-01T00:00:00Z' },
      { id: 'c', name: 'C', filePath: '/c', openedAt: '2026-02-01T00:00:00Z' },
    ])
    expect(sorted.map((r) => r.id)).toEqual(['b', 'c', 'a'])
  })
})

describe('db/recent: Dexie (fake-indexeddb)', () => {
  it('addRecent + listRecent повертає запис', async () => {
    await addRecent({ id: 'prj_1', name: 'Демо', filePath: '/x/demo.splus' })
    const list = await listRecent()
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ id: 'prj_1', name: 'Демо', filePath: '/x/demo.splus' })
    expect(list[0].openedAt).toBeTruthy()
  })

  it('повторне відкриття того самого id не дублює, оновлює openedAt', async () => {
    await addRecent({ id: 'prj_1', name: 'Демо', filePath: '/x/demo.splus' })
    const first = (await listRecent())[0].openedAt
    await new Promise((r) => setTimeout(r, 5))
    await addRecent({ id: 'prj_1', name: 'Демо (перейм.)', filePath: '/x/demo.splus' })
    const list = await listRecent()
    expect(list).toHaveLength(1)
    expect(list[0].name).toBe('Демо (перейм.)')
    expect(list[0].openedAt >= first).toBe(true)
  })

  it('listRecent відсортований найновішими першими', async () => {
    for (const n of [1, 2, 3]) {
      await addRecent({ id: `prj_${n}`, name: `P${n}`, filePath: `/p${n}.splus` })
      await new Promise((r) => setTimeout(r, 3))
    }
    const list = await listRecent()
    expect(list.map((r) => r.id)).toEqual(['prj_3', 'prj_2', 'prj_1'])
  })

  it('обрізає список до RECENT_LIMIT', async () => {
    for (let n = 0; n < RECENT_LIMIT + 5; n++) {
      await addRecent({ id: `prj_${n}`, name: `P${n}`, filePath: `/p${n}.splus` })
      await new Promise((r) => setTimeout(r, 2))
    }
    const list = await listRecent(100)
    expect(list).toHaveLength(RECENT_LIMIT)
    // лишились найновіші
    expect(list[0].id).toBe(`prj_${RECENT_LIMIT + 4}`)
  })

  it('removeRecent прибирає запис', async () => {
    await addRecent({ id: 'prj_1', name: 'A', filePath: '/a.splus' })
    await addRecent({ id: 'prj_2', name: 'B', filePath: '/b.splus' })
    await removeRecent('prj_1')
    const list = await listRecent()
    expect(list.map((r) => r.id)).toEqual(['prj_2'])
  })
})
