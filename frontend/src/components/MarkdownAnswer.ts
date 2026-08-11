import React from 'react'
import ReactMarkdown from 'react-markdown'

type MarkdownAnswerProps = {
  content: string
}

/**
 * 渲染 AI 回答中的 Markdown。react-markdown 默认不执行原始 HTML，避免模型输出被当作脚本插入页面。
 */
export default function MarkdownAnswer({ content }: MarkdownAnswerProps) {
  return React.createElement(
    'div',
    { className: 'markdown-answer' },
    React.createElement(ReactMarkdown, null, content),
  )
}
