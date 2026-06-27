import { teamAverage } from '../../logic/balancing'

export default function FieldTeams({ teamA, teamB, onEditCurrent, onShuffle }) {
  const avgA = teamAverage(teamA)
  const avgB = teamAverage(teamB)

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-stone-400 dark:text-stone-500 uppercase tracking-wide">
          Em quadra
        </p>
        <div className="flex items-center gap-2">
          {onShuffle && (
            <button
              onClick={onShuffle}
              className="text-xs text-stone-400 dark:text-stone-500 flex items-center gap-1
                         hover:text-stone-600 dark:hover:text-stone-300"
              title="Misturar times"
            >
              🔀 misturar
            </button>
          )}
          <button
            onClick={onEditCurrent}
            className="text-xs text-stone-400 dark:text-stone-500 flex items-center gap-1
                       hover:text-stone-600 dark:hover:text-stone-300"
          >
            ✏️ editar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <MiniTeamBox label="Time A" color="sage" players={teamA} avg={avgA} />
        <MiniTeamBox label="Time B" color="sky"  players={teamB} avg={avgB} />
      </div>
    </div>
  )
}

function MiniTeamBox({ label, color, players, avg }) {
  const styles = {
    sage: {
      border: 'border-sage dark:border-sage',
      bg: 'bg-sage-light dark:bg-stone-800',
      text: 'text-sage-dark dark:text-sage',
    },
    sky: {
      border: 'border-sky dark:border-sky',
      bg: 'bg-sky-light dark:bg-stone-800',
      text: 'text-sky-700 dark:text-sky-400',
    },
  }
  const s = styles[color]

  return (
    <div className={`rounded-xl border-2 ${s.border} ${s.bg} p-3`}>
      <div className="flex items-center justify-between mb-2">
        <span className={`text-xs font-semibold ${s.text}`}>{label}</span>
        <span className="text-xs text-stone-400">{avg}</span>
      </div>
      <div className="space-y-1">
        {players.map(p => (
          <div key={p.id} className="flex items-center gap-1.5">
            <div className={`w-5 h-5 rounded-full ${s.bg} border ${s.border}
                            flex items-center justify-center text-xs ${s.text} font-medium shrink-0`}>
              {p.name[0]}
            </div>
            <span className="text-xs text-stone-700 dark:text-stone-300 flex-1 truncate">
              {p.name}
            </span>
            <span className="text-xs text-stone-400">{p.rating}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
