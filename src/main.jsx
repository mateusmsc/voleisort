import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { useThemeStore } from './store/useThemeStore.js'
import { ensureAuth }    from './services/auth.js'
import { hydrateStores } from './services/bootstrap.js'

useThemeStore.getState().init()

async function boot() {
  await ensureAuth()
  await hydrateStores()
}

const root = createRoot(document.getElementById('root'))

boot()
  .then(() => {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>
    )
  })
  .catch(err => {
    console.error('Boot falhou:', err)
    // Renderiza mesmo assim — app funcionará com dados vazios
    root.render(
      <StrictMode>
        <App />
      </StrictMode>
    )
  })
