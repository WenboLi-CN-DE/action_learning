import { BrowserRouter, Routes, Route } from 'react-router'
import WorkbenchPage from './pages/WorkbenchPage'
import KnowledgeSearchPage from './pages/KnowledgeSearchPage'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<WorkbenchPage />} />
        <Route path="/search" element={<KnowledgeSearchPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
