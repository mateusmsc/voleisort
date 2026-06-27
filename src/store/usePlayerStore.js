import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuid } from 'uuid'

const DEFAULT_RATING = 50

export const usePlayerStore = create(
  persist(
    (set, get) => ({
      players: {},

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

      applyMatchResult(winnersIds, losersIds, ratingDeltas) {
        set(state => {
          const updated = { ...state.players }
          for (const [id, delta] of Object.entries(ratingDeltas)) {
            const p = updated[id]
            if (!p) continue
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

      importPlayers(playersList) {
        set(state => {
          const updated = { ...state.players }
          for (const p of playersList) {
            updated[p.id] = p
          }
          return { players: updated }
        })
      },

      removePlayer(id) {
        set(state => {
          const updated = { ...state.players }
          delete updated[id]
          return { players: updated }
        })
      },

      playerNameExists(name) {
        const normalized = name.trim().toLowerCase()
        return Object.values(get().players).some(
          p => p.name.trim().toLowerCase() === normalized
        )
      },

      getPlayer(id) {
        return get().players[id] ?? null
      },

      getAllPlayers() {
        return Object.values(get().players)
      },
    }),
    {
      name: 'volei-players',
    }
  )
)
