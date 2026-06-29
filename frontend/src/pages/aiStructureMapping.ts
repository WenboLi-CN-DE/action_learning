import type { LLMStructureResult } from '../types'

type FieldMap = LLMStructureResult['fields']

const projectStatusMap: Record<string, string> = {
  researching: 'researching',
  research: 'researching',
  '预研中': 'researching',
  '研发中': 'researching',
  '开发中': 'researching',
  '进行中': 'researching',
  demo_ready: 'demo_ready',
  demo: 'demo_ready',
  '可演示': 'demo_ready',
  '原型阶段': 'demo_ready',
  '演示阶段': 'demo_ready',
  delivered: 'delivered',
  '已交付': 'delivered',
  '已上线': 'delivered',
  '上线': 'delivered',
  paused: 'paused',
  '暂停': 'paused',
  '搁置': 'paused',
}

const requirementStatusMap: Record<string, string> = {
  new: 'new',
  '新需求': 'new',
  '新建': 'new',
  '待评估': 'new',
  reviewing: 'reviewing',
  '评估中': 'reviewing',
  '已评估': 'reviewing',
  matched: 'matched',
  '已匹配': 'matched',
  closed: 'closed',
  '关闭': 'closed',
  '已关闭': 'closed',
  '搁置': 'closed',
}

const urgencyMap: Record<string, string> = {
  high: 'high',
  '高': 'high',
  '紧急': 'high',
  '高优先级': 'high',
  medium: 'medium',
  '中': 'medium',
  '一般': 'medium',
  '中等': 'medium',
  '中优先级': 'medium',
  low: 'low',
  '低': 'low',
  '不急': 'low',
  '低优先级': 'low',
}

const projectDescriptionFields: [keyof FieldMap & string, string][] = [
  ['description', '描述'],
  ['business_line', '行业/业务线'],
  ['business_scenario', '适用场景'],
  ['core_capability', '核心能力'],
  ['maturity', '成熟度'],
  ['deliverable_form', '可交付形式'],
  ['matchable_requirement_types', '可匹配需求类型'],
  ['constraints', '限制条件'],
]

const requirementDescriptionFields: [keyof FieldMap & string, string][] = [
  ['description', '需求描述'],
  ['business_line', '行业/业务线'],
  ['business_scenario', '业务场景'],
  ['pain_points', '当前痛点'],
  ['expected_capability', '期望能力'],
  ['timeline_or_stage', '时间节点/阶段'],
  ['current_solution', '现有方案'],
  ['expected_value', '预期价值'],
]

function cleanValue(value: string | null | undefined) {
  const cleaned = value?.trim()
  return cleaned || undefined
}

function normalizeByMap(value: string | null | undefined, mapping: Record<string, string>, fallback: string) {
  const cleaned = cleanValue(value)
  if (!cleaned) return fallback
  return mapping[cleaned] ?? mapping[cleaned.toLowerCase()] ?? fallback
}

function buildDescription(fields: FieldMap, items: [keyof FieldMap & string, string][]) {
  return items
    .map(([key, label]) => {
      const value = cleanValue(fields[key])
      return value ? `【${label}】${value}` : null
    })
    .filter(Boolean)
    .join('\n')
}

export function normalizeProjectStatus(value: string | null | undefined) {
  return normalizeByMap(value, projectStatusMap, 'researching')
}

export function normalizeRequirementStatus(value: string | null | undefined) {
  return normalizeByMap(value, requirementStatusMap, 'new')
}

export function normalizeUrgency(value: string | null | undefined) {
  return normalizeByMap(value, urgencyMap, 'medium')
}

export function buildProjectDescription(result: LLMStructureResult) {
  return buildDescription(result.fields, projectDescriptionFields)
}

export function buildRequirementDescription(result: LLMStructureResult) {
  return buildDescription(result.fields, requirementDescriptionFields)
}

export function getFieldValue(fields: FieldMap, key: string) {
  return cleanValue(fields[key])
}
