// Реактивний шар розрахунку для UI. Тримає нормативи + довідник перерізів
// (із Dexie) і похідний результат повного перерахунку поточного проєкту.
// Сам розрахунок — чиста calcProject (мікросекунди для десятків груп), тож
// рахуємо синхронно в computed. Web Worker (calc/calc-client) лишається для
// майбутніх важких/пакетних перерахунків, а не для живого відображення.

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useProjectStore } from '@/stores/project.store.js'
import { calcProject } from '@/calc/project-calc.js'
import { loadNorms, defaultNorms } from '@/calc/norms.js'
import { listCableRefs } from '@/db/cables.js'
import { DEFAULT_CABLE_REFS } from '@/db/cable-seed.js'

/** @typedef {import('@/db/db.js').CableRef} CableRef */
/** @typedef {import('@/calc/project-calc.js').GroupCalc} GroupCalc */

export const useCalcStore = defineStore('calc', () => {
  const projectStore = useProjectStore()

  /** Нормативи розрахунку (старт — дефолти, до завантаження з Dexie). */
  const norms = ref(defaultNorms())
  /** Довідник перерізів (старт — типові, щоб не було «no_cable» до loadRefs). */
  const cableRefs = ref(/** @type {CableRef[]} */ ([...DEFAULT_CABLE_REFS]))

  /** Перечитати нормативи й перерізи з Dexie (на старті та після редактора). */
  async function reloadRefs() {
    norms.value = await loadNorms()
    cableRefs.value = await listCableRefs()
  }

  /** Повний перерахунок поточного проєкту (реактивний). */
  const result = computed(() =>
    projectStore.project ? calcProject(projectStore.project, norms.value, cableRefs.value) : null,
  )

  /** Розрахунок груп за id — для швидкого доступу зі списку. */
  const byGroupId = computed(() => {
    /** @type {Map<string, GroupCalc>} */
    const map = new Map()
    for (const g of result.value?.groups ?? []) map.set(g.groupId, g)
    return map
  })

  /** Розрахунок ввідного апарата (струм + кабель) або null. */
  const incomer = computed(() => result.value?.incomer ?? null)

  /** Зведена потужність проєкту (навантаження vs допустима) або null. */
  const power = computed(() => result.value?.power ?? null)

  return { norms, cableRefs, reloadRefs, result, byGroupId, incomer, power }
})
