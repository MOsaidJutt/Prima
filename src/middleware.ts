import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyToken } from '@/lib/auth/session'
import type { SuperAdminSession, TenantSession } from '@/types'

const SUPER_ADMIN_COOKIE = 'prima_sa_session'
const TENANT_COOKIE = 'prima_session'

export async function middleware(request: NextRequest) {
  const { pathname, hostname } = request.nextUrl

  // ── Subdomain detection ────────────────────────────────────────────────────
  // Maps {slug}.localhost:3000  →  attaches X-Org-Slug header
  const host = request.headers.get('host') ?? hostname
  const parts = host.split('.')
  // In dev: slug.localhost — in prod: slug.prima.app
  const isSubdomain = parts.length >= 2 && parts[0] !== 'www' && parts[0] !== 'localhost'
  const orgSlug = isSubdomain ? parts[0] : null

  const response = NextResponse.next()
  if (orgSlug) {
    response.headers.set('x-org-slug', orgSlug)
  }

  // ── Super Admin routes ─────────────────────────────────────────────────────
  if (pathname.startsWith('/super-admin') && !pathname.startsWith('/super-admin/login')) {
    const token = request.cookies.get(SUPER_ADMIN_COOKIE)?.value
    if (!token) {
      return NextResponse.redirect(new URL('/super-admin/login', request.url))
    }
    const session = await verifyToken<SuperAdminSession>(token)
    if (!session) {
      return NextResponse.redirect(new URL('/super-admin/login', request.url))
    }
  }

  // ── Tenant protected routes ────────────────────────────────────────────────
  const tenantProtected = ['/admin', '/manager', '/dashboard', '/onboarding']
  const isTenantRoute = tenantProtected.some((p) => pathname.startsWith(p))

  if (isTenantRoute) {
    const token = request.cookies.get(TENANT_COOKIE)?.value
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    const session = await verifyToken<TenantSession>(token)
    if (!session) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    response.headers.set('x-org-id', session.organizationId)
    response.headers.set('x-user-id', session.userId)
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public|api/auth).*)'],
}
