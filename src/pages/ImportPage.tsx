import { useState, useRef } from 'react'
import { jsonrepair } from 'jsonrepair'
import type { ImportPayload, Exam, Question } from '../types'
import { saveExam, saveQuestions, getExams } from '../utils/storage'

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
8. CRÍTICO — JSON válido com aspas:
   - NUNCA coloque aspas duplas " dentro de valores string.
   - Substitua citações internas por aspas simples: 'texto citado'.
9. Quebras de linha dentro de enunciados: use \\n (barra invertida + n), não quebras reais.

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
      "needs_review": false
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
8. CRÍTICO — JSON válido com aspas:
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
      "needs_review": false
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
      "needs_review": false
    }
  ]
}`

type PreviewState = {
  exam: Exam
  questions: Question[]
  duplicate: boolean
}

/** Extrai o trecho do texto ao redor da posição do erro para ajudar na inspeção */
function getErrorSnippet(text: string, err: unknown): string {
  if (!(err instanceof SyntaxError)) return ''
  // SyntaxError.message geralmente contém "at position N"
  const match = err.message.match(/at position (\d+)/)
  if (!match) return ''
  const pos = parseInt(match[1], 10)
  const start = Math.max(0, pos - 80)
  const end = Math.min(text.length, pos + 80)
  const before = text.slice(start, pos)
  const after = text.slice(pos, end)
  return `Trecho com problema (↓ aqui):\n...${before}◀ERRO▶${after}...`
}

/**
 * Remove marcadores de código que o ChatGPT costuma adicionar ao redor do JSON:
 *   ```json ... ```  ou  ``` ... ```
 * Também remove BOM e espaços extras nas bordas.
 */
function cleanJson(raw: string): string {
  return raw
    .trim()
    .replace(/^\uFEFF/, '')                   // BOM
    .replace(/^```(?:json)?\s*/i, '')         // abertura ```json ou ```
    .replace(/\s*```\s*$/, '')                // fechamento ```
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
    }
  })

  return { exam, questions }
}

function PromptCard() {
  const [tab, setTab]           = useState<'new' | 'continue'>('new')
  const [copiedNew, setCopiedNew]       = useState(false)
  const [copiedCont, setCopiedCont]     = useState(false)
  const [expandedNew, setExpandedNew]   = useState(false)
  const [expandedCont, setExpandedCont] = useState(false)
  const [selectedExamId, setSelectedExamId] = useState('')

  const exams = getExams()
  const selectedExam = exams.find((e) => e.id === selectedExamId) ?? null
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

      {/* Tabs */}
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
            Use este prompt para enviar o <strong>restante da prova</strong> em partes. As questões serão adicionadas à prova já importada, sem apagar as anteriores.
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

export default function ImportPage() {
  const [text, setText] = useState('')
  const [preview, setPreview] = useState<PreviewState | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
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

    // atualiza o textarea com o texto limpo para facilitar inspeção visual
    if (cleaned !== text) setText(cleaned)

    let parsed: unknown
    try {
      parsed = JSON.parse(cleaned)
    } catch (originalErr) {
      // Tenta reparar com jsonrepair (vírgulas faltando, chaves, etc.)
      let repaired = false
      try {
        const fixed = jsonrepair(cleaned)
        parsed = JSON.parse(fixed)
        setText(fixed)
        repaired = true
      } catch {
        // jsonrepair não conseguiu
      }

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
    if (!raw || typeof raw !== 'object') {
      setError('O JSON deve ser um objeto, não uma lista ou valor simples.')
      return
    }
    if (!raw.exam || typeof raw.exam !== 'object') {
      setError('Faltando o campo "exam" no JSON.')
      return
    }
    if (!Array.isArray(raw.questions) || raw.questions.length === 0) {
      setError('Faltando o campo "questions" (ou está vazio) no JSON.')
      return
    }

    try {
      const { exam, questions } = parsePayload(raw)
      const existing = getExams()
      const duplicate = existing.some((e) => e.id === exam.id)
      setPreview({ exam, questions, duplicate })
    } catch (err) {
      setError(`Erro ao processar os dados: ${String(err)}`)
    }
  }

  function handleImport() {
    if (!preview) return
    saveExam(preview.exam)
    saveQuestions(preview.questions)
    setSuccess(`✅ Prova importada com sucesso! ${preview.questions.length} questões salvas.`)
    setPreview(null)
    setText('')
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div>
      <h1 className="page-title">Importar Questões</h1>

      <div className="card mb-2">
        <label>Selecionar arquivo JSON</label>
        <input ref={fileRef} type="file" accept=".json" onChange={handleFileChange} />
        <p className="muted mt-1">
          Ou cole o conteúdo do JSON diretamente abaixo.
        </p>
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
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => { setText(''); setPreview(null); setError(''); setSuccess('') }}
            >
              Limpar
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="feedback wrong" style={{ whiteSpace: 'pre-wrap' }}>
          ❌ {error}
        </div>
      )}

      {success && (
        <div className="feedback correct">
          {success}
        </div>
      )}

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
              ℹ️ Esta prova já existe. As novas questões serão <strong>adicionadas</strong> às existentes. Questões com o mesmo número serão atualizadas.
            </div>
          )}

          <div className="gap-sm">
            <button className="btn btn-success" onClick={handleImport}>
              {preview.duplicate ? 'Mesclar e Importar' : 'Confirmar Importação'}
            </button>
            <button className="btn btn-ghost" onClick={() => setPreview(null)}>
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
        <p style={{ fontWeight: 600, fontSize: '.88rem', marginBottom: '.35rem' }}>Prova grande em partes (tokens insuficientes):</p>
        <ol style={{ paddingLeft: '1.2rem', lineHeight: '1.8', fontSize: '.9rem', color: 'var(--muted)' }}>
          <li>Envie a 1ª parte com o prompt <strong>"Prova nova"</strong> e importe o JSON.</li>
          <li>Para as partes seguintes, use o prompt <strong>"Continuar prova"</strong> — selecione a prova já importada.</li>
          <li>Importe cada parte normalmente: as questões são <strong>adicionadas</strong>, não apagam as anteriores.</li>
        </ol>
        <p className="muted mt-2">
          Arquivo de exemplo: <code>public/sample-exam.json</code>
        </p>
      </div>

      <PromptCard />
    </div>
  )
}
