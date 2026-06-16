// Типізований доступ до нормативних констант для рушія розрахунків.
// Перетворює «сирі» записи normRefs (value: unknown) на плоский об'єкт чисел Norms.
// Чисті формули (currents.js, cables.js) отримують Norms АРГУМЕНТОМ — без Dexie,
// тож тестуються з фікстурним Norms. loadNorms() — єдине місце звʼязку з БД.

import { listNorms } from '@/db/norms.js'
import { DEFAULT_NORMS } from '@/db/norms-seed.js'

/** @typedef {import('@/db/db.js').NormRef} NormRef */

/**
 * Плоский набір нормативів для формул (усі поля — числа у відомих одиницях).
 * Ключі дзеркалять normRefs, але у вигляді безпечного для коду обʼєкта.
 * @typedef {Object} Norms
 * @property {number} voltagePhase Фазна напруга, В.
 * @property {number} voltageLine Лінійна напруга, В.
 * @property {number} cosPhiDefault cos φ за замовчуванням.
 * @property {number} demandFactorDefault Коеф. попиту за замовчуванням.
 * @property {number} cableLengthDefault Орієнтовна довжина лінії, м.
 * @property {number} cableReserveFactor Запас по допустимому струму (множник).
 * @property {number} voltageDropMaxPct Гранична втрата напруги, %.
 * @property {number} voltageDropLightingPct Гранична втрата напруги для освітлення, %.
 * @property {number} resistivityCu Питомий опір міді, Ом·мм²/м.
 * @property {number} resistivityAl Питомий опір алюмінію, Ом·мм²/м.
 */

/**
 * Відповідність ключа normRefs ↔ поля Norms. Єдине джерело мапінгу.
 * @type {ReadonlyArray<[keyof Norms, string]>}
 */
const FIELD_BY_KEY = [
  ['voltagePhase', 'voltage.phase'],
  ['voltageLine', 'voltage.line'],
  ['cosPhiDefault', 'load.cosPhi.default'],
  ['demandFactorDefault', 'load.demandFactor.default'],
  ['cableLengthDefault', 'cable.length.default'],
  ['cableReserveFactor', 'cable.reserveFactor'],
  ['voltageDropMaxPct', 'cable.voltageDrop.maxPct'],
  ['voltageDropLightingPct', 'cable.voltageDrop.lightingPct'],
  ['resistivityCu', 'resistivity.cu'],
  ['resistivityAl', 'resistivity.al'],
]

/**
 * Norms із самих дефолтів (fallback, коли БД порожня чи зіпсована).
 * @returns {Norms}
 */
export function defaultNorms() {
  const byKey = new Map(DEFAULT_NORMS.map((n) => [n.key, n.value]))
  const out = /** @type {Norms} */ ({})
  for (const [field, key] of FIELD_BY_KEY) {
    out[field] = Number(byKey.get(key))
  }
  return out
}

/**
 * Чисте перетворення записів normRefs у Norms. Для кожного поля бере число з БД;
 * якщо ключа немає або значення нечислове — підставляє дефолт (стійкість до
 * неповної/зіпсованої таблиці). Тестовна без Dexie.
 * @param {NormRef[]} records
 * @returns {Norms}
 */
export function toNorms(records) {
  const byKey = new Map(records.map((r) => [r.key, r.value]))
  const fallback = defaultNorms()
  const out = /** @type {Norms} */ ({})
  for (const [field, key] of FIELD_BY_KEY) {
    const raw = byKey.get(key)
    // null/''/undefined Number() мовчки робить 0 — відсіюємо до приведення,
    // щоб «порожнє» значення брало дефолт, а не нуль.
    const num =
      raw === null || raw === undefined || raw === '' ? NaN : Number(raw)
    out[field] = Number.isFinite(num) ? num : fallback[field]
  }
  return out
}

/**
 * Завантажити Norms із Dexie (єдина асинхронна точка звʼязку з БД).
 * @returns {Promise<Norms>}
 */
export async function loadNorms() {
  return toNorms(await listNorms())
}
