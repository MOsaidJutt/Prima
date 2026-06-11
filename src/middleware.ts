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

  // Forward the pathname as a request header so server layouts can read it via
  // headers() — used by Phase 6 subscription enforcement (e.g. redirecting
  // CANCELLED orgs to /admin/billing).
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', pathname)

  const response = NextResponse.next({ request: { headers: requestHeaders } })
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
  // /invite and /reset-password are public (token-gated) — not in this list
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
