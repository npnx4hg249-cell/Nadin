import { useLanguageStore } from '@/store/languageStore'
import { en } from './en'
import { de } from './de'

const translations = { en, de }

export function useT() {
  const language = useLanguageStore((s) => s.language)
  return translations[language]
}

export type { Translations } from './en'
export { en, de }
