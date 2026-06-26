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
