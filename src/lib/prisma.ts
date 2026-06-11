import { PrismaClient, Prisma } from '@prisma/client'
import { decryptPII, encryptPII } from './crypto'

export { Prisma }

// ── PII encryption at rest ────────────────────────────────────────────────────
// Tax registration numbers and bank details are encrypted with AES-256-GCM
// (see src/lib/crypto.ts) transparently: writes encrypt, reads decrypt. No
// query in the codebase filters on these fields, so equality search over
// ciphertext is not a concern.

const PII_FIELDS = {
  organization: ['ntn', 'strn'],
  distributor: ['ntn', 'strn', 'bankAccount', 'iban'],
  client: ['ntn', 'strn'],
} as const

type PiiModel = keyof typeof PII_FIELDS

function encryptRecord(record: Record<string, unknown>, fields: readonly string[]) {
  for (const field of fields) {
    const value = record[field]
    if (typeof value === 'string') record[field] = encryptPII(value)
    // handle { set: 'value' } update shape
    else if (value && typeof value === 'object' && 'set' in value) {
      const set = (value as { set: unknown }).set
      if (typeof set === 'string') (value as { set: unknown }).set = encryptPII(set)
    }
  }
}

function encryptArgs(model: PiiModel, args: Record<string, unknown>) {
  const fields = PII_FIELDS[model]
  for (const key of ['data', 'create', 'update'] as const) {
    const payload = args[key]
    if (!payload) continue
    if (Array.isArray(payload)) {
      for (const row of payload) encryptRecord(row as Record<string, unknown>, fields)
    } else {
      encryptRecord(payload as Record<string, unknown>, fields)
    }
  }
}

function piiQueryHandler(model: PiiModel) {
  return ({
    args,
    query,
  }: {
    args: Record<string, unknown>
    query: (args: Record<string, unknown>) => Promise<unknown>
  }) => {
    encryptArgs(model, args)
    return query(args)
  }
}

// Result extensions need literal field names for Prisma's type inference —
// a dynamic Object.fromEntries helper loses them, so each field is spelled out.
const dec = (v: string | null) => decryptPII(v) ?? null

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  }).$extends({
    name: 'pii-encryption',
    query: {
      organization: { $allOperations: piiQueryHandler('organization') },
      distributor: { $allOperations: piiQueryHandler('distributor') },
      client: { $allOperations: piiQueryHandler('client') },
    },
    result: {
      organization: {
        ntn: { needs: { ntn: true }, compute: (o) => dec(o.ntn) },
        strn: { needs: { strn: true }, compute: (o) => dec(o.strn) },
      },
      distributor: {
        ntn: { needs: { ntn: true }, compute: (d) => dec(d.ntn) },
        strn: { needs: { strn: true }, compute: (d) => dec(d.strn) },
        bankAccount: { needs: { bankAccount: true }, compute: (d) => dec(d.bankAccount) },
        iban: { needs: { iban: true }, compute: (d) => dec(d.iban) },
      },
      client: {
        ntn: { needs: { ntn: true }, compute: (c) => dec(c.ntn) },
        strn: { needs: { strn: true }, compute: (c) => dec(c.strn) },
      },
    },
  })
}

export type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>

const globalForPrisma = globalThis as unknown as { prisma: ExtendedPrismaClient }

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
