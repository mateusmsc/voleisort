import { useState } from 'react'
import { LEVELS } from '../../utils/levels'

export default function EditPlayerModal({ player, existingNames = [], onConfirm, onCancel }) {
  const [name, setName] = useState(player.name)
  const [level, setLevel] = useState(player.level ?? 3)
  const [error, setError] = useState('')

  const normalizedExisting = existingNames.map(n => n.trim().toLowerCase())

  function handleConfirm() {
    const trimmed = name.trim()
    if (!trimmed) {
      setError('O nome não pode estar vazio.')
      return
    }
    if (normalizedExisting.includes(trimmed.toLowerCase())) {
      setError(`Já existe outro jogador com o nome "${trimmed}" nesta sessão.`)
      return
    }
    onConfirm({ name: trimmed, level })
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50">
      <div className="bg-white dark:bg-stone-800 rounded-t-2xl w-full max-w-md p-6 pb-10">
        <h2 className="text-base font-medium text-stone-800 dark:text-stone-100 mb-4">
          Editar jogador
        </h2>

        <input
          type="text"
          value={name}
          onChange={e => { setName(e.target.value); setError('') }}
          onKeyDown={e => e.key === 'Enter' && handleConfirm()}
          placeholder="Nome do jogador"
          autoFocus
          className="w-full bg-stone-50 dark:bg-stone-700 border border-sand dark:border-stone-600
                     rounded-xl px-3 py-2.5 text-base text-stone-700 dark:text-stone-100
                     mb-3 focus:outline-none focus:border-sage"
        />

        <div className="mb-3">
          <p className="text-xs font-medium text-stone-600 dark:text-stone-300 mb-1.5">
            Nível
          </p>
          <div className="flex gap-1.5 flex-wrap">
            {LEVELS.map(l => (
              <button
                key={l}
                type="button"
                onClick={() => setLevel(l)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  level === l
                    ? 'bg-sage-dark text-white border-sage-dark'
                    : 'bg-white dark:bg-stone-700 text-stone-600 dark:text-stone-300 border-sand dark:border-stone-600'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p className="text-xs text-red-500 mb-4">{error}</p>
        )}

        <div className="flex gap-3 mt-4">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-sand dark:border-stone-600
                       text-sm text-stone-600 dark:text-stone-300"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!name.trim()}
            className="flex-1 py-2.5 rounded-xl bg-sage-dark text-white
                       text-sm font-medium disabled:opacity-40"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
}
