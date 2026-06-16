// Генерація стабільних унікальних id для сутностей моделі.
// Стабільність важлива, щоб посилання (groupRef, rowId) не ламались.

/**
 * Унікальний id з префіксом сутності, напр. uid('prj') → "prj_a1b2c3".
 * Використовує crypto.randomUUID (доступний у webview і Node ≥ 16).
 * @param {string} prefix
 * @returns {string}
 */
export function uid(prefix) {
  const rand = crypto.randomUUID().replace(/-/g, '').slice(0, 8)
  return `${prefix}_${rand}`
}
