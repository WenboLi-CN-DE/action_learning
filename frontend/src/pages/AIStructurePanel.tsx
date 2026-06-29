import { Alert, Button, Empty, Input, List, Space, Tag, Typography } from 'antd'
import { RobotOutlined } from '@ant-design/icons'
import type { LLMStructureResult } from '../types'

const { Text, Title } = Typography
const { TextArea } = Input

const fieldLabels: Record<string, string> = {
  name: '能力名称',
  title: '需求标题',
  owner: '负责人',
  status: '状态',
  customer: '客户名称',
  contact: '联系人',
  urgency: '紧急度',
  description: '描述',
  business_line: '行业/业务线',
  industry: '行业/业务线',
  business_scenario: '业务场景',
  scenario: '业务场景',
  pain_points: '当前痛点',
  pain_point: '当前痛点',
  expected_capability: '期望能力',
  timeline_or_stage: '时间节点/阶段',
  current_solution: '现有方案',
  expected_value: '预期价值',
  core_capability: '核心能力',
  maturity: '成熟度',
  deliverable_form: '可交付形式',
  matchable_requirement_types: '可匹配需求类型',
  constraints: '限制条件',
  tag_ids: '标签',
}

const fieldOrder = [
  'name',
  'title',
  'customer',
  'contact',
  'owner',
  'status',
  'urgency',
  'description',
  'business_line',
  'business_scenario',
  'pain_points',
  'expected_capability',
  'timeline_or_stage',
  'current_solution',
  'expected_value',
  'core_capability',
  'maturity',
  'deliverable_form',
  'matchable_requirement_types',
  'constraints',
]

function labelOfField(field: string) {
  return fieldLabels[field] ?? field
}

function buildDisplayFields(fields: LLMStructureResult['fields']) {
  const entries = Object.entries(fields).filter(([, value]) => value)
  return entries.sort(([left], [right]) => {
    const leftIndex = fieldOrder.indexOf(left)
    const rightIndex = fieldOrder.indexOf(right)
    if (leftIndex === -1 && rightIndex === -1) return left.localeCompare(right)
    if (leftIndex === -1) return 1
    if (rightIndex === -1) return -1
    return leftIndex - rightIndex
  })
}

interface AIStructurePanelProps {
  title: string
  placeholder: string
  rawText: string
  result: LLMStructureResult | null
  loading: boolean
  error: string | null
  onRawTextChange: (value: string) => void
  onStructure: () => void
  onApply: () => void
}

export default function AIStructurePanel({
  title,
  placeholder,
  rawText,
  result,
  loading,
  error,
  onRawTextChange,
  onStructure,
  onApply,
}: AIStructurePanelProps) {
  const displayFields = result ? buildDisplayFields(result.fields) : []

  return (
    <div className="ai-structure-panel">
      <Space direction="vertical" size="middle" className="ai-structure-stack">
        <div>
          <Title level={5}>{title}</Title>
          <Text type="secondary">输入自然语言描述，AI 会整理字段并提示建议补充的信息。</Text>
        </div>
        <TextArea
          rows={4}
          value={rawText}
          placeholder={placeholder}
          onChange={(event) => onRawTextChange(event.target.value)}
        />
        <Space wrap>
          <Button icon={<RobotOutlined />} onClick={onStructure} loading={loading} disabled={!rawText.trim()}>
            AI 结构化
          </Button>
          <Button type="primary" onClick={onApply} disabled={!result}>
            应用到表单
          </Button>
        </Space>
        {error && <Alert type="error" showIcon message={error} />}
        {result && (
          <div className="ai-result">
            <Text type="secondary">模型：{result.model}</Text>
            {result.missing_fields.length > 0 && (
              <Alert
                type="warning"
                showIcon
                message="建议补充"
                description={
                  <Space size={[4, 4]} wrap>
                    {result.missing_fields.map((field) => (
                      <Tag key={field} color="gold">
                        {labelOfField(field)}
                      </Tag>
                    ))}
                  </Space>
                }
              />
            )}
            <List
              size="small"
              dataSource={displayFields}
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无结构化字段" /> }}
              renderItem={([key, value]) => (
                <List.Item>
                  <Text strong>{labelOfField(key)}</Text>
                  <Text>{value}</Text>
                </List.Item>
              )}
            />
            {result.follow_up_questions.length > 0 && (
              <Alert
                type="info"
                showIcon
                message="建议追问"
                description={
                  <ul className="ai-question-list">
                    {result.follow_up_questions.map((question) => (
                      <li key={question}>{question}</li>
                    ))}
                  </ul>
                }
              />
            )}
          </div>
        )}
      </Space>
    </div>
  )
}
