import { useState, useRef } from 'react'
import { jsonrepair } from 'jsonrepair'
import type { ImportPayload, Exam, Question } from '../types'
import { useData } from '../contexts/DataContext'
import { useAuth } from '../contexts/AuthContext'
import { downloadBackup, parseBackup } from '../utils/storage'

function buildContinuationPrompt(exam: Exam): string {
  return `Você é um extrator de questões de concurso.

Esta é uma CONTINUAÇÃO da extração da prova abaixo. Parte das questões já foi extraída anteriormente e importada no sistema.

Prova: ${exam.title} (${exam.year})
Banca: ${exam.board} | Órgão: ${exam.agency}

⚠️ IMPORTANTE: Use EXATAMENTE este exam_id, sem alterar nada:
"id": "${exam.id}"

Extraia APENAS as questões do trecho que vou fornecer agora.
Não repita questões que já foram enviadas antes.

Regras:
1. Não invente alternativas, enunciados ou gabaritos.
2. Se uma questão estiver ilegível, marque "needs_review": true.
3. Preserve o texto do enunciado e das alternativas o máximo possível.
4. Classifique cada questão em uma destas áreas, quando possível:
   - Conhecimentos Gerais
   - Metodologia da Prática Docente
   - Conhecimentos Específicos
5. Se não souber o tópico, deixe "topic": "".
6. Use alternativas A, B, C, D, E.
7. A saída deve ser APENAS o JSON, sem texto antes ou depois, sem blocos markdown (sem \`\`\`json).
8. IMAGENS E TABELAS: Se o enunciado mencionar ou depender de imagem, tabela, gráfico ou figura,
   marque "has_media": true. Se não há referência a mídia externa, use "has_media": false.
9. CRÍTICO — JSON válido com aspas:
   - NUNCA coloque aspas duplas " dentro de valores string.
   - Substitua citações internas por aspas simples: 'texto citado'.
10. Quebras de linha dentro de enunciados: use \\n (barra invertida + n), não quebras reais.

Tipos de questão:
- "multiple_choice": questão objetiva com alternativas A–E.
- "discursive": questão dissertativa. Use "alternatives": {} e coloque a resposta modelo em "correct_answer".

Use exatamente este JSON para o campo "exam":
{
  "id": "${exam.id}",
  "title": "${exam.title}",
  "year": ${exam.year},
  "board": "${exam.board}",
  "agency": "${exam.agency}",
  "role": "${exam.role}",
  "area": "${exam.area}",
  "tags": ${JSON.stringify(exam.tags)}
}

Esquema das questões:
{
  "exam": { (copie o objeto acima) },
  "questions": [
    {
      "number": 1,
      "type": "multiple_choice",
      "area": "",
      "topic": "",
      "statement": "",
      "alternatives": { "A": "", "B": "", "C": "", "D": "", "E": "" },
      "correct_answer": "",
      "explanation": "",
      "needs_review": false,
      "has_media": false
    }
  ]
}`
}

const CHATGPT_PROMPT = `Você é um extrator de questões de concurso.

Transforme a prova anexada/colada em um JSON estritamente válido, seguindo exatamente o esquema abaixo.

Regras:
1. Não invente alternativas, enunciados ou gabaritos.
2. Se uma questão estiver ilegível, marque "needs_review": true.
3. Preserve o texto do enunciado e das alternativas o máximo possível.
4. Classifique cada questão em uma destas áreas, quando possível:
   - Conhecimentos Gerais
   - Metodologia da Prática Docente
   - Conhecimentos Específicos
5. Se não souber o tópico, deixe "topic": "".
6. Use alternativas A, B, C, D, E.
7. A saída deve ser APENAS o JSON, sem texto antes ou depois, sem blocos markdown (sem \`\`\`json).
8. IMAGENS E TABELAS: Se o enunciado mencionar ou depender de imagem, tabela, gráfico ou figura
   (ex: 'analise a imagem', 'observe o gráfico', 'de acordo com a tabela'),
   marque "has_media": true. Mantenha o enunciado mesmo assim.
   Se não há referência a mídia externa, use "has_media": false.
9. CRÍTICO — JSON válido com aspas:
   - NUNCA coloque aspas duplas " dentro de valores string.
   - Se o texto original tiver uma citação como "sem proteção não há como aprender",
     substitua pelas aspas simples: 'sem proteção não há como aprender'.
   - Errado:  "statement": "ele disse "olá" para ela"
   - Correto: "statement": "ele disse 'olá' para ela"
9. Quebras de linha dentro de enunciados: use \\n (barra invertida + n), não quebras reais.

Tipos de questão:
- "multiple_choice": questão objetiva com alternativas A–E.
- "discursive": questão dissertativa/de resposta aberta.
  Para discursivas: deixe "alternatives" como {} (objeto vazio).
  Em "correct_answer" coloque a resposta modelo completa (texto, não uma letra).

Esquema:
{
  "exam": {
    "id": "",
    "title": "",
    "year": 0,
    "board": "FURB",
    "agency": "",
    "role": "",
    "area": "",
    "tags": []
  },
  "questions": [
    {
      "number": 1,
      "type": "multiple_choice",
      "area": "",
      "topic": "",
      "statement": "",
      "alternatives": {
        "A": "",
        "B": "",
        "C": "",
        "D": "",
        "E": ""
      },
      "correct_answer": "",
      "explanation": "",
      "needs_review": false,
      "has_media": false
    },
    {
      "number": 2,
      "type": "discursive",
      "area": "",
      "topic": "",
      "statement": "",
      "alternatives": {},
      "correct_answer": "Resposta modelo completa aqui...",
      "explanation": "",
      "needs_review": false,
      "has_media": false
    }
  ]
}`

type PreviewState = {
  exam: Exam
  questions: Question[]
  duplicate: boolean
}

function getErrorSnippet(text: string, err: unknown): string {
  if (!(err instanceof SyntaxError)) return ''
  const match = err.message.match(/at position (\d+)/)
  if (!match) return ''
  const pos   = parseInt(match[1], 10)
  const start = Math.max(0, pos - 80)
  const end   = Math.min(text.length, pos + 80)
  return `Trecho com problema (↓ aqui):\n...${text.slice(start, pos)}◀ERRO▶${text.slice(pos, end)}...`
}

function cleanJson(raw: string): string {
  return raw
    .trim()
    .replace(/^\uFEFF/, '')
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim()
}

function buildId(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

function parsePayload(raw: ImportPayload): { exam: Exam; questions: Question[] } {
  const examId = raw.exam.id || buildId(`${raw.exam.board}_${raw.exam.agency}_${raw.exam.year}_${raw.exam.area}`)
  const exam: Exam = { ...raw.exam, id: examId }

  const questions: Question[] = raw.questions.map((q) => {
    const qId = q.id || `${examId}_q${String(q.number).padStart(3, '0')}`
    return {
      id: qId,
      exam_id: examId,
      number: q.number,
      area: q.area ?? '',
      type: q.type ?? (Object.keys(q.alternatives ?? {}).length === 0 ? 'discursive' : 'multiple_choice'),
      topic: q.topic ?? '',
      statement: q.statement,
      alternatives: q.alternatives ?? {},
      correct_answer: q.correct_answer,
      explanation: q.explanation ?? '',
      tags: q.tags ?? [],
      needs_review: q.needs_review ?? false,
      has_media: q.has_media ?? false,
      media_url: q.media_url,
    }
  })

  return { exam, questions }
}

// ── Backup ────────────────────────────────────────────────────────────────────
function BackupCard() {
  const data = useData()
  const [restoreStatus, setRestoreStatus] = useState<'idle' | 'ok' | 'err'>('idle')
  const [restoreMsg, setRestoreMsg]       = useState('')
  const [restoring, setRestoring]         = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleExport() {
    downloadBackup(data.exportData())
  }

  async function handleRestoreFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      setRestoring(true)
      try {
        const parsed = parseBackup(ev.target?.result as string)
        const counts = await data.importAll(parsed)
        setRestoreStatus('ok')
        setRestoreMsg(
          `✅ Restaurado: ${counts.exams} prova(s), ${counts.questions} questão(ões), ${counts.flashcards} flashcard(s).`
        )
      } catch (err) {
        setRestoreStatus('err')
        setRestoreMsg(`❌ Erro ao restaurar: ${String(err)}`)
      } finally {
        setRestoring(false)
        if (fileRef.current) fileRef.current.value = ''
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="card mb-2" style={{ borderLeft: '4px solid var(--brand)' }}>
      <p style={{ fontWeight: 600, marginBottom: '.25rem' }}>📦 Backup entre dispositivos</p>
      <p className="muted mb-2" style={{ fontSize: '.87rem' }}>
        Exporte todos os dados como arquivo JSON para transferir para outro dispositivo ou guardar como cópia de segurança.
      </p>
      <div className="gap-sm" style={{ flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={handleExport} disabled={data.loading}>
          ⬇️ Exportar backup
        </button>
        <label style={{ cursor: restoring ? 'wait' : 'pointer' }}>
          <span className={`btn btn-ghost${restoring ? ' disabled' : ''}`}>
            {restoring ? 'Restaurando…' : '⬆️ Restaurar backup'}
          </span>
          <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleRestoreFile} />
        </label>
      </div>
      {restoreStatus !== 'idle' && (
        <div className={`feedback ${restoreStatus === 'ok' ? 'correct' : 'wrong'}`} style={{ marginTop: '.75rem' }}>
          {restoreMsg}
        </div>
      )}
    </div>
  )
}

// ── Prompt card ───────────────────────────────────────────────────────────────
function PromptCard() {
  const { exams } = useData()
  const [tab, setTab]           = useState<'new' | 'continue'>('new')
  const [copiedNew, setCopiedNew]       = useState(false)
  const [copiedCont, setCopiedCont]     = useState(false)
  const [expandedNew, setExpandedNew]   = useState(false)
  const [expandedCont, setExpandedCont] = useState(false)
  const [selectedExamId, setSelectedExamId] = useState('')

  const selectedExam       = exams.find((e) => e.id === selectedExamId) ?? null
  const continuationPrompt = selectedExam ? buildContinuationPrompt(selectedExam) : ''

  function copy(text: string, setter: (v: boolean) => void) {
    navigator.clipboard.writeText(text)
    setter(true)
    setTimeout(() => setter(false), 2500)
  }

  const preStyle: React.CSSProperties = {
    marginTop: '1rem', background: '#f8fafc',
    border: '1px solid var(--border)', borderRadius: 'var(--radius)',
    padding: '1rem', fontSize: '.8rem', lineHeight: 1.6,
    whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowX: 'auto',
  }

  return (
    <div className="card mt-2">
      <p style={{ fontWeight: 600, marginBottom: '.75rem' }}>📋 Prompts para o ChatGPT</p>

      <div style={{ display: 'flex', borderBottom: '2px solid var(--border)', marginBottom: '1rem', gap: '.25rem' }}>
        {(['new', 'continue'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{
            background: 'none', border: 'none', padding: '.4rem .85rem', cursor: 'pointer',
            fontWeight: 600, fontSize: '.88rem',
            color: tab === t ? 'var(--brand)' : 'var(--muted)',
            borderBottom: tab === t ? '2px solid var(--brand)' : '2px solid transparent',
            marginBottom: '-2px',
          }}>
            {t === 'new' ? '🆕 Prova nova' : '➕ Continuar prova'}
          </button>
        ))}
      </div>

      {tab === 'new' && (
        <>
          <p className="muted mb-2" style={{ fontSize: '.87rem' }}>
            Use este prompt para a <strong>primeira parte</strong> de uma prova — ou para uma prova inteira quando couber em um único envio.
          </p>
          <div className="gap-sm">
            <button className="btn btn-primary" onClick={() => copy(CHATGPT_PROMPT, setCopiedNew)}>
              {copiedNew ? '✅ Copiado!' : '📋 Copiar prompt'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setExpandedNew((e) => !e)}>
              {expandedNew ? 'Ocultar' : 'Ver prompt'}
            </button>
          </div>
          {expandedNew && <pre style={preStyle}>{CHATGPT_PROMPT}</pre>}
        </>
      )}

      {tab === 'continue' && (
        <>
          <p className="muted mb-2" style={{ fontSize: '.87rem' }}>
            Use este prompt para enviar o <strong>restante da prova</strong> em partes.
          </p>

          {exams.length === 0 ? (
            <div className="feedback wrong">
              Nenhuma prova importada ainda. Importe a primeira parte antes de usar este prompt.
            </div>
          ) : (
            <>
              <div style={{ marginBottom: '.75rem' }}>
                <label>Selecione a prova já importada</label>
                <select value={selectedExamId} onChange={(e) => setSelectedExamId(e.target.value)}>
                  <option value="">— escolha uma prova —</option>
                  {exams.map((e) => (
                    <option key={e.id} value={e.id}>{e.title} ({e.year})</option>
                  ))}
                </select>
              </div>

              {selectedExam && (
                <>
                  <div style={{
                    background: '#eff6ff', border: '1px solid #bfdbfe',
                    borderRadius: 'var(--radius)', padding: '.6rem .85rem',
                    fontSize: '.83rem', marginBottom: '.75rem', fontFamily: 'monospace',
                    wordBreak: 'break-all',
                  }}>
                    exam_id: <strong>{selectedExam.id}</strong>
                  </div>
                  <div className="gap-sm">
                    <button className="btn btn-primary" onClick={() => copy(continuationPrompt, setCopiedCont)}>
                      {copiedCont ? '✅ Copiado!' : '📋 Copiar prompt de continuação'}
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setExpandedCont((e) => !e)}>
                      {expandedCont ? 'Ocultar' : 'Ver prompt'}
                    </button>
                  </div>
                  {expandedCont && <pre style={preStyle}>{continuationPrompt}</pre>}
                </>
              )}
            </>
          )}

          <div style={{ marginTop: '1rem', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 'var(--radius)', padding: '.65rem .85rem', fontSize: '.85rem' }}>
            <strong>Como funciona:</strong>
            <ol style={{ paddingLeft: '1.2rem', marginTop: '.35rem', lineHeight: 1.8 }}>
              <li>Copie este prompt e envie ao ChatGPT com o trecho seguinte da prova.</li>
              <li>Importe o JSON normalmente — as novas questões serão <strong>adicionadas</strong> à prova existente.</li>
              <li>Repita até importar todas as questões.</li>
            </ol>
          </div>
        </>
      )}
    </div>
  )
}

// ── Gerenciador de mídia ──────────────────────────────────────────────────────
function MediaManager() {
  const { questions, exams, saveMedia, deleteMedia } = useData()
  const mediaQuestions = questions.filter((q) => q.has_media)

  const [previews, setPreviews]   = useState<Record<string, boolean>>({})
  const [uploading, setUploading] = useState<string | null>(null)
  const [filter, setFilter]       = useState<'all' | 'missing' | 'done'>('all')

  if (mediaQuestions.length === 0) return null

  const examMap    = new Map(exams.map((e) => [e.id, e.title]))
  const doneCount  = mediaQuestions.filter((q) => !!q.media_url).length
  const missingCount = mediaQuestions.length - doneCount

  const filtered = mediaQuestions.filter((q) => {
    if (filter === 'missing') return !q.media_url
    if (filter === 'done')    return !!q.media_url
    return true
  })

  async function handleUpload(q: Question, file: File) {
    setUploading(q.id)
    try {
      await saveMedia(q.id, file)
    } finally {
      setUploading(null)
    }
  }

  async function handleDelete(questionId: string) {
    await deleteMedia(questionId)
  }

  return (
    <div className="card mt-3">
      <h2 className="section-title">🖼️ Questões com Mídia</h2>
      <p className="muted mb-2" style={{ fontSize: '.88rem' }}>
        {mediaQuestions.length} questão{mediaQuestions.length > 1 ? 'ões' : ''} referem a imagem, tabela ou gráfico.
        Faça o upload da imagem (screenshot ou recorte do PDF) para cada uma — fica salvo na nuvem.
      </p>

      <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {([['all', `Todas (${mediaQuestions.length})`], ['missing', `Sem imagem (${missingCount})`], ['done', `Com imagem (${doneCount})`]] as const).map(([val, label]) => (
          <button
            key={val}
            onClick={() => setFilter(val)}
            className="btn btn-sm"
            style={{
              background: filter === val ? 'var(--brand)' : 'var(--surface)',
              color: filter === val ? '#fff' : 'var(--text)',
              border: '1px solid var(--border)',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="muted" style={{ fontSize: '.88rem' }}>Nenhuma questão nesta categoria.</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '.85rem' }}>
        {filtered.map((q) => {
          const hasMidia  = !!q.media_url
          const showImg   = previews[q.id] && !!q.media_url

          return (
            <div
              key={q.id}
              style={{
                border: `1px solid ${hasMidia ? '#bbf7d0' : 'var(--border)'}`,
                borderRadius: 'var(--radius)',
                padding: '.75rem 1rem',
                background: hasMidia ? '#f0fdf4' : 'var(--surface)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '.75rem', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="gap-sm mb-1" style={{ flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '.78rem', color: 'var(--muted)' }}>
                      {examMap.get(q.exam_id) ?? q.exam_id} — Q{q.number}
                    </span>
                    {hasMidia
                      ? <span style={{ fontSize: '.75rem', background: '#dcfce7', color: '#166534', padding: '.1rem .45rem', borderRadius: 9999 }}>✅ com imagem</span>
                      : <span style={{ fontSize: '.75rem', background: '#fef3c7', color: '#92400e', padding: '.1rem .45rem', borderRadius: 9999 }}>⚠️ sem imagem</span>
                    }
                  </div>
                  <p style={{ fontSize: '.88rem', lineHeight: 1.5, margin: 0, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {q.statement}
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '.4rem', alignItems: 'flex-end', flexShrink: 0 }}>
                  <label style={{
                    cursor: uploading === q.id ? 'wait' : 'pointer',
                    background: 'var(--brand)', color: '#fff',
                    padding: '.3rem .75rem', borderRadius: 'var(--radius)',
                    fontSize: '.82rem', fontWeight: 600, whiteSpace: 'nowrap',
                    opacity: uploading === q.id ? .6 : 1,
                  }}>
                    {uploading === q.id ? 'Enviando…' : hasMidia ? '🔄 Trocar' : '📁 Upload'}
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      disabled={uploading === q.id}
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handleUpload(q, file)
                        e.target.value = ''
                      }}
                    />
                  </label>
                  {hasMidia && (
                    <>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: '.78rem' }}
                        onClick={() => setPreviews((p) => ({ ...p, [q.id]: !p[q.id] }))}
                      >
                        {showImg ? 'Ocultar' : 'Ver imagem'}
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: '.78rem', color: 'var(--danger)' }}
                        onClick={() => handleDelete(q.id)}
                      >
                        Remover
                      </button>
                    </>
                  )}
                </div>
              </div>

              {showImg && q.media_url && (
                <div style={{ marginTop: '.75rem' }}>
                  <img
                    src={q.media_url}
                    alt="Mídia da questão"
                    style={{ maxWidth: '100%', maxHeight: 320, borderRadius: 'var(--radius)', border: '1px solid var(--border)', display: 'block' }}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function ImportPage() {
  const { exams, saveExam, saveQuestions, loading } = useData()
  const { signOut } = useAuth()

  const [text, setText]       = useState('')
  const [preview, setPreview] = useState<PreviewState | null>(null)
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState('')
  const [importing, setImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setText((ev.target?.result as string) ?? '')
    reader.readAsText(file)
  }

  function handleValidate() {
    setError('')
    setSuccess('')
    setPreview(null)

    const cleaned = cleanJson(text)
    if (cleaned !== text) setText(cleaned)

    let parsed: unknown
    try {
      parsed = JSON.parse(cleaned)
    } catch (originalErr) {
      let repaired = false
      try {
        const fixed = jsonrepair(cleaned)
        parsed = JSON.parse(fixed)
        setText(fixed)
        repaired = true
      } catch { /* noop */ }

      if (!repaired) {
        const snippet = getErrorSnippet(cleaned, originalErr)
        const msg = originalErr instanceof SyntaxError ? originalErr.message : String(originalErr)
        setError(
          `JSON inválido. Não foi possível reparar automaticamente.\n\n` +
          `Causa mais comum: aspas duplas " dentro do texto da questão (citações, trechos).\n` +
          `Solução: copie o prompt atualizado, cole no ChatGPT e peça para regenerar o JSON.\n\n` +
          `Erro técnico: ${msg}\n\n${snippet}`
        )
        return
      }
    }

    const raw = parsed as ImportPayload
    if (!raw || typeof raw !== 'object') { setError('O JSON deve ser um objeto.'); return }
    if (!raw.exam || typeof raw.exam !== 'object') { setError('Faltando o campo "exam" no JSON.'); return }
    if (!Array.isArray(raw.questions) || raw.questions.length === 0) { setError('Faltando o campo "questions" (ou está vazio).'); return }

    try {
      const { exam, questions } = parsePayload(raw)
      const duplicate = exams.some((e) => e.id === exam.id)
      setPreview({ exam, questions, duplicate })
    } catch (err) {
      setError(`Erro ao processar os dados: ${String(err)}`)
    }
  }

  async function handleImport() {
    if (!preview) return
    setImporting(true)
    try {
      await saveExam(preview.exam)
      await saveQuestions(preview.questions)
      setSuccess(`✅ Prova importada com sucesso! ${preview.questions.length} questões salvas.`)
      setPreview(null)
      setText('')
      if (fileRef.current) fileRef.current.value = ''
    } catch (err) {
      setError(`Erro ao salvar: ${String(err)}`)
    } finally {
      setImporting(false)
    }
  }

  if (loading) {
    return (
      <div>
        <h1 className="page-title">Importar Questões</h1>
        <div className="card text-center"><p className="muted">Carregando dados…</p></div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.5rem' }}>
        <h1 className="page-title" style={{ margin: 0 }}>Importar Questões</h1>
        <button className="btn btn-ghost btn-sm" onClick={signOut}>Sair</button>
      </div>

      <BackupCard />

      <div className="card mb-2">
        <label>Selecionar arquivo JSON</label>
        <input ref={fileRef} type="file" accept=".json" onChange={handleFileChange} />
        <p className="muted mt-1">Ou cole o conteúdo do JSON diretamente abaixo.</p>
      </div>

      <div className="card mb-2">
        <label>JSON da prova</label>
        <textarea
          rows={10}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder='{ "exam": { ... }, "questions": [ ... ] }'
          style={{ fontFamily: 'monospace', fontSize: '.82rem' }}
        />
        <div className="gap-sm mt-2">
          <button className="btn btn-primary" onClick={handleValidate} disabled={!text.trim()}>
            Validar JSON
          </button>
          {text && (
            <button className="btn btn-ghost btn-sm" onClick={() => { setText(''); setPreview(null); setError(''); setSuccess('') }}>
              Limpar
            </button>
          )}
        </div>
      </div>

      {error && <div className="feedback wrong" style={{ whiteSpace: 'pre-wrap' }}>❌ {error}</div>}
      {success && <div className="feedback correct">{success}</div>}

      {preview && (
        <div className="card">
          <h2 className="section-title">Pré-visualização</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.9rem', marginBottom: '1rem' }}>
            <tbody>
              {[
                ['ID', preview.exam.id],
                ['Título', preview.exam.title],
                ['Ano', preview.exam.year],
                ['Banca', preview.exam.board],
                ['Órgão', preview.exam.agency],
                ['Cargo', preview.exam.role],
                ['Área', preview.exam.area],
                ['Questões', preview.questions.length],
              ].map(([k, v]) => (
                <tr key={String(k)} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '.35rem .5rem', color: 'var(--muted)', width: '30%' }}>{k}</td>
                  <td style={{ padding: '.35rem .5rem', fontWeight: 500 }}>{String(v)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {preview.duplicate && (
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 'var(--radius)', padding: '.65rem .85rem', marginBottom: '.75rem', fontSize: '.88rem' }}>
              ℹ️ Esta prova já existe. As novas questões serão <strong>adicionadas</strong> às existentes.
            </div>
          )}

          <div className="gap-sm">
            <button className="btn btn-success" onClick={handleImport} disabled={importing}>
              {importing ? 'Salvando…' : preview.duplicate ? 'Mesclar e Importar' : 'Confirmar Importação'}
            </button>
            <button className="btn btn-ghost" onClick={() => setPreview(null)} disabled={importing}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="card mt-3">
        <h2 className="section-title">Como usar</h2>
        <p style={{ fontWeight: 600, fontSize: '.88rem', marginBottom: '.35rem' }}>Prova inteira de uma vez:</p>
        <ol style={{ paddingLeft: '1.2rem', lineHeight: '1.8', fontSize: '.9rem', color: 'var(--muted)', marginBottom: '.85rem' }}>
          <li>Abaixo, copie o prompt <strong>"Prova nova"</strong>.</li>
          <li>Cole no ChatGPT junto com o PDF ou texto da prova.</li>
          <li>Cole o JSON gerado aqui e clique em "Validar JSON" → "Confirmar Importação".</li>
        </ol>
        <p style={{ fontWeight: 600, fontSize: '.88rem', marginBottom: '.35rem' }}>Prova grande em partes:</p>
        <ol style={{ paddingLeft: '1.2rem', lineHeight: '1.8', fontSize: '.9rem', color: 'var(--muted)' }}>
          <li>Envie a 1ª parte com o prompt <strong>"Prova nova"</strong> e importe o JSON.</li>
          <li>Para as partes seguintes, use o prompt <strong>"Continuar prova"</strong>.</li>
          <li>Importe cada parte normalmente: as questões são <strong>adicionadas</strong>.</li>
        </ol>
      </div>

      <PromptCard />
      <MediaManager />
    </div>
  )
}
