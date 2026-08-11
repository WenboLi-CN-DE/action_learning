export type AIStructureProgressItem = {
  title: string
  status: 'wait' | 'process' | 'finish' | 'error'
  description?: string
}

export type AIStructureProgress = {
  current: number
  items: AIStructureProgressItem[]
}

type AIStructureProgressInput = {
  loading: boolean
  elapsedSeconds?: number
  usedFallback?: boolean
  error?: boolean
}

export function getAIStructureProgress({
  loading,
  elapsedSeconds = 0,
  usedFallback = false,
  error = false,
}: AIStructureProgressInput): AIStructureProgress {
  if (error) {
    return {
      current: 1,
      items: [
        { title: '请求已发送', status: 'finish' },
        { title: 'AI 调用未完成', status: 'error' },
        { title: '整理结构化字段', status: 'wait' },
      ],
    }
  }

  if (loading) {
    const waitingForModel = elapsedSeconds >= 25
    const elapsedDescription = `已等待 ${elapsedSeconds} 秒；完成后将展示可编辑的结构化字段和建议补充项`
    return {
      current: 1,
      items: [
        { title: '请求已发送', status: 'finish' },
        {
          title: '正在调用 AI 模型',
          status: 'process',
          description: waitingForModel
            ? '模型响应较慢；超过上游 30 秒限制后将生成可编辑字段'
            : elapsedDescription,
        },
        { title: '整理结构化字段', status: 'wait' },
      ],
    }
  }

  return {
    current: 2,
    items: [
      { title: '请求已发送', status: 'finish' },
      { title: usedFallback ? '模型响应超时' : 'AI 模型已返回', status: 'finish' },
      {
        title: usedFallback ? '已按保障规则整理字段' : '字段整理完成',
        status: 'finish',
        description: usedFallback ? '请检查并补充标记为缺失的信息后再应用。' : undefined,
      },
    ],
  }
}
