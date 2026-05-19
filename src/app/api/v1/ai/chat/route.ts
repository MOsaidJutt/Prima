import { NextRequest, NextResponse } from 'next/server'
import { streamText, type ModelMessage } from 'ai'
import { requireTenantAuth } from '@/lib/auth/require-tenant-auth'
import { prisma } from '@/lib/prisma'
import { getAIProvider } from '@/lib/ai/providers/factory'
import { checkBudget, logTokenUsage } from '@/lib/ai/wallet'
import { buildOrgTools } from '@/lib/ai/tools'
import { z } from 'zod'

const bodySchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string(),
    })
  ),
  conversationId: z.string().uuid().optional(),
})

export async function POST(req: NextRequest) {
  const auth = await requireTenantAuth()
  if (!auth.ok) return auth.response

  const orgId = auth.session.organizationId
  const userId = auth.user.id

  const budget = await checkBudget(orgId)
  if (!budget.allowed) {
    return NextResponse.json(
      { error: 'AI token budget exhausted. Please top up or wait for next month.' },
      { status: 402 }
    )
  }

  const body = await req.json()
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 })
  }

  const { messages, conversationId } = parsed.data

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      id: true,
      name: true,
      aiEnabled: true,
      aiProvider: true,
      aiApiKeyEncrypted: true,
      aiModel: true,
      embeddingProvider: true,
      aiSettings: { select: { ollamaBaseUrl: true, embeddingModel: true, chatEnabled: true } },
    },
  })

  if (!org?.aiEnabled || !org.aiSettings?.chatEnabled) {
    return NextResponse.json({ error: 'AI chat is disabled.' }, { status: 403 })
  }

  const provider = getAIProvider(org)
  const model = provider.getLanguageModel()
  const tools = buildOrgTools(orgId)

  let convId = conversationId
  if (!convId) {
    const conv = await prisma.aIConversation.create({
      data: { organizationId: orgId, userId },
    })
    convId = conv.id
  }

  const lastUserMsg = messages[messages.length - 1]
  if (lastUserMsg?.role === 'user') {
    await prisma.aIMessage.create({
      data: { conversationId: convId, role: 'user', content: lastUserMsg.content },
    })
  }

  const systemPrompt = `You are Prima AI, an intelligent business assistant for ${org.name}.
You have access to tools to query live business data. Use tools when asked about revenue, clients, inventory, invoices, or employee performance.
Be concise, professional, and data-driven. Format numbers with commas.
Current date: ${new Date().toLocaleDateString('en-PK')}.`

  const coreMessages: ModelMessage[] = messages.map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))

  const result = streamText({
    model,
    system: systemPrompt,
    messages: coreMessages,
    tools,
    onFinish: async ({ text, usage }) => {
      await prisma.aIMessage.create({
        data: {
          conversationId: convId!,
          role: 'assistant',
          content: text,
          inputTokens: usage?.inputTokens ?? 0,
          outputTokens: usage?.outputTokens ?? 0,
        },
      })

      await logTokenUsage({
        organizationId: orgId,
        userId,
        feature: 'chat',
        model: org.aiModel ?? 'unknown',
        provider: org.aiProvider ?? 'unknown',
        inputTokens: usage?.inputTokens ?? 0,
        outputTokens: usage?.outputTokens ?? 0,
        referenceType: 'AIConversation',
        referenceId: convId,
      })
    },
  })

  return result.toTextStreamResponse({
    headers: { 'X-Conversation-Id': convId },
  })
}
