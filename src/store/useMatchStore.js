import { create } from 'zustand'
import { v4 as uuid } from 'uuid'
import { matchService } from '../services/matchService'

export const useMatchStore = create((set, get) => ({
  matches: {},

  async createMatch(sessionId, round, teams, nextTeams = [], roundsOutResetAt = undefined, streakResetAt = undefined) {
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
      originalIds: [...teams.A, ...teams.B, ...nextTeams.flat()],
      ...(roundsOutResetAt !== undefined ? { roundsOutResetAt } : {}),
      ...(streakResetAt !== undefined ? { streakResetAt } : {}),
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
