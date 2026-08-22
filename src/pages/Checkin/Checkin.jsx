import { useState, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useSessionStore } from '../../store/useSessionStore'
import { usePlayerStore } from '../../store/usePlayerStore'
import { useMatchStore } from '../../store/useMatchStore'
import { useShallow } from 'zustand/react/shallow'
import { distributeAllPlayers } from '../../logic/queue'
import { applyCheckinWithActiveMatch, insertPlayerIntoQueue } from '../../logic/checkin-logic'
import PlayerRow from '../../components/PlayerRow'
import AddPlayerModal from './AddPlayerModal'
import EditPlayerModal from './EditPlayerModal'
import PanelShareButton from '../../components/PanelShareButton'

export default function Checkin() {
  const { code } = useParams()
  const navigate = useNavigate()

  // Selectors reativos — observam o estado diretamente, sem chamar get() interno
  const session = useSessionStore(s =>
    Object.values(s.sessions).find(sess => sess.code === code) ?? null
  )
  const sessionId = session?.id ?? null

  const sessionPlayers = usePlayerStore(
    useShallow(s =>
      (session?.playerIds ?? []).map(id => s.players[id]).filter(Boolean)
    )
  )

  // activeMatch depende de sessionId — selector reativo sobre matches
  const activeMatch = useMatchStore(s => {
    if (!sessionId) return null
    const found = Object.values(s.matches).find(
      m => m.sessionId === sessionId && m.status === 'ongoing'
    )
    return found ?? null
  })

  const { getPlayer, addPlayer, updatePlayer } = usePlayerStore()
  const { setCheckedIn, addPlayerToSession, addMatch, updateSessionConfig, resumeSession } = useSessionStore()
  const { createMatch, updateNextTeams } = useMatchStore()

  const [search, setSearch] = useState('')
  const [checkedIn, setCheckedInLocal] = useState(
    new Set(session?.checkedInIds ?? [])
  )
  const [showAddModal, setShowAddModal] = useState(false)
  const [showConfig, setShowConfig] = useState(false)
  const [editingPlayer, setEditingPlayer] = useState(null)

  const sorted = useMemo(() => {
    return [...sessionPlayers].sort((a, b) => a.name.localeCompare(b.name))
  }, [sessionPlayers])

  const filtered = sorted.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  function toggleCheckin(playerId) {
    setCheckedInLocal(prev => {
      const next = new Set(prev)
      if (next.has(playerId)) {
        next.delete(playerId)
      } else {
        next.add(playerId)
      }
      return next
    })
  }

  function handleSelectAll() {
    const allFiltered = filtered.map(p => p.id)
    const allChecked = allFiltered.every(id => checkedIn.has(id))
    setCheckedInLocal(prev => {
      const next = new Set(prev)
      if (allChecked) {
        allFiltered.forEach(id => next.delete(id))
      } else {
        allFiltered.forEach(id => next.add(id))
      }
      return next
    })
  }

  async function handleAddNewPlayer(name, level) {
    const id = await addPlayer(name, level)
    if (session) {
      addPlayerToSession(session.id, id)
    }
    setCheckedInLocal(prev => new Set([...prev, id]))
    setShowAddModal(false)

    if (activeMatch) {
      const newPlayer = getPlayer(id)
      if (!newPlayer) return

      const currentNextTeams = activeMatch.nextTeams ?? []
      const teamSize = session.config.teamSize
      const updatedNextTeams = insertPlayerIntoQueue(currentNextTeams, id, teamSize)

      const { updateNextTeams: updateNextTeamsAction } = useMatchStore.getState()
      await updateNextTeamsAction(activeMatch.id, updatedNextTeams)
    }
  }

  function handleDeletePlayer(playerId) {
    setCheckedInLocal(prev => {
      const next = new Set(prev)
      next.delete(playerId)
      return next
    })
  }

  async function handleEditPlayer({ name, level }) {
    if (!editingPlayer) return
    await updatePlayer(editingPlayer.id, { name, level })
    setEditingPlayer(null)
  }

  async function handleStartMatch() {
    if (!session) return
    const presentPlayers = sessionPlayers.filter(p => checkedIn.has(p.id))

    // Sessão de semana anterior finalizada? Retoma para a nova rodada do dia.
    if (session.status !== 'active') {
      await resumeSession(session.id)
    }

    setCheckedIn(session.id, [...checkedIn])

    if (activeMatch) {
      const currentTeamSize = session.config.teamSize
      const activeTeamSize  = activeMatch.teams.A.length

      if (currentTeamSize !== activeTeamSize) {
        const { cancelMatch } = useMatchStore.getState()
        await cancelMatch(activeMatch.id)

        const { teamA, teamB, nextTeams } = distributeAllPlayers(presentPlayers, currentTeamSize)
        const nextRound = activeMatch.round
        const newMatch = await createMatch(
          session.id,
          nextRound,
          { A: teamA.map(p => p.id), B: teamB.map(p => p.id) },
          nextTeams.map(team => team.map(p => p.id)),
          nextRound
        )
        await addMatch(session.id, newMatch.id)
        navigate(`/session/${code}/match/${newMatch.id}`)
        return
      }

      const currentNextTeamsFlat = (activeMatch.nextTeams ?? []).flat()
      const currentInMatch = [
        ...activeMatch.teams.A,
        ...activeMatch.teams.B,
        ...currentNextTeamsFlat,
      ]

      const { newTeamA, newTeamB, newNextTeams, changed } = applyCheckinWithActiveMatch({
        teamA: activeMatch.teams.A,
        teamB: activeMatch.teams.B,
        nextTeams: activeMatch.nextTeams ?? [],
        checkedInSet: checkedIn,
        presentPlayers,
        currentInMatch,
        teamSize: currentTeamSize,
        getPlayer,
      })

      if (!changed) {
        navigate(`/session/${code}/match/${activeMatch.id}`)
        return
      }

      const { updateTeams } = useMatchStore.getState()
      await updateTeams(activeMatch.id, { A: newTeamA, B: newTeamB })
      await updateNextTeams(activeMatch.id, newNextTeams)

      navigate(`/session/${code}/match/${activeMatch.id}`)
      return
    }

    const { teamA, teamB, nextTeams } = distributeAllPlayers(
      presentPlayers,
      session.config.teamSize
    )

    const allSessionMatches = useMatchStore.getState().getMatchesBySession(session.id)
    const hasPreviousMatches = allSessionMatches.length > 0
    // Round interno permanece GLOBAL (janelas de roundsOut dependem disso);
    // o número EXIBIDO na tela é diário (dayMatchNumber no Match).
    const nextRound = hasPreviousMatches
      ? Math.max(...allSessionMatches.map(m => m.round)) + 1
      : 1

    const match = await createMatch(
      session.id,
      nextRound,
      { A: teamA.map(p => p.id), B: teamB.map(p => p.id) },
      nextTeams.map(team => team.map(p => p.id)),
      hasPreviousMatches ? nextRound : undefined
    )
    await addMatch(session.id, match.id)

    navigate(`/session/${code}/match/${match.id}`)
  }

  if (!session) {
    return (
      <div className="p-6 text-center text-stone-500">
        Sessão não encontrada.{' '}
        <button
          onClick={() => navigate('/')}
          className="text-sage-dark underline"
        >
          Voltar para início
        </button>
      </div>
    )
  }

  const minPlayers = session.config.teamSize * 2
  const canStart = checkedIn.size >= minPlayers

  return (
    <div className="min-h-screen flex flex-col bg-stone-50 dark:bg-stone-900">
      <div className="px-4 py-3 border-b border-stone-200 dark:border-stone-700
                      bg-stone-50 dark:bg-stone-800
                      flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/')}
            className="text-stone-400 pr-2 border-r border-stone-200 dark:border-stone-600 mr-1 flex items-center"
            title="Tela inicial"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24"
                 fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
              <line x1="12" y1="2" x2="12" y2="12" />
            </svg>
          </button>
          <div>
            <p className="text-xs text-stone-400">{session.name}</p>
            <h1 className="text-base font-medium text-stone-800 dark:text-stone-100">Check-in</h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <PanelShareButton panelHash={session?.panelHash} />
          <div className="flex items-center gap-1.5 bg-sage-light border border-sage
                          rounded-lg px-2.5 py-1 text-xs text-sage-dark font-medium">
            🔑 {session.code}
          </div>
        </div>
      </div>

      <div className="px-4 border-b border-stone-100 dark:border-stone-700
                      bg-stone-50 dark:bg-stone-800">
        <button
          onClick={() => setShowConfig(s => !s)}
          className="w-full flex items-center justify-between py-2.5
                     text-xs text-stone-500 dark:text-stone-400"
        >
          <span>⚙️ Configurações da sessão</span>
          <span className="text-stone-400">{showConfig ? '▲' : '▼'}</span>
        </button>

        {showConfig && (
          <div className="pb-3 space-y-3">
            <div>
              <p className="text-xs font-medium text-stone-600 dark:text-stone-300 mb-1.5">
                Jogadores por time
              </p>
              <div className="flex gap-2">
                {[4, 5, 6, 7].map(n => (
                  <button
                    key={n}
                    onClick={() => updateSessionConfig(session.id, { teamSize: n })}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${
                      session.config.teamSize === n
                        ? 'bg-sage-dark text-white border-sage-dark'
                        : 'bg-white dark:bg-stone-700 text-stone-600 dark:text-stone-300 border-sand dark:border-stone-600'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <p className="text-xs text-stone-400 mt-1.5">
                Mínimo para iniciar: {session.config.teamSize * 2} jogadores
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="px-4 pt-3 pb-2 bg-stone-50 dark:bg-stone-800
                      border-b border-stone-100 dark:border-stone-700">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${canStart ? 'text-sage-dark' : 'text-stone-700 dark:text-stone-300'}`}>
              {checkedIn.size}
            </span>
            <span className="text-sm text-stone-400">
              / mín. {minPlayers} jogadores
            </span>
          </div>

          <div className="flex items-center gap-2">
            {filtered.length > 0 && (
              <button
                onClick={handleSelectAll}
                className="flex items-center gap-1.5 px-3 py-2
                           bg-white dark:bg-stone-700 border border-sand dark:border-stone-600
                           rounded-xl text-xs text-stone-600 dark:text-stone-300 font-medium"
              >
                {filtered.every(p => checkedIn.has(p.id)) ? 'Desmarcar todos' : 'Selecionar todos'}
              </button>
            )}

            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 px-3 py-2
                         bg-white dark:bg-stone-700 border border-sand dark:border-stone-600
                         rounded-xl text-xs text-stone-600 dark:text-stone-300 font-medium"
            >
              + Novo
            </button>

            <button
              onClick={handleStartMatch}
              disabled={!canStart}
              className="flex items-center gap-1.5 px-3 py-2 bg-sage-dark text-white
                         rounded-xl text-xs font-medium disabled:opacity-40"
            >
              {activeMatch ? '↩ Voltar à partida' : 'Formar times →'}
            </button>
          </div>
        </div>

        <div className="mt-2 h-1 bg-stone-200 dark:bg-stone-600 rounded-full overflow-hidden">
          <div
            className="h-full bg-sage-dark rounded-full transition-all"
            style={{ width: `${Math.min(100, (checkedIn.size / minPlayers) * 100)}%` }}
          />
        </div>
      </div>

      {activeMatch && (
        <div className="mx-4 mt-3 bg-peach-light border border-peach rounded-xl px-3 py-2.5
                        text-xs text-amber-800 dark:text-amber-200">
          <strong>Partida ativa.</strong> Alterações no check-in serão aplicadas como substituições sem re-randomizar os times.
          Adicionar um novo jogador o coloca na fila automaticamente.
        </div>
      )}

      <div className="px-4 pt-3 pb-2">
        <div className="flex items-center gap-2 bg-white dark:bg-stone-800
                        border border-sand dark:border-stone-600
                        rounded-xl px-3 py-2 text-sm text-stone-400">
          🔍
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar jogador..."
            className="flex-1 bg-transparent outline-none text-stone-700 dark:text-stone-200"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
        {filtered.map(player => (
          <PlayerRow
            key={player.id}
            player={player}
            checked={checkedIn.has(player.id)}
            onToggle={() => toggleCheckin(player.id)}
            onDelete={handleDeletePlayer}
            onEdit={(p) => setEditingPlayer(p)}
          />
        ))}

        {filtered.length === 0 && (
          <p className="text-sm text-stone-400 text-center py-6">
            {search ? 'Nenhum jogador encontrado.' : 'Nenhum jogador cadastrado ainda.'}
          </p>
        )}
      </div>

      {showAddModal && (
        <AddPlayerModal
          onConfirm={handleAddNewPlayer}
          onCancel={() => setShowAddModal(false)}
          existingNames={sessionPlayers.map(p => p.name)}
        />
      )}

      {editingPlayer && (
        <EditPlayerModal
          player={editingPlayer}
          existingNames={sessionPlayers.filter(p => p.id !== editingPlayer.id).map(p => p.name)}
          onConfirm={handleEditPlayer}
          onCancel={() => setEditingPlayer(null)}
        />
      )}
    </div>
  )
}
