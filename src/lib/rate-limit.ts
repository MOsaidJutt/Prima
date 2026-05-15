import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

// ── Rate limiter instances ────────────────────────────────────────────────────
// Created lazily so the module can be imported in environments where Upstash
// env vars are not set (e.g. CI unit tests) without throwing at import time.
// The rate-limit check functions guard against missing env vars explicitly.

let _loginLimiter: Ratelimit | null = null
let _passwordResetLimiter: Ratelimit | null = null
let _apiLimiter: Ratelimit | null = null

function isUpstashConfigured(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
}

function getLoginLimiter(): Ratelimit {
  if (!_loginLimiter) {
    _loginLimiter = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(10, '1 m'), // 10 requests per minute per IP
      prefix: 'prima:rl:login',
    })
  }
  return _loginLimiter
}

// H-3: per-user general API rate limit — 120 requests per minute.
// Applied in requireTenantAuth so it covers both Phase 1 and Phase 2 routes.
function getApiLimiter(): Ratelimit {
  if (!_apiLimiter) {
    _apiLimiter = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(120, '1 m'),
      prefix: 'prima:rl:api',
    })
  }
  return _apiLimiter
}

function getPasswordResetLimiter(): Ratelimit {
  if (!_passwordResetLimiter) {
    _passwordResetLimiter = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(5, '1 m'), // 5 requests per minute per IP
      prefix: 'prima:rl:password-reset',
    })
  }
  return _passwordResetLimiter
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getIP(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'anonymous'
  )
}

// Returns a 429 NextResponse if rate limited; null if the request may proceed.
// If Upstash is not configured (e.g. local dev without Redis), rate limiting
// is skipped with a warning rather than blocking all requests.

// IP-based overload: used by server actions that don't have a Request object.
export async function checkLoginRateLimitByIP(ip: string): Promise<{ error: string } | null> {
  if (!isUpstashConfigured()) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[rate-limit] UPSTASH not set — login rate limiting disabled in production')
    }
    return null
  }
  const { success } = await getLoginLimiter().limit(ip)
  if (!success) return { error: 'Too many login attempts. Please wait a minute and try again.' }
  return null
}

export async function checkLoginRateLimit(req: Request): Promise<NextResponse | null> {
  if (!isUpstashConfigured()) {
    if (process.env.NODE_ENV === 'production') {
      console.error(
        '[rate-limit] UPSTASH_REDIS_REST_URL/TOKEN not set — login rate limiting disabled in production'
      )
    }
    return null
  }
  const ip = getIP(req)
  const { success, limit, remaining, reset } = await getLoginLimiter().limit(ip)
  if (!success) {
    return NextResponse.json(
      { error: 'Too many login attempts. Please wait a minute and try again.' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': String(limit),
          'X-RateLimit-Remaining': String(remaining),
          'X-RateLimit-Reset': String(reset),
          'Retry-After': '60',
        },
      }
    )
  }
  return null
}

export async function checkApiRateLimit(userId: string): Promise<NextResponse | null> {
  if (!isUpstashConfigured()) return null
  const { success } = await getApiLimiter().limit(userId)
  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests. Please slow down.' },
      { status: 429, headers: { 'Retry-After': '60' } }
    )
  }
  return null
}

export async function checkPasswordResetRateLimit(req: Request): Promise<NextResponse | null> {
  if (!isUpstashConfigured()) {
    if (process.env.NODE_ENV === 'production') {
      console.error(
        '[rate-limit] UPSTASH_REDIS_REST_URL/TOKEN not set — password-reset rate limiting disabled in production'
      )
    }
    return null
  }
  const ip = getIP(req)
  const { success, limit, remaining, reset } = await getPasswordResetLimiter().limit(ip)
  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a minute before trying again.' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': String(limit),
          'X-RateLimit-Remaining': String(remaining),
          'X-RateLimit-Reset': String(reset),
          'Retry-After': '60',
        },
      }
    )
  }
  return null
}
