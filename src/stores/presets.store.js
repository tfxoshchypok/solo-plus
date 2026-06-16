// Реактивний шар пресетів кінцевих приладів для UI. Тримає список приладів із
// Dexie; пікер у розділі «Навантаження» читає його, редактор довідників оновлює
// через reload(). Старт — дефолти, щоб пікер не був порожнім до завантаження.

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { listAppliancePresets } from '@/db/appliance-presets.js'
import { DEFAULT_APPLIANCE_PRESETS } from '@/db/appliance-presets-seed.js'

/** @typedef {import('@/db/db.js').AppliancePreset} AppliancePreset */

export const usePresetStore = defineStore('presets', () => {
  /** Пресети кінцевих приладів (старт — дефолти, до завантаження з Dexie). */
  const appliances = ref(/** @type {AppliancePreset[]} */ ([...DEFAULT_APPLIANCE_PRESETS]))

  /** Перечитати прилади з Dexie (на старті та після редактора довідників). */
  async function reload() {
    appliances.value = await listAppliancePresets()
  }

  /** Прилади, згруповані за категорією (для пікера). */
  const byCategory = computed(() => {
    /** @type {Map<string, AppliancePreset[]>} */
    const map = new Map()
    for (const p of appliances.value) {
      const list = map.get(p.category) ?? []
      list.push(p)
      map.set(p.category, list)
    }
    return map
  })

  return { appliances, reload, byCategory }
})
