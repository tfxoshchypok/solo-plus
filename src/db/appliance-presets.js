// CRUD над довідником кінцевих приладів (таблиця appliancePresets).
// Читання — для пікера у розділі «Навантаження»; запис/скидання — для редактора
// довідників. Дефолти й первинне заповнення — у appliance-presets-seed.js.

import { db } from '@/db/db.js'
import { DEFAULT_APPLIANCE_PRESETS } from '@/db/appliance-presets-seed.js'

/** @typedef {import('@/db/db.js').AppliancePreset} AppliancePreset */

/**
 * Усі прилади з БД, відсортовані за категорією, потім за назвою.
 * @returns {Promise<AppliancePreset[]>}
 */
export async function listAppliancePresets() {
  const all = await db.appliancePresets.toArray()
  return all.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))
}

/**
 * Додати/перезаписати прилад (PK — id). Повертає id.
 * @param {AppliancePreset} preset
 * @returns {Promise<string>}
 */
export async function putAppliancePreset(preset) {
  return db.appliancePresets.put(preset)
}

/**
 * Оновити прилад за id (частковий патч полів, окрім id).
 * @param {string} id
 * @param {Partial<Omit<AppliancePreset, 'id'>>} patch
 * @returns {Promise<void>}
 */
export async function updateAppliancePreset(id, patch) {
  await db.appliancePresets.update(id, patch)
}

/**
 * Видалити прилад за id.
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function removeAppliancePreset(id) {
  await db.appliancePresets.delete(id)
}

/**
 * Скинути довідник до типових приладів (очистити й залити дефолти).
 * @returns {Promise<void>}
 */
export async function resetAppliancePresets() {
  await db.appliancePresets.clear()
  await db.appliancePresets.bulkAdd([...DEFAULT_APPLIANCE_PRESETS])
}
