import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useThemeStore = create(
  persist(
    (set, get) => ({
      dark: false,

      toggleDark() {
        const next = !get().dark
        set({ dark: next })
        if (next) {
          document.documentElement.classList.add('dark')
        } else {
          document.documentElement.classList.remove('dark')
        }
      },

      // Aplica a classe ao carregar a página
      init() {
        if (get().dark) {
          document.documentElement.classList.add('dark')
        }
      },
    }),
    { name: 'volei-theme' }
  )
)
