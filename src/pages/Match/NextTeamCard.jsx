import { teamAverage } from '../../logic/balancing'

const ORDINALS = ['1ª', '2ª', '3ª', '4ª', '5ª', '6ª', '7ª', '8ª']

export default function NextTeamCard({ index, players, teamSize, roundsOut = {}, onEdit }) {
  const isIncomplete = players.length < teamSize
  const avg = teamAverage(players)
  const label = `${ORDINALS[index] ?? `${index + 1}ª`} próxima`

  return (
    <div className={`bg-white dark:bg-stone-800 rounded-xl border px-3 py-3 ${
      isIncomplete
        ? 'border-peach dark:border-amber-700'
        : 'border-stone-200 dark:border-stone-700'
    }`}>
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-stone-700 dark:text-stone-200">{label}</span>
          {isIncomplete && (
            <span className="text-xs bg-peach-light dark:bg-amber-900/40 text-amber-700 dark:text-amber-400
                             border border-peach dark:border-amber-700 rounded-full px-2 py-0.5">
              ⚠ {players.length}/{teamSize}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-stone-400">média {avg}</span>
          <button
            onClick={onEdit}
            className="text-xs text-stone-400 hover:text-stone-600 dark:hover:text-stone-300"
          >
            ✏️
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        {players.map(p => {
          const out = roundsOut[p.id] ?? 0
          return (
          <div key={p.id} className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-sand-light dark:bg-stone-700 border border-sand dark:border-stone-600
                            flex items-center justify-center text-xs text-stone-500 dark:text-stone-400 shrink-0">
              {p.name[0]}
            </div>
            <span className="text-sm text-stone-700 dark:text-stone-300 flex-1 truncate">{p.name}</span>
            {out > 0 && (
              <span className="text-xs bg-peach dark:bg-amber-800/60 text-amber-800 dark:text-amber-300
                               rounded-full px-1.5 py-0.5 font-medium">
                {out} fora
              </span>
            )}
            <span className="text-xs text-stone-400">{p.rating}</span>
          </div>
          )
        })}

        {isIncomplete && Array.from({ length: teamSize - players.length }).map((_, i) => (
          <div key={`empty-${i}`} className="flex items-center gap-2 opacity-40">
            <div className="w-5 h-5 rounded-full border border-dashed border-stone-300 dark:border-stone-600 shrink-0" />
            <span className="text-xs text-stone-300 dark:text-stone-600 italic">aguardando...</span>
          </div>
        ))}
      </div>
    </div>
  )
}
