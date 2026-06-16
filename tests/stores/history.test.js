import { describe, it, expect } from 'vitest'
import { createHistory } from '@/stores/history.js'

describe('stores/history: undo/redo стек', () => {
  it('початково нема чого скасувати/повторити', () => {
    const h = createHistory({ n: 0 })
    expect(h.canUndo()).toBe(false)
    expect(h.canRedo()).toBe(false)
    expect(h.size()).toBe(1)
  })

  it('push → undo повертає попередній стан', () => {
    const h = createHistory({ n: 0 })
    h.push({ n: 1 })
    h.push({ n: 2 })
    expect(h.canUndo()).toBe(true)
    expect(h.undo()).toEqual({ n: 1 })
    expect(h.undo()).toEqual({ n: 0 })
    expect(h.canUndo()).toBe(false)
    expect(h.undo()).toBeNull()
  })

  it('redo повторює скасоване', () => {
    const h = createHistory({ n: 0 })
    h.push({ n: 1 })
    h.undo()
    expect(h.canRedo()).toBe(true)
    expect(h.redo()).toEqual({ n: 1 })
    expect(h.canRedo()).toBe(false)
    expect(h.redo()).toBeNull()
  })

  it('нова зміна після undo обрізає redo-гілку', () => {
    const h = createHistory({ n: 0 })
    h.push({ n: 1 })
    h.push({ n: 2 })
    h.undo() // → {n:1}, redo доступний до {n:2}
    h.push({ n: 99 }) // нова гілка
    expect(h.canRedo()).toBe(false)
    expect(h.redo()).toBeNull()
    expect(h.undo()).toEqual({ n: 1 })
  })

  it('reset скидає до одного знімка', () => {
    const h = createHistory({ n: 0 })
    h.push({ n: 1 })
    h.push({ n: 2 })
    h.reset({ n: 5 })
    expect(h.size()).toBe(1)
    expect(h.canUndo()).toBe(false)
    expect(h.canRedo()).toBe(false)
  })

  it('обмежує глибину історії', () => {
    const h = createHistory({ n: 0 }, 3)
    for (let i = 1; i <= 10; i++) h.push({ n: i })
    expect(h.size()).toBe(3)
    // найновіший — {n:10}; скасування йде вглиб не більше ніж на 2
    expect(h.undo()).toEqual({ n: 9 })
    expect(h.undo()).toEqual({ n: 8 })
    expect(h.undo()).toBeNull()
  })
})
