// Автозбереження-чернетка у Dexie (таблиця drafts) — страховка для відновлення
// після збою. Істина — файл .splus; чернетка лише дублює поточний стан.
// PDF у чернетку не кладемо (лише посилання живе в projectJson). Див.
// specs/dexie-catalog.md §2.5; контролер тригерів — у project/autosave.js (T1.3).

import { db } from '@/db/db.js'

/** @typedef {import('@/db/db.js').Draft} Draft */

/**
 * Записати/оновити чернетку (upsert за projectId): кожне автозбереження
 * перезаписує запис того самого проєкту, не дублюючи.
 * @param {Draft} draft
 * @returns {Promise<void>}
 */
export async function saveDraft(draft) {
  await db.drafts.put(draft)
}

/**
 * Прочитати чернетку проєкту.
 * @param {string} projectId
 * @returns {Promise<Draft|undefined>}
 */
export async function getDraft(projectId) {
  return db.drafts.get(projectId)
}

/**
 * Видалити чернетку (напр. після відмови від відновлення).
 * @param {string} projectId
 * @returns {Promise<void>}
 */
export async function deleteDraft(projectId) {
  await db.drafts.delete(projectId)
}

/**
 * Позначити сесію закритою (чистий вихід): status='closed', dirty=false.
 * Не видаляє запис — лишаємо як останній знімок. Якщо чернетки немає — no-op.
 * @param {string} projectId
 * @returns {Promise<void>}
 */
export async function markClosed(projectId) {
  const draft = await db.drafts.get(projectId)
  if (!draft) return
  await db.drafts.put({ ...draft, status: 'closed', dirty: false })
}

/**
 * Усі чернетки, які можна відновити (незавершена сесія з незбереженими
 * у файл змінами), найновіші першими.
 * @returns {Promise<Draft[]>}
 */
export async function listRecoverable() {
  const all = await db.drafts.toArray()
  return all.filter(isRecoverable).sort((a, b) => b.autosaveAt.localeCompare(a.autosaveAt))
}

/**
 * Чи підлягає чернетка відновленню: сесія лишилась відкритою (застосунок не
 * закрили чисто) і були незбережені у файл зміни. Чиста функція — тестовна.
 * @param {Draft} draft
 * @returns {boolean}
 */
export function isRecoverable(draft) {
  return draft.status === 'open' && draft.dirty === true
}
