import { teamAverage } from './balancing'

export function calculateRatingDeltas(winners, losers) {
  const winAvg = teamAverage(winners)
  const loseAvg = teamAverage(losers)
  const diff = winAvg - loseAvg

  const baseWin  = 2
  const baseLose = -1

  const adjustFactor = Math.max(-0.5, Math.min(0.5, diff / 40))

  const winDelta  = Math.round(baseWin  - adjustFactor)
  const loseDelta = Math.round(baseLose - adjustFactor * 0.5)

  const deltas = {}
  winners.forEach(p => { deltas[p.id] = winDelta })
  losers.forEach(p => { deltas[p.id] = loseDelta })

  return deltas
}
