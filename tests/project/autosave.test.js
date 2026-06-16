import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ref, nextTick } from 'vue'
import { createAutosave } from '@/project/autosave.js'

/**
 * Полегшений фейк стору: реактивні refs + toDraft, що читає поточний стан.
 * Достатній для контракту AutosaveStoreLike (watch на project/dirty працює).
 */
function makeFakeStore() {
  const project = ref(/** @type {any} */ (null))
  const dirty = ref(false)
  const projectId = ref(/** @type {string|null} */ (null))

  /** Відкрити «проєкт» (для watch — нове посилання). @param {string} id */
  function open(id) {
    project.value = { project: { id, name: 'P' }, groups: [] }
    projectId.value = id
    dirty.value = false
  }
  /** Імітувати зміну моделі. */
  function edit() {
    project.value.groups.push({ id: 'g' + project.value.groups.length })
    dirty.value = true
  }

  function toDraft() {
    if (!project.value) return null
    return {
      projectId: project.value.project.id,
      filePath: null,
      projectJson: JSON.parse(JSON.stringify(project.value)),
      baseSavedAt: null,
      autosaveAt: new Date().toISOString(),
      dirty: dirty.value,
      status: /** @type {'open'} */ ('open'),
    }
  }

  return { project, dirty, projectId, open, edit, toDraft }
}

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('project/autosave: контролер', () => {
  it('пише чернетку після debounce, не раніше', async () => {
    const store = makeFakeStore()
    const write = vi.fn(/** @param {import('@/db/db.js').Draft} _d */ async (_d) => {})
    const auto = createAutosave(/** @type {any} */ (store), { debounceMs: 1000, hardMs: 999999, write })
    auto.start()
    store.open('p1')
    store.edit()
    await nextTick() // дати watch спрацювати

    expect(write).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1000)
    expect(write).toHaveBeenCalledTimes(1)
    expect(write.mock.calls[0][0].projectId).toBe('p1')
    auto.stop()
  })

  it('debounce відсувається на кожній зміні (один запис на серію)', async () => {
    const store = makeFakeStore()
    const write = vi.fn(async () => {})
    const auto = createAutosave(/** @type {any} */ (store), { debounceMs: 1000, hardMs: 999999, write })
    auto.start()
    store.open('p1')

    store.edit()
    await nextTick()
    await vi.advanceTimersByTimeAsync(600)
    store.edit()
    await nextTick()
    await vi.advanceTimersByTimeAsync(600)
    // минуло 1200 мс, але другий edit скинув таймер → ще не писали
    expect(write).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(400)
    expect(write).toHaveBeenCalledTimes(1)
    auto.stop()
  })

  it('жорсткий таймер пише навіть без debounce-вікна', async () => {
    const store = makeFakeStore()
    const write = vi.fn(async () => {})
    const auto = createAutosave(/** @type {any} */ (store), { debounceMs: 999999, hardMs: 2000, write })
    auto.start()
    store.open('p1')
    store.edit()
    await nextTick()

    await vi.advanceTimersByTimeAsync(2000)
    expect(write).toHaveBeenCalledTimes(1)
    auto.stop()
  })

  it('flushNow пише негайно, лише якщо dirty', async () => {
    const store = makeFakeStore()
    const write = vi.fn(async () => {})
    const auto = createAutosave(/** @type {any} */ (store), { write })
    store.open('p1')

    await auto.flushNow()
    expect(write).not.toHaveBeenCalled() // ще не брудний

    store.edit()
    await auto.flushNow()
    expect(write).toHaveBeenCalledTimes(1)
  })

  it('stop знімає таймери — подальших записів немає', async () => {
    const store = makeFakeStore()
    const write = vi.fn(async () => {})
    const auto = createAutosave(/** @type {any} */ (store), { debounceMs: 1000, hardMs: 1500, write })
    auto.start()
    store.open('p1')
    store.edit()
    await nextTick()
    auto.stop()

    await vi.advanceTimersByTimeAsync(5000)
    expect(write).not.toHaveBeenCalled()
  })

  it('markClosedNow фіксує брудний стан і закриває сесію', async () => {
    const store = makeFakeStore()
    const write = vi.fn(async () => {})
    const close = vi.fn(async () => {})
    const auto = createAutosave(/** @type {any} */ (store), { write, close })
    store.open('p1')
    store.edit()

    await auto.markClosedNow()
    expect(write).toHaveBeenCalledTimes(1)
    expect(close).toHaveBeenCalledWith('p1')
  })
})
