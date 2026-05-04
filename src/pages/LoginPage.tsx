import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

export default function LoginPage() {
  const { signIn } = useAuth()
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const ok = signIn(password)
    if (!ok) setError('Senha incorreta. Tente novamente.')
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
          <p className="muted mt-1" style={{ fontSize: '.9rem' }}>Digite a senha para entrar.</p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1rem' }}>
              <label>Senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError('') }}
                placeholder="••••••••"
                required
                autoFocus
                style={{ fontSize: '1.1rem', letterSpacing: '.15em' }}
              />
            </div>
            {error && (
              <div className="feedback wrong" style={{ marginBottom: '.75rem' }}>{error}</div>
            )}
            <button className="btn btn-primary" type="submit" style={{ width: '100%', fontSize: '1rem' }}>
              Entrar →
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
