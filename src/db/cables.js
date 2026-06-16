// CRUD над довідником перерізів (таблиця cableRefs). Читання — для рушія
// розрахунків (calc/project-calc через listCableRefs), запис/скидання — для
// редактора довідників (T2.4). Дефолти й первинне заповнення — у cable-seed.js.
// Див. specs/dexie-catalog.md.

import { db } from '@/db/db.js'
import { DEFAULT_CABLE_REFS } from '@/db/cable-seed.js'

/** @typedef {import('@/db/db.js').CableRef} CableRef */

/**
 * Усі перерізи з БД (будь-яких матеріалів/методів; фільтрує вже calc/cables.js).
 * @returns {Promise<CableRef[]>}
 */
export async function listCableRefs() {
  return db.cableRefs.toArray()
}

/**
 * Додати переріз. Повертає згенерований id (++id).
 * @param {Omit<CableRef, 'id'>} ref
 * @returns {Promise<number>}
 */
export async function addCableRef(ref) {
  return db.cableRefs.add(/** @type {CableRef} */ (ref))
}

/**
 * Оновити переріз за id (частковий патч полів).
 * @param {number} id
 * @param {Partial<Omit<CableRef, 'id'>>} patch
 * @returns {Promise<void>}
 */
export async function updateCableRef(id, patch) {
  await db.cableRefs.update(id, patch)
}

/**
 * Видалити переріз за id.
 * @param {number} id
 * @returns {Promise<void>}
 */
export async function removeCableRef(id) {
  await db.cableRefs.delete(id)
}

/**
 * Скинути довідник до типових перерізів (очистити й залити DEFAULT_CABLE_REFS).
 * @returns {Promise<void>}
 */
export async function resetCableRefs() {
  await db.cableRefs.clear()
  await db.cableRefs.bulkAdd([...DEFAULT_CABLE_REFS])
}
