import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePlayerStore } from '../store/usePlayerStore'

export default function PlayerRow({ player, checked, onToggle, onDelete, onEdit }) {
  const navigate = useNavigate()
  const [showMenu, setShowMenu] = useState(false)
  const { removePlayer } = usePlayerStore()

  const initials = player.name
    .split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase()

  const winRate = player.stats.matches > 0
    ? Math.round((player.stats.wins / player.stats.matches) * 100)
    : null

  function handleDelete() {
    if (window.confirm(`Excluir "${player.name}"? Esta ação não pode ser desfeita.`)) {
      removePlayer(player.id)
      onDelete?.(player.id)
    }
    setShowMenu(false)
  }

  return (
    <div className="relative">
      <div
        className={`flex items-center gap-3 rounded-xl px-3 py-2.5 border cursor-pointer
                    transition-colors select-none ${
          checked
            ? 'bg-sage-light border-sage dark:bg-sage-dark/20 dark:border-sage-dark/50'
            : 'bg-white dark:bg-stone-800/60 border-stone-200 dark:border-stone-700/60'
        }`}
      >
        <div
          onClick={() => setShowMenu(s => !s)}
          className="w-9 h-9 rounded-full bg-sage dark:bg-sage-dark/30 flex items-center justify-center
                      text-sage-dark dark:text-sage text-xs font-medium flex-shrink-0"
          title="Opções do jogador"
        >
          {initials}
        </div>

        <div className="flex-1 min-w-0" onClick={onToggle}>
          <p className="text-sm font-medium text-stone-800 dark:text-stone-100 truncate">{player.name}</p>
          <p className="text-xs text-stone-400 dark:text-stone-500">
            {player.stats.matches === 0
              ? 'Novo jogador'
              : `${player.stats.matches} partidas · ${winRate}% vitórias`}
          </p>
        </div>

        <div
          onClick={onToggle}
          className={`w-5 h-5 rounded-full border flex items-center justify-center
                       flex-shrink-0 ${
            checked
              ? 'bg-sage-dark border-sage-dark text-white text-xs'
              : 'border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-700/40'
          }`}
        >
          {checked && '✓'}
        </div>
      </div>

      {showMenu && (
        <div className="absolute left-0 top-full mt-1 z-20
                        bg-white dark:bg-stone-800
                        border border-stone-200 dark:border-stone-700
                        rounded-xl shadow-lg dark:shadow-black/40 overflow-hidden w-48">
          <button
            onClick={() => { navigate(`/player/${player.id}`); setShowMenu(false) }}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm
                       text-stone-700 dark:text-stone-200
                       hover:bg-stone-50 dark:hover:bg-stone-700/60 text-left"
          >
            👤 Ver perfil
          </button>
          {onEdit && (
            <button
              onClick={() => { onEdit(player); setShowMenu(false) }}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm
                         text-stone-700 dark:text-stone-200
                         hover:bg-stone-50 dark:hover:bg-stone-700/60 text-left
                         border-t border-stone-100 dark:border-stone-700"
            >
              ✏️ Editar jogador
            </button>
          )}
          <button
            onClick={handleDelete}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-500
                       hover:bg-red-50 dark:hover:bg-red-900/20 text-left
                       border-t border-stone-100 dark:border-stone-700"
          >
            🗑️ Excluir jogador
          </button>
        </div>
      )}

      {showMenu && (
        <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
      )}
    </div>
  )
}
