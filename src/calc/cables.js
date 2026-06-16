// Підбір перерізу провідника (Ф-6). Чисті функції без I/O — довідник перерізів
// (cableRefs) і нормативи (Norms) приходять аргументами, тож у коді немає
// «магічних чисел» (вимога ТЗ п.5). Підбір за ПУЕ: переріз має пройти за ДВОМА
// умовами — допустимий струм (з запасом) ТА втрата напруги ≤ ліміту. Ліміт
// береться з normRefs (3% освітлення / 5% решта) — фактично перемикач у даних.
// Довжина лінії — єдина орієнтовна (cable.length.default), тож ΔU — оцінка.

import { groupCurrentA } from '@/calc/currents.js'

/** @typedef {import('@/db/db.js').CableRef} CableRef */
/** @typedef {import('@/calc/norms.js').Norms} Norms */
/** @typedef {import('@/model/project-schema.js').Group} Group */
/** @typedef {import('@/model/project-schema.js').GroupLoad} GroupLoad */

/**
 * Результат підбору перерізу. `status`:
 * - `ok` — переріз проходить за струмом і за ΔU;
 * - `voltage_drop` — струм тягне, але ΔU > ліміту навіть на найбільшому перерізі;
 * - `overcurrent` — струм завеликий навіть для найбільшого перерізу;
 * - `no_cable` — у довіднику немає перерізів цього матеріалу;
 * - `no_load` — у лінії немає струму (підбір не потрібен).
 * @typedef {Object} CableSelection
 * @property {'ok'|'voltage_drop'|'overcurrent'|'no_cable'|'no_load'} status
 * @property {CableRef|null} ref Підібраний переріз (або найбільший наявний / null).
 * @property {number|null} crossSectionMm2 Переріз, мм² (дублює ref для зручності).
 * @property {number} designCurrentA Розрахунковий струм із запасом, А.
 * @property {number|null} voltageDropPct Оцінка втрати напруги для ref, %.
 * @property {number} voltageDropLimitPct Застосований ліміт ΔU, %.
 * @property {boolean} ampacityOk Допустимий струм ref ≥ розрахункового з запасом.
 * @property {boolean} withinLimit ΔU ref ≤ ліміту.
 */

/** @typedef {Object} CableOptions
 * @property {1|3} [phases] Фазність лінії (за замовчуванням 1).
 * @property {string} [loadType] Тип навантаження ('lighting' → ліміт ΔU 3%).
 * @property {"cu"|"al"} [material] Матеріал жили (за замовчуванням 'cu').
 */

/** √3 — стала трифазної формули (не норматив). */
const SQRT3 = Math.sqrt(3)

/**
 * Оцінка втрати напруги на лінії, % від відповідної напруги. Спрощено (без
 * реактивного опору): 1-фаза ΔU = 2·I·L·ρ/S відносно фазної; 3-фази
 * ΔU = √3·I·L·ρ/S відносно лінійної. L — єдина орієнтовна довжина з нормативів.
 * @param {number} currentA Робочий струм лінії, А.
 * @param {number} crossSectionMm2 Переріз жили, мм².
 * @param {1|3} phases
 * @param {"cu"|"al"} material
 * @param {Norms} norms
 * @returns {number}
 */
export function voltageDropPct(currentA, crossSectionMm2, phases, material, norms) {
  if (!(currentA > 0) || !(crossSectionMm2 > 0)) return 0
  const rho = material === 'al' ? norms.resistivityAl : norms.resistivityCu
  const len = norms.cableLengthDefault
  const dropV =
    phases === 3
      ? (SQRT3 * currentA * len * rho) / crossSectionMm2
      : (2 * currentA * len * rho) / crossSectionMm2
  const baseV = phases === 3 ? norms.voltageLine : norms.voltagePhase
  return (dropV / baseV) * 100
}

/**
 * Підібрати переріз під розрахунковий струм лінії. Бере найменший переріз
 * (за зростанням), що проходить ОБИДВІ умови (струм із запасом + ΔU ≤ ліміту).
 * Якщо такого немає — повертає найбільший наявний зі статусом-причиною.
 * @param {number} currentA Розрахунковий струм лінії, А.
 * @param {CableOptions|undefined} options
 * @param {CableRef[]} refs Довідник перерізів (будь-яких матеріалів/методів).
 * @param {Norms} norms
 * @returns {CableSelection}
 */
export function selectCable(currentA, options, refs, norms) {
  const material = options?.material === 'al' ? 'al' : 'cu'
  const phases = options?.phases === 3 ? 3 : 1
  const limitPct =
    options?.loadType === 'lighting'
      ? norms.voltageDropLightingPct
      : norms.voltageDropMaxPct
  const designCurrentA = Math.max(0, currentA) * norms.cableReserveFactor

  /**
   * @param {CableSelection['status']} status
   * @param {CableRef|null} ref
   * @param {number|null} voltageDropPct
   * @param {boolean} ampacityOk
   * @param {boolean} withinLimit
   * @returns {CableSelection}
   */
  const result = (status, ref, voltageDropPct, ampacityOk, withinLimit) => ({
    status,
    ref,
    crossSectionMm2: ref ? ref.crossSectionMm2 : null,
    designCurrentA,
    voltageDropPct,
    voltageDropLimitPct: limitPct,
    ampacityOk,
    withinLimit,
  })

  // Лінія без струму — переріз не підбираємо.
  if (!(currentA > 0)) return result('no_load', null, null, true, true)

  const candidates = refs
    .filter((r) => r.material === material)
    .sort((a, b) => a.crossSectionMm2 - b.crossSectionMm2)
  if (!candidates.length) return result('no_cable', null, null, false, false)

  const evaluated = candidates.map((ref) => {
    const dropPct = voltageDropPct(currentA, ref.crossSectionMm2, phases, material, norms)
    return {
      ref,
      dropPct,
      ampacityOk: ref.allowableCurrentA >= designCurrentA,
      withinLimit: dropPct <= limitPct,
    }
  })

  const best = evaluated.find((e) => e.ampacityOk && e.withinLimit)
  if (best) return result('ok', best.ref, best.dropPct, true, true)

  // Жоден не проходить обидві умови → найбільший наявний (макс. струм, мін. ΔU).
  const largest = evaluated[evaluated.length - 1]
  const status = largest.ampacityOk ? 'voltage_drop' : 'overcurrent'
  return result(status, largest.ref, largest.dropPct, largest.ampacityOk, largest.withinLimit)
}

/**
 * Зручний підбір перерізу для групи: рахує струм за описом навантаження
 * (calc/currents.js) і підбирає мідний кабель під тип/фазність навантаження.
 * @param {Group} group
 * @param {CableRef[]} refs
 * @param {Norms} norms
 * @returns {CableSelection}
 */
export function cableForGroup(group, refs, norms) {
  const currentA = groupCurrentA(group?.load, norms)
  return selectCable(
    currentA,
    { phases: group?.load?.phases, loadType: group?.load?.loadType, material: 'cu' },
    refs,
    norms,
  )
}
