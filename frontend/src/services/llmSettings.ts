import type { LLMSettings } from '../types'

const STORAGE_KEY = 'action_learning_llm_settings'

export function loadLLMSettings(): LLMSettings | null {
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as LLMSettings
    return {
      api_key: parsed.api_key || undefined,
      model: parsed.model || undefined,
      base_url: parsed.base_url || undefined,
    }
  } catch {
    return null
  }
}

export function saveLLMSettings(settings: LLMSettings) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

export function clearLLMSettings() {
  window.localStorage.removeItem(STORAGE_KEY)
}
