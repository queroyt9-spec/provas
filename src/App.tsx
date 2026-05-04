import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { DataProvider } from './contexts/DataContext'
import Navbar from './components/Navbar'
import LoginPage from './pages/LoginPage'
import ImportPage from './pages/ImportPage'
import PracticePage from './pages/PracticePage'
import FlashcardsPage from './pages/FlashcardsPage'

function AppShell() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--muted)' }}>Carregando…</p>
      </div>
    )
  }

  if (!user) return <LoginPage />

  return (
    <DataProvider>
      <div className="layout">
        <Navbar />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Navigate to="/praticar" replace />} />
            <Route path="/importar"   element={<ImportPage />} />
            <Route path="/praticar"   element={<PracticePage />} />
            <Route path="/flashcards" element={<FlashcardsPage />} />
          </Routes>
        </main>
      </div>
    </DataProvider>
  )
}

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <Routes>
          <Route path="*" element={<AppShell />} />
        </Routes>
      </AuthProvider>
    </HashRouter>
  )
}
