<script setup>
import { ref, reactive, computed } from 'vue'
import { storeToRefs } from 'pinia'
import {
  NGrid,
  NFormItemGi,
  NInput,
  NInputNumber,
  NSelect,
  NButton,
  NButtonGroup,
  NSpace,
  NCheckboxGroup,
  NCheckbox,
  NAlert,
  NText,
  NIcon,
  NCollapseTransition,
} from 'naive-ui'
import { AddOutline, TrashOutline } from '@vicons/ionicons5'
import { t } from '@/i18n/uk.js'
import { DEVICE_KINDS, GROUP_KINDS, TRIP_CURVES, POLES, hasCurve, hasResidual } from '@/model/options.js'
import { usePresetStore } from '@/stores/presets.store.js'
import { useCalcStore } from '@/stores/calc.store.js'
import { presetToLoadItem } from '@/model/presets.js'
import { groupCurrentA } from '@/calc/currents.js'

/** @typedef {import('@/model/project-schema.js').Group} Group */
/** @typedef {import('@/model/project-schema.js').ApparatusSpec} ApparatusSpec */
/** @typedef {import('@/model/project-schema.js').LoadItem} LoadItem */

const props = defineProps({
  /** @type {() => Group|null} */
  group: { type: Object, default: null },
})
const emit = defineEmits(['save', 'cancel'])

const presetStore = usePresetStore()
const { appliances } = storeToRefs(presetStore)
const calcStore = useCalcStore()
const { norms } = storeToRefs(calcStore)

const g = props.group

const deviceOptions = DEVICE_KINDS.map((d) => ({ label: t('device.' + d), value: d }))
const kindOptions = GROUP_KINDS.map((k) => ({ label: t('groupKind.' + k), value: k }))
const poleOptions = POLES.map((p) => ({ label: `${p}P`, value: p }))
const curveOptions = TRIP_CURVES.map((c) => ({ label: t('curve.' + c), value: c }))
const phaseOptions = [
  { label: '—', value: null },
  { label: '1', value: 1 },
  { label: '3', value: 3 },
]
// Тип навантаження. Лише 'lighting' впливає на розрахунок (жорсткіший ліміт
// ΔU); решта — описова метаінформація. Порожнє значення = не задано.
const loadTypeOptions = [
  { label: '—', value: '' },
  { label: t('loadKind.lighting'), value: 'lighting' },
  { label: t('loadKind.sockets'), value: 'sockets' },
  { label: t('loadKind.power'), value: 'power' },
  { label: t('loadKind.motor'), value: 'motor' },
  { label: t('loadKind.heating'), value: 'heating' },
]

function blankItem() {
  return { name: '', powerW: 0, cosPhi: null, quantity: 1 }
}

const draft = reactive({
  kind: g?.kind ?? 'group',
  title: g?.title ?? 'Нова група',
  device: g?.spec.device ?? 'breaker',
  poles: g?.spec.poles ?? 1,
  ratingA: g?.spec.ratingA ?? 16,
  curve: g?.spec.curve ?? 'C',
  residualMa: g?.spec.residualMa ?? 30,
  widthModules: g?.spec.widthModules ?? 1,
  phases: g?.load?.phases ?? null,
  loadType: g?.load?.loadType ?? '',
  demandFactor: g?.load?.demandFactor ?? null,
  items: (g?.load?.items?.length ? g.load.items : [blankItem()]).map((it) => ({
    name: it.name ?? '',
    powerW: it.powerW ?? 0,
    cosPhi: it.cosPhi ?? null,
    quantity: it.quantity ?? 1,
  })),
})

const showCurve = computed(() => hasCurve(draft.device))
const showResidual = computed(() => hasResidual(draft.device))
const totalPowerW = computed(() =>
  draft.items.reduce((s, it) => s + (Number(it.powerW) || 0) * (Number(it.quantity) || 1), 0),
)
// Кількість приладів, що реально дають навантаження (P > 0).
const itemCount = computed(() => draft.items.filter((it) => Number(it.powerW) > 0).length)
// Орієнтовний розрахунковий струм лінії — та сама формула, що й у рушії
// розрахунку (currents.js), на «живих» даних чернетки.
const totalCurrentA = computed(() =>
  groupCurrentA({ items: draft.items, phases: draft.phases ?? undefined }, norms.value),
)

function addItem() {
  draft.items.push(blankItem())
}
/** @param {number} i */
function removeItem(i) {
  draft.items.splice(i, 1)
}

// Мультивибір приладів із пресетів.
const presetPanelOpen = ref(false)
const selectedIds = ref(/** @type {string[]} */ ([]))

function addSelectedPresets() {
  for (const p of appliances.value) {
    if (!selectedIds.value.includes(p.id)) continue
    const li = presetToLoadItem(p)
    draft.items.push({ name: li.name ?? '', powerW: li.powerW, cosPhi: li.cosPhi ?? null, quantity: li.quantity ?? 1 })
    if (draft.phases == null && p.phases != null) draft.phases = p.phases
  }
  selectedIds.value = []
  presetPanelOpen.value = false
}

const errors = computed(() => {
  /** @type {string[]} */
  const e = []
  if (!draft.title.trim()) e.push(t('groups.titleRequired'))
  if (!(draft.ratingA > 0)) e.push(t('groups.ratingPositive'))
  return e
})
const valid = computed(() => errors.value.length === 0)

function onSave() {
  if (!valid.value) return
  /** @type {ApparatusSpec} */
  const spec = {
    device: draft.device,
    poles: draft.poles,
    ratingA: Number(draft.ratingA),
    widthModules: Number(draft.widthModules),
  }
  if (showCurve.value) spec.curve = draft.curve
  if (showResidual.value) spec.residualMa = Number(draft.residualMa)

  /** @type {LoadItem[]} */
  const items = draft.items
    .filter((it) => Number(it.powerW) > 0)
    .map((it) => {
      /** @type {LoadItem} */
      const li = { powerW: Number(it.powerW) }
      if (it.name.trim()) li.name = it.name.trim()
      if (it.cosPhi != null) li.cosPhi = Number(it.cosPhi)
      if (Number(it.quantity) > 1) li.quantity = Number(it.quantity)
      return li
    })

  /** @type {import('@/model/project-schema.js').GroupLoad|undefined} */
  let load
  const hasLoad = items.length || draft.phases != null || draft.loadType || draft.demandFactor != null
  if (hasLoad) {
    load = { items }
    if (draft.phases != null) load.phases = draft.phases
    if (draft.loadType) load.loadType = draft.loadType
    if (draft.demandFactor != null) load.demandFactor = Number(draft.demandFactor)
  }

  emit('save', { kind: draft.kind, title: draft.title.trim(), spec, load })
}
</script>

<template>
  <div class="form">
    <div class="cols">
      <!-- Ліва колонка: ідентифікація + апарат + параметри навантаження -->
      <div class="col col-left">
        <div class="subhead">{{ t('groups.secIdentity') }}</div>
        <n-grid :cols="24" :x-gap="12" :y-gap="4">
          <n-form-item-gi :span="14" :label="t('groups.title')" :show-feedback="false">
            <n-input v-model:value="draft.title" />
          </n-form-item-gi>
          <n-form-item-gi :span="10" :label="t('groups.kind')" :show-feedback="false">
            <n-select v-model:value="draft.kind" :options="kindOptions" />
          </n-form-item-gi>
        </n-grid>

        <div class="subhead">{{ t('groups.secApparatus') }}</div>
        <n-grid :cols="24" :x-gap="12" :y-gap="4">
          <n-form-item-gi :span="24" :label="t('groups.device')" :show-feedback="false">
            <n-select v-model:value="draft.device" :options="deviceOptions" filterable />
          </n-form-item-gi>
          <n-form-item-gi :span="6" :label="t('groups.poles')" :show-feedback="false">
            <n-select v-model:value="draft.poles" :options="poleOptions" />
          </n-form-item-gi>
          <n-form-item-gi :span="6" :label="t('groups.ratingA')" :show-feedback="false">
            <n-input-number v-model:value="draft.ratingA" :min="1" style="width: 100%" />
          </n-form-item-gi>
          <n-form-item-gi v-if="showCurve" :span="6" :label="t('groups.curve')" :show-feedback="false">
            <n-select v-model:value="draft.curve" :options="curveOptions" />
          </n-form-item-gi>
          <n-form-item-gi v-if="showResidual" :span="6" :label="t('groups.residualMa')" :show-feedback="false">
            <n-input-number v-model:value="draft.residualMa" :min="1" style="width: 100%" />
          </n-form-item-gi>
          <n-form-item-gi :span="6" :label="t('groups.widthModules')" :show-feedback="false">
            <n-input-number v-model:value="draft.widthModules" :min="1" style="width: 100%" />
          </n-form-item-gi>
        </n-grid>

        <div class="subhead">{{ t('groups.secLoadParams') }}</div>
        <n-grid :cols="24" :x-gap="12" :y-gap="4">
          <n-form-item-gi :span="8" :label="t('groups.phases')" :show-feedback="false">
            <n-select v-model:value="draft.phases" :options="phaseOptions" />
          </n-form-item-gi>
          <n-form-item-gi :span="8" :label="t('groups.loadType')" :show-feedback="false">
            <n-select v-model:value="draft.loadType" :options="loadTypeOptions" />
          </n-form-item-gi>
          <n-form-item-gi :span="8" :label="t('groups.demandFactor')" :show-feedback="false">
            <n-input-number v-model:value="draft.demandFactor" :min="0" :max="1" :step="0.05" style="width: 100%" />
          </n-form-item-gi>
        </n-grid>
      </div>

      <!-- Права колонка: лише формування навантаження -->
      <div class="col col-right">
        <div class="subhead">{{ t('groups.loadFormation') }}</div>

        <!-- Замітний індикатор загальної суми навантаження (один рядок) -->
        <div class="load-total">
          <span class="lt-main"><span class="lt-sigma">Σ</span>{{ totalPowerW }} <span class="lt-unit">{{ t('groups.powerUnit') }}</span></span>
          <span class="lt-amp"><span class="lt-approx">≈</span> {{ totalCurrentA.toFixed(1) }} {{ t('calc.ampUnit') }}</span>
          <span class="lt-count">{{ itemCount }} {{ t('groups.itemsShort') }}</span>
        </div>

        <n-text depth="3" class="hint">{{ t('groups.loadHint') }}</n-text>

        <table class="items">
        <thead>
          <tr>
            <th>{{ t('groups.applianceName') }}</th>
            <th class="num">{{ t('groups.powerW') }}</th>
            <th class="num">{{ t('groups.cosPhi') }}</th>
            <th class="num">{{ t('groups.quantity') }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(it, i) in draft.items" :key="i">
            <td><n-input v-model:value="it.name" size="small" :placeholder="t('groups.applianceNamePlaceholder')" /></td>
            <td class="num"><n-input-number v-model:value="it.powerW" size="small" :min="0" :show-button="false" /></td>
            <td class="num"><n-input-number v-model:value="it.cosPhi" size="small" :min="0" :max="1" :step="0.01" :show-button="false" /></td>
            <td class="num"><n-input-number v-model:value="it.quantity" size="small" :min="1" :show-button="false" /></td>
            <td class="num">
              <n-button size="tiny" tertiary type="error" @click="removeItem(i)">
                <template #icon><n-icon :component="TrashOutline" /></template>
              </n-button>
            </td>
          </tr>
        </tbody>
      </table>

      <n-space :size="8" style="margin-top: 10px">
        <n-button size="small" @click="addItem">
          <template #icon><n-icon :component="AddOutline" /></template>
          {{ t('groups.applianceAdd') }}
        </n-button>
        <n-button size="small" @click="presetPanelOpen = !presetPanelOpen">{{ t('groups.applianceFromPreset') }}</n-button>
      </n-space>

      <n-collapse-transition :show="presetPanelOpen">
        <div class="preset-panel">
          <n-checkbox-group v-model:value="selectedIds">
            <div class="preset-list">
              <n-checkbox v-for="p in appliances" :key="p.id" :value="p.id">
                {{ p.name }} <n-text depth="3">({{ p.powerW }} {{ t('groups.powerUnit') }})</n-text>
              </n-checkbox>
            </div>
          </n-checkbox-group>
          <n-space justify="end" style="margin-top: 8px">
            <n-button size="small" @click="presetPanelOpen = false">{{ t('groups.cancel') }}</n-button>
            <n-button size="small" type="primary" :disabled="!selectedIds.length" @click="addSelectedPresets">
              {{ t('groups.addSelected') }} ({{ selectedIds.length }})
            </n-button>
          </n-space>
        </div>
      </n-collapse-transition>
      </div>
    </div>

    <n-alert v-if="errors.length" type="error" :show-icon="false" style="margin-top: 12px">
      <div v-for="(e, i) in errors" :key="i">{{ e }}</div>
    </n-alert>

    <n-space justify="end" style="margin-top: 14px">
      <n-button @click="emit('cancel')">{{ t('groups.cancel') }}</n-button>
      <n-button type="primary" :disabled="!valid" @click="onSave">{{ t('groups.save') }}</n-button>
    </n-space>
  </div>
</template>

<style scoped>
.form {
  width: 100%;
}
/* Дві рівні колонки (50/50): ліворуч апарат + параметри, праворуч формування
   навантаження. На вузьких вікнах flex-wrap складає їх у стовпчик. */
.cols {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  align-items: stretch;
}
.col {
  flex: 1 1 320px;
  min-width: 0;
}
/* Вертикальний роздільник між половинами (зникає при перенесенні). */
.col-right {
  border-left: 1px solid var(--n-border-color, rgba(0, 0, 0, 0.09));
  padding-left: 24px;
}
/* Заголовок логічної секції. */
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
/* Замітний індикатор сумарного навантаження групи — один рядок. */
.load-total {
  display: flex;
  align-items: baseline;
  gap: 14px;
  border: 1px solid var(--brand-color);
  border-left: 4px solid var(--brand-color);
  border-radius: 6px;
  padding: 8px 14px;
  margin-bottom: 4px;
}
.lt-main {
  font-size: 24px;
  font-weight: 700;
  line-height: 1.1;
  color: var(--brand-color);
}
.lt-sigma {
  margin-right: 4px;
  opacity: 0.7;
}
.lt-unit {
  font-size: 15px;
  font-weight: 600;
}
.lt-amp {
  font-size: 18px;
  font-weight: 600;
  color: var(--brand-color);
}
.lt-approx {
  opacity: 0.7;
}
.lt-count {
  font-size: 14px;
  color: #888;
  margin-left: auto;
}
.hint {
  display: block;
  font-size: 14px;
  margin: 8px 0 4px;
}
.items {
  width: 100%;
  border-collapse: collapse;
}
.items thead th {
  text-align: left;
  font-size: 12px;
  color: var(--brand-color);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 6px 8px;
  font-weight: 700;
  white-space: nowrap;
  background: color-mix(in srgb, var(--brand-color) 10%, transparent);
  border-bottom: 2px solid var(--brand-color);
}
.items thead th:first-child {
  border-top-left-radius: 5px;
}
.items thead th:last-child {
  border-top-right-radius: 5px;
}
.items th.num,
.items td.num {
  text-align: right;
  width: 92px;
}
.items td {
  padding: 3px 6px;
}
.preset-panel {
  margin-top: 10px;
  border: 1px solid var(--brand-color);
  border-radius: 6px;
  padding: 10px;
}
.preset-list {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 16px;
  max-height: 220px;
  overflow-y: auto;
}
</style>
