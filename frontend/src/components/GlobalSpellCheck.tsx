'use client'

import { applySpellCheckDefault, applySpellCheckUnder } from '@/lib/dom/spell-check'
import { useEffect } from 'react'

/**
 * Habilita `spellCheck` en inputs y textareas del DOM (incluye modales montados después).
 * El idioma del diccionario lo toma el navegador de `<html lang="es-MX">`.
 * Opt-out: `spellCheck={false}` o `data-spellcheck="off"`.
 */
export default function GlobalSpellCheck() {
  useEffect(() => {
    applySpellCheckUnder(document.body)

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement) {
            applySpellCheckDefault(node)
          } else if (node instanceof HTMLElement) {
            applySpellCheckUnder(node)
          }
        })
      }
    })

    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  return null
}
