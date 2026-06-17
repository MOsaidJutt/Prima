import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

// M-6: 'unsafe-eval' is required in development for Next.js HMR / React Fast Refresh.
// In production it is removed — no legitimate runtime code uses eval().
// 'unsafe-inline' for styles is unavoidable without a nonce pipeline (Phase 7).
const isDev = process.env.NODE_ENV !== 'production'

const scriptSrc = isDev
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
  : "script-src 'self' 'unsafe-inline'"

const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // geolocation allowed on DSR submission routes; camera/microphone remain off
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      scriptSrc,
      // C-4: cdnjs for Leaflet CSS; fonts.googleapis for app fonts
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com",
      "font-src 'self' https://fonts.gstatic.com",
      // C-4: cdnjs for Leaflet marker icons; R2 for org uploads; fonts.gstatic for app fonts
      `img-src 'self' data: blob: ${process.env.R2_PUBLIC_URL ?? 'https://*.r2.dev'} https://fonts.gstatic.com https://cdnjs.cloudflare.com`,
      // C-4: OpenStreetMap tiles for Leaflet map widget
      "connect-src 'self' https://*.tile.openstreetmap.org",
      "frame-ancestors 'none'",
    ].join('; '),
  },
]

const r2Host = process.env.R2_PUBLIC_URL ? new URL(process.env.R2_PUBLIC_URL).hostname : null

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  images: {
    // Org uploads (product images, logos) are served from Cloudflare R2
    remotePatterns: [
      { protocol: 'https' as const, hostname: r2Host ?? '*.r2.dev' },
      { protocol: 'https' as const, hostname: '*.r2.cloudflarestorage.com' },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
}

export default withNextIntl(nextConfig)
