import { teamAverage } from './balancing'

/**
 * Calcula os deltas de rating após uma partida.
 * Leva em conta a diferença de médias entre os times.
 *
 * @param {Player[]} winners
 * @param {Player[]} losers
 * @returns {{ [playerId]: number }} - positivo = ganhou, negativo = perdeu
 */
export function calculateRatingDeltas(winners, losers) {
  const winAvg = teamAverage(winners)
  const loseAvg = teamAverage(losers)
  const diff = winAvg - loseAvg  // positivo = vencedor era favorito

  // Ganho base: +2 se equilibrado, menos se eram favoritos
  // Perda base: -1 se equilibrado, menos se eram azarões
  const baseWin  = 2
  const baseLose = -1

  // Fator de ajuste: times mais fortes ganham menos, perdem mais
  const adjustFactor = Math.max(-0.5, Math.min(0.5, diff / 40))

  const winDelta  = Math.round(baseWin  - adjustFactor)
  const loseDelta = Math.round(baseLose - adjustFactor * 0.5)

  const deltas = {}
  winners.forEach(p => { deltas[p.id] = winDelta })
  losers.forEach(p => { deltas[p.id] = loseDelta })

  return deltas
}
