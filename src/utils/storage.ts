/**
 * Utilitários de backup (export/import local do JSON).
 * Todo o CRUD real de dados é feito pelo DataContext via Supabase.
 */

import type { BackupData } from '../contexts/DataContext'

export type { BackupData }

export function downloadBackup(data: BackupData): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  const date = new Date().toISOString().slice(0, 10)
  a.href     = url
  a.download = `backup-sedsc-${date}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function parseBackup(json: string): BackupData {
  const data = JSON.parse(json) as BackupData
  if (data.version !== 1 || !Array.isArray(data.exams)) {
    throw new Error('Arquivo de backup inválido ou versão não reconhecida.')
  }
  return data
}
