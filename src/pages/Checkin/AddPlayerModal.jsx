import { useState } from 'react'
import { usePlayerStore } from '../../store/usePlayerStore'

export default function AddPlayerModal({ onConfirm, onCancel }) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const { playerNameExists } = usePlayerStore()

  function handleConfirm() {
    const trimmed = name.trim()
    if (!trimmed) return
    if (playerNameExists(trimmed)) {
      setError(`Já existe um jogador com o nome "${trimmed}".`)
      return
    }
    onConfirm(trimmed)
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50">
      <div className="bg-white dark:bg-stone-800 rounded-t-2xl w-full max-w-md p-6 pb-10">
        <h2 className="text-base font-medium text-stone-800 dark:text-stone-100 mb-4">
          Adicionar jogador
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
                     mb-2 focus:outline-none focus:border-sage"
        />

        {error ? (
          <p className="text-xs text-red-500 mb-4">{error}</p>
        ) : (
          <p className="text-xs text-stone-400 mb-4">
            Rating inicial: 50. Pode ser ajustado no perfil depois.
          </p>
        )}

        <div className="flex gap-3">
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
            Adicionar
          </button>
        </div>
      </div>
    </div>
  )
}
