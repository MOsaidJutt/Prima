'use client'

import { useEffect } from 'react'

interface GlobalErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

// Catches crashes in the root layout (e.g. theme provider, font loader).
// Must include its own <html><body> because the normal layout is unavailable.

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    // Forward to Sentry when integrated (Phase 7)
    console.error('[global-error-boundary]', error)
  }, [error])

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#F8FAFC' }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            gap: '1rem',
            textAlign: 'center',
            padding: '2rem',
          }}
        >
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#0F172A' }}>
            Something went wrong
          </h2>
          <p style={{ color: '#64748B', maxWidth: '24rem', fontSize: '0.875rem' }}>
            An unexpected error occurred. Please refresh the page.
          </p>
          {error.digest && (
            <p style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#94A3B8' }}>
              Error ID: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.375rem',
              border: '1px solid #E2E8F0',
              background: '#fff',
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
