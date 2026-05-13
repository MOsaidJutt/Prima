import { describe, it, expect } from 'vitest'
import { slugify, generateCode, cn } from '@/lib/utils'

describe('slugify', () => {
  it('lowercases and replaces spaces with hyphens', () => {
    expect(slugify('ACME Pakistan (Pvt) Ltd')).toBe('acme-pakistan-pvt-ltd')
  })
  it('strips leading/trailing hyphens', () => {
    expect(slugify(' hello world ')).toBe('hello-world')
  })
})

describe('generateCode', () => {
  it('pads number to 4 digits', () => {
    expect(generateCode('DST', 1)).toBe('DST-0001')
    expect(generateCode('DST', 123)).toBe('DST-0123')
  })
})

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('px-2', 'py-2')).toBe('px-2 py-2')
  })
  it('deduplicates tailwind classes', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })
})
