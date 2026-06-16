// Стан моделі проєкту (Pinia). Той самий обʼєкт, що серіалізується у файл .splus.
// Зміни groups/placements — іммутабельні (основа undo/redo, реалізується у T1.6).
//
// Стор оркеструє CRUD: file.js (читання/запис .splus), діалоги Neutralino
// (вибір файлу) і db/recent.js (список останніх). Тримає поточний шлях і dirty.

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { checkLayout } from '@/model/validation.js'
import { defaultSpec } from '@/model/group.js'
import { uid } from '@/model/id.js'
import {
  PROJECT_EXTENSION,
  serializeProject,
  parseProject,
  saveProject,
  openProject,
} from '@/project/file.js'
import { addRecent } from '@/db/recent.js'
import { createHistory } from '@/stores/history.js'

/** @typedef {import('@/model/project-schema.js').Project} Project */
/** @typedef {import('@/model/project-schema.js').Group} Group */
/** @typedef {import('@/model/project-schema.js').GroupKind} GroupKind */
/** @typedef {import('@/model/project-schema.js').ApparatusSpec} ApparatusSpec */
/** @typedef {import('@/model/project-schema.js').Supply} Supply */

/**
 * Редагований зріз моделі, що бере участь в undo/redo.
 * Метадані файлу (project/schemaVersion) НЕ входять.
 * @typedef {Pick<Project, 'supply'|'enclosure'|'groups'|'placements'|'busbars'>} EditableSlice
 */

/**
 * Глибокий клон plain-data (JSON-round-trip). Стійкий до Vue reactive-проксі,
 * на відміну від structuredClone. Модель повністю JSON-серіалізовна.
 * @template T
 * @param {T} value
 * @returns {T}
 */
function deepClone(value) {
  return JSON.parse(JSON.stringify(value))
}

/**
 * Глибокий клон редагованого зрізу (знімок історії, іммутабельний).
 * @param {Project} p
 * @returns {EditableSlice}
 */
function snapshotOf(p) {
  return deepClone({
    supply: p.supply,
    enclosure: p.enclosure,
    groups: p.groups,
    placements: p.placements,
    busbars: p.busbars,
  })
}

/** @returns {Project} */
function emptyProject() {
  return {
    schemaVersion: '1.3',
    project: { id: uid('prj'), name: 'Новий проєкт' },
    supply: { phases: 1, voltage: 230 },
    enclosure: { type: 'surface', ip: 'IP40', reserveTargetPct: 20, rows: [] },
    groups: [],
    placements: [],
    busbars: { neutral: { present: true }, pe: { present: true } },
  }
}

/** Фільтр діалогів файлів для .splus. */
const SPLUS_FILTER = [
  { name: 'Проєкт solo.plus', extensions: [PROJECT_EXTENSION.replace('.', '')] },
  { name: 'Усі файли', extensions: ['*'] },
]

export const useProjectStore = defineStore('project', () => {
  /** @type {import('vue').Ref<Project|null>} */
  const project = ref(null)
  /** Поточний шлях до файлу; null якщо ще не збережено. */
  const filePath = ref(/** @type {string|null} */ (null))
  /** Є незбережені у файл зміни. */
  const dirty = ref(false)
  /** Останні помилки валідації при відкритті (для UI). */
  const loadErrors = ref(/** @type {string[]} */ ([]))
  /**
   * Мітка часу файлу, на якому базується поточний стан (ISO 8601), або null,
   * якщо проєкт ще не збережено. Кладеться у чернетку як baseSavedAt (T1.3).
   */
  const baseSavedAt = ref(/** @type {string|null} */ (null))
  /** Лічильник версій історії — щоб canUndo/canRedo були реактивні. */
  const historyTick = ref(0)

  /** @type {import('@/stores/history.js').History<EditableSlice>} */
  let history = createHistory(snapshotOf(emptyProject()))

  const isOpen = computed(() => project.value !== null)
  const projectId = computed(() => project.value?.project.id ?? null)
  const issues = computed(() => (project.value ? checkLayout(project.value) : []))
  const canUndo = computed(() => (historyTick.value, history.canUndo()))
  const canRedo = computed(() => (historyTick.value, history.canRedo()))

  // ── Внутрішні помічники ────────────────────────────────────────

  /** @param {Project} p @param {string|null} path @param {string|null} [savedAt] */
  function setOpen(p, path, savedAt = null) {
    project.value = p
    filePath.value = path
    baseSavedAt.value = savedAt
    dirty.value = false
    loadErrors.value = []
    history.reset(snapshotOf(p))
    historyTick.value++
  }

  /** Застосувати знімок історії до поточного проєкту (без зміни метаданих). */
  function applySnapshot(/** @type {EditableSlice} */ snap) {
    if (!project.value) return
    project.value.supply = snap.supply
    project.value.enclosure = snap.enclosure
    project.value.groups = snap.groups
    project.value.placements = snap.placements
    project.value.busbars = snap.busbars
  }

  /** Записати поточний запис у список останніх. @param {string} path */
  async function recordRecent(path) {
    if (!project.value) return
    await addRecent({ id: project.value.project.id, name: project.value.project.name, filePath: path })
  }

  // ── CRUD ───────────────────────────────────────────────────────

  /** Створити новий порожній проєкт (у пам'яті, ще без файлу). */
  function createNew() {
    setOpen(emptyProject(), null)
  }

  /**
   * Відкрити проєкт із конкретного шляху.
   * @param {string} path
   * @returns {Promise<boolean>} успіх (false якщо файл невалідний)
   */
  async function openFromPath(path) {
    const { project: p, errors, modifiedAt } = await openProject(path)
    if (!p) {
      loadErrors.value = errors
      return false
    }
    setOpen(p, path, modifiedAt != null ? new Date(modifiedAt).toISOString() : null)
    await recordRecent(path)
    return true
  }

  /**
   * Відкрити через системний діалог вибору файлу.
   * @returns {Promise<boolean>} false якщо скасовано або невалідно
   */
  async function openWithDialog() {
    const paths = await Neutralino.os.showOpenDialog('Відкрити проєкт', {
      multiSelections: false,
      filters: SPLUS_FILTER,
    })
    if (!paths.length) return false
    return openFromPath(paths[0])
  }

  /**
   * Зберегти у поточний файл; якщо файлу ще немає — «Зберегти як».
   * @returns {Promise<boolean>}
   */
  async function save() {
    if (!project.value) return false
    if (!filePath.value) return saveAs()
    await saveProject(filePath.value, project.value)
    baseSavedAt.value = nowIso()
    dirty.value = false
    await recordRecent(filePath.value)
    return true
  }

  /**
   * Зберегти у вибраний через діалог файл.
   * @returns {Promise<boolean>} false якщо скасовано
   */
  async function saveAs() {
    if (!project.value) return false
    const path = await Neutralino.os.showSaveDialog('Зберегти проєкт як', {
      filters: SPLUS_FILTER,
      forceOverwrite: false,
    })
    if (!path) return false
    const target = ensureExtension(path)
    await saveProject(target, project.value)
    filePath.value = target
    baseSavedAt.value = nowIso()
    dirty.value = false
    await recordRecent(target)
    return true
  }

  /**
   * Зберегти копію: новий файл + НОВИЙ id (це окремий проєкт, не той самий).
   * @returns {Promise<boolean>}
   */
  async function copyAs() {
    if (!project.value) return false
    const path = await Neutralino.os.showSaveDialog('Зберегти копію як', {
      filters: SPLUS_FILTER,
    })
    if (!path) return false
    const target = ensureExtension(path)
    // Клон через серіалізацію + новий id (іммутабельно, без мутації поточного).
    const clone = parseProject(serializeProject(project.value)).project
    if (!clone) return false
    clone.project = { ...clone.project, id: uid('prj') }
    await saveProject(target, clone)
    setOpen(clone, target, nowIso())
    await recordRecent(target)
    return true
  }

  /** Закрити проєкт. */
  function close() {
    project.value = null
    filePath.value = null
    baseSavedAt.value = null
    dirty.value = false
    loadErrors.value = []
    history.reset(snapshotOf(emptyProject()))
    historyTick.value++
  }

  /**
   * Зібрати знімок-чернетку поточного стану для автозбереження (T1.3).
   * Повертає null, якщо проєкт не відкрито. status завжди 'open' (сесія
   * активна); чисте закриття позначається окремо у drafts.markClosed.
   * @returns {import('@/db/db.js').Draft|null}
   */
  function toDraft() {
    if (!project.value) return null
    return {
      projectId: project.value.project.id,
      filePath: filePath.value,
      projectJson: deepClone(project.value),
      baseSavedAt: baseSavedAt.value,
      autosaveAt: nowIso(),
      dirty: dirty.value,
      status: 'open',
    }
  }

  /** Позначити, що є незбережені зміни (викликається при мутаціях моделі). */
  function markDirty() {
    dirty.value = true
  }

  // ── Undo/redo (іммутабельні зміни редагованого зрізу) ──────────

  /**
   * Застосувати зміну до groups/placements/enclosure/busbars іммутабельно
   * і зафіксувати в історії. Мутатор отримує КЛОН зрізу й повертає новий стан
   * (не змінюючи вхідний). Це єдина точка редагування моделі.
   * @param {(draft: EditableSlice) => EditableSlice} mutator
   */
  function commit(mutator) {
    if (!project.value) return
    const next = mutator(snapshotOf(project.value))
    applySnapshot(deepClone(next))
    history.push(snapshotOf(project.value))
    historyTick.value++
    dirty.value = true
  }

  /** Скасувати останню зміну. @returns {boolean} чи було що скасувати */
  function undo() {
    const snap = history.undo()
    if (!snap) return false
    applySnapshot(deepClone(snap))
    historyTick.value++
    dirty.value = true
    return true
  }

  /** Повторити скасовану зміну. @returns {boolean} чи було що повторити */
  function redo() {
    const snap = history.redo()
    if (!snap) return false
    applySnapshot(deepClone(snap))
    historyTick.value++
    dirty.value = true
    return true
  }

  /**
   * Відновити стан із чернетки (T1.3): завантажити збережений знімок і
   * відтворити baseSavedAt + dirty так, ніби сесія тривала далі.
   * @param {import('@/db/db.js').Draft} draft
   */
  function restoreFromDraft(draft) {
    setOpen(draft.projectJson, draft.filePath, draft.baseSavedAt)
    dirty.value = draft.dirty
  }

  // ── Живлення (ввід) ────────────────────────────────────────────

  /**
   * Оновити параметри живлення (поверхневий патч). main можна задати/прибрати.
   * @param {Partial<Supply>} patch
   */
  function updateSupply(patch) {
    commit((d) => ({ ...d, supply: { ...d.supply, ...patch } }))
  }

  // ── Дії над групами (через commit → undoable) ──────────────────

  /**
   * Додати нову групу (один апарат). spec — апарат групи (за замовч. автомат C16);
   * load — навантаження лінії (перелік приладів).
   * @param {Partial<Pick<Group,'kind'|'title'|'load'>> & { spec?: Partial<ApparatusSpec> }} [init]
   * @returns {string}
   */
  function addGroup(init = {}) {
    const id = uid('g')
    /** @type {Group} */
    const g = {
      id,
      kind: init.kind ?? 'group',
      title: init.title ?? 'Нова група',
      spec: { ...defaultSpec(), ...init.spec },
    }
    if (init.load) g.load = init.load
    commit((d) => ({ ...d, groups: [...d.groups, g] }))
    return id
  }

  /**
   * Оновити групу за id (поверхневий патч; spec мерджиться, load замінюється).
   * @param {string} id
   * @param {Partial<Pick<Group,'kind'|'title'>> & { spec?: Partial<ApparatusSpec>, load?: Group['load'] }} patch
   */
  function updateGroup(id, patch) {
    commit((d) => ({
      ...d,
      groups: d.groups.map((g) =>
        g.id !== id
          ? g
          : {
              ...g,
              ...('kind' in patch ? { kind: /** @type {GroupKind} */ (patch.kind) } : {}),
              ...('title' in patch ? { title: /** @type {string} */ (patch.title) } : {}),
              ...('load' in patch ? { load: patch.load } : {}),
              spec: patch.spec ? { ...g.spec, ...patch.spec } : g.spec,
            },
      ),
    }))
  }

  /**
   * Видалити групу за id. Також прибирає її розміщення (groupRef).
   * @param {string} id
   */
  function removeGroup(id) {
    commit((d) => ({
      ...d,
      groups: d.groups.filter((g) => g.id !== id),
      placements: d.placements.filter((p) => p.groupRef !== id),
    }))
  }

  return {
    project,
    filePath,
    baseSavedAt,
    dirty,
    loadErrors,
    isOpen,
    projectId,
    issues,
    canUndo,
    canRedo,
    createNew,
    openFromPath,
    openWithDialog,
    save,
    saveAs,
    copyAs,
    close,
    markDirty,
    toDraft,
    restoreFromDraft,
    commit,
    undo,
    redo,
    updateSupply,
    addGroup,
    updateGroup,
    removeGroup,
  }
})

/** Поточний час у форматі ISO 8601. @returns {string} */
function nowIso() {
  return new Date().toISOString()
}

/**
 * Гарантувати розширення .splus у шляху (деякі ОС не додають його з фільтра).
 * @param {string} path
 * @returns {string}
 */
function ensureExtension(path) {
  return path.toLowerCase().endsWith(PROJECT_EXTENSION) ? path : path + PROJECT_EXTENSION
}
