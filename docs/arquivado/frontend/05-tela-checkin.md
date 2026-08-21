# 05 — Tela de Check-in

O check-in marca quais jogadores estão presentes na sessão do dia. Jogadores já cadastrados aparecem na lista. É possível adicionar novos jogadores diretamente desta tela.

---

## Componente (`src/pages/Checkin/Checkin.jsx`)

```jsx
import { useState, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useSessionStore } from '../../store/useSessionStore'
import { usePlayerStore } from '../../store/usePlayerStore'
import { useMatchStore } from '../../store/useMatchStore'
import { formTeams } from '../../logic/balancing'
import PlayerRow from '../../components/PlayerRow'
import AddPlayerModal from './AddPlayerModal'

export default function Checkin() {
  const { code } = useParams()
  const navigate = useNavigate()

  const session = useSessionStore(s => s.getSessionByCode(code))
  const { getAllPlayers, addPlayer } = usePlayerStore()
  const { setCheckedIn, addPlayerToSession, addMatch } = useSessionStore()
  const createMatch = useMatchStore(s => s.createMatch)

  const [search, setSearch] = useState('')
  const [checkedIn, setCheckedInLocal] = useState(
    new Set(session?.checkedInIds ?? [])
  )
  const [showAddModal, setShowAddModal] = useState(false)

  const allPlayers = getAllPlayers()

  // Jogadores que já pertencem a esta sessão aparecem primeiro
  const sessionPlayerIds = new Set(session?.playerIds ?? [])
  const sorted = useMemo(() => {
    return [...allPlayers].sort((a, b) => {
      const aIn = sessionPlayerIds.has(a.id) ? 0 : 1
      const bIn = sessionPlayerIds.has(b.id) ? 0 : 1
      return aIn - bIn || a.name.localeCompare(b.name)
    })
  }, [allPlayers])

  const filtered = sorted.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  function toggleCheckin(playerId) {
    setCheckedInLocal(prev => {
      const next = new Set(prev)
      next.has(playerId) ? next.delete(playerId) : next.add(playerId)
      return next
    })
  }

  function handleAddNewPlayer(name) {
    const id = addPlayer(name)
    addPlayerToSession(session.id, id)
    setCheckedInLocal(prev => new Set([...prev, id]))
    setShowAddModal(false)
  }

  function handleStartMatch() {
    const presentPlayers = allPlayers.filter(p => checkedIn.has(p.id))

    // Persistir check-in no store
    setCheckedIn(session.id, [...checkedIn])

    // Formar times e criar primeira partida
    const { teamA, teamB, waiting } = formTeams(
      presentPlayers,
      session.config.teamSize
    )

    const match = createMatch(
      session.id,
      1,
      { A: teamA.map(p => p.id), B: teamB.map(p => p.id) },
      waiting.map(p => p.id)
    )
    addMatch(session.id, match.id)

    navigate(`/session/${code}/match/${match.id}`)
  }

  if (!session) {
    return (
      <div className="p-6 text-center text-stone-500">
        Sessão não encontrada.
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-stone-200 bg-stone-50
                      flex items-center justify-between sticky top-0">
        <div>
          <p className="text-xs text-stone-400">{session.name}</p>
          <h1 className="text-base font-medium text-stone-800">Check-in</h1>
        </div>
        <div className="flex items-center gap-1.5 bg-sage-light border border-sage
                        rounded-lg px-2.5 py-1 text-xs text-sage-dark font-medium">
          🔑 {session.code}
        </div>
      </div>

      {/* Busca */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-2 bg-white border border-sand
                        rounded-xl px-3 py-2 text-sm text-stone-400">
          🔍
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar jogador..."
            className="flex-1 bg-transparent outline-none text-stone-700"
          />
        </div>
      </div>

      {/* Lista de jogadores */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
        {filtered.map(player => (
          <PlayerRow
            key={player.id}
            player={player}
            checked={checkedIn.has(player.id)}
            onToggle={() => toggleCheckin(player.id)}
          />
        ))}

        {/* Botão adicionar novo */}
        <button
          onClick={() => setShowAddModal(true)}
          className="w-full py-3 border border-dashed border-sand rounded-xl
                     text-sm text-stone-400 flex items-center justify-center gap-2"
        >
          + Adicionar novo jogador
        </button>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-stone-200 bg-stone-50
                      flex items-center justify-between">
        <p className="text-sm text-stone-500">
          <span className="font-medium text-stone-700">{checkedIn.size}</span> presentes
        </p>
        <button
          onClick={handleStartMatch}
          disabled={checkedIn.size < session.config.teamSize * 2}
          className="bg-sage-dark text-white text-sm font-medium
                     rounded-xl px-4 py-2.5 disabled:opacity-40"
        >
          Formar times →
        </button>
      </div>

      {/* Modal de novo jogador */}
      {showAddModal && (
        <AddPlayerModal
          onConfirm={handleAddNewPlayer}
          onCancel={() => setShowAddModal(false)}
        />
      )}
    </div>
  )
}
```

---

## Componente PlayerRow (`src/components/PlayerRow.jsx`)

Reutilizado no check-in e em outros lugares:

```jsx
export default function PlayerRow({ player, checked, onToggle }) {
  const initials = player.name
    .split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase()

  const winRate = player.stats.matches > 0
    ? Math.round((player.stats.wins / player.stats.matches) * 100)
    : null

  return (
    <div
      onClick={onToggle}
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 border cursor-pointer
                  transition-colors select-none ${
        checked
          ? 'bg-sage-light border-sage'
          : 'bg-white border-stone-200'
      }`}
    >
      {/* Avatar */}
      <div className="w-9 h-9 rounded-full bg-sage flex items-center justify-center
                      text-sage-dark text-xs font-medium flex-shrink-0">
        {initials}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-stone-800 truncate">{player.name}</p>
        <p className="text-xs text-stone-400">
          {player.stats.matches === 0
            ? 'Novo jogador'
            : `${player.stats.matches} partidas · ${winRate}% vitórias`}
        </p>
      </div>

      {/* Rating */}
      <div className={`text-xs font-medium px-2 py-1 rounded-md border ${
        player.rating >= 70
          ? 'bg-sage-light border-sage text-sage-dark'
          : 'bg-sand-light border-sand text-stone-500'
      }`}>
        {player.rating}
      </div>

      {/* Checkbox */}
      <div className={`w-5 h-5 rounded-full border flex items-center justify-center
                       flex-shrink-0 ${
        checked
          ? 'bg-sage-dark border-sage-dark text-white text-xs'
          : 'border-sand bg-white'
      }`}>
        {checked && '✓'}
      </div>
    </div>
  )
}
```

---

## Modal de novo jogador (`src/pages/Checkin/AddPlayerModal.jsx`)

```jsx
import { useState } from 'react'

export default function AddPlayerModal({ onConfirm, onCancel }) {
  const [name, setName] = useState('')

  return (
    // Fundo escurecido
    <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50">
      <div className="bg-white rounded-t-2xl w-full max-w-md p-6 pb-10">
        <h2 className="text-base font-medium text-stone-800 mb-4">
          Adicionar jogador
        </h2>

        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && name.trim() && onConfirm(name.trim())}
          placeholder="Nome do jogador"
          autoFocus
          className="w-full bg-stone-50 border border-sand rounded-xl px-3 py-2.5
                     text-base text-stone-700 mb-4 focus:outline-none focus:border-sage"
        />

        <p className="text-xs text-stone-400 mb-5">
          Rating inicial: 50. Pode ser ajustado no perfil do jogador depois.
        </p>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-sand
                       text-sm text-stone-600"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(name.trim())}
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
```
