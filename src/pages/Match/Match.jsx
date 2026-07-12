import { useState, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMatchStore } from '../../store/useMatchStore'
import { useSessionStore } from '../../store/useSessionStore'
import { usePlayerStore } from '../../store/usePlayerStore'
import { advanceQueue } from '../../logic/queue'
import { shuffleTeams } from '../../logic/balancing'
import { computeRoundsOut } from '../../logic/rounds-out'
import FieldTeams from './FieldTeams'
import NextTeamCard from './NextTeamCard'
import FinishMatchModal from './FinishMatchModal'
import EditTeamsModal from './EditTeamsModal'

export default function Match() {
  const { code, matchId } = useParams()
  const navigate = useNavigate()

  const match   = useMatchStore(s => s.matches[matchId] ?? null)
  const session = useSessionStore(s =>
    Object.values(s.sessions).find(sess => sess.code === code) ?? null
  )
  const { finishMatch, cancelMatch, updateTeams, updateNextTeams, createMatch } = useMatchStore()
  const { addMatch, setCheckedIn, finishSession } = useSessionStore()
  const { getPlayer, applyMatchResult } = usePlayerStore()

  const [mode, setMode] = useState('playing')
  const [editingNextIdx, setEditingNextIdx] = useState(null)
  const [showLevels, setShowLevels] = useState(false)

  const teamA = useMemo(
    () => (match?.teams.A ?? []).map(id => getPlayer(id)).filter(Boolean),
    [match, getPlayer]
  )
  const teamB = useMemo(
    () => (match?.teams.B ?? []).map(id => getPlayer(id)).filter(Boolean),
    [match, getPlayer]
  )
  const nexts = useMemo(
    () => (match?.nextTeams ?? []).map(team => team.map(id => getPlayer(id)).filter(Boolean)),
    [match, getPlayer]
  )

  const roundsOut = useMemo(() => {
    if (!match || !session) return {}
    const resetFromRound = match.roundsOutResetAt ?? 0
    const finishedMatches = useMatchStore.getState()
      .getMatchesBySession(session.id)
      .filter(m =>
        m.id !== matchId &&
        m.status === 'finished' &&
        m.round >= resetFromRound
      )

    const allIds = [
      ...(match.teams.A ?? []),
      ...(match.teams.B ?? []),
      ...(match.nextTeams ?? []).flat()
    ]

    // Participantes originais da partida atual: jogadores que estavam presentes
    // quando a partida foi criada. São todos que já apareceram em pelo menos uma
    // partida do histórico desta sessão OU estão nos times/fila da partida atual.
    // Jogadores que chegaram via check-in tardio não estarão em nenhuma partida
    // histórica, por isso computeRoundsOut os trata como roundsOut=0.
    const allHistoricalIds = new Set(
      finishedMatches.flatMap(m => [...m.teams.A, ...m.teams.B])
    )
    const originalParticipantIds = allIds.filter(id => allHistoricalIds.has(id))

    return computeRoundsOut(allIds, finishedMatches, originalParticipantIds)
  }, [match, session, matchId])

  async function handleFinish(winner) {
    const winners = winner === 'A' ? teamA : teamB
    const losers  = winner === 'A' ? teamB : teamA

    await applyMatchResult(winners.map(p => p.id), losers.map(p => p.id))
    await finishMatch(matchId, winner)

    const { newOpponent, newNextTeams } = advanceQueue(
      winners, losers, nexts,
      session.config.teamSize, roundsOut, session.config.maxRoundsOut
    )

    const nextRound = (match.round ?? 1) + 1
    const nextMatch = await createMatch(
      session.id,
      nextRound,
      { A: winners.map(p => p.id), B: newOpponent.map(p => p.id) },
      newNextTeams.map(t => t.map(p => p.id)),
      match.roundsOutResetAt
    )
    await addMatch(session.id, nextMatch.id)
    navigate(`/session/${code}/match/${nextMatch.id}`)
  }

  async function handleShuffle() {
    const { teamA: newA, teamB: newB } = shuffleTeams(teamA, teamB, 3)
    await updateTeams(matchId, { A: newA.map(p => p.id), B: newB.map(p => p.id) })
  }

  async function handleSaveCurrentTeams([newA, newB], newPool) {
    await updateTeams(matchId, { A: newA.map(p => p.id), B: newB.map(p => p.id) })
    if (newPool !== undefined) {
      const teamSize = session.config.teamSize
      const poolIds = [...newPool.map(p => p.id)]
      const reconstructed = nexts.map(origTeam => {
        const chunk = poolIds.splice(0, origTeam.length)
        return chunk
      }).filter(t => t.length > 0)
      while (poolIds.length > 0) {
        reconstructed.push(poolIds.splice(0, teamSize))
      }
      await updateNextTeams(matchId, reconstructed)
    }
    setMode('playing')
  }

  async function handleSaveNextTeam(idx, [newTeam], newPool) {
    const teamSize = session.config.teamSize

    if (newPool !== undefined) {
      const origNextTeam = nexts[idx].map(p => p.id)
      const newNextTeamIds = newTeam.map(p => p.id)
      const poolIds = newPool.map(p => p.id)

      const movedToPool = origNextTeam.filter(id => !newNextTeamIds.includes(id))
      const movedFromPool = newNextTeamIds.filter(id => !origNextTeam.includes(id))

      const onFieldAll = new Set([...match.teams.A, ...match.teams.B])

      let newTeamAIds = [...match.teams.A]
      let newTeamBIds = [...match.teams.B]
      let fieldChanged = false

      for (const newcomerId of movedFromPool) {
        if (onFieldAll.has(newcomerId)) {
          const replacedByQueue = movedToPool[movedFromPool.indexOf(newcomerId)]
          if (replacedByQueue) {
            newTeamAIds = newTeamAIds.map(id => id === newcomerId ? replacedByQueue : id)
            newTeamBIds = newTeamBIds.map(id => id === newcomerId ? replacedByQueue : id)
            fieldChanged = true
          }
        }
      }

      if (fieldChanged) {
        await updateTeams(matchId, { A: newTeamAIds, B: newTeamBIds })
      }

      const updatedFieldIds = new Set([...newTeamAIds, ...newTeamBIds])
      const otherQueueIds = poolIds.filter(id => !updatedFieldIds.has(id))

      const otherOrigNexts = nexts.filter((_, i) => i !== idx)
      const remaining = [...otherQueueIds]
      const reconstructedOthers = otherOrigNexts.map(origTeam => {
        return remaining.splice(0, origTeam.length)
      }).filter(t => t.length > 0)
      while (remaining.length > 0) {
        reconstructedOthers.push(remaining.splice(0, teamSize))
      }

      reconstructedOthers.splice(idx, 0, newNextTeamIds)
      await updateNextTeams(matchId, reconstructedOthers.filter(t => t.length > 0))
    } else {
      const updatedNexts = nexts.map((team, i) => i === idx ? newTeam : team)
      await updateNextTeams(matchId, updatedNexts.map(t => t.map(p => p.id)))
    }
    setMode('playing')
    setEditingNextIdx(null)
  }

  async function handleCancel() {
    await cancelMatch(matchId)
    navigate(`/session/${code}/checkin`)
  }

  async function handleFinishSession() {
    try {
      await cancelMatch(matchId)
    } catch (_) { /* partida já cancelada ou inválida — ignorar */ }
    await setCheckedIn(session.id, [])
    await finishSession(session.id)
    navigate('/')
  }

  async function handleResetRoundsOut() {
    const { updateRoundsOutResetAt } = useMatchStore.getState()
    await updateRoundsOutResetAt(matchId, (match.round ?? 1) + 1)
    setMode('playing')
  }

  if (!match) {
    return <div className="p-6 text-stone-400 text-center">Partida não encontrada.</div>
  }

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
            <p className="text-xs text-stone-400">{session?.name} · {session?.code}</p>
            <h1 className="text-base font-medium text-stone-800 dark:text-stone-100">
              Partida {match.round}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setMode('confirmResetRoundsOut')}
            className="text-xs text-stone-400 dark:text-stone-500 underline mr-1"
            title="Zerar contagem de partidas fora"
          >
            zerar fora
          </button>
          <span className="flex items-center gap-1.5 bg-peach-light border border-peach
                           rounded-lg px-2.5 py-1 text-xs text-amber-700 font-medium">
            ● ao vivo
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

        <div className="flex gap-2">
          <button
            onClick={() => setMode('finishing')}
            className="flex-1 bg-sage-dark text-white rounded-xl py-2.5 text-sm font-medium"
          >
            Encerrar partida
          </button>
          <button
            onClick={() => navigate(`/session/${code}/checkin`)}
            className="px-4 py-2.5 bg-white dark:bg-stone-700 border border-sand dark:border-stone-600
                       rounded-xl text-sm text-stone-600 dark:text-stone-300"
            title="Ir para check-in"
          >
            👥
          </button>
        </div>

        <FieldTeams
          teamA={teamA}
          teamB={teamB}
          onEditCurrent={() => setMode('editingCurrent')}
          onShuffle={handleShuffle}
          showLevels={showLevels}
          onToggleLevels={() => setShowLevels(s => !s)}
        />

        {nexts.length > 0 && (
          <div>
            <p className="text-xs font-medium text-stone-400 uppercase tracking-wide mb-2">
              Próximos times
            </p>
            <div className="space-y-3">
              {nexts.map((team, idx) => (
                <NextTeamCard
                  key={idx}
                  index={idx}
                  players={team}
                  teamSize={session?.config.teamSize ?? 6}
                  roundsOut={roundsOut}
                  showLevels={showLevels}
                  onEdit={() => {
                    setEditingNextIdx(idx)
                    setMode('editingNext')
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {nexts.length === 0 && (
          <div className="bg-stone-100 dark:bg-stone-800 rounded-xl p-4 text-center">
            <p className="text-xs text-stone-400">Sem times na fila — todos estão em campo.</p>
          </div>
        )}

      </div>

      <div className="px-4 py-3 border-t border-stone-200 dark:border-stone-700
                      bg-stone-50 dark:bg-stone-800">
        <button
          onClick={() => setMode('confirmFinishSession')}
          className="w-full py-1.5 text-xs text-stone-400 underline"
        >
          Finalizar sessão
        </button>
      </div>

      {mode === 'finishing' && (
        <FinishMatchModal
          teamAPlayers={teamA}
          teamBPlayers={teamB}
          onConfirm={handleFinish}
          onCancel={() => setMode('playing')}
        />
      )}

      {mode === 'editingCurrent' && (
        <EditTeamsModal
          title="Editar times em campo"
          slots={['Time A', 'Time B']}
          initialGroups={[teamA, teamB]}
          extraPool={nexts.flat()}
          onSave={handleSaveCurrentTeams}
          onCancel={() => setMode('playing')}
        />
      )}

      {mode === 'editingNext' && editingNextIdx !== null && (
        <EditTeamsModal
          title={`Editar ${editingNextIdx + 1}ª próxima`}
          slots={[`${editingNextIdx + 1}ª próxima`]}
          initialGroups={[nexts[editingNextIdx]]}
          extraPool={[
            ...teamA, ...teamB,
            ...nexts.filter((_, i) => i !== editingNextIdx).flat()
          ]}
          onSave={(groups, pool) => handleSaveNextTeam(editingNextIdx, groups, pool)}
          onCancel={() => { setMode('playing'); setEditingNextIdx(null) }}
        />
      )}

      {mode === 'confirmFinishSession' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-6">
          <div className="bg-white dark:bg-stone-800 rounded-2xl p-6 w-full max-w-sm text-center shadow-xl">
            <h2 className="text-base font-medium text-stone-800 dark:text-stone-100 mb-2">
              Finalizar sessão?
            </h2>
            <p className="text-sm text-stone-500 dark:text-stone-400 mb-5">
              Finalizar a sessão de hoje? As partidas serão encerradas e os times
              serão remontados na próxima vez com base nos presentes.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setMode('playing')}
                className="flex-1 py-2.5 rounded-xl border border-sand dark:border-stone-600
                           text-sm text-stone-600 dark:text-stone-300"
              >
                Voltar
              </button>
              <button
                onClick={handleFinishSession}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium"
              >
                Finalizar sessão
              </button>
            </div>
          </div>
        </div>
      )}

      {mode === 'confirmResetRoundsOut' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-6">
          <div className="bg-white dark:bg-stone-800 rounded-2xl p-6 w-full max-w-sm text-center shadow-xl">
            <h2 className="text-base font-medium text-stone-800 dark:text-stone-100 mb-2">
              Zerar contagem de partidas fora?
            </h2>
            <p className="text-sm text-stone-500 dark:text-stone-400 mb-5">
              A contagem de partidas sem jogar de todos será zerada a partir desta partida.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setMode('playing')}
                className="flex-1 py-2.5 rounded-xl border border-sand dark:border-stone-600
                           text-sm text-stone-600 dark:text-stone-300"
              >
                Voltar
              </button>
              <button
                onClick={handleResetRoundsOut}
                className="flex-1 py-2.5 rounded-xl bg-sage-dark text-white text-sm font-medium"
              >
                Zerar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
