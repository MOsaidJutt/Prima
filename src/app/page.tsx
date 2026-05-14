import { redirect } from 'next/navigation'

// M-8: Redirect root to /login until the marketing landing page is built (Phase 7)
export default function RootPage() {
  redirect('/login')
}
