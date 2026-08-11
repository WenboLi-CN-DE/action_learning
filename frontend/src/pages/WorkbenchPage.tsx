import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  Layout,
  Progress,
  Select,
  Segmented,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag as AntTag,
  Typography,
  message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { EditOutlined, EyeOutlined, LinkOutlined, LogoutOutlined, PlusOutlined, ReloadOutlined, SearchOutlined, SettingOutlined } from '@ant-design/icons'
import {
  analyzeRequirementMatchesStream,
  assignRequirementReviewer,
  createComment,
  createMatch,
  createProject,
  createRequirement,
  createTag,
  fetchComments,
  fetchLLMStatus,
  fetchLatestRequirementMatches,
  fetchMatches,
  fetchPilotMetrics,
  fetchPilotTasks,
  fetchProjects,
  fetchRequirements,
  fetchReviewEvents,
  fetchTags,
  recognizeImage,
  structureProject,
  structureRequirement,
  transitionRequirement,
  updateProject,
  updateRequirement,
} from '../services/api'
import { clearLLMSettings, loadLLMSettings, saveLLMSettings } from '../services/llmSettings'
import { useNavigate } from 'react-router'
import type {
  AIMatchResult,
  CommentItem,
  CommentPayload,
  LLMSettings,
  LLMStatus,
  LLMStructureResult,
  MatchItem,
  MatchPayload,
  DataQualityRecord,
  PilotMetrics,
  PilotTaskItem,
  PilotTaskResponse,
  ProjectItem,
  ProjectPayload,
  RequirementItem,
  RequirementPayload,
  ReviewEventItem,
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
import {
  ManagementPilotDashboard,
  PersonalTaskCenter,
} from './PilotOverview'
import ReviewQueue from './ReviewQueue'
import {
  getRequirementDataIssues,
  getRequirementReviewPresentation,
  isRequirementDescriptionIncomplete,
} from './requirementDetail'
import {
  getRoleCapabilities,
  isSalesOwnRequirement,
  isSalesVisibleProjectStatus,
  ROLE_LABELS,
} from '../auth/permissions'
import { useRoleStore } from '../auth/roleStore'
import { useAssistantStore } from '../stores/assistantStore'
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
  { label: '草稿', value: 'draft' },
  { label: '待审核', value: 'pending_review' },
  { label: '已受理', value: 'accepted' },
  { label: '匹配中', value: 'matching' },
  { label: '已匹配', value: 'matched' },
  { label: '已搁置', value: 'shelved' },
  { label: '新需求（历史）', value: 'new' },
  { label: '评估中（历史）', value: 'reviewing' },
  { label: '关闭（历史）', value: 'closed' },
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

const requirementDescriptionRules = [
  { required: true, message: '请输入需求描述' },
  {
    validator: (_: unknown, value?: string) => (
      value && !isRequirementDescriptionIncomplete(value)
        ? Promise.resolve()
        : Promise.reject(new Error('请至少说明业务场景、目标或期望结果'))
    ),
  },
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

function reviewActionLabel(action: string) {
  const labels: Record<string, string> = {
    approve: '受理',
    return: '退回',
    transition: '状态变更',
    technical_approve: '技术确认',
    technical_reject: '技术拒绝',
    final_approve: '最终批准',
    final_reject: '最终拒绝',
    assign_reviewer: '指派审核人',
    match_approved: '匹配确认',
    match_rejected: '匹配拒绝',
  }
  return labels[action] ?? action
}

type DetailTarget = { type: 'project'; item: ProjectItem } | { type: 'requirement'; item: RequirementItem }

export default function WorkbenchPage() {
  const navigate = useNavigate()
  const role = useRoleStore((state) => state.role) ?? 'sales'
  const displayName = useRoleStore((state) => state.displayName)
  const clearIdentity = useRoleStore((state) => state.clearIdentity)
  const requirementDraft = useAssistantStore((state) => state.requirementDraft)
  const clearRequirementDraft = useAssistantStore((state) => state.clearRequirementDraft)
  const capabilities = getRoleCapabilities(role)
  const [activeTab, setActiveTab] = useState<string>(capabilities.defaultTab)
  const [projects, setProjects] = useState<ProjectItem[]>([])
  const [requirements, setRequirements] = useState<RequirementItem[]>([])
  const [tags, setTags] = useState<TagItem[]>([])
  const [matches, setMatches] = useState<MatchItem[]>([])
  const [pilotTasks, setPilotTasks] = useState<PilotTaskResponse | null>(null)
  const [pilotMetrics, setPilotMetrics] = useState<PilotMetrics | null>(null)
  const [comments, setComments] = useState<CommentItem[]>([])
  const [reviewEvents, setReviewEvents] = useState<ReviewEventItem[]>([])
  const [detailTarget, setDetailTarget] = useState<DetailTarget | null>(null)
  const [editingProject, setEditingProject] = useState<ProjectItem | null>(null)
  const [editingRequirement, setEditingRequirement] = useState<RequirementItem | null>(null)
  const [selectedDashboardTagId, setSelectedDashboardTagId] = useState<number | null>(null)
  const [selectedProjectTagId, setSelectedProjectTagId] = useState<number | null>(null)
  const [selectedRequirementTagId, setSelectedRequirementTagId] = useState<number | null>(null)
  const [selectedCapabilityRequirementId, setSelectedCapabilityRequirementId] = useState<number | null>(null)
  const [capabilityCoverageFilter, setCapabilityCoverageFilter] = useState('all')
  const [researchCapabilityView, setResearchCapabilityView] = useState<'matched' | 'managed'>('matched')
  const [aiMatchResults, setAIMatchResults] = useState<Record<number, AIMatchResult>>({})
  const [reviewerAssignment, setReviewerAssignment] = useState('')
  const [assigningReviewer, setAssigningReviewer] = useState(false)
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
  const [aiMatchResult, setAIMatchResult] = useState<AIMatchResult | null>(null)
  const [aiMatchLoading, setAIMatchLoading] = useState(false)
  const [aiMatchProgress, setAIMatchProgress] = useState('')
  const [aiMatchPreview, setAIMatchPreview] = useState('')
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

  useEffect(() => {
    if (!requirementDraft || !capabilities.canCreateRequirement) return
    let active = true
    Promise.resolve().then(() => {
      if (!active) return
      setActiveTab('requirements')
      setRequirementAIResult(requirementDraft)
      requirementForm.setFieldsValue({
        title: getFieldValue(requirementDraft.fields, 'title'),
        customer: getFieldValue(requirementDraft.fields, 'customer'),
        contact: getFieldValue(requirementDraft.fields, 'contact'),
        urgency: normalizeUrgency(requirementDraft.fields.urgency),
        status: role === 'sales' ? 'pending_review' : normalizeRequirementStatus(requirementDraft.fields.status),
        description: buildRequirementDescription(requirementDraft),
      })
      clearRequirementDraft()
      messageApi.info('AI 助手生成的需求草稿已填入表单，请检查后提交')
    })
    return () => {
      active = false
    }
  }, [
    capabilities.canCreateRequirement,
    clearRequirementDraft,
    messageApi,
    requirementDraft,
    requirementForm,
    role,
  ])

  const tagOptions = useMemo(
    () => tags.map((tag) => ({ label: `${tag.name} / ${labelOf(tagCategoryOptions, tag.category)}`, value: tag.id })),
    [tags],
  )

  const projectOptions = useMemo(
    () => projects.map((project) => ({ label: project.name, value: project.id })),
    [projects],
  )

  const requirementOptions = useMemo(
    () => requirements
      .filter((requirement) => ['accepted', 'matching'].includes(requirement.status))
      .map((requirement) => ({ label: requirement.title, value: requirement.id })),
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
    const roleFiltered = role === 'sales'
      ? projects.filter((project) => isSalesVisibleProjectStatus(project.status))
      : projects
    if (selectedProjectTagId === null) return roleFiltered
    return roleFiltered.filter((project) => project.tags.some((tag) => tag.id === selectedProjectTagId))
  }, [projects, role, selectedProjectTagId])

  const filteredRequirements = useMemo(() => {
    const roleFiltered = role === 'sales'
      ? requirements.filter((requirement) => isSalesOwnRequirement(requirement.submitted_by, displayName))
      : requirements
    if (selectedRequirementTagId === null) return roleFiltered
    return roleFiltered.filter((requirement) => requirement.tags.some((tag) => tag.id === selectedRequirementTagId))
  }, [displayName, requirements, role, selectedRequirementTagId])

  const relatedMatches = useMemo(() => {
    if (detailTarget === null) return []
    if (detailTarget.type === 'project') {
      return matches.filter((match) => match.project_id === detailTarget.item.id)
    }
    return matches.filter((match) => match.requirement_id === detailTarget.item.id)
  }, [detailTarget, matches])

  const selectedCapabilityRequirement = useMemo(
    () => requirements.find((requirement) => requirement.id === selectedCapabilityRequirementId) ?? null,
    [requirements, selectedCapabilityRequirementId],
  )

  const selectedCapabilityMatchResult = selectedCapabilityRequirementId === null
    ? null
    : aiMatchResults[selectedCapabilityRequirementId] ?? null

  const selectedCapabilityRecommendations = useMemo(() => {
    const recommendations = selectedCapabilityMatchResult?.recommendations ?? []
    if (capabilityCoverageFilter === 'all') return recommendations
    return recommendations.filter((recommendation) => recommendation.coverage_status === capabilityCoverageFilter)
  }, [capabilityCoverageFilter, selectedCapabilityMatchResult])

  const showCapabilityMatches = role === 'sales' || (role === 'research' && researchCapabilityView === 'matched')
  const capabilityTableCount = showCapabilityMatches ? selectedCapabilityRecommendations.length : filteredProjects.length

  const loadLatestAIMatchResult = useCallback(async (requirementId: number) => {
    try {
      const result = await fetchLatestRequirementMatches(requirementId)
      if (!result) return null
      setAIMatchResults((current) => ({ ...current, [requirementId]: result }))
      return result
    } catch {
      return null
    }
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [projectData, requirementData, tagData, matchData, taskData, metricsData] = await Promise.all([
        fetchProjects(),
        fetchRequirements(),
        fetchTags(),
        fetchMatches(),
        fetchPilotTasks(role, displayName),
        role === 'admin' ? fetchPilotMetrics() : Promise.resolve(null),
      ])
      setProjects(projectData)
      setRequirements(requirementData)
      setTags(tagData)
      setMatches(matchData)
      setPilotTasks(taskData)
      setPilotMetrics(metricsData)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : '数据加载失败')
    } finally {
      setLoading(false)
    }
  }, [displayName, role])

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
  }, [loadData])

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
    await createRequirement({
      ...values,
      status: role === 'sales' ? 'pending_review' : values.status,
      submitted_by: displayName,
      tag_ids: values.tag_ids ?? [],
    })
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
    await createMatch({ ...values, created_by: displayName })
    matchForm.resetFields()
    await loadData()
    messageApi.success('关联已发起，等待研发技术确认')
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

  async function recognizeProjectImage(file: File) {
    const result = await recognizeImage(
      file,
      '请识别图片中和后端预研能力、项目方案、适用场景、负责人、成熟度、可交付形式有关的信息，整理为中文描述。',
      llmSettings,
    )
    messageApi.success('图片内容已识别，可继续 AI 结构化')
    return result.text
  }

  async function recognizeRequirementImage(file: File) {
    const result = await recognizeImage(
      file,
      '请识别图片中和客户需求、客户名称、业务场景、痛点、期望能力、紧急程度、时间节点有关的信息，整理为中文描述。',
      llmSettings,
    )
    messageApi.success('图片内容已识别，可继续 AI 结构化')
    return result.text
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
    setAIMatchResult(target.type === 'requirement' ? aiMatchResults[target.item.id] ?? null : null)
    if (target.type === 'requirement') setSelectedCapabilityRequirementId(target.item.id)
    setReviewEvents([])
    setReviewerAssignment(
      target.type === 'requirement'
        ? target.item.assigned_reviewer || displayName
        : '',
    )
    commentForm.setFieldsValue({ author: displayName, content: '' })
    const latestMatchResult = target.type === 'requirement'
      ? await loadLatestAIMatchResult(target.item.id)
      : null
    if (latestMatchResult) setAIMatchResult(latestMatchResult)
    await Promise.all([
      loadComments(target),
      target.type === 'requirement'
        ? fetchReviewEvents('requirement', target.item.id)
            .then(setReviewEvents)
            .catch(() => setReviewEvents([]))
        : Promise.resolve(),
    ])
  }

  function openPilotTask(task: PilotTaskItem) {
    if (task.target_type === 'match') {
      setActiveTab(role === 'admin' ? 'reviews' : 'requirements')
      return
    }
    const requirement = requirements.find((item) => item.id === task.target_id)
    if (!requirement) return
    setActiveTab(role === 'admin' ? 'reviews' : 'requirements')
    void openDetail({ type: 'requirement', item: requirement })
  }

  function openQualityRecord(record: DataQualityRecord) {
    if (record.target_type === 'requirement') {
      const requirement = requirements.find((item) => item.id === record.target_id)
      if (requirement) void openDetail({ type: 'requirement', item: requirement })
      return
    }
    const project = projects.find((item) => item.id === record.target_id)
    if (project) void openDetail({ type: 'project', item: project })
  }

  async function assignReviewer() {
    if (detailTarget?.type !== 'requirement' || !reviewerAssignment.trim()) return
    setAssigningReviewer(true)
    try {
      const updated = await assignRequirementReviewer(detailTarget.item.id, {
        reviewer: reviewerAssignment.trim(),
        actor: displayName,
      })
      setDetailTarget({ type: 'requirement', item: updated })
      setReviewEvents(await fetchReviewEvents('requirement', updated.id))
      await loadData()
      messageApi.success(
        ['new', 'reviewing'].includes(detailTarget.item.status)
          ? '审核负责人已指派，历史需求已进入待审核队列'
          : '审核负责人已更新',
      )
    } catch (requestError) {
      messageApi.error(requestError instanceof Error ? requestError.message : '审核负责人指派失败')
    } finally {
      setAssigningReviewer(false)
    }
  }

  async function runAIMatching() {
    if (detailTarget?.type !== 'requirement') return
    setAIMatchLoading(true)
    setAIMatchResult(null)
    setAIMatchProgress('正在连接 AI 匹配服务')
    setAIMatchPreview('')
    try {
      const result = await analyzeRequirementMatchesStream(detailTarget.item.id, 5, llmSettings, (event) => {
        if (event.type === 'progress') setAIMatchProgress(event.message)
        if (event.type === 'content') {
          setAIMatchProgress('正在整理自然语言匹配结论')
          setAIMatchPreview('正在比较需求场景、能力范围和交付条件，完成后将展示推荐理由。')
        }
      })
      setAIMatchResult(result)
      setAIMatchResults((current) => ({ ...current, [detailTarget.item.id]: result }))
      if (result.fallback_used) messageApi.warning(result.warnings[0] ?? 'AI 匹配未完成')
      else if (result.recommendations.length === 0) messageApi.info('AI 未发现达到阈值的候选能力')
    } catch (err) {
      messageApi.error(err instanceof Error ? err.message : 'AI 匹配分析失败')
    } finally {
      setAIMatchLoading(false)
    }
  }

  async function changeRequirementStatus(targetStatus: string) {
    if (detailTarget?.type !== 'requirement') return
    try {
      const updated = await transitionRequirement(detailTarget.item.id, {
        target_status: targetStatus,
        actor: displayName,
      })
      setDetailTarget({ type: 'requirement', item: updated })
      setReviewEvents(await fetchReviewEvents('requirement', updated.id))
      await loadData()
      messageApi.success(targetStatus === 'pending_review' ? '需求已重新提交审核' : '需求状态已更新')
    } catch (requestError) {
      messageApi.error(requestError instanceof Error ? requestError.message : '需求状态更新失败')
    }
  }

  async function confirmAIRecommendation(recommendation: AIMatchResult['recommendations'][number]) {
    if (detailTarget?.type !== 'requirement') return
    await createMatch({
      project_id: recommendation.project_id,
      requirement_id: detailTarget.item.id,
      coverage_status: recommendation.coverage_status,
      note: recommendation.reason,
      source: 'ai',
      ai_score: recommendation.score,
      ai_reason: recommendation.reason,
      ai_gaps: recommendation.gaps,
      ai_model: aiMatchResult?.model,
      created_by: displayName,
    })
    setAIMatchResult((current) => current ? {
      ...current,
      recommendations: current.recommendations.map((item) =>
        item.project_id === recommendation.project_id ? { ...item, already_confirmed: true } : item,
      ),
    } : current)
    setAIMatchResults((current) => {
      const result = current[detailTarget.item.id]
      if (!result) return current
      return {
        ...current,
        [detailTarget.item.id]: {
          ...result,
          recommendations: result.recommendations.map((item) =>
            item.project_id === recommendation.project_id ? { ...item, already_confirmed: true } : item,
          ),
        },
      }
    })
    await loadData()
    messageApi.success('AI 推荐关联已发起，等待研发技术确认')
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
          {capabilities.canManageProjects && (
            <Button size="small" icon={<EditOutlined />} onClick={() => openProjectEditor(record)}>
              编辑
            </Button>
          )}
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
          {capabilities.canEditRequirement && (
            <Button size="small" icon={<EditOutlined />} onClick={() => openRequirementEditor(record)}>
              编辑
            </Button>
          )}
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
    { title: '能力', dataIndex: ['project', 'name'], key: 'project', width: 220 },
    {
      title: '覆盖状态',
      dataIndex: 'coverage_status',
      key: 'coverage_status',
      width: 120,
      render: (value: string) => <AntTag color={value === 'covered' ? 'green' : value === 'partial' ? 'gold' : 'red'}>{labelOf(coverageOptions, value)}</AntTag>,
    },
    {
      title: '确认状态',
      dataIndex: 'review_status',
      key: 'review_status',
      width: 110,
      render: (value: MatchItem['review_status']) => (
        <AntTag color={value === 'approved' ? 'green' : value === 'rejected' ? 'red' : 'blue'}>
          {value === 'approved'
            ? '已生效'
            : value === 'rejected'
              ? '已拒绝'
              : value === 'final_pending'
                ? '待最终批准'
                : '待技术确认'}
        </AntTag>
      ),
    },
    {
      title: '审核人',
      dataIndex: 'reviewed_by',
      key: 'reviewed_by',
      width: 130,
      render: (value: string | null, record) => value
        ? `${value}${record.reviewed_at ? ` · ${new Date(record.reviewed_at).toLocaleDateString()}` : ''}`
        : '-',
    },
    { title: '备注', dataIndex: 'note', key: 'note', ellipsis: true },
  ]

  const aiCapabilityColumns: ColumnsType<AIMatchResult['recommendations'][number]> = [
    {
      title: '能力',
      key: 'project',
      width: 240,
      render: (_, recommendation) => (
        <Space direction="vertical" size={2}>
          <Text strong>{recommendation.project.name}</Text>
          {renderTags(recommendation.project.tags)}
        </Space>
      ),
    },
    { title: '负责人', dataIndex: ['project', 'owner'], key: 'owner', width: 150 },
    {
      title: '匹配分类',
      dataIndex: 'coverage_status',
      key: 'coverage_status',
      width: 120,
      render: (value: string) => (
        <AntTag color={value === 'covered' ? 'green' : value === 'partial' ? 'gold' : 'red'}>
          {coverageLabel(value)}
        </AntTag>
      ),
    },
    {
      title: '匹配分',
      dataIndex: 'score',
      key: 'score',
      width: 90,
      render: (value: number) => <Text strong>{value.toFixed(0)} 分</Text>,
    },
    {
      title: '匹配说明',
      key: 'reason',
      width: 420,
      render: (_, recommendation) => (
        <Space direction="vertical" size={2}>
          <Text>{recommendation.reason}</Text>
          {recommendation.gaps.length > 0 && (
            <Text type="secondary">能力缺口：{recommendation.gaps.join('；')}</Text>
          )}
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 100,
      render: (_, recommendation) => (
        <Button type="link" icon={<EyeOutlined />} onClick={() => void openDetail({ type: 'project', item: recommendation.project })}>
          详情
        </Button>
      ),
    },
  ]

  const coverageLabel = (status: string) => labelOf(coverageOptions, status)
  const coverageColor = (status: string) => (status === 'covered' ? '#3dcd58' : status === 'partial' ? '#d9a300' : '#d9363e')
  const detailTypeLabel = detailTarget?.type === 'project' ? '能力详情' : '需求详情'
  const aiMatchTitle = role === 'research' ? 'AI 需求匹配' : 'AI 能力匹配'
  const requirementDataIssues = detailTarget?.type === 'requirement'
    ? getRequirementDataIssues(detailTarget.item)
    : []
  const requirementReview = detailTarget?.type === 'requirement'
    ? getRequirementReviewPresentation(detailTarget.item)
    : null
  const visibleTabKeys = role === 'admin'
    ? ['dashboard', 'projects', 'requirements', 'reviews', 'tags', 'matches']
    : role === 'research'
      ? ['projects', 'requirements']
      : ['projects', 'requirements']

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
          <span className="identity-pill">{displayName} · {ROLE_LABELS[role]}</span>
          <Button type="primary" icon={<SearchOutlined />} onClick={() => navigate('/search')}>
            智能搜索
          </Button>
          <Button icon={<SettingOutlined />} onClick={openLLMSettings}>
            设置
          </Button>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
          <Button
            icon={<LogoutOutlined />}
            onClick={() => {
              clearIdentity()
              navigate('/role')
            }}
          >
            切换身份
          </Button>
        </Space>
      </Header>

      <Content className="app-content">
        {error && <Alert type="error" message="数据请求失败" description={error} showIcon className="app-alert" />}

        {role === 'admin' ? (
          <div className="metric-strip">
            <div className="metric-card">
              <Statistic title="待审核需求" value={requirements.filter((item) => item.status === 'pending_review').length} />
            </div>
            <div className="metric-card">
              <Statistic title="待研发确认" value={matches.filter((item) => ['pending', 'technical_pending'].includes(item.review_status)).length} />
            </div>
            <div className="metric-card">
              <Statistic title="待最终批准" value={matches.filter((item) => item.review_status === 'final_pending').length} />
            </div>
            <div className="metric-card">
              <Statistic title="已生效关联" value={matches.filter((item) => item.review_status === 'approved').length} />
            </div>
          </div>
        ) : (
          <div className="metric-strip">
            <div className="metric-card">
              <Statistic title={showCapabilityMatches ? '匹配到的能力' : '能力维护'} value={capabilityTableCount} />
            </div>
            <div className="metric-card">
              <Statistic title="需求表" value={role === 'sales' ? filteredRequirements.length : requirements.length} />
            </div>
            <div className="metric-card">
              <Statistic title="标签" value={tags.length} />
            </div>
            <div className="metric-card">
              <Statistic title="匹配关系" value={matches.length} />
            </div>
          </div>
        )}

        <Tabs
          className="workbench-tabs"
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'dashboard',
              label: '总览',
              children: (
                <div className="dashboard-panel">
                  <ManagementPilotDashboard
                    metrics={pilotMetrics}
                    loading={loading}
                    onOpenQualityRecord={openQualityRecord}
                  />
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
                      <Statistic title="能力表" value={dashboardStats.projectCount} />
                      <Text type="secondary">当前视图内的后端预研能力</Text>
                    </div>
                    <div className="dashboard-card">
                      <Statistic title="需求表" value={dashboardStats.requirementCount} />
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
              label: role === 'sales' ? '匹配到的能力' : '能力表',
              children: (
                <div className={`workbench-grid creation-workbench${capabilities.canManageProjects ? '' : ' read-only'}`}>
                  {capabilities.canManageProjects && <section className="form-panel creation-form-panel">
                    <Title level={4}>新建能力</Title>
                    <div className="creation-form-content">
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
                        onImageRecognize={recognizeProjectImage}
                      />
                      <Form className="creation-details-form" form={projectForm} layout="vertical" onFinish={submitProject} initialValues={{ status: 'researching', tag_ids: [] }}>
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
                    </div>
                  </section>}
                  <section className="table-panel">
                    <div className="table-toolbar">
                      {role === 'research' && (
                        <Segmented
                          value={researchCapabilityView}
                          options={[
                            { label: '匹配到的能力', value: 'matched' },
                            { label: '能力维护', value: 'managed' },
                          ]}
                          onChange={(value) => {
                            setResearchCapabilityView(value as 'matched' | 'managed')
                            setCapabilityCoverageFilter('all')
                          }}
                        />
                      )}
                      {showCapabilityMatches ? (
                        <Space wrap>
                          <Text type="secondary">选择需求查看匹配到的能力</Text>
                          <Select
                            className="table-filter"
                            allowClear
                            placeholder="选择需求"
                            options={filteredRequirements.map((requirement) => ({ label: requirement.title, value: requirement.id }))}
                            value={selectedCapabilityRequirementId ?? undefined}
                            onChange={(value?: number) => {
                              setSelectedCapabilityRequirementId(value ?? null)
                              setCapabilityCoverageFilter('all')
                              if (value !== undefined && !aiMatchResults[value]) {
                                void loadLatestAIMatchResult(value)
                              }
                            }}
                          />
                          <Select
                            className="table-filter"
                            value={capabilityCoverageFilter}
                            options={[{ label: '全部匹配结果', value: 'all' }, ...coverageOptions]}
                            onChange={setCapabilityCoverageFilter}
                          />
                        </Space>
                      ) : (
                        <Select
                          className="table-filter"
                          allowClear
                          placeholder="按标签筛选能力"
                          options={tagOptions}
                          value={selectedProjectTagId ?? undefined}
                          onChange={(value?: number) => setSelectedProjectTagId(value ?? null)}
                        />
                      )}
                    </div>
                    {showCapabilityMatches ? (
                      <>
                        <div className="table-section-heading">
                          <div>
                            <Title level={4}>匹配到的能力</Title>
                            <Text type="secondary">
                              {selectedCapabilityRequirement
                                ? `当前需求：${selectedCapabilityRequirement.title}；AI 推荐仅供参考，正式关联待管理确认。`
                                : '请先选择一条需求，再查看匹配到的能力。'}
                            </Text>
                          </div>
                          {selectedCapabilityMatchResult && (
                            <AntTag color="blue">{selectedCapabilityMatchResult.model}</AntTag>
                          )}
                        </div>
                        {!selectedCapabilityRequirement && (
                          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="请选择需求后查看匹配到的能力" />
                        )}
                        {selectedCapabilityRequirement && !selectedCapabilityMatchResult && (
                          <Empty
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                            description="该需求尚未完成 AI 匹配，请在需求详情中点击“分析匹配能力”"
                          />
                        )}
                        {selectedCapabilityMatchResult && selectedCapabilityMatchResult.recommendations.length === 0 && (
                          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="未发现达到阈值的候选能力" />
                        )}
                        {selectedCapabilityMatchResult && selectedCapabilityMatchResult.recommendations.length > 0 && (
                          <Table
                            rowKey="project_id"
                            columns={aiCapabilityColumns}
                            dataSource={selectedCapabilityRecommendations}
                            pagination={false}
                            scroll={{ x: 1120 }}
                          />
                        )}
                      </>
                    ) : (
                      <>
                        <div className="table-section-heading">
                          <div>
                            <Title level={4}>能力维护</Title>
                            <Text type="secondary">仅供研发维护能力资产；业务查看请切换到“匹配到的能力”。</Text>
                          </div>
                        </div>
                        <Table rowKey="id" columns={projectColumns} dataSource={filteredProjects} loading={loading} pagination={false} scroll={{ x: 860 }} />
                      </>
                    )}
                  </section>
                </div>
              ),
            },
            {
              key: 'requirements',
              label: role === 'research' ? '匹配到的需求' : '需求表',
              children: (
                role === 'research' ? (
                  <ReviewQueue
                    requirements={requirements}
                    matches={matches}
                    reviewer={displayName}
                    role={role}
                    onReviewed={loadData}
                    onOpenRequirement={(requirement) => void openDetail({ type: 'requirement', item: requirement })}
                  />
                ) : (
                  <div className={`workbench-grid creation-workbench${capabilities.canCreateRequirement ? '' : ' read-only'}`}>
                    {capabilities.canCreateRequirement && <section className="form-panel creation-form-panel">
                    <Title level={4}>新建需求</Title>
                    <div className="creation-form-content">
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
                        onImageRecognize={recognizeRequirementImage}
                      />
                      <Form className="creation-details-form" form={requirementForm} layout="vertical" onFinish={submitRequirement} initialValues={{ urgency: 'medium', status: 'pending_review', tag_ids: [] }}>
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
                        {role === 'admin' ? (
                          <Form.Item name="status" label="状态">
                            <Select options={requirementStatusOptions.filter((option) => !option.label.includes('历史'))} />
                          </Form.Item>
                        ) : (
                          <Form.Item name="status" hidden><Input /></Form.Item>
                        )}
                        <Form.Item name="tag_ids" label="标签">
                          <Select mode="multiple" options={tagOptions} />
                        </Form.Item>
                        <Form.Item name="description" label="描述" rules={requirementDescriptionRules}>
                          <TextArea rows={4} />
                        </Form.Item>
                        <Button type="primary" htmlType="submit" icon={<PlusOutlined />} block>
                          创建
                        </Button>
                      </Form>
                    </div>
                    </section>}
                    <section className="table-panel">
                    <div className="table-toolbar">
                      {role === 'sales' && <Text type="secondary">仅展示我提交的需求</Text>}
                      <Select
                        className="table-filter"
                        allowClear
                        placeholder="按标签筛选需求"
                        options={tagOptions}
                        value={selectedRequirementTagId ?? undefined}
                        onChange={(value?: number) => setSelectedRequirementTagId(value ?? null)}
                      />
                    </div>
                    {role === 'sales' ? (
                      <div className="sales-requirement-grid">
                        {filteredRequirements.map((requirement) => {
                          const requirementMatches = matches.filter((item) => item.requirement_id === requirement.id)
                          const approvedMatches = requirementMatches.filter((item) => item.review_status === 'approved')
                          const pendingMatches = requirementMatches.filter((item) =>
                            ['pending', 'technical_pending', 'final_pending'].includes(item.review_status),
                          )
                          const progress = approvedMatches.length > 0 ? 100 : pendingMatches.length > 0 ? 65 : requirement.status === 'accepted' ? 35 : 15
                          return (
                            <Card
                              key={requirement.id}
                              title={requirement.title}
                              extra={<AntTag>{labelOf(requirementStatusOptions, requirement.status)}</AntTag>}
                              actions={[
                                <Button key="details" type="link" icon={<EyeOutlined />} onClick={() => openDetail({ type: 'requirement', item: requirement })}>
                                  查看详情
                                </Button>,
                                <Button
                                  key="capabilities"
                                  type="link"
                                  icon={<SearchOutlined />}
                                  onClick={() => {
                                    setSelectedCapabilityRequirementId(requirement.id)
                                    setCapabilityCoverageFilter('all')
                                    setActiveTab('projects')
                                  }}
                                >
                                  查看匹配能力
                                </Button>,
                                <Button key="edit" type="link" icon={<EditOutlined />} onClick={() => openRequirementEditor(requirement)}>
                                  编辑需求
                                </Button>,
                              ]}
                            >
                              <Space orientation="vertical" size="small" style={{ display: 'flex' }}>
                                <Text type="secondary">{requirement.customer}</Text>
                                <Progress percent={progress} size="small" strokeColor="#3dcd58" />
                                <Text>
                                  {approvedMatches.length > 0
                                    ? `已确认能力：${approvedMatches.map((item) => item.project.name).join('、')}`
                                    : pendingMatches.length > 0
                                      ? `${pendingMatches.length} 个匹配正在等待确认`
                                      : '尚未进入能力匹配'}
                                </Text>
                                {renderTags(requirement.tags)}
                              </Space>
                            </Card>
                          )
                        })}
                        {filteredRequirements.length === 0 && <Empty description="暂无我的需求" />}
                      </div>
                    ) : (
                      <Table rowKey="id" columns={requirementColumns} dataSource={filteredRequirements} loading={loading} pagination={false} scroll={{ x: 920 }} />
                    )}
                    </section>
                  </div>
                )
              ),
            },
            {
              key: 'reviews',
              label: role === 'admin' ? '管理审核' : '技术评估',
              children: (
                <ReviewQueue
                  requirements={requirements}
                  matches={matches}
                  reviewer={displayName}
                  role={role}
                  onReviewed={loadData}
                  onOpenRequirement={(requirement) => void openDetail({ type: 'requirement', item: requirement })}
                />
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
              label: '关联编排',
              children: (
                <div className={`workbench-grid${capabilities.canCreateMatches ? '' : ' read-only'}`}>
                  {capabilities.canCreateMatches && <section className="form-panel">
                    <Title level={4}>手动关联（补充通道）</Title>
                    <Text type="secondary">优先在需求详情中使用 AI 推荐；这里用于人工补充需求—能力关联。</Text>
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
                        发起技术确认
                      </Button>
                    </Form>
                  </section>}
                  <section className="table-panel">
                    <Table rowKey="id" columns={matchColumns} dataSource={matches} loading={loading} pagination={false} scroll={{ x: 760 }} />
                  </section>
                </div>
              ),
            },
          ].filter((item) => visibleTabKeys.includes(item.key))}
        />

        <PersonalTaskCenter
          data={pilotTasks}
          loading={loading}
          onOpenTask={openPilotTask}
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
        title={detailTarget ? `${detailTypeLabel} #${detailTarget.item.id}` : detailTypeLabel}
        size="large"
        open={detailTarget !== null}
        onClose={() => {
          setDetailTarget(null)
          setComments([])
          setReviewEvents([])
          setReviewerAssignment('')
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
          <>
            <section className="requirement-detail-overview">
              <div className="requirement-detail-heading">
                <div>
                  <Text type="secondary">需求主题</Text>
                  <Title level={4}>{detailTarget.item.title}</Title>
                </div>
                <Space wrap>
                  <AntTag color={detailTarget.item.urgency === 'high' ? 'red' : detailTarget.item.urgency === 'medium' ? 'gold' : 'blue'}>
                    {labelOf(urgencyOptions, detailTarget.item.urgency)}优先级
                  </AntTag>
                  <AntTag color={detailTarget.item.status === 'pending_review' ? 'blue' : 'default'}>
                    {labelOf(requirementStatusOptions, detailTarget.item.status)}
                  </AntTag>
                </Space>
              </div>

              <div className="requirement-meta-grid">
                <div>
                  <Text type="secondary">客户</Text>
                  <Text strong>{detailTarget.item.customer}</Text>
                </div>
                <div>
                  <Text type="secondary">联系人</Text>
                  <Text strong>{detailTarget.item.contact || '未提供'}</Text>
                </div>
                <div>
                  <Text type="secondary">提交时间</Text>
                  <Text strong>{new Date(detailTarget.item.created_at).toLocaleString()}</Text>
                </div>
                <div>
                  <Text type="secondary">标签</Text>
                  {detailTarget.item.tags.length > 0 ? renderTags(detailTarget.item.tags) : <Text strong>暂无标签</Text>}
                </div>
              </div>

              <div className="requirement-description-block">
                <Text strong>需求描述</Text>
                {isRequirementDescriptionIncomplete(detailTarget.item.description) ? (
                  <Alert
                    type="warning"
                    showIcon
                    title="当前描述不足以支持审核"
                    description={`原始内容：${detailTarget.item.description}。请补充业务场景、目标、数据来源和期望输出。`}
                  />
                ) : (
                  <Text>{detailTarget.item.description}</Text>
                )}
              </div>

              {requirementDataIssues.length > 0 && (
                <Alert
                  type="info"
                  showIcon
                  title="历史资料说明"
                  description={`${requirementDataIssues.join('；')}。系统不会凭空推断缺失人员信息。`}
                  action={capabilities.canEditRequirement ? (
                    <Button size="small" onClick={() => openRequirementEditor(detailTarget.item)}>
                      补充资料
                    </Button>
                  ) : undefined}
                />
              )}
            </section>

            <Space className="requirement-detail-actions" wrap>
              {capabilities.canCreateRequirement && ['draft', 'new', 'reviewing'].includes(detailTarget.item.status) && (
                <Button type="primary" onClick={() => changeRequirementStatus('pending_review')}>
                  {detailTarget.item.status === 'draft' ? '重新提交审核' : '提交审核'}
                </Button>
              )}
              {role === 'admin' && ['accepted', 'matching'].includes(detailTarget.item.status) && (
                <Button danger onClick={() => changeRequirementStatus('shelved')}>
                  搁置需求
                </Button>
              )}
              {role === 'admin' && detailTarget.item.status === 'shelved' && (
                <Button type="primary" onClick={() => changeRequirementStatus('accepted')}>
                  恢复受理
                </Button>
              )}
              {role === 'admin' && detailTarget.item.status === 'closed' && (
                <Button onClick={() => changeRequirementStatus('shelved')}>
                  迁移为已搁置
                </Button>
              )}
            </Space>

            <Card
              size="small"
              className="requirement-review-card"
              title="审核流程"
              extra={<AntTag color={detailTarget.item.reviewed_by ? 'green' : detailTarget.item.assigned_reviewer ? 'blue' : 'gold'}>
                {detailTarget.item.reviewed_by ? '已审核' : detailTarget.item.assigned_reviewer ? '已指派' : '待指派'}
              </AntTag>}
            >
              <div className="requirement-review-flow">
                <div className="review-flow-item complete">
                  <Text type="secondary">01 · 需求提交人</Text>
                  <Text strong>{requirementReview?.submitter}</Text>
                  <Text type="secondary">{new Date(detailTarget.item.created_at).toLocaleString()}</Text>
                </div>
                <div className={`review-flow-item ${detailTarget.item.assigned_reviewer ? 'complete' : ''}`}>
                  <Text type="secondary">02 · 审核负责人</Text>
                  <Text strong>{requirementReview?.assignee}</Text>
                  <Text type="secondary">
                    {detailTarget.item.assigned_reviewer ? '负责本次需求审核' : '等待管理员指派'}
                  </Text>
                </div>
                <div className={`review-flow-item ${detailTarget.item.reviewed_by ? 'complete' : ''}`}>
                  <Text type="secondary">03 · 实际审核人</Text>
                  <Text strong>{requirementReview?.reviewer}</Text>
                  <Text type="secondary">
                    {detailTarget.item.reviewed_at
                      ? new Date(detailTarget.item.reviewed_at).toLocaleString()
                      : '审核完成后记录'}
                  </Text>
                </div>
              </div>

              <div className="review-note">
                <Text type="secondary">审核意见</Text>
                <Text>{requirementReview?.reviewNote}</Text>
              </div>

              {role === 'admin' && ['new', 'reviewing', 'pending_review'].includes(detailTarget.item.status) && (
                <div className="reviewer-assignment">
                  <div>
                    <Text strong>指派审核负责人</Text>
                    <Text type="secondary">
                      {['new', 'reviewing'].includes(detailTarget.item.status)
                        ? '指派后会将历史需求纳入待审核队列。'
                        : '只有被指派的管理员可以执行需求审核。'}
                    </Text>
                  </div>
                  <Space.Compact className="reviewer-assignment-control">
                    <Input
                      value={reviewerAssignment}
                      placeholder="输入审核人姓名"
                      onChange={(event) => setReviewerAssignment(event.target.value)}
                      onPressEnter={() => void assignReviewer()}
                    />
                    <Button
                      type="primary"
                      loading={assigningReviewer}
                      disabled={!reviewerAssignment.trim()}
                      onClick={() => void assignReviewer()}
                    >
                      {['new', 'reviewing'].includes(detailTarget.item.status) ? '指派并进入审核' : '保存指派'}
                    </Button>
                  </Space.Compact>
                </div>
              )}
            </Card>

            <Card
              size="small"
              className="detail-section-card"
              title={aiMatchTitle}
              extra={(
                <Button type="primary" icon={<SearchOutlined />} loading={aiMatchLoading} onClick={runAIMatching}>
                  {aiMatchTitle}
                </Button>
              )}
            >
              {!aiMatchResult && (
                <Space direction="vertical" size="small">
                  <Text type="secondary">
                    {role === 'research'
                      ? 'AI 根据需求内容整理可能相关的能力，供研发技术确认；正式关联由管理员发起。'
                      : 'AI 根据当前需求筛选可能匹配的能力，推荐结果仍需研发确认和管理员批准。'}
                  </Text>
                  {aiMatchLoading && (
                    <Alert
                      type="info"
                      showIcon
                      message={aiMatchProgress}
                      description={aiMatchPreview || '正在理解需求背景并寻找合适的能力，请稍候。'}
                    />
                  )}
                </Space>
              )}
              {aiMatchResult && (
                <Space direction="vertical" size="middle" style={{ display: 'flex' }}>
                  {aiMatchResult.warnings.map((warning) => (
                    <Alert key={warning} type="warning" showIcon message={warning} />
                  ))}
                  {aiMatchResult.recommendations.map((recommendation) => (
                    <Card
                      key={recommendation.project_id}
                      size="small"
                      title={`${recommendation.project.name} · ${recommendation.score.toFixed(0)} 分`}
                      extra={capabilities.canCreateMatches ? (
                        <Button
                          type="primary"
                          size="small"
                          disabled={recommendation.already_confirmed}
                          onClick={() => confirmAIRecommendation(recommendation)}
                        >
                          {recommendation.already_confirmed ? '已提交' : '发起技术确认'}
                        </Button>
                      ) : null}
                    >
                      <Space direction="vertical" size={6}>
                        <AntTag color={recommendation.coverage_status === 'covered' ? 'green' : 'gold'}>
                          {coverageLabel(recommendation.coverage_status)}
                        </AntTag>
                        <Text>{recommendation.reason}</Text>
                        {recommendation.gaps.length > 0 && (
                          <Text type="secondary">能力缺口：{recommendation.gaps.join('；')}</Text>
                        )}
                        <Text type="secondary">
                          匹配依据：{[
                            ['内容相关性', recommendation.dimensions.semantic],
                            ['行业场景', recommendation.dimensions.industry],
                            ['应用场景', recommendation.dimensions.scenario],
                            ['交付可行性', recommendation.dimensions.delivery],
                          ].filter(([, value]) => typeof value === 'number').map(([label, value]) => `${label} ${value} 分`).join(' / ')}
                        </Text>
                      </Space>
                    </Card>
                  ))}
                  {aiMatchResult.recommendations.length === 0 && (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="未发现达到阈值的候选能力" />
                  )}
                  {role === 'research' && aiMatchResult.recommendations.length > 0 && (
                    <Alert
                      type="info"
                      showIcon
                      message="技术评估提示"
                      description="这些是 AI 候选能力。管理员发起正式关联后，研发可在“待技术确认关联”中补充技术意见并完成确认。"
                    />
                  )}
                  <Text type="secondary">以上内容由平台根据当前需求和能力资料整理，最终结果以人工确认记录为准。</Text>
                </Space>
              )}
            </Card>

            <Card size="small" className="detail-section-card" title="审核记录">
              {reviewEvents.length === 0 ? (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="尚未发生指派或审核操作"
                />
              ) : (
                <div className="comment-list">
                  {reviewEvents.map((event) => (
                    <div className="comment-item" key={event.id}>
                      <Space>
                        <Text strong>{event.actor}</Text>
                        <AntTag>{reviewActionLabel(event.action)}</AntTag>
                        <Text type="secondary">{new Date(event.created_at).toLocaleString()}</Text>
                      </Space>
                      <div className="comment-content">
                        {labelOf(requirementStatusOptions, event.from_status)} → {labelOf(requirementStatusOptions, event.to_status)}
                        {event.note ? `；${event.note}` : ''}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </>
        )}

        <Card
          size="small"
          className="detail-section-card"
          title={detailTarget?.type === 'requirement' ? '已关联能力' : '已关联需求'}
          extra={<AntTag>{relatedMatches.length} 项</AntTag>}
        >
          {relatedMatches.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={detailTarget?.type === 'requirement' ? '尚未建立能力关联' : '尚未建立需求关联'}
            />
          ) : (
            <Table rowKey="id" columns={matchColumns} dataSource={relatedMatches} pagination={false} size="small" scroll={{ x: 640 }} />
          )}
        </Card>

        <Card size="small" className="detail-section-card collaboration-card" title="协作记录">
          <div className="collaboration-layout">
            <div className="collaboration-history">
              {commentsLoading && <Text type="secondary">评论加载中...</Text>}
              {!commentsLoading && comments.length === 0 && (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无协作留言" />
              )}
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

            <Form form={commentForm} layout="vertical" onFinish={submitComment} className="comment-form">
              <Form.Item name="author" label="参与人" rules={[{ required: true, message: '请输入姓名或角色' }]}>
                <Input placeholder="当前使用人" />
              </Form.Item>
              <Form.Item name="content" label="添加留言" rules={[{ required: true, message: '请输入评论内容' }]}>
                <TextArea rows={3} placeholder="补充进展、问题或需要协同的事项" />
              </Form.Item>
              <Button type="primary" htmlType="submit" icon={<PlusOutlined />}>
                添加留言
              </Button>
            </Form>
          </div>
        </Card>
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
            <Select options={requirementStatusOptions} disabled />
          </Form.Item>
          <Form.Item name="tag_ids" label="标签">
            <Select mode="multiple" options={tagOptions} />
          </Form.Item>
          <Form.Item name="description" label="描述" rules={requirementDescriptionRules}>
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
