import { supabase } from './supabase'

function toDb(session) {
  return {
    id:             session.id,
    code:           session.code,
    name:           session.name,
    created_at:     session.createdAt,
    config:         session.config,
    player_ids:     session.playerIds,
    checked_in_ids: session.checkedInIds,
    match_ids:      session.matchIds,
    status:         session.status ?? 'active',
  }
}

function fromDb(row) {
  return {
    id:           row.id,
    code:         row.code,
    name:         row.name,
    createdAt:    row.created_at,
    config:       row.config,
    playerIds:    row.player_ids     ?? [],
    checkedInIds: row.checked_in_ids ?? [],
    matchIds:     row.match_ids      ?? [],
    status:       row.status         ?? 'active',
  }
}

export const sessionService = {
  async getAll() {
    const { data, error } = await supabase.from('sessions').select('*')
    if (error) throw error
    return data.map(fromDb)
  },

  async getByCode(code) {
    const { data, error } = await supabase
      .from('sessions').select('*').eq('code', code).single()
    if (error) {
      if (error.code === 'PGRST116') return null  // not found
      throw error
    }
    return fromDb(data)
  },

  async create(session) {
    const { error } = await supabase.from('sessions').insert(toDb(session))
    if (error) throw error
  },

  async update(sessionId, patch) {
    const dbPatch = {}
    if (patch.config        !== undefined) dbPatch.config          = patch.config
    if (patch.playerIds     !== undefined) dbPatch.player_ids      = patch.playerIds
    if (patch.checkedInIds  !== undefined) dbPatch.checked_in_ids  = patch.checkedInIds
    if (patch.matchIds      !== undefined) dbPatch.match_ids       = patch.matchIds
    if (patch.status        !== undefined) dbPatch.status          = patch.status
    const { error } = await supabase.from('sessions').update(dbPatch).eq('id', sessionId)
    if (error) throw error
  },

  async appendPlayerId(sessionId, playerId) {
    const { data, error } = await supabase
      .from('sessions').select('player_ids').eq('id', sessionId).single()
    if (error) throw error
    const current = data.player_ids ?? []
    if (current.includes(playerId)) return
    await this.update(sessionId, { playerIds: [...current, playerId] })
  },

  async appendMatchId(sessionId, matchId) {
    const { data, error } = await supabase
      .from('sessions').select('match_ids').eq('id', sessionId).single()
    if (error) throw error
    const current = data.match_ids ?? []
    await this.update(sessionId, { matchIds: [...current, matchId] })
  },

  async setCheckedIn(sessionId, ids) {
    await this.update(sessionId, { checkedInIds: ids })
  },

  async updateConfig(sessionId, config) {
    await this.update(sessionId, { config })
  },

  async finishSession(sessionId) {
    await this.update(sessionId, { status: 'finished' })
  },

  async upsert(session) {
    const { error } = await supabase
      .from('sessions').upsert(toDb(session), { onConflict: 'id' })
    if (error) throw error
  },
}
