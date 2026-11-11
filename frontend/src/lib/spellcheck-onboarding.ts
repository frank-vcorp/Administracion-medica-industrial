export const SPELLCHECK_ONBOARDING_STORAGE_KEY = 'sme-spellcheck-onboarding-v1'

export function isSpellcheckOnboardingDismissed(): boolean {
  try {
    if (typeof localStorage === 'undefined') return false
    return localStorage.getItem(SPELLCHECK_ONBOARDING_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function persistSpellcheckOnboardingDismissed(): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(SPELLCHECK_ONBOARDING_STORAGE_KEY, '1')
  } catch {
    // ignorar quota / modo privado
  }
}
