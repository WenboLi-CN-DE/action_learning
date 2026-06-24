import { Alert, Button, Empty, Input, List, Space, Tag, Typography } from 'antd'
import { RobotOutlined } from '@ant-design/icons'
import type { LLMStructureResult } from '../types'

const { Text, Title } = Typography
const { TextArea } = Input

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
                        {field}
                      </Tag>
                    ))}
                  </Space>
                }
              />
            )}
            <List
              size="small"
              dataSource={Object.entries(result.fields).filter(([, value]) => value)}
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无结构化字段" /> }}
              renderItem={([key, value]) => (
                <List.Item>
                  <Text strong>{key}</Text>
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
