import assert from 'node:assert/strict'
import test from 'node:test'

import { getRoleCapabilities, isRoleId } from './permissions.ts'


test('销售以需求池为主，只能维护需求', () => {
  const capabilities = getRoleCapabilities('sales')

  assert.equal(capabilities.defaultTab, 'requirements')
  assert.equal(capabilities.canCreateRequirement, true)
  assert.equal(capabilities.canEditRequirement, true)
  assert.equal(capabilities.canManageProjects, false)
  assert.equal(capabilities.canReviewRequirements, false)
  assert.equal(capabilities.canReviewMatches, false)
  assert.equal(capabilities.canManageKnowledge, false)
})


test('研发以能力池为主，可以维护能力并确认匹配', () => {
  const capabilities = getRoleCapabilities('research')

  assert.equal(capabilities.defaultTab, 'projects')
  assert.equal(capabilities.canCreateRequirement, false)
  assert.equal(capabilities.canEditRequirement, false)
  assert.equal(capabilities.canManageProjects, true)
  assert.equal(capabilities.canReviewRequirements, false)
  assert.equal(capabilities.canReviewMatches, true)
  assert.equal(capabilities.canManageKnowledge, false)
})


test('管理员拥有审核和知识库管理能力', () => {
  const capabilities = getRoleCapabilities('admin')

  assert.equal(capabilities.defaultTab, 'dashboard')
  assert.equal(capabilities.canCreateRequirement, true)
  assert.equal(capabilities.canEditRequirement, true)
  assert.equal(capabilities.canManageProjects, true)
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
