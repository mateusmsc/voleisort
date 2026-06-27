/**
 * Testes de happy-day para mudanca de quantidade de jogadores por time (teamSize).
 *
 * teamSize pode ser: 4, 5, 6, 7
 *
 * Cenarios cobertos:
 *   1. distributeAllPlayers com cada teamSize (formacao inicial)
 *   2. snakeDraft com cada teamSize (balanceamento)
 *   3. buildNextQueue com cada teamSize (particao da fila)
 *   4. advanceQueue com cada teamSize (avanco de fila ao encerrar partida)
 *   5. Mudanca de teamSize com partida ativa (redistribuicao completa)
 *   6. Numero exato de jogadores = teamSize*2 (sem fila)
 *   7. Numero insuficiente de jogadores (< teamSize*2)
 *   8. Numero muito grande de jogadores (varias proximas)
 */

import { describe, it, expect } from 'vitest'
import {
  distributeAllPlayers,
  buildNextQueue,
  snakeDraft,
  advanceQueue,
} from './queue.js'

// Helpers
function makePlayers(n, baseRating = 50) {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i + 1}`,
    rating: baseRating - i,
  }))
}

function makeNamedPlayers(ids, rating = 50) {
  return ids.map(id => ({ id, rating }))
}

// ---------------------------------------------------------------------------
// distributeAllPlayers -- happy-day para cada teamSize
// ---------------------------------------------------------------------------
describe('distributeAllPlayers -- teamSize 4, 5, 6, 7', () => {
  for (const teamSize of [4, 5, 6, 7]) {
    describe(`teamSize=${teamSize}`, () => {
      it(`coloca exatamente ${teamSize} em cada time e o resto na fila`, () => {
        const players = makePlayers(teamSize * 2 + teamSize) // 3 times vale de jogadores
        const { teamA, teamB, nextTeams } = distributeAllPlayers(players, teamSize)

        expect(teamA.length).toBe(teamSize)
        expect(teamB.length).toBe(teamSize)
        expect(nextTeams.flat().length).toBe(teamSize)
      })

      it(`os ${teamSize * 2} com maior rating vao para o campo`, () => {
        const players = makePlayers(teamSize * 3)
        const { teamA, teamB, nextTeams } = distributeAllPlayers(players, teamSize)

        const onFieldRatings = [...teamA, ...teamB].map(p => p.rating)
        const queueRatings   = nextTeams.flat().map(p => p.rating)

        const minField = Math.min(...onFieldRatings)
        const maxQueue = Math.max(...queueRatings)
        expect(minField).toBeGreaterThan(maxQueue)
      })

      it(`com exatamente ${teamSize * 2} jogadores, fila fica vazia`, () => {
        const players = makePlayers(teamSize * 2)
        const { teamA, teamB, nextTeams } = distributeAllPlayers(players, teamSize)

        expect(teamA.length).toBe(teamSize)
        expect(teamB.length).toBe(teamSize)
        expect(nextTeams).toEqual([])
      })

      it(`nao duplica jogadores entre campo e fila`, () => {
        const players = makePlayers(teamSize * 3)
        const { teamA, teamB, nextTeams } = distributeAllPlayers(players, teamSize)

        const all = [...teamA, ...teamB, ...nextTeams.flat()].map(p => p.id)
        expect(new Set(all).size).toBe(all.length)
        expect(all.length).toBe(players.length)
      })

      it(`times resultantes tem medias proximas (diferenca <= ${teamSize * 3})`, () => {
        const players = makePlayers(teamSize * 2)
        const { teamA, teamB } = distributeAllPlayers(players, teamSize)

        const avgA = teamA.reduce((s, p) => s + p.rating, 0) / teamA.length
        const avgB = teamB.reduce((s, p) => s + p.rating, 0) / teamB.length
        expect(Math.abs(avgA - avgB)).toBeLessThanOrEqual(teamSize * 3)
      })
    })
  }
})

// ---------------------------------------------------------------------------
// distributeAllPlayers -- casos limite
// ---------------------------------------------------------------------------
describe('distributeAllPlayers -- casos limite de quantidade de jogadores', () => {
  it('com menos de teamSize*2 jogadores, coloca todos no campo e fila fica vazia', () => {
    const players = makePlayers(9) // teamSize=6: 9 < 12
    const { teamA, teamB, nextTeams } = distributeAllPlayers(players, 6)

    expect(teamA.length + teamB.length).toBe(9)
    expect(nextTeams).toEqual([])
  })

  it('com 1 jogador a mais que teamSize*2, fila tem 1 jogador', () => {
    const players = makePlayers(13) // teamSize=6
    const { nextTeams } = distributeAllPlayers(players, 6)

    expect(nextTeams.flat().length).toBe(1)
  })

  it('com muitos jogadores (22, teamSize=6), fila tem multiplas proximas', () => {
    const players = makePlayers(22)
    const { teamA, teamB, nextTeams } = distributeAllPlayers(players, 6)

    expect(teamA.length).toBe(6)
    expect(teamB.length).toBe(6)
    expect(nextTeams.flat().length).toBe(10)
    // 1a proxima completa, 2a incompleta
    expect(nextTeams[0].length).toBe(6)
    expect(nextTeams[1].length).toBe(4)
  })

  it('com 28 jogadores (teamSize=7): 14 no campo, 14 na fila em 2 proximas completas', () => {
    const players = makePlayers(28)
    const { teamA, teamB, nextTeams } = distributeAllPlayers(players, 7)

    expect(teamA.length).toBe(7)
    expect(teamB.length).toBe(7)
    expect(nextTeams.length).toBe(2)
    expect(nextTeams[0].length).toBe(7)
    expect(nextTeams[1].length).toBe(7)
  })
})

// ---------------------------------------------------------------------------
// snakeDraft -- happy-day para cada teamSize
// ---------------------------------------------------------------------------
describe('snakeDraft -- teamSize 4, 5, 6, 7', () => {
  for (const teamSize of [4, 5, 6, 7]) {
    it(`teamSize=${teamSize}: distribui exatamente ${teamSize} em cada time sem duplicar`, () => {
      const players = makePlayers(teamSize * 2)
      const { teamA, teamB } = snakeDraft(players, teamSize)

      expect(teamA.length).toBe(teamSize)
      expect(teamB.length).toBe(teamSize)

      const allIds = [...teamA, ...teamB].map(p => p.id)
      expect(new Set(allIds).size).toBe(allIds.length)
    })

    it(`teamSize=${teamSize}: medias dos times sao proximas (diferenca <= 10)`, () => {
      const players = makePlayers(teamSize * 2)
      const { teamA, teamB } = snakeDraft(players, teamSize)

      const avgA = teamA.reduce((s, p) => s + p.rating, 0) / teamA.length
      const avgB = teamB.reduce((s, p) => s + p.rating, 0) / teamB.length
      expect(Math.abs(avgA - avgB)).toBeLessThanOrEqual(10)
    })
  }
})

// ---------------------------------------------------------------------------
// buildNextQueue -- happy-day para cada teamSize
// ---------------------------------------------------------------------------
describe('buildNextQueue -- teamSize 4, 5, 6, 7', () => {
  for (const teamSize of [4, 5, 6, 7]) {
    it(`teamSize=${teamSize}: chunka corretamente em grupos de ${teamSize}`, () => {
      const players = makePlayers(teamSize * 3)
      const queue = buildNextQueue(players, teamSize)

      expect(queue.length).toBe(3)
      expect(queue[0].length).toBe(teamSize)
      expect(queue[1].length).toBe(teamSize)
      expect(queue[2].length).toBe(teamSize)
    })

    it(`teamSize=${teamSize}: ultimo chunk pode ser menor que ${teamSize}`, () => {
      const players = makePlayers(teamSize * 2 + 1)
      const queue = buildNextQueue(players, teamSize)

      expect(queue.length).toBe(3)
      expect(queue[0].length).toBe(teamSize)
      expect(queue[1].length).toBe(teamSize)
      expect(queue[2].length).toBe(1)
    })
  }
})

// ---------------------------------------------------------------------------
// advanceQueue -- happy-day para cada teamSize
// ---------------------------------------------------------------------------
describe('advanceQueue -- teamSize 4, 5, 6, 7', () => {
  for (const teamSize of [4, 5, 6, 7]) {
    it(`teamSize=${teamSize}: 1a proxima completa vira o novo oponente`, () => {
      const winners  = makePlayers(teamSize, 80)
      const losers   = makePlayers(teamSize, 50)
      const next1    = makePlayers(teamSize, 40).map((p, i) => ({ ...p, id: `n${i}` }))

      const { newOpponent, newNextTeams } = advanceQueue(
        winners, losers, [next1], teamSize, {}, 3
      )

      expect(newOpponent.length).toBe(teamSize)
      expect(newOpponent.map(p => p.id)).toEqual(next1.map(p => p.id))

      // Losers vao para o final da fila
      const queueIds = newNextTeams.flat().map(p => p.id)
      for (const l of losers) expect(queueIds).toContain(l.id)
    })

    it(`teamSize=${teamSize}: losers vao para o FINAL (depois de quem ja esperava)`, () => {
      const winners = makePlayers(teamSize, 80)
      const losers  = makePlayers(teamSize, 50).map((p, i) => ({ ...p, id: `l${i}` }))
      const next1   = makePlayers(teamSize, 40).map((p, i) => ({ ...p, id: `n1_${i}` }))
      const next2   = makePlayers(teamSize, 30).map((p, i) => ({ ...p, id: `n2_${i}` }))

      const { newOpponent, newNextTeams } = advanceQueue(
        winners, losers, [next1, next2], teamSize, {}, 3
      )

      // next1 vira oponente
      expect(newOpponent.map(p => p.id)).toEqual(next1.map(p => p.id))

      const queueFlat = newNextTeams.flat().map(p => p.id)
      // next2 vem antes dos losers
      const idxN2_0 = queueFlat.indexOf('n2_0')
      const idxL0   = queueFlat.indexOf('l0')
      expect(idxN2_0).toBeGreaterThanOrEqual(0)
      expect(idxL0).toBeGreaterThanOrEqual(0)
      expect(idxN2_0).toBeLessThan(idxL0)
    })

    it(`teamSize=${teamSize}: fila vazia -- losers formam o novo oponente`, () => {
      const winners = makePlayers(teamSize, 80)
      const losers  = makePlayers(teamSize, 50)

      const { newOpponent } = advanceQueue(winners, losers, [], teamSize, {}, 3)

      expect(newOpponent.length).toBe(teamSize)
    })

    it(`teamSize=${teamSize}: nao duplica jogadores apos avanco`, () => {
      const winners = makePlayers(teamSize, 80)
      const losers  = makePlayers(teamSize, 50).map((p, i) => ({ ...p, id: `l${i}` }))
      const next1   = makePlayers(teamSize, 40).map((p, i) => ({ ...p, id: `n${i}` }))

      const { newOpponent, newNextTeams } = advanceQueue(
        winners, losers, [next1], teamSize, {}, 3
      )

      const all = [...newOpponent, ...newNextTeams.flat()].map(p => p.id)
      expect(new Set(all).size).toBe(all.length)
    })
  }
})

// ---------------------------------------------------------------------------
// Mudanca de teamSize com partida ativa -- redistribuicao completa
// ---------------------------------------------------------------------------
describe('mudanca de teamSize com partida ativa -- redistribuicao via distributeAllPlayers', () => {
  it('de teamSize=6 para teamSize=4: redistribui todos os presentes', () => {
    // 18 jogadores presentes. Com teamSize=4: 8 no campo, 10 na fila.
    const players = makePlayers(18)
    const { teamA, teamB, nextTeams } = distributeAllPlayers(players, 4)

    expect(teamA.length).toBe(4)
    expect(teamB.length).toBe(4)
    expect(nextTeams.flat().length).toBe(10)
    // 2 proximas completas + 1 com 2
    expect(nextTeams[0].length).toBe(4)
    expect(nextTeams[1].length).toBe(4)
    expect(nextTeams[2].length).toBe(2)

    const all = [...teamA, ...teamB, ...nextTeams.flat()].map(p => p.id)
    expect(new Set(all).size).toBe(all.length)
    expect(all.length).toBe(18)
  })

  it('de teamSize=4 para teamSize=6: redistribui todos os presentes', () => {
    const players = makePlayers(18)
    const { teamA, teamB, nextTeams } = distributeAllPlayers(players, 6)

    expect(teamA.length).toBe(6)
    expect(teamB.length).toBe(6)
    expect(nextTeams.flat().length).toBe(6)
    expect(nextTeams[0].length).toBe(6)

    const all = [...teamA, ...teamB, ...nextTeams.flat()].map(p => p.id)
    expect(new Set(all).size).toBe(all.length)
  })

  it('de teamSize=6 para teamSize=7: redistribui todos os presentes', () => {
    const players = makePlayers(22)
    const { teamA, teamB, nextTeams } = distributeAllPlayers(players, 7)

    expect(teamA.length).toBe(7)
    expect(teamB.length).toBe(7)
    expect(nextTeams.flat().length).toBe(8)

    const all = [...teamA, ...teamB, ...nextTeams.flat()].map(p => p.id)
    expect(new Set(all).size).toBe(all.length)
    expect(all.length).toBe(22)
  })

  it('de teamSize=7 para teamSize=5: redistribui todos os presentes', () => {
    const players = makePlayers(22)
    const { teamA, teamB, nextTeams } = distributeAllPlayers(players, 5)

    expect(teamA.length).toBe(5)
    expect(teamB.length).toBe(5)
    expect(nextTeams.flat().length).toBe(12)

    const all = [...teamA, ...teamB, ...nextTeams.flat()].map(p => p.id)
    expect(new Set(all).size).toBe(all.length)
    expect(all.length).toBe(22)
  })

  it('numero minimo de jogadores para cada teamSize (exatamente teamSize*2)', () => {
    for (const teamSize of [4, 5, 6, 7]) {
      const players = makePlayers(teamSize * 2)
      const { teamA, teamB, nextTeams } = distributeAllPlayers(players, teamSize)

      expect(teamA.length).toBe(teamSize)
      expect(teamB.length).toBe(teamSize)
      expect(nextTeams).toEqual([])
    }
  })

  it('redistribuicao usa snake draft -- times ficam balanceados para todos os teamSizes', () => {
    for (const teamSize of [4, 5, 6, 7]) {
      const players = makePlayers(teamSize * 2)
      const { teamA, teamB } = distributeAllPlayers(players, teamSize)

      const avgA = teamA.reduce((s, p) => s + p.rating, 0) / teamA.length
      const avgB = teamB.reduce((s, p) => s + p.rating, 0) / teamB.length
      expect(Math.abs(avgA - avgB)).toBeLessThanOrEqual(10)
    }
  })
})

// ---------------------------------------------------------------------------
// advanceQueue -- mudanca de teamSize entre partidas
// (ao encerrar partida com teamSize diferente do anterior)
// ---------------------------------------------------------------------------
describe('advanceQueue -- consistencia com diferentes teamSizes', () => {
  it('teamSize=4: proxima incompleta (3/4) e completada pela fila ao avancar', () => {
    const winners   = makePlayers(4, 80)
    const losers    = makePlayers(4, 50).map((p, i) => ({ ...p, id: `l${i}` }))
    const next1     = makePlayers(3, 40).map((p, i) => ({ ...p, id: `n${i}` })) // incompleta
    const next2Flat = makePlayers(4, 30).map((p, i) => ({ ...p, id: `x${i}` }))

    const { newOpponent } = advanceQueue(winners, losers, [next1, next2Flat], 4, {}, 3)

    // Deve completar com 1 da fila restante (next2)
    expect(newOpponent.length).toBe(4)
    // Os 3 originais da next1 estao la
    for (const p of next1) expect(newOpponent.map(q => q.id)).toContain(p.id)
  })

  it('teamSize=5: losers (5) vao em 1 proxima completa atras de quem ja esperava', () => {
    const winners = makePlayers(5, 80)
    const losers  = makePlayers(5, 50).map((p, i) => ({ ...p, id: `l${i}` }))
    const next1   = makePlayers(5, 40).map((p, i) => ({ ...p, id: `n1_${i}` }))
    const next2   = makePlayers(5, 30).map((p, i) => ({ ...p, id: `n2_${i}` }))

    const { newNextTeams } = advanceQueue(winners, losers, [next1, next2], 5, {}, 3)

    // next2 continua em 1a posicao na fila
    expect(newNextTeams[0].map(p => p.id)).toEqual(next2.map(p => p.id))
    // losers vao para a 2a posicao
    expect(newNextTeams[1].map(p => p.id)).toEqual(losers.map(p => p.id))
  })

  it('teamSize=7: com 22 jogadores (14 campo, 8 fila), ao avancar 7 losers vao para o final', () => {
    const winners = makePlayers(7, 80)
    const losers  = makePlayers(7, 60).map((p, i) => ({ ...p, id: `l${i}` }))
    // 8 na fila inicialmente: 1 proxima de 7 + 1 com 1
    const next1   = makePlayers(7, 40).map((p, i) => ({ ...p, id: `n1_${i}` }))
    const next2   = makePlayers(1, 30).map((p, i) => ({ ...p, id: `n2_${i}` }))

    const { newOpponent, newNextTeams } = advanceQueue(winners, losers, [next1, next2], 7, {}, 3)

    // next1 completa vira oponente
    expect(newOpponent.length).toBe(7)
    expect(newOpponent.map(p => p.id)).toEqual(next1.map(p => p.id))

    // next2 (1 jogador) mais 6 losers completam a nova 1a proxima
    const queueFlat = newNextTeams.flat().map(p => p.id)
    expect(queueFlat).toContain('n2_0')
    // n2_0 vem antes dos losers
    const idxN2 = queueFlat.indexOf('n2_0')
    const idxL0 = queueFlat.indexOf('l0')
    expect(idxN2).toBeLessThan(idxL0)

    // Total: 1 (next2) + 7 (losers) = 8
    expect(queueFlat.length).toBe(8)
    expect(new Set(queueFlat).size).toBe(8)
  })
})
