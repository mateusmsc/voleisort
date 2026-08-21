# 04 — Hydration (Boot do App)

## O problema

Com `persist` do Zustand, os stores eram rehidratados do `localStorage`
automaticamente na inicialização. Sem ele, os stores começam vazios (`players: {}`,
`sessions: {}`, `matches: {}`).

Precisa-se de uma etapa de **boot** que, após o auth anônimo, busca os dados do
Supabase e preenche os stores em memória antes de renderizar a UI.

---

## Estratégia

O boot acontece em `main.jsx`, de forma sequencial:

```
1. useThemeStore.init()          → aplica dark mode (localStorage, síncrono)
2. ensureAuth()                  → garante JWT anônimo (async)
3. hydrateStores()               → busca dados do Supabase e preenche stores (async)
4. ReactDOM.render(<App />)      → renderiza a UI com os dados já carregados
```

Renderizar só após o boot evita flashes de UI vazia e race conditions entre
componentes tentando ler dados que ainda não chegaram.

---

## `src/services/bootstrap.js` (novo)

Busca todos os dados necessários para o app funcionar e popula os stores
via os métodos `_hydrate` definidos no plano 03.

```js
import { playerService }  from './playerService'
import { sessionService } from './sessionService'
import { matchService }   from './matchService'
import { usePlayerStore }  from '../store/usePlayerStore'
import { useSessionStore } from '../store/useSessionStore'
import { useMatchStore }   from '../store/useMatchStore'

export async function hydrateStores() {
  // Busca em paralelo para minimizar tempo de boot
  const [players, sessions] = await Promise.all([
    playerService.getAll(),
    sessionService.getAll(),
  ])

  // Matches são buscados apenas das sessões existentes — evita carregar
  // matches de sessões antigas que não estão mais no estado
  const sessionIds = sessions.map(s => s.id)
  const matches = sessionIds.length > 0
    ? (await Promise.all(sessionIds.map(id => matchService.getBySession(id)))).flat()
    : []

  // Popula os stores em memória
  usePlayerStore.getState()._hydrate(players)
  useSessionStore.getState()._hydrate(sessions)
  useMatchStore.getState()._hydrate(matches)
}
```

---

## `src/main.jsx` — versão final

```jsx
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
```

---

## Loading state (opcional — melhoria UX)

Para evitar tela em branco durante o boot, pode-se mostrar um spinner simples
no `index.html` que é removido quando o React assume:

```html
<!-- index.html -->
<div id="root">
  <div id="boot-loader" style="
    display: flex; align-items: center; justify-content: center;
    min-height: 100vh; background: #f7f5f0;
  ">
    <p style="font-size: 14px; color: #a8a29e;">carregando...</p>
  </div>
</div>
```

O React sobrescreve o conteúdo do `#root` automaticamente quando renderiza — o
loader some sem código extra.

---

## Performance do boot

Com o Supabase no plano gratuito e dados típicos de uma pelada (20 jogadores,
1 sessão, 10 partidas):

| Query | Tempo estimado |
|---|---|
| `playerService.getAll()` | ~100ms |
| `sessionService.getAll()` | ~80ms |
| `matchService.getBySession()` | ~100ms |
| **Total (em paralelo)** | **~150–200ms** |

Bem abaixo do threshold perceptível pelo usuário (~300ms).

---

## Hydration parcial por sessão (otimização futura)

Na versão atual, `hydrateStores` busca **todos** os dados do usuário. Se um
usuário acumular muitas sessões ao longo do tempo, pode ser mais eficiente
buscar só a sessão ativa e seus matches:

```js
// Estratégia futura: hydration lazy por sessão
// 1. Boot: busca só players e sessions (leve)
// 2. Ao entrar em /session/:code/checkin: busca matches daquela sessão
```

Isso pode ser implementado como um hook `useSessionData(code)` que faz a busca
no mount do `Checkin.jsx` — sem alterar a arquitetura atual.

---

## Resumo das fases e arquivos

| Fase | Plano | Arquivos alterados/criados |
|---|---|---|
| 1 — Auth | `01-auth-anonimo.md` | `src/services/auth.js` (criar), `src/main.jsx` |
| 2 — Services | `02-services.md` | `src/services/playerService.js`, `sessionService.js`, `matchService.js` (criar) |
| 3 — Stores | `03-migracao-stores.md` | `usePlayerStore.js`, `useSessionStore.js`, `useMatchStore.js`, `Checkin.jsx`, `Match.jsx` |
| 4 — Boot | `04-hydration-boot.md` | `src/services/bootstrap.js` (criar), `src/main.jsx` |

**Ordem de execução obrigatória:** Fase 1 → 2 → 3 → 4.
Cada fase pode ser commitada e testada de forma independente.
