import { useEffect, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Empty,
  Form,
  Input,
  Layout,
  Popconfirm,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
  Upload,
} from 'antd'
import { ArrowLeftOutlined, DeleteOutlined, ReloadOutlined, SearchOutlined, UploadOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router'
import {
  deleteRAGDocument,
  fetchRAGDocuments,
  importRAGFile,
  ragQuery,
  rebuildRAGIndex,
} from '../services/api'
import { getRoleCapabilities } from '../auth/permissions'
import { useRoleStore } from '../auth/roleStore'
import type { RAGChunk, RAGDocumentItem, RAGQueryResult } from '../types'

const { Header, Content } = Layout
const { Title, Text, Paragraph } = Typography

const sourceTypeOptions = [
  { label: '全部', value: '' },
  { label: '能力/项目', value: 'project' },
  { label: '需求', value: 'requirement' },
]

export default function KnowledgeSearchPage() {
  const navigate = useNavigate()
  const role = useRoleStore((state) => state.role) ?? 'sales'
  const capabilities = getRoleCapabilities(role)
  const [importForm] = Form.useForm<{ source_type: string; tags?: string; owner_role?: string }>()
  const [question, setQuestion] = useState('')
  const [sourceType, setSourceType] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<RAGQueryResult | null>(null)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [importMessage, setImportMessage] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [documents, setDocuments] = useState<RAGDocumentItem[]>([])
  const [documentsLoading, setDocumentsLoading] = useState(false)
  const [rebuilding, setRebuilding] = useState(false)

  async function loadDocuments() {
    if (!capabilities.canManageKnowledge) return
    setDocumentsLoading(true)
    try {
      setDocuments(await fetchRAGDocuments())
    } catch (requestError) {
      setImportError(requestError instanceof Error ? requestError.message : '知识文档加载失败')
    } finally {
      setDocumentsLoading(false)
    }
  }

  useEffect(() => {
    if (!capabilities.canManageKnowledge) return
    let active = true
    Promise.resolve().then(async () => {
      if (!active) return
      setDocumentsLoading(true)
      try {
        const data = await fetchRAGDocuments()
        if (active) setDocuments(data)
      } catch (requestError) {
        if (active) {
          setImportError(requestError instanceof Error ? requestError.message : '知识文档加载失败')
        }
      } finally {
        if (active) setDocumentsLoading(false)
      }
    })
    return () => {
      active = false
    }
  }, [capabilities.canManageKnowledge])

  async function handleSearch() {
    const q = question.trim()
    if (!q) return
    setLoading(true)
    setError(null)
    try {
      const filters: Record<string, unknown> = {}
      if (sourceType) filters.source_type = sourceType
      const data = await ragQuery(q, 5, filters)
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '搜索失败')
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSearch()
    }
  }

  async function handleImport(values: { source_type: string; tags?: string; owner_role?: string }) {
    if (!importFile) {
      setImportError('请选择要导入的资料文件')
      return
    }
    setImporting(true)
    setImportError(null)
    setImportMessage(null)
    try {
      const data = await importRAGFile(importFile, {
        source_type: values.source_type,
        tags: values.tags,
        owner_role: values.owner_role,
      })
      setImportMessage(`已导入 ${data.title}，生成 ${data.chunk_count} 个知识片段`)
      setImportFile(null)
      importForm.resetFields()
      await loadDocuments()
    } catch (err) {
      setImportError(err instanceof Error ? err.message : '资料导入失败')
    } finally {
      setImporting(false)
    }
  }

  async function handleDeleteDocument(documentId: number) {
    try {
      await deleteRAGDocument(documentId)
      setImportMessage('知识文档及其索引已删除')
      await loadDocuments()
    } catch (requestError) {
      setImportError(requestError instanceof Error ? requestError.message : '知识文档删除失败')
    }
  }

  async function handleRebuild() {
    setRebuilding(true)
    setImportError(null)
    try {
      const result = await rebuildRAGIndex()
      setImportMessage(`索引已重建：${result.document_count} 份资料，${result.chunk_count} 个片段`)
      await loadDocuments()
    } catch (requestError) {
      setImportError(requestError instanceof Error ? requestError.message : '索引重建失败')
    } finally {
      setRebuilding(false)
    }
  }

  return (
    <Layout className="app-shell">
      <Header className="app-header">
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}>
            返回工作台
          </Button>
          <Title level={3} style={{ margin: 0, color: '#fff' }}>
            智能知识搜索
          </Title>
        </Space>
      </Header>

      <Content style={{ padding: '24px', maxWidth: 900, margin: '0 auto', width: '100%' }}>
        {capabilities.canManageKnowledge && <Card title="导入资料" style={{ marginBottom: 24 }}>
          <Form
            form={importForm}
            layout="vertical"
            initialValues={{ source_type: 'manual' }}
            onFinish={handleImport}
          >
            <Space align="end" wrap>
              <Form.Item label="资料文件" style={{ marginBottom: 0 }}>
                <Upload
                  accept=".txt,.md,.csv"
                  maxCount={1}
                  beforeUpload={(file) => {
                    setImportFile(file)
                    setImportError(null)
                    setImportMessage(null)
                    return false
                  }}
                  onRemove={() => setImportFile(null)}
                >
                  <Button icon={<UploadOutlined />}>选择文件</Button>
                </Upload>
              </Form.Item>
              <Form.Item name="source_type" label="来源类型" style={{ marginBottom: 0 }}>
                <Select
                  style={{ width: 140 }}
                  options={[
                    { label: '手动资料', value: 'manual' },
                    { label: '能力/项目', value: 'project' },
                    { label: '需求', value: 'requirement' },
                  ]}
                />
              </Form.Item>
              <Form.Item name="tags" label="标签" style={{ marginBottom: 0 }}>
                <Input style={{ width: 180 }} placeholder="如：楼宇,节能" />
              </Form.Item>
              <Form.Item name="owner_role" label="来源/角色" style={{ marginBottom: 0 }}>
                <Input style={{ width: 160 }} placeholder="如：市场资料" />
              </Form.Item>
              <Button type="primary" htmlType="submit" loading={importing} icon={<UploadOutlined />}>
                导入知识库
              </Button>
            </Space>
          </Form>
          {importMessage && <Alert type="success" title={importMessage} showIcon style={{ marginTop: 16 }} />}
          {importError && <Alert type="error" title={importError} showIcon style={{ marginTop: 16 }} />}
        </Card>}

        {capabilities.canManageKnowledge && (
          <Card
            title="知识文档管理"
            style={{ marginBottom: 24 }}
            extra={
              <Button icon={<ReloadOutlined />} loading={rebuilding} onClick={handleRebuild}>
                重建索引
              </Button>
            }
          >
            <Table
              rowKey="id"
              loading={documentsLoading}
              dataSource={documents}
              pagination={false}
              columns={[
                { title: '文档', dataIndex: 'title', key: 'title' },
                { title: '来源', dataIndex: 'source_type', key: 'source_type', render: (value) => <Tag>{value}</Tag> },
                { title: '片段', dataIndex: 'chunk_count', key: 'chunk_count', width: 80 },
                {
                  title: '导入时间',
                  dataIndex: 'created_at',
                  key: 'created_at',
                  render: (value) => new Date(value).toLocaleString(),
                },
                {
                  title: '操作',
                  key: 'action',
                  width: 90,
                  render: (_, record) => (
                    <Popconfirm title="删除该文档及其索引？" onConfirm={() => handleDeleteDocument(record.id)}>
                      <Button danger size="small" icon={<DeleteOutlined />}>删除</Button>
                    </Popconfirm>
                  ),
                },
              ]}
            />
          </Card>
        )}

        <Card style={{ marginBottom: 24 }}>
          <Space.Compact style={{ width: '100%' }}>
            <Select
              style={{ width: 140 }}
              value={sourceType}
              onChange={setSourceType}
              options={sourceTypeOptions}
            />
            <Input
              style={{ flex: 1 }}
              placeholder="输入问题，例如：有没有数据中心相关能力？"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              suffix={
                <Button
                  type="primary"
                  icon={<SearchOutlined />}
                  loading={loading}
                  onClick={handleSearch}
                >
                  搜索
                </Button>
              }
            />
          </Space.Compact>
        </Card>

        {error && <Alert type="error" title={error} showIcon style={{ marginBottom: 16 }} />}

        {loading && (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <Spin size="large" tip="正在检索知识库..." />
          </div>
        )}

        {!loading && result && (
          <>
            <Card title="AI 回答" style={{ marginBottom: 24 }}>
              <Paragraph style={{ whiteSpace: 'pre-wrap', fontSize: 15 }}>
                {result.answer}
              </Paragraph>
              {result.citations.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <Text type="secondary">引用来源：</Text>
                  <Space wrap style={{ marginTop: 4 }}>
                    {result.citations.map((c, idx) => (
                      <Tag key={c.chunk_id} color="blue">
                        [{idx + 1}] {c.title ?? '未知'}（{(c.score * 100).toFixed(0)}%）
                      </Tag>
                    ))}
                  </Space>
                </div>
              )}
            </Card>

            {result.retrieved_chunks.length > 0 && (
              <Card title={`检索到 ${result.retrieved_chunks.length} 条相关资料`}>
                {result.retrieved_chunks.map((chunk: RAGChunk, idx: number) => (
                  <Card
                    key={chunk.chunk_id}
                    size="small"
                    type="inner"
                    style={{ marginBottom: idx < result.retrieved_chunks.length - 1 ? 12 : 0 }}
                    title={
                      <Space>
                        <Text strong>[{idx + 1}] {chunk.title}</Text>
                        <Tag>{chunk.source_type === 'project' ? '能力' : chunk.source_type === 'requirement' ? '需求' : chunk.source_type}</Tag>
                        <Text type="secondary">相关度 {(chunk.score * 100).toFixed(0)}%</Text>
                      </Space>
                    }
                  >
                    <Paragraph
                      ellipsis={{ rows: 3, expandable: true }}
                      style={{ marginBottom: 4 }}
                    >
                      {chunk.text}
                    </Paragraph>
                    {chunk.tags.length > 0 && (
                      <Space size={4}>
                        {chunk.tags.map((tag) => (
                          <Tag key={tag} color="green">{tag}</Tag>
                        ))}
                      </Space>
                    )}
                  </Card>
                ))}
              </Card>
            )}

            {result.retrieved_chunks.length === 0 && !result.answer.includes('未检索到') && (
              <Empty description="未检索到相关资料" />
            )}
          </>
        )}

        {!loading && !result && !error && (
          <Empty
            description={
              <span>
                输入问题开始搜索<br />
                <Text type="secondary">支持自然语言提问，如"有没有楼宇相关的预研项目？"</Text>
              </span>
            }
          />
        )}
      </Content>
    </Layout>
  )
}
