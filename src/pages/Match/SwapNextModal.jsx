import { useState } from 'react'

export default function SwapNextModal({ teamAPlayers, teamBPlayers, onConfirm, onCancel }) {
  const [selected, setSelected] = useState(null)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50">
      <div className="bg-white dark:bg-stone-800 rounded-t-2xl w-full max-w-md p-5 pb-10">

        <h2 className="text-base font-medium text-stone-800 dark:text-stone-100 mb-1 text-center">
          Trocar com a 1ª próxima
        </h2>
        <p className="text-xs text-stone-400 text-center mb-5">
          Qual time sair de quadra? Ele assume a 1ª próxima e perde as vitórias seguidas.
        </p>

        <div className="grid grid-cols-2 gap-3 mb-5">
          <button
            onClick={() => setSelected('A')}
            className={`rounded-xl border-2 p-3 text-left transition-all ${
              selected === 'A'
                ? 'border-sage-dark bg-sage-light'
                : 'border-stone-200 dark:border-stone-600 bg-stone-50 dark:bg-stone-700'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs font-medium ${
                selected === 'A' ? 'text-sage-dark' : 'text-stone-400'
              }`}>
                🟢 Time A
              </span>
              {selected === 'A' && (
                <span className="text-xs bg-sage-dark text-white rounded-full px-2 py-0.5">
                  ✓ Sair
                </span>
              )}
            </div>
            <div className="space-y-1">
              {teamAPlayers.map(p => (
                <div key={p.id} className="text-xs text-stone-600 dark:text-stone-300 truncate">
                  {p.name}
                </div>
              ))}
            </div>
          </button>

          <button
            onClick={() => setSelected('B')}
            className={`rounded-xl border-2 p-3 text-left transition-all ${
              selected === 'B'
                ? 'border-sky bg-sky-light'
                : 'border-stone-200 dark:border-stone-600 bg-stone-50 dark:bg-stone-700'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs font-medium ${
                selected === 'B' ? 'text-sky-700' : 'text-stone-400'
              }`}>
                🔵 Time B
              </span>
              {selected === 'B' && (
                <span className="text-xs bg-sky text-stone-700 rounded-full px-2 py-0.5">
                  ✓ Sair
                </span>
              )}
            </div>
            <div className="space-y-1">
              {teamBPlayers.map(p => (
                <div key={p.id} className="text-xs text-stone-600 dark:text-stone-300 truncate">
                  {p.name}
                </div>
              ))}
            </div>
          </button>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl border border-sand dark:border-stone-600
                       text-sm text-stone-600 dark:text-stone-300"
          >
            Voltar
          </button>
          <button
            onClick={() => selected && onConfirm(selected)}
            disabled={!selected}
            className="flex-1 py-3 rounded-xl bg-sage-dark text-white
                       text-sm font-medium disabled:opacity-40"
          >
            Confirmar 🔁
          </button>
        </div>

      </div>
    </div>
  )
}
