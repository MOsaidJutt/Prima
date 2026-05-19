import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateText } from 'ai'
import type { IAIProvider, AIProviderConfig } from './interface'

export class GeminiProvider implements IAIProvider {
  private client: ReturnType<typeof createGoogleGenerativeAI>
  private config: AIProviderConfig

  constructor(config: AIProviderConfig) {
    this.config = config
    this.client = createGoogleGenerativeAI({ apiKey: config.apiKey })
  }

  getLanguageModel(modelId?: string) {
    return this.client(modelId ?? this.config.model ?? 'gemini-1.5-flash')
  }

  getEmbeddingModel(modelId?: string) {
    return this.client.textEmbeddingModel(
      modelId ?? this.config.embeddingModel ?? 'text-embedding-004'
    )
  }

  async validate() {
    try {
      await generateText({
        model: this.getLanguageModel('gemini-1.5-flash'),
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
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', contextWindow: 1000000 },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', contextWindow: 2000000 },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', contextWindow: 1000000 },
    ]
  }

  pricingPer1M() {
    return { input: 0.075, output: 0.3 } // gemini-1.5-flash
  }
}
