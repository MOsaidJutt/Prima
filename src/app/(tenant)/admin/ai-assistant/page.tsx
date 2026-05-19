import { ChatInterface } from '@/components/ai/chat-interface'
import { Bot } from 'lucide-react'

export default function AIAssistantPage() {
  return (
    <div className="flex h-[calc(100vh-10rem)] flex-col">
      <div className="mb-4 flex items-center gap-3">
        <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-xl">
          <Bot className="text-primary h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">AI Assistant</h1>
          <p className="text-muted-foreground text-sm">
            Ask questions about your business data. The assistant can query live data.
          </p>
        </div>
      </div>

      <div className="bg-card flex flex-1 overflow-hidden rounded-xl border shadow-sm">
        <ChatInterface className="flex-1" />
      </div>
    </div>
  )
}
