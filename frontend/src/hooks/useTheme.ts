import { useThemeStore } from '@/store/themeStore'

export function useTheme() {
  const { theme, toggleTheme, setTheme } = useThemeStore()
  const isDark = theme === 'dark'
  return { theme, isDark, toggleTheme, setTheme }
}
