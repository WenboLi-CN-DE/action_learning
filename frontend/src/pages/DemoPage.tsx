import { useState, useEffect } from 'react'
import { Card, Typography, Spin, Alert, Descriptions, Tag } from 'antd'
import { fetchHealth, fetchDemoData } from '../services/api'

const { Title, Paragraph } = Typography

interface DemoItem {
  id: number
  name: string
  description: string | null
  created_at: string
}

interface HealthStatus {
  status: string
  service: string
  version: string
}

export default function DemoPage() {
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [demoData, setDemoData] = useState<DemoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        const healthData = await fetchHealth()
        const items = await fetchDemoData()
        setHealth(healthData)
        setDemoData(items)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : '请求失败')
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />

  if (error) return <Alert type="error" message="联调失败" description={error} />

  return (
    <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
      <Title level={2}>🛠 前后端联调 Demo</Title>
      <Paragraph>验证前端通过 Vite proxy 成功访问后端 API</Paragraph>

      <Card title="后端健康状态" style={{ marginBottom: '16px' }}>
        <Descriptions bordered column={1}>
          <Descriptions.Item label="状态">
            <Tag color="green">{health?.status}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="服务名称">{health?.service}</Descriptions.Item>
          <Descriptions.Item label="版本">{health?.version}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="后端测试数据">
        {demoData.map((item) => (
          <Card.Grid key={item.id} style={{ width: '100%', padding: '16px' }}>
            <Title level={4}>{item.name}</Title>
            <Paragraph>{item.description}</Paragraph>
            <Tag>ID: {item.id}</Tag>
          </Card.Grid>
        ))}
      </Card>
    </div>
  )
}
