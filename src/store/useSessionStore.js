import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuid } from 'uuid'
import { generateCode } from '../utils/session-code'

export const useSessionStore = create(
  persist(
    (set, get) => ({
      sessions: {},
      activeSessionId: null,

      createSession(name, config = {}) {
        const id = uuid()
        const session = {
          id,
          code: generateCode(),
          name,
          createdAt: new Date().toISOString(),
          config: {
            teamSize: 6,
            maxRoundsOut: 2,
            ratingDeltaThreshold: 10,
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
          if (!s) return state
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

      updateSessionConfig(sessionId, configChanges) {
        set(state => {
          const s = state.sessions[sessionId]
          if (!s) return state
          return {
            sessions: {
              ...state.sessions,
              [sessionId]: {
                ...s,
                config: { ...s.config, ...configChanges },
              },
            },
          }
        })
      },

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
