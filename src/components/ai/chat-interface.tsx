'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Bot, Loader2, Send, User } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface ChatInterfaceProps {
  conversationId?: string
  compact?: boolean
  className?: string
}

let msgCounter = 0

export function ChatInterface({ conversationId, compact, className }: ChatInterfaceProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [convId, setConvId] = useState(conversationId)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return
      setError(null)
      const userMsg: Message = { id: `u${++msgCounter}`, role: 'user', content: text }
      const assistantId = `a${++msgCounter}`
      setMessages((prev) => [...prev, userMsg, { id: assistantId, role: 'assistant', content: '' }])
      setIsLoading(true)

      try {
        const res = await fetch('/api/v1/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [...messages, userMsg].map((m) => ({ role: m.role, content: m.content })),
            conversationId: convId,
          }),
        })

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Unknown error' }))
          throw new Error(err.error ?? `HTTP ${res.status}`)
        }

        const newConvId = res.headers.get('X-Conversation-Id')
        if (newConvId && !convId) setConvId(newConvId)

        const reader = res.body?.getReader()
        const decoder = new TextDecoder()
        if (!reader) throw new Error('No response stream')

        let accumulated = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value, { stream: true })
          accumulated += chunk
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: accumulated } : m))
          )
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'An error occurred')
        setMessages((prev) => prev.filter((m) => m.id !== assistantId))
      } finally {
        setIsLoading(false)
      }
    },
    [messages, convId, isLoading]
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const text = input.trim()
    if (!text) return
    setInput('')
    sendMessage(text)
  }

  const avatarClass =
    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium'

  return (
    <div className={cn('flex flex-col', className)}>
      <div className="flex-1 overflow-y-auto px-4" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <div className="bg-primary/10 flex h-12 w-12 items-center justify-center rounded-xl">
              <Bot className="text-primary h-6 w-6" />
            </div>
            <div>
              <p className="font-medium">Prima AI Assistant</p>
              <p className="text-muted-foreground mt-1 text-sm">
                Ask anything about your business data.
              </p>
            </div>
            {!compact && (
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {[
                  "What was last month's revenue?",
                  'Who are my top 5 clients?',
                  'Show me overdue invoices',
                  'Which products are low in stock?',
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setInput(suggestion)}
                    className="border-border/60 text-muted-foreground hover:bg-muted/50 hover:text-foreground rounded-lg border px-3 py-2 text-left text-xs transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="space-y-4 py-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn('flex gap-3', msg.role === 'user' ? 'justify-end' : 'justify-start')}
            >
              {msg.role === 'assistant' && (
                <div className={cn(avatarClass, 'bg-primary/10 text-primary')}>
                  <Bot className="h-4 w-4" />
                </div>
              )}
              <div
                className={cn(
                  'max-w-[80%] rounded-xl px-3 py-2 text-sm',
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground'
                )}
              >
                {msg.content ? (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <span className="bg-muted-foreground h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:-0.3s]" />
                    <span className="bg-muted-foreground h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:-0.15s]" />
                    <span className="bg-muted-foreground h-1.5 w-1.5 animate-bounce rounded-full" />
                  </div>
                )}
              </div>
              {msg.role === 'user' && (
                <div className={cn(avatarClass, 'bg-secondary text-secondary-foreground')}>
                  <User className="h-4 w-4" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive mx-4 mb-2 rounded-lg px-3 py-2 text-xs">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2 border-t p-3">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask anything about your business..."
          disabled={isLoading}
          className="flex-1 text-sm"
          autoComplete="off"
        />
        <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  )
}
