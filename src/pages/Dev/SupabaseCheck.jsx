import { useEffect, useState } from 'react'
import { supabase } from '../../services/supabase'
import { playerService }  from '../../services/playerService'
import { sessionService } from '../../services/sessionService'
import { matchService }   from '../../services/matchService'
import { v4 as uuid } from 'uuid'

const TESTS = [
  'auth',
  'playerService.create',
  'playerService.getAll',
  'playerService.update',
  'playerService.remove',
  'sessionService.create',
  'sessionService.getAll',
  'sessionService.getByCode',
  'sessionService.appendPlayerId',
  'sessionService.update (config)',
  'matchService.create',
  'matchService.getBySession',
  'matchService.updateTeams',
  'matchService.finish',
  'cleanup',
]

export default function SupabaseCheck() {
  const [results, setResults] = useState(
    Object.fromEntries(TESTS.map(t => [t, { status: 'pending' }]))
  )

  function set(name, status, detail) {
    setResults(prev => ({ ...prev, [name]: { status, detail } }))
  }

  useEffect(() => {
    async function runAll() {
      // ── Auth ────────────────────────────────────────────────────────────────
      const { data: { user }, error: authErr } = await supabase.auth.getUser()
      if (authErr || !user) {
        set('auth', 'error', authErr?.message ?? 'Sem usuário na sessão')
        return
      }
      set('auth', 'ok', `uid: ${user.id.slice(0, 8)}…`)

      // IDs temporários para o teste
      const playerId  = uuid()
      const sessionId = uuid()
      const matchId   = uuid()
      const code      = 'TST' + Math.floor(Math.random() * 900 + 100)

      // ── playerService ───────────────────────────────────────────────────────
      try {
        await playerService.create({
          id: playerId, name: '__test__',
          createdAt: new Date().toISOString(),
          stats: { matches: 0, wins: 0, losses: 0 },
        })
        set('playerService.create', 'ok')
      } catch (e) { set('playerService.create', 'error', e.message); return }

      try {
        const all = await playerService.getAll()
        const found = all.find(p => p.id === playerId)
        set('playerService.getAll', 'ok', `${all.length} jogadores, teste encontrado: ${!!found}`)
      } catch (e) { set('playerService.getAll', 'error', e.message) }

      try {
        await playerService.update(playerId, { name: '__test_updated__' })
        set('playerService.update', 'ok')
      } catch (e) { set('playerService.update', 'error', e.message) }

      // ── sessionService ──────────────────────────────────────────────────────
      try {
        await sessionService.create({
          id: sessionId, code, name: '__test_session__',
          createdAt: new Date().toISOString(),
          config: { teamSize: 6, maxRoundsOut: 2, ratingDeltaThreshold: 10 },
          playerIds: [], checkedInIds: [], matchIds: [],
        })
        set('sessionService.create', 'ok')
      } catch (e) { set('sessionService.create', 'error', e.message); return }

      try {
        const all = await sessionService.getAll()
        set('sessionService.getAll', 'ok', `${all.length} sessões`)
      } catch (e) { set('sessionService.getAll', 'error', e.message) }

      try {
        const found = await sessionService.getByCode(code)
        set('sessionService.getByCode', 'ok', `encontrado: ${found?.name}`)
      } catch (e) { set('sessionService.getByCode', 'error', e.message) }

      try {
        await sessionService.appendPlayerId(sessionId, playerId)
        set('sessionService.appendPlayerId', 'ok')
      } catch (e) { set('sessionService.appendPlayerId', 'error', e.message) }

      try {
        await sessionService.updateConfig(sessionId, { teamSize: 4, maxRoundsOut: 2, ratingDeltaThreshold: 10 })
        set('sessionService.update (config)', 'ok')
      } catch (e) { set('sessionService.update (config)', 'error', e.message) }

      // ── matchService ────────────────────────────────────────────────────────
      try {
        await matchService.create({
          id: matchId, sessionId, round: 1, status: 'ongoing',
          teams: { A: [playerId], B: [] }, nextTeams: [],
          winner: null, startedAt: new Date().toISOString(), finishedAt: null,
        })
        set('matchService.create', 'ok')
      } catch (e) { set('matchService.create', 'error', e.message); return }

      try {
        const matches = await matchService.getBySession(sessionId)
        set('matchService.getBySession', 'ok', `${matches.length} partidas`)
      } catch (e) { set('matchService.getBySession', 'error', e.message) }

      try {
        await matchService.updateTeams(matchId, { A: [playerId], B: [playerId] })
        set('matchService.updateTeams', 'ok')
      } catch (e) { set('matchService.updateTeams', 'error', e.message) }

      try {
        await matchService.finish(matchId, 'A')
        set('matchService.finish', 'ok')
      } catch (e) { set('matchService.finish', 'error', e.message) }

      // ── Cleanup ─────────────────────────────────────────────────────────────
      try {
        // matches são deletados em cascade pelo ON DELETE CASCADE de sessions
        await supabase.from('sessions').delete().eq('id', sessionId)
        await playerService.remove(playerId)
        set('cleanup', 'ok', 'dados de teste removidos')
      } catch (e) { set('cleanup', 'error', e.message) }
    }

    runAll()
  }, [])

  return (
    <div className="min-h-screen px-4 py-6 bg-stone-50">
      <div className="max-w-sm mx-auto">
        <h1 className="text-base font-medium text-stone-800 mb-4">Diagnóstico — Fase 2</h1>
        <div className="space-y-2">
          {TESTS.map(name => {
            const { status, detail } = results[name]
            return (
              <div key={name} className="bg-white rounded-xl border border-stone-200 px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-stone-600">{name}</span>
                  <StatusBadge status={status} />
                </div>
                {detail && (
                  <p className="text-xs text-stone-400 mt-0.5 truncate">{detail}</p>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }) {
  const map = {
    pending: { text: '…',      cls: 'text-stone-300' },
    ok:      { text: 'OK',     cls: 'text-sage-dark font-medium' },
    error:   { text: 'FALHOU', cls: 'text-red-500 font-medium' },
  }
  const { text, cls } = map[status] ?? map.pending
  return <span className={`text-xs ${cls}`}>{text}</span>
}
