export default function TeamCard({ label, color, players }) {
  const colors = {
    sage: { border: 'border-sage', label: 'text-sage-dark', dot: '🟢' },
    sky:  { border: 'border-sky',  label: 'text-sky-700',   dot: '🔵' },
  }
  const c = colors[color] ?? colors.sage

  return (
    <div className={`bg-white dark:bg-stone-800 rounded-xl border-2 ${c.border} p-3`}>
      <div className="flex items-center justify-between mb-2.5">
        <span className={`text-xs font-medium ${c.label}`}>
          {c.dot} {label}
        </span>
      </div>
      <div className="space-y-1.5">
        {players.map(p => (
          <div key={p.id} className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-sage flex items-center justify-center
                            text-sage-dark text-xs font-medium flex-shrink-0">
              {p.name[0]}
            </div>
            <span className="text-sm text-stone-700 dark:text-stone-200 flex-1 truncate">{p.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
