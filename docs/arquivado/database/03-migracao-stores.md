# 03 — Migração dos Stores

## Estratégia

Os stores deixam de usar o middleware `persist` do Zustand e passam a ser stores
**síncronos em memória** que:

1. Chamam o service correspondente (async) para persistir no Supabase
2. Atualizam o estado local em memória após confirmar (**optimistic update**)

A interface pública de cada store **não muda** — nenhum componente ou lógica de
negócio precisa ser alterado. A mudança é 100% interna aos stores.

### Padrão aplicado em cada action

```js
// ANTES — só localStorage via persist
addPlayer(name) {
  const player = { id: uuid(), name, ... }
  set(state => ({ players: { ...state.players, [player.id]: player } }))
  return player.id
}

// DEPOIS — persiste no Supabase + atualiza memória
async addPlayer(name) {
  const player = { id: uuid(), name, ... }
  set(state => ({ players: { ...state.players, [player.id]: player } }))  // optimistic
  await playerService.create(player)   // persiste no banco
  return player.id
}
```

O optimistic update garante que a UI responde imediatamente. Se o banco falhar,
o ideal é reverter o estado — mas para a Fase 1 (rede estável, sem conflito),
o `console.error` já é suficiente.

---

## `usePlayerStore.js` — após migração

Mudanças:
- Remove `persist` e a chave `'volei-players'`
- Cada action passa a `await` o service correspondente
- Estado inicial `players: {}` — preenchido pelo boot (plano 04)

```js
import { create } from 'zustand'
import { v4 as uuid } from 'uuid'
import { playerService } from '../services/playerService'

export const usePlayerStore = create((set, get) => ({
  players: {},

  async addPlayer(name) {
    const player = {
      id: uuid(),
      name,
      createdAt: new Date().toISOString(),
      stats: { matches: 0, wins: 0, losses: 0 },
    }
    set(state => ({ players: { ...state.players, [player.id]: player } }))
    await playerService.create(player)
    return player.id
  },

  async updatePlayer(id, changes) {
    set(state => ({
      players: { ...state.players, [id]: { ...state.players[id], ...changes } },
    }))
    await playerService.update(id, changes)
  },

  async applyMatchResult(winnersIds, losersIds) {
    set(state => {
      const updated = { ...state.players }
      for (const id of [...winnersIds, ...losersIds]) {
        const p = updated[id]
        if (!p) continue
        const isWinner = winnersIds.includes(id)
        updated[id] = {
          ...p,
          stats: {
            matches: p.stats.matches + 1,
            wins:    p.stats.wins    + (isWinner ? 1 : 0),
            losses:  p.stats.losses  + (isWinner ? 0 : 1),
          },
        }
      }
      return { players: updated }
    })
    // Persiste cada jogador atualizado
    const all = get().players
    await Promise.all(
      [...winnersIds, ...losersIds].map(id =>
        all[id] ? playerService.updateStats(id, all[id].stats) : Promise.resolve()
      )
    )
  },

  async importPlayers(playersList) {
    set(state => {
      const updated = { ...state.players }
      for (const p of playersList) updated[p.id] = p
      return { players: updated }
    })
    await playerService.upsertMany(playersList)
  },

  async removePlayer(id) {
    set(state => {
      const updated = { ...state.players }
      delete updated[id]
      return { players: updated }
    })
    await playerService.remove(id)
  },

  playerNameExists(name) {
    const normalized = name.trim().toLowerCase()
    return Object.values(get().players).some(
      p => p.name.trim().toLowerCase() === normalized
    )
  },

  getPlayer(id)    { return get().players[id] ?? null },
  getAllPlayers()  { return Object.values(get().players) },

  // Chamado pelo boot para hidratar com dados do Supabase
  _hydrate(players) {
    const map = {}
    for (const p of players) map[p.id] = p
    set({ players: map })
  },
}))
```

---

## `useSessionStore.js` — após migração

Mudanças:
- Remove `persist` e a chave `'volei-sessions'`
- `activeSessionId` passa a ser estado apenas em memória (não precisa persistir —
  é determinado pela URL `:code` na navegação)
- Cada action chama o service correspondente

```js
import { create } from 'zustand'
import { v4 as uuid } from 'uuid'
import { generateCode } from '../utils/session-code'
import { sessionService } from '../services/sessionService'

export const useSessionStore = create((set, get) => ({
  sessions: {},
  activeSessionId: null,

  async createSession(name, config = {}) {
    const session = {
      id: uuid(),
      code: generateCode(),
      name,
      createdAt: new Date().toISOString(),
      config: { teamSize: 6, maxRoundsOut: 2, ratingDeltaThreshold: 10, ...config },
      playerIds: [],
      checkedInIds: [],
      matchIds: [],
    }
    set(state => ({
      sessions: { ...state.sessions, [session.id]: session },
      activeSessionId: session.id,
    }))
    await sessionService.create(session)
    return session
  },

  setActiveSession(id) { set({ activeSessionId: id }) },

  getActiveSession() {
    const { sessions, activeSessionId } = get()
    return activeSessionId ? sessions[activeSessionId] : null
  },

  async addPlayerToSession(sessionId, playerId) {
    set(state => {
      const s = state.sessions[sessionId]
      if (!s || s.playerIds.includes(playerId)) return state
      return {
        sessions: {
          ...state.sessions,
          [sessionId]: { ...s, playerIds: [...s.playerIds, playerId] },
        },
      }
    })
    await sessionService.appendPlayerId(sessionId, playerId)
  },

  async setCheckedIn(sessionId, playerIds) {
    set(state => ({
      sessions: {
        ...state.sessions,
        [sessionId]: { ...state.sessions[sessionId], checkedInIds: playerIds },
      },
    }))
    await sessionService.setCheckedIn(sessionId, playerIds)
  },

  async addMatch(sessionId, matchId) {
    set(state => {
      const s = state.sessions[sessionId]
      if (!s) return state
      return {
        sessions: {
          ...state.sessions,
          [sessionId]: { ...s, matchIds: [...s.matchIds, matchId] },
        },
      }
    })
    await sessionService.appendMatchId(sessionId, matchId)
  },

  getSessionByCode(code) {
    return Object.values(get().sessions).find(s => s.code === code) ?? null
  },

  async updateSessionConfig(sessionId, configChanges) {
    set(state => {
      const s = state.sessions[sessionId]
      if (!s) return state
      return {
        sessions: {
          ...state.sessions,
          [sessionId]: { ...s, config: { ...s.config, ...configChanges } },
        },
      }
    })
    const s = get().sessions[sessionId]
    if (s) await sessionService.updateConfig(sessionId, s.config)
  },

  async importSession(sessionData) {
    set(state => ({
      sessions: { ...state.sessions, [sessionData.id]: sessionData },
      activeSessionId: sessionData.id,
    }))
    await sessionService.upsert(sessionData)
  },

  // Chamado pelo boot para hidratar com dados do Supabase
  _hydrate(sessions) {
    const map = {}
    for (const s of sessions) map[s.id] = s
    set({ sessions: map })
  },
}))
```

---

## `useMatchStore.js` — após migração

Mudanças:
- Remove `persist` e a chave `'volei-matches'`
- Os dois `useMatchStore.setState()` diretos em `Checkin.jsx` e `Match.jsx`
  precisam ser substituídos por chamadas aos novos métodos `updateNextTeams` e
  `updateRoundsOutResetAt` (que já existem como actions — só adicionar a chamada
  ao service)

```js
import { create } from 'zustand'
import { v4 as uuid } from 'uuid'
import { matchService } from '../services/matchService'

export const useMatchStore = create((set, get) => ({
  matches: {},

  async createMatch(sessionId, round, teams, nextTeams = [], roundsOutResetAt = undefined) {
    const match = {
      id: uuid(),
      sessionId,
      round,
      status: 'ongoing',
      teams,
      nextTeams,
      winner: null,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      ...(roundsOutResetAt !== undefined ? { roundsOutResetAt } : {}),
    }
    set(state => ({ matches: { ...state.matches, [match.id]: match } }))
    await matchService.create(match)
    return match
  },

  async updateTeams(matchId, teams) {
    set(state => ({
      matches: { ...state.matches, [matchId]: { ...state.matches[matchId], teams } },
    }))
    await matchService.updateTeams(matchId, teams)
  },

  async updateNextTeams(matchId, nextTeams) {
    set(state => ({
      matches: { ...state.matches, [matchId]: { ...state.matches[matchId], nextTeams } },
    }))
    await matchService.updateNextTeams(matchId, nextTeams)
  },

  async finishMatch(matchId, winner) {
    const finishedAt = new Date().toISOString()
    set(state => ({
      matches: {
        ...state.matches,
        [matchId]: { ...state.matches[matchId], status: 'finished', winner, finishedAt },
      },
    }))
    await matchService.finish(matchId, winner)
  },

  async cancelMatch(matchId) {
    const finishedAt = new Date().toISOString()
    set(state => ({
      matches: {
        ...state.matches,
        [matchId]: { ...state.matches[matchId], status: 'cancelled', finishedAt },
      },
    }))
    await matchService.cancel(matchId)
  },

  async updateRoundsOutResetAt(matchId, round) {
    set(state => ({
      matches: {
        ...state.matches,
        [matchId]: { ...state.matches[matchId], roundsOutResetAt: round },
      },
    }))
    await matchService.updateRoundsOutResetAt(matchId, round)
  },

  getMatch(id)              { return get().matches[id] ?? null },

  getMatchesBySession(sessionId) {
    return Object.values(get().matches)
      .filter(m => m.sessionId === sessionId)
      .sort((a, b) => a.round - b.round)
  },

  // Chamado pelo boot para hidratar com dados do Supabase
  _hydrate(matches) {
    const map = {}
    for (const m of matches) map[m.id] = m
    set({ matches: map })
  },
}))
```

---

## Substituir os `useMatchStore.setState()` diretos

Dois locais no codebase fazem setState direto no store de matches, bypassando
as actions. Precisam ser trocados pelas actions com chamada ao service.

### `src/pages/Checkin/Checkin.jsx` — linha ~90

```js
// ANTES
useMatchStore.setState(state => ({
  matches: {
    ...state.matches,
    [activeMatch.id]: {
      ...state.matches[activeMatch.id],
      nextTeams: updatedNextTeams,
    },
  },
}))

// DEPOIS
const { updateNextTeams } = useMatchStore.getState()
await updateNextTeams(activeMatch.id, updatedNextTeams)
```

### `src/pages/Match/Match.jsx` — linha ~193 (`handleResetRoundsOut`)

```js
// ANTES
useMatchStore.setState(state => ({
  matches: {
    ...state.matches,
    [matchId]: { ...state.matches[matchId], roundsOutResetAt: (match.round ?? 1) + 1 },
  },
}))

// DEPOIS
const { updateRoundsOutResetAt } = useMatchStore.getState()
await updateRoundsOutResetAt(matchId, (match.round ?? 1) + 1)
```

---

## Arquivos alterados nesta fase

| Arquivo | Ação |
|---|---|
| `src/store/usePlayerStore.js` | Reescrever — remove persist, adiciona services |
| `src/store/useSessionStore.js` | Reescrever — remove persist, adiciona services |
| `src/store/useMatchStore.js` | Reescrever — remove persist, adiciona services |
| `src/pages/Checkin/Checkin.jsx` | Substituir setState direto (~linha 90) |
| `src/pages/Match/Match.jsx` | Substituir setState direto (~linha 193) |
| `src/store/useThemeStore.js` | **Sem alteração** — mantém persist no localStorage |
