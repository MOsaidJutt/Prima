/**
 * DEV ONLY — creates a test invitation with a known token for local testing.
 * Run: npx tsx scripts/create-test-invite.ts
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()
const TEST_TOKEN = 'test-invite-token-12345678901234567890'

async function main() {
  // Find the test org (or use acme-pk if no test org exists)
  const org = await prisma.organization.findFirst({
    where: { slug: 'test-company', deletedAt: null },
  })

  if (!org) {
    console.log('❌  No org with slug "test-company" found.')
    console.log('   Create one first via the Super Admin panel at /super-admin/organizations/new')
    return
  }

  // Delete any existing pending invitations for this org
  await prisma.organizationInvitation.deleteMany({
    where: { organizationId: org.id, acceptedAt: null },
  })

  const tokenHash = await bcrypt.hash(TEST_TOKEN, 10)
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000)

  await prisma.organizationInvitation.create({
    data: {
      organizationId: org.id,
      email: org.adminEmail ?? org.email,
      tokenHash,
      expiresAt,
    },
  })

  const url = `http://localhost:3000/onboarding/accept?token=${TEST_TOKEN}`
  console.log('\n✅  Test invitation created!')
  console.log('──────────────────────────────────────────────────────────')
  console.log(`Organization:  ${org.name}`)
  console.log(`Token:         ${TEST_TOKEN}`)
  console.log(`\nOpen this URL in your browser:`)
  console.log(`\n  ${url}\n`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
