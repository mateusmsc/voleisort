import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuid } from 'uuid'

export const useMatchStore = create(
  persist(
    (set, get) => ({
      matches: {},

      createMatch(sessionId, round, teams, nextTeams = [], roundsOutResetAt = undefined) {
        const id = uuid()
        const match = {
          id,
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
        set(state => ({ matches: { ...state.matches, [id]: match } }))
        return match
      },

      updateTeams(matchId, teams) {
        set(state => ({
          matches: {
            ...state.matches,
            [matchId]: { ...state.matches[matchId], teams },
          },
        }))
      },

      updateNextTeams(matchId, nextTeams) {
        set(state => ({
          matches: {
            ...state.matches,
            [matchId]: { ...state.matches[matchId], nextTeams },
          },
        }))
      },

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
