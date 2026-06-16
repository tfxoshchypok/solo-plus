<script setup>
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { NCard, NButton, NSpace, NList, NListItem, NThing, NEmpty, NTag, NText, NIcon } from 'naive-ui'
import { AddOutline, CreateOutline, TrashOutline } from '@vicons/ionicons5'
import { t } from '@/i18n/uk.js'
import { useProjectStore } from '@/stores/project.store.js'
import { useCalcStore } from '@/stores/calc.store.js'
import { groupWidthModules, groupPowerW } from '@/model/group.js'
import GroupForm from '@/components/GroupForm.vue'

/** @typedef {import('@/model/project-schema.js').Group} Group */
/** @typedef {import('@/calc/cables.js').CableSelection} CableSelection */

const store = useProjectStore()
const { project } = storeToRefs(store)
const calc = useCalcStore()
const { byGroupId, incomer } = storeToRefs(calc)

/** Стан редактора: null=закрито, 'new'=нова, або id групи. */
const editing = ref(/** @type {string|null} */ (null))

function startAdd() {
  editing.value = 'new'
}
/** @param {string} id */
function startEdit(id) {
  editing.value = id
}
function cancel() {
  editing.value = null
}

/** @param {{kind: Group['kind'], title: string, spec: Group['spec'], load?: Group['load']}} data */
function onSave(data) {
  if (editing.value === 'new') {
    store.addGroup({ kind: data.kind, title: data.title, spec: data.spec, load: data.load })
  } else if (editing.value) {
    store.updateGroup(editing.value, data)
  }
  editing.value = null
}

/** @param {string} id */
function onDelete(id) {
  store.removeGroup(id)
  if (editing.value === id) editing.value = null
}

/** @param {Group} g */
function editingGroup(g) {
  return editing.value === g.id ? g : null
}

/** @param {number} a @returns {string} */
function fmtA(a) {
  return a.toFixed(1)
}

/** @param {string} id */
function groupCalc(id) {
  return byGroupId.value.get(id)
}

/** Ширина групи в модулях. @param {Group} g @returns {number} */
function widthOf(g) {
  return groupWidthModules(g)
}

/** @param {Group} g */
function powerOf(g) {
  return groupPowerW(g.load)
}

/** @param {Group} g */
function itemCount(g) {
  return g.load?.items?.length ?? 0
}

/** @param {CableSelection|null|undefined} c @returns {string} */
function cableText(c) {
  if (!c) return ''
  switch (c.status) {
    case 'ok':
      return `${c.crossSectionMm2} ${t('calc.mm2')}`
    case 'voltage_drop':
      return `${c.crossSectionMm2} ${t('calc.mm2')} · ${t('calc.dropHigh')}`
    case 'overcurrent':
      return t('calc.overcurrent')
    case 'no_cable':
      return t('calc.noCable')
    default:
      return ''
  }
}

/** @param {CableSelection|null|undefined} c */
function cableTagType(c) {
  if (!c) return 'default'
  if (c.status === 'ok') return 'success'
  if (c.status === 'voltage_drop') return 'warning'
  return 'error'
}
</script>

<template>
  <n-card size="small" class="block-card">
    <template #header>
      {{ t('groups.heading') }}
      <span class="count-badge">{{ project?.groups.length ?? 0 }}</span>
    </template>
    <template #header-extra>
      <n-button size="small" type="primary" :disabled="editing === 'new'" @click="startAdd">
        <template #icon><n-icon :component="AddOutline" /></template>
        {{ t('groups.add') }}
      </n-button>
    </template>

    <n-text v-if="incomer && incomer.currentA > 0" class="summary">
      {{ t('calc.incomer') }}: <b>{{ fmtA(incomer.currentA) }} {{ t('calc.ampUnit') }}</b>
      <n-tag :type="cableTagType(incomer.cable)" size="small" round style="margin-left: 6px">
        {{ cableText(incomer.cable) }}
      </n-tag>
    </n-text>

    <div v-if="editing === 'new'" class="editor">
      <GroupForm :group="null" @save="onSave" @cancel="cancel" />
    </div>

    <n-empty
      v-if="!project?.groups.length && editing !== 'new'"
      :description="t('groups.empty')"
      style="margin: 24px 0"
    />

    <n-list v-else class="groups">
      <n-list-item v-for="g in project?.groups ?? []" :key="g.id">
        <GroupForm v-if="editing === g.id" :group="editingGroup(g)" @save="onSave" @cancel="cancel" />
        <template v-else>
          <n-thing :title="g.title">
            <template #description>
              <!-- Характеристики апарата групи з акцентом -->
              <div class="specs">
                <span class="chip chip-kind">{{ t('groupKind.' + g.kind) }}</span>
                <span class="chip chip-device">{{ t('device.' + g.spec.device) }}</span>
                <span class="chip chip-rating">{{ g.spec.ratingA }} A</span>
                <span class="chip">{{ g.spec.poles }}P</span>
                <span v-if="g.spec.curve" class="chip">{{ g.spec.curve }}</span>
                <span v-if="g.spec.residualMa" class="chip">{{ g.spec.residualMa }} мА</span>
                <span class="chip chip-width">{{ widthOf(g) }} М</span>
              </div>

              <div v-if="powerOf(g) > 0 || (groupCalc(g.id)?.currentA ?? 0) > 0 || itemCount(g)" class="calc">
                <span v-if="powerOf(g) > 0" class="pw">{{ powerOf(g) }} {{ t('groups.powerUnit') }}</span>
                <template v-if="groupCalc(g.id)?.isConsumer && (groupCalc(g.id)?.currentA ?? 0) > 0">
                  <span class="sep">·</span>
                  <span class="amp">{{ t('calc.current') }} ≈ {{ fmtA(groupCalc(g.id)?.currentA ?? 0) }} {{ t('calc.ampUnit') }}</span>
                  <n-tag :type="cableTagType(groupCalc(g.id)?.cable)" size="small" round>
                    {{ cableText(groupCalc(g.id)?.cable) }}
                  </n-tag>
                </template>
                <span v-if="itemCount(g)" class="items-count">{{ itemCount(g) }} {{ t('groups.itemsShort') }}</span>
              </div>

              <n-tag v-if="groupCalc(g.id)?.phaseMismatch" type="error" size="small" round class="warn">
                {{ t('calc.phaseMismatch') }}
              </n-tag>
            </template>
          </n-thing>
        </template>
        <template v-if="editing !== g.id" #suffix>
          <n-space :size="6">
            <n-button size="small" tertiary @click="startEdit(g.id)">
              <template #icon><n-icon :component="CreateOutline" /></template>
              {{ t('groups.edit') }}
            </n-button>
            <n-button size="small" tertiary type="error" @click="onDelete(g.id)">
              <template #icon><n-icon :component="TrashOutline" /></template>
            </n-button>
          </n-space>
        </template>
      </n-list-item>
    </n-list>
  </n-card>
</template>

<style scoped>
/* Відступ знизу від акцентного заголовка-банера перед вмістом картки. */
:deep(.n-card-header) {
  margin-bottom: 14px;
}
/* Список без зовнішньої рамки: кожна група — окрема картка з відступами. */
.groups :deep(.n-list-item) {
  border: 1px solid var(--n-border-color, rgba(0, 0, 0, 0.09));
  border-radius: 6px;
  padding: 10px 12px;
  margin-bottom: 8px;
  transition: box-shadow 0.15s, border-color 0.15s, background-color 0.15s;
}
.groups :deep(.n-list-item:last-child) {
  margin-bottom: 0;
}
.groups :deep(.n-list-item:hover) {
  border-color: var(--brand-color);
  box-shadow: inset 0 0 0 1px var(--brand-color);
  background-color: rgba(8, 145, 178, 0.06);
}
/* Лічильник груп у заголовку — акцентний бейдж. */
.count-badge {
  display: inline-block;
  min-width: 22px;
  padding: 0 8px;
  margin-left: 8px;
  border-radius: 11px;
  background: var(--brand-color);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  line-height: 22px;
  text-align: center;
  vertical-align: middle;
}
.summary {
  display: block;
  margin-bottom: 12px;
}
/* Рядок характеристик апарата групи — акцентовані «чипи». */
.specs {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin: 4px 0 6px;
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
/* Тип групи й апарат — нейтральні текстові підписи (контекст, не акцент). */
.chip-kind,
.chip-device {
  border: none;
  background: none;
  padding: 0;
  color: var(--n-text-color, inherit);
}
.chip-kind {
  opacity: 0.6;
  font-weight: 500;
}
.chip-device {
  font-weight: 700;
  margin-right: 2px;
}
/* Номінал — головна характеристика: суцільна заливка акцентом. */
.chip-rating {
  font-size: 14px;
  color: #fff;
  background: var(--brand-color);
  border-color: var(--brand-color);
}
.chip-width {
  opacity: 0.85;
}
.calc {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
  font-size: 15px;
  font-weight: 600;
}
.sep {
  opacity: 0.4;
}
.amp {
  color: var(--brand-color);
}
.items-count {
  margin-left: auto;
  font-size: 13px;
  font-weight: 500;
  opacity: 0.6;
}
.warn {
  display: inline-flex;
  margin-top: 4px;
}
.pw {
  color: var(--brand-color);
}
.editor {
  margin-bottom: 12px;
}
</style>
