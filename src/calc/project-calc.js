// Повний перерахунок проєкту (Фаза 2): струми всіх груп + підбір кабелів +
// розрахунковий струм/кабель ввідного. Чиста, детермінована функція без I/O —
// нормативи й довідник перерізів приходять аргументами (так само, як у
// currents.js/cables.js). Саме її загортає Web Worker (calc.worker.js), тож
// уся важка логіка лишається тестовною в Node без воркера.

import { groupCurrentA, incomerCurrentA, isConsumer } from '@/calc/currents.js'
import { selectCable, cableForGroup } from '@/calc/cables.js'
import { groupPowerW } from '@/model/group.js'

/** @typedef {import('@/model/project-schema.js').Project} Project */
/** @typedef {import('@/model/project-schema.js').Group} Group */
/** @typedef {import('@/calc/norms.js').Norms} Norms */
/** @typedef {import('@/db/db.js').CableRef} CableRef */
/** @typedef {import('@/calc/cables.js').CableSelection} CableSelection */

/**
 * Розрахунок однієї групи у складі проєкту.
 * @typedef {Object} GroupCalc
 * @property {string} groupId
 * @property {Group['kind']} kind
 * @property {boolean} isConsumer Чи входить у навантаження ввідного.
 * @property {number} currentA Розрахунковий струм групи, А.
 * @property {CableSelection|null} cable Підбір кабелю (лише для споживачів).
 * @property {boolean} phaseMismatch 3-фазна група живиться від 1-фазного вводу.
 */

/**
 * Розрахунок ввідного апарата.
 * @typedef {Object} IncomerCalc
 * @property {number} currentA Розрахунковий струм вводу (сума з коеф. попиту), А.
 * @property {CableSelection} cable Підбір кабелю під ввід.
 * @property {number|null} ratingA Номінал ввідного апарата з supply.main, А (або null).
 * @property {boolean} ratingOk Чи вистачає номіналу: currentA ≤ ratingA (true, якщо номінал не заданий).
 */

/**
 * Зведена потужність проєкту.
 * @typedef {Object} ProjectPower
 * @property {number} powerW Сумарне навантаження всіх груп з коеф. попиту, Вт.
 * @property {number|null} availablePowerW Допустима потужність проєкту (supply), Вт, або null.
 * @property {boolean} withinLimit Чи в межах: powerW ≤ availablePowerW (true, якщо не задано).
 */

/**
 * Результат повного перерахунку проєкту.
 * @typedef {Object} ProjectCalc
 * @property {GroupCalc[]} groups Порядок як у project.groups.
 * @property {IncomerCalc} incomer Ввідний апарат.
 * @property {ProjectPower} power Зведена потужність проєкту.
 */

/**
 * Повний перерахунок проєкту. Для кожної групи — струм; для груп-споживачів ще
 * й підбір кабелю. Окремо — струм ввідного (сума з коеф. попиту) і кабель під
 * нього. Фазність вводу береться з project.supply (а не евристикою), номінал
 * ввідного апарата — з supply.main для перевірки «вистачає / мало».
 * @param {Project|null|undefined} project
 * @param {Norms} norms
 * @param {CableRef[]} cableRefs
 * @returns {ProjectCalc}
 */
export function calcProject(project, norms, cableRefs) {
  const groups = project?.groups ?? []
  const refs = cableRefs ?? []
  const supplyPhases = project?.supply?.phases === 3 ? 3 : 1

  const perGroup = groups.map((g) => {
    const consumer = isConsumer(g)
    return /** @type {GroupCalc} */ ({
      groupId: g.id,
      kind: g.kind,
      isConsumer: consumer,
      currentA: groupCurrentA(g.load, norms),
      cable: consumer ? cableForGroup(g, refs, norms) : null,
      // 3-фазну групу не можна живити від 1-фазного вводу. Зворотне (1-ф група
      // на 3-ф вводі) — норма (однофазні навантаження розкидають по фазах).
      phaseMismatch: consumer && g.load?.phases === 3 && supplyPhases === 1,
    })
  })

  const incomerCurrent = incomerCurrentA(groups, norms)
  const incomerPhases = supplyPhases
  const incomerCable = selectCable(incomerCurrent, { phases: incomerPhases }, refs, norms)
  const ratingA = project?.supply?.main?.ratingA ?? null
  const ratingOk = ratingA == null || incomerCurrent <= ratingA

  // Зведене навантаження проєкту: Σ потужностей груп-споживачів з коеф. попиту.
  let totalPowerW = 0
  for (const g of groups) {
    if (!isConsumer(g)) continue
    const demand = positiveOr(g.load?.demandFactor, norms.demandFactorDefault)
    totalPowerW += groupPowerW(g.load) * demand
  }
  const availablePowerW = project?.supply?.availablePowerW ?? null
  const withinLimit = availablePowerW == null || totalPowerW <= availablePowerW

  return {
    groups: perGroup,
    incomer: { currentA: incomerCurrent, cable: incomerCable, ratingA, ratingOk },
    power: { powerW: totalPowerW, availablePowerW, withinLimit },
  }
}

/**
 * Повернути value, якщо це додатнє скінченне число, інакше fallback.
 * @param {number|undefined} value @param {number} fallback @returns {number}
 */
function positiveOr(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback
}
