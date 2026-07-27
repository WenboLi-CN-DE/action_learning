import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import type { RoleId } from './permissions'


interface RoleState {
  role: RoleId | null
  displayName: string
  setIdentity: (role: RoleId, displayName: string) => void
  clearIdentity: () => void
}

export const useRoleStore = create<RoleState>()(
  persist(
    (set) => ({
      role: null,
      displayName: '',
      setIdentity: (role, displayName) => set({ role, displayName: displayName.trim() }),
      clearIdentity: () => set({ role: null, displayName: '' }),
    }),
    { name: 'action_learning_identity' },
  ),
)
