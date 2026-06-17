import { prisma } from '@/lib/prisma'
import type { EmailSuppressionReason } from '@prisma/client'

function normalize(email: string) {
  return email.trim().toLowerCase()
}

export async function isEmailSuppressed(email: string): Promise<boolean> {
  const row = await prisma.emailSuppression.findUnique({
    where: { email: normalize(email) },
    select: { id: true },
  })
  return !!row
}

export async function suppressEmail(
  email: string,
  reason: EmailSuppressionReason,
  detail?: string
) {
  await prisma.emailSuppression.upsert({
    where: { email: normalize(email) },
    create: { email: normalize(email), reason, detail },
    update: { reason, detail },
  })
}
