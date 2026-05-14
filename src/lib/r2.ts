import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// Cloudflare R2 is S3-compatible. Endpoint format:
// https://<account-id>.r2.cloudflarestorage.com

const R2_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID ?? ''
const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY_ID ?? ''
const R2_SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY ?? ''
const R2_BUCKET = process.env.R2_BUCKET_NAME ?? 'prima-uploads'
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL ?? ''

let _client: S3Client | null = null

function getClient(): S3Client {
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

// Allowed MIME types for uploads
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB

export type UploadCategory = 'logos' | 'avatars' | 'branding' | 'attachments'

// Generate a pre-signed URL for direct-to-R2 upload from the browser.
// The server signs the URL; the browser uploads directly, avoiding memory pressure.
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

  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 300 }) // 5 min
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

// Extract the R2 object key from a public URL (for deletion)
export function keyFromPublicUrl(url: string): string {
  return url.replace(`${R2_PUBLIC_URL}/`, '')
}
