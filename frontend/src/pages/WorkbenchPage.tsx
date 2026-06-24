import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Descriptions,
  Divider,
  Drawer,
  Empty,
  Form,
  Input,
  Layout,
  Progress,
  Select,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag as AntTag,
  Typography,
  message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { EditOutlined, EyeOutlined, LinkOutlined, PlusOutlined, ReloadOutlined, SettingOutlined } from '@ant-design/icons'
import {
  createComment,
  createMatch,
  createProject,
  createRequirement,
  createTag,
  fetchComments,
  fetchLLMStatus,
  fetchMatches,
  fetchProjects,
  fetchRequirements,
  fetchTags,
  structureProject,
  structureRequirement,
  updateProject,
  updateRequirement,
} from '../services/api'
import { clearLLMSettings, loadLLMSettings, saveLLMSettings } from '../services/llmSettings'
import type {
  CommentItem,
  CommentPayload,
  LLMSettings,
  LLMStatus,
  LLMStructureResult,
  MatchItem,
  MatchPayload,
  ProjectItem,
  ProjectPayload,
  RequirementItem,
  RequirementPayload,
  TagItem,
  TagPayload,
} from '../types'
import AIStructurePanel from './AIStructurePanel'
import {
  buildProjectDescription,
  buildRequirementDescription,
  getFieldValue,
  normalizeProjectStatus,
  normalizeRequirementStatus,
  normalizeUrgency,
} from './aiStructureMapping'
import { buildDashboardStats, filterDashboardDataByTag } from './dashboardStats'
import schneiderLogo from '../assets/schneider-electric-cn-logo.png'

const { Header, Content } = Layout
const { Title, Text } = Typography
const { TextArea } = Input

const projectStatusOptions = [
  { label: '预研中', value: 'researching' },
  { label: '可演示', value: 'demo_ready' },
  { label: '已交付', value: 'delivered' },
  { label: '暂停', value: 'paused' },
]

const requirementStatusOptions = [
  { label: '新需求', value: 'new' },
  { label: '评估中', value: 'reviewing' },
  { label: '已匹配', value: 'matched' },
  { label: '关闭', value: 'closed' },
]

const urgencyOptions = [
  { label: '高', value: 'high' },
  { label: '中', value: 'medium' },
  { label: '低', value: 'low' },
]

const coverageOptions = [
  { label: '已覆盖', value: 'covered' },
  { label: '部分覆盖', value: 'partial' },
  { label: '未覆盖', value: 'uncovered' },
]

const tagCategoryOptions = [
  { label: '行业', value: 'industry' },
  { label: '业务线', value: 'business' },
  { label: '技术', value: 'technology' },
  { label: '通用', value: 'general' },
]

function renderTags(tags: TagItem[]) {
  if (tags.length === 0) return <Text type="secondary">-</Text>
  return (
    <Space size={[4, 4]} wrap>
      {tags.map((tag) => (
        <AntTag key={tag.id} color="green">
          {tag.name}
        </AntTag>
      ))}
    </Space>
  )
}

function labelOf(options: { label: string; value: string }[], value: string) {
  return options.find((option) => option.value === value)?.label ?? value
}

type DetailTarget = { type: 'project'; item: ProjectItem } | { type: 'requirement'; item: RequirementItem }

export default function WorkbenchPage() {
  const [projects, setProjects] = useState<ProjectItem[]>([])
  const [requirements, setRequirements] = useState<RequirementItem[]>([])
  const [tags, setTags] = useState<TagItem[]>([])
  const [matches, setMatches] = useState<MatchItem[]>([])
  const [comments, setComments] = useState<CommentItem[]>([])
  const [detailTarget, setDetailTarget] = useState<DetailTarget | null>(null)
  const [editingProject, setEditingProject] = useState<ProjectItem | null>(null)
  const [editingRequirement, setEditingRequirement] = useState<RequirementItem | null>(null)
  const [selectedDashboardTagId, setSelectedDashboardTagId] = useState<number | null>(null)
  const [selectedProjectTagId, setSelectedProjectTagId] = useState<number | null>(null)
  const [selectedRequirementTagId, setSelectedRequirementTagId] = useState<number | null>(null)
  const [llmSettingsOpen, setLLMSettingsOpen] = useState(false)
  const [llmSettings, setLLMSettings] = useState<LLMSettings | null>(() => loadLLMSettings())
  const [llmStatus, setLLMStatus] = useState<LLMStatus | null>(null)
  const [projectRawText, setProjectRawText] = useState('')
  const [requirementRawText, setRequirementRawText] = useState('')
  const [projectAIResult, setProjectAIResult] = useState<LLMStructureResult | null>(null)
  const [requirementAIResult, setRequirementAIResult] = useState<LLMStructureResult | null>(null)
  const [projectAIError, setProjectAIError] = useState<string | null>(null)
  const [requirementAIError, setRequirementAIError] = useState<string | null>(null)
  const [projectAILoading, setProjectAILoading] = useState(false)
  const [requirementAILoading, setRequirementAILoading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [messageApi, contextHolder] = message.useMessage()
  const [projectForm] = Form.useForm<ProjectPayload>()
  const [requirementForm] = Form.useForm<RequirementPayload>()
  const [tagForm] = Form.useForm<TagPayload>()
  const [matchForm] = Form.useForm<MatchPayload>()
  const [commentForm] = Form.useForm<Pick<CommentPayload, 'author' | 'content'>>()
  const [editProjectForm] = Form.useForm<ProjectPayload>()
  const [editRequirementForm] = Form.useForm<RequirementPayload>()
  const [llmSettingsForm] = Form.useForm<LLMSettings>()

  const tagOptions = useMemo(
    () => tags.map((tag) => ({ label: `${tag.name} / ${labelOf(tagCategoryOptions, tag.category)}`, value: tag.id })),
    [tags],
  )

  const projectOptions = useMemo(
    () => projects.map((project) => ({ label: project.name, value: project.id })),
    [projects],
  )

  const requirementOptions = useMemo(
    () => requirements.map((requirement) => ({ label: requirement.title, value: requirement.id })),
    [requirements],
  )

  const dashboardTagOptions = useMemo(
    () =>
      tags
        .filter((tag) => tag.category === 'industry' || tag.category === 'business')
        .map((tag) => ({ label: `${tag.name} / ${labelOf(tagCategoryOptions, tag.category)}`, value: tag.id })),
    [tags],
  )

  const dashboardData = useMemo(
    () =>
      filterDashboardDataByTag({
        selectedTagId: selectedDashboardTagId,
        projects,
        requirements,
        matches,
      }),
    [matches, projects, requirements, selectedDashboardTagId],
  )

  const dashboardStats = useMemo(() => buildDashboardStats(dashboardData), [dashboardData])

  const filteredProjects = useMemo(() => {
    if (selectedProjectTagId === null) return projects
    return projects.filter((project) => project.tags.some((tag) => tag.id === selectedProjectTagId))
  }, [projects, selectedProjectTagId])

  const filteredRequirements = useMemo(() => {
    if (selectedRequirementTagId === null) return requirements
    return requirements.filter((requirement) => requirement.tags.some((tag) => tag.id === selectedRequirementTagId))
  }, [requirements, selectedRequirementTagId])

  const relatedMatches = useMemo(() => {
    if (detailTarget === null) return []
    if (detailTarget.type === 'project') {
      return matches.filter((match) => match.project_id === detailTarget.item.id)
    }
    return matches.filter((match) => match.requirement_id === detailTarget.item.id)
  }, [detailTarget, matches])

  async function loadData() {
    setLoading(true)
    try {
      const [projectData, requirementData, tagData, matchData] = await Promise.all([
        fetchProjects(),
        fetchRequirements(),
        fetchTags(),
        fetchMatches(),
      ])
      setProjects(projectData)
      setRequirements(requirementData)
      setTags(tagData)
      setMatches(matchData)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : '数据加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    Promise.resolve().then(() => {
      if (active) {
        loadData()
      }
    })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    fetchLLMStatus()
      .then(setLLMStatus)
      .catch(() => setLLMStatus(null))
  }, [])

  async function submitProject(values: ProjectPayload) {
    await createProject({ ...values, tag_ids: values.tag_ids ?? [] })
    projectForm.resetFields()
    await loadData()
    messageApi.success('项目已创建')
  }

  async function submitRequirement(values: RequirementPayload) {
    await createRequirement({ ...values, tag_ids: values.tag_ids ?? [] })
    requirementForm.resetFields()
    await loadData()
    messageApi.success('需求已创建')
  }

  async function submitTag(values: TagPayload) {
    await createTag(values)
    tagForm.resetFields()
    await loadData()
    messageApi.success('标签已创建')
  }

  async function submitMatch(values: MatchPayload) {
    await createMatch(values)
    matchForm.resetFields()
    await loadData()
    messageApi.success('匹配已保存')
  }

  async function runProjectStructuring() {
    setProjectAILoading(true)
    setProjectAIError(null)
    try {
      const result = await structureProject(projectRawText, llmSettings)
      setProjectAIResult(result)
    } catch (err) {
      setProjectAIError(err instanceof Error ? err.message : 'AI 结构化失败')
    } finally {
      setProjectAILoading(false)
    }
  }

  async function runRequirementStructuring() {
    setRequirementAILoading(true)
    setRequirementAIError(null)
    try {
      const result = await structureRequirement(requirementRawText, llmSettings)
      setRequirementAIResult(result)
    } catch (err) {
      setRequirementAIError(err instanceof Error ? err.message : 'AI 结构化失败')
    } finally {
      setRequirementAILoading(false)
    }
  }

  function applyProjectAIResult() {
    if (!projectAIResult) return
    projectForm.setFieldsValue({
      name: getFieldValue(projectAIResult.fields, 'name'),
      owner: getFieldValue(projectAIResult.fields, 'owner'),
      status: normalizeProjectStatus(projectAIResult.fields.status),
      description: buildProjectDescription(projectAIResult),
    })
    messageApi.success('AI 结果已应用到能力表单')
  }

  function applyRequirementAIResult() {
    if (!requirementAIResult) return
    requirementForm.setFieldsValue({
      title: getFieldValue(requirementAIResult.fields, 'title'),
      customer: getFieldValue(requirementAIResult.fields, 'customer'),
      contact: getFieldValue(requirementAIResult.fields, 'contact'),
      urgency: normalizeUrgency(requirementAIResult.fields.urgency),
      status: normalizeRequirementStatus(requirementAIResult.fields.status),
      description: buildRequirementDescription(requirementAIResult),
    })
    messageApi.success('AI 结果已应用到需求表单')
  }

  function openLLMSettings() {
    llmSettingsForm.setFieldsValue({
      api_key: llmSettings?.api_key,
      model: llmSettings?.model ?? llmStatus?.model ?? 'qwen3.6-plus',
      base_url: llmSettings?.base_url,
    })
    setLLMSettingsOpen(true)
  }

  function submitLLMSettings(values: LLMSettings) {
    const next = {
      api_key: values.api_key || undefined,
      model: values.model || undefined,
      base_url: values.base_url || undefined,
    }
    saveLLMSettings(next)
    setLLMSettings(next)
    setLLMSettingsOpen(false)
    messageApi.success('LLM 设置已保存到当前浏览器')
  }

  function clearLocalLLMSettings() {
    clearLLMSettings()
    setLLMSettings(null)
    llmSettingsForm.resetFields()
    messageApi.success('已清除本地 LLM 设置')
  }

  async function loadComments(target: DetailTarget) {
    setCommentsLoading(true)
    try {
      const data = await fetchComments(target.type, target.item.id)
      setComments(data)
    } catch (err) {
      setComments([])
      messageApi.error(err instanceof Error ? err.message : '评论加载失败')
    } finally {
      setCommentsLoading(false)
    }
  }

  async function openDetail(target: DetailTarget) {
    setDetailTarget(target)
    commentForm.resetFields()
    await loadComments(target)
  }

  async function submitComment(values: Pick<CommentPayload, 'author' | 'content'>) {
    if (detailTarget === null) return
    await createComment({
      target_type: detailTarget.type,
      target_id: detailTarget.item.id,
      author: values.author,
      content: values.content,
    })
    commentForm.resetFields()
    await loadComments(detailTarget)
    messageApi.success('评论已添加')
  }

  function openProjectEditor(project: ProjectItem) {
    setEditingProject(project)
    editProjectForm.setFieldsValue({
      name: project.name,
      owner: project.owner,
      status: project.status,
      description: project.description ?? undefined,
      tag_ids: project.tags.map((tag) => tag.id),
    })
  }

  function openRequirementEditor(requirement: RequirementItem) {
    setEditingRequirement(requirement)
    editRequirementForm.setFieldsValue({
      title: requirement.title,
      description: requirement.description,
      customer: requirement.customer,
      contact: requirement.contact ?? undefined,
      urgency: requirement.urgency,
      status: requirement.status,
      tag_ids: requirement.tags.map((tag) => tag.id),
    })
  }

  async function submitProjectEdit(values: ProjectPayload) {
    if (editingProject === null) return
    await updateProject(editingProject.id, { ...values, tag_ids: values.tag_ids ?? [] })
    setEditingProject(null)
    editProjectForm.resetFields()
    await loadData()
    messageApi.success('项目已更新')
  }

  async function submitRequirementEdit(values: RequirementPayload) {
    if (editingRequirement === null) return
    await updateRequirement(editingRequirement.id, { ...values, tag_ids: values.tag_ids ?? [] })
    setEditingRequirement(null)
    editRequirementForm.resetFields()
    await loadData()
    messageApi.success('需求已更新')
  }

  const projectColumns: ColumnsType<ProjectItem> = [
    { title: '项目', dataIndex: 'name', key: 'name', width: 180 },
    { title: '负责人', dataIndex: 'owner', key: 'owner', width: 110 },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (value: string) => <AntTag>{labelOf(projectStatusOptions, value)}</AntTag>,
    },
    { title: '标签', dataIndex: 'tags', key: 'tags', render: renderTags },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
    {
      title: '操作',
      key: 'action',
      width: 170,
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => openDetail({ type: 'project', item: record })}>
            详情
          </Button>
          <Button size="small" icon={<EditOutlined />} onClick={() => openProjectEditor(record)}>
            编辑
          </Button>
        </Space>
      ),
    },
  ]

  const requirementColumns: ColumnsType<RequirementItem> = [
    { title: '需求', dataIndex: 'title', key: 'title', width: 210 },
    { title: '客户', dataIndex: 'customer', key: 'customer', width: 140 },
    {
      title: '紧急度',
      dataIndex: 'urgency',
      key: 'urgency',
      width: 90,
      render: (value: string) => <AntTag color={value === 'high' ? 'red' : value === 'medium' ? 'gold' : 'blue'}>{labelOf(urgencyOptions, value)}</AntTag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (value: string) => <AntTag>{labelOf(requirementStatusOptions, value)}</AntTag>,
    },
    { title: '标签', dataIndex: 'tags', key: 'tags', render: renderTags },
    {
      title: '操作',
      key: 'action',
      width: 170,
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => openDetail({ type: 'requirement', item: record })}>
            详情
          </Button>
          <Button size="small" icon={<EditOutlined />} onClick={() => openRequirementEditor(record)}>
            编辑
          </Button>
        </Space>
      ),
    },
  ]

  const tagColumns: ColumnsType<TagItem> = [
    { title: '标签', dataIndex: 'name', key: 'name' },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      render: (value: string) => labelOf(tagCategoryOptions, value),
    },
  ]

  const matchColumns: ColumnsType<MatchItem> = [
    { title: '需求', dataIndex: ['requirement', 'title'], key: 'requirement', width: 220 },
    { title: '项目', dataIndex: ['project', 'name'], key: 'project', width: 220 },
    {
      title: '覆盖状态',
      dataIndex: 'coverage_status',
      key: 'coverage_status',
      width: 120,
      render: (value: string) => <AntTag color={value === 'covered' ? 'green' : value === 'partial' ? 'gold' : 'red'}>{labelOf(coverageOptions, value)}</AntTag>,
    },
    { title: '备注', dataIndex: 'note', key: 'note', ellipsis: true },
  ]

  const coverageLabel = (status: string) => labelOf(coverageOptions, status)
  const coverageColor = (status: string) => (status === 'covered' ? '#3dcd58' : status === 'partial' ? '#d9a300' : '#d9363e')
  const detailTitle = detailTarget?.type === 'project' ? detailTarget.item.name : detailTarget?.item.title
  const detailTypeLabel = detailTarget?.type === 'project' ? '能力详情' : '需求详情'

  return (
    <Layout className="app-shell">
      {contextHolder}
      <Header className="app-header">
        <div className="brand-block">
          <div className="brand-logo-panel">
            <img className="brand-logo" src={schneiderLogo} alt="Schneider Electric 施耐德电气" />
          </div>
          <div className="brand-divider" />
          <div className="brand-copy">
            <Title level={2}>AI工坊平台</Title>
            <Text>前端需求与后端预研项目透明汇总</Text>
          </div>
        </div>
        <Space className="header-actions">
          <span className="environment-pill">MVP</span>
          <Button icon={<SettingOutlined />} onClick={openLLMSettings}>
            设置
          </Button>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
        </Space>
      </Header>

      <Content className="app-content">
        {error && <Alert type="error" message="数据请求失败" description={error} showIcon className="app-alert" />}

        <div className="metric-strip">
          <div className="metric-card">
            <Statistic title="能力池" value={projects.length} />
          </div>
          <div className="metric-card">
            <Statistic title="需求池" value={requirements.length} />
          </div>
          <div className="metric-card">
            <Statistic title="标签" value={tags.length} />
          </div>
          <div className="metric-card">
            <Statistic title="匹配关系" value={matches.length} />
          </div>
        </div>

        <Tabs
          className="workbench-tabs"
          items={[
            {
              key: 'dashboard',
              label: '总览',
              children: (
                <div className="dashboard-panel">
                  <div className="dashboard-toolbar">
                    <div>
                      <Title level={4}>匹配透明度总览</Title>
                      <Text type="secondary">按行业或业务线查看项目、需求和覆盖状态。</Text>
                    </div>
                    <Select
                      className="dashboard-filter"
                      allowClear
                      placeholder="全部行业 / 业务线"
                      options={dashboardTagOptions}
                      value={selectedDashboardTagId ?? undefined}
                      onChange={(value?: number) => setSelectedDashboardTagId(value ?? null)}
                    />
                  </div>

                  <div className="dashboard-grid">
                    <div className="dashboard-card highlight">
                      <Statistic title="匹配覆盖率" value={dashboardStats.coverageRate} suffix="%" />
                      <Progress percent={dashboardStats.coverageRate} showInfo={false} strokeColor="#3dcd58" railColor="#e8efe9" />
                      <Text type="secondary">
                        {dashboardStats.matchedRequirementCount} / {dashboardStats.requirementCount} 个需求已有匹配
                      </Text>
                    </div>
                    <div className="dashboard-card">
                      <Statistic title="能力池" value={dashboardStats.projectCount} />
                      <Text type="secondary">当前视图内的后端预研能力</Text>
                    </div>
                    <div className="dashboard-card">
                      <Statistic title="需求池" value={dashboardStats.requirementCount} />
                      <Text type="secondary">当前视图内的客户需求</Text>
                    </div>
                    <div className="dashboard-card">
                      <Statistic title="匹配关系" value={dashboardStats.matchCount} />
                      <Text type="secondary">已建立的需求-能力关联</Text>
                    </div>
                  </div>

                  <div className="coverage-board">
                    {dashboardStats.statusCounts.map((item) => (
                      <div className="coverage-card" key={item.status}>
                        <div className="coverage-card-header">
                          <AntTag color={item.status === 'covered' ? 'green' : item.status === 'partial' ? 'gold' : 'red'}>
                            {coverageLabel(item.status)}
                          </AntTag>
                          <Text strong>{item.count} 条</Text>
                        </div>
                        <Progress percent={item.percentage} strokeColor={coverageColor(item.status)} railColor="#e8efe9" />
                      </div>
                    ))}
                  </div>

                  <section className="table-panel dashboard-table">
                    <Table
                      rowKey="id"
                      columns={matchColumns}
                      dataSource={dashboardData.matches}
                      loading={loading}
                      pagination={false}
                      scroll={{ x: 760 }}
                    />
                  </section>
                </div>
              ),
            },
            {
              key: 'projects',
              label: '能力池',
              children: (
                <div className="workbench-grid">
                  <section className="form-panel">
                    <Title level={4}>新建能力</Title>
                    <AIStructurePanel
                      title="AI 结构化能力描述"
                      placeholder="例如：我们有一个面向数据中心的能耗分析 demo，可以帮助客户识别高耗能设备并给出优化建议..."
                      rawText={projectRawText}
                      result={projectAIResult}
                      loading={projectAILoading}
                      error={projectAIError}
                      onRawTextChange={setProjectRawText}
                      onStructure={runProjectStructuring}
                      onApply={applyProjectAIResult}
                    />
                    <Form form={projectForm} layout="vertical" onFinish={submitProject} initialValues={{ status: 'researching', tag_ids: [] }}>
                      <Form.Item name="name" label="能力名称" rules={[{ required: true, message: '请输入能力名称' }]}>
                        <Input />
                      </Form.Item>
                      <Form.Item name="owner" label="负责人" rules={[{ required: true, message: '请输入负责人' }]}>
                        <Input />
                      </Form.Item>
                      <Form.Item name="status" label="状态">
                        <Select options={projectStatusOptions} />
                      </Form.Item>
                      <Form.Item name="tag_ids" label="标签">
                        <Select mode="multiple" options={tagOptions} />
                      </Form.Item>
                      <Form.Item name="description" label="描述">
                        <TextArea rows={4} />
                      </Form.Item>
                      <Button type="primary" htmlType="submit" icon={<PlusOutlined />} block>
                        创建
                      </Button>
                    </Form>
                  </section>
                  <section className="table-panel">
                    <div className="table-toolbar">
                      <Select
                        className="table-filter"
                        allowClear
                        placeholder="按标签筛选能力"
                        options={tagOptions}
                        value={selectedProjectTagId ?? undefined}
                        onChange={(value?: number) => setSelectedProjectTagId(value ?? null)}
                      />
                    </div>
                    <Table rowKey="id" columns={projectColumns} dataSource={filteredProjects} loading={loading} pagination={false} scroll={{ x: 860 }} />
                  </section>
                </div>
              ),
            },
            {
              key: 'requirements',
              label: '需求池',
              children: (
                <div className="workbench-grid">
                  <section className="form-panel">
                    <Title level={4}>新建需求</Title>
                    <AIStructurePanel
                      title="AI 结构化需求描述"
                      placeholder="例如：某数据中心客户希望降低 PUE，但目前缺少统一能耗分析，希望近期做一次节能评估..."
                      rawText={requirementRawText}
                      result={requirementAIResult}
                      loading={requirementAILoading}
                      error={requirementAIError}
                      onRawTextChange={setRequirementRawText}
                      onStructure={runRequirementStructuring}
                      onApply={applyRequirementAIResult}
                    />
                    <Form form={requirementForm} layout="vertical" onFinish={submitRequirement} initialValues={{ urgency: 'medium', status: 'new', tag_ids: [] }}>
                      <Form.Item name="title" label="需求标题" rules={[{ required: true, message: '请输入需求标题' }]}>
                        <Input />
                      </Form.Item>
                      <Form.Item name="customer" label="客户" rules={[{ required: true, message: '请输入客户' }]}>
                        <Input />
                      </Form.Item>
                      <Form.Item name="contact" label="联系人">
                        <Input />
                      </Form.Item>
                      <Form.Item name="urgency" label="紧急度">
                        <Select options={urgencyOptions} />
                      </Form.Item>
                      <Form.Item name="status" label="状态">
                        <Select options={requirementStatusOptions} />
                      </Form.Item>
                      <Form.Item name="tag_ids" label="标签">
                        <Select mode="multiple" options={tagOptions} />
                      </Form.Item>
                      <Form.Item name="description" label="描述" rules={[{ required: true, message: '请输入需求描述' }]}>
                        <TextArea rows={4} />
                      </Form.Item>
                      <Button type="primary" htmlType="submit" icon={<PlusOutlined />} block>
                        创建
                      </Button>
                    </Form>
                  </section>
                  <section className="table-panel">
                    <div className="table-toolbar">
                      <Select
                        className="table-filter"
                        allowClear
                        placeholder="按标签筛选需求"
                        options={tagOptions}
                        value={selectedRequirementTagId ?? undefined}
                        onChange={(value?: number) => setSelectedRequirementTagId(value ?? null)}
                      />
                    </div>
                    <Table rowKey="id" columns={requirementColumns} dataSource={filteredRequirements} loading={loading} pagination={false} scroll={{ x: 920 }} />
                  </section>
                </div>
              ),
            },
            {
              key: 'tags',
              label: '标签',
              children: (
                <div className="workbench-grid">
                  <section className="form-panel">
                    <Title level={4}>新建标签</Title>
                    <Form form={tagForm} layout="vertical" onFinish={submitTag} initialValues={{ category: 'industry' }}>
                      <Form.Item name="name" label="标签名称" rules={[{ required: true, message: '请输入标签名称' }]}>
                        <Input />
                      </Form.Item>
                      <Form.Item name="category" label="分类">
                        <Select options={tagCategoryOptions} />
                      </Form.Item>
                      <Button type="primary" htmlType="submit" icon={<PlusOutlined />} block>
                        创建
                      </Button>
                    </Form>
                  </section>
                  <section className="table-panel compact">
                    <Table rowKey="id" columns={tagColumns} dataSource={tags} loading={loading} pagination={false} />
                  </section>
                </div>
              ),
            },
            {
              key: 'matches',
              label: '匹配',
              children: (
                <div className="workbench-grid">
                  <section className="form-panel">
                    <Title level={4}>新建匹配</Title>
                    <Form form={matchForm} layout="vertical" onFinish={submitMatch} initialValues={{ coverage_status: 'partial' }}>
                      <Form.Item name="requirement_id" label="需求" rules={[{ required: true, message: '请选择需求' }]}>
                        <Select showSearch optionFilterProp="label" options={requirementOptions} />
                      </Form.Item>
                      <Form.Item name="project_id" label="项目" rules={[{ required: true, message: '请选择项目' }]}>
                        <Select showSearch optionFilterProp="label" options={projectOptions} />
                      </Form.Item>
                      <Form.Item name="coverage_status" label="覆盖状态">
                        <Select options={coverageOptions} />
                      </Form.Item>
                      <Form.Item name="note" label="备注">
                        <TextArea rows={4} />
                      </Form.Item>
                      <Button type="primary" htmlType="submit" icon={<LinkOutlined />} block>
                        保存
                      </Button>
                    </Form>
                  </section>
                  <section className="table-panel">
                    <Table rowKey="id" columns={matchColumns} dataSource={matches} loading={loading} pagination={false} scroll={{ x: 760 }} />
                  </section>
                </div>
              ),
            },
          ]}
        />
      </Content>

      <Drawer title="LLM 设置" open={llmSettingsOpen} onClose={() => setLLMSettingsOpen(false)}>
        <Alert
          className="app-alert"
          type={llmStatus?.configured ? 'success' : 'warning'}
          showIcon
          message={llmStatus?.configured ? '系统默认 Qwen Key 已配置' : '系统默认 Qwen Key 未配置'}
          description={`默认模型：${llmStatus?.model ?? 'qwen3.6-plus'}。本地设置只保存在当前浏览器，用于临时覆盖。`}
        />
        <Form form={llmSettingsForm} layout="vertical" onFinish={submitLLMSettings}>
          <Form.Item name="api_key" label="API Key">
            <Input.Password placeholder="留空则使用系统默认配置" />
          </Form.Item>
          <Form.Item name="model" label="模型">
            <Input placeholder="qwen3.6-plus" />
          </Form.Item>
          <Form.Item name="base_url" label="Base URL">
            <Input placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1" />
          </Form.Item>
          <Space>
            <Button type="primary" htmlType="submit">
              保存
            </Button>
            <Button onClick={clearLocalLLMSettings}>清除本地设置</Button>
          </Space>
        </Form>
      </Drawer>

      <Drawer
        title={detailTitle ? `${detailTypeLabel}：${detailTitle}` : detailTypeLabel}
        size="large"
        open={detailTarget !== null}
        onClose={() => {
          setDetailTarget(null)
          setComments([])
        }}
      >
        {detailTarget?.type === 'project' && (
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="能力名称">{detailTarget.item.name}</Descriptions.Item>
            <Descriptions.Item label="负责人">{detailTarget.item.owner}</Descriptions.Item>
            <Descriptions.Item label="状态">{labelOf(projectStatusOptions, detailTarget.item.status)}</Descriptions.Item>
            <Descriptions.Item label="标签">{renderTags(detailTarget.item.tags)}</Descriptions.Item>
            <Descriptions.Item label="描述">{detailTarget.item.description || '-'}</Descriptions.Item>
          </Descriptions>
        )}

        {detailTarget?.type === 'requirement' && (
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="需求标题">{detailTarget.item.title}</Descriptions.Item>
            <Descriptions.Item label="客户">{detailTarget.item.customer}</Descriptions.Item>
            <Descriptions.Item label="联系人">{detailTarget.item.contact || '-'}</Descriptions.Item>
            <Descriptions.Item label="紧急度">{labelOf(urgencyOptions, detailTarget.item.urgency)}</Descriptions.Item>
            <Descriptions.Item label="状态">{labelOf(requirementStatusOptions, detailTarget.item.status)}</Descriptions.Item>
            <Descriptions.Item label="标签">{renderTags(detailTarget.item.tags)}</Descriptions.Item>
            <Descriptions.Item label="描述">{detailTarget.item.description}</Descriptions.Item>
          </Descriptions>
        )}

        <Divider>关联列表</Divider>
        {relatedMatches.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无关联" />
        ) : (
          <Table rowKey="id" columns={matchColumns} dataSource={relatedMatches} pagination={false} size="small" scroll={{ x: 640 }} />
        )}

        <Divider>协作记录</Divider>
        <Form form={commentForm} layout="vertical" onFinish={submitComment} className="comment-form">
          <Form.Item name="author" label="姓名/角色" rules={[{ required: true, message: '请输入姓名或角色' }]}>
            <Input placeholder="例如：销售一组" />
          </Form.Item>
          <Form.Item name="content" label="评论" rules={[{ required: true, message: '请输入评论内容' }]}>
            <TextArea rows={3} />
          </Form.Item>
          <Button type="primary" htmlType="submit" icon={<PlusOutlined />}>
            添加评论
          </Button>
        </Form>

        <div className="comment-list">
          {commentsLoading && <Text type="secondary">评论加载中...</Text>}
          {!commentsLoading && comments.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无评论" />}
          {!commentsLoading &&
            comments.map((comment) => (
              <div className="comment-item" key={comment.id}>
                <Space>
                  <Text strong>{comment.author}</Text>
                  <Text type="secondary">{new Date(comment.created_at).toLocaleString()}</Text>
                </Space>
                <div className="comment-content">{comment.content}</div>
              </div>
            ))}
        </div>
      </Drawer>

      <Drawer
        title="编辑能力"
        size="large"
        open={editingProject !== null}
        onClose={() => {
          setEditingProject(null)
          editProjectForm.resetFields()
        }}
      >
        <Form form={editProjectForm} layout="vertical" onFinish={submitProjectEdit}>
          <Form.Item name="name" label="能力名称" rules={[{ required: true, message: '请输入能力名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="owner" label="负责人" rules={[{ required: true, message: '请输入负责人' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select options={projectStatusOptions} />
          </Form.Item>
          <Form.Item name="tag_ids" label="标签">
            <Select mode="multiple" options={tagOptions} />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={4} />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>
            保存修改
          </Button>
        </Form>
      </Drawer>

      <Drawer
        title="编辑需求"
        size="large"
        open={editingRequirement !== null}
        onClose={() => {
          setEditingRequirement(null)
          editRequirementForm.resetFields()
        }}
      >
        <Form form={editRequirementForm} layout="vertical" onFinish={submitRequirementEdit}>
          <Form.Item name="title" label="需求标题" rules={[{ required: true, message: '请输入需求标题' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="customer" label="客户" rules={[{ required: true, message: '请输入客户' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="contact" label="联系人">
            <Input />
          </Form.Item>
          <Form.Item name="urgency" label="紧急度">
            <Select options={urgencyOptions} />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select options={requirementStatusOptions} />
          </Form.Item>
          <Form.Item name="tag_ids" label="标签">
            <Select mode="multiple" options={tagOptions} />
          </Form.Item>
          <Form.Item name="description" label="描述" rules={[{ required: true, message: '请输入需求描述' }]}>
            <TextArea rows={4} />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>
            保存修改
          </Button>
        </Form>
      </Drawer>
    </Layout>
  )
}
