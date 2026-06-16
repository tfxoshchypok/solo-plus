// Розрахунок струмів (Ф-3). Чисті функції без I/O — нормативи приходять
// аргументом Norms (див. calc/norms.js), тож у коді немає «магічних чисел».
// 1-фаза: I = P / (U_ф · cosφ); 3-фази: I = P / (√3 · U_л · cosφ).
// Струм ввідного = Σ струмів груп-споживачів з урахуванням коеф. попиту.

/** @typedef {import('@/model/project-schema.js').Group} Group */
/** @typedef {import('@/model/project-schema.js').GroupLoad} GroupLoad */
/** @typedef {import('@/calc/norms.js').Norms} Norms */

/** √3 — математична стала для трифазної потужності (не норматив). */
const SQRT3 = Math.sqrt(3)

/**
 * Розрахунковий струм однієї групи (лінії), А — сума струмів усіх приладів на
 * лінії. Для кожного приладу: P = powerW × кількість; струм за фазністю лінії
 * (1-ф: P/(Uф·cosφ); 3-ф: P/(√3·Uл·cosφ)). cosφ — приладу або дефолт.
 * Порожній/відсутній перелік приладів → 0.
 * @param {GroupLoad|undefined} load
 * @param {Norms} norms
 * @returns {number}
 */
export function groupCurrentA(load, norms) {
  const items = load?.items ?? []
  if (!items.length) return 0
  const phases = load?.phases === 3 ? 3 : 1

  let total = 0
  for (const it of items) {
    const powerW = (it?.powerW ?? 0) * (it?.quantity ?? 1)
    if (!(powerW > 0)) continue
    const cosPhi = positiveOr(it?.cosPhi, norms.cosPhiDefault)
    total +=
      phases === 3
        ? powerW / (SQRT3 * norms.voltageLine * cosPhi)
        : powerW / (norms.voltagePhase * cosPhi)
  }
  return total
}

/**
 * Чи бере група участь у навантаженні ввідного. Окремий ПЗВ/ДВ (kind==='rcd')
 * — не споживач (захисний апарат без власного навантаження), у суму струмів не
 * входить. Сам ввід — у Project.supply, серед груп його немає (schema 1.2).
 * @param {Group} g
 * @returns {boolean}
 */
export function isConsumer(g) {
  return g.kind !== 'rcd'
}

/**
 * Струми всіх груп-споживачів (для UI/редактора). Кожен елемент — {groupId,
 * currentA}. Неспоживчі групи (ввід/ПЗВ) пропускаються.
 * @param {Group[]} groups
 * @param {Norms} norms
 * @returns {{ groupId: string, currentA: number }[]}
 */
export function groupCurrents(groups, norms) {
  return groups
    .filter(isConsumer)
    .map((g) => ({ groupId: g.id, currentA: groupCurrentA(g.load, norms) }))
}

/**
 * Розрахунковий струм ввідного апарата, А: сума струмів груп-споживачів,
 * кожен помножений на свій коефіцієнт попиту (з групи або дефолтний).
 * @param {Group[]} groups
 * @param {Norms} norms
 * @returns {number}
 */
export function incomerCurrentA(groups, norms) {
  let total = 0
  for (const g of groups) {
    if (!isConsumer(g)) continue
    const demand = positiveOr(g.load?.demandFactor, norms.demandFactorDefault)
    total += groupCurrentA(g.load, norms) * demand
  }
  return total
}

/**
 * Повернути value, якщо це додатнє скінченне число, інакше fallback.
 * (cosφ=0 чи відʼємний коеф. — некоректні, беремо дефолт.)
 * @param {number|undefined} value
 * @param {number} fallback
 * @returns {number}
 */
function positiveOr(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : fallback
}
