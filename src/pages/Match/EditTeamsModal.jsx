import { useState } from 'react'

export default function EditTeamsModal({ match, allPlayers, onSave, onCancel }) {
  const playerMap = Object.fromEntries(allPlayers.map(p => [p.id, p]))

  const [teamA, setTeamA] = useState([...match.teams.A])
  const [teamB, setTeamB] = useState([...match.teams.B])
  const [waiting, setWaiting] = useState([...match.waitingIds])
  const [moving, setMoving] = useState(null)

  function selectForMove(id, from) {
    if (moving && moving.id !== id) {
      swapPlayers(moving.id, moving.from, id, from)
      setMoving(null)
    } else {
      setMoving(moving?.id === id ? null : { id, from })
    }
  }

  function swapPlayers(id1, from1, id2, from2) {
    setTeamA(prev => {
      let arr = [...prev]
      if (from1 === 'A') arr = arr.filter(x => x !== id1)
      if (from2 === 'A') arr = arr.filter(x => x !== id2)
      if (from2 === 'A') arr = [...arr, id1]
      if (from1 === 'A') arr = [...arr, id2]
      return arr
    })
    setTeamB(prev => {
      let arr = [...prev]
      if (from1 === 'B') arr = arr.filter(x => x !== id1)
      if (from2 === 'B') arr = arr.filter(x => x !== id2)
      if (from2 === 'B') arr = [...arr, id1]
      if (from1 === 'B') arr = [...arr, id2]
      return arr
    })
    setWaiting(prev => {
      let arr = [...prev]
      if (from1 === 'waiting') arr = arr.filter(x => x !== id1)
      if (from2 === 'waiting') arr = arr.filter(x => x !== id2)
      if (from2 === 'waiting') arr = [...arr, id1]
      if (from1 === 'waiting') arr = [...arr, id2]
      return arr
    })
  }

  function renderPlayer(id, group) {
    const p = playerMap[id]
    if (!p) return null
    const isMoving = moving?.id === id
    return (
      <button
        key={id}
        onClick={() => selectForMove(id, group)}
        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left
                    transition-colors ${
          isMoving
            ? 'bg-amber-100 dark:bg-amber-900/40 border border-amber-300 dark:border-amber-600'
            : 'bg-stone-50 dark:bg-stone-700 border border-stone-200 dark:border-stone-600 hover:bg-stone-100 dark:hover:bg-stone-600'
        }`}
      >
        <span className="text-xs font-medium text-stone-600 dark:text-stone-300 flex-1 truncate">
          {p.name}
        </span>
        <span className="text-xs text-stone-400">{p.rating}</span>
        {isMoving && <span className="text-xs text-amber-600">→ mover</span>}
      </button>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50">
      <div className="bg-white dark:bg-stone-800 rounded-t-2xl w-full max-w-md
                      p-5 pb-10 max-h-[85vh] overflow-y-auto">

        <h2 className="text-base font-medium text-stone-800 dark:text-stone-100 mb-1">Editar times</h2>
        <p className="text-xs text-stone-400 mb-4">
          Toque em um jogador para selecioná-lo, depois toque em outro para trocá-los.
        </p>

        {moving && (
          <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700
                          rounded-lg px-3 py-2 text-xs text-amber-700 dark:text-amber-400 mb-4">
            Movendo: <strong>{playerMap[moving.id]?.name}</strong> — toque em outro jogador para trocar
          </div>
        )}

        <div className="space-y-4">
          <div>
            <h3 className="text-xs font-medium text-sage-dark mb-2">🟢 Time A</h3>
            <div className="space-y-1.5">
              {teamA.map(id => renderPlayer(id, 'A'))}
            </div>
          </div>
          <div>
            <h3 className="text-xs font-medium text-sky-700 mb-2">🔵 Time B</h3>
            <div className="space-y-1.5">
              {teamB.map(id => renderPlayer(id, 'B'))}
            </div>
          </div>
          {waiting.length > 0 && (
            <div>
              <h3 className="text-xs font-medium text-stone-400 mb-2">⏳ Aguardando</h3>
              <div className="space-y-1.5">
                {waiting.map(id => renderPlayer(id, 'waiting'))}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl border border-sand dark:border-stone-600
                       text-sm text-stone-600 dark:text-stone-300"
          >
            Cancelar
          </button>
          <button
            onClick={() => onSave({ A: teamA, B: teamB })}
            className="flex-1 py-3 rounded-xl bg-sage-dark text-white text-sm font-medium"
          >
            Salvar times
          </button>
        </div>

      </div>
    </div>
  )
}
