import { create } from 'zustand'
import { v4 as uuid } from 'uuid'
import { playerService } from '../services/playerService'
import { DEFAULT_LEVEL } from '../utils/levels'

export const usePlayerStore = create((set, get) => ({
  players: {},

  async addPlayer(name, level = DEFAULT_LEVEL) {
    const player = {
      id: uuid(),
      name,
      createdAt: new Date().toISOString(),
      stats: { matches: 0, wins: 0, losses: 0 },
      level,
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

  getPlayer(id)   { return get().players[id] ?? null },
  getAllPlayers()  { return Object.values(get().players) },

  // Chamado pelo boot para hidratar com dados do Supabase
  _hydrate(players) {
    const map = {}
    for (const p of players) map[p.id] = p
    set({ players: map })
  },
}))
