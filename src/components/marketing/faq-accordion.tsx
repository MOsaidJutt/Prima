'use client'

import { useState } from 'react'
import * as Collapsible from '@radix-ui/react-collapsible'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

export function FaqAccordion({ items }: { items: { question: string; answer: string }[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <div className="divide-border/60 divide-y">
      {items.map((item, i) => {
        const open = openIndex === i
        return (
          <Collapsible.Root
            key={item.question}
            open={open}
            onOpenChange={(next) => setOpenIndex(next ? i : null)}
          >
            <Collapsible.Trigger className="flex w-full items-center justify-between gap-4 py-5 text-left">
              <span className="text-foreground text-base font-medium">{item.question}</span>
              <Plus
                className={cn(
                  'text-muted-foreground h-5 w-5 shrink-0 transition-transform duration-300',
                  open && 'rotate-45'
                )}
              />
            </Collapsible.Trigger>
            <Collapsible.Content className="overflow-hidden data-[state=closed]:animate-none">
              <p className="text-muted-foreground max-w-[65ch] pb-5 text-sm leading-relaxed">
                {item.answer}
              </p>
            </Collapsible.Content>
          </Collapsible.Root>
        )
      })}
    </div>
  )
}
