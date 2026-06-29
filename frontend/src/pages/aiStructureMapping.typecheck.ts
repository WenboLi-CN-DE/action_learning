import {
  buildProjectDescription,
  buildRequirementDescription,
  normalizeProjectStatus,
  normalizeRequirementStatus,
  normalizeUrgency,
} from './aiStructureMapping'
import type { LLMStructureResult } from '../types'

const projectResult: LLMStructureResult = {
  model: 'qwen3.6-plus',
  fields: {
    name: '数据中心能耗分析演示系统',
    status: '开发中',
    description: '面向数据中心的能耗分析 demo。',
    business_line: '数据中心',
    business_scenario: '能耗监控与优化',
    core_capability: '高耗能设备识别与能效优化建议生成',
    deliverable_form: '软件演示模块',
    matchable_requirement_types: '能效评估、设备监控、优化方案定制',
    constraints: '需接入实时能耗数据',
  },
  missing_fields: [],
  follow_up_questions: [],
  warnings: [],
}

const requirementResult: LLMStructureResult = {
  model: 'qwen3.6-plus',
  fields: {
    title: '数据中心节能评估需求',
    urgency: '中',
    description: '客户希望降低 PUE。',
    business_line: '数据中心',
    business_scenario: '数据中心能源管理',
    pain_points: '缺少统一能耗分析',
    expected_capability: '节能评估与优化建议',
    timeline_or_stage: '近期评估',
  },
  missing_fields: [],
  follow_up_questions: [],
  warnings: [],
}

if (normalizeUrgency('中') !== 'medium') throw new Error('urgency mapping failed')
if (normalizeUrgency('medium') !== 'medium') throw new Error('english urgency mapping failed')
if (normalizeProjectStatus('开发中') !== 'researching') throw new Error('project status mapping failed')
if (normalizeRequirementStatus('新需求') !== 'new') throw new Error('requirement status mapping failed')
if (!buildProjectDescription(projectResult).includes('【核心能力】高耗能设备识别与能效优化建议生成')) {
  throw new Error('project description template failed')
}
if (!buildRequirementDescription(requirementResult).includes('【当前痛点】缺少统一能耗分析')) {
  throw new Error('requirement description template failed')
}
