# Contexto do Projeto — voleisort

> Leia este arquivo junto com `premissas.md` antes de qualquer implementação.

## O que é o projeto

PWA para organizar peladas de vôlei: registra jogadores, faz check-in no dia, forma times balanceados por nível via `levelSpreadDraft` e gerencia uma fila de espera com critério de equidade (tempo de fora).

Stack: React 18 + Vite 5 + Tailwind CSS 3 + Zustand 5 + Supabase (PostgreSQL) + React Router v7 + Vitest.

---

## Estrutura de pastas

```
src/
  logic/      # lógica pura (sem React, sem stores) — testada
  store/      # estado global Zustand (em memória, hidratado no boot)
  services/   # acesso ao Supabase (auth, CRUD, bootstrap)
  pages/      # telas da aplicação (uma pasta por rota)
  components/ # componentes reutilizáveis
  utils/      # utilitários (session-code, storage, levels)
tests/
  unit/
    logic/    # testes de src/logic/ (imports relativos)
    services/ # testes de src/services/ (imports via alias @/)
  integration/ # testes de integração entre módulos
```

---

## Modelo de dados

### Player
```js
{ id, name, createdAt, stats: { matches, wins, losses }, level }
```

### Session
```js
{
  id, code,         // code = 3 letras + 3 dígitos (ex: "ABC123")
  name, createdAt,
  status,           // 'active' | 'finished'
  config: { teamSize, maxRoundsOut, ratingDeltaThreshold },
  playerIds: [],    // todos os jogadores da sessão
  checkedInIds: [], // presentes no dia
  matchIds: [],
}
```

### Match
```js
{
  id, sessionId, round,
  status,           // 'ongoing' | 'finished' | 'cancelled'
  teams: { A: [ids], B: [ids] },
  nextTeams: [[ids], [ids], ...], // fila de próximos times
  winner,           // 'A' | 'B' | null
  startedAt, finishedAt,
  roundsOutResetAt, // opcional — round em que o contador de "fora" foi zerado
}
```

---

## Boot sequence

```
main.jsx
  → useThemeStore.init()            # aplica dark mode antes de renderizar
  → ensureAuth()                    # auth anônimo Supabase (ou restaura sessão existente)
  → hydrateStores()                 # carrega sessões → players + matches em paralelo
  → root.render(<App />)            # renderiza a aplicação
```

Em caso de falha no boot, a aplicação renderiza mesmo assim com dados vazios.

---

## Stores Zustand

Todos os stores de negócio são **em memória** (sem `persist`). São hidratados no boot pelo `bootstrap.js` via `_hydrate()`.

| Store | Entidade | Actions principais |
|---|---|---|
| `usePlayerStore` | `players: {}` | `addPlayer`, `updatePlayer`, `applyMatchResult`, `importPlayers`, `removePlayer` |
| `useSessionStore` | `sessions: {}`, `activeSessionId` | `createSession`, `setCheckedIn`, `addMatch`, `updateSessionConfig`, `importSession`, `finishSession` |
| `useMatchStore` | `matches: {}` | `createMatch`, `updateTeams`, `updateNextTeams`, `finishMatch`, `cancelMatch`, `updateRoundsOutResetAt` |
| `useThemeStore` | `dark: bool` | `toggle`, `init` — **único store com `persist` (localStorage)** |

**Padrão de todas as actions de negócio:**
1. Atualiza o estado em memória imediatamente (optimistic update).
2. Chama o service correspondente de forma assíncrona.

---

## Camada de serviços (`src/services/`)

| Arquivo | Responsabilidade |
|---|---|
| `supabase.js` | Singleton do cliente Supabase |
| `auth.js` | `ensureAuth()` — auth anônimo ou restaura sessão |
| `bootstrap.js` | `hydrateStores()` — carrega dados do Supabase nos stores |
| `playerService.js` | CRUD tabela `players` |
| `sessionService.js` | CRUD tabela `sessions` |
| `matchService.js` | CRUD tabela `matches` |

Todos os services usam mappers `toDb` (camelCase → snake_case) e `fromDb` (snake_case → camelCase).

---

## Lógica de negócio (`src/logic/`)

### `queue.js` — distribuição e avanço da fila

- `levelSpreadDraft(allPlayers, teamSize)` — distribui jogadores em `ceil(n/teamSize)` grupos (mínimo 2) via round-robin por nível: níveis mais altos são espalhados primeiro, um por grupo; desempate pelo menor índice de grupo.
- `rebalanceHighLevelPlayers(teamA, teamB, nextTeams, roundsOut, threshold?)` — pós-draft: se ambos os times em campo têm alto nível mas a 1ª próxima não tem, tenta promover um candidato elegível da 2ª+ próxima para a 1ª, trocando com o jogador de menor nível dela. Só aceita a troca se não piorar a diferença de médias entre a 1ª próxima e o campo. Candidatos com `roundsOut >= 2` não são movidos.
- `distributeAllPlayers(allPlayers, teamSize)` — chama `levelSpreadDraft` seguido de `rebalanceHighLevelPlayers(roundsOut={})`. Retorna `{ teamA, teamB, nextTeams }`.
- `snakeDraft(players, teamSize)` — distribui jogadores alternadamente entre time A e B (padrão snake). Mantido para uso direto quando necessário.
- `buildNextQueue(players, teamSize)` — divide lista em chunks de `teamSize`.
- `advanceQueue(winners, losers, currentNext, teamSize, roundsOut, maxRoundsOut)` — ao encerrar partida:
  - Primeiro time da fila sobe como novo oponente.
  - Se o time está incompleto, completa com jogadores da fila restante priorizando `roundsOut >= maxRoundsOut`.
  - Perdedores vão para o **final** da fila.
  - Se a fila está completamente vazia, completa o time com os próprios perdedores.
- `updateRoundsOut(allCheckedInIds, playingNowIds, currentRoundsOut)` — zera quem jogou, incrementa quem ficou de fora.

### `checkin-logic.js` — check-in com partida ativa

- `applyCheckinWithActiveMatch(...)` — orquestra substituições quando o check-in muda durante uma partida:
  1. Remove jogadores de onde estiverem (time A, time B ou fila).
  2. Preenche buracos no time A e B promovendo da fila.
  3. Faz cascata na fila para cobrir buracos internos (`fillGapsFromNextQueues`).
  4. Novos jogadores vão para o fim da fila (`insertPlayerIntoQueue`).
- `insertPlayerIntoQueue(currentNextTeams, playerId, teamSize)` — adiciona jogador ao último time incompleto ou cria novo.
- `fillGapsFromNextQueues(...)` — faz cascata de promoção na fila respeitando `roundsOut` e ordem FIFO.
- `getRemovedFromMatch`, `getNewcomers` — utilitários de diff entre check-in anterior e atual.

### `balancing.js` — mistura e troca manual

- `shuffleTeams(teamA, teamB, swaps?, threshold?)` — realiza até 3 trocas aleatórias entre os dois times em campo. Trocas que concentrariam 2+ jogadores do mesmo nível num time enquanto o outro ficaria com 0 são rejeitadas (usa `HIGH_LEVEL_THRESHOLD = 4` por padrão). Nunca trava se todos os pares forem inválidos.
- `swapPlayers(...)` — troca manual no `EditTeamsModal`; mantém unicidade (quem entra sai da origem).

---

## Fluxo principal do usuário

```
Home → criar/entrar na sessão
  → Checkin: selecionar presentes + "Formar times"
      → distributeAllPlayers → createMatch → navega para Match
  → Match: times em campo + fila de próximos
      → Encerrar: advanceQueue → finishMatch → applyMatchResult → createMatch (nova rodada)
      → Cancelar: cancelMatch → volta para Checkin
      → Shuffle/Edit: atualiza times em campo sem criar nova partida
  → Checkin com partida ativa: applyCheckinWithActiveMatch → updateTeams + updateNextTeams
```

---

## Rotas

| Rota | Componente | Descrição |
|---|---|---|
| `/` | `Home` | Criar sessão, entrar por código, importar via URL |
| `/session/new` | `SessionSetup` | Nome + tamanho de time (4/5/6/7) |
| `/session/:code/checkin` | `Checkin` | Gerenciar presentes, adicionar jogador (com nível), editar jogador (nome+nível), iniciar partida |
| `/session/:code/match/:id` | `Match` | Partida em andamento: times, fila, encerrar, shuffle, editar |
| `/session/:code/export` | `ExportSession` | Resumo e link de compartilhamento |
| `/player/:playerId` | `PlayerProfile` | Estatísticas e histórico do jogador |
| `/dev/supabase` | `SupabaseCheck` | Diagnóstico de conexão com o Supabase |

---

## Regras de negócio críticas

1. **Nível (`level`) é o critério de balanceamento na formação de times** — `levelSpreadDraft` distribui jogadores de nível alto entre todos os grupos (campo + fila) via round-robin.
2. **Fila é estritamente FIFO** — o primeiro time da fila é sempre o próximo a entrar.
3. **Lacunas na fila são preenchidas por `roundsOut` decrescente**, depois por posição FIFO.
4. **Cancelar partida zera `roundsOut`** e o próximo "Formar times" executa novo `levelSpreadDraft` do zero.
5. **`shuffleTeams` nunca pode ser removido** — faz parte do contrato de UX. Respeita restrição de nível (não concentra 2+ alto nível num time com 0 no outro).
6. **Encerrar partida**: vencedores ficam em campo, perdedores vão para o final da fila.
7. **Substitutos no `EditTeamsModal` não podem gerar duplicatas** — quem entra no time sai da fila; quem sai do time vai para a fila.

---

## Cobertura de testes (227 testes — 2026-07-11)

| Arquivo | Testes |
|---|---|
| `tests/unit/logic/balancing.test.js` | 8 |
| `tests/unit/logic/checkin-logic.test.js` | 31 |
| `tests/unit/logic/display-name.test.js` | 4 |
| `tests/unit/logic/edit-teams.test.js` | 15 |
| `tests/unit/logic/queue.test.js` | 42 |
| `tests/unit/logic/teamsize.test.js` | 65 |
| `tests/unit/services/playerService.test.js` | 15 |
| `tests/unit/services/sessionService.test.js` | 18 |
| `tests/unit/services/matchService.test.js` | 13 |
| `tests/integration/checkin-integration.test.js` | 4 |
| `tests/integration/finish-session.test.js` | 12 |
---

## Próximos passos planejados

| Prioridade | Item |
|---|---|
| Alta | Fase 2 de segurança: coluna `owner_id` nas tabelas + RLS por dono (isolamento por device) |
| Alta | Aplicar `migrations/005_session_status.sql` no Supabase via SQL Editor |
| Média | Hook `useSessionData(code)` para hydration lazy por sessão (performance) |
| Baixa | Suporte a múltiplos usuários na mesma sessão (`session_members`) |
