'use client'

import { Suspense, useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import posthog from 'posthog-js'

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://app.posthog.com'

let initialized = false

function ensureInit() {
  if (initialized || !KEY) return
  posthog.init(KEY, {
    api_host: HOST,
    // App Router pageviews are captured manually below (route changes don't
    // trigger a full page load), so disable PostHog's own history listener.
    capture_pageview: false,
    capture_pageleave: true,
    person_profiles: 'identified_only',
  })
  initialized = true
}

/** No-op when NEXT_PUBLIC_POSTHOG_KEY is unset — safe to mount unconditionally. */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  ensureInit()
  return (
    <>
      {children}
      {KEY && (
        // useSearchParams() requires a Suspense boundary to keep pages
        // statically prerenderable (Next.js 16 hard-errors otherwise).
        <Suspense fallback={null}>
          <PostHogPageview />
        </Suspense>
      )}
    </>
  )
}

function PostHogPageview() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (!pathname) return
    const query = searchParams.toString()
    posthog.capture('$pageview', { $current_url: query ? `${pathname}?${query}` : pathname })
  }, [pathname, searchParams])

  return null
}
