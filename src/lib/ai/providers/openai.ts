import { createOpenAI } from '@ai-sdk/openai'
import { generateText } from 'ai'
import type { IAIProvider, AIProviderConfig } from './interface'

export class OpenAIProvider implements IAIProvider {
  private client: ReturnType<typeof createOpenAI>
  private config: AIProviderConfig

  constructor(config: AIProviderConfig) {
    this.config = config
    this.client = createOpenAI({ apiKey: config.apiKey })
  }

  getLanguageModel(modelId?: string) {
    return this.client(modelId ?? this.config.model ?? 'gpt-4o-mini')
  }

  getEmbeddingModel(modelId?: string) {
    return this.client.embedding(modelId ?? this.config.embeddingModel ?? 'text-embedding-3-small')
  }

  async validate() {
    try {
      await generateText({
        model: this.getLanguageModel('gpt-4o-mini'),
        prompt: 'Reply with exactly: ok',
        maxOutputTokens: 5,
      })
      return { ok: true }
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  }

  listModels() {
    return [
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', contextWindow: 128000 },
      { id: 'gpt-4o', name: 'GPT-4o', contextWindow: 128000 },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', contextWindow: 128000 },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', contextWindow: 16000 },
    ]
  }

  pricingPer1M() {
    return { input: 0.15, output: 0.6 } // gpt-4o-mini
  }
}
