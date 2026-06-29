import { clearLLMSettings, loadLLMSettings, saveLLMSettings } from '../services/llmSettings'
import type { LLMSettings } from '../types'

const settings: LLMSettings = {
  api_key: 'browser-key',
  model: 'qwen3.6-plus',
  base_url: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
}

saveLLMSettings(settings)
const loaded = loadLLMSettings()
if (loaded?.model !== 'qwen3.6-plus') {
  throw new Error('settings model mismatch')
}
clearLLMSettings()
