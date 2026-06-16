import { describe, it, expect } from 'vitest'
import { uid } from '@/model/id.js'

describe('model/id: uid', () => {
  it('має формат prefix_xxxxxxxx', () => {
    expect(uid('prj')).toMatch(/^prj_[0-9a-f]{8}$/)
    expect(uid('g')).toMatch(/^g_[0-9a-f]{8}$/)
  })

  it('генерує унікальні значення', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => uid('p')))
    expect(ids.size).toBe(1000)
  })
})
