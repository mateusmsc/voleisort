export default function FieldTeams({ teamA, teamB, onEditCurrent, onShuffle, showLevels, onToggleLevels }) {
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
            onClick={onToggleLevels}
            className={`flex items-center justify-center w-6 h-6 rounded-md transition-colors
                        ${showLevels
                          ? 'text-sage-dark dark:text-sage bg-sage-light dark:bg-sage-dark/20'
                          : 'text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300'
                        }`}
            title={showLevels ? 'Ocultar níveis' : 'Mostrar níveis'}
          >
            {showLevels ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24"
                   fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24"
                   fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            )}
          </button>
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
        <MiniTeamBox label="Time A" color="sage" players={teamA} showLevels={showLevels} />
        <MiniTeamBox label="Time B" color="sky"  players={teamB} showLevels={showLevels} />
      </div>
    </div>
  )
}

function MiniTeamBox({ label, color, players, showLevels }) {
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
            {showLevels && (
              <span className={`text-xs font-semibold ${s.text} shrink-0`}>
                {p.level ?? 3}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
