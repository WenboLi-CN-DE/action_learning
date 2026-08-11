import assert from 'node:assert/strict'
import test from 'node:test'

import { getAIStructureProgress } from './aiStructureProgress.ts'

test('结构化请求展示真实且可理解的等待阶段', () => {
  assert.deepEqual(getAIStructureProgress({ loading: true, elapsedSeconds: 2 }), {
    current: 1,
    items: [
      { title: '请求已发送', status: 'finish' },
      {
        title: '正在调用 AI 模型',
        status: 'process',
        description: '已等待 2 秒；完成后将展示可编辑的结构化字段和建议补充项',
      },
      { title: '整理结构化字段', status: 'wait' },
    ],
  })

  assert.equal(
    getAIStructureProgress({ loading: true, elapsedSeconds: 27 }).items[1].description,
    '模型响应较慢；超过上游 30 秒限制后将生成可编辑字段',
  )
})

test('超时兜底与正常模型结果使用不同的完成提示', () => {
  assert.equal(
    getAIStructureProgress({ loading: false, usedFallback: true }).items[2].title,
    '已按保障规则整理字段',
  )
  assert.equal(
    getAIStructureProgress({ loading: false, usedFallback: false }).items[2].title,
    '字段整理完成',
  )
})
