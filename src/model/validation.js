// Валідація проєкту: (1) структурна — ajv проти project.schema.json при завантаженні;
// (2) правила редактора Рівня 1 — похідні перевірки з docs/04 §9.
// Чисті функції, без побічних ефектів.

import Ajv from 'ajv'
import addFormats from 'ajv-formats'
import projectSchema from '../../schema/project.schema.json' with { type: 'json' }

/** @typedef {import('./project-schema.js').Project} Project */
/** @typedef {import('./project-schema.js').ValidationIssue} ValidationIssue */

const ajv = new Ajv({ allErrors: true, strict: false })
addFormats(ajv)
const validateProjectSchema = ajv.compile(projectSchema)

/**
 * Структурна валідація проти JSON Schema. Викликати при завантаженні файлу.
 * @param {unknown} data
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateProjectStructure(data) {
  const valid = validateProjectSchema(data)
  const errors = valid
    ? []
    : (validateProjectSchema.errors ?? []).map(
        /** @param {import('ajv').ErrorObject} e */
        (e) => `${e.instancePath || '/'} ${e.message ?? ''}`.trim(),
      )
  return { valid: Boolean(valid), errors }
}

/**
 * Перевірки компонування Рівня 1 (docs/04 §9). Похідні, у файлі не зберігаються.
 * @param {Project} project
 * @returns {ValidationIssue[]}
 */
export function checkLayout(project) {
  /** @type {ValidationIssue[]} */
  const issues = []
  const rows = project.enclosure?.rows ?? []
  const placements = project.placements ?? []
  const groups = project.groups ?? []

  for (const row of rows) {
    const inRow = placements.filter((p) => p.rowId === row.id)
    const used = inRow.reduce((s, p) => s + p.widthModules, 0)

    if (used > row.capacityModules) {
      issues.push({
        code: 'rail_overflow',
        severity: 'error',
        rowId: row.id,
        message: `Перевантаження рейки: ${used} > ${row.capacityModules} модуль-місць`,
      })
    }

    const sorted = [...inRow].sort((a, b) => a.startModule - b.startModule)
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]
      const cur = sorted[i]
      if (cur.startModule < prev.startModule + prev.widthModules) {
        issues.push({
          code: 'slot_conflict',
          severity: 'error',
          rowId: row.id,
          message: `Конфлікт позицій на рейці «${row.id}»`,
        })
        break
      }
    }
  }

  const totalCapacity = rows.reduce((s, r) => s + r.capacityModules, 0)
  const totalUsed = placements.reduce((s, p) => s + p.widthModules, 0)
  const reservePct = totalCapacity > 0 ? ((totalCapacity - totalUsed) / totalCapacity) * 100 : 0
  if (reservePct < (project.enclosure?.reserveTargetPct ?? 0)) {
    issues.push({
      code: 'low_reserve',
      severity: 'warning',
      message: `Резерв ${reservePct.toFixed(0)}% < цільового ${project.enclosure.reserveTargetPct}%`,
    })
  }

  const placedRefs = new Set(placements.map((p) => p.groupRef))
  for (const g of groups) {
    if (!placedRefs.has(g.id)) {
      issues.push({
        code: 'group_unplaced',
        severity: 'warning',
        groupRef: g.id,
        message: `Групу «${g.title}» не розміщено`,
      })
    }
  }

  return issues
}
