import { useState, useMemo } from 'react'
import type { Question, Attempt } from '../types'
import { useData } from '../contexts/DataContext'
import { createFlashcardFromQuestion } from '../utils/flashcardUtils'

type Filter = { examId: string; area: string }
type AnswerState = { selected: string; submitted: boolean; showModel?: boolean }

function isDiscursive(q: Question) {
  return q.type === 'discursive' || Object.keys(q.alternatives).length === 0
}

function buildMCPrompt(q: Question, selected: string, isCorrect: boolean): string {
  const alts = Object.entries(q.alternatives).map(([l, t]) => `${l}) ${t}`).join('\n')
  const resultLine = isCorrect
    ? `Minha resposta: ${selected} ✅ (acertei)`
    : `Minha resposta: ${selected} ❌ (errei)\nGabarito: ${q.correct_answer}`
  return `Explique esta questão de concurso de forma simples, sem termos difíceis, como se estivesse explicando para alguém que está estudando pela primeira vez.

Contexto: Concurso SED/SC para Professor/Pedagogia — banca FURB.

Questão:
${q.statement}

Alternativas:
${alts}

${resultLine}

Quero:
1. Explique por que a alternativa ${q.correct_answer} é a correta (em linguagem simples).
2. Qual é o conceito principal cobrado nesta questão?
3. Como memorizar esse conceito de forma fácil?
4. Um flashcard curto no formato:
   Frente: (pergunta sobre o conceito)
   Verso: (resposta simples, máximo 2 linhas)`
}

function buildDiscursivePrompt(q: Question, written: string, isCorrect: boolean): string {
  const resultLine = isCorrect ? 'Autoavaliação: me considerei correto(a).' : 'Autoavaliação: errei ou fui parcial.'
  return `Explique esta questão discursiva de forma simples, sem termos difíceis, como se estivesse explicando para alguém que está estudando pela primeira vez.

Contexto: Concurso SED/SC para Professor/Pedagogia — banca FURB.

Questão:
${q.statement}

Minha resposta:
${written || '(em branco)'}

Resposta modelo:
${q.correct_answer}

${resultLine}

Quero:
1. O que a resposta modelo está querendo dizer (em linguagem simples)?
2. O que está certo e o que está faltando na minha resposta?
3. O conceito principal que preciso memorizar.
4. Um flashcard curto no formato:
   Frente: (pergunta sobre o conceito)
   Verso: (resposta simples, máximo 2 linhas)`
}

// ── Progresso por prova ───────────────────────────────────────────────────────
function ExamProgress() {
  const { exams, questions, attempts } = useData()
  if (exams.length === 0) return null

  const attempted  = new Set(attempts.map((a) => a.question_id))
  const lastResult = new Map<string, boolean>()
  for (const a of attempts) lastResult.set(a.question_id, a.is_correct)

  return (
    <div className="card mb-2">
      <p style={{ fontWeight: 600, marginBottom: '.75rem' }}>Progresso por prova</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '.85rem' }}>
        {exams.map((exam) => {
          const qs      = questions.filter((q) => q.exam_id === exam.id)
          const total   = qs.length
          if (total === 0) return null
          const seen    = qs.filter((q) => attempted.has(q.id)).length
          const correct = qs.filter((q) => lastResult.get(q.id) === true).length
          const wrong   = qs.filter((q) => lastResult.get(q.id) === false).length
          const pct     = Math.round((seen / total) * 100)
          return (
            <div key={exam.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '.3rem', gap: '.5rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '.88rem', fontWeight: 500, flex: 1 }}>
                  {exam.title} <span style={{ color: 'var(--muted)', fontWeight: 400 }}>({exam.year})</span>
                </span>
                <span style={{ fontSize: '.8rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                  {seen}/{total} respondidas ({pct}%)
                </span>
              </div>
              <div style={{ display: 'flex', height: 10, borderRadius: 9999, overflow: 'hidden', background: 'var(--border)' }}>
                <div style={{ width: `${(correct / total) * 100}%`, background: 'var(--success)', transition: 'width .4s' }} />
                <div style={{ width: `${(wrong   / total) * 100}%`, background: 'var(--danger)',  transition: 'width .4s' }} />
              </div>
              <div className="gap-sm mt-1">
                {correct > 0 && <span style={{ fontSize: '.75rem', color: 'var(--success)' }}>✅ {correct} acerto{correct > 1 ? 's' : ''}</span>}
                {wrong   > 0 && <span style={{ fontSize: '.75rem', color: 'var(--danger)'  }}>❌ {wrong} erro{wrong > 1 ? 's' : ''}</span>}
                {total - seen > 0 && <span style={{ fontSize: '.75rem', color: 'var(--muted)' }}>⬜ {total - seen} não vistas</span>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Histórico rápido ──────────────────────────────────────────────────────────
function QuestionHistory({ questionId }: { questionId: string }) {
  const { attempts } = useData()
  const mine = attempts.filter((a) => a.question_id === questionId)
  if (mine.length === 0) return null
  const last  = mine[mine.length - 1]
  const times = mine.length
  return (
    <span
      style={{
        fontSize: '.78rem', padding: '.15rem .5rem', borderRadius: 9999,
        background: last.is_correct ? '#dcfce7' : '#fee2e2',
        color: last.is_correct ? 'var(--success)' : 'var(--danger)',
        whiteSpace: 'nowrap',
      }}
      title={`Respondida ${times} vez${times > 1 ? 'es' : ''}`}
    >
      {last.is_correct ? '✅' : '❌'} vista {times}×
    </span>
  )
}

// ── Imagem/mídia da questão ───────────────────────────────────────────────────
function QuestionMedia({ question }: { question: Question }) {
  if (!question.media_url) return null
  return (
    <div style={{ marginBottom: '1rem' }}>
      <img
        src={question.media_url}
        alt="Imagem da questão"
        style={{
          maxWidth: '100%', maxHeight: 400,
          borderRadius: 'var(--radius)', border: '1px solid var(--border)', display: 'block',
        }}
      />
    </div>
  )
}

// ── Aviso de mídia ausente ────────────────────────────────────────────────────
function MediaMissingBanner({ onSkip }: { onSkip: () => void }) {
  return (
    <div style={{
      background: '#fffbeb', border: '1px solid #fde68a',
      borderRadius: 'var(--radius)', padding: '.65rem .9rem',
      marginBottom: '.85rem', fontSize: '.88rem',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: '.75rem', flexWrap: 'wrap',
    }}>
      <span>
        ⚠️ <strong>Esta questão exige uma imagem/tabela/gráfico.</strong>{' '}
        Adicione a imagem na aba <strong>Importar → Questões com Mídia</strong> ou pule.
      </span>
      <button className="btn btn-warning btn-sm" onClick={onSkip}>Pular →</button>
    </div>
  )
}

// ── Múltipla escolha ─────────────────────────────────────────────────────────
function MultipleChoice({
  question, answer, onSelect, onSubmit, onNext, onCopyPrompt, copied,
}: {
  question: Question; answer: AnswerState | null
  onSelect(l: string): void; onSubmit(): void; onNext(): void
  onCopyPrompt(): void; copied: boolean
}) {
  const submitted = !!answer?.submitted
  return (
    <>
      {Object.entries(question.alternatives).map(([letter, text]) => {
        let cls = 'alternative-btn'
        if (submitted) {
          if (letter === question.correct_answer) cls += ' correct'
          else if (letter === answer?.selected) cls += ' wrong'
        } else if (answer?.selected === letter) cls += ' selected'
        return (
          <button key={letter} className={cls} onClick={() => onSelect(letter)} disabled={submitted}>
            <span className="letter">{letter}</span>
            <span>{text}</span>
          </button>
        )
      })}
      {!submitted && (
        <button className="btn btn-primary mt-2" onClick={onSubmit} disabled={!answer?.selected}>
          Confirmar resposta
        </button>
      )}
      {submitted && (
        <>
          <div className={`feedback ${answer?.selected === question.correct_answer ? 'correct' : 'wrong'}`}>
            {answer?.selected === question.correct_answer
              ? '✅ Acertou!'
              : `❌ Errou! A resposta correta é ${question.correct_answer}. Flashcard criado automaticamente.`}
          </div>
          {question.explanation && (
            <div style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '.75rem 1rem', fontSize: '.9rem', lineHeight: '1.6', marginBottom: '.75rem' }}>
              <strong>Explicação:</strong> {question.explanation}
            </div>
          )}
          <div className="gap-sm">
            <button className="btn btn-primary" onClick={onNext}>Próxima questão →</button>
            <button className="btn btn-ghost btn-sm" onClick={onCopyPrompt}>
              {copied ? '✅ Copiado!' : '💬 Pedir explicação ao ChatGPT'}
            </button>
          </div>
        </>
      )}
    </>
  )
}

// ── Discursiva ───────────────────────────────────────────────────────────────
function Discursive({
  question, answer, onTextChange, onShowModel, onSelfEval, onNext, onCopyPrompt, copied,
}: {
  question: Question; answer: AnswerState | null
  onTextChange(t: string): void; onShowModel(): void; onSelfEval(correct: boolean): void
  onNext(): void; onCopyPrompt(): void; copied: boolean
}) {
  const showModel = !!answer?.showModel
  const submitted = !!answer?.submitted
  return (
    <>
      <div style={{ marginBottom: '.75rem' }}>
        <label style={{ color: 'var(--muted)', fontSize: '.83rem', marginBottom: '.35rem' }}>Sua resposta</label>
        <textarea
          rows={6} value={answer?.selected ?? ''} onChange={(e) => onTextChange(e.target.value)}
          disabled={showModel} placeholder="Escreva sua resposta aqui antes de ver o gabarito…"
          style={{ resize: 'vertical' }}
        />
      </div>
      {!showModel && <button className="btn btn-primary" onClick={onShowModel}>Ver gabarito</button>}
      {showModel && (
        <>
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 'var(--radius)', padding: '.85rem 1rem', marginBottom: '.75rem', fontSize: '.93rem', lineHeight: '1.65', whiteSpace: 'pre-wrap' }}>
            <p style={{ fontWeight: 600, marginBottom: '.4rem', color: 'var(--success)' }}>📝 Resposta modelo</p>
            {question.correct_answer}
            {question.explanation && (
              <p style={{ marginTop: '.6rem', borderTop: '1px solid #bbf7d0', paddingTop: '.6rem', color: 'var(--muted)', fontSize: '.88rem' }}>
                <strong>Explicação:</strong> {question.explanation}
              </p>
            )}
          </div>
          {!submitted ? (
            <>
              <p style={{ fontSize: '.88rem', color: 'var(--muted)', marginBottom: '.5rem' }}>Como você se saiu comparando com o gabarito?</p>
              <div className="gap-sm">
                <button className="btn btn-success" onClick={() => onSelfEval(true)}>✅ Acertei</button>
                <button className="btn btn-warning" onClick={() => onSelfEval(false)}>🟡 Parcial / Errei</button>
              </div>
            </>
          ) : (
            <div className="gap-sm">
              <button className="btn btn-primary" onClick={onNext}>Próxima questão →</button>
              <button className="btn btn-ghost btn-sm" onClick={onCopyPrompt}>
                {copied ? '✅ Copiado!' : '💬 Pedir explicação ao ChatGPT'}
              </button>
            </div>
          )}
        </>
      )}
    </>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function PracticePage() {
  const { exams, questions: allQuestions, flashcards, saveAttempt, saveFlashcard, loading } = useData()

  const [filter, setFilter]   = useState<Filter>({ examId: '', area: '' })
  const [index, setIndex]     = useState(0)
  const [answer, setAnswer]   = useState<AnswerState | null>(null)
  const [copied, setCopied]   = useState(false)
  const [tick, setTick]       = useState(0)
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null)

  const areas = useMemo(() => {
    const base = filter.examId ? allQuestions.filter((q) => q.exam_id === filter.examId) : allQuestions
    return [...new Set(base.map((q) => q.area).filter(Boolean))]
  }, [allQuestions, filter.examId])

  const questions = useMemo(() => {
    let qs = allQuestions
    if (filter.examId) qs = qs.filter((q) => q.exam_id === filter.examId)
    if (filter.area)   qs = qs.filter((q) => q.area === filter.area)
    return qs
  }, [allQuestions, filter])

  const current: Question | undefined = questions[index]
  const discursive = current ? isDiscursive(current) : false

  if (loading) {
    return (
      <div>
        <h1 className="page-title">Praticar Questões</h1>
        <div className="card text-center"><p className="muted">Carregando dados…</p></div>
      </div>
    )
  }

  if (exams.length === 0) {
    return (
      <div>
        <h1 className="page-title">Praticar Questões</h1>
        <div className="card text-center">
          <p className="muted">Nenhuma prova importada ainda.</p>
          <p className="muted mt-1">Vá para a aba <strong>Importar</strong> para adicionar questões.</p>
        </div>
      </div>
    )
  }

  function handleFilterChange(key: keyof Filter, value: string) {
    setFilter((f) => ({ ...f, [key]: value, ...(key === 'examId' ? { area: '' } : {}) }))
    setIndex(0); setAnswer(null); setLastCorrect(null)
  }

  function handleSelect(letter: string) {
    if (answer?.submitted) return
    setAnswer({ selected: letter, submitted: false })
  }

  function handleSubmitMC() {
    if (!answer || !current) return
    const isCorrect = answer.selected === current.correct_answer
    recordAttempt(current, answer.selected, isCorrect)
    setLastCorrect(isCorrect)
    setAnswer({ ...answer, submitted: true })
    setCopied(false)
    setTick((t) => t + 1)
  }

  function handleTextChange(text: string) {
    setAnswer({ selected: text, submitted: false })
  }

  function handleShowModel() {
    setAnswer((a) => ({ selected: a?.selected ?? '', submitted: false, showModel: true }))
  }

  function handleSelfEval(correct: boolean) {
    if (!current || !answer) return
    recordAttempt(current, answer.selected, correct)
    if (!correct) {
      const existing = flashcards.find((c) => c.question_id === current.id)
      if (!existing) saveFlashcard(createFlashcardFromQuestion(current))
    }
    setLastCorrect(correct)
    setAnswer({ ...answer, submitted: true, showModel: true })
    setTick((t) => t + 1)
  }

  function recordAttempt(q: Question, selected: string, isCorrect: boolean) {
    const attempt: Attempt = {
      id: crypto.randomUUID(),
      question_id: q.id,
      selected_answer: selected,
      is_correct: isCorrect,
      answered_at: new Date().toISOString(),
    }
    saveAttempt(attempt)
    if (!isCorrect) {
      const existing = flashcards.find((c) => c.question_id === q.id)
      if (!existing) saveFlashcard(createFlashcardFromQuestion(q))
    }
  }

  function handleNext() {
    setIndex((i) => i + 1); setAnswer(null); setCopied(false); setLastCorrect(null)
  }

  function handleCopyPrompt() {
    if (!current || !answer) return
    const correct = lastCorrect ?? false
    const text = discursive
      ? buildDiscursivePrompt(current, answer.selected, correct)
      : buildMCPrompt(current, answer.selected, correct)
    navigator.clipboard.writeText(text)
    setCopied(true)
  }

  return (
    <div>
      <h1 className="page-title">Praticar Questões</h1>

      <div key={tick}><ExamProgress /></div>

      <div className="card mb-2">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.75rem' }}>
          <div>
            <label>Prova</label>
            <select value={filter.examId} onChange={(e) => handleFilterChange('examId', e.target.value)}>
              <option value="">Todas as provas</option>
              {exams.map((e) => <option key={e.id} value={e.id}>{e.title} ({e.year})</option>)}
            </select>
          </div>
          <div>
            <label>Área</label>
            <select value={filter.area} onChange={(e) => handleFilterChange('area', e.target.value)}>
              <option value="">Todas as áreas</option>
              {areas.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>
      </div>

      {questions.length === 0 ? (
        <div className="card text-center"><p className="muted">Nenhuma questão para os filtros selecionados.</p></div>
      ) : index >= questions.length ? (
        <div className="card text-center">
          <p style={{ fontSize: '1.5rem', marginBottom: '.5rem' }}>🎉</p>
          <p style={{ fontWeight: 600 }}>Você respondeu todas as {questions.length} questões!</p>
          <button className="btn btn-primary mt-2" onClick={() => { setIndex(0); setAnswer(null); setLastCorrect(null) }}>
            Recomeçar
          </button>
        </div>
      ) : (
        <div className="card">
          <div className="gap-sm mb-2" style={{ alignItems: 'center' }}>
            <span className="counter">Questão {index + 1} de {questions.length}</span>
            {discursive && <span className="badge" style={{ background: '#ede9fe', color: '#6d28d9' }}>Discursiva</span>}
            {current.area  && <span className="badge">{current.area}</span>}
            {current.topic && <span className="badge" style={{ background: '#fef3c7', color: '#92400e' }}>{current.topic}</span>}
            <QuestionHistory questionId={current.id} />
          </div>

          <div className="progress-bar-wrap mb-2">
            <div className="progress-bar" style={{ width: `${(index / questions.length) * 100}%` }} />
          </div>

          {current.has_media && <QuestionMedia question={current} />}
          {current.has_media && !current.media_url && <MediaMissingBanner onSkip={handleNext} />}

          <p style={{ lineHeight: '1.65', marginBottom: '1rem', fontSize: '.97rem', whiteSpace: 'pre-wrap' }}>
            {current.statement}
          </p>

          <hr className="divider" />

          {discursive && answer?.submitted && lastCorrect !== null && (
            <div className={`feedback ${lastCorrect ? 'correct' : 'wrong'}`} style={{ marginBottom: '.75rem' }}>
              {lastCorrect ? '✅ Ótimo! Você se avaliou como correto.' : '🟡 Flashcard criado automaticamente para revisão.'}
            </div>
          )}

          {discursive ? (
            <Discursive
              question={current} answer={answer}
              onTextChange={handleTextChange} onShowModel={handleShowModel}
              onSelfEval={handleSelfEval} onNext={handleNext}
              onCopyPrompt={handleCopyPrompt} copied={copied}
            />
          ) : (
            <MultipleChoice
              question={current} answer={answer}
              onSelect={handleSelect} onSubmit={handleSubmitMC}
              onNext={handleNext} onCopyPrompt={handleCopyPrompt} copied={copied}
            />
          )}
        </div>
      )}
    </div>
  )
}
