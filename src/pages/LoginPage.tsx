import { useState } from 'react'
import { supabase } from '../lib/supabase'

// Conta fixa — invisível para o usuário.
// Troque a senha abaixo para a senha que sua mãe vai usar.
const APP_EMAIL    = 'mae@sedsc.app'
const MIN_PASSWORD = 6

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < MIN_PASSWORD) {
      setError(`A senha deve ter pelo menos ${MIN_PASSWORD} caracteres.`)
      return
    }
    setError('')
    setLoading(true)

    // Tenta entrar; se não existir ainda, cria a conta automaticamente.
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: APP_EMAIL,
      password,
    })

    if (signInErr) {
      // Conta ainda não existe → cria na primeira vez
      const { error: signUpErr } = await supabase.auth.signUp({
        email: APP_EMAIL,
        password,
        options: { emailRedirectTo: window.location.href },
      })
      if (signUpErr) {
        setError('Senha incorreta ou erro ao entrar. Tente novamente.')
      }
    }

    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'var(--bg)', padding: '1.5rem',
    }}>
      <div style={{ width: '100%', maxWidth: 340 }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <p style={{ fontSize: '2.5rem', marginBottom: '.25rem' }}>📚</p>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
            Treinador SED/SC
          </h1>
          <p className="muted mt-1" style={{ fontSize: '.9rem' }}>
            Digite a senha para entrar.
          </p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1rem' }}>
              <label>Senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                minLength={MIN_PASSWORD}
                required
                autoFocus
                style={{ fontSize: '1.1rem', letterSpacing: '.15em' }}
              />
            </div>

            {error && (
              <div className="feedback wrong" style={{ marginBottom: '.75rem' }}>
                {error}
              </div>
            )}

            <button
              className="btn btn-primary"
              type="submit"
              disabled={loading}
              style={{ width: '100%', fontSize: '1rem' }}
            >
              {loading ? 'Entrando…' : 'Entrar →'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
