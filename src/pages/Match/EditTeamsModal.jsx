import { useState } from 'react'
import { swapPlayers } from '../../logic/balancing'

export default function EditTeamsModal({ title, slots, initialGroups, extraPool, onSave, onCancel }) {
  const [groups, setGroups] = useState(initialGroups.map(g => [...g]))
  const [pool, setPool]     = useState([...extraPool])
  const [moving, setMoving] = useState(null)

  function allById() {
    const map = {}
    ;[...groups.flat(), ...pool].forEach(p => { map[p.id] = p })
    return map
  }

  function select(id, groupIdx) {
    if (!moving) {
      setMoving({ id, groupIdx })
      return
    }
    if (moving.id === id) {
      setMoving(null)
      return
    }
    const result = swapPlayers({
      groups,
      pool,
      idA: moving.id,
      fromA: moving.groupIdx,
      idB: id,
      fromB: groupIdx,
    })
    setGroups(result.groups)
    setPool(result.pool)
    setMoving(null)
  }

  function renderPlayer(p, groupIdx) {
    if (!p) return null
    const isMoving = moving?.id === p.id
    return (
      <button
        key={p.id}
        onClick={() => select(p.id, groupIdx)}
        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg border text-left
                    transition-all ${
          isMoving
            ? 'bg-amber-50 dark:bg-amber-900/40 border-amber-300 dark:border-amber-600 ring-1 ring-amber-300 dark:ring-amber-600'
            : 'bg-stone-50 dark:bg-stone-700 border-stone-200 dark:border-stone-600 hover:bg-stone-100 dark:hover:bg-stone-600'
        }`}
      >
        <span className="text-sm text-stone-700 dark:text-stone-300 flex-1 truncate">{p.name}</span>
        {isMoving && <span className="text-xs text-amber-500 dark:text-amber-400 font-medium">mover →</span>}
      </button>
    )
  }

  const byId = allById()

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50">
      <div className="bg-white dark:bg-stone-800 rounded-t-2xl w-full max-w-md p-5 pb-10
                      max-h-[88vh] overflow-y-auto">

        <h2 className="text-base font-medium text-stone-800 dark:text-stone-100 mb-1">{title}</h2>
        <p className="text-xs text-stone-400 mb-4">
          Toque em um jogador para selecioná-lo, depois toque em outro para trocar.
        </p>

        {moving && (
          <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700
                          rounded-lg px-3 py-2 text-xs text-amber-700 dark:text-amber-400 mb-4">
            Movendo: <strong>{byId[moving.id]?.name}</strong> — toque em outro jogador para trocar
          </div>
        )}

        <div className="space-y-5">
          {groups.map((group, idx) => (
            <div key={idx}>
              <h3 className="text-xs font-medium text-stone-500 dark:text-stone-400 mb-2">
                {slots[idx] ?? `Grupo ${idx + 1}`}
              </h3>
              <div className="space-y-1.5">
                {group.map(p => renderPlayer(p, idx))}
                {group.length === 0 && (
                  <p className="text-xs text-stone-300 dark:text-stone-600 italic px-2 py-1">
                    Nenhum jogador
                  </p>
                )}
              </div>
            </div>
          ))}

          {pool.length > 0 && (
            <div>
              <h3 className="text-xs font-medium text-stone-400 dark:text-stone-500 mb-2">
                Outros jogadores
              </h3>
              <div className="space-y-1.5">
                {pool.map(p => renderPlayer(p, 'pool'))}
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
            onClick={() => onSave(groups, pool)}
            className="flex-1 py-3 rounded-xl bg-sage-dark text-white text-sm font-medium"
          >
            Salvar
          </button>
        </div>

      </div>
    </div>
  )
}
