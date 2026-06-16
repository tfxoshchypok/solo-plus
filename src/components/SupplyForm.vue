<script setup>
// Параметри живлення (ввід) — властивість проєкту. Картка-зведення + інлайн-форма.
import { ref, reactive, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { NCard, NButton, NSelect, NInputNumber, NCheckbox, NSpace, NGrid, NFormItemGi, NTag } from 'naive-ui'
import { t } from '@/i18n/uk.js'
import { useProjectStore } from '@/stores/project.store.js'
import { useCalcStore } from '@/stores/calc.store.js'
import { TRIP_CURVES } from '@/model/options.js'

/** @typedef {import('@/model/project-schema.js').Supply} Supply */
/** @typedef {import('@/model/project-schema.js').ApparatusSpec} ApparatusSpec */

const store = useProjectStore()
const calc = useCalcStore()
const { project } = storeToRefs(store)
const { incomer, power } = storeToRefs(calc)

const editing = ref(false)
const supply = computed(() => project.value?.supply ?? { phases: 1, voltage: 230 })

const phaseOptions = [
  { label: t('supply.phase1'), value: 1 },
  { label: t('supply.phase3'), value: 3 },
]
const poleOptions = [1, 2, 3, 4].map((p) => ({ label: `${p}P`, value: p }))
const curveOptions = TRIP_CURVES.map((c) => ({ label: c, value: c }))

const draft = reactive({
  phases: /** @type {1|3} */ (1),
  voltage: 230,
  hasMain: false,
  ratingA: 40,
  poles: /** @type {1|2|3|4} */ (1),
  curve: 'C',
  availablePowerW: /** @type {number|null} */ (null),
})

function startEdit() {
  const s = supply.value
  draft.phases = s.phases
  draft.voltage = s.voltage
  draft.hasMain = Boolean(s.main)
  draft.ratingA = s.main?.ratingA ?? 40
  draft.poles = s.main?.poles ?? (s.phases === 3 ? 3 : 1)
  draft.curve = s.main?.curve ?? 'C'
  draft.availablePowerW = s.availablePowerW ?? null
  editing.value = true
}

function onPhasesChange() {
  draft.voltage = draft.phases === 3 ? 400 : 230
  if (draft.poles < draft.phases) draft.poles = draft.phases === 3 ? 3 : 1
}

function onSave() {
  /** @type {Partial<Supply>} */
  const patch = { phases: draft.phases, voltage: Number(draft.voltage) }
  if (draft.hasMain && draft.ratingA > 0) {
    /** @type {ApparatusSpec} */
    const main = {
      device: 'breaker',
      poles: draft.poles,
      ratingA: Number(draft.ratingA),
      curve: draft.curve,
      widthModules: draft.poles,
    }
    patch.main = main
  } else {
    patch.main = undefined
  }
  patch.availablePowerW = draft.availablePowerW != null ? Number(draft.availablePowerW) : undefined
  store.updateSupply(patch)
  editing.value = false
}

/** Короткий підпис фазності для чипа. */
const phasesLabel = computed(() =>
  supply.value.phases === 3 ? t('supply.phase3Short') : t('supply.phase1Short'),
)
</script>

<template>
  <n-card :title="t('supply.heading')" size="small" class="block-card">
    <template #header-extra>
      <n-button v-if="!editing" size="small" tertiary @click="startEdit">{{ t('supply.edit') }}</n-button>
    </template>

    <!-- Зведення -->
    <div v-if="!editing" class="view">
      <!-- Характеристики вводу з акцентом -->
      <div class="specs">
        <span class="chip chip-kind">{{ phasesLabel }}</span>
        <span class="chip chip-volt">{{ supply.voltage }} В</span>
        <template v-if="supply.main">
          <span class="chip chip-device">{{ t('supply.secMain') }}</span>
          <span class="chip chip-rating">{{ supply.main.ratingA }} A</span>
          <span class="chip">{{ supply.main.poles }}P</span>
          <span v-if="supply.main.curve" class="chip">{{ supply.main.curve }}</span>
        </template>
        <span v-else class="chip chip-none">{{ t('supply.noMain') }}</span>
      </div>

      <!-- Статусні показники (струм / навантаження) -->
      <div v-if="(incomer && incomer.ratingA != null && incomer.currentA > 0) || (power && power.powerW > 0)" class="status">
        <n-tag
          v-if="incomer && incomer.ratingA != null && incomer.currentA > 0"
          :type="incomer.ratingOk ? 'success' : 'error'"
          size="small"
          round
        >
          {{ incomer.currentA.toFixed(1) }} / {{ incomer.ratingA }} {{ t('calc.ampUnit') }}
          <template v-if="!incomer.ratingOk"> · {{ t('calc.ratingOver') }}</template>
        </n-tag>
        <n-tag
          v-if="power && power.powerW > 0"
          :type="power.withinLimit ? 'success' : 'error'"
          size="small"
          round
        >
          {{ t('supply.load') }}: {{ Math.round(power.powerW) }}<template v-if="power.availablePowerW != null"> / {{ power.availablePowerW }}</template>
          {{ t('groups.powerUnit') }}
          <template v-if="!power.withinLimit"> · {{ t('supply.loadOver') }}</template>
        </n-tag>
      </div>
    </div>

    <!-- Форма -->
    <div v-else class="edit-form">
      <div class="subhead">{{ t('supply.secNetwork') }}</div>
      <n-grid :cols="24" :x-gap="12" :y-gap="4">
        <n-form-item-gi :span="12" :label="t('supply.phases')" :show-feedback="false">
          <n-select v-model:value="draft.phases" :options="phaseOptions" @update:value="onPhasesChange" />
        </n-form-item-gi>
        <n-form-item-gi :span="12" :label="t('supply.voltage')" :show-feedback="false">
          <n-input-number v-model:value="draft.voltage" :min="1" style="width: 100%" />
        </n-form-item-gi>
        <n-form-item-gi :span="24" :label="t('supply.availablePowerW')" :show-feedback="false">
          <n-input-number v-model:value="draft.availablePowerW" :min="0" style="width: 100%" />
        </n-form-item-gi>
      </n-grid>

      <div class="subhead">{{ t('supply.secMain') }}</div>
      <n-checkbox v-model:checked="draft.hasMain">{{ t('supply.enableMain') }}</n-checkbox>
      <n-grid v-if="draft.hasMain" :cols="24" :x-gap="12" :y-gap="4" style="margin-top: 8px">
        <n-form-item-gi :span="8" :label="t('supply.mainRatingA')" :show-feedback="false">
          <n-input-number v-model:value="draft.ratingA" :min="1" style="width: 100%" />
        </n-form-item-gi>
        <n-form-item-gi :span="8" :label="t('supply.mainPoles')" :show-feedback="false">
          <n-select v-model:value="draft.poles" :options="poleOptions" />
        </n-form-item-gi>
        <n-form-item-gi :span="8" :label="t('supply.mainCurve')" :show-feedback="false">
          <n-select v-model:value="draft.curve" :options="curveOptions" />
        </n-form-item-gi>
      </n-grid>

      <n-space justify="end" style="margin-top: 14px">
        <n-button size="small" @click="editing = false">{{ t('supply.cancel') }}</n-button>
        <n-button size="small" type="primary" @click="onSave">{{ t('supply.save') }}</n-button>
      </n-space>
    </div>
  </n-card>
</template>

<style scoped>
/* Відступ між акцентним заголовком-банером і вмістом картки. */
.view,
.edit-form {
  margin-top: 14px;
}
.view {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
/* Характеристики вводу — акцентовані «чипи» (узгоджено зі списком груп). */
.specs {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.chip {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.7;
  padding: 0 8px;
  border-radius: 5px;
  color: var(--brand-color);
  border: 1px solid color-mix(in srgb, var(--brand-color) 35%, transparent);
  background: color-mix(in srgb, var(--brand-color) 8%, transparent);
}
/* Фазність та підпис «Ввідний апарат» — нейтральний контекст. */
.chip-kind,
.chip-device {
  border: none;
  background: none;
  padding: 0;
  color: var(--n-text-color, inherit);
}
.chip-kind {
  font-weight: 700;
}
.chip-device {
  font-weight: 700;
  margin-left: 4px;
}
.chip-volt {
  opacity: 0.9;
}
/* Номінал ввідного — головна характеристика: суцільна заливка акцентом. */
.chip-rating {
  font-size: 14px;
  color: #fff;
  background: var(--brand-color);
  border-color: var(--brand-color);
}
.chip-none {
  border: none;
  background: none;
  padding: 0;
  margin-left: 4px;
  font-weight: 500;
  color: var(--n-text-color, inherit);
  opacity: 0.55;
}
.status {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
/* Заголовок логічної секції форми (узгоджено з формою групи). */
.subhead {
  font-size: 13px;
  color: #999;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-weight: 600;
  margin: 4px 0 8px;
}
.subhead:not(:first-child) {
  margin-top: 18px;
}
</style>
