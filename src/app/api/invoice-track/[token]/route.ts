import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkApiRateLimit } from '@/lib/rate-limit'

// 1x1 transparent GIF
const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  // Rate-limit by IP to prevent DB write abuse from bots
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'anonymous'
  const limited = await checkApiRateLimit(ip)
  if (limited) {
    return new NextResponse(PIXEL, {
      status: 200,
      headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store' },
    })
  }

  const { token } = await params
  if (token) {
    prisma.invoice
      .updateMany({
        where: { trackingToken: token, openedAt: null },
        data: { openedAt: new Date() },
      })
      .catch(() => {})
  }
  return new NextResponse(PIXEL, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  })
}
