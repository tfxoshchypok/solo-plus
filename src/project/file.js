// Формат файлу проєкту .splus.
//
// Рішення (2026-06-14): на старті — простий JSON-файл (без zip-контейнера,
// без вкладеного PDF). referencePdf лишається відносним шляхом у моделі.
// Перехід на zip (project.json + refs/) — коли розблокуємо PDF.
//
// Архітектура: чисті функції (serialize/parse/validate) відокремлені від
// Neutralino I/O (save/open), щоб логіку можна було тестувати у Node без webview.

import { validateProjectStructure } from '@/model/validation.js'

/** @typedef {import('@/model/project-schema.js').Project} Project */
/** @typedef {import('@/model/project-schema.js').Supply} Supply */
/** @typedef {import('@/model/project-schema.js').ApparatusSpec} ApparatusSpec */

/** Канонічне розширення файлу проєкту (провізорно). */
export const PROJECT_EXTENSION = '.splus'

/** Поточна версія схеми проєкту. */
export const SCHEMA_VERSION = '1.3'

// ── Чисті функції (тестовані у Node) ─────────────────────────────

/**
 * Серіалізувати проєкт у текст файлу .splus (форматований JSON).
 * @param {Project} project
 * @returns {string}
 */
export function serializeProject(project) {
  return JSON.stringify(project, null, 2)
}

/**
 * 1.1 → 1.2: ввід виносимо з groups[] у project.supply.
 *  - incomer-група (kind==='incomer') стає supply.main;
 *  - фазність вводу беремо з полюсності його spec (≥3 → 3-ф, інакше 1-ф);
 *  - напруга мережі — 400 для 3-ф, 230 для 1-ф;
 *  - розміщення цього апарата прибираємо (розкладе редактор із supply).
 * @param {any} data
 * @returns {any}
 */
function migrate_1_1_to_1_2(data) {
  const groups = Array.isArray(data.groups) ? data.groups : []
  const incomer = groups.find((/** @type {any} */ g) => g && g.kind === 'incomer')
  /** @type {1|3} */
  const phases = incomer && incomer.spec && incomer.spec.poles >= 3 ? 3 : 1

  /** @type {Supply} */
  const supply = { phases, voltage: phases === 3 ? 400 : 230 }
  if (incomer && incomer.spec) supply.main = /** @type {ApparatusSpec} */ (incomer.spec)

  const incomerId = incomer ? incomer.id : null
  const placements = Array.isArray(data.placements) ? data.placements : []

  return {
    ...data,
    schemaVersion: '1.2',
    supply,
    groups: groups.filter((/** @type {any} */ g) => g && g.kind !== 'incomer'),
    placements: placements.filter((/** @type {any} */ p) => !incomerId || p.groupRef !== incomerId),
  }
}

/**
 * 1.2 → 1.3: до лінії можна приєднати кілька приладів. Плоске навантаження
 * групи `{powerW, cosPhi, loadType, phases, demandFactor}` стає
 * `{phases, loadType, demandFactor, items:[{powerW, cosPhi}]}`. Апарат (spec) — без змін.
 * @param {any} data
 * @returns {any}
 */
function migrate_1_2_to_1_3(data) {
  const groups = Array.isArray(data.groups) ? data.groups : []
  return {
    ...data,
    schemaVersion: '1.3',
    groups: groups.map((/** @type {any} */ g) => {
      if (!g || !g.load) return g
      const { powerW, cosPhi, loadType, phases, demandFactor } = g.load
      /** @type {any} */
      const load = { items: [] }
      if (phases != null) load.phases = phases
      if (loadType != null) load.loadType = loadType
      if (demandFactor != null) load.demandFactor = demandFactor
      if (powerW != null) {
        /** @type {any} */
        const item = { powerW }
        if (cosPhi != null) item.cosPhi = cosPhi
        load.items.push(item)
      }
      return { ...g, load }
    }),
  }
}

/**
 * Підняти старі версії проєкту до поточної схеми ПЕРЕД валідацією (послідовно).
 * Невідому/майбутню версію не чіпаємо — хай впаде на валідації.
 * @param {any} data
 * @returns {any}
 */
export function migrateProject(data) {
  if (!data || typeof data !== 'object') return data
  let d = data
  if (d.schemaVersion === '1.1') d = migrate_1_1_to_1_2(d)
  if (d.schemaVersion === '1.2') d = migrate_1_2_to_1_3(d)
  return d
}

/**
 * Розібрати текст файлу .splus у проєкт із валідацією проти JSON Schema.
 * Старі версії піднімаються міграцією перед валідацією.
 * Не кидає винятків — повертає структурований результат.
 * @param {string} text
 * @returns {{ project: Project|null, errors: string[] }}
 */
export function parseProject(text) {
  /** @type {unknown} */
  let data
  try {
    data = JSON.parse(text)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { project: null, errors: [`Невалідний JSON: ${msg}`] }
  }

  data = migrateProject(data)

  const { valid, errors } = validateProjectStructure(data)
  if (!valid) {
    return { project: null, errors }
  }
  return { project: /** @type {Project} */ (data), errors: [] }
}

// ── Neutralino I/O (працює лише у webview) ───────────────────────

/**
 * Записати проєкт у файл .splus через Neutralino Filesystem API.
 * @param {string} path Абсолютний шлях до файлу.
 * @param {Project} project
 * @returns {Promise<void>}
 */
export async function saveProject(path, project) {
  await Neutralino.filesystem.writeFile(path, serializeProject(project))
}

/**
 * Прочитати й розібрати файл .splus. Повертає проєкт + час модифікації файлу
 * (для baseSavedAt автозбереження у T1.3).
 * @param {string} path Абсолютний шлях до файлу.
 * @returns {Promise<{ project: Project|null, errors: string[], modifiedAt: number|null }>}
 */
export async function openProject(path) {
  const text = await Neutralino.filesystem.readFile(path)
  const { project, errors } = parseProject(text)

  let modifiedAt = null
  try {
    const stats = await Neutralino.filesystem.getStats(path)
    modifiedAt = stats.modifiedAt
  } catch {
    // getStats не критичний для відкриття; baseSavedAt лишиться null.
  }

  return { project, errors, modifiedAt }
}
