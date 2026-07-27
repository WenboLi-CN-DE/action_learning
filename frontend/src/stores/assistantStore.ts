import { create } from 'zustand'

import type { LLMStructureResult } from '../types'


interface AssistantState {
  requirementDraft: LLMStructureResult | null
  setRequirementDraft: (draft: LLMStructureResult) => void
  clearRequirementDraft: () => void
}

export const useAssistantStore = create<AssistantState>((set) => ({
  requirementDraft: null,
  setRequirementDraft: (requirementDraft) => set({ requirementDraft }),
  clearRequirementDraft: () => set({ requirementDraft: null }),
}))
