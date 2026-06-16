// Перетворення пресета приладу на елемент навантаження (LoadItem) групи.
// Чиста функція без I/O — пресети читаються з Dexie окремо.

/** @typedef {import('@/db/db.js').AppliancePreset} AppliancePreset */
/** @typedef {import('@/model/project-schema.js').LoadItem} LoadItem */

/**
 * Зібрати елемент навантаження з пресета приладу.
 * cosPhi/quantity додаються лише якщо задані у пресеті.
 * @param {AppliancePreset} preset
 * @returns {LoadItem}
 */
export function presetToLoadItem(preset) {
  /** @type {LoadItem} */
  const item = { name: preset.name, powerW: preset.powerW }
  if (preset.cosPhi != null) item.cosPhi = preset.cosPhi
  if (preset.quantity != null) item.quantity = preset.quantity
  return item
}
