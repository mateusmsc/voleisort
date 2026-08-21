# 01 — Setup do Projeto

## 1. Criar o projeto com Vite + React

```bash
npm create vite@latest volei-app -- --template react
cd volei-app
npm install
```

---

## 2. Instalar dependências

```bash
# Roteamento
npm install react-router-dom

# Estado global
npm install zustand

# PWA
npm install -D vite-plugin-pwa

# Tailwind CSS
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# UUID para IDs únicos
npm install uuid
```

---

## 3. Configurar Tailwind

Em `tailwind.config.js`, adicionar os arquivos que o Tailwind deve escanear e as cores do app:

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        sage: {
          light: '#e8f0e8',
          DEFAULT: '#b8cdb8',
          dark: '#6a8f6a',
        },
        sand: {
          light: '#f0ebe2',
          DEFAULT: '#d4c9b8',
        },
        peach: {
          light: '#f5e8de',
          DEFAULT: '#e8c4b0',
        },
        sky: {
          light: '#e2edf5',
          DEFAULT: '#b0c8d8',
        },
      },
      borderRadius: {
        xl: '14px',
        '2xl': '20px',
      },
    },
  },
  plugins: [],
}
```

Em `src/index.css`, substituir o conteúdo por:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    background-color: #f7f5f0;
    color: #3a3530;
    font-family: system-ui, -apple-system, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
}
```

---

## 4. Configurar PWA

Em `vite.config.js`:

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Vôlei App',
        short_name: 'Vôlei',
        description: 'Organize sua pelada de vôlei',
        theme_color: '#6a8f6a',
        background_color: '#f7f5f0',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
      workbox: {
        // Cache de assets estáticos
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
      },
    }),
  ],
})
```

> Gerar os ícones em `public/icons/`. Qualquer imagem 512×512 serve para começar — pode ser um emoji de bola de vôlei exportado como PNG.

---

## 5. Configurar React Router

Em `src/App.jsx`:

```jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Home from './pages/Home/Home'
import SessionSetup from './pages/Session/SessionSetup'
import Checkin from './pages/Checkin/Checkin'
import Match from './pages/Match/Match'
import PlayerProfile from './pages/Player/PlayerProfile'

export default function App() {
  return (
    <BrowserRouter>
      <div className="max-w-md mx-auto min-h-screen">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/session/new" element={<SessionSetup />} />
          <Route path="/session/:code/checkin" element={<Checkin />} />
          <Route path="/session/:code/match/:matchId" element={<Match />} />
          <Route path="/player/:playerId" element={<PlayerProfile />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}
```

---

## 6. Estrutura de pastas a criar

Executar no terminal para criar toda a estrutura vazia:

```bash
mkdir -p src/pages/{Home,Session,Checkin,Match,Player}
mkdir -p src/components
mkdir -p src/store
mkdir -p src/logic
mkdir -p src/utils
mkdir -p public/icons

# Criar arquivos index vazios
touch src/store/useSessionStore.js
touch src/store/usePlayerStore.js
touch src/store/useMatchStore.js
touch src/logic/balancing.js
touch src/logic/rating.js
touch src/logic/queue.js
touch src/utils/storage.js
touch src/utils/session-code.js
```

---

## 7. Verificar que tudo funciona

```bash
npm run dev
```

Abrir `http://localhost:5173` — deve aparecer a tela padrão do Vite. A partir daqui, substituir pelo conteúdo do app nas próximas etapas.

Para testar o PWA em desenvolvimento:

```bash
npm run build
npm run preview
```

No Chrome, abrir DevTools → Application → Manifest e verificar se o PWA está registrado corretamente.
