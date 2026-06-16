// Геометрія редактора: перетворення модульних координат у пікселі й назад.
// Модель оперує модулями (1 модуль = 17,5 мм); канвас переводить у пікселі (docs/04 §1).

import { MODULE_WIDTH_MM } from '@/model/project-schema.js'

/** Масштаб рендеру: екранних пікселів на міліметр. */
export const PX_PER_MM = 3.2

/** Ширина одного модуль-місця у пікселях. */
export const MODULE_PX = MODULE_WIDTH_MM * PX_PER_MM

/**
 * Стартовий слот → X у пікселях усередині рейки.
 * @param {number} startModule
 * @returns {number}
 */
export function moduleToX(startModule) {
  return startModule * MODULE_PX
}

/**
 * Довільний X (px) → найближчий слот (ціле число модуль-місць).
 * @param {number} x
 * @returns {number}
 */
export function xToModule(x) {
  return Math.round(x / MODULE_PX)
}

/**
 * Ширина в модулях → ширина в пікселях.
 * @param {number} widthModules
 * @returns {number}
 */
export function widthToPx(widthModules) {
  return widthModules * MODULE_PX
}
