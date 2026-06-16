// Канонічні переліки варіантів для форм. Тримаються тут (одне джерело),
// щоб компоненти й i18n не розходились. Значення збігаються з типами схеми.

/** @typedef {import('@/model/project-schema.js').DeviceKind} DeviceKind */
/** @typedef {import('@/model/project-schema.js').GroupKind} GroupKind */
/** @typedef {import('@/model/project-schema.js').TripCurve} TripCurve */

/** @type {DeviceKind[]} */
export const DEVICE_KINDS = [
  'breaker',
  'rcd',
  'rcbo',
  'switch',
  'surge',
  'timer',
  'impulse_relay',
  'bell',
  'socket',
  'indicator',
  'phase_selector',
  'smart_home',
  'voltage_relay',
  'contactor',
  'terminal',
  'meter',
  'power_supply',
  'other',
]

/** @type {GroupKind[]} Ввід — у Project.supply, не в groups[] (schema 1.2). */
export const GROUP_KINDS = ['group', 'rcd']

/** @type {TripCurve[]} */
export const TRIP_CURVES = ['B', 'C', 'D']

/** @type {(1|2|3|4)[]} */
export const POLES = [1, 2, 3, 4]

/** Типові номінали автоматів, А. */
export const RATINGS_A = [6, 10, 16, 20, 25, 32, 40, 50, 63]

/** Чи показувати поле «крива» для цього типу пристрою. @param {DeviceKind} d */
export function hasCurve(d) {
  return d === 'breaker' || d === 'rcbo'
}

/** Чи показувати поле «диф. струм» для цього типу пристрою. @param {DeviceKind} d */
export function hasResidual(d) {
  return d === 'rcd' || d === 'rcbo'
}
