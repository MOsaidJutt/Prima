'use client'

import { useState } from 'react'
import { Upload, X, FileText, ImageIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

// react-dropzone is not in package.json — we'll do a manual implementation
// without the external dep to avoid adding another package.

export type UploadedFile = {
  name: string
  fileUrl: string
  fileKey: string
  mimeType: string
  sizeBytes: number
}

interface FileUploaderProps {
  accept?: string // e.g. "image/*" or ".pdf,.doc"
  maxFiles?: number
  maxSizeMB?: number
  value?: UploadedFile[]
  onChange?: (files: UploadedFile[]) => void
  uploadEndpoint: string // API route that returns { uploadUrl, publicUrl, key }
  className?: string
  label?: string
}

export function FileUploader({
  accept,
  maxFiles = 5,
  maxSizeMB = 10,
  value = [],
  onChange,
  uploadEndpoint,
  className,
  label = 'Drag & drop files here or click to browse',
}: FileUploaderProps) {
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const maxBytes = maxSizeMB * 1024 * 1024

  async function uploadFile(file: File): Promise<UploadedFile | null> {
    try {
      // 1. Get presigned URL from our API
      const res = await fetch(uploadEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, contentType: file.type, sizeBytes: file.size }),
      })
      if (!res.ok) throw new Error('Failed to get upload URL')
      const { uploadUrl, publicUrl, key } = await res.json()

      // 2. PUT directly to R2
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      })
      if (!putRes.ok) throw new Error('Upload to storage failed')

      return {
        name: file.name,
        fileUrl: publicUrl,
        fileKey: key,
        mimeType: file.type,
        sizeBytes: file.size,
      }
    } catch (err) {
      toast.error(`Failed to upload ${file.name}`)
      return null
    }
  }

  async function handleFiles(files: FileList | File[]) {
    const arr = Array.from(files)
    if (value.length + arr.length > maxFiles) {
      toast.error(`Maximum ${maxFiles} files allowed`)
      return
    }
    const oversized = arr.filter((f) => f.size > maxBytes)
    if (oversized.length) {
      toast.error(`Files must be under ${maxSizeMB}MB`)
      return
    }

    setUploading(true)
    const results = await Promise.all(arr.map(uploadFile))
    const uploaded = results.filter(Boolean) as UploadedFile[]
    onChange?.([...value, ...uploaded])
    setUploading(false)
  }

  function removeFile(idx: number) {
    const next = value.filter((_, i) => i !== idx)
    onChange?.(next)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    handleFiles(e.dataTransfer.files)
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) handleFiles(e.target.files)
    e.target.value = '' // reset so same file can be re-selected
  }

  function isImage(mimeType: string) {
    return mimeType.startsWith('image/')
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        className={cn(
          'rounded-lg border-2 border-dashed p-6 text-center transition-colors',
          dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50',
          uploading && 'pointer-events-none opacity-60'
        )}
      >
        <Upload className="text-muted-foreground mx-auto mb-2 h-8 w-8" />
        <p className="text-muted-foreground text-sm">{label}</p>
        <p className="text-muted-foreground mt-1 text-xs">
          Max {maxFiles} files · {maxSizeMB}MB each
          {accept && ` · ${accept}`}
        </p>
        <label className="mt-3 inline-block cursor-pointer">
          <Button type="button" variant="outline" size="sm" asChild>
            <span>{uploading ? 'Uploading…' : 'Browse Files'}</span>
          </Button>
          <input
            type="file"
            className="sr-only"
            multiple={maxFiles > 1}
            accept={accept}
            onChange={handleInputChange}
            disabled={uploading || value.length >= maxFiles}
          />
        </label>
      </div>

      {/* File list */}
      {value.length > 0 && (
        <ul className="space-y-1">
          {value.map((file, idx) => (
            <li
              key={idx}
              className="bg-muted/40 flex items-center gap-2 rounded-md px-3 py-2 text-sm"
            >
              {isImage(file.mimeType) ? (
                <ImageIcon className="text-muted-foreground h-4 w-4 shrink-0" />
              ) : (
                <FileText className="text-muted-foreground h-4 w-4 shrink-0" />
              )}
              <a
                href={file.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-0 flex-1 truncate hover:underline"
              >
                {file.name}
              </a>
              <span className="text-muted-foreground shrink-0 text-xs">
                {(file.sizeBytes / 1024).toFixed(0)} KB
              </span>
              <button
                type="button"
                onClick={() => removeFile(idx)}
                className="text-muted-foreground hover:text-destructive ml-1 shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Image uploader (simplified for product images) ────────────────────────────

interface ImageUploaderProps {
  value?: string[]
  onChange?: (urls: string[]) => void
  uploadEndpoint: string
  maxImages?: number
  className?: string
}

export function ImageUploader({
  value = [],
  onChange,
  uploadEndpoint,
  maxImages = 5,
  className,
}: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false)

  async function handleFiles(files: FileList) {
    const arr = Array.from(files).filter((f) => f.type.startsWith('image/'))
    if (!arr.length) {
      toast.error('Please select image files only')
      return
    }
    if (value.length + arr.length > maxImages) {
      toast.error(`Maximum ${maxImages} images`)
      return
    }

    setUploading(true)
    const urls: string[] = []
    for (const file of arr) {
      try {
        const res = await fetch(uploadEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type,
            sizeBytes: file.size,
          }),
        })
        if (!res.ok) throw new Error('Failed to get upload URL')
        const { uploadUrl, publicUrl } = await res.json()
        await fetch(uploadUrl, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': file.type },
        })
        urls.push(publicUrl)
      } catch {
        toast.error(`Failed to upload ${file.name}`)
      }
    }
    onChange?.([...value, ...urls])
    setUploading(false)
  }

  function remove(idx: number) {
    onChange?.(value.filter((_, i) => i !== idx))
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex flex-wrap gap-2">
        {value.map((url, idx) => (
          <div key={idx} className="group relative h-20 w-20 overflow-hidden rounded-md border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => remove(idx)}
              className="absolute top-0.5 right-0.5 hidden rounded-full bg-black/60 p-0.5 group-hover:flex"
            >
              <X className="h-3 w-3 text-white" />
            </button>
          </div>
        ))}
        {value.length < maxImages && (
          <label className="hover:border-primary/50 flex h-20 w-20 cursor-pointer items-center justify-center rounded-md border-2 border-dashed">
            {uploading ? (
              <span className="text-muted-foreground text-xs">…</span>
            ) : (
              <Upload className="text-muted-foreground h-5 w-5" />
            )}
            <input
              type="file"
              className="sr-only"
              multiple
              accept="image/*"
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
              disabled={uploading}
            />
          </label>
        )}
      </div>
    </div>
  )
}
