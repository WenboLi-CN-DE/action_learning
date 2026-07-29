import type { PilotMetrics, PilotTaskResponse } from '../types'


export interface SummaryCard {
  key: string
  label: string
  value: number
  tone: 'default' | 'warning' | 'danger'
}

export interface MetricHighlight {
  key: string
  label: string
  value: number
  suffix: '%' | '分'
}

export function buildTaskSummary(tasks: PilotTaskResponse): SummaryCard[] {
  return [
    {
      key: 'total',
      label: '我的待办',
      value: tasks.total,
      tone: 'default',
    },
    {
      key: 'overdue',
      label: '已经逾期',
      value: tasks.overdue,
      tone: 'danger',
    },
    {
      key: 'due-soon',
      label: '12 小时内到期',
      value: tasks.due_soon,
      tone: 'warning',
    },
  ]
}

export function getTaskSlaPresentation(task: {
  overdue: boolean
  due_soon: boolean
  remaining_hours: number
}) {
  if (task.overdue) {
    return {
      label: `已逾期 ${Math.abs(task.remaining_hours)} 小时`,
      color: 'red',
    }
  }
  if (task.due_soon) {
    return {
      label: `${task.remaining_hours} 小时内到期`,
      color: 'gold',
    }
  }
  return {
    label: `剩余 ${task.remaining_hours} 小时`,
    color: 'green',
  }
}

export function buildManagementHighlights(metrics: PilotMetrics): MetricHighlight[] {
  return [
    {
      key: 'assignment',
      label: '审核人覆盖率',
      value: metrics.workflow.reviewer_assignment_rate,
      suffix: '%',
    },
    {
      key: 'coverage',
      label: '候选能力覆盖率',
      value: metrics.workflow.candidate_coverage_rate,
      suffix: '%',
    },
    {
      key: 'ai-adoption',
      label: 'AI 候选采纳率',
      value: metrics.ai_evaluation.adoption_rate,
      suffix: '%',
    },
    {
      key: 'quality',
      label: '平均数据质量',
      value: metrics.data_quality.average_score,
      suffix: '分',
    },
  ]
}
