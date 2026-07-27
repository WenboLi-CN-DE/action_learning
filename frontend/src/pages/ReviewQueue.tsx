import { useState } from 'react'
import { Button, Card, Empty, Popconfirm, Space, Table, Tag, Typography, message } from 'antd'

import { reviewMatch, reviewRequirement } from '../services/api'
import type { MatchItem, RequirementItem } from '../types'


const { Text, Title } = Typography

interface ReviewQueueProps {
  requirements: RequirementItem[]
  matches: MatchItem[]
  reviewer: string
  canReviewRequirements: boolean
  onReviewed: () => Promise<void>
}

export default function ReviewQueue({
  requirements,
  matches,
  reviewer,
  canReviewRequirements,
  onReviewed,
}: ReviewQueueProps) {
  const [workingKey, setWorkingKey] = useState<string | null>(null)
  const [messageApi, contextHolder] = message.useMessage()
  const pendingRequirements = requirements.filter((item) => item.status === 'pending_review')
  const assessmentRequirements = requirements.filter((item) => ['accepted', 'matching'].includes(item.status))
  const pendingMatches = matches.filter((item) => item.review_status === 'pending')

  async function handleRequirement(id: number, action: 'approve' | 'return') {
    const key = `requirement-${id}`
    setWorkingKey(key)
    try {
      await reviewRequirement(id, { action, reviewer })
      await onReviewed()
      messageApi.success(action === 'approve' ? '需求已受理' : '需求已退回草稿')
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : '需求审核失败')
    } finally {
      setWorkingKey(null)
    }
  }

  async function handleMatch(id: number, action: 'approve' | 'reject') {
    const key = `match-${id}`
    setWorkingKey(key)
    try {
      await reviewMatch(id, { action, reviewer })
      await onReviewed()
      messageApi.success(action === 'approve' ? '匹配已确认生效' : '匹配已拒绝')
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : '匹配审核失败')
    } finally {
      setWorkingKey(null)
    }
  }

  return (
    <div className="review-queue">
      {contextHolder}
      {canReviewRequirements && (
        <Card
          title={<Title level={4}>待审核需求</Title>}
          extra={<Tag color="gold">{pendingRequirements.length} 条</Tag>}
        >
          {pendingRequirements.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无待审核需求" />
          ) : (
            <Table
              rowKey="id"
              pagination={false}
              dataSource={pendingRequirements}
              columns={[
                { title: '需求', dataIndex: 'title', key: 'title' },
                { title: '客户', dataIndex: 'customer', key: 'customer' },
                { title: '提交人', dataIndex: 'submitted_by', key: 'submitted_by', render: (value) => value || '-' },
                {
                  title: '操作',
                  key: 'action',
                  render: (_, record) => (
                    <Space>
                      <Popconfirm title="确认受理该需求？" onConfirm={() => handleRequirement(record.id, 'approve')}>
                        <Button type="primary" size="small" loading={workingKey === `requirement-${record.id}`}>
                          受理
                        </Button>
                      </Popconfirm>
                      <Popconfirm title="确认退回补充信息？" onConfirm={() => handleRequirement(record.id, 'return')}>
                        <Button size="small" danger>退回</Button>
                      </Popconfirm>
                    </Space>
                  ),
                },
              ]}
            />
          )}
        </Card>
      )}

      {!canReviewRequirements && (
        <Card
          title={<Title level={4}>待评估需求收件箱</Title>}
          extra={<Tag color="gold">{assessmentRequirements.length} 条</Tag>}
        >
          {assessmentRequirements.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无待评估需求" />
          ) : (
            <Table
              rowKey="id"
              pagination={false}
              dataSource={assessmentRequirements}
              columns={[
                { title: '需求', dataIndex: 'title', key: 'title' },
                { title: '客户', dataIndex: 'customer', key: 'customer' },
                {
                  title: '状态',
                  dataIndex: 'status',
                  key: 'status',
                  render: (value) => <Tag>{value === 'matching' ? '匹配中' : '已受理'}</Tag>,
                },
                { title: '需求描述', dataIndex: 'description', key: 'description', ellipsis: true },
              ]}
            />
          )}
        </Card>
      )}

      <Card
        title={<Title level={4}>待确认匹配</Title>}
        extra={<Tag color="blue">{pendingMatches.length} 条</Tag>}
      >
        {pendingMatches.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无待确认匹配" />
        ) : (
          <Table
            rowKey="id"
            pagination={false}
            dataSource={pendingMatches}
            columns={[
              { title: '需求', dataIndex: ['requirement', 'title'], key: 'requirement' },
              { title: '能力', dataIndex: ['project', 'name'], key: 'project' },
              {
                title: '来源',
                dataIndex: 'source',
                key: 'source',
                render: (value) => <Tag>{value === 'ai' ? 'AI 推荐' : '人工匹配'}</Tag>,
              },
              {
                title: '说明',
                dataIndex: 'note',
                key: 'note',
                render: (value) => <Text type="secondary">{value || '-'}</Text>,
              },
              {
                title: '操作',
                key: 'action',
                render: (_, record) => (
                  <Space>
                    <Popconfirm title="确认该匹配生效？" onConfirm={() => handleMatch(record.id, 'approve')}>
                      <Button type="primary" size="small" loading={workingKey === `match-${record.id}`}>
                        确认
                      </Button>
                    </Popconfirm>
                    <Popconfirm title="确认拒绝该匹配？" onConfirm={() => handleMatch(record.id, 'reject')}>
                      <Button size="small" danger>拒绝</Button>
                    </Popconfirm>
                  </Space>
                ),
              },
            ]}
          />
        )}
      </Card>
    </div>
  )
}
