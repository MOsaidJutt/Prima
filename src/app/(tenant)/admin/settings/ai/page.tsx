'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Brain, Check, ChevronRight, Eye, EyeOff, Loader2, TestTube } from 'lucide-react'
import Link from 'next/link'

const PROVIDERS = [
  {
    value: 'CLAUDE',
    label: 'Claude (Anthropic)',
    models: ['claude-haiku-4-5-20251001', 'claude-sonnet-4-6', 'claude-opus-4-7'],
  },
  {
    value: 'OPENAI',
    label: 'OpenAI',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  },
  {
    value: 'GEMINI',
    label: 'Gemini (Google)',
    models: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash'],
  },
  {
    value: 'OLLAMA',
    label: 'Ollama (Local)',
    models: ['llama3.2', 'llama3.1', 'mistral', 'qwen2.5'],
  },
]

interface AISettings {
  aiEnabled: boolean
  aiProvider: string | null
  aiModel: string | null
  embeddingProvider: string | null
  monthlyTokenBudget: number
  autoTopUpEnabled: boolean
  autoTopUpThreshold: number
  hasApiKey: boolean
  aiSettings: {
    ollamaBaseUrl: string | null
    embeddingModel: string
    chatEnabled: boolean
    predictionsEnabled: boolean
    summariesEnabled: boolean
    scoringEnabled: boolean
    anomalyEnabled: boolean
  } | null
}

export default function AISettingsPage() {
  const [settings, setSettings] = useState<AISettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [validating, setValidating] = useState(false)
  const [validated, setValidated] = useState(false)

  // Form state
  const [aiEnabled, setAiEnabled] = useState(false)
  const [provider, setProvider] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [model, setModel] = useState('')
  const [monthlyBudget, setMonthlyBudget] = useState(100000)
  const [autoTopUp, setAutoTopUp] = useState(false)
  const [autoTopUpThreshold, setAutoTopUpThreshold] = useState(10000)
  const [ollamaUrl, setOllamaUrl] = useState('')

  // Feature toggles
  const [chatEnabled, setChatEnabled] = useState(true)
  const [predictionsEnabled, setPredictionsEnabled] = useState(true)
  const [summariesEnabled, setSummariesEnabled] = useState(true)
  const [scoringEnabled, setScoringEnabled] = useState(true)
  const [anomalyEnabled, setAnomalyEnabled] = useState(true)

  useEffect(() => {
    fetch('/api/v1/ai/settings')
      .then((r) => r.json())
      .then((data) => {
        setSettings(data)
        setAiEnabled(data.aiEnabled ?? false)
        setProvider(data.aiProvider ?? '')
        setModel(data.aiModel ?? '')
        setMonthlyBudget(data.monthlyTokenBudget ?? 100000)
        setAutoTopUp(data.autoTopUpEnabled ?? false)
        setAutoTopUpThreshold(data.autoTopUpThreshold ?? 10000)
        setOllamaUrl(data.aiSettings?.ollamaBaseUrl ?? '')
        setChatEnabled(data.aiSettings?.chatEnabled ?? true)
        setPredictionsEnabled(data.aiSettings?.predictionsEnabled ?? true)
        setSummariesEnabled(data.aiSettings?.summariesEnabled ?? true)
        setScoringEnabled(data.aiSettings?.scoringEnabled ?? true)
        setAnomalyEnabled(data.aiSettings?.anomalyEnabled ?? true)
      })
      .catch(() => toast.error('Failed to load AI settings'))
      .finally(() => setLoading(false))
  }, [])

  async function handleValidate() {
    if (!provider || (!apiKey && !settings?.hasApiKey)) {
      toast.error('Enter a provider and API key first')
      return
    }
    setValidating(true)
    try {
      const res = await fetch('/api/v1/ai/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          apiKey: apiKey || '__use_saved__',
          model: model || undefined,
        }),
      })
      const data = await res.json()
      if (data.ok) {
        setValidated(true)
        toast.success('API key validated successfully!')
      } else {
        toast.error(data.error ?? 'Validation failed')
      }
    } catch {
      toast.error('Validation request failed')
    } finally {
      setValidating(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch('/api/v1/ai/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aiEnabled,
          aiProvider: provider || null,
          apiKey: apiKey || undefined,
          aiModel: model || null,
          embeddingProvider: provider || null,
          monthlyTokenBudget: monthlyBudget,
          autoTopUpEnabled: autoTopUp,
          autoTopUpThreshold,
          ollamaBaseUrl: provider === 'OLLAMA' ? ollamaUrl || null : null,
          chatEnabled,
          predictionsEnabled,
          summariesEnabled,
          scoringEnabled,
          anomalyEnabled,
        }),
      })
      if (!res.ok) throw new Error('Save failed')
      toast.success('AI settings saved')
    } catch {
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const selectedProviderModels = PROVIDERS.find((p) => p.value === provider)?.models ?? []

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">AI Configuration</h1>
          <p className="text-muted-foreground text-sm">
            Configure AI provider, token budget, and feature toggles.
          </p>
        </div>
        <Link href="/admin/settings/ai/usage">
          <Button variant="outline" size="sm">
            View Usage <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </Link>
      </div>

      {/* Master toggle */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-lg">
                <Brain className="text-primary h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">AI Features</CardTitle>
                <CardDescription>Enable or disable all AI capabilities</CardDescription>
              </div>
            </div>
            <Switch checked={aiEnabled} onCheckedChange={setAiEnabled} />
          </div>
        </CardHeader>
      </Card>

      {aiEnabled && (
        <>
          {/* Provider */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">AI Provider</CardTitle>
              <CardDescription>Select your AI provider and enter credentials.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Provider</Label>
                <Select
                  value={provider}
                  onValueChange={(v) => {
                    setProvider(v)
                    setModel('')
                    setValidated(false)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVIDERS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {provider && provider !== 'OLLAMA' && (
                <div className="space-y-1.5">
                  <Label>API Key</Label>
                  <div className="relative flex items-center gap-2">
                    <div className="relative flex-1">
                      <Input
                        type={showKey ? 'text' : 'password'}
                        value={apiKey}
                        onChange={(e) => {
                          setApiKey(e.target.value)
                          setValidated(false)
                        }}
                        placeholder={
                          settings?.hasApiKey ? '••••••••••••• (saved)' : 'Enter API key'
                        }
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowKey(!showKey)}
                        className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
                      >
                        {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <Button
                      variant="outline"
                      onClick={handleValidate}
                      disabled={validating || validated}
                    >
                      {validating ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : validated ? (
                        <>
                          <Check className="mr-1 h-4 w-4 text-green-500" /> Valid
                        </>
                      ) : (
                        <>
                          <TestTube className="mr-1 h-4 w-4" /> Test
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {provider === 'OLLAMA' && (
                <div className="space-y-1.5">
                  <Label>Ollama Base URL</Label>
                  <Input
                    value={ollamaUrl}
                    onChange={(e) => setOllamaUrl(e.target.value)}
                    placeholder="http://localhost:11434"
                  />
                  <p className="text-muted-foreground text-xs">URL of your local Ollama server.</p>
                </div>
              )}

              {selectedProviderModels.length > 0 && (
                <div className="space-y-1.5">
                  <Label>Model</Label>
                  <Select value={model} onValueChange={setModel}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select model" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedProviderModels.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Token Budget */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Token Budget</CardTitle>
              <CardDescription>
                Monthly token limit. AI features disable when exhausted.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Monthly Token Budget</Label>
                <Input
                  type="number"
                  value={monthlyBudget}
                  onChange={(e) => setMonthlyBudget(Number(e.target.value))}
                  min={1000}
                  step={10000}
                />
                <p className="text-muted-foreground text-xs">
                  ~{Math.round(monthlyBudget / 1000)}K tokens. 100K tokens ≈ $0.08–$1.50 depending
                  on provider.
                </p>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Auto Top-Up</p>
                  <p className="text-muted-foreground text-xs">
                    Automatically purchase more tokens when budget runs low.
                  </p>
                </div>
                <Switch checked={autoTopUp} onCheckedChange={setAutoTopUp} />
              </div>

              {autoTopUp && (
                <div className="space-y-1.5">
                  <Label>Top-Up Threshold (tokens remaining)</Label>
                  <Input
                    type="number"
                    value={autoTopUpThreshold}
                    onChange={(e) => setAutoTopUpThreshold(Number(e.target.value))}
                    min={1000}
                    step={5000}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Feature toggles */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Feature Toggles</CardTitle>
              <CardDescription>Enable or disable individual AI features.</CardDescription>
            </CardHeader>
            <CardContent className="divide-y">
              {[
                {
                  label: 'AI Chat Assistant',
                  desc: 'Floating chat panel and full-page AI assistant',
                  value: chatEnabled,
                  set: setChatEnabled,
                },
                {
                  label: 'Inventory Demand Predictions',
                  desc: 'Nightly demand forecasting and reorder recommendations',
                  value: predictionsEnabled,
                  set: setPredictionsEnabled,
                },
                {
                  label: 'Natural Language Summaries',
                  desc: 'Summarize dashboard widget data in plain English',
                  value: summariesEnabled,
                  set: setSummariesEnabled,
                },
                {
                  label: 'Payment Behavior Scoring',
                  desc: 'Auto-score client payment reliability 0–100',
                  value: scoringEnabled,
                  set: setScoringEnabled,
                },
                {
                  label: 'Anomaly Detection',
                  desc: 'Detect revenue drops, DSR skips, and order spikes',
                  value: anomalyEnabled,
                  set: setAnomalyEnabled,
                },
              ].map(({ label, desc, value, set }) => (
                <div key={label} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-muted-foreground text-xs">{desc}</p>
                  </div>
                  <Switch checked={value} onCheckedChange={set} />
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Settings
        </Button>
      </div>
    </div>
  )
}
