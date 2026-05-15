import { NextRequest, NextResponse } from 'next/server'
import { requireTenantAuth } from '@/lib/auth/require-tenant-auth'
import { getUploadUrl } from '@/lib/r2'
import { nanoid } from 'nanoid'

export async function POST(req: NextRequest) {
  // H-4: requireTenantAuth includes per-user rate limiting via checkApiRateLimit
  const auth = await requireTenantAuth()
  if (!auth.ok) return auth.response
  const { organizationId } = auth.session

  try {
    const { filename, contentType, sizeBytes } = await req.json()
    if (!filename || !contentType) {
      return NextResponse.json({ error: 'filename and contentType required' }, { status: 400 })
    }
    if (!contentType.startsWith('image/')) {
      return NextResponse.json({ error: 'Only images allowed' }, { status: 400 })
    }
    if (sizeBytes && sizeBytes > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Image must be under 5MB' }, { status: 400 })
    }

    const ext = filename.split('.').pop() ?? 'jpg'
    const key = `products/${organizationId}/${nanoid()}.${ext}`

    const { uploadUrl, publicUrl } = await getUploadUrl({
      key,
      contentType,
      category: 'attachments',
    })
    return NextResponse.json({ uploadUrl, publicUrl, key })
  } catch (err) {
    console.error('[products/upload-url]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
