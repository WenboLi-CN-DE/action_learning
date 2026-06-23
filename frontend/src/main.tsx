import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import zhCN from 'antd/locale/zh_CN'
import { ConfigProvider } from 'antd'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#3DCD58',
          colorSuccess: '#3DCD58',
          colorInfo: '#17833B',
          colorText: '#1F2A24',
          colorTextSecondary: '#5B6B61',
          colorBgLayout: '#F3F6F3',
          colorBorder: '#DCE5DD',
          borderRadius: 6,
          fontFamily:
            'Poppins, "Microsoft YaHei", "Noto Sans SC", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        },
        components: {
          Button: {
            primaryColor: '#0A2F24',
            colorPrimaryHover: '#33B94E',
            colorPrimaryActive: '#2AA544',
            controlHeight: 36,
          },
          Tabs: {
            itemSelectedColor: '#0A2F24',
            inkBarColor: '#3DCD58',
          },
          Table: {
            headerBg: '#F7FAF7',
            headerColor: '#26332C',
            rowHoverBg: '#F3FBF4',
          },
          Tag: {
            borderRadiusSM: 4,
          },
        },
      }}
    >
      <App />
    </ConfigProvider>
  </React.StrictMode>,
)
