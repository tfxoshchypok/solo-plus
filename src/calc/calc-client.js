// Клієнт перерахунку для головного потоку (T2.3). Володіє Web Worker'ом
// (calc.worker.js), віддає Promise на кожен запит і корелює відповіді за id,
// тож кілька перерахунків можуть бути «в польоті» одночасно. Воркер інжектиться
// (для тестів); за замовчуванням створюється справжній. Нормативи й довідник
// перерізів передаються аргументами — їх вантажить викликач (loadNorms /
// listCableRefs), клієнт лишається без Dexie.

/** @typedef {import('@/model/project-schema.js').Project} Project */
/** @typedef {import('@/calc/norms.js').Norms} Norms */
/** @typedef {import('@/db/db.js').CableRef} CableRef */
/** @typedef {import('@/calc/project-calc.js').ProjectCalc} ProjectCalc */

/**
 * Мінімальний інтерфейс воркера, потрібний клієнту. Справжній `Worker`
 * задовольняє його структурно; у тестах підставляється фейк.
 * @typedef {Object} WorkerLike
 * @property {(message: any) => void} postMessage
 * @property {((event: { data: any }) => void) | null} onmessage
 * @property {() => void} [terminate]
 */

/** @typedef {{ resolve: (r: ProjectCalc) => void, reject: (e: Error) => void }} Pending */

/**
 * Створити справжній Web Worker перерахунку. Vite розв'язує URL через
 * import.meta.url і збирає воркер як окремий модуль.
 * @returns {WorkerLike}
 */
function spawnWorker() {
  return /** @type {WorkerLike} */ (
    new Worker(new URL('../workers/calc.worker.js', import.meta.url), { type: 'module' })
  )
}

/**
 * Створити клієнт перерахунку.
 * @param {{ worker?: WorkerLike }} [opts]
 */
export function createCalcClient(opts = {}) {
  const worker = opts.worker ?? spawnWorker()
  let nextId = 0
  /** @type {Map<number, Pending>} */
  const pending = new Map()

  worker.onmessage = (event) => {
    const { type, id, result, error } = event.data ?? {}
    const entry = pending.get(id)
    if (!entry) return
    pending.delete(id)
    if (type === 'result') entry.resolve(result)
    else entry.reject(new Error(typeof error === 'string' ? error : 'calc worker error'))
  }

  /**
   * Перерахувати проєкт у воркері.
   * @param {Project|null} project
   * @param {Norms} norms
   * @param {CableRef[]} cableRefs
   * @returns {Promise<ProjectCalc>}
   */
  function recalc(project, norms, cableRefs) {
    const id = ++nextId
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject })
      worker.postMessage({ type: 'calc', id, project, norms, cableRefs })
    })
  }

  /** Зупинити воркер і відхилити всі незавершені запити. */
  function terminate() {
    worker.terminate?.()
    for (const entry of pending.values()) entry.reject(new Error('calc client terminated'))
    pending.clear()
  }

  return { recalc, terminate }
}
