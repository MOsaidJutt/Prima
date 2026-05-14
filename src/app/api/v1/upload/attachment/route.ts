import { NextRequest, NextResponse } from 'next/server'
import { getTenantSession } from '@/lib/auth/session'
import { getUploadUrl } from '@/lib/r2'
import { nanoid } from 'nanoid'

// H-2: strict allowlist — no HTML, JS, or executables can be uploaded.
// Covers PDFs, Office docs, images, and common archive formats.
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/csv',
  'application/zip',
])

const MAX_BYTES = 20 * 1024 * 1024 // 20 MB

export async function POST(req: NextRequest) {
  const session = await getTenantSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { filename, contentType, sizeBytes } = await req.json()

    if (!filename || !contentType) {
      return NextResponse.json({ error: 'filename and contentType required' }, { status: 400 })
    }

    // H-2: enforce allowlist — client-supplied contentType cannot be trusted for
    // setting the S3 ContentType header, as that's what browsers use when serving
    // the file. An HTML file uploaded with contentType 'text/html' becomes an XSS vector.
    if (!ALLOWED_MIME_TYPES.has(contentType)) {
      return NextResponse.json(
        { error: 'File type not allowed. Supported: PDF, images, Word, Excel, CSV, ZIP.' },
        { status: 400 }
      )
    }

    if (sizeBytes && sizeBytes > MAX_BYTES) {
      return NextResponse.json({ error: 'File too large (max 20MB)' }, { status: 400 })
    }

    const ext = filename.split('.').pop()?.toLowerCase() ?? 'bin'
    const key = `attachments/${session.organizationId}/${nanoid()}.${ext}`

    const { uploadUrl, publicUrl } = await getUploadUrl({
      key,
      contentType,
      category: 'attachments',
    })

    return NextResponse.json({ uploadUrl, publicUrl, key })
  } catch (err) {
    console.error('[upload/attachment]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
