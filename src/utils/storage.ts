import type { Exam, Question, Attempt, Flashcard } from '../types'
import { createFlashcardFromQuestion } from './flashcardUtils'

const KEYS = {
  exams: 'aqui:exams',
  questions: 'aqui:questions',
  attempts: 'aqui:attempts',
  flashcards: 'aqui:flashcards',
} as const

function load<T>(key: string): T[] {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '[]') as T[]
  } catch {
    return []
  }
}

function save<T>(key: string, data: T[]): void {
  localStorage.setItem(key, JSON.stringify(data))
}

// ── Exams ──────────────────────────────────────────────────
export function getExams(): Exam[] {
  return load<Exam>(KEYS.exams)
}

export function saveExam(exam: Exam): void {
  const all = getExams()
  const idx = all.findIndex((e) => e.id === exam.id)
  if (idx >= 0) all[idx] = exam
  else all.push(exam)
  save(KEYS.exams, all)
}

// ── Questions ──────────────────────────────────────────────
export function getQuestions(): Question[] {
  return load<Question>(KEYS.questions).map((q) => ({
    ...q,
    // migração: questões importadas antes do campo type existir
    type: q.type ?? (Object.keys(q.alternatives ?? {}).length === 0 ? 'discursive' : 'multiple_choice'),
  }))
}

export function saveQuestions(incoming: Question[]): void {
  const all = getQuestions()
  for (const q of incoming) {
    const idx = all.findIndex((x) => x.id === q.id)
    if (idx >= 0) all[idx] = q
    else all.push(q)
  }
  save(KEYS.questions, all)
}

export function getQuestionsByExam(examId: string): Question[] {
  return getQuestions().filter((q) => q.exam_id === examId)
}

// ── Attempts ───────────────────────────────────────────────
export function getAttempts(): Attempt[] {
  return load<Attempt>(KEYS.attempts)
}

export function saveAttempt(attempt: Attempt): void {
  const all = getAttempts()
  all.push(attempt)
  save(KEYS.attempts, all)
}

export function getAttemptsForQuestion(questionId: string): Attempt[] {
  return getAttempts().filter((a) => a.question_id === questionId)
}

// ── Flashcards ─────────────────────────────────────────────
export function getFlashcards(): Flashcard[] {
  return load<Flashcard>(KEYS.flashcards)
}

export function saveFlashcard(card: Flashcard): void {
  const all = getFlashcards()
  const idx = all.findIndex((c) => c.id === card.id)
  if (idx >= 0) all[idx] = card
  else all.push(card)
  save(KEYS.flashcards, all)
}

export function getDueFlashcards(): Flashcard[] {
  const now = new Date().toISOString()
  return getFlashcards().filter((c) => c.due_at <= now)
}

// ── Backup / Restore ───────────────────────────────────────

export interface BackupData {
  version: 1
  exported_at: string
  exams: Exam[]
  questions: Question[]
  attempts: Attempt[]
  flashcards: Flashcard[]
}

export function exportBackup(): BackupData {
  return {
    version: 1,
    exported_at: new Date().toISOString(),
    exams: getExams(),
    questions: getQuestions(),
    attempts: getAttempts(),
    flashcards: getFlashcards(),
  }
}

/**
 * Merges a backup into the current data.
 * Existing records are overwritten if they share the same ID.
 * Returns counts of what was merged.
 */
export function importBackup(data: BackupData): { exams: number; questions: number; attempts: number; flashcards: number } {
  for (const exam of data.exams ?? []) saveExam(exam)

  const questions: Question[] = (data.questions ?? []).map((q) => ({
    ...q,
    type: q.type ?? (Object.keys(q.alternatives ?? {}).length === 0 ? 'discursive' : 'multiple_choice'),
  }))
  saveQuestions(questions)

  const allAttempts = getAttempts()
  const existingIds = new Set(allAttempts.map((a) => a.id))
  const newAttempts = (data.attempts ?? []).filter((a) => !existingIds.has(a.id))
  save(KEYS.attempts, [...allAttempts, ...newAttempts])

  for (const card of data.flashcards ?? []) saveFlashcard(card)

  return {
    exams: data.exams?.length ?? 0,
    questions: data.questions?.length ?? 0,
    attempts: newAttempts.length,
    flashcards: data.flashcards?.length ?? 0,
  }
}

/**
 * Rebuilds front/back of every saved flashcard using the current format.
 * Call once at app startup to migrate cards created with the old format.
 */
export function migrateFlashcards(): void {
  const cards = getFlashcards()
  if (cards.length === 0) return
  const questions = getQuestions()
  const qMap = new Map(questions.map((q) => [q.id, q]))
  let changed = false
  const updated = cards.map((card) => {
    const q = qMap.get(card.question_id)
    if (!q) return card
    const rebuilt = createFlashcardFromQuestion(q)
    // preserve review schedule, only fix content
    const fixed: Flashcard = { ...card, front: rebuilt.front, back: rebuilt.back }
    if (fixed.front !== card.front || fixed.back !== card.back) changed = true
    return fixed
  })
  if (changed) save(KEYS.flashcards, updated)
}
