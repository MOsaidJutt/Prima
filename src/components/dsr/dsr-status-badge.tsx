'use client'

import { Badge } from '@/components/ui/badge'

const statusConfig: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }
> = {
  DRAFT: { label: 'Draft', variant: 'secondary' },
  SUBMITTED: { label: 'Submitted', variant: 'outline' },
  APPROVED: { label: 'Approved', variant: 'default' },
  REJECTED: { label: 'Rejected', variant: 'destructive' },
}

export function DSRStatusBadge({ status }: { status: string }) {
  const cfg = statusConfig[status] ?? { label: status, variant: 'secondary' }
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>
}
