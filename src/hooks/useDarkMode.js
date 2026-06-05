import { useEffect, useState } from 'react'

const KEY = 'glivac-dark-mode'

export function useDarkMode() {
  const [dark, setDark] = useState(() => {
    try {
      const stored = localStorage.getItem(KEY)
      if (stored !== null) return stored === 'true'
      return window.matchMedia('(prefers-color-scheme: dark)').matches
    } catch {
      return false
    }
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    try { localStorage.setItem(KEY, String(dark)) } catch {}
  }, [dark])

  const toggle = () => setDark(v => !v)
  return { dark, toggle }
}
