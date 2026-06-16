// Автозбереження-чернетка у Dexie (страховка; істина — файл .splus).
// Контролер тригерів навколо стору проєкту: debounce після зміни + жорсткий
// таймер як стеля + flush на приховуванні/закритті вікна. Записує знімок через
// db/drafts.js. Undo/redo тримаємо в памʼяті — у чернетку йде лише поточний стан.
// Фаза 1 (T1.3). Див. specs/dexie-catalog.md §2.5.

import { watch, unref } from 'vue'
import { saveDraft, markClosed } from '@/db/drafts.js'

// Стор може віддавати поля як значення (реальний Pinia розгортає refs) або як
// refs (тестовий фейк). unref() читає коректно в обох випадках.

/** Debounce після зміни (мс): не пишемо на кожне натискання. */
export const DEFAULT_DEBOUNCE_MS = 8_000
/** Жорстка стеля (мс): гарантований запис навіть за безперервних змін. */
export const DEFAULT_HARD_MS = 5 * 60_000

/**
 * @typedef {Object} AutosaveOptions
 * @property {number} [debounceMs] Затримка debounce (за замовч. DEFAULT_DEBOUNCE_MS).
 * @property {number} [hardMs] Жорстка стеля між записами (за замовч. DEFAULT_HARD_MS).
 * @property {(draft: import('@/db/db.js').Draft) => Promise<void>} [write] Запис чернетки (для тестів).
 * @property {(projectId: string) => Promise<void>} [close] Позначити сесію закритою (для тестів).
 */

/**
 * Мінімальний контракт стору, потрібний автозбереженню (полегшує тести —
 * не тягнемо весь Pinia-стор). Поля — MaybeRef: реальний Pinia-стор віддає
 * значення, тестовий фейк — refs; читаємо через unref().
 * @typedef {Object} AutosaveStoreLike
 * @property {() => import('@/db/db.js').Draft|null} toDraft
 * @property {import('vue').MaybeRef<string|null>} projectId
 * @property {import('vue').MaybeRef<boolean>} dirty
 * @property {import('vue').MaybeRef<import('@/model/project-schema.js').Project|null>} project
 */

/**
 * @typedef {Object} AutosaveController
 * @property {() => void} start Почати стежити за змінами (вішає watch + жорсткий таймер).
 * @property {() => void} stop Зупинити: зняти watch і всі таймери.
 * @property {() => void} schedule Запланувати запис із debounce (ручний тригер).
 * @property {() => Promise<void>} flushNow Негайно записати поточний знімок (blur/закриття).
 * @property {() => Promise<void>} markClosedNow Позначити сесію закритою (чистий вихід).
 */

/**
 * Створити контролер автозбереження для стору проєкту.
 * @param {AutosaveStoreLike} store
 * @param {AutosaveOptions} [options]
 * @returns {AutosaveController}
 */
export function createAutosave(store, options = {}) {
  const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS
  const hardMs = options.hardMs ?? DEFAULT_HARD_MS
  const write = options.write ?? saveDraft
  const close = options.close ?? markClosed

  /** @type {ReturnType<typeof setTimeout>|null} */
  let debounceTimer = null
  /** @type {ReturnType<typeof setInterval>|null} */
  let hardTimer = null
  /** @type {(() => void)|null} */
  let unwatch = null

  function clearDebounce() {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
  }

  /**
   * Записати поточний знімок, лише якщо є незбережені у файл зміни.
   * @returns {Promise<void>}
   */
  async function flush() {
    clearDebounce()
    if (!unref(store.dirty)) return
    const draft = store.toDraft()
    if (!draft) return
    await write(draft)
  }

  /** Запланувати запис із debounce: кожна зміна відсуває таймер. */
  function schedule() {
    clearDebounce()
    debounceTimer = setTimeout(() => {
      debounceTimer = null
      void flush()
    }, debounceMs)
  }

  function start() {
    if (unwatch) return
    // Стежимо за редагованою моделлю + dirty: будь-яка зміна планує запис.
    unwatch = watch(
      () => [unref(store.project), unref(store.dirty)],
      () => {
        if (unref(store.dirty)) schedule()
      },
      { deep: true },
    )
    // Жорстка стеля: гарантує запис навіть за нескінченних дрібних змін.
    hardTimer = setInterval(() => {
      void flush()
    }, hardMs)
  }

  function stop() {
    clearDebounce()
    if (hardTimer !== null) {
      clearInterval(hardTimer)
      hardTimer = null
    }
    if (unwatch) {
      unwatch()
      unwatch = null
    }
  }

  /** Позначити поточну сесію чисто закритою (status='closed'). */
  async function markClosedNow() {
    clearDebounce()
    const id = unref(store.projectId)
    if (!id) return
    // Перед закриттям зафіксувати останній стан, якщо ще брудний.
    if (unref(store.dirty)) {
      const draft = store.toDraft()
      if (draft) await write(draft)
    }
    await close(id)
  }

  return { start, stop, schedule, flushNow: flush, markClosedNow }
}
