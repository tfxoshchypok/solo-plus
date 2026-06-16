// Список останніх відкритих проєктів (Dexie-таблиця recentProjects).
// Проєкти — файли .splus; тут лише індекс «нещодавніх» для швидкого доступу.
// Див. specs/dexie-catalog.md §2.6.

import { db } from '@/db/db.js'

/** @typedef {import('@/db/db.js').RecentProject} RecentProject */

/** Скільки записів тримати в списку останніх. */
export const RECENT_LIMIT = 12

/**
 * Додати/оновити запис (upsert за id): повторне відкриття оновлює openedAt
 * і не дублює. Після запису обрізає список до RECENT_LIMIT найновіших.
 * @param {{ id: string, name: string, filePath: string }} entry
 * @returns {Promise<void>}
 */
export async function addRecent(entry) {
  /** @type {RecentProject} */
  const record = { ...entry, openedAt: new Date().toISOString() }
  await db.recentProjects.put(record)
  await pruneRecent()
}

/**
 * Останні проєкти, найновіші першими.
 * @param {number} [limit]
 * @returns {Promise<RecentProject[]>}
 */
export async function listRecent(limit = RECENT_LIMIT) {
  const all = await db.recentProjects.toArray()
  return sortByOpenedDesc(all).slice(0, limit)
}

/**
 * Прибрати запис зі списку (напр. файл видалено/не знайдено).
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function removeRecent(id) {
  await db.recentProjects.delete(id)
}

/** Очистити весь список. @returns {Promise<void>} */
export async function clearRecent() {
  await db.recentProjects.clear()
}

/** Обрізати таблицю до RECENT_LIMIT найновіших. @returns {Promise<void>} */
async function pruneRecent() {
  const all = await db.recentProjects.toArray()
  if (all.length <= RECENT_LIMIT) return
  const stale = sortByOpenedDesc(all).slice(RECENT_LIMIT)
  await db.recentProjects.bulkDelete(stale.map((r) => r.id))
}

/**
 * Чисте сортування за openedAt спадно (винесено для тестування).
 * @param {RecentProject[]} list
 * @returns {RecentProject[]}
 */
export function sortByOpenedDesc(list) {
  return [...list].sort((a, b) => b.openedAt.localeCompare(a.openedAt))
}
