import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useProjectStore } from '@/stores/project.store.js'

/** @typedef {import('@/model/project-schema.js').Group} Group */

/** @param {string} id @param {string} title @returns {Group} */
function group(id, title) {
  return {
    id,
    kind: 'group',
    title,
    spec: { device: 'breaker', poles: 1, ratingA: 10, curve: 'B', widthModules: 1 },
  }
}

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('project.store: undo/redo через commit', () => {
  it('новий проєкт — історія порожня', () => {
    const s = useProjectStore()
    s.createNew()
    expect(s.canUndo).toBe(false)
    expect(s.canRedo).toBe(false)
    expect(s.project?.groups).toEqual([])
  })

  it('commit додає групу й вмикає undo, позначає dirty', () => {
    const s = useProjectStore()
    s.createNew()
    expect(s.dirty).toBe(false)
    s.commit((d) => ({ ...d, groups: [...d.groups, group('g1', 'Світло')] }))
    expect(s.project?.groups).toHaveLength(1)
    expect(s.canUndo).toBe(true)
    expect(s.dirty).toBe(true)
  })

  it('undo повертає попередній стан, redo — повторює', () => {
    const s = useProjectStore()
    s.createNew()
    s.commit((d) => ({ ...d, groups: [group('g1', 'A')] }))
    s.commit((d) => ({ ...d, groups: [...d.groups, group('g2', 'B')] }))
    expect(s.project?.groups).toHaveLength(2)

    expect(s.undo()).toBe(true)
    expect(s.project?.groups).toHaveLength(1)
    expect(s.project?.groups[0].id).toBe('g1')

    expect(s.redo()).toBe(true)
    expect(s.project?.groups).toHaveLength(2)
    expect(s.project?.groups[1].id).toBe('g2')
  })

  it('commit після undo обрізає redo', () => {
    const s = useProjectStore()
    s.createNew()
    s.commit((d) => ({ ...d, groups: [group('g1', 'A')] }))
    s.commit((d) => ({ ...d, groups: [...d.groups, group('g2', 'B')] }))
    s.undo()
    s.commit((d) => ({ ...d, groups: [...d.groups, group('g3', 'C')] }))
    expect(s.canRedo).toBe(false)
    expect(s.project?.groups.map((g) => g.id)).toEqual(['g1', 'g3'])
  })

  it('іммутабельність: мутація draft не зачіпає поточний стан до commit', () => {
    const s = useProjectStore()
    s.createNew()
    s.commit((d) => {
      d.groups.push(group('gX', 'мутуємо клон')) // мутація клона — безпечна
      return d
    })
    // зміна застосувалась через повернений результат, не через сам draft-референс
    expect(s.project?.groups).toHaveLength(1)
    // повторне читання не змінює нічого; undo повертає до порожнього
    expect(s.undo()).toBe(true)
    expect(s.project?.groups).toEqual([])
  })

  it('undo на межі повертає false', () => {
    const s = useProjectStore()
    s.createNew()
    expect(s.undo()).toBe(false)
    expect(s.redo()).toBe(false)
  })

  it('createNew скидає історію попереднього проєкту', () => {
    const s = useProjectStore()
    s.createNew()
    s.commit((d) => ({ ...d, groups: [group('g1', 'A')] }))
    expect(s.canUndo).toBe(true)
    s.createNew()
    expect(s.canUndo).toBe(false)
    expect(s.project?.groups).toEqual([])
  })
})
