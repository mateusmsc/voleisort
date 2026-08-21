# 02 — Dados e Storage

## Visão geral

O estado do app vive em três stores Zustand, cada uma responsável por um domínio. Toda mutação de estado é automaticamente sincronizada com o `localStorage` via middleware `persist` do Zustand — zero código extra necessário.

---

## Wrapper do localStorage (`src/utils/storage.js`)

Utilitário simples para facilitar migração futura para uma API REST:

```js
const PREFIX = 'volei:'

export const storage = {
  get(key) {
    try {
      const raw = localStorage.getItem(PREFIX + key)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  },

  set(key, value) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value))
    } catch (e) {
      console.error('storage.set falhou:', e)
    }
  },

  remove(key) {
    localStorage.removeItem(PREFIX + key)
  },

  clear() {
    Object.keys(localStorage)
      .filter(k => k.startsWith(PREFIX))
      .forEach(k => localStorage.removeItem(k))
  },
}
```

---

## Store de jogadores (`src/store/usePlayerStore.js`)

Gerencia o cadastro global de jogadores (persiste entre sessões).

```js
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuid } from 'uuid'

const DEFAULT_RATING = 50

export const usePlayerStore = create(
  persist(
    (set, get) => ({
      players: {},  // { [id]: Player }

      addPlayer(name) {
        const id = uuid()
        const player = {
          id,
          name,
          rating: DEFAULT_RATING,
          createdAt: new Date().toISOString(),
          stats: { matches: 0, wins: 0, losses: 0 },
        }
        set(state => ({
          players: { ...state.players, [id]: player },
        }))
        return id
      },

      updatePlayer(id, changes) {
        set(state => ({
          players: {
            ...state.players,
            [id]: { ...state.players[id], ...changes },
          },
        }))
      },

      // Chamado após encerrar uma partida
      applyMatchResult(winnersIds, losersIds, ratingDeltas) {
        // ratingDeltas: { [playerId]: number } — calculado em logic/rating.js
        set(state => {
          const updated = { ...state.players }
          for (const [id, delta] of Object.entries(ratingDeltas)) {
            const p = updated[id]
            const isWinner = winnersIds.includes(id)
            updated[id] = {
              ...p,
              rating: Math.max(0, Math.min(100, p.rating + delta)),
              stats: {
                matches: p.stats.matches + 1,
                wins: p.stats.wins + (isWinner ? 1 : 0),
                losses: p.stats.losses + (isWinner ? 0 : 1),
              },
            }
          }
          return { players: updated }
        })
      },

      getPlayer(id) {
        return get().players[id] ?? null
      },

      getAllPlayers() {
        return Object.values(get().players)
      },
    }),
    {
      name: 'volei-players',  // chave no localStorage
    }
  )
)
```

---

## Store de sessões (`src/store/useSessionStore.js`)

Gerencia a sessão ativa (a "pelada do dia").

```js
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuid } from 'uuid'
import { generateCode } from '../utils/session-code'

export const useSessionStore = create(
  persist(
    (set, get) => ({
      sessions: {},       // { [id]: Session }
      activeSessionId: null,

      createSession(name, config = {}) {
        const id = uuid()
        const session = {
          id,
          code: generateCode(),   // ex: "ABC123"
          name,
          createdAt: new Date().toISOString(),
          config: {
            teamSize: 6,
            maxRoundsOut: 2,       // prioridade na fila após N partidas fora
            ratingDeltaThreshold: 10,  // tolerância p/ ferir equilíbrio por fila
            ...config,
          },
          playerIds: [],
          checkedInIds: [],
          matchIds: [],
        }
        set(state => ({
          sessions: { ...state.sessions, [id]: session },
          activeSessionId: id,
        }))
        return session
      },

      setActiveSession(id) {
        set({ activeSessionId: id })
      },

      getActiveSession() {
        const { sessions, activeSessionId } = get()
        return activeSessionId ? sessions[activeSessionId] : null
      },

      addPlayerToSession(sessionId, playerId) {
        set(state => {
          const s = state.sessions[sessionId]
          if (!s || s.playerIds.includes(playerId)) return state
          return {
            sessions: {
              ...state.sessions,
              [sessionId]: {
                ...s,
                playerIds: [...s.playerIds, playerId],
              },
            },
          }
        })
      },

      setCheckedIn(sessionId, playerIds) {
        set(state => ({
          sessions: {
            ...state.sessions,
            [sessionId]: {
              ...state.sessions[sessionId],
              checkedInIds: playerIds,
            },
          },
        }))
      },

      addMatch(sessionId, matchId) {
        set(state => {
          const s = state.sessions[sessionId]
          return {
            sessions: {
              ...state.sessions,
              [sessionId]: {
                ...s,
                matchIds: [...s.matchIds, matchId],
              },
            },
          }
        })
      },

      getSessionByCode(code) {
        return Object.values(get().sessions).find(s => s.code === code) ?? null
      },

      // Importa uma sessão exportada de outro dispositivo
      importSession(sessionData) {
        const id = sessionData.id
        set(state => ({
          sessions: { ...state.sessions, [id]: sessionData },
          activeSessionId: id,
        }))
      },
    }),
    { name: 'volei-sessions' }
  )
)
```

---

## Store de partidas (`src/store/useMatchStore.js`)

```js
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuid } from 'uuid'

export const useMatchStore = create(
  persist(
    (set, get) => ({
      matches: {},  // { [id]: Match }

      createMatch(sessionId, round, teams, waitingIds) {
        // teams: { A: [playerId, ...], B: [playerId, ...] }
        const id = uuid()
        const match = {
          id,
          sessionId,
          round,
          status: 'ongoing',    // 'ongoing' | 'finished' | 'cancelled'
          teams,
          waitingIds,
          winner: null,         // 'A' | 'B' | null
          startedAt: new Date().toISOString(),
          finishedAt: null,
        }
        set(state => ({ matches: { ...state.matches, [id]: match } }))
        return match
      },

      // Edição manual dos times antes ou durante a partida
      updateTeams(matchId, teams) {
        set(state => ({
          matches: {
            ...state.matches,
            [matchId]: { ...state.matches[matchId], teams },
          },
        }))
      },

      // Chamado ao selecionar o vencedor na tela de encerramento
      finishMatch(matchId, winner) {
        set(state => ({
          matches: {
            ...state.matches,
            [matchId]: {
              ...state.matches[matchId],
              status: 'finished',
              winner,
              finishedAt: new Date().toISOString(),
            },
          },
        }))
      },

      cancelMatch(matchId) {
        set(state => ({
          matches: {
            ...state.matches,
            [matchId]: {
              ...state.matches[matchId],
              status: 'cancelled',
              finishedAt: new Date().toISOString(),
            },
          },
        }))
      },

      getMatch(id) {
        return get().matches[id] ?? null
      },

      getMatchesBySession(sessionId) {
        return Object.values(get().matches)
          .filter(m => m.sessionId === sessionId)
          .sort((a, b) => a.round - b.round)
      },
    }),
    { name: 'volei-matches' }
  )
)
```

---

## Resumo das chaves no localStorage

| Chave | Conteúdo |
|---|---|
| `volei-players` | Todos os jogadores cadastrados |
| `volei-sessions` | Todas as sessões + sessão ativa |
| `volei-matches` | Todas as partidas |

> O prefixo `volei-` é adicionado automaticamente pelo Zustand `persist`. Não interferir com outras aplicações rodando na mesma origem.
