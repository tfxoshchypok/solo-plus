/**
 * solo.plus — контракт моделі даних проєкту (JavaScript + JSDoc).
 * Єдине джерело правди для коду фронтенду й розрахунків.
 * Відповідає docs/04_data-model (schemaVersion 1.3).
 *
 * Принцип: проєкт описує АБСТРАКТНІ елементи (характеристики).
 * Прив'язка до конкретних виробів — окремий опційний шар (ProductBinding).
 *
 * Типи описані через JSDoc-тег typedef. Перевірка типів — `tsc --checkJs`
 * (без .ts-файлів). Жодного TypeScript-синтаксису.
 */

/** Одиниця ширини модульного обладнання: 1 модуль = 17,5 мм. */
export const MODULE_WIDTH_MM = 17.5;

/** @typedef {"1.3"} SchemaVersion */

// ─────────────────────────────────────────────────────────────
// Кореневий обʼєкт проєкту
// ─────────────────────────────────────────────────────────────
/**
 * @typedef {Object} Project
 * @property {SchemaVersion} schemaVersion
 * @property {ProjectMeta} project
 * @property {Supply} supply Параметри живлення щитка (ввід — властивість проєкту).
 * @property {Enclosure} enclosure
 * @property {Group[]} groups
 * @property {Placement[]} placements
 * @property {Busbars} busbars
 * @property {ProductBinding} [productBinding] Окремий шар прив'язки до виробів.
 *           Відсутній → працює безкоштовне ядро.
 */

// ─────────────────────────────────────────────────────────────
// Живлення щитка (ввід) — задається раз на проєкт
// ─────────────────────────────────────────────────────────────
/**
 * Параметри живлення. Сам ввід — НЕ навантаження: струм вводу рахується із
 * груп-споживачів і порівнюється з номіналом ввідного апарата (main.ratingA).
 * @typedef {Object} Supply
 * @property {1|3} phases Фазність вводу (1-фазний / 3-фазний).
 * @property {number} voltage Напруга мережі, В (230 для 1-ф, 400 для 3-ф).
 * @property {ApparatusSpec} [main] Ввідний апарат (абстрактний spec) — необов'язковий.
 * @property {number} [availablePowerW] Договірна/доступна потужність, Вт.
 */

/**
 * @typedef {Object} ProjectMeta
 * @property {string} id
 * @property {string} name
 * @property {string} [createdAt] ISO 8601
 * @property {string} [updatedAt] ISO 8601
 * @property {string} [referencePdf] Відносний шлях до прикріпленого PDF у контейнері.
 */

// ─────────────────────────────────────────────────────────────
// Корпус і DIN-рейки
// ─────────────────────────────────────────────────────────────
/** @typedef {"surface"|"flush"} EnclosureType накладний | вбудований */

/**
 * @typedef {Object} Enclosure
 * @property {EnclosureType} type
 * @property {string} ip напр. "IP40"
 * @property {Rail[]} rows
 * @property {number} reserveTargetPct Поріг попередження про резерв, %.
 */

/**
 * @typedef {Object} Rail
 * @property {string} id
 * @property {number} index Порядок зверху вниз, 0-based.
 * @property {number} capacityModules Ємність рейки в модулях.
 */

// ─────────────────────────────────────────────────────────────
// Абстрактна специфікація елемента (БЕЗ бренду)
// ─────────────────────────────────────────────────────────────
/** @typedef {"breaker"|"rcd"|"rcbo"|"switch"|"surge"|"timer"|"impulse_relay"|"bell"|"socket"|"indicator"|"phase_selector"|"smart_home"|"voltage_relay"|"contactor"|"terminal"|"meter"|"power_supply"|"other"} DeviceKind */
/** @typedef {"B"|"C"|"D"} TripCurve */
/** @typedef {"L1"|"L2"|"L3"} Phase */

/**
 * @typedef {Object} ApparatusSpec
 * @property {DeviceKind} device
 * @property {1|2|3|4} poles
 * @property {number} ratingA Номінальний струм, А.
 * @property {TripCurve} [curve] Для автоматів.
 * @property {number} [residualMa] Диф. струм, мА — для rcd/rcbo.
 * @property {number} widthModules Ширина в модулях (характеристика, не виріб).
 */

// ─────────────────────────────────────────────────────────────
// Групи (джерело з розрахунку)
// ─────────────────────────────────────────────────────────────
/** @typedef {"rcd"|"group"} GroupKind Ввід винесено в Project.supply (schema 1.2). */

/**
 * Група — ОДИН апарат (автомат) на щитку = одна лінія. До лінії може бути
 * приєднано КІЛЬКА кінцевих приладів (навантажень) — їх перелік у `load.items`.
 * Сумарна потужність/струм групи = сума приладів.
 * @typedef {Object} Group
 * @property {string} id
 * @property {GroupKind} kind
 * @property {string} title
 * @property {ApparatusSpec} spec Апарат групи (один).
 * @property {GroupLoad} [load] Навантаження лінії (вхід для розрахунку).
 */

/**
 * Один кінцевий прилад на лінії (споживач). Потужність × кількість.
 * @typedef {Object} LoadItem
 * @property {string} [name] Назва приладу (напр. "Холодильник").
 * @property {number} powerW Потужність одного приладу, Вт.
 * @property {number} [cosPhi]
 * @property {number} [quantity] Кількість однакових приладів (за замовч. 1).
 */

/**
 * Навантаження лінії: параметри лінії (фази/тип/коеф. попиту) + перелік приладів.
 * @typedef {Object} GroupLoad
 * @property {1|3} [phases]
 * @property {string} [loadType] напр. "lighting" | "sockets" | "motor"
 * @property {number} [demandFactor]
 * @property {LoadItem[]} items Кінцеві прилади на лінії.
 */

// ─────────────────────────────────────────────────────────────
// Розміщення на рейці (серце редактора)
// ─────────────────────────────────────────────────────────────
/**
 * @typedef {Object} Placement
 * @property {string} id
 * @property {string} groupRef → Group.id
 * @property {string} rowId → Rail.id
 * @property {number} startModule Стартовий слот, 0-based.
 * @property {number} widthModules Дубль spec.widthModules для швидкої валідації.
 * @property {Phase|null} [phase] Для 1-фазних на 3-фазній шині.
 * @property {string} label Маркування на канвасі та для бирки.
 */

// ─────────────────────────────────────────────────────────────
// Шини
// ─────────────────────────────────────────────────────────────
/**
 * @typedef {Object} Busbars
 * @property {{present: boolean}} neutral
 * @property {{present: boolean}} pe
 *
 * Note: combs?: Comb[] — Рівень 3 (гребінчасті шини), додається пізніше.
 */

// ─────────────────────────────────────────────────────────────
// Шар прив'язки до виробів (платний)
// ─────────────────────────────────────────────────────────────
/**
 * @typedef {Object} ProductBinding
 * @property {string} [vendor]
 * @property {ProductBindingItem[]} items
 * @property {boolean} [selectivityChecked] Чи виконано точну перевірку
 *           селективності по кривих виробника.
 */

/**
 * @typedef {Object} ProductBindingItem
 * @property {string} groupRef → Group.id
 * @property {string} catalogRef Артикул у Dexie-каталозі.
 * @property {number} [price] Кеш ціни на момент прив'язки.
 * @property {string} [currency] напр. "UAH"
 */

// ─────────────────────────────────────────────────────────────
// Результати валідації редактора (похідні, НЕ зберігаються)
// ─────────────────────────────────────────────────────────────
/**
 * @typedef {"rail_overflow"|"slot_conflict"|"low_reserve"|"group_unplaced"|"phase_imbalance"} ValidationCode
 */

/**
 * @typedef {Object} ValidationIssue
 * @property {ValidationCode} code
 * @property {"error"|"warning"} severity
 * @property {string} [rowId]
 * @property {string} [groupRef]
 * @property {string} message
 */

// ─────────────────────────────────────────────────────────────
// Автозбереження-чернетка (зберігається в Dexie, НЕ у файлі)
// ─────────────────────────────────────────────────────────────
/**
 * @typedef {Object} Draft
 * @property {string} projectId Ключ.
 * @property {string|null} filePath Шлях до файлу проєкту; null якщо ще не збережено.
 * @property {Project} projectJson Поточний стан БЕЗ вкладеного PDF.
 * @property {string|null} baseSavedAt Мітка часу файлу, на якому базується.
 * @property {string} autosaveAt Час останнього автозбереження.
 * @property {boolean} dirty Є незбережені у файл зміни.
 * @property {"open"|"closed"} status
 */

// Файл лише з типами й константами. export потрібен, щоб модуль
// підхоплювався збіркою; типи доступні через import("./project-schema.js").Project
