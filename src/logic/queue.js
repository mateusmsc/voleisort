import { teamAverage } from './balancing'

export function distributeAllPlayers(allPlayers, teamSize) {
  const sorted = [...allPlayers].sort((a, b) => b.rating - a.rating)
  const inField = sorted.slice(0, teamSize * 2)
  const rest    = sorted.slice(teamSize * 2)

  const { teamA, teamB } = snakeDraft(inField, teamSize)
  const nextTeams = buildNextQueue(rest, teamSize)

  return { teamA, teamB, nextTeams }
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

function avg(players) {
  if (!players.length) return 0
  return Math.round(players.reduce((s, p) => s + p.rating, 0) / players.length)
}

export function buildChallenger(winners, losers, waiting, roundsOut, config) {
  const { teamSize, maxRoundsOut, ratingDeltaThreshold } = config

  const pool = [...losers, ...waiting]
  const winnerAvg = teamAverage(winners)

  const challenger = []
  const remaining = [...pool]

  while (challenger.length < teamSize && remaining.length > 0) {
    const currentAvg = teamAverage(challenger)
    const targetRating = winnerAvg * teamSize - currentAvg * challenger.length

    const urgentPlayers = remaining.filter(
      p => (roundsOut[p.id] ?? 0) >= maxRoundsOut
    )

    let chosen

    if (urgentPlayers.length > 0) {
      chosen = urgentPlayers.reduce((best, p) =>
        Math.abs(p.rating - targetRating) < Math.abs(best.rating - targetRating)
          ? p : best
      )
    } else {
      const ideal = remaining.reduce((best, p) =>
        Math.abs(p.rating - targetRating) < Math.abs(best.rating - targetRating)
          ? p : best
      )

      const waitingCandidates = remaining.filter(p =>
        waiting.includes(p) &&
        Math.abs(p.rating - targetRating) <= (ratingDeltaThreshold ?? 10) + 10
      )

      if (waitingCandidates.length > 0) {
        chosen = waitingCandidates.reduce((best, p) =>
          (roundsOut[p.id] ?? 0) > (roundsOut[best.id] ?? 0) ? p : best
        )
      } else {
        chosen = ideal
      }
    }

    challenger.push(chosen)
    remaining.splice(remaining.indexOf(chosen), 1)
  }

  return {
    challenger,
    newWaiting: remaining,
  }
}

export function updateRoundsOut(allCheckedInIds, playingNowIds, currentRoundsOut) {
  const updated = {}
  for (const id of allCheckedInIds) {
    if (playingNowIds.includes(id)) {
      updated[id] = 0
    } else {
      updated[id] = (currentRoundsOut[id] ?? 0) + 1
    }
  }
  return updated
}
