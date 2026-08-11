import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getRoleCapabilities,
  isRoleId,
  isSalesOwnRequirement,
  isSalesVisibleProjectStatus,
} from './permissions.ts'


test('销售以能力表为主，只能维护需求', () => {
  const capabilities = getRoleCapabilities('sales')

  assert.equal(capabilities.defaultTab, 'projects')
  assert.equal(capabilities.canCreateRequirement, true)
  assert.equal(capabilities.canEditRequirement, true)
  assert.equal(capabilities.canManageProjects, false)
  assert.equal(capabilities.canCreateMatches, false)
  assert.equal(capabilities.canReviewRequirements, false)
  assert.equal(capabilities.canReviewMatches, false)
  assert.equal(capabilities.canManageKnowledge, false)
})

test('销售优先浏览已可对外展示的能力', () => {
  assert.equal(getRoleCapabilities('sales').defaultTab, 'projects')
  assert.equal(isSalesVisibleProjectStatus('demo_ready'), true)
  assert.equal(isSalesVisibleProjectStatus('delivered'), true)
  assert.equal(isSalesVisibleProjectStatus('researching'), false)
  assert.equal(isSalesVisibleProjectStatus('paused'), false)
})

test('销售只查看本人提交的需求，不包含历史未署名需求', () => {
  assert.equal(isSalesOwnRequirement('王小明', '王小明'), true)
  assert.equal(isSalesOwnRequirement('李四', '王小明'), false)
  assert.equal(isSalesOwnRequirement(null, '王小明'), false)
})


test('研发以能力表为主，可以维护能力并确认匹配', () => {
  const capabilities = getRoleCapabilities('research')

  assert.equal(capabilities.defaultTab, 'projects')
  assert.equal(capabilities.canCreateRequirement, false)
  assert.equal(capabilities.canEditRequirement, false)
  assert.equal(capabilities.canManageProjects, true)
  assert.equal(capabilities.canCreateMatches, false)
  assert.equal(capabilities.canReviewRequirements, false)
  assert.equal(capabilities.canReviewMatches, true)
  assert.equal(capabilities.canManageKnowledge, false)
})


test('管理员只负责审核、关联编排和知识库管理', () => {
  const capabilities = getRoleCapabilities('admin')

  assert.equal(capabilities.defaultTab, 'reviews')
  assert.equal(capabilities.canCreateRequirement, false)
  assert.equal(capabilities.canEditRequirement, false)
  assert.equal(capabilities.canManageProjects, false)
  assert.equal(capabilities.canCreateMatches, true)
  assert.equal(capabilities.canReviewRequirements, true)
  assert.equal(capabilities.canReviewMatches, true)
  assert.equal(capabilities.canManageKnowledge, true)
})


test('只接受平台定义的角色标识', () => {
  assert.equal(isRoleId('sales'), true)
  assert.equal(isRoleId('research'), true)
  assert.equal(isRoleId('admin'), true)
  assert.equal(isRoleId('super-admin'), false)
  assert.equal(isRoleId(null), false)
})
