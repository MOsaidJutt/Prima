import { PrismaClient, SuperAdminRole, OrgStatus, SubscriptionPlan } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { DEFAULT_ROLES } from '../src/lib/permissions'

const prisma = new PrismaClient()

async function seedRolesForOrg(organizationId: string): Promise<Record<string, string>> {
  const roleIds: Record<string, string> = {}

  for (const roleDef of DEFAULT_ROLES) {
    const existing = await prisma.role.findFirst({
      where: { organizationId, name: roleDef.name, deletedAt: null },
    })

    if (existing) {
      roleIds[roleDef.name] = existing.id
    } else {
      const created = await prisma.role.create({
        data: {
          organizationId,
          name: roleDef.name,
          description: roleDef.description,
          isSystem: roleDef.isSystem,
          permissions: roleDef.permissions as string[],
        },
      })
      roleIds[roleDef.name] = created.id
    }
  }

  return roleIds
}

async function seedOwnerUser(opts: {
  organizationId: string
  roleId: string
  email: string
  name: string
  password: string
}) {
  const existing = await prisma.user.findFirst({
    where: { organizationId: opts.organizationId, email: opts.email, deletedAt: null },
  })
  if (existing) return existing

  const passwordHash = await bcrypt.hash(opts.password, 12)
  return prisma.user.create({
    data: {
      organizationId: opts.organizationId,
      roleId: opts.roleId,
      email: opts.email,
      name: opts.name,
      passwordHash,
      isActive: true,
    },
  })
}

async function main() {
  console.log('🌱 Seeding database...')

  // ── Super Admin Owner ──────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash(process.env.SUPER_ADMIN_PASSWORD ?? 'SuperAdmin@123', 12)

  const superAdmin = await prisma.superAdmin.upsert({
    where: { email: process.env.SUPER_ADMIN_EMAIL ?? 'admin@prima.app' },
    update: { passwordHash },
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
    { key: 'platform.name', value: { value: 'Prima' } },
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
    { key: 'platform.trialDays', value: { value: 14 } },
    { key: 'platform.support', value: { email: 'support@prima.app', whatsapp: '+923001234567' } },
  ]

  for (const setting of defaultSettings) {
    await prisma.platformSettings.upsert({
      where: { key: setting.key },
      update: { value: setting.value },
      create: { key: setting.key, value: setting.value },
    })
  }
  console.log(`✅ Platform settings (${defaultSettings.length} keys)`)

  // ── Demo Org 1: ACME (Trial) ───────────────────────────────────────────────
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
      onboardingCompleted: true,
      onboardingStep: 4,
      primaryColor: '#0F172A',
    },
  })
  console.log(`✅ Demo org (trial):  ${trialOrg.slug} (id: ${trialOrg.id})`)

  // Seed roles for trial org
  const trialRoles = await seedRolesForOrg(trialOrg.id)
  console.log(`   └─ Roles: ${Object.keys(trialRoles).join(', ')}`)

  // Seed Owner user for trial org
  const trialAdmin = await seedOwnerUser({
    organizationId: trialOrg.id,
    roleId: trialRoles['Owner'],
    email: 'admin@acme.pk',
    name: 'ACME Admin',
    password: process.env.DEMO_ADMIN_PASSWORD ?? 'Admin@123',
  })
  // Null out the Phase 0 placeholder hash now that User exists
  await prisma.organization.update({
    where: { id: trialOrg.id },
    data: { adminPasswordHash: trialAdmin.passwordHash },
  })
  console.log(`   └─ Owner user: ${trialAdmin.email}`)

  // Seed demo Sales Rep user
  const salesRep1 = await seedOwnerUser({
    organizationId: trialOrg.id,
    roleId: trialRoles['Sales Rep'],
    email: 'salesperson@acme.pk',
    name: 'Ahmed Sales Rep',
    password: process.env.DEMO_ADMIN_PASSWORD ?? 'Admin@123',
  })
  console.log(`   └─ Sales Rep: ${salesRep1.email}`)

  // Seed first department if not exists
  const existingDept = await prisma.department.findFirst({
    where: { organizationId: trialOrg.id, name: 'Sales', deletedAt: null },
  })
  if (!existingDept) {
    await prisma.department.create({
      data: {
        organizationId: trialOrg.id,
        name: 'Sales',
        managerId: trialAdmin.id,
        lastModifiedBy: trialAdmin.id,
      },
    })
    console.log(`   └─ Department: Sales`)
  }

  // ── Demo Org 2: TechCorp (Active) ──────────────────────────────────────────
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
      primaryColor: '#0F172A',
    },
  })
  console.log(`✅ Demo org (active): ${activeOrg.slug} (id: ${activeOrg.id})`)

  const activeRoles = await seedRolesForOrg(activeOrg.id)
  console.log(`   └─ Roles: ${Object.keys(activeRoles).join(', ')}`)

  const activeAdmin = await seedOwnerUser({
    organizationId: activeOrg.id,
    roleId: activeRoles['Owner'],
    email: 'admin@techcorp.pk',
    name: 'TechCorp Admin',
    password: process.env.DEMO_ADMIN_PASSWORD ?? 'Admin@123',
  })
  await prisma.organization.update({
    where: { id: activeOrg.id },
    data: { adminPasswordHash: activeAdmin.passwordHash },
  })
  console.log(`   └─ Owner user: ${activeAdmin.email}`)

  // Seed a Manager user for TechCorp
  const manager1 = await seedOwnerUser({
    organizationId: activeOrg.id,
    roleId: activeRoles['Manager'],
    email: 'manager@techcorp.pk',
    name: 'Sara Manager',
    password: process.env.DEMO_ADMIN_PASSWORD ?? 'Admin@123',
  })
  console.log(`   └─ Manager: ${manager1.email}`)

  // Seed Accountant
  await seedOwnerUser({
    organizationId: activeOrg.id,
    roleId: activeRoles['Accountant'],
    email: 'accounts@techcorp.pk',
    name: 'Bilal Accountant',
    password: process.env.DEMO_ADMIN_PASSWORD ?? 'Admin@123',
  })

  // Seed 2 Sales Reps
  for (let i = 1; i <= 2; i++) {
    await seedOwnerUser({
      organizationId: activeOrg.id,
      roleId: activeRoles['Sales Rep'],
      email: `rep${i}@techcorp.pk`,
      name: `Sales Rep ${i}`,
      password: process.env.DEMO_ADMIN_PASSWORD ?? 'Admin@123',
    })
  }
  console.log(`   └─ 4 additional users seeded`)

  console.log('\n🎉 Seed complete!')
  console.log('──────────────────────────────────────────────')
  console.log(`Super Admin login: ${superAdmin.email}`)
  console.log(`Password:          ${process.env.SUPER_ADMIN_PASSWORD ?? 'SuperAdmin@123'}`)
  console.log(`URL:               http://localhost:3000/super-admin/login`)
  console.log('')
  console.log(`Demo Tenant (trial):  admin@acme.pk`)
  console.log(`Demo Tenant (active): admin@techcorp.pk`)
  console.log(`Demo Password:        ${process.env.DEMO_ADMIN_PASSWORD ?? 'Admin@123'}`)
  console.log(`URL:                  http://localhost:3000/login`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
