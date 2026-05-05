import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { Exam, Question, Attempt, Flashcard } from '../types'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

export type BackupData = {
  version: 1
  exported_at: string
  exams: Exam[]
  questions: Question[]
  attempts: Attempt[]
  flashcards: Flashcard[]
}

type DataContextValue = {
  exams: Exam[]
  questions: Question[]
  attempts: Attempt[]
  flashcards: Flashcard[]
  loading: boolean
  dbError: string
  saveExam(exam: Exam): Promise<void>
  saveQuestions(qs: Question[]): Promise<void>
  saveAttempt(a: Attempt): Promise<void>
  saveFlashcard(c: Flashcard): Promise<void>
  saveMedia(questionId: string, file: File): Promise<void>
  deleteMedia(questionId: string): Promise<void>
  importAll(data: BackupData): Promise<{ exams: number; questions: number; attempts: number; flashcards: number }>
  exportData(): BackupData
}

const DataContext = createContext<DataContextValue>(null!)

function getFileExtension(file: File): string {
  const fromName = file.name.split('.').pop()?.toLowerCase()
  if (fromName && /^[a-z0-9]+$/.test(fromName)) return fromName

  const byMime: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
  }
  return byMime[file.type] ?? 'bin'
}

function hashQuestionId(input: string): string {
  let hash = 2166136261
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

function normalizeQuestion(q: Question): Question {
  return {
    ...q,
    type: q.type ?? (Object.keys(q.alternatives ?? {}).length === 0 ? 'discursive' : 'multiple_choice'),
    alternatives: (q.alternatives ?? {}) as Record<string, string>,
    tags: (q.tags ?? []) as string[],
  }
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth()

  const [exams, setExams]           = useState<Exam[]>([])
  const [questions, setQuestions]   = useState<Question[]>([])
  const [attempts, setAttempts]     = useState<Attempt[]>([])
  const [flashcards, setFlashcards] = useState<Flashcard[]>([])
  const [loading, setLoading]       = useState(true)
  const [dbError, setDbError]       = useState('')

  const loadAll = useCallback(async () => {
    setLoading(true)
    setDbError('')
    const [{ data: e, error: eErr }, { data: q }, { data: a }, { data: f }] = await Promise.all([
      supabase.from('exams').select('*').eq('user_id', currentUser).order('year', { ascending: false }),
      supabase.from('questions').select('*').eq('user_id', currentUser),
      supabase.from('attempts').select('*').eq('user_id', currentUser),
      supabase.from('flashcards').select('*').eq('user_id', currentUser),
    ])
    if (eErr) {
      setDbError(`Erro ao carregar dados do Supabase: ${eErr.message}. Verifique se as tabelas foram criadas (execute o supabase-setup.sql).`)
    }
    setExams(e ?? [])
    setQuestions((q ?? []).map(normalizeQuestion))
    setAttempts(a ?? [])
    setFlashcards(f ?? [])
    setLoading(false)
  }, [currentUser])

  useEffect(() => { loadAll() }, [loadAll])

  async function saveExam(exam: Exam): Promise<void> {
    const row = { ...exam, user_id: currentUser }
    const { error } = await supabase.from('exams').upsert(row)
    if (error) throw new Error(`Erro ao salvar prova: ${error.message}`)
    setExams((prev) => {
      const idx = prev.findIndex((e) => e.id === exam.id)
      return idx >= 0 ? prev.map((e, i) => (i === idx ? exam : e)) : [...prev, exam]
    })
  }

  async function saveQuestions(incoming: Question[]): Promise<void> {
    const rows = incoming.map((q) => ({ ...q, user_id: currentUser }))
    const { error } = await supabase.from('questions').upsert(rows)
    if (error) throw new Error(`Erro ao salvar questões: ${error.message}`)
    setQuestions((prev) => {
      const map = new Map(prev.map((q) => [q.id, q]))
      for (const q of incoming) map.set(q.id, q)
      return [...map.values()]
    })
  }

  async function saveAttempt(attempt: Attempt): Promise<void> {
    await supabase.from('attempts').insert({ ...attempt, user_id: currentUser })
    setAttempts((prev) => [...prev, attempt])
  }

  async function saveFlashcard(card: Flashcard): Promise<void> {
    await supabase.from('flashcards').upsert({ ...card, user_id: currentUser })
    setFlashcards((prev) => {
      const idx = prev.findIndex((c) => c.id === card.id)
      return idx >= 0 ? prev.map((c, i) => (i === idx ? card : c)) : [...prev, card]
    })
  }

  async function saveMedia(questionId: string, file: File): Promise<void> {
    const bucket = supabase.storage.from('question-media')
    const ext = getFileExtension(file)
    const baseFolder = 'media'
    const objectStem = `q_${hashQuestionId(questionId)}`

    // Remove versões antigas da mídia dessa questão para evitar URL quebrada por troca de extensão.
    const { data: existingFiles, error: listError } = await bucket.list(baseFolder)
    if (listError) throw new Error(`Erro ao listar mídias: ${listError.message}`)

    const oldPaths = (existingFiles ?? [])
      .filter((f) => f.name === objectStem || f.name.startsWith(`${objectStem}.`))
      .map((f) => `${baseFolder}/${f.name}`)

    if (oldPaths.length > 0) {
      const { error: removeOldError } = await bucket.remove(oldPaths)
      if (removeOldError) throw new Error(`Erro ao remover mídia antiga: ${removeOldError.message}`)
    }

    const path = `${baseFolder}/${objectStem}.${ext}`
    const { error: uploadError } = await bucket.upload(path, file, {
      upsert: true,
      contentType: file.type || undefined,
      cacheControl: '3600',
    })
    if (uploadError) throw new Error(`Erro no upload da mídia: ${uploadError.message}`)

    const { data } = bucket.getPublicUrl(path)
    const mediaUrl = `${data.publicUrl}?v=${Date.now()}`
    // Atualiza para TODOS os usuários — a mídia é compartilhada entre logins.
    const { error: updateError } = await supabase.from('questions').update({ media_url: mediaUrl }).eq('id', questionId)
    if (updateError) throw new Error(`Erro ao salvar URL da mídia: ${updateError.message}`)
    setQuestions((prev) => prev.map((q) => (q.id === questionId ? { ...q, media_url: mediaUrl } : q)))
  }

  async function deleteMedia(questionId: string): Promise<void> {
    const bucket = supabase.storage.from('question-media')
    const baseFolder = 'media'
    const objectStem = `q_${hashQuestionId(questionId)}`
    const { data: existingFiles } = await bucket.list(baseFolder)
    const pathsToRemove = (existingFiles ?? [])
      .filter((f) => f.name === objectStem || f.name.startsWith(`${objectStem}.`))
      .map((f) => `${baseFolder}/${f.name}`)

    if (pathsToRemove.length > 0) {
      await bucket.remove(pathsToRemove)
    }

    // Remove para TODOS os usuários — a mídia é compartilhada entre logins.
    await supabase.from('questions').update({ media_url: null }).eq('id', questionId)
    setQuestions((prev) => prev.map((q) => (q.id === questionId ? { ...q, media_url: undefined } : q)))
  }

  async function importAll(data: BackupData) {
    const examRows      = data.exams.map((e) => ({ ...e, user_id: currentUser }))
    const questionRows  = data.questions.map((q) => ({ ...normalizeQuestion(q), user_id: currentUser }))
    const flashcardRows = data.flashcards.map((f) => ({ ...f, user_id: currentUser }))

    await supabase.from('exams').upsert(examRows)
    await supabase.from('questions').upsert(questionRows)
    await supabase.from('flashcards').upsert(flashcardRows)

    const existingIds = new Set(attempts.map((a) => a.id))
    const newAttempts = (data.attempts ?? []).filter((a) => !existingIds.has(a.id))
    if (newAttempts.length > 0) {
      await supabase.from('attempts').insert(newAttempts.map((a) => ({ ...a, user_id: currentUser })))
    }

    await loadAll()
    return {
      exams:      data.exams.length,
      questions:  data.questions.length,
      attempts:   newAttempts.length,
      flashcards: data.flashcards.length,
    }
  }

  function exportData(): BackupData {
    return { version: 1, exported_at: new Date().toISOString(), exams, questions, attempts, flashcards }
  }

  return (
    <DataContext.Provider value={{
      exams, questions, attempts, flashcards, loading, dbError,
      saveExam, saveQuestions, saveAttempt, saveFlashcard,
      saveMedia, deleteMedia, importAll, exportData,
    }}>
      {children}
    </DataContext.Provider>
  )
}

export function useData() {
  return useContext(DataContext)
}
