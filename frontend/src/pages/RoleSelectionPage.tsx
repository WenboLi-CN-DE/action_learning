import { useState } from 'react'
import { AppstoreOutlined, CodeOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import { Button, Card, Input, Layout, Space, Typography } from 'antd'
import { Navigate, useNavigate } from 'react-router'

import { isRoleId, ROLE_LABELS, type RoleId } from '../auth/permissions'
import { useRoleStore } from '../auth/roleStore'
import schneiderLogo from '../assets/schneider-electric-cn-logo.png'


const { Content } = Layout
const { Title, Text } = Typography

const roleOptions: Array<{
  id: RoleId
  icon: React.ReactNode
  title: string
  description: string
}> = [
  {
    id: 'sales',
    icon: <AppstoreOutlined />,
    title: ROLE_LABELS.sales,
    description: '提交客户需求、跟踪审核状态与能力匹配进展。',
  },
  {
    id: 'research',
    icon: <CodeOutlined />,
    title: ROLE_LABELS.research,
    description: '维护能力表、评估待处理需求并确认匹配。',
  },
  {
    id: 'admin',
    icon: <SafetyCertificateOutlined />,
    title: ROLE_LABELS.admin,
    description: '查看全局总览、审核需求与匹配、管理知识库。',
  },
]

export default function RoleSelectionPage() {
  const navigate = useNavigate()
  const currentRole = useRoleStore((state) => state.role)
  const setIdentity = useRoleStore((state) => state.setIdentity)
  const [role, setRole] = useState<RoleId>('sales')
  const [displayName, setDisplayName] = useState('')

  if (isRoleId(currentRole)) return <Navigate to="/" replace />

  function enterPlatform() {
    const name = displayName.trim() || ROLE_LABELS[role]
    setIdentity(role, name)
    navigate('/', { replace: true })
  }

  return (
    <Layout className="role-selection-shell">
      <Content className="role-selection-content">
        <img className="role-selection-logo" src={schneiderLogo} alt="Schneider Electric" />
        <Title level={1}>选择你的工作身份</Title>

        <div className="role-card-grid">
          {roleOptions.map((option) => (
            <Card
              key={option.id}
              hoverable
              className={`role-card${role === option.id ? ' selected' : ''}`}
              role="button"
              tabIndex={0}
              aria-pressed={role === option.id}
              onClick={() => setRole(option.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  setRole(option.id)
                }
              }}
            >
              <div className="role-card-icon">{option.icon}</div>
              <Title level={3}>{option.title}</Title>
              <Text type="secondary">{option.description}</Text>
            </Card>
          ))}
        </div>

        <Space orientation="vertical" size="middle" className="role-entry-form">
          <Input
            size="large"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            onPressEnter={enterPlatform}
            placeholder={`你的姓名或团队名称（默认：${ROLE_LABELS[role]}）`}
          />
          <Button type="primary" size="large" block onClick={enterPlatform}>
            进入{ROLE_LABELS[role]}工作台
          </Button>
        </Space>
      </Content>
    </Layout>
  )
}
