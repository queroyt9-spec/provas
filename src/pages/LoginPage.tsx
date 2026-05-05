import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

export default function LoginPage() {
  const { signIn } = useAuth()
  const [username, setUsername] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (username.trim()) signIn(username)
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'var(--bg)', padding: '1.5rem',
    }}>
      <div style={{ width: '100%', maxWidth: 320 }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <p style={{ fontSize: '2.5rem', marginBottom: '.25rem' }}>📚</p>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Treinador SED/SC</h1>
          <p className="muted mt-1" style={{ fontSize: '.9rem' }}>Digite seu nome de usuário para entrar.</p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1rem' }}>
              <label>Usuário</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="seu usuário"
                required
                autoFocus
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>
            <button
              className="btn btn-primary"
              type="submit"
              style={{ width: '100%', fontSize: '1rem' }}
              disabled={!username.trim()}
            >
              Entrar →
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
