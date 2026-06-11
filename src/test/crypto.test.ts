import { describe, it, expect, beforeEach, vi } from 'vitest'

// crypto.ts caches the derived key in module scope, so each scenario gets a
// fresh module instance via vi.resetModules() + dynamic import.
async function loadCrypto(key: string | undefined) {
  vi.resetModules()
  if (key === undefined) delete process.env.PII_ENCRYPTION_KEY
  else process.env.PII_ENCRYPTION_KEY = key
  return import('@/lib/crypto')
}

describe('PII encryption (crypto.ts)', () => {
  beforeEach(() => {
    delete process.env.PII_ENCRYPTION_KEY
  })

  it('round-trips a value with a configured key', async () => {
    const { encryptPII, decryptPII } = await loadCrypto('test-key-32-chars-aaaaaaaaaaaaaa')
    const encrypted = encryptPII('1234567-8')
    expect(encrypted).toMatch(/^enc:v1:/)
    expect(encrypted).not.toContain('1234567-8')
    expect(decryptPII(encrypted)).toBe('1234567-8')
  })

  it('produces a different ciphertext per call (random IV)', async () => {
    const { encryptPII } = await loadCrypto('test-key-32-chars-aaaaaaaaaaaaaa')
    expect(encryptPII('same-value')).not.toBe(encryptPII('same-value'))
  })

  it('passes through null, undefined, and empty string', async () => {
    const { encryptPII, decryptPII } = await loadCrypto('test-key-32-chars-aaaaaaaaaaaaaa')
    expect(encryptPII(null)).toBeNull()
    expect(encryptPII(undefined)).toBeUndefined()
    expect(encryptPII('')).toBe('')
    expect(decryptPII(null)).toBeNull()
    expect(decryptPII('')).toBe('')
  })

  it('does not double-encrypt already-encrypted values', async () => {
    const { encryptPII } = await loadCrypto('test-key-32-chars-aaaaaaaaaaaaaa')
    const once = encryptPII('value') as string
    expect(encryptPII(once)).toBe(once)
  })

  it('decryptPII passes through legacy plaintext (no enc: prefix)', async () => {
    const { decryptPII } = await loadCrypto('test-key-32-chars-aaaaaaaaaaaaaa')
    expect(decryptPII('plain-old-ntn')).toBe('plain-old-ntn')
  })

  it('rejects tampered ciphertext (GCM auth tag)', async () => {
    const { encryptPII, decryptPII } = await loadCrypto('test-key-32-chars-aaaaaaaaaaaaaa')
    const encrypted = encryptPII('secret') as string
    const tampered = encrypted.slice(0, -4) + (encrypted.endsWith('AAAA') ? 'BBBB' : 'AAAA')
    expect(() => decryptPII(tampered)).toThrow()
  })

  it('without a key (dev): encrypt passes through, decrypt of ciphertext throws', async () => {
    const withKey = await loadCrypto('test-key-32-chars-aaaaaaaaaaaaaa')
    const encrypted = withKey.encryptPII('secret') as string

    const noKey = await loadCrypto(undefined)
    expect(noKey.isPIIEncryptionEnabled()).toBe(false)
    expect(noKey.encryptPII('secret')).toBe('secret')
    expect(() => noKey.decryptPII(encrypted)).toThrow(/PII_ENCRYPTION_KEY/)
  })

  it('rejects keys shorter than 16 characters', async () => {
    const { encryptPII } = await loadCrypto('short')
    expect(() => encryptPII('x')).toThrow(/at least 16/)
  })
})
