import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@/db/db.js'
import {
  saveDraft,
  getDraft,
  deleteDraft,
  markClosed,
  listRecoverable,
  isRecoverable,
} from '@/db/drafts.js'

/** @typedef {import('@/db/db.js').Draft} Draft */

/**
 * @param {Partial<Draft> & { projectId: string }} over
 * @returns {Draft}
 */
function draft(over) {
  return {
    projectId: over.projectId,
    filePath: over.filePath ?? null,
    projectJson: over.projectJson ?? /** @type {any} */ ({ project: { id: over.projectId, name: 'P' } }),
    baseSavedAt: over.baseSavedAt ?? null,
    autosaveAt: over.autosaveAt ?? '2026-06-15T10:00:00.000Z',
    dirty: over.dirty ?? true,
    status: over.status ?? 'open',
  }
}

beforeEach(async () => {
  await db.drafts.clear()
})

describe('db/drafts: isRecoverable (чиста)', () => {
  it('open + dirty → відновлювана', () => {
    expect(isRecoverable(draft({ projectId: 'a', status: 'open', dirty: true }))).toBe(true)
  })
  it('closed → ні', () => {
    expect(isRecoverable(draft({ projectId: 'a', status: 'closed', dirty: true }))).toBe(false)
  })
  it('open але не dirty → ні', () => {
    expect(isRecoverable(draft({ projectId: 'a', status: 'open', dirty: false }))).toBe(false)
  })
})

describe('db/drafts: Dexie (fake-indexeddb)', () => {
  it('saveDraft + getDraft повертає запис; upsert не дублює', async () => {
    await saveDraft(draft({ projectId: 'p1', autosaveAt: '2026-06-15T10:00:00.000Z' }))
    await saveDraft(draft({ projectId: 'p1', autosaveAt: '2026-06-15T10:05:00.000Z' }))
    const got = await getDraft('p1')
    expect(got?.autosaveAt).toBe('2026-06-15T10:05:00.000Z')
    expect(await db.drafts.count()).toBe(1)
  })

  it('deleteDraft прибирає запис', async () => {
    await saveDraft(draft({ projectId: 'p1' }))
    await deleteDraft('p1')
    expect(await getDraft('p1')).toBeUndefined()
  })

  it('markClosed знімає dirty і ставить status=closed', async () => {
    await saveDraft(draft({ projectId: 'p1', status: 'open', dirty: true }))
    await markClosed('p1')
    const got = await getDraft('p1')
    expect(got?.status).toBe('closed')
    expect(got?.dirty).toBe(false)
  })

  it('markClosed відсутньої чернетки — no-op', async () => {
    await markClosed('nope')
    expect(await db.drafts.count()).toBe(0)
  })

  it('listRecoverable повертає лише open+dirty, найновіші першими', async () => {
    await saveDraft(draft({ projectId: 'open_new', status: 'open', dirty: true, autosaveAt: '2026-06-15T12:00:00.000Z' }))
    await saveDraft(draft({ projectId: 'open_old', status: 'open', dirty: true, autosaveAt: '2026-06-15T09:00:00.000Z' }))
    await saveDraft(draft({ projectId: 'closed', status: 'closed', dirty: false, autosaveAt: '2026-06-15T13:00:00.000Z' }))
    await saveDraft(draft({ projectId: 'clean', status: 'open', dirty: false, autosaveAt: '2026-06-15T14:00:00.000Z' }))
    const list = await listRecoverable()
    expect(list.map((d) => d.projectId)).toEqual(['open_new', 'open_old'])
  })
})
