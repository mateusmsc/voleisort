# Sumário de Planos — voleisort

Histórico de todos os planos de desenvolvimento, organizados por fase.

---

## Fase 1 — Frontend (MVP localStorage)

> Implementado até 2026-06-27 (commits `first commit`, `Fixing bugs`, `Refactor match page`)

| # | Arquivo | Conteúdo | Status |
|---|---|---|---|
| 00 | `arquivado/frontend/00-visao-geral.md` | Arquitetura geral, stack (React + Vite + Zustand + Tailwind + PWA), modelo de dados, fluxo principal | Concluído |
| 01 | `arquivado/frontend/01-setup-projeto.md` | Criação do projeto Vite, dependências, configuração PWA, Tailwind, estrutura de pastas inicial | Concluído |
| 02 | `arquivado/frontend/02-dados-e-storage.md` | Stores Zustand com `persist` no localStorage (`usePlayerStore`, `useSessionStore`, `useMatchStore`) | Concluído — substituído na Fase 2 |
| 03 | `arquivado/frontend/03-logica-balanceamento.md` | Algoritmo de formação de times, fila de espera (`queue.js`), cálculo de rating pós-partida | Concluído |
| 04 | `arquivado/frontend/04-telas-home-sessao.md` | Tela inicial (Home), criar sessão, entrar com código | Concluído |
| 05 | `arquivado/frontend/05-tela-checkin.md` | Check-in de jogadores presentes, seleção individual e em lote, adicionar novo jogador | Concluído |
| 06 | `arquivado/frontend/06-tela-partida.md` | Partida em andamento, encerrar partida, selecionar vencedor, fila de próximos times | Concluído |
| 06b | `arquivado/frontend/06b-logica-fila-times.md` | Lógica detalhada da fila de times, `advanceQueue`, substituições no checkin com partida ativa | Concluído |
| 07 | `arquivado/frontend/07-tela-jogador.md` | Perfil do jogador, estatísticas, histórico de partidas | Concluído |
| 08 | `arquivado/frontend/08-exportar-sessao.md` | Código de sessão, exportação/importação JSON base64, compartilhamento via link | Concluído |

---

## Fase 2 — Database (migração localStorage → Supabase)

> Implementado em 2026-07-11

| # | Arquivo | Conteúdo | Status | Data |
|---|---|---|---|---|
| 00 | `arquivado/database/00-visao-geral-banco.md` | Schema das tabelas (`players`, `sessions`, `matches`), decisões de design (JSONB, uuid[] client-side), RLS, mapeamento frontend↔banco | Referência | — |
| 01 | `arquivado/database/01-auth-anonimo.md` | Auth anônimo via `supabase.auth.signInAnonymously()`, `src/services/auth.js`, integração no `main.jsx` | Concluído | 2026-07-11 |
| 02 | `arquivado/database/02-services.md` | Camada de acesso ao banco: `playerService`, `sessionService`, `matchService` com funções `toDb`/`fromDb` (camelCase ↔ snake_case) | Concluído | 2026-07-11 |
| 03 | `arquivado/database/03-migracao-stores.md` | Remoção do middleware `persist` dos stores, actions tornadas `async` com chamadas aos services, optimistic update, métodos `_hydrate`, correção de `setState` direto em `Checkin.jsx` e `Match.jsx` | Concluído | 2026-07-11 |
| 04 | `arquivado/database/04-hydration-boot.md` | `src/services/bootstrap.js` com `hydrateStores()`, sequência de boot `init → ensureAuth → hydrateStores → render`, loading state no `index.html` | Concluído | 2026-07-11 |

### Migrations executadas no Supabase

| Arquivo | Conteúdo | Status |
|---|---|---|
| `migrations/001_initial_schema.sql` | Criação das tabelas `players`, `sessions`, `matches` + índices | Aplicada |
| `migrations/002_rls_policies.sql` | RLS habilitado nas 3 tabelas, políticas de acesso para usuários autenticados (fase 1: qualquer `authenticated`) | Aplicada |

---

## Cobertura de testes

> Todos os testes passando em 2026-07-11 — **178 testes**

| Arquivo | Testes | O que cobre |
|---|---|---|
| `src/logic/balancing.test.js` | 4 | `shuffleTeams` — tamanhos, unicidade, swaps |
| `src/logic/checkin-logic.test.js` | 31 | Substituições no checkin com partida ativa |
| `src/logic/checkin-integration.test.js` | 4 | Integração do fluxo de checkin |
| `src/logic/display-name.test.js` | 4 | Formatação de nomes |
| `src/logic/edit-teams.test.js` | 15 | Edição de times em campo e próximos |
| `src/logic/queue.test.js` | 22 | `distributeAllPlayers`, `advanceQueue`, `snakeDraft` |
| `src/logic/teamsize.test.js` | 65 | Variações de tamanho de time e distribuição |
| `src/services/playerService.test.js` | 8 | Mappers `toDb`/`fromDb`, patch parcial, upsert |
| `src/services/sessionService.test.js` | 12 | Mappers, defaults `null → []`, `appendPlayerId` |
| `src/services/matchService.test.js` | 13 | Mappers, `roundsOutResetAt`, `finish`, `cancel` |

---

## Arquivos criados/alterados por fase

### Fase 2 — arquivos novos
- `src/services/auth.js`
- `src/services/playerService.js`
- `src/services/sessionService.js`
- `src/services/matchService.js`
- `src/services/bootstrap.js`
- `src/services/playerService.test.js`
- `src/services/sessionService.test.js`
- `src/services/matchService.test.js`

### Fase 2 — arquivos alterados
- `src/store/usePlayerStore.js` — removido `persist`, actions async, `_hydrate`
- `src/store/useSessionStore.js` — removido `persist`, actions async, `_hydrate`
- `src/store/useMatchStore.js` — removido `persist`, actions async, `_hydrate`, novo `updateRoundsOutResetAt`
- `src/pages/Checkin/Checkin.jsx` — substituído `useMatchStore.setState` direto por `updateNextTeams`
- `src/pages/Match/Match.jsx` — substituído `useMatchStore.setState` direto por `updateRoundsOutResetAt`
- `src/main.jsx` — boot sequencial `ensureAuth → hydrateStores → render`
- `index.html` — loading state enquanto boot não finaliza

### Sem alteração (intencional)
- `src/store/useThemeStore.js` — mantém `persist` no localStorage (preferência visual, não é dado de negócio)

---

## Próximos passos planejados

| Prioridade | Item |
|---|---|
| Alta | Fase 2 de segurança: coluna `owner_id` nas tabelas + políticas RLS por dono |
| Alta | Isolamento de dados por device (cada usuário vê só suas sessões e jogadores) |
| Média | Hook `useSessionData(code)` para hydration lazy por sessão (performance) |
| Baixa | Suporte a múltiplos usuários numa mesma sessão (tabela `session_members`) |
