import { NextResponse } from 'next/server'
import { z } from 'zod'
import { nanoid } from 'nanoid'
import { requireTenantAuth } from '@/lib/auth/require-tenant-auth'
import { getUploadUrl, isAllowedImageType, MAX_FILE_SIZE_BYTES } from '@/lib/r2'
import type { UploadCategory } from '@/lib/r2'

const uploadSchema = z.object({
  fileName: z.string().min(1).max(200),
  contentType: z.string().min(1),
  fileSize: z.number().positive(),
  category: z.enum(['logos', 'avatars', 'branding', 'attachments']),
})

export async function POST(req: Request) {
  const auth = await requireTenantAuth()
  if (!auth.ok) return auth.response
  const { organizationId, userId } = auth.session

  try {
    const body = await req.json()
    const data = uploadSchema.parse(body)

    if (!isAllowedImageType(data.contentType)) {
      return NextResponse.json(
        { error: 'Unsupported file type. Allowed: JPEG, PNG, WebP, GIF, SVG.' },
        { status: 400 }
      )
    }

    if (data.fileSize > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: 'File too large. Maximum 5 MB.' }, { status: 400 })
    }

    const ext = data.fileName.split('.').pop() ?? 'jpg'
    const key = `${organizationId}/${userId}/${nanoid(16)}.${ext}`

    const { uploadUrl, publicUrl } = await getUploadUrl({
      key,
      contentType: data.contentType,
      category: data.category as UploadCategory,
    })

    return NextResponse.json({ success: true, data: { uploadUrl, publicUrl, key } })
  } catch (err) {
    if (err instanceof z.ZodError)
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 })
    console.error('[upload]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
