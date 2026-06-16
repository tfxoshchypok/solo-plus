// Дефолтні нормативні константи розрахунку (таблиця normRefs).
// УСІ числа розрахунку винесено сюди — у коді формул немає «магічних чисел»
// (вимога ТЗ п.5). Користувач редагує їх через редактор довідників (T2.4);
// формули завжди отримують значення аргументом. Див. specs/dexie-catalog.md §2.4.

import { db } from '@/db/db.js'

/** @typedef {import('@/db/db.js').NormRef} NormRef */

/**
 * Канонічний набір нормативів за замовчуванням. Ключ — стабільний ідентифікатор,
 * value — число у вказаних одиницях. Достатній для всіх формул Фази 2 (Ф-3, Ф-6).
 * @type {ReadonlyArray<NormRef>}
 */
export const DEFAULT_NORMS = [
  { key: 'voltage.phase', category: 'voltage', value: 230, description: 'Фазна напруга, В (1-фазні групи)' },
  { key: 'voltage.line', category: 'voltage', value: 400, description: 'Лінійна напруга, В (3-фазні групи)' },
  { key: 'load.cosPhi.default', category: 'load', value: 0.95, description: 'Коефіцієнт потужності cos φ за замовчуванням' },
  { key: 'load.demandFactor.default', category: 'load', value: 1.0, description: 'Коефіцієнт попиту за замовчуванням (ввідний апарат)' },
  { key: 'cable.length.default', category: 'cable', value: 20, description: 'Орієнтовна довжина лінії, м (для оцінки втрат напруги)' },
  { key: 'cable.reserveFactor', category: 'cable', value: 1.0, description: 'Запас по допустимому струму кабелю (множник)' },
  { key: 'cable.voltageDrop.maxPct', category: 'cable', value: 5, description: 'Гранична втрата напруги, % (загальна)' },
  { key: 'cable.voltageDrop.lightingPct', category: 'cable', value: 3, description: 'Гранична втрата напруги, % (освітлення)' },
  { key: 'resistivity.cu', category: 'resistivity', value: 0.0175, description: 'Питомий опір міді, Ом·мм²/м' },
  { key: 'resistivity.al', category: 'resistivity', value: 0.0283, description: 'Питомий опір алюмінію, Ом·мм²/м' },
]

/**
 * Залити дефолтні нормативи у Dexie, НЕ перетираючи вже наявні (idempotent):
 * додаються лише відсутні ключі. Безпечно викликати на кожному старті.
 * @returns {Promise<void>}
 */
export async function seedNorms() {
  const existing = new Set(await db.normRefs.toCollection().keys())
  const missing = DEFAULT_NORMS.filter((n) => !existing.has(n.key))
  if (missing.length) await db.normRefs.bulkAdd(missing)
}
