import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Routes, Route } from 'react-router'
import WorkbenchPage from './pages/WorkbenchPage'
import KnowledgeSearchPage from './pages/KnowledgeSearchPage'
import RoleSelectionPage from './pages/RoleSelectionPage'
import { isRoleId } from './auth/permissions'
import { useRoleStore } from './auth/roleStore'
import ChatAssistant from './components/ChatAssistant'
import './App.css'

function IdentityRequired({ children }: { children: ReactNode }) {
  const role = useRoleStore((state) => state.role)
  return isRoleId(role) ? <>{children}<ChatAssistant /></> : <Navigate to="/role" replace />
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/role" element={<RoleSelectionPage />} />
        <Route path="/" element={<IdentityRequired><WorkbenchPage /></IdentityRequired>} />
        <Route path="/search" element={<IdentityRequired><KnowledgeSearchPage /></IdentityRequired>} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
