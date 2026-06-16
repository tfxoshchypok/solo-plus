// Дефолтний довідник перерізів провідників (таблиця cableRefs).
// allowableCurrentA зберігається ВЖЕ розв'язаним під конкретний installMethod
// (коефіцієнти прокладання — у даних, не у формулі). MVP сіє лише мідь у трубі
// ('conduit'); алюміній і інші методи користувач додає в редакторі довідників.
// Числа — орієнтовні плейсхолдери (ПУЕ, мідь у трубі). Див. specs/dexie-catalog.md.

import { db } from '@/db/db.js'

/** @typedef {import('@/db/db.js').CableRef} CableRef */

/**
 * Канонічний набір перерізів за замовчуванням (мідь, прокладання у трубі).
 * @type {ReadonlyArray<CableRef>}
 */
export const DEFAULT_CABLE_REFS = [
  { material: 'cu', crossSectionMm2: 1.5, allowableCurrentA: 16, installMethod: 'conduit' },
  { material: 'cu', crossSectionMm2: 2.5, allowableCurrentA: 21, installMethod: 'conduit' },
  { material: 'cu', crossSectionMm2: 4, allowableCurrentA: 27, installMethod: 'conduit' },
  { material: 'cu', crossSectionMm2: 6, allowableCurrentA: 34, installMethod: 'conduit' },
  { material: 'cu', crossSectionMm2: 10, allowableCurrentA: 46, installMethod: 'conduit' },
  { material: 'cu', crossSectionMm2: 16, allowableCurrentA: 62, installMethod: 'conduit' },
  { material: 'cu', crossSectionMm2: 25, allowableCurrentA: 80, installMethod: 'conduit' },
]

/** Стабільний підпис рядка для ідемпотентності (PK ++id не годиться для dedupe). */
const sig = (/** @type {CableRef} */ r) =>
  `${r.material}|${r.crossSectionMm2}|${r.installMethod ?? ''}`

/**
 * Залити дефолтні перерізи у Dexie, НЕ перетираючи наявні (idempotent):
 * додаються лише відсутні комбінації material+переріз+метод. Безпечно на старті.
 * @returns {Promise<void>}
 */
export async function seedCableRefs() {
  const have = new Set((await db.cableRefs.toArray()).map(sig))
  const missing = DEFAULT_CABLE_REFS.filter((r) => !have.has(sig(r)))
  if (missing.length) await db.cableRefs.bulkAdd([...missing])
}
