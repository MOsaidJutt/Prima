import { Ban } from 'lucide-react'

/**
 * Shown in place of page content for non-admin roles (manager, sales rep)
 * when the org's subscription is CANCELLED. Those roles have no billing
 * access, so unlike /admin (which redirects to /admin/billing) we just
 * block the workspace and point them at their administrator.
 */
export function CancelledAccountNotice() {
  return (
    <div className="flex h-[60vh] flex-col items-center justify-center gap-2 text-center">
      <Ban className="text-muted-foreground h-10 w-10" />
      <h2 className="text-lg font-semibold">Account access suspended</h2>
      <p className="text-muted-foreground max-w-md text-sm">
        This organization&apos;s Prima subscription has been cancelled. Please contact your
        administrator to reactivate billing and restore access.
      </p>
    </div>
  )
}
