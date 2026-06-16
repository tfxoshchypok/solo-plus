import { describe, it, expect } from 'vitest'
import { serializeProject, parseProject, migrateProject, PROJECT_EXTENSION } from '@/project/file.js'

/** @returns {import('@/model/project-schema.js').Project} */
function validProject() {
  return {
    schemaVersion: '1.3',
    project: { id: 'prj_1', name: 'Демо щиток', referencePdf: 'refs/plan.pdf' },
    supply: {
      phases: 3,
      voltage: 400,
      main: { device: 'breaker', poles: 3, ratingA: 40, curve: 'C', widthModules: 3 },
    },
    enclosure: {
      type: 'surface',
      ip: 'IP40',
      reserveTargetPct: 20,
      rows: [{ id: 'r1', index: 0, capacityModules: 12 }],
    },
    groups: [
      {
        id: 'g1',
        kind: 'group',
        title: 'Освітлення',
        spec: { device: 'breaker', poles: 1, ratingA: 10, curve: 'B', widthModules: 1 },
        load: { phases: 1, items: [{ name: 'Лампи', powerW: 800 }] },
      },
    ],
    placements: [
      {
        id: 'p1',
        groupRef: 'g1',
        rowId: 'r1',
        startModule: 0,
        widthModules: 1,
        phase: null,
        label: 'Світло',
      },
    ],
    busbars: { neutral: { present: true }, pe: { present: true } },
  }
}

describe('project/file: серіалізація .splus', () => {
  it('розширення файлу — .splus', () => {
    expect(PROJECT_EXTENSION).toBe('.splus')
  })

  it('кругова стійкість: project → текст → project (без втрат)', () => {
    const original = validProject()
    const { project, errors } = parseProject(serializeProject(original))
    expect(errors).toEqual([])
    expect(project).toEqual(original)
  })

  it('serializeProject дає форматований JSON', () => {
    const text = serializeProject(validProject())
    expect(text).toContain('\n')
    expect(text).toContain('"schemaVersion": "1.3"')
  })

  it('parseProject відхиляє невалідний JSON', () => {
    const { project, errors } = parseProject('{ не json ')
    expect(project).toBeNull()
    expect(errors[0]).toMatch(/Невалідний JSON/)
  })

  it('parseProject відхиляє проєкт, що порушує схему', () => {
    const broken = validProject()
    // @ts-expect-error навмисно ламаємо: невідомий тип пристрою
    broken.groups[0].spec.device = 'не_існує'
    const { project, errors } = parseProject(serializeProject(broken))
    expect(project).toBeNull()
    expect(errors.length).toBeGreaterThan(0)
  })

  it('parseProject приймає розширені типи пристроїв (напр. voltage_relay)', () => {
    const p = validProject()
    p.groups[0].spec.device = 'voltage_relay'
    const { project, errors } = parseProject(serializeProject(p))
    expect(errors).toEqual([])
    expect(project?.groups[0].spec.device).toBe('voltage_relay')
  })

  it('parseProject приймає кілька приладів на лінії', () => {
    const p = validProject()
    p.groups[0].load = {
      phases: 1,
      items: [
        { name: 'Холодильник', powerW: 150 },
        { name: 'Мікрохвильовка', powerW: 1500, cosPhi: 1 },
        { name: 'Чайник', powerW: 2000, quantity: 1 },
      ],
    }
    const { project, errors } = parseProject(serializeProject(p))
    expect(errors).toEqual([])
    expect(project?.groups[0].load?.items).toHaveLength(3)
  })

  it('parseProject відхиляє прилад без потужності (powerW обовʼязковий)', () => {
    const p = validProject()
    // @ts-expect-error навмисно ламаємо: прилад без powerW
    p.groups[0].load = { items: [{ name: 'X' }] }
    const { project, errors } = parseProject(serializeProject(p))
    expect(project).toBeNull()
    expect(errors.length).toBeGreaterThan(0)
  })

  it('parseProject відхиляє відсутність обовʼязкових секцій', () => {
    const { project, errors } = parseProject(JSON.stringify({ schemaVersion: '1.3' }))
    expect(project).toBeNull()
    expect(errors.length).toBeGreaterThan(0)
  })
})

describe('project/file: міграція 1.1 → 1.3 (ввід у supply + load.items)', () => {
  /** @returns {any} Старий проєкт 1.1 із incomer-групою. */
  function legacyProject() {
    return {
      schemaVersion: '1.1',
      project: { id: 'prj_old', name: 'Старий щиток' },
      enclosure: { type: 'surface', ip: 'IP40', reserveTargetPct: 20, rows: [{ id: 'r1', index: 0, capacityModules: 12 }] },
      groups: [
        { id: 'g_in', kind: 'incomer', title: 'Ввід', spec: { device: 'breaker', poles: 3, ratingA: 40, curve: 'C', widthModules: 3 } },
        { id: 'g1', kind: 'group', title: 'Світло', spec: { device: 'breaker', poles: 1, ratingA: 10, curve: 'B', widthModules: 1 }, load: { powerW: 800, phases: 1 } },
      ],
      placements: [
        { id: 'p_in', groupRef: 'g_in', rowId: 'r1', startModule: 0, widthModules: 3, phase: null, label: 'Ввід' },
        { id: 'p1', groupRef: 'g1', rowId: 'r1', startModule: 3, widthModules: 1, phase: null, label: 'Світло' },
      ],
      busbars: { neutral: { present: true }, pe: { present: true } },
    }
  }

  it('migrateProject виносить incomer у supply.main і прибирає його з груп', () => {
    const m = migrateProject(legacyProject())
    expect(m.schemaVersion).toBe('1.3')
    expect(m.supply).toEqual({
      phases: 3,
      voltage: 400,
      main: { device: 'breaker', poles: 3, ratingA: 40, curve: 'C', widthModules: 3 },
    })
    expect(m.groups.map((/** @type {any} */ g) => g.id)).toEqual(['g1'])
    // розміщення колишнього вводу прибрано, решта лишилась
    expect(m.placements.map((/** @type {any} */ p) => p.id)).toEqual(['p1'])
  })

  it('migrateProject 1.2→1.3 обгортає плоский load у load.items', () => {
    const m = migrateProject(legacyProject())
    // апарат лишається один (spec), навантаження стає переліком приладів
    expect(m.groups[0].spec).toEqual({ device: 'breaker', poles: 1, ratingA: 10, curve: 'B', widthModules: 1 })
    expect(m.groups[0].load).toEqual({ phases: 1, items: [{ powerW: 800 }] })
  })

  it('parseProject читає старий 1.1-файл наскрізь (міграція + валідація)', () => {
    const { project, errors } = parseProject(JSON.stringify(legacyProject()))
    expect(errors).toEqual([])
    expect(project?.schemaVersion).toBe('1.3')
    expect(project?.supply.main?.ratingA).toBe(40)
    expect(project?.groups).toHaveLength(1)
    expect(project?.groups[0].spec.ratingA).toBe(10)
    expect(project?.groups[0].load?.items[0].powerW).toBe(800)
  })

  it('1.1 без incomer-групи → 1-фазний supply за замовчуванням', () => {
    const legacy = legacyProject()
    legacy.groups = legacy.groups.filter((/** @type {any} */ g) => g.kind !== 'incomer')
    legacy.placements = []
    const m = migrateProject(legacy)
    expect(m.supply).toEqual({ phases: 1, voltage: 230 })
  })
})
