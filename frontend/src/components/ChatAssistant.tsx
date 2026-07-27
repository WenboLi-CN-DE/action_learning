import { useMemo, useState } from 'react'
import { MessageOutlined, SendOutlined, SnippetsOutlined } from '@ant-design/icons'
import { Alert, Button, Drawer, Empty, FloatButton, Input, Space, Spin, Tag, Typography, message } from 'antd'
import { useNavigate } from 'react-router'

import { getRoleCapabilities } from '../auth/permissions'
import { useRoleStore } from '../auth/roleStore'
import { chatWithKnowledge, structureRequirement } from '../services/api'
import { loadLLMSettings } from '../services/llmSettings'
import { useAssistantStore } from '../stores/assistantStore'
import type { ChatMessage, RAGCitation } from '../types'


const { Paragraph, Text } = Typography

export default function ChatAssistant() {
  const navigate = useNavigate()
  const role = useRoleStore((state) => state.role) ?? 'sales'
  const capabilities = getRoleCapabilities(role)
  const setRequirementDraft = useAssistantStore((state) => state.setRequirementDraft)
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [citations, setCitations] = useState<RAGCitation[]>([])
  const [loading, setLoading] = useState(false)
  const [draftLoading, setDraftLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [messageApi, contextHolder] = message.useMessage()
  const lastUserMessage = useMemo(
    () => [...messages].reverse().find((item) => item.role === 'user')?.content,
    [messages],
  )

  async function sendMessage() {
    const content = input.trim()
    if (!content || loading) return
    const nextMessages = [...messages, { role: 'user' as const, content }]
    setMessages(nextMessages)
    setInput('')
    setLoading(true)
    setError(null)
    try {
      const result = await chatWithKnowledge(nextMessages, loadLLMSettings())
      setMessages([...nextMessages, { role: 'assistant', content: result.answer }])
      setCitations(result.citations)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '助手回答失败')
    } finally {
      setLoading(false)
    }
  }

  async function createRequirementDraft() {
    if (!lastUserMessage || !capabilities.canCreateRequirement) return
    setDraftLoading(true)
    try {
      const draft = await structureRequirement(lastUserMessage, loadLLMSettings())
      setRequirementDraft(draft)
      setOpen(false)
      navigate('/')
      messageApi.success('已生成需求草稿，请在需求池检查后提交')
    } catch (requestError) {
      messageApi.error(requestError instanceof Error ? requestError.message : '需求草稿生成失败')
    } finally {
      setDraftLoading(false)
    }
  }

  return (
    <>
      {contextHolder}
      <FloatButton
        type="primary"
        icon={<MessageOutlined />}
        aria-label="打开 AI 工坊助手"
        tooltip="AI 需求助手"
        onClick={() => setOpen(true)}
      />
      <Drawer
        title="AI 工坊助手"
        open={open}
        onClose={() => setOpen(false)}
        size={460}
        extra={
          <Button
            icon={<SnippetsOutlined />}
            disabled={!lastUserMessage || !capabilities.canCreateRequirement}
            loading={draftLoading}
            onClick={createRequirementDraft}
          >
            生成需求草稿
          </Button>
        }
      >
        <Alert
          type="info"
          showIcon
          title="回答基于平台知识库，并显示引用来源"
          style={{ marginBottom: 16 }}
        />
        <div className="chat-message-list">
          {messages.length === 0 && (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="可以询问现有能力、客户场景或平台使用方法"
            />
          )}
          {messages.map((item, index) => (
            <div className={`chat-message ${item.role}`} key={`${item.role}-${index}`}>
              <Text strong>{item.role === 'user' ? '你' : 'AI 助手'}</Text>
              <Paragraph>{item.content}</Paragraph>
            </div>
          ))}
          {loading && <Spin size="small" tip="正在检索知识库..." />}
        </div>
        {citations.length > 0 && (
          <Space wrap className="chat-citations">
            {citations.map((citation, index) => (
              <Tag color="blue" key={citation.chunk_id}>
                [{index + 1}] {citation.title ?? '知识资料'}
              </Tag>
            ))}
          </Space>
        )}
        {error && <Alert type="error" showIcon title={error} style={{ marginBottom: 12 }} />}
        <Space.Compact style={{ width: '100%' }}>
          <Input.TextArea
            autoSize={{ minRows: 2, maxRows: 5 }}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onPressEnter={(event) => {
              if (!event.shiftKey) {
                event.preventDefault()
                sendMessage()
              }
            }}
            placeholder="例如：我们有哪些数据中心节能能力？"
          />
          <Button type="primary" icon={<SendOutlined />} loading={loading} onClick={sendMessage}>
            发送
          </Button>
        </Space.Compact>
      </Drawer>
    </>
  )
}
