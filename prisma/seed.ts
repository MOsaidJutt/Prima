import {
  PrismaClient,
  SuperAdminRole,
  OrgStatus,
  SubscriptionPlan,
  DistributorStatus,
  DistributorTier,
  ClientStatus,
  BusinessType,
  BusinessSize,
  ProductStatus,
  InventoryTxType,
  DSRStatus,
  VisitType,
  InvoiceStatus,
  PaymentMethod,
  TargetScope,
  TargetType,
  TargetPeriod,
} from '@prisma/client'
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

  // Seed departments for TechCorp
  const deptNames = ['Sales', 'Accounts', 'Operations']
  const deptIds: Record<string, string> = {}
  for (const name of deptNames) {
    const existing = await prisma.department.findFirst({
      where: { organizationId: activeOrg.id, name, deletedAt: null },
    })
    const dept =
      existing ??
      (await prisma.department.create({
        data: {
          organizationId: activeOrg.id,
          name,
          managerId: name === 'Sales' ? manager1.id : activeAdmin.id,
          lastModifiedBy: activeAdmin.id,
        },
      }))
    deptIds[name] = dept.id
  }
  console.log(`   └─ Departments: ${deptNames.join(', ')}`)

  // Seed Accountant (assigned to Accounts dept)
  const accountant = await seedOwnerUser({
    organizationId: activeOrg.id,
    roleId: activeRoles['Accountant'],
    email: 'accounts@techcorp.pk',
    name: 'Bilal Accountant',
    password: process.env.DEMO_ADMIN_PASSWORD ?? 'Admin@123',
  })
  await prisma.user.update({
    where: { id: accountant.id },
    data: { departmentId: deptIds['Accounts'] },
  })

  // Seed 2 Sales Reps (assigned to Sales dept)
  for (let i = 1; i <= 2; i++) {
    const rep = await seedOwnerUser({
      organizationId: activeOrg.id,
      roleId: activeRoles['Sales Rep'],
      email: `rep${i}@techcorp.pk`,
      name: `Sales Rep ${i}`,
      password: process.env.DEMO_ADMIN_PASSWORD ?? 'Admin@123',
    })
    await prisma.user.update({ where: { id: rep.id }, data: { departmentId: deptIds['Sales'] } })
  }
  // Assign manager to Sales dept
  await prisma.user.update({ where: { id: manager1.id }, data: { departmentId: deptIds['Sales'] } })
  console.log(`   └─ 4 additional users seeded with departments`)

  // ── Phase 2: Business Entities for TechCorp (active org) ─────────────────────
  await seedPhase2(activeOrg.id, activeAdmin.id, activeRoles)
  console.log('\n✅ Phase 2 business entities seeded for TechCorp')

  // ── Phase 3: DSR + Invoicing for TechCorp ──────────────────────────────────
  await seedPhase3(activeOrg.id, activeAdmin.id, activeRoles)
  console.log('✅ Phase 3 DSR + Invoicing seeded for TechCorp')

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

// ── Phase 2 seeder ─────────────────────────────────────────────────────────────

async function seedPhase2(orgId: string, adminId: string, roles: Record<string, string>) {
  const reps = await prisma.user.findMany({
    where: { organizationId: orgId, roleId: roles['Sales Rep'], deletedAt: null },
  })
  const repId = reps[0]?.id ?? adminId

  // ── Warehouses ────────────────────────────────────────────────────────────────
  const warehouseData = [
    { code: 'WH-KHI', name: 'Karachi Main', city: 'Karachi', isDefault: true },
    { code: 'WH-LHR', name: 'Lahore Branch', city: 'Lahore', isDefault: false },
  ]
  const warehouses: Record<string, string> = {}
  for (const w of warehouseData) {
    const existing = await prisma.warehouse.findFirst({
      where: { organizationId: orgId, code: w.code },
    })
    const wh =
      existing ??
      (await prisma.warehouse.create({
        data: { organizationId: orgId, ...w, lastModifiedBy: adminId },
      }))
    warehouses[w.code] = wh.id
  }

  // ── Product Categories ────────────────────────────────────────────────────────
  const catData = [
    { name: 'Beverages', description: 'Soft drinks, juices, water' },
    { name: 'Snacks', description: 'Chips, biscuits, chocolates' },
    { name: 'Dairy', description: 'Milk, yogurt, cheese' },
    { name: 'Groceries', description: 'General household items' },
  ]
  const categories: Record<string, string> = {}
  for (const c of catData) {
    const existing = await prisma.productCategory.findFirst({
      where: { organizationId: orgId, name: c.name },
    })
    const cat =
      existing ??
      (await prisma.productCategory.create({
        data: { organizationId: orgId, ...c, lastModifiedBy: adminId },
      }))
    categories[c.name] = cat.id
  }

  // ── Products ──────────────────────────────────────────────────────────────────
  const productData = [
    {
      sku: 'BEV-001',
      name: 'Pepsi 1.5L',
      categoryId: categories['Beverages'],
      brand: 'Pepsi',
      costPrice: 55,
      sellingPrice: 65,
      mrp: 70,
      reorderLevel: 50,
      status: ProductStatus.ACTIVE,
    },
    {
      sku: 'BEV-002',
      name: 'Nestle Water 1L',
      categoryId: categories['Beverages'],
      brand: 'Nestle',
      costPrice: 18,
      sellingPrice: 25,
      mrp: 30,
      reorderLevel: 100,
      status: ProductStatus.ACTIVE,
    },
    {
      sku: 'SNK-001',
      name: 'Lays Classic 100g',
      categoryId: categories['Snacks'],
      brand: 'Lays',
      costPrice: 35,
      sellingPrice: 45,
      mrp: 50,
      reorderLevel: 30,
      status: ProductStatus.ACTIVE,
    },
    {
      sku: 'SNK-002',
      name: 'Rio Biscuits 150g',
      categoryId: categories['Snacks'],
      brand: 'English Biscuits',
      costPrice: 28,
      sellingPrice: 38,
      mrp: 42,
      reorderLevel: 40,
      status: ProductStatus.ACTIVE,
    },
    {
      sku: 'DAI-001',
      name: 'Olpers Milk 1L',
      categoryId: categories['Dairy'],
      brand: 'Engro',
      costPrice: 90,
      sellingPrice: 105,
      mrp: 110,
      reorderLevel: 60,
      status: ProductStatus.ACTIVE,
    },
    {
      sku: 'GRC-001',
      name: 'Surf Excel 1kg',
      categoryId: categories['Groceries'],
      brand: 'Unilever',
      costPrice: 220,
      sellingPrice: 260,
      mrp: 280,
      reorderLevel: 20,
      status: ProductStatus.ACTIVE,
    },
  ]
  const products: Record<string, string> = {}
  for (const p of productData) {
    const existing = await prisma.product.findFirst({
      where: { organizationId: orgId, sku: p.sku },
    })
    const prod =
      existing ??
      (await prisma.product.create({
        data: {
          organizationId: orgId,
          ...p,
          costPrice: p.costPrice,
          sellingPrice: p.sellingPrice,
          mrp: p.mrp,
          lastModifiedBy: adminId,
        },
      }))
    products[p.sku] = prod.id
  }

  // ── Seed inventory stock ──────────────────────────────────────────────────────
  for (const sku of Object.keys(products)) {
    for (const whCode of Object.keys(warehouses)) {
      const qty = Math.floor(Math.random() * 200) + 20
      const existing = await prisma.inventoryStock.findFirst({
        where: { productId: products[sku], warehouseId: warehouses[whCode] },
      })
      if (!existing) {
        await prisma.inventoryStock.create({
          data: {
            organizationId: orgId,
            productId: products[sku],
            warehouseId: warehouses[whCode],
            quantity: qty,
            lastModifiedBy: adminId,
          },
        })
        await prisma.inventoryTransaction.create({
          data: {
            organizationId: orgId,
            productId: products[sku],
            toWarehouseId: warehouses[whCode],
            type: InventoryTxType.PURCHASE,
            quantity: qty,
            reason: 'Initial stock',
            referenceType: 'MANUAL',
            performedBy: adminId,
          },
        })
      }
    }
  }

  // ── Distributors ──────────────────────────────────────────────────────────────
  const distData = [
    {
      code: 'DST-0001',
      companyName: 'Alpha Trading Co',
      contactName: 'Rashid Ali',
      email: 'rashid@alphatrading.pk',
      phone: '+92-300-1234567',
      city: 'Karachi',
      status: DistributorStatus.ACTIVE,
      tier: DistributorTier.GOLD,
      creditLimit: 500000,
      currentBalance: 125000,
    },
    {
      code: 'DST-0002',
      companyName: 'Beta Distributors',
      contactName: 'Ayesha Khan',
      email: 'ayesha@betadist.pk',
      phone: '+92-321-9876543',
      city: 'Lahore',
      status: DistributorStatus.ACTIVE,
      tier: DistributorTier.SILVER,
      creditLimit: 300000,
      currentBalance: 75000,
    },
    {
      code: 'DST-0003',
      companyName: 'Gamma Wholesale',
      contactName: 'Tariq Hussain',
      email: 'tariq@gammawhole.pk',
      phone: '+92-333-5551234',
      city: 'Islamabad',
      status: DistributorStatus.ACTIVE,
      tier: DistributorTier.BRONZE,
      creditLimit: 150000,
      currentBalance: 30000,
    },
    {
      code: 'DST-0004',
      companyName: 'Delta Supply Chain',
      contactName: 'Faisal Malik',
      email: 'faisal@deltasupply.pk',
      phone: '+92-312-4445678',
      city: 'Faisalabad',
      status: DistributorStatus.INACTIVE,
      tier: DistributorTier.BRONZE,
      creditLimit: 100000,
      currentBalance: 0,
    },
  ]
  const distributors: Record<string, string> = {}
  for (const d of distData) {
    const existing = await prisma.distributor.findFirst({
      where: { organizationId: orgId, code: d.code },
    })
    const dist =
      existing ??
      (await prisma.distributor.create({
        data: {
          organizationId: orgId,
          ...d,
          country: 'PK',
          paymentTerms: 30,
          rating: 4.2,
          lastModifiedBy: adminId,
        },
      }))
    distributors[d.code] = dist.id
  }

  // ── Clients ───────────────────────────────────────────────────────────────────
  const clientData = [
    {
      code: 'CLT-0001',
      companyName: 'SuperMart Karachi',
      contactName: 'Kamran Baig',
      email: 'kamran@supermart.pk',
      phone: '+92-300-1112222',
      city: 'Karachi',
      distributorId: distributors['DST-0001'],
      status: ClientStatus.ACTIVE,
      businessType: BusinessType.RETAIL,
      businessSize: BusinessSize.MEDIUM,
    },
    {
      code: 'CLT-0002',
      companyName: 'Metro Cash & Carry',
      contactName: 'Sana Rauf',
      email: 'sana@metro.pk',
      phone: '+92-321-3334444',
      city: 'Lahore',
      distributorId: distributors['DST-0002'],
      status: ClientStatus.ACTIVE,
      businessType: BusinessType.WHOLESALE,
      businessSize: BusinessSize.LARGE,
    },
    {
      code: 'CLT-0003',
      companyName: 'Quick Shop Isb',
      contactName: 'Ali Hassan',
      email: 'ali@quickshop.pk',
      phone: '+92-333-5556666',
      city: 'Islamabad',
      distributorId: distributors['DST-0003'],
      status: ClientStatus.ACTIVE,
      businessType: BusinessType.RETAIL,
      businessSize: BusinessSize.SMALL,
    },
    {
      code: 'CLT-0004',
      companyName: 'Al-Fatah Stores',
      contactName: 'Zara Qureshi',
      email: 'zara@alfatah.pk',
      phone: '+92-312-7778888',
      city: 'Karachi',
      distributorId: distributors['DST-0001'],
      status: ClientStatus.ACTIVE,
      businessType: BusinessType.RETAIL,
      businessSize: BusinessSize.LARGE,
    },
    {
      code: 'CLT-0005',
      companyName: 'City Wholesale Hub',
      contactName: 'Omar Farooq',
      email: 'omar@citywholesale.pk',
      phone: '+92-333-9990000',
      city: 'Lahore',
      distributorId: distributors['DST-0002'],
      status: ClientStatus.INACTIVE,
      businessType: BusinessType.WHOLESALE,
      businessSize: BusinessSize.MEDIUM,
    },
    {
      code: 'CLT-0006',
      companyName: 'Green Valley Foods',
      contactName: 'Nadia Ahmed',
      email: 'nadia@greenvalley.pk',
      phone: '+92-300-1234321',
      city: 'Faisalabad',
      distributorId: distributors['DST-0004'],
      status: ClientStatus.PROSPECT,
      businessType: BusinessType.RETAIL,
      businessSize: BusinessSize.SMALL,
    },
  ]
  for (const c of clientData) {
    const existing = await prisma.client.findFirst({
      where: { organizationId: orgId, code: c.code },
    })
    if (!existing) {
      await prisma.client.create({
        data: {
          organizationId: orgId,
          ...c,
          country: 'PK',
          paymentTerms: 30,
          assignedRepId: repId,
          creditLimit: 100000,
          lastModifiedBy: adminId,
        },
      })
    }
  }

  console.log(
    `   └─ ${warehouseData.length} warehouses, ${catData.length} categories, ${productData.length} products, ${distData.length} distributors, ${clientData.length} clients`
  )
}

// ── Phase 3 seeder ─────────────────────────────────────────────────────────────

async function seedPhase3(orgId: string, adminId: string, roles: Record<string, string>) {
  const reps = await prisma.user.findMany({
    where: { organizationId: orgId, roleId: roles['Sales Rep'], deletedAt: null },
    select: { id: true },
  })
  const managers = await prisma.user.findMany({
    where: { organizationId: orgId, roleId: roles['Manager'], deletedAt: null },
    select: { id: true },
  })
  const repIds = reps.map((r) => r.id)
  const managerId = managers[0]?.id ?? adminId

  const clients = await prisma.client.findMany({
    where: { organizationId: orgId, deletedAt: null },
    select: { id: true },
  })
  const products = await prisma.product.findMany({
    where: { organizationId: orgId, deletedAt: null },
    select: { id: true, sellingPrice: true, taxRate: true },
  })

  if (!clients.length || !products.length || !repIds.length) return

  // ── Default Invoice Template ────────────────────────────────────────────────
  const existingTemplate = await prisma.invoiceTemplate.findFirst({
    where: { organizationId: orgId, isDefault: true, deletedAt: null },
  })
  const template =
    existingTemplate ??
    (await prisma.invoiceTemplate.create({
      data: {
        organizationId: orgId,
        name: 'Standard Template',
        isDefault: true,
        taxLabel: 'GST',
        invoiceNumberPrefix: 'INV',
        invoiceNumberPadding: 4,
        invoiceNumberIncludeYear: true,
        bankDetailsEnabled: false,
        lastModifiedBy: adminId,
      },
    }))

  // ── Sales Targets ───────────────────────────────────────────────────────────
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)

  const existingTarget = await prisma.salesTarget.findFirst({
    where: { organizationId: orgId, name: 'Monthly Revenue Target', deletedAt: null },
  })
  if (!existingTarget) {
    await prisma.salesTarget.create({
      data: {
        organizationId: orgId,
        name: 'Monthly Revenue Target',
        scope: TargetScope.ORGANIZATION,
        type: TargetType.REVENUE,
        period: TargetPeriod.MONTHLY,
        targetValue: 500000,
        achievedValue: 0,
        periodStart: monthStart,
        periodEnd: monthEnd,
        lastModifiedBy: adminId,
      },
    })
    for (const repId of repIds) {
      await prisma.salesTarget.create({
        data: {
          organizationId: orgId,
          name: 'Monthly Sales Target',
          scope: TargetScope.USER,
          type: TargetType.REVENUE,
          period: TargetPeriod.MONTHLY,
          userId: repId,
          targetValue: 200000,
          achievedValue: 0,
          periodStart: monthStart,
          periodEnd: monthEnd,
          lastModifiedBy: adminId,
        },
      })
    }
  }

  // ── 90 Days of Historical DSR + Invoice + Payment Data ──────────────────────
  const DAYS = 90
  let invoiceSeq = 1

  for (let d = DAYS; d >= 1; d--) {
    const reportDate = new Date(Date.now() - d * 24 * 60 * 60 * 1000)
    reportDate.setHours(10, 0, 0, 0)

    // Each rep submits 1–2 DSRs per weekday
    const dayOfWeek = reportDate.getDay()
    if (dayOfWeek === 0 || dayOfWeek === 6) continue // skip weekends

    for (const repId of repIds) {
      // 70% chance of a DSR on any given day
      if (Math.random() > 0.7) continue

      const clientId = clients[Math.floor(Math.random() * clients.length)].id
      const visitTypes = Object.values(VisitType)
      const visitType = visitTypes[Math.floor(Math.random() * visitTypes.length)]

      // 2–4 line items per DSR
      const lineItemCount = Math.floor(Math.random() * 3) + 2
      const selectedProducts = [...products].sort(() => Math.random() - 0.5).slice(0, lineItemCount)

      let subtotal = 0
      let taxTotal = 0
      const lineItemsData = selectedProducts.map((p) => {
        const qty = Math.floor(Math.random() * 10) + 1
        const unitPrice = Number(p.sellingPrice)
        const taxRate = Number(p.taxRate)
        const lineBase = qty * unitPrice
        const taxAmt = Math.round(((lineBase * taxRate) / 100) * 100) / 100
        const lineTotal = lineBase + taxAmt
        subtotal += lineBase
        taxTotal += taxAmt
        return { productId: p.id, qty, unitPrice, taxRate, taxAmt, lineTotal }
      })
      const grandTotal = subtotal + taxTotal

      // Check if already seeded for this rep+date
      const existing = await prisma.dSREntry.findFirst({
        where: {
          organizationId: orgId,
          submittedById: repId,
          reportDate,
          deletedAt: null,
        },
      })
      if (existing) continue

      // All historical DSRs are APPROVED
      const dsr = await prisma.dSREntry.create({
        data: {
          organizationId: orgId,
          submittedById: repId,
          clientId,
          reportDate,
          visitType,
          visitNotes: 'Routine visit, discussed product availability.',
          outcome: 'Order placed',
          satisfaction: Math.floor(Math.random() * 2) + 4, // 4 or 5 stars
          status: DSRStatus.APPROVED,
          subtotal,
          taxTotal,
          discountTotal: 0,
          grandTotal,
          approvedById: managerId,
          approvedAt: new Date(reportDate.getTime() + 3 * 60 * 60 * 1000),
          lastModifiedBy: adminId,
          lineItems: {
            create: lineItemsData.map((li) => ({
              productId: li.productId,
              quantity: li.qty,
              unitPrice: li.unitPrice,
              taxRate: li.taxRate,
              taxAmount: li.taxAmt,
              lineTotal: li.lineTotal,
            })),
          },
        },
      })

      // Create approved invoice for each DSR (60% chance)
      if (Math.random() > 0.4) {
        const year = reportDate.getFullYear()
        const invNumber = `INV-${year}-${String(invoiceSeq).padStart(4, '0')}`
        invoiceSeq++

        const daysUntilDue = 30
        const dueDate = new Date(reportDate.getTime() + daysUntilDue * 24 * 60 * 60 * 1000)
        const isPaid = Math.random() > 0.3

        const invoice = await prisma.invoice.create({
          data: {
            organizationId: orgId,
            invoiceNumber: invNumber,
            clientId,
            templateId: template.id,
            dsrEntryId: dsr.id,
            status: isPaid
              ? InvoiceStatus.PAID
              : dueDate < now
                ? InvoiceStatus.OVERDUE
                : InvoiceStatus.ISSUED,
            issueDate: reportDate,
            dueDate,
            subtotal,
            taxTotal,
            discountTotal: 0,
            shippingAmount: 0,
            grandTotal,
            paidAmount: isPaid ? grandTotal : 0,
            createdById: adminId,
            lastModifiedBy: adminId,
            lineItems: {
              create: lineItemsData.map((li, idx) => ({
                productId: li.productId,
                description: 'Product sale',
                quantity: li.qty,
                unitPrice: li.unitPrice,
                taxRate: li.taxRate,
                taxAmount: li.taxAmt,
                lineTotal: li.lineTotal,
                sortOrder: idx,
              })),
            },
          },
        })

        // Record payment for paid invoices
        if (isPaid) {
          const paymentDate = new Date(
            reportDate.getTime() + Math.floor(Math.random() * 20 + 1) * 24 * 60 * 60 * 1000
          )
          await prisma.payment.create({
            data: {
              organizationId: orgId,
              invoiceId: invoice.id,
              amount: grandTotal,
              paymentDate,
              method: PaymentMethod.BANK,
              notes: 'Historical payment',
              recordedById: adminId,
              lastModifiedBy: adminId,
            },
          })
        }

        // Link DSR to invoice
        await prisma.dSREntry.update({
          where: { id: dsr.id },
          data: { invoiceId: invoice.id },
        })
      }
    }
  }

  // ── Performance Snapshots (last 30 days) ────────────────────────────────────
  for (let d = 30; d >= 1; d--) {
    const snapshotDate = new Date(Date.now() - d * 24 * 60 * 60 * 1000)
    snapshotDate.setHours(0, 0, 0, 0)

    for (const repId of repIds) {
      const existing = await prisma.performanceSnapshot.findFirst({
        where: { organizationId: orgId, userId: repId, snapshotDate },
      })
      if (existing) continue

      const dayDSRs = await prisma.dSREntry.findMany({
        where: {
          organizationId: orgId,
          submittedById: repId,
          reportDate: { gte: snapshotDate, lt: new Date(snapshotDate.getTime() + 86400000) },
          deletedAt: null,
        },
        include: { lineItems: true },
      })

      const approvedCount = dayDSRs.filter((d) => d.status === DSRStatus.APPROVED).length
      const revenue = dayDSRs
        .filter((d) => d.status === DSRStatus.APPROVED)
        .reduce((sum, d) => sum + Number(d.grandTotal), 0)

      await prisma.performanceSnapshot.create({
        data: {
          organizationId: orgId,
          userId: repId,
          snapshotDate,
          dsrCount: dayDSRs.length,
          approvedDSRs: approvedCount,
          rejectedDSRs: 0,
          totalRevenue: revenue,
          totalInvoiced: revenue,
          totalCollected: revenue * 0.7,
          visitCount: dayDSRs.length,
        },
      })
    }
  }

  // Update client balances based on invoices
  const clientsWithInvoices = await prisma.client.findMany({
    where: { organizationId: orgId, deletedAt: null },
    include: {
      invoices: {
        where: {
          deletedAt: null,
          status: {
            in: [InvoiceStatus.ISSUED, InvoiceStatus.OVERDUE, InvoiceStatus.PARTIALLY_PAID],
          },
        },
        select: { grandTotal: true, paidAmount: true },
      },
    },
  })
  for (const client of clientsWithInvoices) {
    const outstanding = client.invoices.reduce(
      (sum, inv) => sum + (Number(inv.grandTotal) - Number(inv.paidAmount)),
      0
    )
    const totalOrders = await prisma.invoice.count({
      where: { organizationId: orgId, clientId: client.id, deletedAt: null },
    })
    const allInvoices = await prisma.invoice.findMany({
      where: { organizationId: orgId, clientId: client.id, deletedAt: null },
      select: { grandTotal: true, issueDate: true },
      orderBy: { issueDate: 'asc' },
    })
    const ltv = allInvoices.reduce((sum, i) => sum + Number(i.grandTotal), 0)
    const aov = totalOrders > 0 ? ltv / totalOrders : 0
    await prisma.client.update({
      where: { id: client.id },
      data: {
        currentBalance: outstanding,
        totalOrders,
        totalLifetimeValue: ltv,
        averageOrderValue: aov,
        firstOrderDate: allInvoices[0]?.issueDate,
        lastOrderDate: allInvoices[allInvoices.length - 1]?.issueDate,
      },
    })
  }

  // Update target achieved values
  const salesTargets = await prisma.salesTarget.findMany({
    where: { organizationId: orgId, deletedAt: null, type: TargetType.REVENUE },
  })
  for (const target of salesTargets) {
    const invoiceSum = await prisma.invoice.aggregate({
      where: {
        organizationId: orgId,
        ...(target.userId ? { createdById: target.userId } : {}),
        issueDate: { gte: target.periodStart, lte: target.periodEnd },
        status: { in: [InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.PAID] },
        deletedAt: null,
      },
      _sum: { grandTotal: true },
    })
    await prisma.salesTarget.update({
      where: { id: target.id },
      data: { achievedValue: invoiceSum._sum.grandTotal ?? 0 },
    })
  }

  console.log(`   └─ 90 days DSRs, invoices, payments, snapshots, targets seeded`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
