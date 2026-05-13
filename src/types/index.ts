import type { SuperAdmin, Organization } from '@prisma/client'

export type SuperAdminSession = {
  type: 'super_admin'
  superAdmin: Pick<SuperAdmin, 'id' | 'email' | 'name' | 'role' | 'permissions'>
  sessionToken: string
}

export type TenantSession = {
  type: 'tenant'
  userId: string
  organizationId: string
  organization: Pick<Organization, 'id' | 'slug' | 'name' | 'status' | 'plan'>
  sessionToken: string
}

export type AppSession = SuperAdminSession | TenantSession

export type ApiResponse<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string }

export type PaginatedResponse<T> = {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}
