import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto'

// ── PII field encryption (at rest) ───────────────────────────────────────────
// AES-256-GCM with a key derived from PII_ENCRYPTION_KEY. Ciphertext format:
//   enc:v1:<base64 iv>:<base64 auth tag>:<base64 ciphertext>
// Values without the `enc:` prefix are treated as legacy plaintext and pass
// through decryptPII unchanged, so the backfill script can run gradually.
//
// Applied transparently to Organization/Distributor/Client tax + bank fields
// via the Prisma client extension in src/lib/prisma.ts.

const PREFIX = 'enc:v1:'

let _key: Buffer | null | undefined

function getKey(): Buffer | null {
  if (_key !== undefined) return _key
  const raw = process.env.PII_ENCRYPTION_KEY
  if (!raw) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        '[crypto] PII_ENCRYPTION_KEY is required in production. ' +
          'Generate one with: openssl rand -base64 32'
      )
    }
    _key = null // dev/test without a key: PII stored as plaintext
    return _key
  }
  // Accept any string ≥16 chars; normalize to 32 bytes via SHA-256 so ops
  // teams can use base64, hex, or a passphrase without format errors.
  if (raw.length < 16) {
    throw new Error('[crypto] PII_ENCRYPTION_KEY must be at least 16 characters')
  }
  _key = createHash('sha256').update(raw).digest()
  return _key
}

/** True when a PII encryption key is configured. */
export function isPIIEncryptionEnabled(): boolean {
  return getKey() !== null
}

/** Encrypt a PII value. Returns the input unchanged when null/empty, already encrypted, or no key is configured (dev). */
export function encryptPII(value: string | null | undefined): string | null | undefined {
  if (value === null || value === undefined || value === '') return value
  if (value.startsWith(PREFIX)) return value
  const key = getKey()
  if (!key) return value
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ct = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`
}

/** Decrypt a PII value. Legacy plaintext (no enc: prefix) passes through. */
export function decryptPII(value: string | null | undefined): string | null | undefined {
  if (value === null || value === undefined || !value.startsWith(PREFIX)) return value
  const key = getKey()
  if (!key) {
    throw new Error('[crypto] Found encrypted PII but PII_ENCRYPTION_KEY is not set')
  }
  const [ivB64, tagB64, ctB64] = value.slice(PREFIX.length).split(':')
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'))
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64')), decipher.final()]).toString(
    'utf8'
  )
}
