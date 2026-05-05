import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { DataProvider } from './contexts/DataContext'
import { supabaseConfigured } from './lib/supabase'
import Navbar from './components/Navbar'
import { useData } from './contexts/DataContext'
import LoginPage from './pages/LoginPage'
import ImportPage from './pages/ImportPage'
import PracticePage from './pages/PracticePage'
import FlashcardsPage from './pages/FlashcardsPage'

function NotConfigured() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: '1.5rem' }}>
      <div style={{ maxWidth: 480, width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <p style={{ fontSize: '2.5rem' }}>⚙️</p>
          <h1 style={{ fontSize: '1.3rem', fontWeight: 700 }}>Configuração necessária</h1>
        </div>
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '1.5rem' }}>
          <p style={{ marginBottom: '1rem', color: '#374151' }}>
            O app precisa das credenciais do <strong>Supabase</strong> para funcionar. Siga os passos:
          </p>
          <ol style={{ paddingLeft: '1.25rem', lineHeight: 2, color: '#374151', fontSize: '.95rem' }}>
            <li>Acesse <a href="https://supabase.com" target="_blank" rel="noreferrer" style={{ color: '#2563eb' }}>supabase.com</a> e crie um projeto gratuito.</li>
            <li>No projeto, vá em <strong>Settings → API</strong> e copie a <em>Project URL</em> e a <em>anon public key</em>.</li>
            <li>No <a href="https://vercel.com/dashboard" target="_blank" rel="noreferrer" style={{ color: '#2563eb' }}>Vercel</a>, abra o projeto → <strong>Settings → Environment Variables</strong> e adicione:
              <div style={{ background: '#f1f5f9', borderRadius: 8, padding: '.75rem 1rem', margin: '.5rem 0', fontFamily: 'monospace', fontSize: '.85rem', lineHeight: 2 }}>
                <div><strong>VITE_SUPABASE_URL</strong> = https://xxx.supabase.co</div>
                <div><strong>VITE_SUPABASE_ANON_KEY</strong> = eyJ...</div>
              </div>
            </li>
            <li>Execute o arquivo <code>supabase-setup.sql</code> no <strong>SQL Editor</strong> do Supabase.</li>
            <li>Em <strong>Storage</strong>, crie um bucket chamado <code>question-media</code> (marcar como Public).</li>
            <li>Clique em <strong>Redeploy</strong> no Vercel.</li>
          </ol>
          <p style={{ marginTop: '1rem', fontSize: '.88rem', color: '#6b7280' }}>
            O acesso é por usuário. Qualquer nome digitado na tela de login cria/acessa os dados daquele usuário.
          </p>
        </div>
      </div>
    </div>
  )
}

function DbErrorBanner() {
  const { dbError } = useData()
  if (!dbError) return null
  return (
    <div style={{
      background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8,
      padding: '.75rem 1rem', margin: '1rem', fontSize: '.87rem', color: '#991b1b',
    }}>
      ⚠️ <strong>Problema com o banco de dados:</strong> {dbError}
    </div>
  )
}

function AppShell() {
  const { loggedIn } = useAuth()
  if (!loggedIn) return <LoginPage />
  return (
    <DataProvider>
      <div className="layout">
        <Navbar />
        <DbErrorBanner />
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
  if (!supabaseConfigured) return <NotConfigured />
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
