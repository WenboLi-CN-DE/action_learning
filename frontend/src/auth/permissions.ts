export type RoleId = 'sales' | 'research' | 'admin'

export interface RoleCapabilities {
  defaultTab: 'dashboard' | 'projects' | 'requirements' | 'reviews'
  canCreateRequirement: boolean
  canEditRequirement: boolean
  canManageProjects: boolean
  canCreateMatches: boolean
  canReviewRequirements: boolean
  canReviewMatches: boolean
  canManageKnowledge: boolean
}

const CAPABILITIES: Record<RoleId, RoleCapabilities> = {
  sales: {
    defaultTab: 'projects',
    canCreateRequirement: true,
    canEditRequirement: true,
    canManageProjects: false,
    canCreateMatches: false,
    canReviewRequirements: false,
    canReviewMatches: false,
    canManageKnowledge: false,
  },
  research: {
    defaultTab: 'projects',
    canCreateRequirement: false,
    canEditRequirement: false,
    canManageProjects: true,
    canCreateMatches: false,
    canReviewRequirements: false,
    canReviewMatches: true,
    canManageKnowledge: false,
  },
  admin: {
    defaultTab: 'reviews',
    canCreateRequirement: false,
    canEditRequirement: false,
    canManageProjects: false,
    canCreateMatches: true,
    canReviewRequirements: true,
    canReviewMatches: true,
    canManageKnowledge: true,
  },
}

const SALES_VISIBLE_PROJECT_STATUSES = new Set(['demo_ready', 'delivered'])

export function isSalesVisibleProjectStatus(status: string) {
  return SALES_VISIBLE_PROJECT_STATUSES.has(status)
}

export function isSalesOwnRequirement(submittedBy: string | null | undefined, displayName: string) {
  return submittedBy === displayName
}

export const ROLE_LABELS: Record<RoleId, string> = {
  sales: '销售 / 咨询',
  research: '研发',
  admin: '管理员',
}

export function isRoleId(value: unknown): value is RoleId {
  return value === 'sales' || value === 'research' || value === 'admin'
}

export function getRoleCapabilities(role: RoleId): RoleCapabilities {
  return CAPABILITIES[role]
}
