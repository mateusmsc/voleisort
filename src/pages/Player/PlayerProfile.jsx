import { useNavigate, useParams } from 'react-router-dom'
import { usePlayerStore } from '../../store/usePlayerStore'
import { useMatchStore } from '../../store/useMatchStore'

export default function PlayerProfile() {
  const { playerId } = useParams()
  const navigate = useNavigate()
  const { getPlayer } = usePlayerStore()

  const player = getPlayer(playerId)

  if (!player) {
    return (
      <div className="p-6 text-center text-stone-400">
        Jogador não encontrado.{' '}
        <button onClick={() => navigate(-1)} className="text-sage-dark underline">
          Voltar
        </button>
      </div>
    )
  }

  const initials = player.name
    .split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase()

  const winRate = player.stats.matches > 0
    ? Math.round((player.stats.wins / player.stats.matches) * 100)
    : 0

  const allMatches = Object.values(useMatchStore.getState().matches)
  const playerMatches = allMatches
    .filter(m =>
      m.status === 'finished' &&
      ([...m.teams.A, ...m.teams.B].includes(playerId))
    )
    .sort((a, b) => new Date(b.finishedAt) - new Date(a.finishedAt))
    .slice(0, 10)

  return (
    <div className="min-h-screen flex flex-col">

      <div className="px-4 py-3 border-b border-stone-200 bg-stone-50
                      flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="text-stone-400 text-sm"
        >
          ← Voltar
        </button>
      </div>

      <div className="bg-sage-light border-b border-sage px-4 py-5 text-center">
        <div className="w-16 h-16 rounded-full bg-sage text-sage-dark
                        flex items-center justify-center text-xl font-medium
                        mx-auto mb-2.5 shadow-sm">
          {initials}
        </div>
        <h1 className="text-lg font-medium text-stone-800">{player.name}</h1>
        <p className="text-xs text-stone-400 mb-3">
          Desde {new Date(player.createdAt).toLocaleDateString('pt-BR', {
            month: 'long', year: 'numeric'
          })}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2 px-4 py-4">
        <div className="bg-white rounded-xl border border-stone-200 p-3 text-center">
          <p className="text-xl font-medium text-stone-800">{player.stats.matches}</p>
          <p className="text-xs text-stone-400 mt-0.5">Partidas</p>
        </div>
        <div className="bg-white rounded-xl border border-stone-200 p-3 text-center">
          <p className="text-xl font-medium text-sage-dark">{player.stats.wins}</p>
          <p className="text-xs text-stone-400 mt-0.5">Vitórias</p>
        </div>
        <div className="bg-white rounded-xl border border-stone-200 p-3 text-center">
          <p className="text-xl font-medium text-red-400">{player.stats.losses}</p>
          <p className="text-xs text-stone-400 mt-0.5">Derrotas</p>
        </div>
      </div>

      {player.stats.matches > 0 && (
        <div className="px-4 pb-2">
          <div className="bg-white rounded-xl border border-stone-200 px-4 py-3
                          flex items-center justify-between">
            <span className="text-sm text-stone-500">Taxa de vitória</span>
            <span className="text-sm font-medium text-stone-700">{winRate}%</span>
          </div>
        </div>
      )}

      <div className="px-4 pb-8">
        <h2 className="text-xs font-medium text-stone-400 uppercase tracking-wide
                       mt-2 mb-3">
          Últimas partidas
        </h2>

        {playerMatches.length === 0 ? (
          <p className="text-sm text-stone-400 text-center py-4">
            Nenhuma partida registrada ainda.
          </p>
        ) : (
          <div className="space-y-0 divide-y divide-stone-100">
            {playerMatches.map(m => {
              const won = m.teams[m.winner]?.includes(playerId)
              const date = new Date(m.finishedAt).toLocaleDateString('pt-BR', {
                day: '2-digit', month: 'short'
              })

              return (
                <div key={m.id} className="flex items-center gap-3 py-2.5">
                  <span className="text-xs text-stone-400 w-12 flex-shrink-0">{date}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${
                    won
                      ? 'bg-sage-light text-sage-dark'
                      : 'bg-peach-light text-amber-800'
                  }`}>
                    {won ? 'Vitória' : 'Derrota'}
                  </span>
                  <span className="text-xs text-stone-400 flex-1">
                    Partida {m.round}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

    </div>
  )
}
