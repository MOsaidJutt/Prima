import { NextRequest } from 'next/server'
import { withTenantApi, apiOk, apiError, generateEntityCode } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'

const ALLOWED_MIME = new Set([
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/octet-stream', // some browsers send this for .xlsx
])
const MAX_BYTES = 5 * 1024 * 1024 // 5 MB

export async function POST(req: NextRequest) {
  return withTenantApi(req, 'clients:create', async ({ ctx, user }) => {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return apiError('No file provided')

    // C-3/M-6: validate size and MIME before reading bytes
    if (file.size > MAX_BYTES) return apiError('File too large (max 5 MB)', 413)
    if (!ALLOWED_MIME.has(file.type) && !file.name.match(/\.(csv|xls|xlsx)$/i)) {
      return apiError('Only CSV or Excel files are supported')
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    let rows: Record<string, string>[]

    try {
      const wb = XLSX.read(buffer, { type: 'buffer' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      rows = XLSX.utils.sheet_to_json(ws, { defval: '' }) as Record<string, string>[]
    } catch {
      return apiError('Invalid file format. Please upload a CSV or Excel file.')
    }

    if (!rows.length) return apiError('File is empty')
    if (rows.length > 1000) return apiError('Maximum 1,000 rows per import')

    // C-2: resolve starting code once (orderBy desc on existing codes — no TOCTOU race)
    // then increment in memory. All creates run in parallel inside a transaction.
    const firstCode = await generateEntityCode(ctx.organizationId, 'CLT', 'client')
    const firstNum = parseInt(firstCode.split('-').pop() ?? '1', 10)

    // Filter valid rows first so we know exact count/codes
    const validRows = rows.filter((row) => (row['Company Name'] || row['companyName'] || '').trim())
    if (!validRows.length) return apiError('No rows with a Company Name found')

    let created = 0
    let skipped = 0
    const errors: string[] = []

    // Batch in groups of 100 to avoid overloading the transaction
    const BATCH = 100
    for (let b = 0; b < validRows.length; b += BATCH) {
      const batch = validRows.slice(b, b + BATCH)
      try {
        await prisma.$transaction(
          batch.map((row, idx) => {
            const num = firstNum + b + idx
            const code = `CLT-${String(num).padStart(4, '0')}`
            return prisma.client.create({
              data: {
                organizationId: ctx.organizationId,
                code,
                companyName: (row['Company Name'] || row['companyName'] || '').trim(),
                contactName: (row['Contact Name'] || row['contactName'] || '').trim() || undefined,
                email: (row['Email'] || row['email'] || '').trim() || undefined,
                phone: (row['Phone'] || row['phone'] || '').trim() || undefined,
                city: (row['City'] || row['city'] || '').trim() || undefined,
                country: (row['Country'] || row['country'] || 'PK').trim(),
                status: 'ACTIVE',
                creditLimit: Number(row['Credit Limit'] || 0),
                paymentTerms: Number(row['Payment Terms'] || 30),
                lastModifiedBy: user.id,
              },
            })
          })
        )
        created += batch.length
      } catch (err) {
        // On batch failure, fall back to row-by-row with unique codes from DB
        for (let i = 0; i < batch.length; i++) {
          const row = batch[i]
          try {
            const code = await generateEntityCode(ctx.organizationId, 'CLT', 'client')
            await prisma.client.create({
              data: {
                organizationId: ctx.organizationId,
                code,
                companyName: (row['Company Name'] || row['companyName'] || '').trim(),
                contactName: (row['Contact Name'] || row['contactName'] || '').trim() || undefined,
                email: (row['Email'] || row['email'] || '').trim() || undefined,
                phone: (row['Phone'] || row['phone'] || '').trim() || undefined,
                city: (row['City'] || row['city'] || '').trim() || undefined,
                country: (row['Country'] || row['country'] || 'PK').trim(),
                status: 'ACTIVE',
                creditLimit: Number(row['Credit Limit'] || 0),
                paymentTerms: Number(row['Payment Terms'] || 30),
                lastModifiedBy: user.id,
              },
            })
            created++
          } catch (rowErr) {
            const rowNum = b + i + 2
            errors.push(`Row ${rowNum}: ${(rowErr as Error).message}`)
            skipped++
          }
        }
        void err // batch error handled above row-by-row
      }
    }

    // rows without company name
    skipped += rows.length - validRows.length

    return apiOk({ created, skipped, errors: errors.slice(0, 10) })
  })
}
