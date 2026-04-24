const API_BASE = '/api/v1'

async function fetchJSON(path: string, options: RequestInit = {}): Promise<any> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`)
  }
  return response.json()
}

// 健康检查
export const fetchHealth = () => fetchJSON('/health')

// 联调 demo 数据
export const fetchDemoData = () => fetchJSON('/demo')
