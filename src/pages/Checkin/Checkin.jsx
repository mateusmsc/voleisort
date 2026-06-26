import { useState, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useSessionStore } from '../../store/useSessionStore'
import { usePlayerStore } from '../../store/usePlayerStore'
import { useMatchStore } from '../../store/useMatchStore'
import { formTeams } from '../../logic/balancing'
import PlayerRow from '../../components/PlayerRow'
import AddPlayerModal from './AddPlayerModal'

export default function Checkin() {
  const { code } = useParams()
  const navigate = useNavigate()

  const session = useSessionStore(s => s.getSessionByCode(code))
  const { getAllPlayers, addPlayer, getPlayer } = usePlayerStore()
  const { setCheckedIn, addPlayerToSession, addMatch, updateSessionConfig } = useSessionStore()
  const { createMatch, getMatchesBySession } = useMatchStore()

  const [search, setSearch] = useState('')
  const [checkedIn, setCheckedInLocal] = useState(
    new Set(session?.checkedInIds ?? [])
  )
  const [showAddModal, setShowAddModal] = useState(false)
  const [showConfig, setShowConfig] = useState(false)

  const allPlayers = getAllPlayers()

  // Jogadores que já pertencem a esta sessão aparecem primeiro
  const sessionPlayerIds = new Set(session?.playerIds ?? [])
  const sorted = useMemo(() => {
    return [...allPlayers].sort((a, b) => {
      const aIn = sessionPlayerIds.has(a.id) ? 0 : 1
      const bIn = sessionPlayerIds.has(b.id) ? 0 : 1
      return aIn - bIn || a.name.localeCompare(b.name)
    })
  }, [allPlayers, session?.playerIds])

  const filtered = sorted.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  // Verifica se há uma partida ativa (ongoing) nesta sessão
  const activeMatch = useMemo(() => {
    if (!session) return null
    const matches = getMatchesBySession(session.id)
    return matches.find(m => m.status === 'ongoing') ?? null
  }, [session, getMatchesBySession])

  function toggleCheckin(playerId) {
    setCheckedInLocal(prev => {
      const next = new Set(prev)

      if (next.has(playerId)) {
        // Tirando check-in: se há partida ativa e o jogador está em um time,
        // precisamos fazer substituição — apenas remove do local por ora;
        // a lógica de substituição é aplicada no handleStartMatch
        next.delete(playerId)
      } else {
        next.add(playerId)
      }

      return next
    })
  }

  function handleAddNewPlayer(name) {
    const id = addPlayer(name)
    if (session) {
      addPlayerToSession(session.id, id)
    }
    setCheckedInLocal(prev => new Set([...prev, id]))
    setShowAddModal(false)
  }

  function handleDeletePlayer(playerId) {
    setCheckedInLocal(prev => {
      const next = new Set(prev)
      next.delete(playerId)
      return next
    })
  }

  function handleStartMatch() {
    if (!session) return
    const presentPlayers = allPlayers.filter(p => checkedIn.has(p.id))

    // Persistir check-in no store
    setCheckedIn(session.id, [...checkedIn])

    if (activeMatch) {
      const currentTeamSize = session.config.teamSize
      const activeTeamSize  = activeMatch.teams.A.length  // tamanho real dos times na partida ativa

      // ── teamSize mudou → refaz o sorteio completo ──────────────────
      if (currentTeamSize !== activeTeamSize) {
        const { cancelMatch } = useMatchStore.getState()
        cancelMatch(activeMatch.id)

        const { teamA, teamB, waiting } = formTeams(presentPlayers, currentTeamSize)
        const nextRound = activeMatch.round  // mantém o número da rodada
        const newMatch = createMatch(
          session.id,
          nextRound,
          { A: teamA.map(p => p.id), B: teamB.map(p => p.id) },
          waiting.map(p => p.id)
        )
        addMatch(session.id, newMatch.id)
        navigate(`/session/${code}/match/${newMatch.id}`)
        return
      }

      // ── Modo substituição (teamSize igual) ────────────────────────
      // Identifica quais jogadores foram removidos do check-in em relação à partida ativa
      const currentInMatch = [
        ...activeMatch.teams.A,
        ...activeMatch.teams.B,
        ...activeMatch.waitingIds,
      ]
      const removedFromMatch = currentInMatch.filter(id => !checkedIn.has(id))

      if (removedFromMatch.length === 0) {
        // Nenhuma mudança relevante — só navega de volta
        navigate(`/session/${code}/match/${activeMatch.id}`)
        return
      }

      // Jogadores novos que podem entrar (presentes, mas não estavam na partida)
      const newcomers = presentPlayers.filter(p => !currentInMatch.includes(p.id))

      // Reconstrói o match substituindo cada removido pelo melhor substituto disponível
      let newTeamA = [...activeMatch.teams.A]
      let newTeamB = [...activeMatch.teams.B]
      let newWaiting = [...activeMatch.waitingIds]
      let available = [...newcomers]

      for (const removedId of removedFromMatch) {
        // Encontra o melhor substituto por similaridade de rating
        const removedPlayer = getPlayer(removedId) ?? { rating: 50 }
        const best = available.length > 0
          ? available.reduce((a, b) =>
              Math.abs(b.rating - removedPlayer.rating) < Math.abs(a.rating - removedPlayer.rating)
                ? b : a
            )
          : null

        // Remove de onde estava
        if (newTeamA.includes(removedId)) {
          newTeamA = newTeamA.filter(id => id !== removedId)
          if (best) newTeamA.push(best.id)
        } else if (newTeamB.includes(removedId)) {
          newTeamB = newTeamB.filter(id => id !== removedId)
          if (best) newTeamB.push(best.id)
        } else {
          newWaiting = newWaiting.filter(id => id !== removedId)
          if (best) newWaiting.push(best.id)
        }

        if (best) {
          available = available.filter(p => p.id !== best.id)
        }
      }

      // Atualiza a partida ativa com os novos times
      const { updateTeams } = useMatchStore.getState()
      updateTeams(activeMatch.id, { A: newTeamA, B: newTeamB })
      // Atualiza waitingIds manualmente via store
      useMatchStore.setState(state => ({
        matches: {
          ...state.matches,
          [activeMatch.id]: {
            ...state.matches[activeMatch.id],
            waitingIds: newWaiting,
          },
        },
      }))

      navigate(`/session/${code}/match/${activeMatch.id}`)
      return
    }

    // ── Modo normal: criar primeira partida ────────────────────────
    const { teamA, teamB, waiting } = formTeams(
      presentPlayers,
      session.config.teamSize
    )

    const match = createMatch(
      session.id,
      1,
      { A: teamA.map(p => p.id), B: teamB.map(p => p.id) },
      waiting.map(p => p.id)
    )
    addMatch(session.id, match.id)

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
      {/* Header */}
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
        <div className="flex items-center gap-1.5 bg-sage-light border border-sage
                        rounded-lg px-2.5 py-1 text-xs text-sage-dark font-medium">
          🔑 {session.code}
        </div>
      </div>

      {/* Painel de configuração da sessão */}
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

      {/* Barra de ação superior: contador + botão adicionar + formar times */}
      <div className="px-4 pt-3 pb-2 bg-stone-50 dark:bg-stone-800
                      border-b border-stone-100 dark:border-stone-700">
        <div className="flex items-center justify-between gap-2">
          {/* Contador e info */}
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${canStart ? 'text-sage-dark' : 'text-stone-700 dark:text-stone-300'}`}>
              {checkedIn.size}
            </span>
            <span className="text-sm text-stone-400">
              / mín. {minPlayers} jogadores
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Botão adicionar */}
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 px-3 py-2
                         bg-white dark:bg-stone-700 border border-sand dark:border-stone-600
                         rounded-xl text-xs text-stone-600 dark:text-stone-300 font-medium"
            >
              + Novo
            </button>

            {/* Botão formar times */}
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

        {/* Barra de progresso visual */}
        <div className="mt-2 h-1 bg-stone-200 dark:bg-stone-600 rounded-full overflow-hidden">
          <div
            className="h-full bg-sage-dark rounded-full transition-all"
            style={{ width: `${Math.min(100, (checkedIn.size / minPlayers) * 100)}%` }}
          />
        </div>
      </div>

      {/* Busca */}
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

      {/* Lista de jogadores */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
        {filtered.map(player => (
          <PlayerRow
            key={player.id}
            player={player}
            checked={checkedIn.has(player.id)}
            onToggle={() => toggleCheckin(player.id)}
            onDelete={handleDeletePlayer}
          />
        ))}

        {filtered.length === 0 && (
          <p className="text-sm text-stone-400 text-center py-6">
            {search ? 'Nenhum jogador encontrado.' : 'Nenhum jogador cadastrado ainda.'}
          </p>
        )}
      </div>

      {/* Modal de novo jogador */}
      {showAddModal && (
        <AddPlayerModal
          onConfirm={handleAddNewPlayer}
          onCancel={() => setShowAddModal(false)}
        />
      )}
    </div>
  )
}
