import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import MarkdownAnswer from './components/MarkdownAnswer.ts'

test('renders AI answer markdown as formatted HTML', () => {
  const html = renderToStaticMarkup(
    React.createElement(MarkdownAnswer, {
      content: '**EcoStruxure 数据中心能效诊断包**\n\n- 核心功能：负载分析\n- 当前状态：研究中',
    }),
  )

  assert.match(html, /<strong>EcoStruxure 数据中心能效诊断包<\/strong>/)
  assert.match(html, /<ul>[\s\S]*<li>核心功能：负载分析<\/li>[\s\S]*<\/ul>/)
  assert.doesNotMatch(html, /\*\*EcoStruxure/)
})
