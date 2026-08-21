export function computeSessionStats(matches, players) {
  const finished = matches.filter(m => m.status === 'finished')
  const nameById = new Map(players.map(p => [p.id, p.name]))

  const statsById = new Map()

  for (const match of finished) {
    const winnerIds = match.winner === 'B' ? match.teams.B : match.teams.A
    const loserIds = match.winner === 'B' ? match.teams.A : match.teams.B

    for (const id of winnerIds) {
      const s = ensureEntry(statsById, id)
      s.wins += 1
    }
    for (const id of loserIds) {
      const s = ensureEntry(statsById, id)
      s.losses += 1
    }
  }

  const ranking = [...statsById.entries()].map(([id, s]) => ({
    id,
    name: nameById.get(id) ?? null,
    played: s.wins + s.losses,
    wins: s.wins,
    losses: s.losses,
    winPct: round1((s.wins / (s.wins + s.losses)) * 100),
  }))

  ranking.sort((a, b) => b.winPct - a.winPct || b.played - a.played)

  return { totalMatches: finished.length, ranking }
}

function ensureEntry(statsById, playerId) {
  if (!statsById.has(playerId)) {
    statsById.set(playerId, { wins: 0, losses: 0 })
  }
  return statsById.get(playerId)
}

function round1(value) {
  return Math.round(value * 10) / 10
}

/**
 * computeWinStreak(fieldTeamIds, finishedMatches) → number
 *
 * Quantas vitórias consecutivas o time em campo acumula (grupo flexível):
 * caminha do histórico mais recente ao mais antigo; cada partida conta se foi
 * vencida por um time que compartilha ao menos 1 jogador com o "campeão"
 * atual da cadeia. Substituições não zeram; derrota ou troca total zera.
 *
 * @param {string[]} fieldTeamIds   - jogadores do time em campo (teams.A da partida atual)
 * @param {object[]} finishedMatches - partidas finalizadas na janela desejada, em ordem de rodada
 */
export function computeWinStreak(fieldTeamIds, finishedMatches) {
  let champions = new Set(fieldTeamIds)
  let streak = 0

  for (let i = finishedMatches.length - 1; i >= 0; i--) {
    const m = finishedMatches[i]
    if (!m.winner) break
    const winners = m.winner === 'B' ? m.teams.B : m.teams.A

    if (!winners.some(id => champions.has(id))) break

    streak++
    champions = new Set(winners)
  }

  return streak
}
