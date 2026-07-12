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
      status: 'active',
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

  async finishSession(sessionId) {
    set(state => {
      const s = state.sessions[sessionId]
      if (!s) return state
      return {
        sessions: {
          ...state.sessions,
          [sessionId]: { ...s, status: 'finished' },
        },
      }
    })
    await sessionService.finishSession(sessionId)
  },

  // Chamado pelo boot para hidratar com dados do Supabase
  _hydrate(sessions) {
    const map = {}
    for (const s of sessions) map[s.id] = s
    set({ sessions: map })
  },
}))
