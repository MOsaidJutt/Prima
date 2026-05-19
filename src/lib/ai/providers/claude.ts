import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'
import type { IAIProvider, AIProviderConfig } from './interface'

export class ClaudeProvider implements IAIProvider {
  private client: ReturnType<typeof createAnthropic>
  private config: AIProviderConfig

  constructor(config: AIProviderConfig) {
    this.config = config
    this.client = createAnthropic({ apiKey: config.apiKey })
  }

  getLanguageModel(modelId?: string) {
    return this.client(modelId ?? this.config.model ?? 'claude-haiku-4-5-20251001')
  }

  // Claude doesn't have a native embedding endpoint — fall back to OpenAI-compatible
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getEmbeddingModel(_modelId?: string): never {
    throw new Error('Claude does not support embeddings. Configure a separate embedding provider.')
  }

  async validate() {
    try {
      await generateText({
        model: this.getLanguageModel('claude-haiku-4-5-20251001'),
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
      { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', contextWindow: 200000 },
      { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', contextWindow: 200000 },
      { id: 'claude-opus-4-7', name: 'Claude Opus 4.7', contextWindow: 200000 },
    ]
  }

  pricingPer1M() {
    // Haiku pricing as baseline
    return { input: 0.8, output: 4.0 }
  }
}
