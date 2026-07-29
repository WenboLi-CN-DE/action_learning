import { Button, Card, Empty, Progress, Space, Statistic, Table, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'

import type {
  DataQualityRecord,
  PilotAISample,
  PilotMetrics,
  PilotTaskItem,
  PilotTaskResponse,
} from '../types'
import {
  buildManagementHighlights,
  buildTaskSummary,
  getTaskSlaPresentation,
} from './pilotInsights'


const { Text, Title } = Typography

const urgencyLabels: Record<string, string> = {
  high: '高',
  medium: '中',
  low: '低',
}

const urgencyColors: Record<string, string> = {
  high: 'red',
  medium: 'gold',
  low: 'blue',
}

interface PersonalTaskCenterProps {
  data: PilotTaskResponse | null
  loading: boolean
  onOpenTask: (task: PilotTaskItem) => void
}

export function PersonalTaskCenter({
  data,
  loading,
  onOpenTask,
}: PersonalTaskCenterProps) {
  const summary = data
    ? buildTaskSummary(data)
    : [
        { key: 'total', label: '我的待办', value: 0, tone: 'default' as const },
        { key: 'overdue', label: '已经逾期', value: 0, tone: 'danger' as const },
        { key: 'due-soon', label: '12 小时内到期', value: 0, tone: 'warning' as const },
      ]
  const columns: ColumnsType<PilotTaskItem> = [
    {
      title: '优先级',
      dataIndex: 'urgency',
      key: 'urgency',
      width: 88,
      render: (value: string) => (
        <Tag color={urgencyColors[value] ?? 'default'}>
          {urgencyLabels[value] ?? value}
        </Tag>
      ),
    },
    {
      title: '待办事项',
      key: 'task',
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{record.title}</Text>
          <Text type="secondary">{record.subtitle}</Text>
        </Space>
      ),
    },
    {
      title: 'SLA',
      key: 'sla',
      width: 150,
      render: (_, record) => {
        const presentation = getTaskSlaPresentation(record)
        return <Tag color={presentation.color}>{presentation.label}</Tag>
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 130,
      render: (_, record) => (
        <Button type="link" onClick={() => onOpenTask(record)}>
          {record.action_label}
        </Button>
      ),
    },
  ]

  return (
    <Card className="pilot-task-center" loading={loading}>
      <div className="pilot-section-heading">
        <div>
          <Title level={3}>个人待办中心</Title>
          <Text type="secondary">按责任人聚合当前需要处理的事项，并显示 SLA 风险。</Text>
        </div>
        {data && data.overdue > 0 && <Tag color="red">{data.overdue} 项已逾期</Tag>}
      </div>
      <div className="pilot-summary-grid">
        {summary.map((item) => (
          <div className={`pilot-summary-card ${item.tone}`} key={item.key}>
            <Statistic title={item.label} value={item.value} />
          </div>
        ))}
      </div>
      {data && data.items.length > 0 ? (
        <Table
          rowKey={(record) => `${record.target_type}-${record.target_id}-${record.task_type}`}
          columns={columns}
          dataSource={data.items}
          pagination={false}
          size="small"
          scroll={{ x: 720 }}
        />
      ) : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="当前没有需要你处理的事项"
        />
      )}
    </Card>
  )
}

interface ManagementPilotDashboardProps {
  metrics: PilotMetrics | null
  loading: boolean
  onOpenQualityRecord: (record: DataQualityRecord) => void
}

export function ManagementPilotDashboard({
  metrics,
  loading,
  onOpenQualityRecord,
}: ManagementPilotDashboardProps) {
  if (!metrics) {
    return <Card loading={loading} className="management-pilot-dashboard" />
  }
  const highlights = buildManagementHighlights(metrics)
  const qualityColumns: ColumnsType<DataQualityRecord> = [
    {
      title: '对象',
      dataIndex: 'target_type',
      key: 'target_type',
      width: 90,
      render: (value: DataQualityRecord['target_type']) => (
        <Tag>{value === 'requirement' ? '需求' : '能力'}</Tag>
      ),
    },
    { title: '名称', dataIndex: 'title', key: 'title' },
    {
      title: '质量分',
      dataIndex: 'score',
      key: 'score',
      width: 90,
      render: (value: number) => (
        <Tag color={value < 60 ? 'red' : 'gold'}>{value} 分</Tag>
      ),
    },
    {
      title: '需要补充',
      dataIndex: 'issues',
      key: 'issues',
      render: (issues: string[]) => issues.join('、'),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Button type="link" onClick={() => onOpenQualityRecord(record)}>
          查看详情
        </Button>
      ),
    },
  ]
  const sampleColumns: ColumnsType<PilotAISample> = [
    { title: '需求', dataIndex: 'requirement_title', key: 'requirement' },
    { title: '候选能力', dataIndex: 'project_name', key: 'project' },
    {
      title: 'AI 分数',
      dataIndex: 'score',
      key: 'score',
      width: 90,
      render: (value: number | null) => value ?? '-',
    },
    {
      title: '人工结论',
      dataIndex: 'outcome',
      key: 'outcome',
      width: 110,
      render: (value: string) => (
        <Tag color={value === '已采纳' ? 'green' : value === '未采纳' ? 'red' : 'blue'}>
          {value}
        </Tag>
      ),
    },
  ]

  return (
    <section className="management-pilot-dashboard">
      <div className="pilot-section-heading">
        <div>
          <Title level={3}>v2.1 试运行指标</Title>
          <Text type="secondary">衡量责任覆盖、处理效率、数据质量和 AI 候选效果。</Text>
        </div>
        <Tag color="green">最近更新 {new Date(metrics.generated_at).toLocaleString()}</Tag>
      </div>

      <div className="pilot-highlight-grid">
        {highlights.map((item) => (
          <Card key={item.key}>
            <Statistic title={item.label} value={item.value} suffix={item.suffix} />
            <Progress
              percent={item.value}
              showInfo={false}
              strokeColor={item.value >= 80 ? '#3dcd58' : item.value >= 60 ? '#d9a300' : '#d9363e'}
            />
          </Card>
        ))}
      </div>

      <div className="pilot-duration-grid">
        <Card>
          <Statistic
            title="平均需求审核周期"
            value={metrics.workflow.average_requirement_review_hours}
            suffix="小时"
          />
          <Text type="secondary">目标：48 小时内完成</Text>
        </Card>
        <Card>
          <Statistic
            title="平均匹配确认周期"
            value={metrics.workflow.average_match_cycle_hours}
            suffix="小时"
          />
          <Text type="secondary">从候选创建到最终结论</Text>
        </Card>
        <Card>
          <Statistic
            title="低质量数据"
            value={metrics.data_quality.low_quality_count}
            suffix="条"
          />
          <Text type="secondary">低于 80 分，需要业务责任人补充</Text>
        </Card>
        <Card>
          <Statistic
            title="AI 已评测样例"
            value={metrics.ai_evaluation.reviewed_candidates}
            suffix={`/ ${metrics.ai_evaluation.total_candidates}`}
          />
          <Text type="secondary">目标：累计至少 10–20 组真实样例</Text>
        </Card>
      </div>

      <Card title="数据质量待改进清单" className="pilot-detail-card">
        <Table
          rowKey={(record) => `${record.target_type}-${record.target_id}`}
          columns={qualityColumns}
          dataSource={metrics.data_quality.records}
          pagination={{ pageSize: 6, hideOnSinglePage: true }}
          size="small"
          scroll={{ x: 720 }}
        />
      </Card>

      <Card title="AI 候选人工评测样例" className="pilot-detail-card">
        <Table
          rowKey="match_id"
          columns={sampleColumns}
          dataSource={metrics.ai_evaluation.samples}
          pagination={{ pageSize: 6, hideOnSinglePage: true }}
          size="small"
          scroll={{ x: 620 }}
        />
        <div className="pilot-gap-list">
          <Text strong>高频能力缺口：</Text>
          {metrics.gap_distribution.length > 0 ? (
            metrics.gap_distribution.map((item) => (
              <Tag key={item.gap} color="gold">
                {item.gap} · {item.count}
              </Tag>
            ))
          ) : (
            <Text type="secondary">暂无已记录缺口</Text>
          )}
        </div>
      </Card>
    </section>
  )
}
