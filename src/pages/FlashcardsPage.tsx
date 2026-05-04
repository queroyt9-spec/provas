import { useState } from 'react'
import type { Flashcard, FlashcardRating } from '../types'
import { useData } from '../contexts/DataContext'
import { applyRating } from '../utils/flashcardUtils'

const RATING_CONFIG: { rating: FlashcardRating; label: string; cls: string; days: number }[] = [
  { rating: 'wrong', label: '😞 Errei',   cls: 'btn-danger',  days: 1 },
  { rating: 'hard',  label: '😬 Difícil', cls: 'btn-warning', days: 2 },
  { rating: 'good',  label: '🙂 Bom',     cls: 'btn-primary', days: 4 },
  { rating: 'easy',  label: '😄 Fácil',   cls: 'btn-success', days: 7 },
]

function statusStyle(status: Flashcard['status']): React.CSSProperties {
  const map = {
    new:      { background: '#dbeafe', color: '#1e40af' },
    learning: { background: '#fef3c7', color: '#92400e' },
    review:   { background: '#dcfce7', color: '#15803d' },
  }
  return map[status]
}

type SessionMode = 'due' | 'free'
type Session = { mode: SessionMode; deck: Flashcard[]; index: number; done: number; showBack: boolean }

function makeSession(mode: SessionMode, deck: Flashcard[]): Session {
  return { mode, deck, index: 0, done: 0, showBack: false }
}

export default function FlashcardsPage() {
  const { flashcards, saveFlashcard, loading } = useData()
  const [session, setSession] = useState<Session | null>(null)
  const [tab, setTab]         = useState<'review' | 'list'>('review')

  const now = new Date().toISOString()
  const due = flashcards.filter((c) => c.due_at <= now)

  if (loading) {
    return (
      <div>
        <h1 className="page-title">Flashcards</h1>
        <div className="card text-center"><p className="muted">Carregando…</p></div>
      </div>
    )
  }

  if (flashcards.length === 0) {
    return (
      <div>
        <h1 className="page-title">Flashcards</h1>
        <div className="card text-center">
          <p style={{ fontSize: '2rem', marginBottom: '.5rem' }}>🃏</p>
          <p style={{ fontWeight: 600 }}>Nenhum flashcard ainda.</p>
          <p className="muted mt-1">
            Erre uma questão na tela <strong>Praticar</strong> e um flashcard será criado automaticamente.
          </p>
        </div>
      </div>
    )
  }

  function startDueSession() {
    setSession(makeSession('due', flashcards.filter((c) => c.due_at <= new Date().toISOString())))
    setTab('review')
  }

  function startFreeSession(startFrom?: Flashcard) {
    if (flashcards.length === 0) return
    let deck = flashcards
    if (startFrom) {
      const idx = flashcards.findIndex((c) => c.id === startFrom.id)
      deck = idx >= 0 ? [...flashcards.slice(idx), ...flashcards.slice(0, idx)] : flashcards
    }
    setSession(makeSession('free', deck))
    setTab('review')
  }

  function handleRating(rating: FlashcardRating) {
    if (!session) return
    const current = session.deck[session.index]
    const updated = applyRating(current, rating)
    saveFlashcard(updated)

    const next     = session.index + 1
    const finished = next >= session.deck.length

    setSession((s) => s ? {
      ...s,
      index: finished ? s.index : next,
      done:  s.done + 1,
      showBack: false,
      deck: finished ? [] : s.deck,
    } : null)
  }

  // ── Active session ────────────────────────────────────────
  if (session && session.deck.length > 0) {
    const current = session.deck[session.index]
    const isFree  = session.mode === 'free'

    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', marginBottom: '1rem' }}>
          <h1 className="page-title" style={{ margin: 0 }}>
            {isFree ? '🎯 Treino Livre' : '📅 Revisão do Dia'}
          </h1>
          <button className="btn btn-ghost btn-sm" onClick={() => setSession(null)}>✕ Sair</button>
        </div>

        <div className="counter mb-1">
          {session.index + 1} de {session.deck.length} cartões
          {session.done > 0 && ` · ${session.done} revisados`}
        </div>
        <div className="progress-bar-wrap mb-2">
          <div className="progress-bar" style={{ width: `${(session.index / session.deck.length) * 100}%` }} />
        </div>

        <div className="card mb-2">
          <p className="muted mb-1" style={{ fontSize: '.8rem' }}>FRENTE</p>
          <div className="flashcard-face">{current.front}</div>
        </div>

        {!session.showBack ? (
          <button className="btn btn-primary" onClick={() => setSession((s) => s ? { ...s, showBack: true } : s)}>
            Ver resposta
          </button>
        ) : (
          <>
            <div className="card mb-2" style={{ borderColor: 'var(--brand)' }}>
              <p className="muted mb-1" style={{ fontSize: '.8rem' }}>VERSO</p>
              <div className="flashcard-face">{current.back}</div>
            </div>

            <p className="muted mb-1" style={{ fontSize: '.85rem' }}>Como você se saiu?</p>
            <div className="gap-md">
              {RATING_CONFIG.map(({ rating, label, cls, days }) => (
                <button key={rating} className={`btn ${cls}`} onClick={() => handleRating(rating)} title={`Próxima revisão em ${days} dia${days > 1 ? 's' : ''}`}>
                  {label}
                  <span style={{ fontSize: '.75rem', opacity: .8 }}>+{days}d</span>
                </button>
              ))}
            </div>

            {isFree && (
              <button className="btn btn-ghost btn-sm mt-2" onClick={() => {
                const next = session.index + 1
                if (next >= session.deck.length) {
                  setSession((s) => s ? { ...s, deck: [] } : s)
                } else {
                  setSession((s) => s ? { ...s, index: next, showBack: false } : s)
                }
              }}>
                Pular →
              </button>
            )}
          </>
        )}
      </div>
    )
  }

  // ── Session finished ──────────────────────────────────────
  if (session && session.deck.length === 0) {
    return (
      <div>
        <h1 className="page-title">Flashcards</h1>
        <div className="card text-center">
          <p style={{ fontSize: '2rem', marginBottom: '.5rem' }}>🎉</p>
          <p style={{ fontWeight: 600 }}>
            {session.mode === 'due'
              ? `Revisão do dia concluída! (${session.done} cartões)`
              : `Treino livre concluído! (${session.done} cartões)`}
          </p>
          <div className="gap-sm mt-2" style={{ justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={startDueSession} disabled={due.length === 0}>
              Revisão do dia {due.length > 0 ? `(${due.length})` : '(em dia ✅)'}
            </button>
            <button className="btn btn-ghost" onClick={() => startFreeSession()}>Treinar todos</button>
            <button className="btn btn-neutral" onClick={() => setSession(null)}>Ver lista</button>
          </div>
        </div>
      </div>
    )
  }

  // ── Main screen ───────────────────────────────────────────
  return (
    <div>
      <h1 className="page-title">Flashcards</h1>

      <div style={{ display: 'flex', borderBottom: '2px solid var(--border)', marginBottom: '1rem', gap: '.25rem' }}>
        {(['review', 'list'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{
            background: 'none', border: 'none', padding: '.5rem 1rem', cursor: 'pointer',
            fontWeight: 600, fontSize: '.9rem',
            color: tab === t ? 'var(--brand)' : 'var(--muted)',
            borderBottom: tab === t ? '2px solid var(--brand)' : '2px solid transparent',
            marginBottom: '-2px',
          }}>
            {t === 'review' ? '📅 Revisão' : '📋 Todos os cartões'}
          </button>
        ))}
      </div>

      {tab === 'review' && (
        <div>
          <div className="card mb-2">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '.5rem' }}>
              <div>
                <p style={{ fontWeight: 600, marginBottom: '.25rem' }}>📅 Revisão do dia</p>
                {due.length > 0
                  ? <p className="muted">{due.length} cartão{due.length > 1 ? 'ões' : ''} aguardando revisão.</p>
                  : <p className="muted">Nenhum cartão para revisar hoje. Volte amanhã!</p>}
              </div>
              <button className="btn btn-primary" onClick={startDueSession} disabled={due.length === 0}>
                Iniciar revisão
              </button>
            </div>
          </div>

          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '.5rem' }}>
              <div>
                <p style={{ fontWeight: 600, marginBottom: '.25rem' }}>🎯 Treino Livre</p>
                <p className="muted">Treine qualquer cartão, a qualquer hora.</p>
              </div>
              <button className="btn btn-ghost" onClick={() => startFreeSession()}>
                Treinar todos ({flashcards.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'list' && (
        <div className="card">
          <p className="muted mb-2" style={{ fontSize: '.85rem' }}>
            {flashcards.length} flashcard{flashcards.length > 1 ? 's' : ''} no total · clique em ▶ para treinar a partir deste cartão
          </p>
          <div style={{ maxHeight: 480, overflowY: 'auto' }}>
            {flashcards.map((c) => {
              const isDue = c.due_at <= now
              return (
                <div key={c.id} style={{ padding: '.6rem .75rem', borderBottom: '1px solid var(--border)', fontSize: '.87rem', display: 'flex', alignItems: 'center', gap: '.75rem' }}>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.front.slice(0, 70)}{c.front.length > 70 ? '…' : ''}
                  </span>
                  <span className="badge" style={{ ...statusStyle(c.status), whiteSpace: 'nowrap', flexShrink: 0 }}>{c.status}</span>
                  {isDue && <span className="badge" style={{ background: '#fee2e2', color: '#b91c1c', whiteSpace: 'nowrap', flexShrink: 0 }}>vence hoje</span>}
                  <button className="btn btn-ghost btn-sm" style={{ flexShrink: 0 }} onClick={() => startFreeSession(c)} title="Treinar a partir deste cartão">
                    ▶ Treinar
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
