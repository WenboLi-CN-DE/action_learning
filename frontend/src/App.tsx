import { BrowserRouter, Routes, Route } from 'react-router'
import WorkbenchPage from './pages/WorkbenchPage'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<WorkbenchPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
