# 01 — Auth Anônimo

## Por que é obrigatório

As políticas RLS criadas na migration `002_rls_policies.sql` exigem `TO authenticated`
em todas as operações. Sem um usuário autenticado, **qualquer chamada ao Supabase
retorna 401** — mesmo com a anon key correta.

A solução é o **auth anônimo do Supabase**: o app chama
`supabase.auth.signInAnonymously()` na inicialização. O Supabase cria um usuário
real na tabela `auth.users`, persiste a sessão no `localStorage` automaticamente,
e a partir daí todas as chamadas ao banco incluem o JWT correto.

---

## Comportamento

| Situação | O que acontece |
|---|---|
| Primeiro acesso | `signInAnonymously()` cria usuário anônimo, salva sessão no localStorage |
| Acessos seguintes | SDK restaura a sessão automaticamente — **não cria novo usuário** |
| Usuário limpa localStorage | Novo usuário anônimo é criado na próxima abertura |

O usuário anônimo **não tem email nem senha** — é identificado apenas pelo
`auth.uid()` que o Supabase gera. É suficiente para a Fase 1 onde não há
isolamento por dono.

---

## Implementação

### `src/services/supabase.js` (atualizar)

```js
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  throw new Error(
    'Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env.local'
  )
}

export const supabase = createClient(url, key)
```

### `src/services/auth.js` (novo)

```js
import { supabase } from './supabase'

/**
 * Garante que existe uma sessão autenticada (anônima).
 * Chamado uma única vez no boot do app, antes de qualquer query.
 * Se já existe sessão salva no localStorage, o SDK a restaura sem criar novo usuário.
 */
export async function ensureAuth() {
  const { data: { session } } = await supabase.auth.getSession()

  if (session) return session  // já autenticado

  const { data, error } = await supabase.auth.signInAnonymously()
  if (error) throw new Error(`Auth falhou: ${error.message}`)

  return data.session
}
```

### `src/main.jsx` (atualizar)

```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { useThemeStore } from './store/useThemeStore.js'
import { ensureAuth } from './services/auth.js'

useThemeStore.getState().init()

// Auth anônimo antes de renderizar — garante JWT nas queries do Supabase
ensureAuth().then(() => {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>
  )
}).catch(err => {
  // Fallback: renderiza mesmo sem auth (modo offline/degradado)
  console.error('Auth falhou, continuando sem Supabase:', err)
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>
  )
})
```

---

## Onde o tema do `useThemeStore` se encaixa

O `useThemeStore` usa apenas `localStorage` (preferência visual, sem dados de negócio).
Ele **não precisa ser migrado para o Supabase** — mantém o `persist` do Zustand
normalmente. Só os três stores de domínio (`players`, `sessions`, `matches`) migram.

---

## Verificação

Após implementar, abrir o devtools do browser:

1. **Application → Local Storage** → deve existir uma chave `sb-wcoqwgogjzjiyivlsopn-auth-token`
2. **Console** → `supabase.auth.getUser()` deve retornar `{ id: '...', role: 'authenticated', ... }`
3. **Supabase Dashboard → Authentication → Users** → deve aparecer um usuário anônimo

---

## Arquivos alterados nesta fase

| Arquivo | Ação |
|---|---|
| `src/services/supabase.js` | Sem alteração (já existe) |
| `src/services/auth.js` | Criar |
| `src/main.jsx` | Envolver render em `ensureAuth().then(...)` |
