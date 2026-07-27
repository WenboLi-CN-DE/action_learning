import type { RequirementItem } from '../types.ts'


const PLACEHOLDER_DESCRIPTIONS = new Set(['具体可以联系', '具体可联系', '后续联系', '待补充'])

type RequirementDataFields = Pick<RequirementItem, 'description' | 'submitted_by'>
type RequirementReviewFields = Pick<
  RequirementItem,
  'submitted_by' | 'assigned_reviewer' | 'reviewed_by' | 'reviewed_at' | 'review_note'
>

export function isRequirementDescriptionIncomplete(description: string) {
  const normalized = description.trim()
  return normalized.length < 10 || PLACEHOLDER_DESCRIPTIONS.has(normalized)
}

export function getRequirementDataIssues(requirement: RequirementDataFields) {
  const issues: string[] = []
  if (isRequirementDescriptionIncomplete(requirement.description)) issues.push('需求描述信息不足')
  if (!requirement.submitted_by?.trim()) issues.push('历史数据未记录提交人')
  return issues
}

export function getRequirementReviewPresentation(requirement: RequirementReviewFields) {
  return {
    submitter: requirement.submitted_by?.trim() || '历史数据未记录',
    assignee: requirement.assigned_reviewer?.trim() || '尚未指派',
    reviewer: requirement.reviewed_by?.trim() || '尚未审核',
    reviewNote: requirement.reviewed_by
      ? requirement.review_note?.trim() || '审核完成，未填写补充意见'
      : '审核完成后生成',
  }
}
