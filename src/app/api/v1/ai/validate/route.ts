import { NextRequest } from 'next/server'
import { withTenantApi, apiOk, apiError } from '@/lib/api-helpers'
import { buildProviderFromCredentials } from '@/lib/ai/providers/factory'
import { z } from 'zod'

const schema = z.object({
  provider: z.enum(['CLAUDE', 'OPENAI', 'GEMINI', 'OLLAMA']),
  apiKey: z.string().min(1),
  model: z.string().optional(),
  baseUrl: z.string().optional(),
})

export async function POST(req: NextRequest) {
  return withTenantApi(req, null, async () => {
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? 'Validation error')

    const { provider, apiKey, model, baseUrl } = parsed.data

    try {
      const aiProvider = buildProviderFromCredentials(provider, apiKey, model, baseUrl)
      const result = await aiProvider.validate()
      return apiOk(result)
    } catch (err: unknown) {
      return apiError(err instanceof Error ? err.message : 'Unknown error')
    }
  })
}
