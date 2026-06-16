<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { storeToRefs } from 'pinia'
import {
  NConfigProvider,
  NMessageProvider,
  NLayout,
  NLayoutContent,
  NButton,
  NSpace,
  NCard,
  NList,
  NListItem,
  NThing,
  NEmpty,
  NAlert,
  NText,
  NIcon,
  ukUA,
  dateUkUA,
} from 'naive-ui'
import {
  DocumentOutline,
  FolderOpenOutline,
  SaveOutline,
  CopyOutline,
  CloseOutline,
  ArrowUndoOutline,
  ArrowRedoOutline,
} from '@vicons/ionicons5'
import { t } from '@/i18n/uk.js'
import { useProjectStore } from '@/stores/project.store.js'
import { useCalcStore } from '@/stores/calc.store.js'
import { usePresetStore } from '@/stores/presets.store.js'
import { listRecent } from '@/db/recent.js'
import { listRecoverable, deleteDraft } from '@/db/drafts.js'
import { createAutosave } from '@/project/autosave.js'
import GroupList from '@/components/GroupList.vue'
import SupplyForm from '@/components/SupplyForm.vue'
import RefsView from '@/components/RefsView.vue'

// Світла тема з бурштиновим акцентом (замість зеленого) + збільшені шрифти.
const themeOverrides = {
  common: {
    primaryColor: '#0891b2',
    primaryColorHover: '#22d3ee',
    primaryColorPressed: '#0e7490',
    primaryColorSuppl: '#0891b2',
    // Бліде прохолодне тло сторінки — білі картки «спливають» і дані виділяються.
    bodyColor: '#f4f8fa',
    cardColor: '#ffffff',
    // Мадженту з логотипа — для попереджень («не збережено», банер відновлення).
    warningColor: '#ff2d95',
    warningColorHover: '#ff5cad',
    warningColorPressed: '#e01f80',
    warningColorSuppl: '#ff2d95',
    borderColor: 'rgba(0, 0, 0, 0.16)',
    dividerColor: 'rgba(0, 0, 0, 0.1)',
    // Збільшений масштаб шрифтів (дефолт Naive — 14px).
    fontSize: '16px',
    fontSizeMini: '14px',
    fontSizeTiny: '14px',
    fontSizeSmall: '15px',
    fontSizeMedium: '16px',
    fontSizeLarge: '17px',
    fontSizeHuge: '18px',
  },
}

const store = useProjectStore()
const { project, filePath, dirty, isOpen, canUndo, canRedo } = storeToRefs(store)
const calc = useCalcStore()
const presetStore = usePresetStore()

/** Активна сторінка (головне меню): 'project' | 'refs'. */
const view = ref(/** @type {'project'|'refs'} */ ('project'))
/** Активна підвкладка довідників (підменю). */
const refsTab = ref(/** @type {'norms'|'cables'|'appliances'} */ ('norms'))

/** Перечитати довідники після їх редагування (щоб розрахунок оновився). */
function onRefsChanged() {
  void calc.reloadRefs()
  void presetStore.reload()
}

/** @type {import('vue').Ref<import('@/db/db.js').RecentProject[]>} */
const recent = ref([])
const recoverDraft = ref(/** @type {import('@/db/db.js').Draft|null} */ (null))
const hasNeutralino = typeof Neutralino !== 'undefined'

const autosave = createAutosave(store)

async function refreshRecent() {
  try {
    recent.value = await listRecent()
  } catch {
    recent.value = []
  }
}

function recoveryBody() {
  const name = recoverDraft.value?.projectJson.project.name ?? ''
  return t('recovery.body').replace('{name}', name)
}

function onRecoverRestore() {
  if (recoverDraft.value) store.restoreFromDraft(recoverDraft.value)
  recoverDraft.value = null
}

async function onRecoverDiscard() {
  const draft = recoverDraft.value
  recoverDraft.value = null
  if (draft) {
    try {
      await deleteDraft(draft.projectId)
    } catch {
      // прибирання чернетки не критичне
    }
  }
}

function flushOnHide() {
  if (document.visibilityState === 'hidden') void autosave.flushNow()
}

onMounted(async () => {
  void calc.reloadRefs()
  void presetStore.reload()
  await refreshRecent()
  try {
    const recoverable = await listRecoverable()
    if (recoverable.length) recoverDraft.value = recoverable[0]
  } catch {
    // відсутність чернеток — нормальний стан
  }
  autosave.start()
  document.addEventListener('visibilitychange', flushOnHide)
  if (hasNeutralino) {
    Neutralino.events.on('windowClose', () => {
      void autosave.markClosedNow().finally(() => Neutralino.app.exit())
    })
  }
})

onBeforeUnmount(() => {
  autosave.stop()
  document.removeEventListener('visibilitychange', flushOnHide)
})

function onNew() {
  view.value = 'project'
  store.createNew()
}
async function onOpen() {
  if (await store.openWithDialog()) {
    view.value = 'project'
    await refreshRecent()
  }
}
/** @param {string} path */
async function onOpenRecent(path) {
  if (await store.openFromPath(path)) await refreshRecent()
}
async function onSave() {
  if (await store.save()) await refreshRecent()
}
async function onSaveAs() {
  if (await store.saveAs()) await refreshRecent()
}
</script>

<template>
  <n-config-provider :theme-overrides="themeOverrides" :locale="ukUA" :date-locale="dateUkUA">
    <n-message-provider>
      <n-layout position="absolute">
        <!-- Темна шапка: логотип + головне меню -->
        <header class="topbar">
          <div class="left">
            <div class="logo">
              <span class="logo-main">Solo</span><span class="logo-plus">.plus</span>
            </div>
            <nav class="tabs">
            <button class="tab" :class="{ active: view === 'project' }" @click="view = 'project'">
              {{ t('nav.project') }}
            </button>
            <button class="tab" :class="{ active: view === 'refs' }" @click="view = 'refs'">
              {{ t('toolbar.refs') }}
            </button>
            </nav>
          </div>
        </header>

        <!-- Рядок-підменю обраного пункту головного меню -->
        <div class="subbar">
          <!-- Підменю «Проєкт» — дії файлу -->
          <n-space v-if="view === 'project'" :size="4" align="center">
            <n-button size="small" quaternary @click="onNew">
              <template #icon><n-icon :component="DocumentOutline" /></template>
              {{ t('toolbar.new') }}
            </n-button>
            <n-button size="small" quaternary :disabled="!hasNeutralino" @click="onOpen">
              <template #icon><n-icon :component="FolderOpenOutline" /></template>
              {{ t('toolbar.open') }}
            </n-button>
            <n-button size="small" type="primary" :disabled="!isOpen" @click="onSave">
              <template #icon><n-icon :component="SaveOutline" /></template>
              {{ t('toolbar.save') }}
            </n-button>
            <n-button size="small" quaternary :disabled="!isOpen || !hasNeutralino" @click="onSaveAs">
              <template #icon><n-icon :component="CopyOutline" /></template>
              {{ t('toolbar.saveAs') }}
            </n-button>
            <span class="vsep dark" />
            <n-button size="small" quaternary :disabled="!canUndo" :title="t('toolbar.undo')" @click="store.undo()">
              <template #icon><n-icon :component="ArrowUndoOutline" /></template>
            </n-button>
            <n-button size="small" quaternary :disabled="!canRedo" :title="t('toolbar.redo')" @click="store.redo()">
              <template #icon><n-icon :component="ArrowRedoOutline" /></template>
            </n-button>
            <span class="vsep dark" />
            <n-button size="small" quaternary :disabled="!isOpen" @click="store.close()">
              <template #icon><n-icon :component="CloseOutline" /></template>
              {{ t('toolbar.close') }}
            </n-button>
          </n-space>

          <!-- Підменю «Довідники» — розділи -->
          <nav v-else class="subtabs">
            <button class="subtab" :class="{ active: refsTab === 'norms' }" @click="refsTab = 'norms'">
              {{ t('refs.tabNorms') }}
            </button>
            <button class="subtab" :class="{ active: refsTab === 'cables' }" @click="refsTab = 'cables'">
              {{ t('refs.tabCables') }}
            </button>
            <button class="subtab" :class="{ active: refsTab === 'appliances' }" @click="refsTab = 'appliances'">
              {{ t('refs.tabAppliances') }}
            </button>
          </nav>
        </div>

        <n-layout-content content-style="padding: 24px;" class="content">
          <!-- Банер відновлення сесії (замість попапа) -->
          <n-alert
            v-if="recoverDraft"
            type="warning"
            :title="t('recovery.title')"
            closable
            class="recover"
            @close="onRecoverDiscard"
          >
            <div>{{ recoveryBody() }}</div>
            <n-space style="margin-top: 10px">
              <n-button size="small" type="primary" @click="onRecoverRestore">{{ t('recovery.restore') }}</n-button>
              <n-button size="small" @click="onRecoverDiscard">{{ t('recovery.discard') }}</n-button>
            </n-space>
          </n-alert>

          <!-- Сторінка: Довідники -->
          <div v-if="view === 'refs'" class="page">
            <RefsView :tab="refsTab" @changed="onRefsChanged" />
          </div>

          <!-- Сторінка: Проєкт -->
          <template v-else>
            <!-- Стартовий екран -->
            <div v-if="!isOpen" class="page start">
              <n-card class="start-card" :title="t('start.heading')">
                <n-button type="primary" size="large" @click="onNew">{{ t('start.newProject') }}</n-button>
                <div class="recent">
                  <n-text depth="3" class="recent-head">{{ t('start.recent') }}</n-text>
                  <n-empty v-if="!recent.length" :description="t('start.noRecent')" />
                  <n-list v-else bordered>
                    <n-list-item v-for="r in recent" :key="r.id">
                      <n-thing :title="r.name" :description="r.filePath" />
                      <template #suffix>
                        <n-button size="small" :disabled="!hasNeutralino" @click="onOpenRecent(r.filePath)">
                          {{ t('toolbar.open') }}
                        </n-button>
                      </template>
                    </n-list-item>
                  </n-list>
                </div>
              </n-card>
            </div>

            <!-- Робочий екран проєкту -->
            <div v-else class="page work">
              <n-card class="proj-bar" size="small">
                <div class="proj-row">
                  <span class="proj-name">{{ project?.project.name }}</span>
                  <n-text depth="3" class="proj-path">{{ filePath ?? '—' }}</n-text>
                  <n-text v-if="dirty" type="warning" class="proj-dirty">● {{ t('toolbar.unsaved') }}</n-text>
                </div>
              </n-card>
              <SupplyForm />
              <GroupList />
            </div>
          </template>
        </n-layout-content>
      </n-layout>
    </n-message-provider>
  </n-config-provider>
</template>

<style scoped>
.topbar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding: 0 18px;
  background: var(--header-bg);
  z-index: 10;
}
.left {
  display: flex;
  align-items: center;
  gap: 40px;
}
/* Неонова вивіска-логотип (трубка: світле ядро + кольоровий ореол) */
.logo {
  --blue: #19e3ff;
  --blue-core: #e6fbff; /* світле ядро трубки */
  --pink: #ff2d95;
  --pink-core: #ffe1ee; /* світле ядро трубки */
  font-family: 'Signika Negative', sans-serif;
  font-size: 26px;
  letter-spacing: 2px;
  white-space: nowrap;
  cursor: default;
}
.logo-main {
  font-family: 'Yellowtail', cursive;
  font-size: 1.3em;
  font-style: italic;
  padding-right: 6px;
  color: var(--blue-core); /* світле суцільне ядро */
  -webkit-text-stroke: 1.4px var(--blue); /* товща межа звужує світлий промінь удвічі */
  text-shadow:
    0 0 4px var(--blue),
    0 0 10px var(--blue),
    0 0 22px var(--blue),
    0 0 40px var(--blue); /* колір у свіченні навколо */
  animation: hum 4.5s ease-in-out infinite;
}
.logo-plus {
  font-weight: bold;
  font-size: 0.85em;
  color: var(--pink-core);
  -webkit-text-stroke: 1.4px var(--pink);
  text-shadow:
    0 0 4px var(--pink),
    0 0 10px var(--pink),
    0 0 20px var(--pink),
    0 0 36px var(--pink);
  animation: softflicker 9s ease-in-out infinite;
}
@keyframes hum {
  0%,
  100% {
    filter: brightness(1);
  }
  50% {
    filter: brightness(1.06);
  }
}
@keyframes softflicker {
  0%,
  100% {
    opacity: 1;
  }
  43% {
    opacity: 1;
  }
  44% {
    opacity: 0.82;
  }
  45% {
    opacity: 1;
  }
  88% {
    opacity: 1;
  }
  88.7% {
    opacity: 0.88;
  }
  89.4% {
    opacity: 1;
  }
}
/* Наведення мишкою — вся вивіска нервово миготить */
.logo:hover .logo-main,
.logo:hover .logo-plus {
  animation: buzz 0.65s steps(1, end) infinite;
}
@keyframes buzz {
  0% {
    opacity: 1;
  }
  8% {
    opacity: 0.2;
  }
  10% {
    opacity: 1;
  }
  18% {
    opacity: 1;
  }
  20% {
    opacity: 0.35;
  }
  22% {
    opacity: 1;
  }
  40% {
    opacity: 1;
  }
  42% {
    opacity: 0.15;
  }
  43% {
    opacity: 1;
  }
  45% {
    opacity: 0.55;
  }
  47% {
    opacity: 1;
  }
  70% {
    opacity: 1;
  }
  72% {
    opacity: 0.25;
  }
  74% {
    opacity: 1;
  }
  90% {
    opacity: 1;
  }
  92% {
    opacity: 0.4;
  }
  94% {
    opacity: 1;
  }
}
@media (prefers-reduced-motion: reduce) {
  .logo-main,
  .logo-plus {
    animation: none;
  }
}
.tabs {
  display: flex;
  gap: 4px;
  height: 56px;
}
.tab {
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: rgba(255, 255, 255, 0.6);
  padding: 0 14px;
  font-size: 16px;
  font-family: inherit;
  cursor: pointer;
  transition: color 0.12s;
}
.tab:hover {
  color: rgba(255, 255, 255, 0.9);
}
.tab.active {
  color: #fff;
  border-bottom-color: var(--brand-glow);
  font-weight: 600;
}
/* Рядок-підменю під темною шапкою (світлий) */
.subbar {
  position: absolute;
  top: 56px;
  left: 0;
  right: 0;
  height: 46px;
  display: flex;
  align-items: center;
  padding: 0 18px;
  background: #fff;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  z-index: 9;
}
.vsep {
  width: 1px;
  height: 20px;
  background: rgba(0, 0, 0, 0.12);
  margin: 0 4px;
}
.subtabs {
  display: flex;
  gap: 2px;
  height: 46px;
}
.subtab {
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--n-text-color, #555);
  padding: 0 14px;
  font-size: 15px;
  font-family: inherit;
  cursor: pointer;
  transition: color 0.12s;
}
.subtab:hover {
  color: #111;
}
.subtab.active {
  color: var(--brand-color);
  border-bottom-color: var(--brand-color);
  font-weight: 600;
}
.content {
  top: 102px;
  background: #f4f8fa;
}
.page {
  max-width: 1280px;
  margin: 0 auto;
}
.start {
  padding-top: 12px;
}
.start-card {
  max-width: 620px;
  margin: 0 auto;
}
.recent {
  margin-top: 18px;
}
.recent-head {
  display: block;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-size: 13px;
  margin-bottom: 8px;
}
.work {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.recover {
  max-width: 1280px;
  margin: 0 auto 16px;
}
.proj-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.proj-name {
  font-size: 16px;
  font-weight: 600;
}
.proj-path {
  flex: 1;
  font-size: 13px;
}
.proj-dirty {
  font-size: 13px;
}
</style>
