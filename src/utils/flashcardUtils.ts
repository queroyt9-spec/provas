import type { Flashcard, FlashcardRating, Question } from '../types'

const INTERVAL: Record<FlashcardRating, number> = {
  wrong: 1,
  hard: 2,
  good: 4,
  easy: 7,
}

export function createFlashcardFromQuestion(question: Question): Flashcard {
  const isDiscursive = question.type === 'discursive' ||
    Object.keys(question.alternatives).length === 0

  let front: string
  let back: string

  if (isDiscursive) {
    front = question.statement
    back = question.explanation
      ? `📝 Resposta modelo:\n\n${question.correct_answer}\n\nExplicação: ${question.explanation}`
      : `📝 Resposta modelo:\n\n${question.correct_answer}`
  } else {
    const alternatives = Object.entries(question.alternatives)
      .map(([letter, text]) => `${letter}) ${text}`)
      .join('\n')
    front = `${question.statement}\n\n${alternatives}`
    back = question.explanation
      ? `✅ Resposta correta: ${question.correct_answer}\n\nExplicação: ${question.explanation}`
      : `✅ Resposta correta: ${question.correct_answer}`
  }

  const dueAt = new Date()
  dueAt.setDate(dueAt.getDate() + 1)

  return {
    id: `card_${question.id}`,
    question_id: question.id,
    front,
    back,
    status: 'new',
    due_at: dueAt.toISOString(),
    interval_days: 1,
    ease: 2.5,
  }
}

export function applyRating(card: Flashcard, rating: FlashcardRating): Flashcard {
  const days = INTERVAL[rating]
  const due = new Date()
  due.setDate(due.getDate() + days)

  return {
    ...card,
    status: rating === 'wrong' ? 'learning' : 'review',
    interval_days: days,
    due_at: due.toISOString(),
    ease: adjustEase(card.ease, rating),
  }
}

function adjustEase(ease: number, rating: FlashcardRating): number {
  const delta: Record<FlashcardRating, number> = {
    wrong: -0.3,
    hard: -0.15,
    good: 0,
    easy: 0.1,
  }
  return Math.max(1.3, ease + delta[rating])
}
