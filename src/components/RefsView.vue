<script setup>
// Сторінка довідників (раніше — модалка). Підвкладки: нормативи / перерізи / прилади.
import { ref, onMounted } from 'vue'
import {
  NButton,
  NSpace,
  NInput,
  NInputNumber,
  NSelect,
  NTag,
  NIcon,
  NEmpty,
  NPopconfirm,
  NCard,
} from 'naive-ui'
import { AddOutline, TrashOutline, RefreshOutline } from '@vicons/ionicons5'
import { t } from '@/i18n/uk.js'
import { listNorms, setNorm, resetNorms } from '@/db/norms.js'
import { listCableRefs, addCableRef, updateCableRef, removeCableRef, resetCableRefs } from '@/db/cables.js'
import {
  listAppliancePresets,
  putAppliancePreset,
  removeAppliancePreset,
  resetAppliancePresets,
} from '@/db/appliance-presets.js'
import { uid } from '@/model/id.js'

/** @typedef {import('@/db/db.js').CableRef} CableRef */
/** @typedef {import('@/db/db.js').AppliancePreset} AppliancePreset */
/** @typedef {{ key: string, category: string, description: string, value: number }} NormRow */

const props = defineProps({
  /** Активний розділ: 'norms' | 'cables' | 'appliances' (керується ззовні). */
  tab: { type: String, default: 'norms' },
})
const emit = defineEmits(['changed'])

const norms = ref(/** @type {NormRow[]} */ ([]))
const cables = ref(/** @type {CableRef[]} */ ([]))
const appliances = ref(/** @type {AppliancePreset[]} */ ([]))

const materialOptions = [
  { label: t('material.cu'), value: 'cu' },
  { label: t('material.al'), value: 'al' },
]
const phaseOptions = [
  { label: '1', value: 1 },
  { label: '3', value: 3 },
]

async function loadAll() {
  const ns = await listNorms()
  norms.value = ns
    .map((n) => ({ key: n.key, category: n.category, description: n.description ?? '', value: Number(n.value) }))
    .sort((a, b) => a.category.localeCompare(b.category) || a.key.localeCompare(b.key))
  const cs = await listCableRefs()
  cables.value = cs.sort((a, b) => a.material.localeCompare(b.material) || a.crossSectionMm2 - b.crossSectionMm2)
  appliances.value = await listAppliancePresets()
}

onMounted(loadAll)

/** Будь-яка зміна довідника впливає на розрахунок — сигналимо нагору. */
function changed() {
  emit('changed')
}

/** @param {NormRow} row */
async function onNormSave(row) {
  await setNorm(row.key, Number(row.value))
  changed()
}
async function onResetNorms() {
  await resetNorms()
  await loadAll()
  changed()
}

/** @param {CableRef} row */
async function onCableSave(row) {
  if (row.id == null) return
  await updateCableRef(row.id, {
    material: row.material,
    crossSectionMm2: Number(row.crossSectionMm2),
    allowableCurrentA: Number(row.allowableCurrentA),
    installMethod: row.installMethod,
  })
  changed()
}
async function onAddCable() {
  await addCableRef({ material: 'cu', crossSectionMm2: 0, allowableCurrentA: 0, installMethod: 'conduit' })
  await loadAll()
}
/** @param {number|undefined} id */
async function onDeleteCable(id) {
  if (id == null) return
  await removeCableRef(id)
  await loadAll()
  changed()
}
async function onResetCables() {
  await resetCableRefs()
  await loadAll()
  changed()
}

/** @param {AppliancePreset} row */
async function onApplianceSave(row) {
  await putAppliancePreset({
    id: row.id,
    name: row.name,
    category: row.category,
    powerW: Number(row.powerW),
    cosPhi: row.cosPhi != null ? Number(row.cosPhi) : undefined,
    phases: row.phases,
    quantity: row.quantity != null ? Number(row.quantity) : undefined,
  })
  changed()
}
async function onAddAppliance() {
  await putAppliancePreset({ id: uid('appl'), name: 'Новий прилад', category: 'other', powerW: 1000, cosPhi: 1, phases: 1 })
  await loadAll()
  changed()
}
/** @param {string} id */
async function onDeleteAppliance(id) {
  await removeAppliancePreset(id)
  await loadAll()
  changed()
}
async function onResetAppliances() {
  await resetAppliancePresets()
  await loadAll()
  changed()
}
</script>

<template>
  <n-card size="small">
    <!-- Нормативи -->
    <section v-if="tab === 'norms'">
        <n-empty v-if="!norms.length" :description="t('refs.normsEmpty')" />
        <table v-else class="grid-table">
          <thead>
            <tr>
              <th>{{ t('refs.description') }}</th>
              <th class="num">{{ t('refs.value') }}</th>
              <th>{{ t('refs.category') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in norms" :key="row.key">
              <td>
                <div>{{ row.description || row.key }}</div>
                <div class="key">{{ row.key }}</div>
              </td>
              <td class="num" style="width: 130px">
                <n-input-number v-model:value="row.value" size="small" :show-button="false" @update:value="onNormSave(row)" />
              </td>
              <td><n-tag size="small">{{ row.category }}</n-tag></td>
            </tr>
          </tbody>
        </table>
        <n-space style="margin-top: 12px">
          <n-popconfirm @positive-click="onResetNorms" :positive-text="t('refs.reset')" :negative-text="t('groups.cancel')">
            <template #trigger>
              <n-button size="small"><template #icon><n-icon :component="RefreshOutline" /></template>{{ t('refs.reset') }}</n-button>
            </template>
            {{ t('refs.resetConfirm') }}
          </n-popconfirm>
        </n-space>
    </section>

    <!-- Перерізи кабелів -->
    <section v-else-if="tab === 'cables'">
        <n-empty v-if="!cables.length" :description="t('refs.cablesEmpty')" />
        <table v-else class="grid-table">
          <thead>
            <tr>
              <th>{{ t('refs.cableMaterial') }}</th>
              <th class="num">{{ t('refs.cableCrossSection') }}</th>
              <th class="num">{{ t('refs.cableAllowable') }}</th>
              <th>{{ t('refs.cableMethod') }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in cables" :key="row.id">
              <td style="width: 130px"><n-select v-model:value="row.material" size="small" :options="materialOptions" @update:value="onCableSave(row)" /></td>
              <td class="num" style="width: 110px"><n-input-number v-model:value="row.crossSectionMm2" size="small" :min="0" :show-button="false" @update:value="onCableSave(row)" /></td>
              <td class="num" style="width: 110px"><n-input-number v-model:value="row.allowableCurrentA" size="small" :min="0" :show-button="false" @update:value="onCableSave(row)" /></td>
              <td><n-input v-model:value="row.installMethod" size="small" @update:value="onCableSave(row)" /></td>
              <td class="num"><n-button size="tiny" tertiary type="error" @click="onDeleteCable(row.id)"><template #icon><n-icon :component="TrashOutline" /></template></n-button></td>
            </tr>
          </tbody>
        </table>
        <n-space style="margin-top: 12px">
          <n-button size="small" type="primary" @click="onAddCable"><template #icon><n-icon :component="AddOutline" /></template>{{ t('refs.cableAdd') }}</n-button>
          <n-popconfirm @positive-click="onResetCables" :positive-text="t('refs.reset')" :negative-text="t('groups.cancel')">
            <template #trigger>
              <n-button size="small"><template #icon><n-icon :component="RefreshOutline" /></template>{{ t('refs.reset') }}</n-button>
            </template>
            {{ t('refs.resetConfirm') }}
          </n-popconfirm>
        </n-space>
    </section>

    <!-- Прилади -->
    <section v-else>
        <n-empty v-if="!appliances.length" :description="t('refs.appliancesEmpty')" />
        <table v-else class="grid-table">
          <thead>
            <tr>
              <th>{{ t('refs.applianceName') }}</th>
              <th>{{ t('refs.applianceCategory') }}</th>
              <th class="num">{{ t('refs.appliancePowerW') }}</th>
              <th class="num">{{ t('refs.applianceCosPhi') }}</th>
              <th class="num">{{ t('refs.appliancePhases') }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in appliances" :key="row.id">
              <td><n-input v-model:value="row.name" size="small" @update:value="onApplianceSave(row)" /></td>
              <td style="width: 120px"><n-input v-model:value="row.category" size="small" @update:value="onApplianceSave(row)" /></td>
              <td class="num" style="width: 100px"><n-input-number v-model:value="row.powerW" size="small" :min="0" :show-button="false" @update:value="onApplianceSave(row)" /></td>
              <td class="num" style="width: 90px"><n-input-number v-model:value="row.cosPhi" size="small" :min="0" :max="1" :step="0.01" :show-button="false" @update:value="onApplianceSave(row)" /></td>
              <td class="num" style="width: 80px"><n-select v-model:value="row.phases" size="small" :options="phaseOptions" @update:value="onApplianceSave(row)" /></td>
              <td class="num"><n-button size="tiny" tertiary type="error" @click="onDeleteAppliance(row.id)"><template #icon><n-icon :component="TrashOutline" /></template></n-button></td>
            </tr>
          </tbody>
        </table>
        <n-space style="margin-top: 12px">
          <n-button size="small" type="primary" @click="onAddAppliance"><template #icon><n-icon :component="AddOutline" /></template>{{ t('refs.applianceAdd') }}</n-button>
          <n-popconfirm @positive-click="onResetAppliances" :positive-text="t('refs.reset')" :negative-text="t('groups.cancel')">
            <template #trigger>
              <n-button size="small"><template #icon><n-icon :component="RefreshOutline" /></template>{{ t('refs.reset') }}</n-button>
            </template>
            {{ t('refs.resetConfirm') }}
          </n-popconfirm>
        </n-space>
    </section>
  </n-card>
</template>

<style scoped>
.grid-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 15px;
}
.grid-table th {
  text-align: left;
  font-size: 13px;
  color: #999;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 6px;
  font-weight: 500;
}
.grid-table th.num,
.grid-table td.num {
  text-align: right;
}
.grid-table td {
  padding: 4px 6px;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
  vertical-align: middle;
}
/* Зебра — бліда тонівка парних рядків полегшує читання щільних довідників */
.grid-table tbody tr:nth-child(even) td {
  background-color: rgba(8, 145, 178, 0.035);
}
.grid-table tbody tr:hover td {
  background-color: rgba(8, 145, 178, 0.09);
}
.key {
  font-size: 13px;
  color: #aaa;
  margin-top: 1px;
}
</style>
