import { useState } from 'react'
import { Button, Card, Empty, Input, Modal, Popconfirm, Space, Table, Tag, Typography, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'

import type { RoleId } from '../auth/permissions'
import { reviewMatch, reviewRequirement } from '../services/api'
import type { MatchItem, RequirementItem } from '../types'


const { Text, Title } = Typography
const { TextArea } = Input

type MatchReviewAction = 'technical_approve' | 'technical_reject' | 'final_approve' | 'final_reject'
type NoteAction =
  | { target: 'requirement'; id: number; action: 'return'; title: string }
  | { target: 'match'; id: number; action: 'technical_reject' | 'final_reject'; title: string }

interface ReviewQueueProps {
  requirements: RequirementItem[]
  matches: MatchItem[]
  reviewer: string
  role: RoleId
  onReviewed: () => Promise<void>
  onOpenRequirement: (requirement: RequirementItem) => void
}

export default function ReviewQueue({
  requirements,
  matches,
  reviewer,
  role,
  onReviewed,
  onOpenRequirement,
}: ReviewQueueProps) {
  const [workingKey, setWorkingKey] = useState<string | null>(null)
  const [noteAction, setNoteAction] = useState<NoteAction | null>(null)
  const [reviewNote, setReviewNote] = useState('')
  const [messageApi, contextHolder] = message.useMessage()
  const isAdmin = role === 'admin'
  const pendingRequirements = requirements.filter((item) => item.status === 'pending_review')
  const assessmentRequirements = requirements.filter((item) => ['accepted', 'matching'].includes(item.status))
  const technicalPendingMatches = matches.filter((item) => ['pending', 'technical_pending'].includes(item.review_status))
  const finalPendingMatches = matches.filter((item) => item.review_status === 'final_pending')

  async function handleRequirement(id: number, action: 'approve' | 'return', note?: string) {
    const key = `requirement-${id}`
    setWorkingKey(key)
    try {
      await reviewRequirement(id, { action, reviewer, note })
      await onReviewed()
      messageApi.success(action === 'approve' ? '需求已受理并进入关联编排' : '需求已退回补充')
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : '需求审核失败')
    } finally {
      setWorkingKey(null)
    }
  }

  async function handleMatch(id: number, action: MatchReviewAction, note?: string) {
    const key = `match-${id}`
    setWorkingKey(key)
    try {
      await reviewMatch(id, { action, reviewer, note })
      await onReviewed()
      const successMessages: Record<MatchReviewAction, string> = {
        technical_approve: '技术确认完成，已提交管理员最终批准',
        technical_reject: '该关联已被技术拒绝',
        final_approve: '关联已最终批准并正式生效',
        final_reject: '该关联未通过最终批准',
      }
      messageApi.success(successMessages[action])
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : '关联审核失败')
    } finally {
      setWorkingKey(null)
    }
  }

  async function submitNoteAction() {
    if (!noteAction || !reviewNote.trim()) return
    const action = noteAction
    const note = reviewNote.trim()
    setNoteAction(null)
    setReviewNote('')
    if (action.target === 'requirement') {
      await handleRequirement(action.id, action.action, note)
    } else {
      await handleMatch(action.id, action.action, note)
    }
  }

  const matchColumns: ColumnsType<MatchItem> = [
    { title: '需求', dataIndex: ['requirement', 'title'], key: 'requirement' },
    { title: '能力', dataIndex: ['project', 'name'], key: 'project' },
    {
      title: '来源',
      dataIndex: 'source',
      key: 'source',
      render: (value: string) => <Tag>{value === 'ai' ? 'AI 推荐' : '人工编排'}</Tag>,
    },
    {
      title: '发起人',
      dataIndex: 'created_by',
      key: 'created_by',
      render: (value: string | null) => value || '-',
    },
    {
      title: '说明',
      dataIndex: 'note',
      key: 'note',
      render: (value: string | null) => <Text type="secondary">{value || '-'}</Text>,
    },
  ]

  return (
    <div className="review-queue">
      {contextHolder}
      <div className="review-flow-summary">
        <div>
          <Title level={3}>{isAdmin ? '管理审核中心' : '匹配到的需求'}</Title>
          <Text type="secondary">
            {isAdmin
              ? '审核销售需求、编排能力关联，并对研发确认后的关联执行最终批准。'
              : '查看已受理需求的 AI 匹配，并对管理员发起的需求—能力关联进行技术可行性确认。'}
          </Text>
        </div>
        <Space wrap>
          {isAdmin && <Tag color="gold">待审核需求 {pendingRequirements.length}</Tag>}
          {isAdmin ? (
            <>
              <Tag color="blue">待技术确认 {technicalPendingMatches.length}</Tag>
              <Tag color="purple">待最终批准 {finalPendingMatches.length}</Tag>
            </>
          ) : (
            <Tag color="purple">待管理确认 {finalPendingMatches.length}</Tag>
          )}
        </Space>
      </div>

      {isAdmin && (
        <Card
          title={<Title level={4}>1. 待审核需求</Title>}
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
                  title: '审核负责人',
                  dataIndex: 'assigned_reviewer',
                  key: 'assigned_reviewer',
                  render: (value) => value ? <Tag color="blue">{value}</Tag> : <Tag color="gold">待指派</Tag>,
                },
                {
                  title: '操作',
                  key: 'action',
                  render: (_, record) => {
                    const assignedElsewhere = Boolean(
                      record.assigned_reviewer && record.assigned_reviewer !== reviewer,
                    )
                    return (
                      <Space>
                        <Button size="small" onClick={() => onOpenRequirement(record)}>
                          查看 / 指派
                        </Button>
                        <Popconfirm title="确认受理该需求并进入关联编排？" onConfirm={() => handleRequirement(record.id, 'approve')}>
                          <Button
                            type="primary"
                            size="small"
                            disabled={assignedElsewhere}
                            loading={workingKey === `requirement-${record.id}`}
                          >
                            受理
                          </Button>
                        </Popconfirm>
                        <Button
                          size="small"
                          danger
                          disabled={assignedElsewhere}
                          onClick={() => setNoteAction({
                            target: 'requirement',
                            id: record.id,
                            action: 'return',
                            title: `退回需求：${record.title}`,
                          })}
                        >
                          退回补充
                        </Button>
                      </Space>
                    )
                  },
                },
              ]}
            />
          )}
        </Card>
      )}

      {!isAdmin && (
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
                {
                  title: '操作',
                  key: 'action',
                  render: (_, record) => (
                    <Button size="small" type="primary" onClick={() => onOpenRequirement(record)}>
                      查看并分析
                    </Button>
                  ),
                },
              ]}
            />
          )}
        </Card>
      )}

      {!isAdmin && (
        <Card
          title={<Title level={4}>2. 待技术确认关联</Title>}
          extra={<Tag color="blue">{technicalPendingMatches.length} 条</Tag>}
        >
          {technicalPendingMatches.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无待技术确认关联" />
          ) : (
            <Table
              rowKey="id"
              pagination={false}
              dataSource={technicalPendingMatches}
              columns={[
                ...matchColumns,
                {
                  title: '操作',
                  key: 'action',
                  render: (_, record) => (
                    <Space>
                      <Popconfirm title="确认技术可行并提交管理员最终批准？" onConfirm={() => handleMatch(record.id, 'technical_approve')}>
                        <Button type="primary" size="small" loading={workingKey === `match-${record.id}`}>
                          技术确认
                        </Button>
                      </Popconfirm>
                      <Button
                        size="small"
                        danger
                        onClick={() => setNoteAction({
                          target: 'match',
                          id: record.id,
                          action: 'technical_reject',
                          title: `技术拒绝：${record.requirement.title} → ${record.project.name}`,
                        })}
                      >
                        拒绝
                      </Button>
                    </Space>
                  ),
                },
              ]}
            />
          )}
        </Card>
      )}

      {isAdmin && (
        <Card
          title={<Title level={4}>2. 等待研发技术确认</Title>}
          extra={<Tag color="blue">{technicalPendingMatches.length} 条</Tag>}
        >
          {technicalPendingMatches.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无等待研发确认的关联" />
          ) : (
            <Table rowKey="id" pagination={false} dataSource={technicalPendingMatches} columns={matchColumns} />
          )}
        </Card>
      )}

      {isAdmin && (
        <Card
          title={<Title level={4}>3. 待最终批准关联</Title>}
          extra={<Tag color="purple">{finalPendingMatches.length} 条</Tag>}
        >
          {finalPendingMatches.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无待最终批准关联" />
          ) : (
            <Table
              rowKey="id"
              pagination={false}
              dataSource={finalPendingMatches}
              columns={[
                ...matchColumns,
                {
                  title: '技术确认人',
                  dataIndex: 'reviewed_by',
                  key: 'reviewed_by',
                  render: (value) => value || '-',
                },
                {
                  title: '操作',
                  key: 'action',
                  render: (_, record) => (
                    <Space>
                      <Popconfirm title="确认该关联正式生效？" onConfirm={() => handleMatch(record.id, 'final_approve')}>
                        <Button type="primary" size="small" loading={workingKey === `match-${record.id}`}>
                          最终批准
                        </Button>
                      </Popconfirm>
                      <Button
                        size="small"
                        danger
                        onClick={() => setNoteAction({
                          target: 'match',
                          id: record.id,
                          action: 'final_reject',
                          title: `最终拒绝：${record.requirement.title} → ${record.project.name}`,
                        })}
                      >
                        拒绝
                      </Button>
                    </Space>
                  ),
                },
              ]}
            />
          )}
        </Card>
      )}

      <Modal
        title={noteAction?.title}
        open={noteAction !== null}
        okText="确认提交"
        cancelText="取消"
        confirmLoading={workingKey !== null}
        okButtonProps={{ danger: true, disabled: !reviewNote.trim() }}
        onOk={() => void submitNoteAction()}
        onCancel={() => {
          setNoteAction(null)
          setReviewNote('')
        }}
      >
        <Text type="secondary">审核意见将写入不可省略的流程记录，请明确说明原因和后续动作。</Text>
        <TextArea
          rows={4}
          value={reviewNote}
          placeholder="请输入审核意见"
          onChange={(event) => setReviewNote(event.target.value)}
          style={{ marginTop: 12 }}
        />
      </Modal>
    </div>
  )
}
