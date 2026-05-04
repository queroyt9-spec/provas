import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

export default function LoginPage() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode]       = useState<'login' | 'signup'>('login')
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [info, setInfo]       = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setInfo('')
    setLoading(true)

    if (mode === 'login') {
      const err = await signIn(email, password)
      if (err) setError(err)
    } else {
      const err = await signUp(email, password)
      if (err) {
        setError(err)
      } else {
        setInfo('Conta criada! Verifique seu e-mail para confirmar o cadastro, depois faça login.')
        setMode('login')
      }
    }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', padding: '1.5rem',
    }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <p style={{ fontSize: '2rem', marginBottom: '.25rem' }}>📚</p>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>SED/SC – Treinador de Questões</h1>
          <p className="muted mt-1" style={{ fontSize: '.88rem' }}>
            {mode === 'login' ? 'Entre na sua conta para continuar.' : 'Crie uma conta para começar.'}
          </p>
        </div>

        <div className="card">
          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '2px solid var(--border)', marginBottom: '1.25rem', gap: '.25rem' }}>
            {(['login', 'signup'] as const).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(''); setInfo('') }}
                style={{
                  background: 'none', border: 'none', padding: '.4rem .85rem', cursor: 'pointer',
                  fontWeight: 600, fontSize: '.88rem',
                  color: mode === m ? 'var(--brand)' : 'var(--muted)',
                  borderBottom: mode === m ? '2px solid var(--brand)' : '2px solid transparent',
                  marginBottom: '-2px',
                }}
              >
                {m === 'login' ? 'Entrar' : 'Criar conta'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '.75rem' }}>
              <label>E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                autoFocus
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label>Senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="mínimo 6 caracteres"
                minLength={6}
                required
              />
            </div>

            {error && (
              <div className="feedback wrong" style={{ marginBottom: '.75rem' }}>
                ❌ {error}
              </div>
            )}
            {info && (
              <div className="feedback correct" style={{ marginBottom: '.75rem' }}>
                ✅ {info}
              </div>
            )}

            <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%' }}>
              {loading ? 'Aguarde…' : mode === 'login' ? 'Entrar' : 'Criar conta'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
