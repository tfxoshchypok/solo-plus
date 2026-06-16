// Стек історії для undo/redo. Чиста структура без Vue/Pinia — тестується окремо.
//
// Тримає знімки редагованого зрізу моделі (immutable). Лінійна історія:
// нова зміна після undo обрізає «майбутнє» (redo-гілку). Тримається в пам'яті
// (не у файлі/чернетці) — див. specs/dexie-catalog.md §2.5.

/** Типовий ліміт глибини історії. */
export const HISTORY_LIMIT = 100

/**
 * @template T
 * @typedef {Object} History
 * @property {(snapshot: T) => void} push Додати знімок як новий поточний стан.
 * @property {() => T|null} undo Повернути попередній стан (або null).
 * @property {() => T|null} redo Повторити скасоване (або null).
 * @property {() => boolean} canUndo
 * @property {() => boolean} canRedo
 * @property {(snapshot: T) => void} reset Скинути історію до одного знімка.
 * @property {() => number} size К-сть станів у стеку (для тестів/діагностики).
 */

/**
 * Створити історію. Перший знімок — початковий стан.
 * @template T
 * @param {T} initial
 * @param {number} [limit]
 * @returns {History<T>}
 */
export function createHistory(initial, limit = HISTORY_LIMIT) {
  /** @type {T[]} стек станів; past[cursor] — поточний */
  let past = [initial]
  /** індекс поточного стану в past */
  let cursor = 0

  return {
    push(snapshot) {
      // Обрізати все «майбутнє» праворуч від курсора (redo-гілка).
      past = past.slice(0, cursor + 1)
      past.push(snapshot)
      // Обмежити глибину: викидаємо найстаріші.
      if (past.length > limit) {
        past = past.slice(past.length - limit)
      }
      cursor = past.length - 1
    },

    undo() {
      if (cursor === 0) return null
      cursor -= 1
      return past[cursor]
    },

    redo() {
      if (cursor >= past.length - 1) return null
      cursor += 1
      return past[cursor]
    },

    canUndo() {
      return cursor > 0
    },

    canRedo() {
      return cursor < past.length - 1
    },

    reset(snapshot) {
      past = [snapshot]
      cursor = 0
    },

    size() {
      return past.length
    },
  }
}
