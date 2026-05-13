import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import type { AppSession, SuperAdminSession, TenantSession } from '@/types'

const SECRET = new TextEncoder().encode(
  process.env.BETTER_AUTH_SECRET ?? 'fallback-secret-change-in-production'
)

const SUPER_ADMIN_COOKIE = 'prima_sa_session'
const TENANT_COOKIE = 'prima_session'
const SESSION_DURATION = 60 * 60 * 24 // 24 hours

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

export function setSessionCookie(type: 'super_admin' | 'tenant', token: string) {
  const name = type === 'super_admin' ? SUPER_ADMIN_COOKIE : TENANT_COOKIE
  return {
    name,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: SESSION_DURATION,
    path: '/',
  }
}

export function clearSessionCookie(type: 'super_admin' | 'tenant') {
  const name = type === 'super_admin' ? SUPER_ADMIN_COOKIE : TENANT_COOKIE
  return { name, value: '', maxAge: 0, path: '/' }
}
