import type { Organization, OrganizationAISettings } from '@prisma/client'
import { decryptApiKey } from '@/lib/ai/crypto'
import { ClaudeProvider } from './claude'
import { OpenAIProvider } from './openai'
import { GeminiProvider } from './gemini'
import { OllamaProvider } from './ollama'
import type { IAIProvider } from './interface'

type OrgWithAISettings = Pick<
  Organization,
  'aiEnabled' | 'aiProvider' | 'aiApiKeyEncrypted' | 'aiModel' | 'embeddingProvider'
> & {
  aiSettings?: Pick<OrganizationAISettings, 'ollamaBaseUrl' | 'embeddingModel'> | null
}

export function getAIProvider(org: OrgWithAISettings): IAIProvider {
  if (!org.aiEnabled) throw new Error('AI features are disabled for this organization.')
  if (!org.aiProvider) throw new Error('No AI provider configured.')

  const apiKey = org.aiApiKeyEncrypted ? decryptApiKey(org.aiApiKeyEncrypted) : ''
  const embeddingModel = org.aiSettings?.embeddingModel ?? undefined

  switch (org.aiProvider.toUpperCase()) {
    case 'CLAUDE':
      return new ClaudeProvider({ apiKey, model: org.aiModel ?? undefined, embeddingModel })
    case 'OPENAI':
      return new OpenAIProvider({ apiKey, model: org.aiModel ?? undefined, embeddingModel })
    case 'GEMINI':
      return new GeminiProvider({ apiKey, model: org.aiModel ?? undefined, embeddingModel })
    case 'OLLAMA':
      return new OllamaProvider({
        apiKey: '',
        model: org.aiModel ?? undefined,
        embeddingModel,
        baseUrl: org.aiSettings?.ollamaBaseUrl ?? undefined,
      })
    default:
      throw new Error(`Unknown AI provider: ${org.aiProvider}`)
  }
}

// Build a provider from raw credentials (used during settings validation)
export function buildProviderFromCredentials(
  provider: string,
  apiKey: string,
  model?: string,
  baseUrl?: string
): IAIProvider {
  switch (provider.toUpperCase()) {
    case 'CLAUDE':
      return new ClaudeProvider({ apiKey, model })
    case 'OPENAI':
      return new OpenAIProvider({ apiKey, model })
    case 'GEMINI':
      return new GeminiProvider({ apiKey, model })
    case 'OLLAMA':
      return new OllamaProvider({ apiKey: '', model, baseUrl })
    default:
      throw new Error(`Unknown provider: ${provider}`)
  }
}
