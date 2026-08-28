// ── Theme module: light/dark with system-preference default ──
// Applies a `dark` class on <html> (drives Tailwind dark: variants) and
// dispatches a `kanban:theme-change` event so SVG-hardcoded-color components
// (e.g. GanttPage) can re-render with theme-aware colors.

import { useState, useEffect } from 'react'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'kanban_theme'

function systemPref(): Theme {
  return typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

export function getTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored === 'dark' || stored === 'light' ? stored : systemPref()
}

export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  window.dispatchEvent(new CustomEvent('kanban:theme-change', { detail: theme }))
}

export function setTheme(theme: Theme): void {
  localStorage.setItem(STORAGE_KEY, theme)
  applyTheme(theme)
}

export function toggleTheme(): void {
  setTheme(getTheme() === 'dark' ? 'light' : 'dark')
}

// Run ASAP (before first paint) so dark users never see a light flash
applyTheme(getTheme())

/** React hook: current theme + toggle. Re-renders on theme change anywhere. */
export function useTheme(): [Theme, () => void] {
  const [theme, setThemeState] = useState<Theme>(getTheme())
  useEffect(() => {
    const handler = (e: Event) => setThemeState((e as CustomEvent<Theme>).detail)
    window.addEventListener('kanban:theme-change', handler)
    return () => window.removeEventListener('kanban:theme-change', handler)
  }, [])
  return [theme, () => toggleTheme()]
}
