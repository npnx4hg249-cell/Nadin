import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

type Theme = 'dark' | 'light'

interface ThemeState {
  theme: Theme
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
}

function applyTheme(theme: Theme) {
  const root = document.documentElement
  if (theme === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
}

export const useThemeStore = create<ThemeState>()(
  devtools(
    persist(
      (set) => ({
        theme: 'dark',

        toggleTheme: () =>
          set((state) => {
            const next: Theme = state.theme === 'dark' ? 'light' : 'dark'
            applyTheme(next)
            return { theme: next }
          }),

        setTheme: (theme) => {
          applyTheme(theme)
          set({ theme })
        },
      }),
      {
        name: 'nadin-theme',
        onRehydrateStorage: () => (state) => {
          if (state) {
            applyTheme(state.theme)
          }
        },
      },
    ),
    { name: 'theme-store' },
  ),
)
