// Dexie (IndexedDB) — довідковий і службовий шар, спільний для всіх проєктів.
// Проєкти тут НЕ зберігаються (вони — файли .splus). Див. specs/dexie-catalog.md.

import Dexie from 'dexie'

/** @typedef {import('../model/project-schema.js').Project} Project */
/** @typedef {import('../model/project-schema.js').Draft} Draft */
/** @typedef {import('../model/project-schema.js').DeviceKind} DeviceKind */
/** @typedef {import('../model/project-schema.js').TripCurve} TripCurve */

/**
 * @typedef {Object} Product
 * @property {string} catalogRef
 * @property {string} vendor
 * @property {DeviceKind} device
 * @property {number} poles
 * @property {number} ratingA
 * @property {TripCurve} [curve]
 * @property {number} [residualMa]
 * @property {number} widthModules
 * @property {number} [breakingKa]
 * @property {number} [price]
 * @property {string} [currency]
 * @property {string} [updatedAt]
 */

/**
 * @typedef {Object} SelectivityPair
 * @property {number} [id]
 * @property {string} upstreamRef
 * @property {string} downstreamRef
 * @property {number} selectiveUpToKa
 * @property {string} [note]
 */

/**
 * @typedef {Object} CableRef
 * @property {number} [id]
 * @property {"cu"|"al"} material
 * @property {number} crossSectionMm2
 * @property {number} allowableCurrentA
 * @property {string} [installMethod]
 */

/**
 * @typedef {Object} NormRef
 * @property {string} key
 * @property {string} category
 * @property {unknown} value
 * @property {string} [description]
 */

/**
 * Пресет типового кінцевого приладу (довідник, спільний для всіх проєктів).
 * Допомагає наповнювати розділ «Навантаження» групи — додається як LoadItem.
 * @typedef {Object} AppliancePreset
 * @property {string} id Стабільний слаг, PK (напр. "fridge").
 * @property {string} name Назва приладу (укр.), напр. "Холодильник".
 * @property {string} category Групування у списку (kitchen/lighting/appliance/wet).
 * @property {number} powerW Типова потужність приладу, Вт.
 * @property {number} [cosPhi]
 * @property {1|3} [phases]
 * @property {number} [quantity] Типова кількість (за замовч. 1).
 */

/**
 * @typedef {Object} RecentProject
 * @property {string} id PK (= projectId)
 * @property {string} name
 * @property {string} filePath
 * @property {string} openedAt ISO 8601
 */

/**
 * @typedef {Object} Setting
 * @property {string} key
 * @property {unknown} value
 */

/**
 * Типізована БД: базовий Dexie + аксесори таблиць.
 * @typedef {Dexie & {
 *   products: import('dexie').Table<Product, string>,
 *   selectivity: import('dexie').Table<SelectivityPair, number>,
 *   cableRefs: import('dexie').Table<CableRef, number>,
 *   normRefs: import('dexie').Table<NormRef, string>,
 *   drafts: import('dexie').Table<Draft, string>,
 *   recentProjects: import('dexie').Table<RecentProject, string>,
 *   settings: import('dexie').Table<Setting, string>,
 *   appliancePresets: import('dexie').Table<AppliancePreset, string>,
 * }} SoloplusDB
 */

export const db = /** @type {SoloplusDB} */ (new Dexie('soloplus'))

db.version(1).stores({
  // первинний ключ перший; решта — індекси для пошуку
  products: 'catalogRef, vendor, device, ratingA, [device+ratingA], [vendor+device]',
  selectivity: '++id, upstreamRef, downstreamRef, [upstreamRef+downstreamRef]',
  cableRefs: '++id, material, crossSectionMm2, [material+crossSectionMm2]',
  normRefs: 'key, category',
  drafts: 'projectId, status, dirty, autosaveAt',
  recentProjects: 'id, openedAt',
  settings: 'key',
})

// v2: довідник пресетів типових груп (PK — стабільний слаг id).
db.version(2).stores({
  groupPresets: 'id, category',
})

// v3: пресети груп переосмислено на пресети КІНЦЕВИХ ПРИЛАДІВ (для розділу
// «Навантаження»). Стару таблицю видаляємо (null), додаємо appliancePresets.
db.version(3).stores({
  groupPresets: null,
  appliancePresets: 'id, category',
})
