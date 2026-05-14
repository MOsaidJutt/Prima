'use client'

import { useEffect } from 'react'

// ── DevAutoFill ───────────────────────────────────────────────────────────────
// Development-only convenience: double-click ANYWHERE on the page and every
// empty input / textarea on screen fills with its placeholder text.
// Works with React controlled inputs by using the native value setter so
// React's synthetic event system picks up the change.
// Stripped out automatically in production (process.env.NODE_ENV check).

export function DevAutoFill() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return

    function fillAll() {
      const fields = document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
        'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]):not([type="color"]):not([type="file"]), textarea'
      )

      fields.forEach((field) => {
        const placeholder = field.placeholder
        // Only fill if the field is empty and has a placeholder
        if (!placeholder || field.value) return

        // Use native prototype setter so React's onChange fires correctly
        const proto =
          field.tagName === 'TEXTAREA'
            ? window.HTMLTextAreaElement.prototype
            : window.HTMLInputElement.prototype

        const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set

        if (nativeSetter) {
          nativeSetter.call(field, placeholder)
        } else {
          field.value = placeholder
        }

        // Dispatch both events — React listens to 'input', some libs listen to 'change'
        field.dispatchEvent(new Event('input', { bubbles: true }))
        field.dispatchEvent(new Event('change', { bubbles: true }))
      })
    }

    document.addEventListener('dblclick', fillAll)
    return () => document.removeEventListener('dblclick', fillAll)
  }, [])

  return null
}
