import type { LanguageModel } from 'ai'

export interface IAIProvider {
  getLanguageModel(modelId?: string): LanguageModel
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getEmbeddingModel(modelId?: string): any
  validate(): Promise<{ ok: boolean; error?: string }>
  listModels(): Array<{ id: string; name: string; contextWindow: number }>
  pricingPer1M(): { input: number; output: number }
}

export interface AIProviderConfig {
  apiKey: string
  model?: string
  embeddingModel?: string
  baseUrl?: string
}
