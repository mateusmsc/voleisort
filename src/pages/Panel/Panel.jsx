import { useParams } from 'react-router-dom'
import { useSessionStore } from '../../store/useSessionStore'
import { usePlayerStore } from '../../store/usePlayerStore'
import { useMatchStore } from '../../store/useMatchStore'
import { computeSessionStats, computeWinStreak } from '../../logic/session-stats'
import {
  computeCurrentMatchRoundsOut,
  finishedDayMatches,
  dayMatchNumber,
} from '../../logic/rounds-out'
import FieldTeams from '../Match/FieldTeams'
import NextTeamCard from '../Match/NextTeamCard'

export default function Panel() {
  const { hash } = useParams()
  const session = useSessionStore(
    s => Object.values(s.sessions).find(sess => sess.panelHash === hash) ?? null
  )
  const getAllPlayers = usePlayerStore(s => s.getAllPlayers)
  const getMatchesBySession = useMatchStore(s => s.getMatchesBySession)

  if (!session) {
    return <PanelMessage title="Sessão não encontrada" subtitle="Verifique o link do painel." />
  }

  const allPlayers = getAllPlayers()
  const playerById = new Map(allPlayers.map(p => [p.id, p]))
  const toPlayers = ids => ids.map(id => playerById.get(id)).filter(Boolean)

  const matches = getMatchesBySession(session.id)

  return (
    <div className="min-h-screen px-4 py-6">
      <header className="mb-6">
        <h1 className="text-lg font-medium text-stone-800 dark:text-stone-100">{session.name}</h1>
      </header>

      {session.status === 'finished'
        ? <FinishedPanel session={session} matches={matches} players={allPlayers} />
        : <ActivePanel
            matches={matches}
            toPlayers={toPlayers}
            teamSize={session.config?.teamSize ?? 6}
            statsResetAt={session.statsResetAt}
          />}
    </div>
  )
}

function ActivePanel({ matches, toPlayers, teamSize, statsResetAt }) {
  const ongoing = matches.find(m => m.status === 'ongoing')

  if (!ongoing) {
    return (
      <PanelMessage
        title="Sessão em andamento"
        subtitle="Nenhuma partida em quadra agora. Recarregue para atualizar."
      />
    )
  }

  const nexts = ongoing.nextTeams ?? []
  const roundsOut = computeCurrentMatchRoundsOut(ongoing, matches)
  const winStreak = computeWinStreak(
    ongoing.teams.A ?? [],
    finishedDayMatches(ongoing, matches)
  )

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-stone-500 dark:text-stone-400">
        Partida #{dayMatchNumber(ongoing, matches, statsResetAt)}
      </p>

      <FieldTeams
        teamA={toPlayers(ongoing.teams.A)}
        teamB={toPlayers(ongoing.teams.B)}
        winStreak={winStreak}
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
                players={toPlayers(team)}
                teamSize={teamSize}
                roundsOut={roundsOut}
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

      <p className="text-xs text-stone-400 text-center">
        Recarregue a página para atualizar
      </p>
    </div>
  )
}

function FinishedPanel({ session, matches, players }) {
  // Apenas as partidas do dia: as jogadas depois da última finalização da sessão.
  const dayMatches = session.statsResetAt
    ? matches.filter(m => new Date(m.startedAt) > new Date(session.statsResetAt))
    : matches
  const stats = computeSessionStats(dayMatches, players)

  return (
    <div className="space-y-5">
      <div className="bg-white dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 p-4">
        <p className="text-sm text-stone-400 mb-1">Sessão finalizada</p>
        <div className="grid grid-cols-2 gap-2 text-center">
          <div>
            <p className="text-2xl font-medium text-stone-800 dark:text-stone-100">{stats.totalMatches}</p>
            <p className="text-xs text-stone-400">Partidas jogadas</p>
          </div>
          <div>
            <p className="text-2xl font-medium text-stone-800 dark:text-stone-100">{stats.ranking.length}</p>
            <p className="text-xs text-stone-400">Jogadores em quadra</p>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-xs font-medium text-stone-400 uppercase tracking-wide mb-3">
          Ranking de vitórias
        </h2>
        {stats.ranking.length === 0 ? (
          <div className="bg-white dark:bg-stone-800 rounded-xl border border-stone-200 dark:border-stone-700
                          px-4 py-6 text-sm text-stone-400 text-center">
            Nenhuma partida registrada
          </div>
        ) : (
          <div className="bg-white dark:bg-stone-800 rounded-xl border border-stone-200 dark:border-stone-700 divide-y divide-stone-100 dark:divide-stone-700">
            {stats.ranking.map((r, i) => (
              <div key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className={`w-5 text-xs font-medium ${i < 3 ? 'text-sage-dark dark:text-sage' : 'text-stone-300'}`}>
                  {i + 1}
                </span>
                <span className="text-sm text-stone-700 dark:text-stone-200 flex-1 truncate">
                  {r.name ?? 'Jogador'}
                </span>
                <span className="text-xs text-stone-400 shrink-0">
                  {r.played}J · <span className="text-sage-dark dark:text-sage">{r.wins}V</span> / <span className="text-red-400">{r.losses}D</span>
                </span>
                <span className="text-sm font-medium text-stone-800 dark:text-stone-100 w-12 text-right shrink-0">
                  {r.winPct}%
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function PanelMessage({ title, subtitle }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="bg-white dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700
                      p-8 text-center max-w-xs w-full">
        <p className="text-base font-medium text-stone-800 dark:text-stone-100 mb-1">{title}</p>
        <p className="text-sm text-stone-400">{subtitle}</p>
      </div>
    </div>
  )
}
