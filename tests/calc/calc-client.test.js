import { describe, it, expect } from 'vitest'
import { createCalcClient } from '@/calc/calc-client.js'

/**
 * Фейковий воркер: записує надіслані повідомлення й дозволяє вручну
 * «відповісти» від його імені (повний контроль над порядком для перевірки
 * кореляції за id).
 */
function makeFakeWorker() {
  const fake = {
    /** @type {((event: { data: any }) => void) | null} */
    onmessage: null,
    /** @type {any[]} */
    sent: [],
    terminated: false,
    /** @param {any} message */
    postMessage(message) {
      this.sent.push(message)
    },
    terminate() {
      this.terminated = true
    },
    /** @param {any} message Відповісти від імені воркера. */
    respond(message) {
      this.onmessage?.({ data: message })
    },
  }
  return fake
}

describe('calc/calc-client: createCalcClient', () => {
  it('надсилає запит calc з id і вхідними даними', () => {
    const w = makeFakeWorker()
    const client = createCalcClient({ worker: w })
    void client.recalc(/** @type {any} */ ({ project: 1 }), /** @type {any} */ ({}), [])
    expect(w.sent).toHaveLength(1)
    expect(w.sent[0].type).toBe('calc')
    expect(typeof w.sent[0].id).toBe('number')
  })

  it("резолвить Promise результатом 'result'", async () => {
    const w = makeFakeWorker()
    const client = createCalcClient({ worker: w })
    const p = client.recalc(null, /** @type {any} */ ({}), [])
    const { id } = w.sent[0]
    const result = /** @type {any} */ ({ groups: [], incomer: { currentA: 0 } })
    w.respond({ type: 'result', id, result })
    await expect(p).resolves.toBe(result)
  })

  it("реджектить Promise на 'error'", async () => {
    const w = makeFakeWorker()
    const client = createCalcClient({ worker: w })
    const p = client.recalc(null, /** @type {any} */ ({}), [])
    w.respond({ type: 'error', id: w.sent[0].id, error: 'boom' })
    await expect(p).rejects.toThrow('boom')
  })

  it('корелює відповіді за id (порядок не важливий)', async () => {
    const w = makeFakeWorker()
    const client = createCalcClient({ worker: w })
    const p1 = client.recalc(null, /** @type {any} */ ({}), [])
    const p2 = client.recalc(null, /** @type {any} */ ({}), [])
    const [id1, id2] = w.sent.map((m) => m.id)
    // відповідаємо у зворотному порядку
    w.respond({ type: 'result', id: id2, result: /** @type {any} */ ('r2') })
    w.respond({ type: 'result', id: id1, result: /** @type {any} */ ('r1') })
    await expect(p1).resolves.toBe('r1')
    await expect(p2).resolves.toBe('r2')
  })

  it('ігнорує відповідь з невідомим id', () => {
    const w = makeFakeWorker()
    const client = createCalcClient({ worker: w })
    void client.recalc(null, /** @type {any} */ ({}), [])
    // не кидає і не чіпає pending
    expect(() => w.respond({ type: 'result', id: 999, result: /** @type {any} */ ({}) })).not.toThrow()
  })

  it('terminate зупиняє воркер і реджектить незавершені запити', async () => {
    const w = makeFakeWorker()
    const client = createCalcClient({ worker: w })
    const p = client.recalc(null, /** @type {any} */ ({}), [])
    client.terminate()
    expect(w.terminated).toBe(true)
    await expect(p).rejects.toThrow('terminated')
  })
})
