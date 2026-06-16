import { describe, it, expect } from 'vitest'
import { writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { serializeProject, parseProject } from '@/project/file.js'

/**
 * Інтеграційний тест: реальний запис .splus на диск і читання назад.
 * Використовує ту саму чисту серіалізацію, що й saveProject/openProject
 * (їх Neutralino-обгортки самі лише викликають fs у webview).
 */

/** @returns {import('@/model/project-schema.js').Project} */
function demoProject() {
  return {
    schemaVersion: '1.3',
    project: { id: 'prj_demo', name: 'Демо щиток' },
    supply: { phases: 3, voltage: 400, main: { device: 'breaker', poles: 3, ratingA: 40, curve: 'C', widthModules: 3 } },
    enclosure: {
      type: 'surface',
      ip: 'IP40',
      reserveTargetPct: 20,
      rows: [{ id: 'r1', index: 0, capacityModules: 12 }],
    },
    groups: [
      { id: 'g1', kind: 'group', title: 'Освітлення', spec: { device: 'breaker', poles: 1, ratingA: 10, curve: 'B', widthModules: 1 }, load: { phases: 1, items: [{ powerW: 800 }] } },
      { id: 'g2', kind: 'group', title: 'Розетки', spec: { device: 'breaker', poles: 1, ratingA: 16, curve: 'C', widthModules: 1 }, load: { phases: 1, items: [{ powerW: 2000 }] } },
    ],
    placements: [],
    busbars: { neutral: { present: true }, pe: { present: true } },
  }
}

describe('project/file: реальний цикл збереження на диск', () => {
  it('зберігає .splus на диск і повністю відновлює', async () => {
    const path = join(tmpdir(), `soloplus-test-${Date.now()}.splus`)
    const original = demoProject()

    // SAVE
    await writeFile(path, serializeProject(original), 'utf8')

    // READ + PARSE
    const text = await readFile(path, 'utf8')
    const { project, errors } = parseProject(text)

    expect(errors).toEqual([])
    expect(project).toEqual(original)
    expect(project?.groups).toHaveLength(2)
    expect(project?.groups[0].load).toEqual({ phases: 1, items: [{ powerW: 800 }] })
    expect(project?.supply.main?.ratingA).toBe(40)

    await rm(path)
  })

  it('зіпсований файл на диску дає помилки, не падає', async () => {
    const path = join(tmpdir(), `soloplus-bad-${Date.now()}.splus`)
    await writeFile(path, '{ зламаний json', 'utf8')
    const { project, errors } = parseProject(await readFile(path, 'utf8'))
    expect(project).toBeNull()
    expect(errors.length).toBeGreaterThan(0)
    await rm(path)
  })
})
