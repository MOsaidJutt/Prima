import { NextRequest } from 'next/server'
import { withTenantApi, apiOk, apiError } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'

export async function POST(req: NextRequest) {
  return withTenantApi(req, 'distributors:create', async ({ ctx, user }) => {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return apiError('No file provided')

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

    let created = 0
    let skipped = 0
    const errors: string[] = []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const companyName = (row['Company Name'] || row['companyName'] || '').trim()
      if (!companyName) {
        skipped++
        continue
      }

      try {
        // Auto-generate code
        const count = await prisma.distributor.count({
          where: { organizationId: ctx.organizationId },
        })
        const code = `DST-${String(count + 1).padStart(4, '0')}`

        await prisma.distributor.create({
          data: {
            organizationId: ctx.organizationId,
            code,
            companyName,
            contactName: (row['Contact Name'] || row['contactName'] || '').trim() || undefined,
            email: (row['Email'] || row['email'] || '').trim() || undefined,
            phone: (row['Phone'] || row['phone'] || '').trim() || undefined,
            city: (row['City'] || row['city'] || '').trim() || undefined,
            country: (row['Country'] || row['country'] || 'PK').trim(),
            status: 'ACTIVE',
            tier: 'BRONZE',
            creditLimit: Number(row['Credit Limit'] || row['creditLimit'] || 0),
            paymentTerms: Number(row['Payment Terms'] || row['paymentTerms'] || 30),
            lastModifiedBy: user.id,
          },
        })
        created++
      } catch (err) {
        errors.push(`Row ${i + 2}: ${(err as Error).message}`)
        skipped++
      }
    }

    return apiOk({ created, skipped, errors: errors.slice(0, 10) })
  })
}
