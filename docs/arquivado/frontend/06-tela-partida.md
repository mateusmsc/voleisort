# 06 — Tela de Partida

Esta é a tela mais complexa do app. Ela mostra os times em campo, a fila de espera, e permite encerrar a partida selecionando o vencedor. Também permite editar os times manualmente e cancelar uma partida iniciada por engano.

---

## Estados da tela

A tela de partida tem três modos, controlados por estado local:

```
'playing'    → partida em andamento (tela principal)
'finishing'  → selecionar vencedor (modal/sobreposição)
'editing'    → editar times manualmente (drawer/modal)
```

---

## Componente principal (`src/pages/Match/Match.jsx`)

```jsx
import { useState, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMatchStore } from '../../store/useMatchStore'
import { useSessionStore } from '../../store/useSessionStore'
import { usePlayerStore } from '../../store/usePlayerStore'
import { buildChallenger, updateRoundsOut } from '../../logic/queue'
import { calculateRatingDeltas } from '../../logic/rating'
import { formTeams } from '../../logic/balancing'
import TeamCard from '../../components/TeamCard'
import WaitingQueue from './WaitingQueue'
import FinishMatchModal from './FinishMatchModal'
import EditTeamsModal from './EditTeamsModal'

export default function Match() {
  const { code, matchId } = useParams()
  const navigate = useNavigate()

  const match = useMatchStore(s => s.getMatch(matchId))
  const { finishMatch, cancelMatch, updateTeams, createMatch } = useMatchStore()
  const session = useSessionStore(s => s.getSessionByCode(code))
  const { addMatch } = useSessionStore()
  const { getPlayer, applyMatchResult } = usePlayerStore()

  const [mode, setMode] = useState('playing')  // 'playing' | 'finishing' | 'editing'

  // Resolver IDs em objetos Player
  const teamAPlayers = useMemo(
    () => match?.teams.A.map(id => getPlayer(id)).filter(Boolean) ?? [],
    [match, getPlayer]
  )
  const teamBPlayers = useMemo(
    () => match?.teams.B.map(id => getPlayer(id)).filter(Boolean) ?? [],
    [match, getPlayer]
  )
  const waitingPlayers = useMemo(
    () => match?.waitingIds.map(id => getPlayer(id)).filter(Boolean) ?? [],
    [match, getPlayer]
  )

  // Estado de rodadas fora (simplificado: baseado no número de partidas anteriores)
  const roundsOut = useMemo(() => {
    const allMatches = session
      ? useMatchStore.getState().getMatchesBySession(session.id)
      : []

    const counts = {}
    const allPresent = [...(match?.teams.A ?? []), ...(match?.teams.B ?? []), ...(match?.waitingIds ?? [])]

    for (const id of allPresent) {
      let count = 0
      for (const m of allMatches) {
        if (m.id === matchId) break
        const played = [...m.teams.A, ...m.teams.B]
        if (!played.includes(id)) count++
      }
      counts[id] = count
    }
    return counts
  }, [match, session, matchId])

  // ─── Ações ───────────────────────────────────────────────────────────────

  function handleFinish(winner) {
    // winner: 'A' | 'B'
    const winners = winner === 'A' ? teamAPlayers : teamBPlayers
    const losers  = winner === 'A' ? teamBPlayers : teamAPlayers

    // 1. Calcular e aplicar deltas de rating
    const deltas = calculateRatingDeltas(winners, losers)
    applyMatchResult(
      winners.map(p => p.id),
      losers.map(p => p.id),
      deltas
    )

    // 2. Marcar partida como finalizada
    finishMatch(matchId, winner)

    // 3. Montar próximo time desafiante
    const { challenger, newWaiting } = buildChallenger(
      winners,
      losers,
      waitingPlayers,
      roundsOut,
      session.config
    )

    // 4. Criar próxima partida automaticamente
    const nextRound = (match.round ?? 1) + 1
    const nextMatch = createMatch(
      session.id,
      nextRound,
      {
        A: winners.map(p => p.id),
        B: challenger.map(p => p.id),
      },
      newWaiting.map(p => p.id)
    )
    addMatch(session.id, nextMatch.id)

    navigate(`/session/${code}/match/${nextMatch.id}`)
  }

  function handleCancel() {
    cancelMatch(matchId)
    navigate(`/session/${code}/checkin`)
  }

  function handleSaveTeams(newTeams) {
    updateTeams(matchId, newTeams)
    setMode('playing')
  }

  if (!match) {
    return <div className="p-6 text-stone-400 text-center">Partida não encontrada.</div>
  }

  return (
    <div className="min-h-screen flex flex-col">

      {/* Header */}
      <div className="px-4 py-3 border-b border-stone-200 bg-stone-50
                      flex items-center justify-between sticky top-0">
        <div>
          <p className="text-xs text-stone-400">{session?.name} · {session?.code}</p>
          <h1 className="text-base font-medium text-stone-800">
            Partida {match.round}
          </h1>
        </div>
        <div className="flex items-center gap-1.5 bg-peach-light border border-peach
                        rounded-lg px-2.5 py-1 text-xs text-amber-700 font-medium">
          ● ao vivo
        </div>
      </div>

      <div className="flex-1 px-4 py-4 space-y-3 overflow-y-auto">

        {/* Time A */}
        <TeamCard
          label="Time A"
          color="sage"
          players={teamAPlayers}
        />

        {/* VS */}
        <div className="flex items-center gap-3 text-xs text-stone-300">
          <div className="flex-1 h-px bg-stone-200" />
          <span>vs</span>
          <div className="flex-1 h-px bg-stone-200" />
        </div>

        {/* Time B */}
        <TeamCard
          label="Time B"
          color="sky"
          players={teamBPlayers}
        />

        {/* Fila de espera */}
        <WaitingQueue players={waitingPlayers} roundsOut={roundsOut} />

      </div>

      {/* Ações */}
      <div className="px-4 py-3 border-t border-stone-200 bg-stone-50 space-y-2">
        <div className="flex gap-2">
          <button
            onClick={() => setMode('finishing')}
            className="flex-2 flex-1 bg-sage-dark text-white rounded-xl
                       py-3 text-sm font-medium"
          >
            Encerrar partida
          </button>
          <button
            onClick={() => setMode('editing')}
            className="px-4 py-3 bg-white border border-sand rounded-xl
                       text-sm text-stone-600"
          >
            ✏️ Editar
          </button>
        </div>
        <button
          onClick={handleCancel}
          className="w-full py-2 text-xs text-stone-400 underline"
        >
          Cancelar partida (iniciada por engano)
        </button>
      </div>

      {/* Modal: selecionar vencedor */}
      {mode === 'finishing' && (
        <FinishMatchModal
          teamAPlayers={teamAPlayers}
          teamBPlayers={teamBPlayers}
          onConfirm={handleFinish}
          onCancel={() => setMode('playing')}
        />
      )}

      {/* Modal: editar times */}
      {mode === 'editing' && (
        <EditTeamsModal
          match={match}
          allPlayers={[...teamAPlayers, ...teamBPlayers, ...waitingPlayers]}
          onSave={handleSaveTeams}
          onCancel={() => setMode('playing')}
        />
      )}
    </div>
  )
}
```

---

## Modal de seleção do vencedor (`src/pages/Match/FinishMatchModal.jsx`)

Esta é a resposta à pergunta original: **é aqui que o usuário escolhe qual time venceu.**

O fluxo é:
1. Usuário clica em "Encerrar partida"
2. Modal abre com os dois times lado a lado
3. Usuário toca no time vencedor (card fica destacado)
4. Confirma — ratings são atualizados e próxima partida é gerada

```jsx
import { useState } from 'react'
import { teamAverage } from '../../logic/balancing'

export default function FinishMatchModal({ teamAPlayers, teamBPlayers, onConfirm, onCancel }) {
  const [selected, setSelected] = useState(null)  // 'A' | 'B' | null

  const avgA = teamAverage(teamAPlayers)
  const avgB = teamAverage(teamBPlayers)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50">
      <div className="bg-white rounded-t-2xl w-full max-w-md p-5 pb-10">

        <h2 className="text-base font-medium text-stone-800 mb-1 text-center">
          Quem venceu?
        </h2>
        <p className="text-xs text-stone-400 text-center mb-5">
          Selecione o time vencedor para atualizar os ratings
        </p>

        {/* Times para seleção */}
        <div className="grid grid-cols-2 gap-3 mb-5">

          {/* Time A */}
          <button
            onClick={() => setSelected('A')}
            className={`rounded-xl border-2 p-3 text-left transition-all ${
              selected === 'A'
                ? 'border-sage-dark bg-sage-light'
                : 'border-stone-200 bg-stone-50'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs font-medium ${
                selected === 'A' ? 'text-sage-dark' : 'text-stone-400'
              }`}>
                🟢 Time A
              </span>
              {selected === 'A' && (
                <span className="text-xs bg-sage-dark text-white
                                 rounded-full px-2 py-0.5">
                  ✓ Vencedor
                </span>
              )}
            </div>
            <div className="text-xs text-stone-500 mb-2">Média: {avgA}</div>
            <div className="space-y-1">
              {teamAPlayers.map(p => (
                <div key={p.id} className="text-xs text-stone-600 truncate">
                  {p.name}
                </div>
              ))}
            </div>
          </button>

          {/* Time B */}
          <button
            onClick={() => setSelected('B')}
            className={`rounded-xl border-2 p-3 text-left transition-all ${
              selected === 'B'
                ? 'border-sky border-sky-500 bg-sky-light'
                : 'border-stone-200 bg-stone-50'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs font-medium ${
                selected === 'B' ? 'text-sky-700' : 'text-stone-400'
              }`}>
                🔵 Time B
              </span>
              {selected === 'B' && (
                <span className="text-xs bg-sky text-sky-900
                                 rounded-full px-2 py-0.5">
                  ✓ Vencedor
                </span>
              )}
            </div>
            <div className="text-xs text-stone-500 mb-2">Média: {avgB}</div>
            <div className="space-y-1">
              {teamBPlayers.map(p => (
                <div key={p.id} className="text-xs text-stone-600 truncate">
                  {p.name}
                </div>
              ))}
            </div>
          </button>

        </div>

        {/* Preview dos deltas de rating (opcional, nice-to-have) */}
        {selected && (
          <div className="bg-stone-50 rounded-xl p-3 mb-4 text-xs text-stone-500 text-center">
            Vencedores ganham ~+2 pts · Perdedores perdem ~−1 pt
          </div>
        )}

        {/* Botões */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl border border-sand text-sm text-stone-600"
          >
            Voltar
          </button>
          <button
            onClick={() => selected && onConfirm(selected)}
            disabled={!selected}
            className="flex-1 py-3 rounded-xl bg-sage-dark text-white
                       text-sm font-medium disabled:opacity-40"
          >
            Confirmar →
          </button>
        </div>

      </div>
    </div>
  )
}
```

---

## Modal de edição de times (`src/pages/Match/EditTeamsModal.jsx`)

Permite mover jogadores entre Time A, Time B e Aguardando via drag-and-drop simples (trocar por toque).

```jsx
import { useState } from 'react'

export default function EditTeamsModal({ match, allPlayers, onSave, onCancel }) {
  const playerMap = Object.fromEntries(allPlayers.map(p => [p.id, p]))

  const [teamA, setTeamA] = useState([...match.teams.A])
  const [teamB, setTeamB] = useState([...match.teams.B])
  const [waiting, setWaiting] = useState([...match.waitingIds])
  const [moving, setMoving] = useState(null)  // { id, from: 'A'|'B'|'waiting' }

  function selectForMove(id, from) {
    if (moving && moving.id !== id) {
      // Trocar os dois jogadores de lugar
      moveTo(moving.id, moving.from, from)
      moveTo(id, from, moving.from)
      setMoving(null)
    } else {
      setMoving(moving?.id === id ? null : { id, from })
    }
  }

  function moveTo(id, from, to) {
    const remove = (arr) => arr.filter(x => x !== id)
    if (from === 'A') setTeamA(prev => remove(prev))
    if (from === 'B') setTeamB(prev => remove(prev))
    if (from === 'waiting') setWaiting(prev => remove(prev))

    if (to === 'A') setTeamA(prev => [...prev, id])
    if (to === 'B') setTeamB(prev => [...prev, id])
    if (to === 'waiting') setWaiting(prev => [...prev, id])
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
            ? 'bg-amber-100 border border-amber-300'
            : 'bg-stone-50 border border-stone-200 hover:bg-stone-100'
        }`}
      >
        <span className="text-xs font-medium text-stone-600 flex-1 truncate">
          {p.name}
        </span>
        <span className="text-xs text-stone-400">{p.rating}</span>
        {isMoving && <span className="text-xs text-amber-600">→ mover</span>}
      </button>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50">
      <div className="bg-white rounded-t-2xl w-full max-w-md p-5 pb-10 max-h-[85vh]
                      overflow-y-auto">

        <h2 className="text-base font-medium text-stone-800 mb-1">Editar times</h2>
        <p className="text-xs text-stone-400 mb-4">
          Toque em um jogador para selecioná-lo, depois toque em outro para trocá-los.
        </p>

        {moving && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2
                          text-xs text-amber-700 mb-4">
            Movendo: <strong>{playerMap[moving.id]?.name}</strong> — toque em outro jogador para trocar
          </div>
        )}

        <div className="space-y-4">
          {/* Time A */}
          <div>
            <h3 className="text-xs font-medium text-sage-dark mb-2">🟢 Time A</h3>
            <div className="space-y-1.5">
              {teamA.map(id => renderPlayer(id, 'A'))}
            </div>
          </div>

          {/* Time B */}
          <div>
            <h3 className="text-xs font-medium text-sky-700 mb-2">🔵 Time B</h3>
            <div className="space-y-1.5">
              {teamB.map(id => renderPlayer(id, 'B'))}
            </div>
          </div>

          {/* Aguardando */}
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
            className="flex-1 py-3 rounded-xl border border-sand text-sm text-stone-600"
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
```

---

## Componente TeamCard (`src/components/TeamCard.jsx`)

```jsx
import { teamAverage } from '../logic/balancing'

export default function TeamCard({ label, color, players }) {
  const avg = teamAverage(players)
  const colors = {
    sage: { border: 'border-sage', label: 'text-sage-dark', dot: '🟢' },
    sky:  { border: 'border-sky',  label: 'text-sky-700',   dot: '🔵' },
  }
  const c = colors[color] ?? colors.sage

  return (
    <div className={`bg-white rounded-xl border-2 ${c.border} p-3`}>
      <div className="flex items-center justify-between mb-2.5">
        <span className={`text-xs font-medium ${c.label}`}>
          {c.dot} {label}
        </span>
        <span className="text-xs text-stone-400">Média: {avg}</span>
      </div>
      <div className="space-y-1.5">
        {players.map(p => (
          <div key={p.id} className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-sage flex items-center justify-center
                            text-sage-dark text-xs font-medium flex-shrink-0">
              {p.name[0]}
            </div>
            <span className="text-sm text-stone-700 flex-1 truncate">{p.name}</span>
            <span className="text-xs text-stone-400">{p.rating}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

---

## Componente WaitingQueue (`src/pages/Match/WaitingQueue.jsx`)

```jsx
export default function WaitingQueue({ players, roundsOut }) {
  if (players.length === 0) return null

  return (
    <div className="bg-sand-light rounded-xl p-3">
      <h3 className="text-xs font-medium text-stone-400 uppercase tracking-wide mb-2">
        ⏳ Aguardando
      </h3>
      <div className="flex flex-wrap gap-2">
        {players.map(p => {
          const out = roundsOut[p.id] ?? 0
          return (
            <div
              key={p.id}
              className="flex items-center gap-1.5 bg-white border border-sand
                         rounded-full px-2.5 py-1 text-xs text-stone-600"
            >
              {p.name.split(' ')[0]}
              {out > 0 && (
                <span className="bg-peach text-amber-800 rounded-full
                                 px-1.5 py-0.5 text-xs font-medium">
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
```
