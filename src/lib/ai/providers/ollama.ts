import { ollama } from 'ollama-ai-provider'
import { generateText, type LanguageModel } from 'ai'
import type { IAIProvider, AIProviderConfig } from './interface'

export class OllamaProvider implements IAIProvider {
  private config: AIProviderConfig

  constructor(config: AIProviderConfig) {
    this.config = config
    if (config.baseUrl) {
      process.env.OLLAMA_BASE_URL = config.baseUrl
    }
  }

  getLanguageModel(modelId?: string): LanguageModel {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return ollama(modelId ?? this.config.model ?? 'llama3.2') as any as LanguageModel
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getEmbeddingModel(modelId?: string): any {
    return ollama.embedding(modelId ?? this.config.embeddingModel ?? 'nomic-embed-text')
  }

  async validate() {
    try {
      await generateText({
        model: this.getLanguageModel(),
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
      { id: 'llama3.2', name: 'Llama 3.2 (3B)', contextWindow: 131072 },
      { id: 'llama3.1', name: 'Llama 3.1 (8B)', contextWindow: 131072 },
      { id: 'mistral', name: 'Mistral (7B)', contextWindow: 32768 },
      { id: 'qwen2.5', name: 'Qwen 2.5 (7B)', contextWindow: 131072 },
    ]
  }

  pricingPer1M() {
    return { input: 0, output: 0 }
  }
}
