import { createApp } from 'vue'
import { createPinia } from 'pinia'
import 'vfonts/Inter.css'
// Шрифти неонового логотипа — забандлені локально (працюють офлайн).
import '@fontsource/yellowtail/latin-400.css'
import '@fontsource/signika-negative/latin-600.css'
import '@/styles/main.css'
import App from '@/App.vue'
import { seedNorms } from '@/db/norms-seed.js'
import { seedCableRefs } from '@/db/cable-seed.js'
import { seedAppliancePresets } from '@/db/appliance-presets-seed.js'

// Ініціалізація Neutralino-клієнта (WebSocket до ядра) — потрібна, щоб
// працювали filesystem/os/window. У браузері (без Neutralino) пропускаємо.
// Лише в десктоп-середовищі: у браузері Neutralino підвантажується скриптом,
// але NL_PORT відсутній → init() кинув би WebSocket-помилку (як у mini-buh).
if (typeof Neutralino !== 'undefined' && window.NL_PORT) {
  Neutralino.init()
}

const app = createApp(App)
app.use(createPinia())

// Залити дефолтні довідники у Dexie (idempotent) ДО монтування — інакше
// reload() в onMounted прочитав би ще порожню БД і затер дефолтні списки.
Promise.allSettled([seedNorms(), seedCableRefs(), seedAppliancePresets()]).finally(() => {
  app.mount('#app')
})
