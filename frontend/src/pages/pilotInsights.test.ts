import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildManagementHighlights,
  buildTaskSummary,
  getTaskSlaPresentation,
} from './pilotInsights.ts'


test('个人待办摘要突出总量、逾期和即将到期', () => {
  const summary = buildTaskSummary({
    role: 'admin',
    actor: '管理员甲',
    total: 3,
    overdue: 1,
    due_soon: 1,
    items: [],
  })

  assert.deepEqual(summary, [
    { key: 'total', label: '我的待办', value: 3, tone: 'default' },
    { key: 'overdue', label: '已经逾期', value: 1, tone: 'danger' },
    { key: 'due-soon', label: '12 小时内到期', value: 1, tone: 'warning' },
  ])
})


test('SLA 状态使用明确的剩余或逾期时间', () => {
  assert.deepEqual(
    getTaskSlaPresentation({ overdue: true, due_soon: false, remaining_hours: -12.4 }),
    { label: '已逾期 12.4 小时', color: 'red' },
  )
  assert.deepEqual(
    getTaskSlaPresentation({ overdue: false, due_soon: true, remaining_hours: 6 }),
    { label: '6 小时内到期', color: 'gold' },
  )
  assert.deepEqual(
    getTaskSlaPresentation({ overdue: false, due_soon: false, remaining_hours: 30 }),
    { label: '剩余 30 小时', color: 'green' },
  )
})


test('管理指标聚焦责任覆盖、候选覆盖、AI 采纳和数据质量', () => {
  const highlights = buildManagementHighlights({
    generated_at: '2026-07-29T00:00:00Z',
    data_quality: {
      average_score: 82.5,
      low_quality_count: 2,
      records: [],
    },
    workflow: {
      reviewer_assignment_rate: 50,
      candidate_coverage_rate: 75,
      average_requirement_review_hours: 40,
      average_match_cycle_hours: 65,
      pending_requirement_count: 2,
      eligible_requirement_count: 4,
    },
    ai_evaluation: {
      total_candidates: 3,
      reviewed_candidates: 2,
      approved_candidates: 1,
      rejected_candidates: 1,
      adoption_rate: 50,
      average_score: 80,
      samples: [],
    },
    gap_distribution: [],
  })

  assert.deepEqual(highlights, [
    { key: 'assignment', label: '审核人覆盖率', value: 50, suffix: '%' },
    { key: 'coverage', label: '候选能力覆盖率', value: 75, suffix: '%' },
    { key: 'ai-adoption', label: 'AI 候选采纳率', value: 50, suffix: '%' },
    { key: 'quality', label: '平均数据质量', value: 82.5, suffix: '分' },
  ])
})
