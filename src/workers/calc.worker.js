// Web Worker для повного перерахунку проєкту поза основним потоком (T2.3).
// Тонка обгортка: маршрутизує повідомлення → calc/project-calc.js (чиста,
// протестована логіка) і повертає результат. Бенчмарк ≤ 3 с для 60 груп.
//
// Протокол: запит   { type:'calc', id, project, norms, cableRefs }
//           успіх   { type:'result', id, result: ProjectCalc }
//           помилка  { type:'error',  id, error: string }
// Кореляція за id робиться на боці клієнта (calc/calc-client.js).

import { calcProject } from '@/calc/project-calc.js'

self.onmessage = (/** @type {MessageEvent} */ event) => {
  const msg = event.data
  if (!msg || msg.type !== 'calc') return

  const { id, project, norms, cableRefs } = msg
  try {
    const result = calcProject(project, norms, cableRefs)
    self.postMessage({ type: 'result', id, result })
  } catch (err) {
    self.postMessage({ type: 'error', id, error: String(err instanceof Error ? err.message : err) })
  }
}
