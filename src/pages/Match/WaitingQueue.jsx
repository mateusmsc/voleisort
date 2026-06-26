export default function WaitingQueue({ players, roundsOut }) {
  if (players.length === 0) return null

  return (
    <div className="bg-sand-light dark:bg-stone-800 rounded-xl p-3
                    border border-sand dark:border-stone-700">
      <h3 className="text-xs font-medium text-stone-400 uppercase tracking-wide mb-2">
        ⏳ Aguardando
      </h3>
      <div className="flex flex-wrap gap-2">
        {players.map(p => {
          const out = roundsOut[p.id] ?? 0
          return (
            <div
              key={p.id}
              className="flex items-center gap-1.5 bg-white dark:bg-stone-700
                         border border-sand dark:border-stone-600
                         rounded-full px-2.5 py-1 text-xs text-stone-600 dark:text-stone-300"
            >
              {p.name.split(' ')[0]}
              {out > 0 && (
                <span className="bg-peach dark:bg-amber-800/60 text-amber-800 dark:text-amber-300
                                 rounded-full px-1.5 py-0.5 text-xs font-medium">
                  {out} fora
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
