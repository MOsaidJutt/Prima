import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { JOBS, isJobName } from '@/lib/jobs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// Serverless hosts cap execution time (60s on Vercel Hobby/Pro by default).
// Long jobs are the reason docs/DEPLOYMENT.md recommends moving to the
// persistent worker process once tenant count grows.
export const maxDuration = 60

function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  // timingSafeEqual throws on length mismatch, so compare lengths first —
  // length is not secret, the value is.
  return a.length === b.length && timingSafeEqual(a, b)
}

/**
 * Reads the caller's cron secret from either the `Authorization: Bearer <secret>`
 * header (what Vercel Cron sends) or `x-cron-secret` (simpler to set in
 * external schedulers such as cron-job.org).
 */
function extractSecret(req: NextRequest): string | null {
  const auth = req.headers.get('authorization')
  if (auth?.startsWith('Bearer ')) return auth.slice(7)
  return req.headers.get('x-cron-secret')
}

async function handle(req: NextRequest, params: Promise<{ job: string }>) {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    console.error('[cron] CRON_SECRET is not set — refusing to run jobs')
    return NextResponse.json({ error: 'Cron is not configured' }, { status: 503 })
  }

  const provided = extractSecret(req)
  if (!provided || !secretMatches(provided, expected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { job } = await params
  if (!isJobName(job)) {
    return NextResponse.json({ error: `Unknown job "${job}"` }, { status: 404 })
  }

  const startedAt = Date.now()
  try {
    await JOBS[job].run()
    const durationMs = Date.now() - startedAt
    console.log(`[cron] ${job} completed in ${durationMs}ms`)
    return NextResponse.json({ job, status: 'ok', durationMs })
  } catch (err) {
    const durationMs = Date.now() - startedAt
    console.error(`[cron] ${job} failed after ${durationMs}ms:`, err)
    return NextResponse.json({ job, status: 'error', durationMs }, { status: 500 })
  }
}

// GET is what most external schedulers send by default; POST is accepted so the
// same endpoint works with schedulers configured to POST.
export async function GET(req: NextRequest, { params }: { params: Promise<{ job: string }> }) {
  return handle(req, params)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ job: string }> }) {
  return handle(req, params)
}
