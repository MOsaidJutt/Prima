import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32 // 256 bits
const IV_LENGTH = 12 // 96 bits — GCM standard
const TAG_LENGTH = 16 // 128 bits

function getMasterKey(): Buffer {
  const key = process.env.AI_ENCRYPTION_KEY
  if (!key) throw new Error('AI_ENCRYPTION_KEY environment variable is not set')
  const buf = Buffer.from(key, 'hex')
  if (buf.length !== KEY_LENGTH)
    throw new Error('AI_ENCRYPTION_KEY must be 64 hex characters (32 bytes)')
  return buf
}

// Returns iv:authTag:ciphertext as a single base64-encoded string
export function encryptApiKey(plaintext: string): string {
  const key = getMasterKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  // Prefix with iv + tag so we can recover them on decrypt
  const combined = Buffer.concat([iv, tag, encrypted])
  return combined.toString('base64')
}

export function decryptApiKey(ciphertext: string): string {
  const key = getMasterKey()
  const combined = Buffer.from(ciphertext, 'base64')
  const iv = combined.subarray(0, IV_LENGTH)
  const tag = combined.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
  const encrypted = combined.subarray(IV_LENGTH + TAG_LENGTH)
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  return decipher.update(encrypted) + decipher.final('utf8')
}

// Returns a secure random 64-hex-char key for AI_ENCRYPTION_KEY generation
export function generateEncryptionKey(): string {
  return randomBytes(KEY_LENGTH).toString('hex')
}
