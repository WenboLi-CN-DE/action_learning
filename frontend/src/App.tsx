import { BrowserRouter, Routes, Route } from 'react-router'
import DemoPage from './pages/DemoPage'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DemoPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
