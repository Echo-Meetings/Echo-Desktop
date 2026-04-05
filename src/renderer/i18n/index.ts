import { useAppStore } from '@/stores/appStore'
import { translations, type UILocale, type Translations } from './translations'

export type { UILocale, Translations }
export { translations, UI_LANGUAGES } from './translations'

/**
 * Get translations for the current UI language.
 */
export function useT(): Translations {
  const uiLanguage = useAppStore((s) => s.uiLanguage)
  return translations[uiLanguage] || translations.en
}

/**
 * Get translations without React hook (for use outside components).
 */
export function getT(): Translations {
  const uiLanguage = useAppStore.getState().uiLanguage
  return translations[uiLanguage] || translations.en
}

/**
 * Simple template string interpolation: t('Hello {name}', { name: 'World' })
 */
export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? `{${key}}`))
}

/**
 * Detect system UI language and map to supported locale.
 */
export function detectSystemLocale(): UILocale {
  const lang = navigator.language || navigator.languages?.[0] || 'en'
  const code = lang.split('-')[0].toLowerCase()
  if (code === 'ru') return 'ru'
  if (code === 'de') return 'de'
  if (code === 'fr') return 'fr'
  return 'en'
}
