// CRUD над нормативними константами (таблиця normRefs). Читання — для рушія
// розрахунків (calc/norms.js), запис/скидання — для редактора довідників (T2.4).
// Дефолти й первинне заповнення — у norms-seed.js. Див. specs/dexie-catalog.md §2.4.

import { db } from '@/db/db.js'
import { DEFAULT_NORMS } from '@/db/norms-seed.js'

/** @typedef {import('@/db/db.js').NormRef} NormRef */

/**
 * Усі нормативи з БД (без впорядкування — порядок задає UI/дефолти).
 * @returns {Promise<NormRef[]>}
 */
export async function listNorms() {
  return db.normRefs.toArray()
}

/**
 * Прочитати один норматив за ключем.
 * @param {string} key
 * @returns {Promise<NormRef|undefined>}
 */
export async function getNorm(key) {
  return db.normRefs.get(key)
}

/**
 * Змінити значення нормативу (зберігає category/description, якщо запис є;
 * інакше створює мінімальний запис). Використовується редактором довідників.
 * @param {string} key
 * @param {number} value
 * @returns {Promise<void>}
 */
export async function setNorm(key, value) {
  const current = await db.normRefs.get(key)
  const meta = current ?? DEFAULT_NORMS.find((n) => n.key === key)
  await db.normRefs.put({
    key,
    category: meta?.category ?? 'misc',
    value,
    description: meta?.description,
  })
}

/**
 * Скинути всі нормативи до DEFAULT_NORMS (очистити таблицю й залити дефолти).
 * @returns {Promise<void>}
 */
export async function resetNorms() {
  await db.normRefs.clear()
  await db.normRefs.bulkAdd([...DEFAULT_NORMS])
}
