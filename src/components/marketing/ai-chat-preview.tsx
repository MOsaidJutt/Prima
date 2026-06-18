import { Card } from '@/components/ui/card'
import { Sparkles } from 'lucide-react'

export function AiChatPreview() {
  return (
    <Card className="border-border/80 w-full max-w-md p-0 shadow-xl">
      <div className="border-border/60 flex items-center gap-2 border-b px-5 py-4">
        <span className="bg-accent text-accent-foreground flex h-7 w-7 items-center justify-center rounded-full">
          <Sparkles className="h-3.5 w-3.5" />
        </span>
        <p className="text-foreground text-sm font-semibold">Prima Assistant</p>
      </div>

      <div className="space-y-3 px-5 py-4">
        <div className="bg-muted text-foreground ml-auto max-w-[85%] rounded-md px-3.5 py-2.5 text-sm">
          Which clients haven&apos;t ordered in 30 days?
        </div>
        <div className="bg-card border-border/70 max-w-[90%] rounded-md border px-3.5 py-2.5 text-sm leading-relaxed">
          7 clients have gone quiet.{' '}
          <span className="text-foreground font-medium">Al-Hamd Traders</span> and{' '}
          <span className="text-foreground font-medium">Noor Enterprises</span> were your top
          accounts last quarter, worth PKR 480,000 combined. Want me to draft a follow-up for your
          sales reps?
        </div>
      </div>

      <div className="border-border/60 flex items-center gap-2 border-t px-5 py-3.5">
        <div className="bg-muted text-muted-foreground flex-1 rounded-md px-3 py-2 text-xs">
          Ask about clients, inventory, payments...
        </div>
      </div>
    </Card>
  )
}
