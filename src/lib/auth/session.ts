import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import type { AppSession, SuperAdminSession, TenantSession } from '@/types'

if (!process.env.BETTER_AUTH_SECRET) {
  throw new Error(
    'BETTER_AUTH_SECRET environment variable is required. ' +
      'Set it to a random 32+ character string in your .env.local file.'
  )
}

const SECRET = new TextEncoder().encode(process.env.BETTER_AUTH_SECRET)

const SUPER_ADMIN_COOKIE = 'prima_sa_session'
const TENANT_COOKIE = 'prima_session'

const SESSION_HOURS = 24
const SESSION_DURATION = SESSION_HOURS * 3600

export async function createSuperAdminToken(payload: SuperAdminSession): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION}s`)
    .sign(SECRET)
}

export async function createTenantToken(payload: TenantSession): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION}s`)
    .sign(SECRET)
}

export async function verifyToken<T>(token: string): Promise<T | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET)
    return payload as T
  } catch {
    return null
  }
}

export async function getSuperAdminSession(): Promise<SuperAdminSession | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SUPER_ADMIN_COOKIE)?.value
  if (!token) return null
  return verifyToken<SuperAdminSession>(token)
}

export async function getTenantSession(): Promise<TenantSession | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(TENANT_COOKIE)?.value
  if (!token) return null
  return verifyToken<TenantSession>(token)
}

export async function getSession(): Promise<AppSession | null> {
  return (await getSuperAdminSession()) ?? (await getTenantSession())
}

const COOKIE_BASE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
}

export function setSessionCookie(type: 'super_admin' | 'tenant', token: string) {
  const name = type === 'super_admin' ? SUPER_ADMIN_COOKIE : TENANT_COOKIE
  return { name, value: token, ...COOKIE_BASE_OPTIONS, maxAge: SESSION_DURATION }
}

export function clearSessionCookie(type: 'super_admin' | 'tenant') {
  const name = type === 'super_admin' ? SUPER_ADMIN_COOKIE : TENANT_COOKIE
  return { name, value: '', ...COOKIE_BASE_OPTIONS, maxAge: 0 }
}
