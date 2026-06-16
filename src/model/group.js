// Похідні від групи (лінії) величини. Чисті функції без I/O.
// Група = один апарат (spec); до лінії приєднано кілька приладів (load.items).

/** @typedef {import('@/model/project-schema.js').Group} Group */
/** @typedef {import('@/model/project-schema.js').ApparatusSpec} ApparatusSpec */
/** @typedef {import('@/model/project-schema.js').GroupLoad} GroupLoad */

/**
 * Ширина групи в модулях = ширина її апарата.
 * @param {Group} group
 * @returns {number}
 */
export function groupWidthModules(group) {
  return group?.spec?.widthModules ?? 0
}

/**
 * Сумарна потужність приладів на лінії, Вт (powerW × кількість).
 * @param {GroupLoad|undefined} load
 * @returns {number}
 */
export function groupPowerW(load) {
  return (load?.items ?? []).reduce((s, it) => s + (it?.powerW ?? 0) * (it?.quantity ?? 1), 0)
}

/**
 * Дефолтний апарат нової групи: 1-фаз. автомат C16, 1 модуль.
 * @returns {ApparatusSpec}
 */
export function defaultSpec() {
  return { device: 'breaker', poles: 1, ratingA: 16, curve: 'C', widthModules: 1 }
}
