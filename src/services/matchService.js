import { supabase } from './supabase'

function toDb(match) {
  const row = {
    id:          match.id,
    session_id:  match.sessionId,
    round:       match.round,
    status:      match.status,
    teams:       match.teams,
    next_teams:  match.nextTeams,
    winner:      match.winner ?? null,
    started_at:  match.startedAt,
    finished_at: match.finishedAt ?? null,
  }
  if (match.roundsOutResetAt !== undefined) {
    row.rounds_out_reset_at = match.roundsOutResetAt
  }
  if (match.streakResetAt !== undefined) {
    row.streak_reset_at = match.streakResetAt
  }
  if (match.originalIds !== undefined) {
    row.original_participant_ids = match.originalIds
  }
  return row
}

function fromDb(row) {
  const match = {
    id:         row.id,
    sessionId:  row.session_id,
    round:      row.round,
    status:     row.status,
    teams:      row.teams,
    nextTeams:  row.next_teams  ?? [],
    winner:     row.winner      ?? null,
    startedAt:  row.started_at,
    finishedAt: row.finished_at ?? null,
  }
  if (row.rounds_out_reset_at !== null && row.rounds_out_reset_at !== undefined) {
    match.roundsOutResetAt = row.rounds_out_reset_at
  }
  if (row.streak_reset_at !== null && row.streak_reset_at !== undefined) {
    match.streakResetAt = row.streak_reset_at
  }
  match.originalIds = row.original_participant_ids ?? null
  return match
}

export const matchService = {
  async getById(id) {
    const { data, error } = await supabase
      .from('matches').select('*').eq('id', id).single()
    if (error) throw error
    return fromDb(data)
  },

  async getBySession(sessionId) {
    const { data, error } = await supabase
      .from('matches').select('*')
      .eq('session_id', sessionId)
      .order('round', { ascending: true })
    if (error) throw error
    return data.map(fromDb)
  },

  async create(match) {
    const { error } = await supabase.from('matches').insert(toDb(match))
    if (error) throw error
  },

  async updateTeams(matchId, teams) {
    const { error } = await supabase
      .from('matches').update({ teams }).eq('id', matchId)
    if (error) throw error
  },

  async updateNextTeams(matchId, nextTeams) {
    const { error } = await supabase
      .from('matches').update({ next_teams: nextTeams }).eq('id', matchId)
    if (error) throw error
  },

  async finish(matchId, winner) {
    const { error } = await supabase.from('matches').update({
      status:      'finished',
      winner,
      finished_at: new Date().toISOString(),
    }).eq('id', matchId)
    if (error) throw error
  },

  async cancel(matchId) {
    const { error } = await supabase.from('matches').update({
      status:      'cancelled',
      finished_at: new Date().toISOString(),
    }).eq('id', matchId)
    if (error) throw error
  },

  async updateRoundsOutResetAt(matchId, round) {
    const { error } = await supabase
      .from('matches').update({ rounds_out_reset_at: round }).eq('id', matchId)
    if (error) throw error
  },
}
