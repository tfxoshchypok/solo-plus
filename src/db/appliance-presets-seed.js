// Дефолтний довідник кінцевих приладів (таблиця appliancePresets).
// Допомагає наповнювати розділ «Навантаження» групи. Потужності — орієнтовні
// плейсхолдери для типової української квартири; користувач їх редагує.
// PK — стабільний слаг id, тож сід ідемпотентний (додає лише відсутні id).

import { db } from '@/db/db.js'

/** @typedef {import('@/db/db.js').AppliancePreset} AppliancePreset */

/**
 * Канонічний набір приладів за замовчуванням.
 * @type {ReadonlyArray<AppliancePreset>}
 */
export const DEFAULT_APPLIANCE_PRESETS = [
  { id: 'lighting-room', name: 'Освітлення кімнати', category: 'lighting', powerW: 300, cosPhi: 1, phases: 1 },
  { id: 'lamp-led', name: 'Світильник LED', category: 'lighting', powerW: 15, cosPhi: 0.95, phases: 1 },
  { id: 'fridge', name: 'Холодильник', category: 'kitchen', powerW: 150, cosPhi: 0.9, phases: 1 },
  { id: 'freezer', name: 'Морозильна камера', category: 'kitchen', powerW: 200, cosPhi: 0.9, phases: 1 },
  { id: 'microwave', name: 'Мікрохвильовка', category: 'kitchen', powerW: 1500, cosPhi: 1, phases: 1 },
  { id: 'kettle', name: 'Електрочайник', category: 'kitchen', powerW: 2000, cosPhi: 1, phases: 1 },
  { id: 'oven', name: 'Духова шафа', category: 'kitchen', powerW: 3500, cosPhi: 1, phases: 1 },
  { id: 'hob', name: 'Варильна поверхня', category: 'kitchen', powerW: 5500, cosPhi: 1, phases: 1 },
  { id: 'dishwasher', name: 'Посудомийна машина', category: 'wet', powerW: 2000, cosPhi: 0.95, phases: 1 },
  { id: 'washing-machine', name: 'Пральна машина', category: 'wet', powerW: 2200, cosPhi: 0.95, phases: 1 },
  { id: 'water-heater', name: 'Бойлер', category: 'wet', powerW: 2000, cosPhi: 1, phases: 1 },
  { id: 'air-conditioner', name: 'Кондиціонер', category: 'climate', powerW: 2500, cosPhi: 0.9, phases: 1 },
  { id: 'iron', name: 'Праска', category: 'appliance', powerW: 2000, cosPhi: 1, phases: 1 },
  { id: 'vacuum', name: 'Пилосос', category: 'appliance', powerW: 1500, cosPhi: 0.9, phases: 1 },
  { id: 'tv', name: 'Телевізор', category: 'electronics', powerW: 150, cosPhi: 0.95, phases: 1 },
  { id: 'pc', name: "Комп'ютер", category: 'electronics', powerW: 400, cosPhi: 0.95, phases: 1 },
]

/**
 * Залити дефолтні прилади у Dexie, НЕ перетираючи наявні (idempotent):
 * додаються лише відсутні id. Безпечно викликати на старті.
 * @returns {Promise<void>}
 */
export async function seedAppliancePresets() {
  const have = new Set(await db.appliancePresets.toCollection().keys())
  const missing = DEFAULT_APPLIANCE_PRESETS.filter((p) => !have.has(p.id))
  if (missing.length) await db.appliancePresets.bulkAdd([...missing])
}
