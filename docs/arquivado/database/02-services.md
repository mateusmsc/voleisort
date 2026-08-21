# 02 — Services (Camada de Acesso ao Banco)

## Responsabilidade

Os services são a **única camada que conhece o Supabase**. Nenhum store, componente
ou lógica de negócio importa `supabase` diretamente — tudo passa pelos services.

Cada service espelha exatamente as operações que o store correspondente precisa,
traduzindo entre o modelo do frontend (camelCase, arrays) e o schema do banco
(snake_case, jsonb).

---

## Mapeamento de nomes (frontend → banco)

| Frontend | Banco |
|---|---|
| `createdAt` | `created_at` |
| `sessionId` | `session_id` |
| `playerIds` | `player_ids` |
| `checkedInIds` | `checked_in_ids` |
| `matchIds` | `match_ids` |
| `nextTeams` | `next_teams` |
| `startedAt` | `started_at` |
| `finishedAt` | `finished_at` |
| `roundsOutResetAt` | `rounds_out_reset_at` |

As funções `toDb` e `fromDb` em cada service fazem essa conversão de forma
centralizada — se o schema mudar, muda só no service.

---

## `src/services/playerService.js`

Operações mapeadas do `usePlayerStore`:

| Store action | Service method |
|---|---|
| `addPlayer(name)` | `create(player)` |
| `updatePlayer(id, changes)` | `update(id, changes)` |
| `applyMatchResult(winners, losers)` | `updateStats(ids, delta)` — chamado em loop |
| `importPlayers(list)` | `upsertMany(list)` |
| `removePlayer(id)` | `remove(id)` |
| `getAllPlayers()` | `getAll()` |
| `getPlayer(id)` | `getById(id)` |

```js
import { supabase } from './supabase'

function toDb(player) {
  return {
    id:         player.id,
    name:       player.name,
    created_at: player.createdAt,
    stats:      player.stats,
  }
}

function fromDb(row) {
  return {
    id:        row.id,
    name:      row.name,
    createdAt: row.created_at,
    stats:     row.stats,
  }
}

export const playerService = {
  async getAll() {
    const { data, error } = await supabase.from('players').select('*')
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
    // Converte só os campos que chegam (subset de toDb)
    const patch = {}
    if (changes.name      !== undefined) patch.name       = changes.name
    if (changes.createdAt !== undefined) patch.created_at = changes.createdAt
    if (changes.stats     !== undefined) patch.stats      = changes.stats
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
```

---

## `src/services/sessionService.js`

Operações mapeadas do `useSessionStore`:

| Store action | Service method |
|---|---|
| `createSession(name, config)` | `create(session)` |
| `getSessionByCode(code)` | `getByCode(code)` |
| `addPlayerToSession(sessionId, playerId)` | `appendPlayerId(sessionId, playerId)` |
| `setCheckedIn(sessionId, ids)` | `setCheckedIn(sessionId, ids)` |
| `addMatch(sessionId, matchId)` | `appendMatchId(sessionId, matchId)` |
| `updateSessionConfig(sessionId, changes)` | `updateConfig(sessionId, config)` |
| `importSession(sessionData)` | `upsert(session)` |

```js
import { supabase } from './supabase'

function toDb(session) {
  return {
    id:              session.id,
    code:            session.code,
    name:            session.name,
    created_at:      session.createdAt,
    config:          session.config,
    player_ids:      session.playerIds,
    checked_in_ids:  session.checkedInIds,
    match_ids:       session.matchIds,
  }
}

function fromDb(row) {
  return {
    id:            row.id,
    code:          row.code,
    name:          row.name,
    createdAt:     row.created_at,
    config:        row.config,
    playerIds:     row.player_ids      ?? [],
    checkedInIds:  row.checked_in_ids  ?? [],
    matchIds:      row.match_ids       ?? [],
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
    const { error } = await supabase.from('sessions').update(dbPatch).eq('id', sessionId)
    if (error) throw error
  },

  async appendPlayerId(sessionId, playerId) {
    // Busca array atual e faz append — evita race condition com array_append no SQL
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

  async upsert(session) {
    const { error } = await supabase
      .from('sessions').upsert(toDb(session), { onConflict: 'id' })
    if (error) throw error
  },
}
```

---

## `src/services/matchService.js`

Operações mapeadas do `useMatchStore`:

| Store action | Service method |
|---|---|
| `createMatch(...)` | `create(match)` |
| `updateTeams(matchId, teams)` | `updateTeams(matchId, teams)` |
| `updateNextTeams(matchId, nextTeams)` | `updateNextTeams(matchId, nextTeams)` |
| `finishMatch(matchId, winner)` | `finish(matchId, winner)` |
| `cancelMatch(matchId)` | `cancel(matchId)` |
| `getMatchesBySession(sessionId)` | `getBySession(sessionId)` |
| `getMatch(id)` | `getById(id)` |
| Raw `setState` (roundsOutResetAt) | `updateRoundsOutResetAt(matchId, round)` |

```js
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
  return row
}

function fromDb(row) {
  const match = {
    id:          row.id,
    sessionId:   row.session_id,
    round:       row.round,
    status:      row.status,
    teams:       row.teams,
    nextTeams:   row.next_teams   ?? [],
    winner:      row.winner       ?? null,
    startedAt:   row.started_at,
    finishedAt:  row.finished_at  ?? null,
  }
  if (row.rounds_out_reset_at !== null && row.rounds_out_reset_at !== undefined) {
    match.roundsOutResetAt = row.rounds_out_reset_at
  }
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
```

---

## Arquivos criados nesta fase

| Arquivo | Ação |
|---|---|
| `src/services/auth.js` | Criar (definido no plano 01) |
| `src/services/playerService.js` | Criar |
| `src/services/sessionService.js` | Criar |
| `src/services/matchService.js` | Criar |

Nenhum store ou componente é alterado nesta fase.
Os services podem ser testados isoladamente via console do browser ou script Node
antes de integrar aos stores.
