/**
 * One-time backfill: encrypt existing plaintext PII rows after enabling
 * PII_ENCRYPTION_KEY. Safe to re-run — already-encrypted values (enc:v1:
 * prefix) are skipped by encryptPII, and rows are rewritten through the raw
 * (unextended) client so values are not double-processed by the extension.
 *
 * Usage:  npx tsx scripts/encrypt-pii-backfill.ts
 */
import { PrismaClient } from '@prisma/client'
import { encryptPII, isPIIEncryptionEnabled } from '../src/lib/crypto'

const raw = new PrismaClient()

const TARGETS = [
  { model: 'organization', fields: ['ntn', 'strn'] },
  { model: 'distributor', fields: ['ntn', 'strn', 'bankAccount', 'iban'] },
  { model: 'client', fields: ['ntn', 'strn'] },
] as const

async function main() {
  if (!isPIIEncryptionEnabled()) {
    console.error('PII_ENCRYPTION_KEY is not set — nothing to do.')
    process.exit(1)
  }

  for (const { model, fields } of TARGETS) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const delegate = (raw as any)[model]
    const rows: Array<Record<string, string | null>> = await delegate.findMany({
      select: Object.fromEntries([['id', true], ...fields.map((f) => [f, true])]),
    })

    let updated = 0
    for (const row of rows) {
      const data: Record<string, string> = {}
      for (const field of fields) {
        const value = row[field]
        if (value && !value.startsWith('enc:v1:')) {
          data[field] = encryptPII(value) as string
        }
      }
      if (Object.keys(data).length > 0) {
        await delegate.update({ where: { id: row.id }, data })
        updated++
      }
    }
    console.log(`${model}: ${rows.length} rows scanned, ${updated} encrypted`)
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => raw.$disconnect())
