import { useState, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMatchStore } from '../../store/useMatchStore'
import { useSessionStore } from '../../store/useSessionStore'
import { usePlayerStore } from '../../store/usePlayerStore'
import { buildChallenger } from '../../logic/queue'
import { calculateRatingDeltas } from '../../logic/rating'
import { shuffleTeams } from '../../logic/balancing'
import TeamCard from '../../components/TeamCard'
import WaitingQueue from './WaitingQueue'
import FinishMatchModal from './FinishMatchModal'
import EditTeamsModal from './EditTeamsModal'

export default function Match() {
  const { code, matchId } = useParams()
  const navigate = useNavigate()

  const match = useMatchStore(s => s.getMatch(matchId))
  const { finishMatch, cancelMatch, updateTeams, createMatch } = useMatchStore()
  const session = useSessionStore(s => s.getSessionByCode(code))
  const { addMatch } = useSessionStore()
  const { getPlayer, applyMatchResult } = usePlayerStore()

  // 'playing' | 'finishing' | 'editing' | 'success'
  const [mode, setMode] = useState('playing')
  const [winnerLabel, setWinnerLabel] = useState(null)
  const [nextMatchPath, setNextMatchPath] = useState(null)

  // Resolver IDs em objetos Player
  const teamAPlayers = useMemo(
    () => (match?.teams.A ?? []).map(id => getPlayer(id)).filter(Boolean),
    [match, getPlayer]
  )
  const teamBPlayers = useMemo(
    () => (match?.teams.B ?? []).map(id => getPlayer(id)).filter(Boolean),
    [match, getPlayer]
  )
  const waitingPlayers = useMemo(
    () => (match?.waitingIds ?? []).map(id => getPlayer(id)).filter(Boolean),
    [match, getPlayer]
  )

  // Rodadas consecutivas fora: conta quantas partidas SEGUIDAS (de trás pra frente)
  // cada jogador ficou sem jogar antes da partida atual.
  const roundsOut = useMemo(() => {
    if (!match || !session) return {}
    const allMatches = useMatchStore.getState()
      .getMatchesBySession(session.id)
      .filter(m => m.id !== matchId && m.status !== 'cancelled')

    const allPresent = [
      ...(match.teams.A ?? []),
      ...(match.teams.B ?? []),
      ...(match.waitingIds ?? [])
    ]

    const counts = {}
    for (const id of allPresent) {
      let consecutive = 0
      // percorre do mais recente para o mais antigo
      for (let i = allMatches.length - 1; i >= 0; i--) {
        const m = allMatches[i]
        const played = [...m.teams.A, ...m.teams.B]
        if (played.includes(id)) break   // jogou nessa — para de contar
        consecutive++
      }
      counts[id] = consecutive
    }
    return counts
  }, [match, session, matchId])

  function handleFinish(winner) {
    const winners = winner === 'A' ? teamAPlayers : teamBPlayers
    const losers  = winner === 'A' ? teamBPlayers : teamAPlayers

    // 1. Calcular e aplicar deltas de rating
    const deltas = calculateRatingDeltas(winners, losers)
    applyMatchResult(
      winners.map(p => p.id),
      losers.map(p => p.id),
      deltas
    )

    // 2. Marcar partida como finalizada
    finishMatch(matchId, winner)

    // 3. Montar próximo time desafiante
    const { challenger, newWaiting } = buildChallenger(
      winners,
      losers,
      waitingPlayers,
      roundsOut,
      session.config
    )

    // 4. Criar próxima partida automaticamente
    const nextRound = (match.round ?? 1) + 1
    const nextMatch = createMatch(
      session.id,
      nextRound,
      {
        A: winners.map(p => p.id),
        B: challenger.map(p => p.id),
      },
      newWaiting.map(p => p.id)
    )
    addMatch(session.id, nextMatch.id)

    // 5. Guardar rota da próxima partida e mostrar pop-up de sucesso
    setNextMatchPath(`/session/${code}/match/${nextMatch.id}`)
    setWinnerLabel(winner === 'A' ? 'Time A' : 'Time B')
    setMode('success')
  }

  function handleCancel() {
    cancelMatch(matchId)
    navigate(`/session/${code}/checkin`)
  }

  function handleSaveTeams(newTeams) {
    updateTeams(matchId, newTeams)
    setMode('playing')
  }

  function handleShuffle() {
    // Troca até 3 pares entre os times buscando minimizar a diferença de médias
    const { teamA: newA, teamB: newB } = shuffleTeams(teamAPlayers, teamBPlayers, 3)
    updateTeams(matchId, {
      A: newA.map(p => p.id),
      B: newB.map(p => p.id),
    })
  }

  if (!match) {
    return <div className="p-6 text-stone-400 text-center">Partida não encontrada.</div>
  }

  return (
    <div className="min-h-screen flex flex-col bg-stone-50 dark:bg-stone-900">

      {/* Header */}
      <div className="px-4 py-3 border-b border-stone-200 dark:border-stone-700
                      bg-stone-50 dark:bg-stone-800
                      flex items-center justify-between sticky top-0">
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
            <p className="text-xs text-stone-400">{session?.name} · {session?.code}</p>
            <h1 className="text-base font-medium text-stone-800 dark:text-stone-100">
              Partida {match.round}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-1.5 bg-peach-light border border-peach
                        rounded-lg px-2.5 py-1 text-xs text-amber-700 font-medium">
          ● ao vivo
        </div>
      </div>

      <div className="flex-1 px-4 py-4 space-y-3 overflow-y-auto">

        {/* Time A */}
        <TeamCard
          label="Time A"
          color="sage"
          players={teamAPlayers}
        />

        {/* VS + botão embaralhar */}
        <div className="flex items-center gap-3 text-xs text-stone-300">
          <div className="flex-1 h-px bg-stone-200 dark:bg-stone-700" />
          <button
            onClick={handleShuffle}
            className="flex items-center gap-1 bg-white dark:bg-stone-800
                       border border-sand dark:border-stone-600
                       rounded-full px-3 py-1 text-xs text-stone-500 dark:text-stone-400
                       hover:border-sage hover:text-sage-dark transition-colors"
            title="Misturar times de forma equilibrada"
          >
            🔀 misturar
          </button>
          <div className="flex-1 h-px bg-stone-200 dark:bg-stone-700" />
        </div>

        {/* Time B */}
        <TeamCard
          label="Time B"
          color="sky"
          players={teamBPlayers}
        />

        {/* Fila de espera */}
        <WaitingQueue players={waitingPlayers} roundsOut={roundsOut} />

      </div>

      {/* Ações */}
      <div className="px-4 py-3 border-t border-stone-200 dark:border-stone-700
                      bg-stone-50 dark:bg-stone-800 space-y-2">
        <div className="flex gap-2">
          <button
            onClick={() => setMode('finishing')}
            className="flex-1 bg-sage-dark text-white rounded-xl
                       py-3 text-sm font-medium"
          >
            Encerrar partida
          </button>
          <button
            onClick={() => setMode('editing')}
            className="px-4 py-3 bg-white dark:bg-stone-700 border border-sand dark:border-stone-600
                       rounded-xl text-sm text-stone-600 dark:text-stone-300"
          >
            ✏️ Editar
          </button>
        </div>
        <button
          onClick={handleCancel}
          className="w-full py-2 text-xs text-stone-400 underline"
        >
          Cancelar partida (iniciada por engano)
        </button>
      </div>

      {/* Modal: selecionar vencedor */}
      {mode === 'finishing' && (
        <FinishMatchModal
          teamAPlayers={teamAPlayers}
          teamBPlayers={teamBPlayers}
          onConfirm={handleFinish}
          onCancel={() => setMode('playing')}
        />
      )}

      {/* Modal: editar times */}
      {mode === 'editing' && (
        <EditTeamsModal
          match={match}
          allPlayers={[...teamAPlayers, ...teamBPlayers, ...waitingPlayers]}
          onSave={handleSaveTeams}
          onCancel={() => setMode('playing')}
        />
      )}

      {/* Pop-up de sucesso */}
      {mode === 'success' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-6">
          <div className="bg-white dark:bg-stone-800 rounded-2xl p-6 w-full max-w-sm text-center shadow-xl">
            <div className="w-14 h-14 bg-sage-light rounded-full flex items-center
                            justify-center text-3xl mx-auto mb-3">
              🏆
            </div>
            <h2 className="text-base font-medium text-stone-800 dark:text-stone-100 mb-1">
              Partida encerrada!
            </h2>
            <p className="text-sm text-stone-500 dark:text-stone-400 mb-5">
              Vencedor: <span className="font-semibold text-sage-dark">{winnerLabel}</span>
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setMode('playing')}
                className="flex-1 py-2.5 rounded-xl border border-sand dark:border-stone-600
                           text-sm text-stone-600 dark:text-stone-300"
              >
                Fechar
              </button>
              <button
                onClick={() => { setMode('playing'); navigate(nextMatchPath) }}
                className="flex-1 py-2.5 rounded-xl bg-sage-dark text-white text-sm font-medium"
              >
                Próxima partida →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
