import { teamAverage } from './balancing'

/**
 * Monta o time desafiante após uma partida.
 *
 * @param {Player[]} winners           - time vencedor que permanece
 * @param {Player[]} losers            - perdedores que saem do campo
 * @param {Player[]} waiting           - fila de espera atual
 * @param {object} roundsOut           - { [playerId]: rounds sem jogar }
 * @param {object} config              - configurações da sessão
 * @returns {{ challenger: Player[], newWaiting: Player[] }}
 */
export function buildChallenger(winners, losers, waiting, roundsOut, config) {
  const { teamSize, maxRoundsOut, ratingDeltaThreshold } = config

  // Pool disponível = perdedores + quem estava na fila
  const pool = [...losers, ...waiting]

  // Alvo de rating: média do time vencedor
  const winnerAvg = teamAverage(winners)

  const challenger = []
  const remaining = [...pool]

  while (challenger.length < teamSize && remaining.length > 0) {
    const currentAvg = teamAverage(challenger)
    // Rating ideal do próximo jogador para atingir a média alvo
    const targetRating = winnerAvg * teamSize - currentAvg * challenger.length

    // Verificar se alguém está há muitas rodadas fora (urgência)
    const urgentPlayers = remaining.filter(
      p => (roundsOut[p.id] ?? 0) >= maxRoundsOut
    )

    let chosen

    if (urgentPlayers.length > 0) {
      // Urgência: pega o mais próximo do rating ideal dentre os urgentes
      chosen = urgentPlayers.reduce((best, p) =>
        Math.abs(p.rating - targetRating) < Math.abs(best.rating - targetRating)
          ? p : best
      )
    } else {
      // Normal: melhor encaixe por rating
      const ideal = remaining.reduce((best, p) =>
        Math.abs(p.rating - targetRating) < Math.abs(best.rating - targetRating)
          ? p : best
      )

      // Verificar se há alguém aguardando que está bem próximo do ideal
      const waitingCandidates = remaining.filter(p =>
        waiting.includes(p) &&
        Math.abs(p.rating - targetRating) <= (ratingDeltaThreshold ?? 10) + 10
      )

      if (waitingCandidates.length > 0) {
        // Prefere quem está na fila há mais tempo (maior roundsOut)
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

/**
 * Atualiza o contador de rodadas fora de cada jogador.
 * Jogadores que jogaram voltam a zero. Quem ficou fora incrementa.
 *
 * @param {string[]} allCheckedInIds
 * @param {string[]} playingNowIds    - jogadores das duas equipes atuais
 * @param {object} currentRoundsOut   - estado anterior { [id]: number }
 * @returns {object}                  - novo estado { [id]: number }
 */
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
