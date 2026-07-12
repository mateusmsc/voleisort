import { supabase } from './supabase'

function toDb(player) {
  return {
    id:         player.id,
    name:       player.name,
    created_at: player.createdAt,
    stats:      player.stats,
    level:      player.level,
  }
}

function fromDb(row) {
  return {
    id:        row.id,
    name:      row.name,
    createdAt: row.created_at,
    stats:     row.stats,
    level:     row.level ?? 3,
  }
}

export const playerService = {
  async getAll() {
    const { data, error } = await supabase.from('players').select('*')
    if (error) throw error
    return data.map(fromDb)
  },

  async getManyByIds(ids) {
    if (!ids || ids.length === 0) return []
    const { data, error } = await supabase
      .from('players').select('*').in('id', ids)
    if (error) throw error
    return data.map(fromDb)
  },

  async getById(id) {
    const { data, error } = await supabase
      .from('players').select('*').eq('id', id).single()
    if (error) throw error
    return fromDb(data)
  },

  async create(player) {
    const { error } = await supabase.from('players').insert(toDb(player))
    if (error) throw error
  },

  async update(id, changes) {
    const patch = {}
    if (changes.name      !== undefined) patch.name       = changes.name
    if (changes.createdAt !== undefined) patch.created_at = changes.createdAt
    if (changes.stats     !== undefined) patch.stats      = changes.stats
    if (changes.level     !== undefined) patch.level      = changes.level
    const { error } = await supabase.from('players').update(patch).eq('id', id)
    if (error) throw error
  },

  async updateStats(id, stats) {
    const { error } = await supabase
      .from('players').update({ stats }).eq('id', id)
    if (error) throw error
  },

  async upsertMany(players) {
    const { error } = await supabase
      .from('players').upsert(players.map(toDb), { onConflict: 'id' })
    if (error) throw error
  },

  async remove(id) {
    const { error } = await supabase.from('players').delete().eq('id', id)
    if (error) throw error
  },
}
