import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useProjectStore } from '@/stores/project.store.js'

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('project.store: дії над групами', () => {
  it('addGroup додає групу з uid і одним дефолтним апаратом', () => {
    const s = useProjectStore()
    s.createNew()
    const id = s.addGroup({ title: 'Освітлення' })
    expect(id).toMatch(/^g_/)
    expect(s.project?.groups).toHaveLength(1)
    const g = s.project?.groups[0]
    expect(g?.title).toBe('Освітлення')
    expect(g?.spec).toMatchObject({ device: 'breaker', poles: 1, ratingA: 16, curve: 'C', widthModules: 1 })
  })

  it('addGroup приймає spec і навантаження з переліку приладів', () => {
    const s = useProjectStore()
    s.createNew()
    s.addGroup({
      kind: 'group',
      title: 'Розетки кухні',
      spec: { device: 'breaker', poles: 1, ratingA: 16, curve: 'C', widthModules: 1 },
      load: { phases: 1, items: [{ name: 'Холодильник', powerW: 150 }, { name: 'Чайник', powerW: 2000 }] },
    })
    const g = s.project?.groups[0]
    expect(g?.spec.ratingA).toBe(16)
    expect(g?.load?.items).toHaveLength(2)
    expect(g?.load?.items[1].powerW).toBe(2000)
  })

  it('updateGroup патчить spec і замінює навантаження, не чіпаючи інші групи', () => {
    const s = useProjectStore()
    s.createNew()
    const a = s.addGroup({ title: 'A' })
    const b = s.addGroup({ title: 'B' })
    s.updateGroup(a, {
      title: 'A2',
      spec: { ratingA: 25 },
      load: { phases: 1, items: [{ powerW: 1000 }] },
    })
    const ga = s.project?.groups.find((g) => g.id === a)
    const gb = s.project?.groups.find((g) => g.id === b)
    expect(ga?.title).toBe('A2')
    expect(ga?.spec.ratingA).toBe(25)
    expect(ga?.spec.device).toBe('breaker') // решта spec збережена
    expect(ga?.load?.items[0].powerW).toBe(1000)
    expect(gb?.title).toBe('B') // інша група не змінилась
  })

  it('removeGroup видаляє групу та її розміщення', () => {
    const s = useProjectStore()
    s.createNew()
    const a = s.addGroup({ title: 'A' })
    // підкласти розміщення вручну через commit
    s.commit((d) => ({
      ...d,
      enclosure: { ...d.enclosure, rows: [{ id: 'r1', index: 0, capacityModules: 12 }] },
      placements: [{ id: 'p1', groupRef: a, rowId: 'r1', startModule: 0, widthModules: 1, label: 'A' }],
    }))
    expect(s.project?.placements).toHaveLength(1)
    s.removeGroup(a)
    expect(s.project?.groups).toHaveLength(0)
    expect(s.project?.placements).toHaveLength(0)
  })

  it('дії над групами undoable', () => {
    const s = useProjectStore()
    s.createNew()
    s.addGroup({ title: 'A' })
    s.addGroup({ title: 'B' })
    expect(s.project?.groups).toHaveLength(2)
    s.undo()
    expect(s.project?.groups).toHaveLength(1)
    s.undo()
    expect(s.project?.groups).toHaveLength(0)
    s.redo()
    expect(s.project?.groups).toHaveLength(1)
  })
})
