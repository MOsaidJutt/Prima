import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface PaymentBehaviorBadgeProps {
  score: number | null
  label: string | null
}

const LABEL_CONFIG = {
  EXCELLENT: { className: 'bg-green-500/10 text-green-700 border-green-200', emoji: '⭐' },
  GOOD: { className: 'bg-blue-500/10 text-blue-700 border-blue-200', emoji: '✓' },
  AVERAGE: { className: 'bg-yellow-500/10 text-yellow-700 border-yellow-200', emoji: '~' },
  RISKY: { className: 'bg-orange-500/10 text-orange-700 border-orange-200', emoji: '⚠' },
  DEFAULTER: { className: 'bg-destructive/10 text-destructive border-destructive/20', emoji: '✗' },
}

export function PaymentBehaviorBadge({ score, label }: PaymentBehaviorBadgeProps) {
  if (!label || !score) {
    return (
      <Badge variant="outline" className="text-muted-foreground text-xs">
        Unscored
      </Badge>
    )
  }

  const config = LABEL_CONFIG[label as keyof typeof LABEL_CONFIG]
  if (!config) return null

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className={`cursor-default text-xs ${config.className}`}>
            {config.emoji} {label} ({score})
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-[220px] text-xs">
          <p className="mb-1 font-medium">Payment Behavior Score: {score}/100</p>
          <p className="text-muted-foreground">
            Computed from on-time payment rate (40%), average days late (30%), defaults (20%), and
            recent trend (10%).
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
