export interface Exam {
  id: string
  title: string
  year: number
  board: string
  agency: string
  role: string
  area: string
  tags: string[]
  source_url?: string
  answer_key_url?: string
}

export type QuestionType = 'multiple_choice' | 'discursive'

export interface Question {
  id: string
  exam_id: string
  number: number
  type: QuestionType
  area: string
  topic: string
  statement: string
  /** Vazio para questões discursivas */
  alternatives: Record<string, string>
  /** Resposta correta (letra) para múltipla escolha; resposta modelo para discursivas */
  correct_answer: string
  explanation: string
  tags: string[]
  needs_review?: boolean
  /** true quando o enunciado faz referência a imagem, tabela ou gráfico */
  has_media?: boolean
  /** URL externa ou data-URL da mídia (opcional; alternativa ao upload via IndexedDB) */
  media_url?: string
}

export interface Attempt {
  id: string
  question_id: string
  selected_answer: string
  is_correct: boolean
  answered_at: string
}

export type FlashcardStatus = 'new' | 'learning' | 'review'
export type FlashcardRating = 'wrong' | 'hard' | 'good' | 'easy'

export interface Flashcard {
  id: string
  question_id: string
  front: string
  back: string
  status: FlashcardStatus
  due_at: string
  interval_days: number
  ease: number
}

export interface ImportPayload {
  exam: Omit<Exam, 'id'> & { id?: string }
  questions: Array<
    Omit<Question, 'id' | 'exam_id' | 'tags' | 'type'> & {
      id?: string
      type?: QuestionType
      tags?: string[]
      has_media?: boolean
      media_url?: string
    }
  >
}
