import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, Users } from 'lucide-react'

const REPS = [
  { name: 'Hassan A.', region: 'Lahore', submitted: 14, status: 'On track' as const },
  { name: 'Fatima R.', region: 'Karachi', submitted: 11, status: 'Review' as const },
  { name: 'Bilal K.', region: 'Faisalabad', submitted: 16, status: 'On track' as const },
]

export function HeroPreview() {
  return (
    <Card className="border-border/80 w-full max-w-md p-0 shadow-xl">
      <div className="border-border/60 flex items-center justify-between border-b px-5 py-4">
        <div>
          <p className="text-foreground text-sm font-semibold">Today&apos;s DSR submissions</p>
          <p className="text-muted-foreground text-xs">North zone &middot; 19 Jun</p>
        </div>
        <span className="bg-success/15 text-success flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold">
          <TrendingUp className="h-3 w-3" />
          +12.4%
        </span>
      </div>

      <div className="divide-border/60 divide-y">
        {REPS.map((rep) => (
          <div key={rep.name} className="flex items-center justify-between px-5 py-3.5">
            <div className="flex items-center gap-3">
              <span className="bg-secondary text-secondary-foreground flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold">
                {rep.name
                  .split(' ')
                  .map((p) => p[0])
                  .join('')}
              </span>
              <div>
                <p className="text-foreground text-sm font-medium">{rep.name}</p>
                <p className="text-muted-foreground text-xs">{rep.region}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-foreground font-mono text-sm">{rep.submitted} orders</span>
              <Badge variant={rep.status === 'On track' ? 'success' : 'warning'}>
                {rep.status}
              </Badge>
            </div>
          </div>
        ))}
      </div>

      <div className="border-border/60 flex items-center gap-2 border-t px-5 py-3.5">
        <Users className="text-muted-foreground h-4 w-4" />
        <p className="text-muted-foreground text-xs">
          8 of 9 reps reported in &middot; 1 pending approval
        </p>
      </div>
    </Card>
  )
}
