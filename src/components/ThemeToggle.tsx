import { useTheme } from '@/utils/theme'

/** Floating light/dark toggle, fixed bottom-right on every page. */
function ThemeToggle() {
  const [theme, toggle] = useTheme()
  return (
    <button
      onClick={toggle}
      title={theme === 'dark' ? '切换为亮色模式' : '切换为暗色模式'}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className="fixed bottom-4 right-4 z-50 flex items-center justify-center w-11 h-11 rounded-full shadow-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
    >
      {theme === 'dark' ? '🌙' : '☀️'}
    </button>
  )
}

export default ThemeToggle
