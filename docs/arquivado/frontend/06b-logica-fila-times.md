# 06b — Lógica da Fila de Próximos Times

## Conceito

Com 22 jogadores e times de 6, a tela de partida exibe **sempre todos os times montados de antemão**:

```
[ Time A ] vs [ Time B ]     ← em campo agora
[ 1ª próxima ]               ← próximo desafiante
[ 2ª próxima ]               ← depois
[ 3ª próxima ]               ← depois
```

Os próximos times já são calculados no check-in e **atualizados automaticamente** após cada partida. O usuário pode editá-los manualmente a qualquer momento.

---

## Regras de montagem da fila

### 1. Formação inicial (no check-in)

Com N jogadores e times de tamanho T:

- Dois times completos vão a campo (2T jogadores)
- Os restantes (N − 2T) são distribuídos nas "próximas" em grupos de T pelo algoritmo cobra
- O último grupo pode ter menos que T → **time incompleto**

**Exemplo: 22 jogadores, times de 6**
```
Em campo:    12 → Time A (6) + Time B (6)
Próximas:    10 → 1ª próxima (6) + 2ª próxima (4 — incompleto)
```

### 2. Após uma partida (ex: Time A vence)

```
Antes:
  Em campo:   Time A (vencedor) · Time B (perdedor)
  1ª próxima: [6 completo]
  2ª próxima: [4 incompleto]

Passo 1 — 1ª próxima entra como novo Time B
Passo 2 — Disponíveis: 6 perdedores + 2ª próxima (4) = 10 jogadores
Passo 3 — Remontar fila com os 10:
  Nova 1ª próxima: 6 jogadores (equilibrado)
  Nova 2ª próxima: 4 restantes

Resultado final:
  Em campo:   Time A · ex-1ª próxima
  1ª próxima: [6]
  2ª próxima: [4]
```

### 3. Completar time incompleto

Quando a próxima da fila tem menos de T jogadores:
1. Busca complemento nos perdedores, priorizando quem está há mais partidas fora
2. Os perdedores não escolhidos formam a nova fila

---

## Estrutura de dados — `nextTeams`

Campo adicionado ao modelo `Match`:

```js
{
  "id": "match-uuid",
  "teams": { "A": [...ids], "B": [...ids] },
  "nextTeams": [
    ["id1", "id2", "id3", "id4", "id5", "id6"],   // 1ª próxima (completo)
    ["id7", "id8", "id9", "id10"],                  // 2ª próxima (incompleto)
  ],
  ...
}
```

---

## Algoritmo (`src/logic/queue.js` — atualizado)

```js
/**
 * Distribui todos os jogadores presentes em: campo + fila de próximas.
 */
export function distributeAllPlayers(allPlayers, teamSize) {
  const sorted = [...allPlayers].sort((a, b) => b.rating - a.rating)
  const inField = sorted.slice(0, teamSize * 2)
  const rest    = sorted.slice(teamSize * 2)

  const { teamA, teamB } = snakeDraft(inField, teamSize)
  const nextTeams = buildNextQueue(rest, teamSize)

  return { teamA, teamB, nextTeams }
}

/**
 * Divide jogadores em chunks de teamSize (último pode ser menor).
 */
export function buildNextQueue(players, teamSize) {
  if (players.length === 0) return []
  const groups = []
  for (let i = 0; i < players.length; i += teamSize) {
    groups.push(players.slice(i, i + teamSize))
  }
  return groups
}

/**
 * Snake draft: A, B, B, A, A, B, B, A...
 * Entrada deve estar ordenada por rating desc.
 */
export function snakeDraft(players, teamSize) {
  const teamA = []
  const teamB = []
  players.slice(0, teamSize * 2).forEach((player, i) => {
    const group   = Math.floor(i / 2)
    const isEven  = group % 2 === 0
    const isFirst = i % 2 === 0
    ;(isEven ? isFirst : !isFirst) ? teamA.push(player) : teamB.push(player)
  })
  return { teamA, teamB }
}

/**
 * Recalcula a fila após uma partida.
 *
 * @param {Player[]}   winners        - ficam em campo
 * @param {Player[]}   losers         - saem do campo
 * @param {Player[][]} currentNext    - fila atual (objetos Player)
 * @param {number}     teamSize
 * @param {object}     roundsOut      - { [id]: partidas sem jogar }
 * @param {number}     maxRoundsOut
 */
export function advanceQueue(winners, losers, currentNext, teamSize, roundsOut, maxRoundsOut) {
  const [firstNext = [], ...remainingNext] = currentNext

  // Pool = perdedores + próximas restantes
  const pool = [...losers, ...remainingNext.flat()]

  // 1ª próxima vira o novo oponente; completar se faltar gente
  let newOpponent = [...firstNext]
  const missing = teamSize - newOpponent.length

  let leftover = [...pool]

  if (missing > 0 && pool.length > 0) {
    const winAvg = avg(winners)

    // Ordenar pool por urgência, depois por encaixe de rating
    const sorted = [...pool].sort((a, b) => {
      const aUrgent = (roundsOut[a.id] ?? 0) >= maxRoundsOut
      const bUrgent = (roundsOut[b.id] ?? 0) >= maxRoundsOut
      if (aUrgent !== bUrgent) return aUrgent ? -1 : 1
      const target = winAvg
      return Math.abs(a.rating - target) - Math.abs(b.rating - target)
    })

    const chosen = sorted.slice(0, missing)
    newOpponent = [...newOpponent, ...chosen]

    const chosenIds = new Set(chosen.map(p => p.id))
    leftover = pool.filter(p => !chosenIds.has(p.id))
  }

  const newNextTeams = buildNextQueue(
    leftover.sort((a, b) => b.rating - a.rating),
    teamSize
  )

  return { newOpponent, newNextTeams }
}

function avg(players) {
  if (!players.length) return 0
  return Math.round(players.reduce((s, p) => s + p.rating, 0) / players.length)
}
```

---

## Atualização do `useMatchStore`

```js
// Assinatura atualizada de createMatch
createMatch(sessionId, round, teams, nextTeams = []) {
  const match = {
    id: uuid(),
    sessionId,
    round,
    status: 'ongoing',
    teams,
    nextTeams,       // ← novo campo
    winner: null,
    startedAt: new Date().toISOString(),
    finishedAt: null,
  }
  set(state => ({ matches: { ...state.matches, [match.id]: match } }))
  return match
},

// Nova ação para edição manual da fila
updateNextTeams(matchId, nextTeams) {
  set(state => ({
    matches: {
      ...state.matches,
      [matchId]: { ...state.matches[matchId], nextTeams },
    },
  }))
},
```

---

## Fluxo no `handleFinish` (Match.jsx)

```js
function handleFinish(winner) {
  const winners = winner === 'A' ? teamAPlayers : teamBPlayers
  const losers  = winner === 'A' ? teamBPlayers : teamAPlayers

  // 1. Ratings
  const deltas = calculateRatingDeltas(winners, losers)
  applyMatchResult(winners.map(p => p.id), losers.map(p => p.id), deltas)
  finishMatch(matchId, winner)

  // 2. Hidratar nextTeams em objetos Player
  const currentNextPlayers = match.nextTeams.map(team =>
    team.map(id => getPlayer(id)).filter(Boolean)
  )

  // 3. Avançar fila
  const { newOpponent, newNextTeams } = advanceQueue(
    winners, losers, currentNextPlayers,
    session.config.teamSize, roundsOut, session.config.maxRoundsOut
  )

  // 4. Criar próxima partida com a fila recalculada
  const nextMatch = createMatch(
    session.id,
    (match.round ?? 1) + 1,
    { A: winners.map(p => p.id), B: newOpponent.map(p => p.id) },
    newNextTeams.map(team => team.map(p => p.id))
  )
  addMatch(session.id, nextMatch.id)
  navigate(`/session/${code}/match/${nextMatch.id}`)
}
```
