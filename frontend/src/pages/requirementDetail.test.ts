import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getRequirementDataIssues,
  getRequirementReviewPresentation,
  isRequirementDescriptionIncomplete,
} from './requirementDetail.ts'


test('识别历史占位描述和缺失提交人', () => {
  assert.equal(isRequirementDescriptionIncomplete('具体可以联系'), true)
  assert.equal(isRequirementDescriptionIncomplete('客户希望自动读取变压器数据并生成结构化表格。'), false)

  assert.deepEqual(
    getRequirementDataIssues({
      description: '具体可以联系',
      submitted_by: null,
    }),
    ['需求描述信息不足', '历史数据未记录提交人'],
  )
})


test('未审核字段使用业务状态说明而不是横线', () => {
  assert.deepEqual(
    getRequirementReviewPresentation({
      submitted_by: null,
      assigned_reviewer: null,
      reviewed_by: null,
      reviewed_at: null,
      review_note: null,
    }),
    {
      submitter: '历史数据未记录',
      assignee: '尚未指派',
      reviewer: '尚未审核',
      reviewNote: '审核完成后生成',
    },
  )
})
