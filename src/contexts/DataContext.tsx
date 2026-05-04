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

function normalizeQuestion(q: Question): Question {
  return {
    ...q,
    type: q.type ?? (Object.keys(q.alternatives ?? {}).length === 0 ? 'discursive' : 'multiple_choice'),
    alternatives: (q.alternatives ?? {}) as Record<string, string>,
    tags: (q.tags ?? []) as string[],
  }
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [exams, setExams]         = useState<Exam[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [attempts, setAttempts]   = useState<Attempt[]>([])
  const [flashcards, setFlashcards] = useState<Flashcard[]>([])
  const [loading, setLoading]     = useState(true)

  const loadAll = useCallback(async () => {
    if (!user) { setLoading(false); return }
    setLoading(true)
    const [{ data: e }, { data: q }, { data: a }, { data: f }] = await Promise.all([
      supabase.from('exams').select('*').eq('user_id', user.id).order('year', { ascending: false }),
      supabase.from('questions').select('*').eq('user_id', user.id),
      supabase.from('attempts').select('*').eq('user_id', user.id),
      supabase.from('flashcards').select('*').eq('user_id', user.id),
    ])
    setExams(e ?? [])
    setQuestions((q ?? []).map(normalizeQuestion))
    setAttempts(a ?? [])
    setFlashcards(f ?? [])
    setLoading(false)
  }, [user])

  useEffect(() => { loadAll() }, [loadAll])

  async function saveExam(exam: Exam): Promise<void> {
    await supabase.from('exams').upsert({ ...exam, user_id: user!.id })
    setExams((prev) => {
      const idx = prev.findIndex((e) => e.id === exam.id)
      return idx >= 0 ? prev.map((e, i) => (i === idx ? exam : e)) : [...prev, exam]
    })
  }

  async function saveQuestions(incoming: Question[]): Promise<void> {
    const rows = incoming.map((q) => ({ ...q, user_id: user!.id }))
    await supabase.from('questions').upsert(rows)
    setQuestions((prev) => {
      const map = new Map(prev.map((q) => [q.id, q]))
      for (const q of incoming) map.set(q.id, q)
      return [...map.values()]
    })
  }

  async function saveAttempt(attempt: Attempt): Promise<void> {
    await supabase.from('attempts').insert({ ...attempt, user_id: user!.id })
    setAttempts((prev) => [...prev, attempt])
  }

  async function saveFlashcard(card: Flashcard): Promise<void> {
    await supabase.from('flashcards').upsert({ ...card, user_id: user!.id })
    setFlashcards((prev) => {
      const idx = prev.findIndex((c) => c.id === card.id)
      return idx >= 0 ? prev.map((c, i) => (i === idx ? card : c)) : [...prev, card]
    })
  }

  async function saveMedia(questionId: string, file: File): Promise<void> {
    const path = `${user!.id}/${questionId}`
    await supabase.storage.from('question-media').upload(path, file, { upsert: true })
    const { data } = supabase.storage.from('question-media').getPublicUrl(path)
    const mediaUrl = data.publicUrl
    await supabase.from('questions').update({ media_url: mediaUrl }).eq('id', questionId).eq('user_id', user!.id)
    setQuestions((prev) => prev.map((q) => (q.id === questionId ? { ...q, media_url: mediaUrl } : q)))
  }

  async function deleteMedia(questionId: string): Promise<void> {
    const path = `${user!.id}/${questionId}`
    await supabase.storage.from('question-media').remove([path])
    await supabase.from('questions').update({ media_url: null }).eq('id', questionId).eq('user_id', user!.id)
    setQuestions((prev) => prev.map((q) => (q.id === questionId ? { ...q, media_url: undefined } : q)))
  }

  async function importAll(data: BackupData) {
    const uid = user!.id
    await supabase.from('exams').upsert(data.exams.map((e) => ({ ...e, user_id: uid })))
    await supabase.from('questions').upsert(data.questions.map((q) => ({ ...normalizeQuestion(q), user_id: uid })))
    await supabase.from('flashcards').upsert(data.flashcards.map((c) => ({ ...c, user_id: uid })))

    const existingIds = new Set(attempts.map((a) => a.id))
    const newAttempts = (data.attempts ?? []).filter((a) => !existingIds.has(a.id))
    if (newAttempts.length > 0) {
      await supabase.from('attempts').insert(newAttempts.map((a) => ({ ...a, user_id: uid })))
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
    return {
      version: 1,
      exported_at: new Date().toISOString(),
      exams,
      questions,
      attempts,
      flashcards,
    }
  }

  return (
    <DataContext.Provider value={{
      exams, questions, attempts, flashcards, loading,
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
