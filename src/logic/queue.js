import { DEFAULT_LEVEL, HIGH_LEVEL_THRESHOLD } from '../utils/levels.js'

export function levelSpreadDraft(allPlayers, teamSize, rng = Math.random) {
  const numGroups = Math.max(2, Math.ceil(allPlayers.length / teamSize))
  const groups    = Array.from({ length: numGroups }, () => [])

  // Agrupa jogadores por nível (normaliza undefined/null para DEFAULT_LEVEL)
  const byLevel = new Map()
  for (const player of allPlayers) {
    const lvl = player.level ?? DEFAULT_LEVEL
    if (!byLevel.has(lvl)) byLevel.set(lvl, [])
    byLevel.get(lvl).push(player)
  }

  // Ordena níveis do mais alto para o mais baixo
  const sortedLevels = [...byLevel.keys()].sort((a, b) => b - a)

  for (const lvl of sortedLevels) {
    const players = byLevel.get(lvl)

    // Fisher-Yates: variar a ordem DENTRO do nível entre sessões.
    // Jogadores do mesmo nível são intercambiáveis para balanceamento,
    // então médias e contagens por grupo permanecem idênticas.
    for (let i = players.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      ;[players[i], players[j]] = [players[j], players[i]]
    }

    // Round-robin por nível: distribui cada nível entre os grupos.
    // Critério de escolha do grupo destino (em ordem de prioridade):
    //   1. Menor contagem deste nível no grupo (espalhamento)
    //   2. Menor índice do grupo (desempate: campo tem prioridade)
    // Respeitando a capacidade máxima de teamSize por grupo.
    for (const player of players) {
      let bestGroup    = -1
      let bestLvlCount = Infinity

      for (let g = 0; g < numGroups; g++) {
        if (groups[g].length >= teamSize) continue

        const lvlCount = groups[g].filter(p => (p.level ?? DEFAULT_LEVEL) === lvl).length

        const better =
          bestGroup === -1 ||
          lvlCount < bestLvlCount ||
          (lvlCount === bestLvlCount && g < bestGroup)

        if (better) {
          bestGroup    = g
          bestLvlCount = lvlCount
        }
      }

      // Fallback: se todos os grupos estão cheios (não deve ocorrer), adiciona ao último
      if (bestGroup === -1) bestGroup = numGroups - 1
      groups[bestGroup].push(player)
    }
  }

  return {
    teamA:     groups[0],
    teamB:     groups[1],
    nextTeams: groups.slice(2),
  }
}

export function distributeAllPlayers(allPlayers, teamSize) {
  const { teamA, teamB, nextTeams } = levelSpreadDraft(allPlayers, teamSize)
  const rebalancedNext = rebalanceHighLevelPlayers(teamA, teamB, nextTeams, {})
  return { teamA, teamB, nextTeams: rebalancedNext }
}

export function buildNextQueue(players, teamSize) {
  if (players.length === 0) return []
  const groups = []
  for (let i = 0; i < players.length; i += teamSize) {
    groups.push(players.slice(i, i + teamSize))
  }
  return groups
}

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

export function advanceQueue(winners, losers, currentNext, teamSize, roundsOut, maxRoundsOut) {
  const [firstNext = [], ...remainingNext] = currentNext

  // Quem já estava esperando nas próximas seguintes mantém prioridade sobre os losers.
  // A fila é FIFO: remainingNext vem antes dos losers.
  // Se firstNext está incompleto, completa usando remainingNext (por roundsOut/FIFO),
  // nunca usando losers para completar — losers sempre vão para o final.

  let newOpponent = [...firstNext]
  const missing = teamSize - newOpponent.length

  // Fila restante: remainingNext flat (mantém ordem de chegada)
  let queueFlat = remainingNext.flat()

  if (missing > 0 && queueFlat.length > 0) {
    // Completa o time com jogadores da fila existente, priorizando roundsOut
    const candidates = queueFlat.map((p, idx) => ({ ...p, queueIdx: idx }))
    candidates.sort((a, b) => {
      const aUrgent = (roundsOut[a.id] ?? 0) >= maxRoundsOut
      const bUrgent = (roundsOut[b.id] ?? 0) >= maxRoundsOut
      if (aUrgent !== bUrgent) return aUrgent ? -1 : 1
      // Em empate: ordem de chegada na fila (FIFO)
      return a.queueIdx - b.queueIdx
    })

    const chosen = candidates.slice(0, missing)
    newOpponent = [...newOpponent, ...chosen]

    const chosenIds = new Set(chosen.map(p => p.id))
    queueFlat = queueFlat.filter(p => !chosenIds.has(p.id))
  } else if (missing > 0 && queueFlat.length === 0 && losers.length > 0) {
    // Fila vazia: completa o time com losers (priorizando roundsOut)
    const candidates = [...losers].map((p, idx) => ({ ...p, queueIdx: idx }))
    candidates.sort((a, b) => {
      const aUrgent = (roundsOut[a.id] ?? 0) >= maxRoundsOut
      const bUrgent = (roundsOut[b.id] ?? 0) >= maxRoundsOut
      if (aUrgent !== bUrgent) return aUrgent ? -1 : 1
      return a.queueIdx - b.queueIdx
    })

    const chosen = candidates.slice(0, missing)
    newOpponent = [...newOpponent, ...chosen]

    const chosenIds = new Set(chosen.map(p => p.id))
    // Losers não escolhidos vão para a fila, na ordem original
    const leftoverLosers = losers.filter(p => !chosenIds.has(p.id))
    const newNextTeams = buildNextQueue(leftoverLosers, teamSize)
    return { newOpponent, newNextTeams }
  }

  // Monta a nova fila: primeiro os que já estavam esperando, depois os losers
  const newQueuePlayers = [...queueFlat, ...losers]
  const newNextTeams = buildNextQueue(newQueuePlayers, teamSize)

  return { newOpponent, newNextTeams }
}

/**
 * promoteNextTeam — feature "Subir a próxima"
 *
 * Troca o time do lado `side` ('A'|'B') pela 1ª próxima, SEM registrar
 * derrota. O time que sai tem seus jogadores redistribuídos individualmente
 * para o FINAL da fila; a fila é remontada em chunks de teamSize.
 *
 * @returns {{ teamA: string[], teamB: string[], nextTeams: string[][] } | null}
 *          null se não há 1ª próxima ou o lado é inválido.
 */
export function promoteNextTeam({ teamA, teamB, nextTeams, side, teamSize }) {
  if (!nextTeams || nextTeams.length === 0) return null
  if (side !== 'A' && side !== 'B') return null

  const [incoming = [], ...remainingNext] = nextTeams

  const newTeamA = side === 'A' ? [...incoming] : [...teamA]
  const newTeamB = side === 'B' ? [...incoming] : [...teamB]

  const outgoing = side === 'A' ? teamA : teamB
  const queueFlat = [...remainingNext.flat(), ...outgoing]

  return { teamA: newTeamA, teamB: newTeamB, nextTeams: buildNextQueue(queueFlat, teamSize) }
}

/**
 * swapWithNextTeam — feature "Trocar com a próxima"
 *
 * Diferente de promoteNextTeam: troca DIRETA de lugares. O time do lado
 * `side` ('A'|'B') sai de quadra e ASSUME a posição de 1ª próxima; a 1ª
 * próxima entra em campo no lugar dele. As demais próximas mantêm a ordem.
 *
 * @returns {{ teamA: string[], teamB: string[], nextTeams: string[][] } | null}
 *          null se não há 1ª próxima ou o lado é inválido.
 */
export function swapWithNextTeam({ teamA, teamB, nextTeams, side }) {
  if (!nextTeams || nextTeams.length === 0) return null
  if (side !== 'A' && side !== 'B') return null

  const [incoming = [], ...remainingNext] = nextTeams
  const outgoing = side === 'A' ? teamA : teamB

  const newTeamA = side === 'A' ? [...incoming] : [...teamA]
  const newTeamB = side === 'B' ? [...incoming] : [...teamB]

  return { teamA: newTeamA, teamB: newTeamB, nextTeams: [[...outgoing], ...remainingNext] }
}

export function updateRoundsOut(allCheckedInIds, playingNowIds, currentRoundsOut) {  const updated = {}
  for (const id of allCheckedInIds) {
    if (playingNowIds.includes(id)) {
      updated[id] = 0
    } else {
      updated[id] = (currentRoundsOut[id] ?? 0) + 1
    }
  }
  return updated
}

// ---------------------------------------------------------------------------
// rebalanceHighLevelPlayers — Fase 4
//
// Corrige concentração de alto nível na fila após advanceQueue (FIFO puro).
// Tenta mover um jogador de alto nível da 2ª+ próxima para a 1ª próxima
// quando a 1ª não tem nenhum, trocando com o jogador de menor nível dela.
//
// Pré-condições para qualquer troca:
//   1. Ambos teamA e teamB têm >= 1 jogador com level >= threshold
//   2. A 1ª próxima NÃO tem nenhum jogador com level >= threshold
//   3. Existe uma 2ª+ próxima com candidato (level >= threshold, roundsOut < 2)
//
// Critério de aceitação da troca (Opção A):
//   A diferença de médias entre a 1ª próxima resultante e a média dos times
//   em campo não deve aumentar em relação à diferença atual.
// ---------------------------------------------------------------------------
export function rebalanceHighLevelPlayers(
  teamA,
  teamB,
  nextTeams,
  roundsOut,
  threshold = HIGH_LEVEL_THRESHOLD,
) {
  if (nextTeams.length < 2) return nextTeams

  const isHigh = p => (p.level ?? DEFAULT_LEVEL) >= threshold

  // Pré-condição 1: ambos os times em campo têm >= 1 alto nível
  if (!teamA.some(isHigh) || !teamB.some(isHigh)) return nextTeams

  const [first, ...rest] = nextTeams

  // Pré-condição 2: 1ª próxima não tem nenhum alto nível
  if (first.some(isHigh)) return nextTeams

  // Média dos times em campo (referência de equilíbrio)
  const allField  = [...teamA, ...teamB]
  const fieldAvg  = allField.reduce((s, p) => s + (p.level ?? DEFAULT_LEVEL), 0) / allField.length
  const firstAvg  = () => first.reduce((s, p) => s + (p.level ?? DEFAULT_LEVEL), 0) / first.length
  const currentDiff = Math.abs(firstAvg() - fieldAvg)

  // Busca o melhor candidato na 2ª+ próxima: alto nível, roundsOut < 2
  let candidatePlayer = null
  let candidateGroupIdx = -1   // índice em `rest` (0 = 2ª próxima original)

  for (let gi = 0; gi < rest.length; gi++) {
    for (const p of rest[gi]) {
      if (!isHigh(p)) continue
      if ((roundsOut[p.id] ?? 0) >= 2) continue
      candidatePlayer   = p
      candidateGroupIdx = gi
      break
    }
    if (candidatePlayer) break
  }

  // Pré-condição 3: existe candidato elegível
  if (!candidatePlayer) return nextTeams

  // Parceiro na 1ª próxima: jogador de menor nível (não-alto preferido)
  const partner = [...first].sort(
    (a, b) => (a.level ?? DEFAULT_LEVEL) - (b.level ?? DEFAULT_LEVEL)
  )[0]

  // Simula a troca e verifica equilíbrio (Opção A)
  const newFirst = first.map(p => p.id === partner.id ? candidatePlayer : p)
  const newFirstAvg = newFirst.reduce((s, p) => s + (p.level ?? DEFAULT_LEVEL), 0) / newFirst.length
  const newDiff = Math.abs(newFirstAvg - fieldAvg)

  // Aceita somente se a diferença não aumentar
  if (newDiff > currentDiff + 1e-9) return nextTeams

  // Efetua a troca
  const newRest = rest.map((group, gi) =>
    gi === candidateGroupIdx
      ? group.map(p => p.id === candidatePlayer.id ? partner : p)
      : group
  )

  return [newFirst, ...newRest]
}
