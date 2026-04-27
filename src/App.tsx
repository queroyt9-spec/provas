import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import Navbar from './components/Navbar'
import ImportPage from './pages/ImportPage'
import PracticePage from './pages/PracticePage'
import FlashcardsPage from './pages/FlashcardsPage'

export default function App() {
  return (
    <HashRouter>
      <div className="layout">
        <Navbar />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Navigate to="/praticar" replace />} />
            <Route path="/importar" element={<ImportPage />} />
            <Route path="/praticar" element={<PracticePage />} />
            <Route path="/flashcards" element={<FlashcardsPage />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  )
}
