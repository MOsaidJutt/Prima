import { PrismaClient, SuperAdminRole, OrgStatus, SubscriptionPlan } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // ── Super Admin Owner ──────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash(process.env.SUPER_ADMIN_PASSWORD ?? 'SuperAdmin@123', 12)

  const superAdmin = await prisma.superAdmin.upsert({
    where: { email: process.env.SUPER_ADMIN_EMAIL ?? 'admin@prima.app' },
    update: {},
    create: {
      email: process.env.SUPER_ADMIN_EMAIL ?? 'admin@prima.app',
      passwordHash,
      name: 'Prima Owner',
      role: SuperAdminRole.OWNER,
      permissions: ['*'],
      isActive: true,
    },
  })
  console.log(`✅ Super Admin: ${superAdmin.email}`)

  // ── Platform Settings ──────────────────────────────────────────────────────
  const defaultSettings = [
    {
      key: 'platform.name',
      value: { value: 'Prima' },
    },
    {
      key: 'platform.pricing',
      value: {
        starter: { monthly: 4999, setup: 9999 },
        pro: { monthly: 9999, setup: 14999 },
        business: { monthly: 19999, setup: 24999 },
        enterprise: { monthly: 0, setup: 0, custom: true },
      },
    },
    {
      key: 'platform.tokenPacks',
      value: [
        { id: 'pack_100k', tokens: 100000, price: 999, label: '100K tokens' },
        { id: 'pack_500k', tokens: 500000, price: 3999, label: '500K tokens' },
        { id: 'pack_1m', tokens: 1000000, price: 6999, label: '1M tokens' },
      ],
    },
    {
      key: 'platform.trialDays',
      value: { value: 14 },
    },
    {
      key: 'platform.support',
      value: { email: 'support@prima.app', whatsapp: '+923001234567' },
    },
  ]

  for (const setting of defaultSettings) {
    await prisma.platformSettings.upsert({
      where: { key: setting.key },
      update: { value: setting.value },
      create: { key: setting.key, value: setting.value },
    })
  }
  console.log(`✅ Platform settings (${defaultSettings.length} keys)`)

  // ── Demo Org 1: On Trial ───────────────────────────────────────────────────
  const trialOrg = await prisma.organization.upsert({
    where: { slug: 'acme-pk' },
    update: {},
    create: {
      slug: 'acme-pk',
      name: 'ACME Pakistan (Pvt) Ltd',
      status: OrgStatus.TRIAL,
      email: 'admin@acme.pk',
      adminEmail: 'admin@acme.pk',
      adminName: 'ACME Admin',
      phone: '+92-21-1234567',
      city: 'Karachi',
      country: 'PK',
      plan: SubscriptionPlan.PRO,
      trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      onboardingCompleted: false,
      onboardingStep: 0,
      primaryColor: '#6366F1',
    },
  })
  console.log(`✅ Demo org (trial): ${trialOrg.slug}`)

  // ── Demo Org 2: Active ─────────────────────────────────────────────────────
  const activeOrg = await prisma.organization.upsert({
    where: { slug: 'techcorp-pvt' },
    update: {},
    create: {
      slug: 'techcorp-pvt',
      name: 'TechCorp (Pvt) Ltd',
      status: OrgStatus.ACTIVE,
      email: 'admin@techcorp.pk',
      adminEmail: 'admin@techcorp.pk',
      adminName: 'TechCorp Admin',
      phone: '+92-42-9876543',
      city: 'Lahore',
      country: 'PK',
      plan: SubscriptionPlan.BUSINESS,
      subscriptionStart: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      setupFeePaid: true,
      monthlyPrice: 19999,
      onboardingCompleted: true,
      onboardingStep: 4,
      aiEnabled: true,
      primaryColor: '#0EA5E9',
    },
  })
  console.log(`✅ Demo org (active): ${activeOrg.slug}`)

  console.log('\n🎉 Seed complete!')
  console.log('──────────────────────────────────')
  console.log(`Super Admin login: ${superAdmin.email}`)
  console.log(`Password:          ${process.env.SUPER_ADMIN_PASSWORD ?? 'SuperAdmin@123'}`)
  console.log(`URL:               http://localhost:3000/super-admin/login`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
