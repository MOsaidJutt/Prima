import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// Cloudflare R2 is S3-compatible. Endpoint format:
// https://<account-id>.r2.cloudflarestorage.com

// Guard at module init — fail loudly in production if credentials are missing.
// In development the guard is skipped so the module can be imported without R2
// credentials (upload calls will fail at call time with a clear error).
if (process.env.NODE_ENV === 'production') {
  if (!process.env.CLOUDFLARE_ACCOUNT_ID) {
    throw new Error('CLOUDFLARE_ACCOUNT_ID environment variable is required in production')
  }
  if (!process.env.R2_ACCESS_KEY_ID) {
    throw new Error('R2_ACCESS_KEY_ID environment variable is required in production')
  }
  if (!process.env.R2_SECRET_ACCESS_KEY) {
    throw new Error('R2_SECRET_ACCESS_KEY environment variable is required in production')
  }
}

const R2_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID ?? ''
const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY_ID ?? ''
const R2_SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY ?? ''
const R2_BUCKET = process.env.R2_BUCKET_NAME ?? 'prima-uploads'
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL ?? ''

let _client: S3Client | null = null

function getClient(): S3Client {
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY || !R2_SECRET_KEY) {
    throw new Error(
      'R2 credentials are not configured. Set CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY.'
    )
  }
  if (!_client) {
    _client = new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY,
        secretAccessKey: R2_SECRET_KEY,
      },
    })
  }
  return _client
}

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB

export type UploadCategory = 'logos' | 'avatars' | 'branding' | 'attachments'

export async function getUploadUrl(opts: {
  key: string
  contentType: string
  category: UploadCategory
}): Promise<{ uploadUrl: string; publicUrl: string }> {
  const client = getClient()
  const objectKey = `${opts.category}/${opts.key}`

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: objectKey,
    ContentType: opts.contentType,
  })

  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 300 })
  const publicUrl = `${R2_PUBLIC_URL}/${objectKey}`

  return { uploadUrl, publicUrl }
}

export async function deleteObject(key: string): Promise<void> {
  const client = getClient()
  await client.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }))
}

export function isAllowedImageType(contentType: string): boolean {
  return ALLOWED_IMAGE_TYPES.includes(contentType)
}

export { MAX_FILE_SIZE_BYTES }

export function keyFromPublicUrl(url: string): string {
  return url.replace(`${R2_PUBLIC_URL}/`, '')
}
