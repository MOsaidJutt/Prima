'use client'

import { useState } from 'react'
import { Bot, X, Maximize2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ChatInterface } from './chat-interface'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export function ChatFloat() {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Floating panel */}
      {open && (
        <div className="bg-card fixed right-4 bottom-20 z-50 flex h-[480px] w-80 flex-col overflow-hidden rounded-xl border shadow-2xl">
          <div className="bg-primary/5 flex items-center justify-between border-b px-3 py-2.5">
            <div className="flex items-center gap-2">
              <Bot className="text-primary h-4 w-4" />
              <span className="text-sm font-medium">Prima AI</span>
            </div>
            <div className="flex items-center gap-1">
              <Link href="/admin/ai-assistant">
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <Maximize2 className="h-3 w-3" />
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setOpen(false)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <ChatInterface compact className="flex-1 overflow-hidden" />
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'bg-primary text-primary-foreground fixed right-4 bottom-4 z-50 flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-all hover:scale-105 hover:shadow-xl active:scale-95',
          open && 'bg-primary/80'
        )}
        aria-label="Toggle AI chat"
      >
        {open ? <X className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
      </button>
    </>
  )
}
