import { describe, it, expect } from 'vitest'
import {
  distributeAllPlayers,
  buildNextQueue,
  snakeDraft,
  advanceQueue,
  updateRoundsOut,
} from './queue.js'

function makePlayers(ratings) {
  return ratings.map((r, i) => ({ id: `p${i + 1}`, rating: r }))
}

describe('distributeAllPlayers', () => {
  it('distribui exatamente teamSize*2 no campo, o resto na fila', () => {
    const players = makePlayers([90, 80, 70, 60, 50, 40, 30, 20, 10])
    const { teamA, teamB, nextTeams } = distributeAllPlayers(players, 4)

    expect(teamA.length).toBe(4)
    expect(teamB.length).toBe(4)
    expect(nextTeams.flat().length).toBe(1)
  })

  it('quando há exatamente teamSize*2 jogadores, a fila fica vazia', () => {
    const players = makePlayers([90, 80, 70, 60, 50, 40])
    const { teamA, teamB, nextTeams } = distributeAllPlayers(players, 3)

    expect(teamA.length).toBe(3)
    expect(teamB.length).toBe(3)
    expect(nextTeams).toEqual([])
  })

  it('os jogadores com maior rating ficam no campo (não na fila)', () => {
    const players = makePlayers([10, 95, 30, 85, 70, 60, 20, 50])
    const { nextTeams } = distributeAllPlayers(players, 3)

    const queueRatings = nextTeams.flat().map(p => p.rating)
    const maxQueueRating = Math.max(...queueRatings)
    expect(maxQueueRating).toBeLessThanOrEqual(30)
  })

  it('quando há apenas teamSize*2 - 1 jogadores, fila vazia e campo com menos jogadores', () => {
    const players = makePlayers([90, 80, 70, 60, 50])
    const { teamA, teamB, nextTeams } = distributeAllPlayers(players, 3)

    expect(teamA.length + teamB.length).toBeLessThanOrEqual(6)
    expect(nextTeams).toEqual([])
  })
})

describe('buildNextQueue', () => {
  it('retorna array vazio se não há jogadores', () => {
    expect(buildNextQueue([], 6)).toEqual([])
  })

  it('divide exatamente em chunks de teamSize', () => {
    const players = makePlayers([90, 80, 70, 60, 50, 40])
    const queue = buildNextQueue(players, 3)

    expect(queue.length).toBe(2)
    expect(queue[0].length).toBe(3)
    expect(queue[1].length).toBe(3)
  })

  it('último chunk pode ser menor que teamSize', () => {
    const players = makePlayers([90, 80, 70, 60, 50])
    const queue = buildNextQueue(players, 3)

    expect(queue.length).toBe(2)
    expect(queue[0].length).toBe(3)
    expect(queue[1].length).toBe(2)
  })

  it('um único jogador gera um único chunk de tamanho 1', () => {
    const players = makePlayers([50])
    const queue = buildNextQueue(players, 6)

    expect(queue.length).toBe(1)
    expect(queue[0].length).toBe(1)
  })
})

describe('snakeDraft', () => {
  it('distribui teamSize jogadores em cada time', () => {
    const players = makePlayers([100, 90, 80, 70, 60, 50])
    const { teamA, teamB } = snakeDraft(players, 3)

    expect(teamA.length).toBe(3)
    expect(teamB.length).toBe(3)
  })

  it('padrao snake: posicoes 0,3,4 vao para A; 1,2,5 vao para B (teamSize=3)', () => {
    const players = makePlayers([100, 90, 80, 70, 60, 50])
    const { teamA, teamB } = snakeDraft(players, 3)

    expect(teamA.map(p => p.rating)).toEqual(
      expect.arrayContaining([100, 70, 60])
    )
    expect(teamB.map(p => p.rating)).toEqual(
      expect.arrayContaining([90, 80, 50])
    )
  })

  it('times resultantes têm médias próximas (diferença <= 10)', () => {
    const players = makePlayers([100, 90, 80, 70, 60, 50, 40, 30])
    const { teamA, teamB } = snakeDraft(players, 4)

    const avg = arr => arr.reduce((s, p) => s + p.rating, 0) / arr.length
    expect(Math.abs(avg(teamA) - avg(teamB))).toBeLessThanOrEqual(10)
  })

  it('não duplica jogadores entre os times', () => {
    const players = makePlayers([90, 80, 70, 60, 50, 40, 30, 20, 10, 5])
    const { teamA, teamB } = snakeDraft(players, 5)

    const idsA = new Set(teamA.map(p => p.id))
    const idsB = new Set(teamB.map(p => p.id))
    const intersection = [...idsA].filter(id => idsB.has(id))
    expect(intersection).toHaveLength(0)
  })
})

describe('advanceQueue', () => {
  it('o 1o time da fila vira o novo oponente', () => {
    const winners = makePlayers([80, 70, 60])
    const losers  = makePlayers([50, 40, 30])
    const next1   = makePlayers([90, 85, 75])
    const next2   = makePlayers([55, 45, 35])
    const { newOpponent } = advanceQueue(winners, losers, [next1, next2], 3, {}, 2)

    expect(newOpponent.map(p => p.id)).toEqual(next1.map(p => p.id))
  })

  it('quando o 1o time da fila está incompleto, completa com jogadores do pool', () => {
    const winners    = makePlayers([80, 70, 60])
    const losers     = makePlayers([50, 40, 30])
    const incomplete = [{ id: 'q1', rating: 90 }]
    const { newOpponent } = advanceQueue(winners, losers, [incomplete], 3, {}, 2)

    expect(newOpponent.length).toBe(3)
  })

  it('com fila vazia, oponente é formado com perdedores', () => {
    const winners = makePlayers([80, 70, 60])
    const losers  = [
      { id: 'l1', rating: 50 },
      { id: 'l2', rating: 40 },
      { id: 'l3', rating: 30 },
    ]
    const { newOpponent } = advanceQueue(winners, losers, [], 3, {}, 2)

    expect(newOpponent.length).toBe(3)
  })

  it('jogadores com roundsOut >= maxRoundsOut têm prioridade para entrar', () => {
    const winners = [{ id: 'w1', rating: 80 }, { id: 'w2', rating: 70 }]
    const losers  = [{ id: 'l1', rating: 50 }, { id: 'l2', rating: 40 }]
    const firstNext = [{ id: 'n1', rating: 90 }]
    const roundsOut = { l1: 0, l2: 3 }

    const { newOpponent } = advanceQueue(winners, losers, [firstNext], 2, roundsOut, 2)

    const opponentIds = newOpponent.map(p => p.id)
    expect(opponentIds).toContain('l2')
  })

  it('os perdedores voltam para a fila de proximos', () => {
    const winners = makePlayers([80, 70])
    const losers  = [{ id: 'l1', rating: 50 }, { id: 'l2', rating: 40 }]
    const next1   = [{ id: 'n1', rating: 90 }, { id: 'n2', rating: 85 }]
    const { newNextTeams } = advanceQueue(winners, losers, [next1], 2, {}, 2)

    const allInQueue = newNextTeams.flat().map(p => p.id)
    expect(allInQueue).toEqual(expect.arrayContaining(['l1', 'l2']))
  })
})

describe('updateRoundsOut', () => {
  it('zera roundsOut de quem jogou', () => {
    const result = updateRoundsOut(['p1', 'p2', 'p3'], ['p1', 'p2'], { p1: 2, p2: 1, p3: 0 })
    expect(result.p1).toBe(0)
    expect(result.p2).toBe(0)
  })

  it('incrementa roundsOut de quem ficou de fora', () => {
    const result = updateRoundsOut(['p1', 'p2', 'p3'], ['p1', 'p2'], { p1: 0, p2: 0, p3: 1 })
    expect(result.p3).toBe(2)
  })

  it('novo jogador (sem historico) comeca em 1 se ficou fora', () => {
    const result = updateRoundsOut(['p1', 'p2'], ['p1'], {})
    expect(result.p2).toBe(1)
  })

  it('retorna objeto com exatamente os IDs de allCheckedInIds', () => {
    const result = updateRoundsOut(['p1', 'p2'], ['p1'], { p1: 0, p2: 0 })
    expect(Object.keys(result).sort()).toEqual(['p1', 'p2'])
  })
})

describe('advanceQueue — fila restante preserva ordem FIFO, nao usa rating', () => {
  it('perdedores entram na fila na ordem em que chegaram, nao por rating', () => {
    // Com 1ª próxima completa: losers vão para nova posição, preservando sua ordem interna
    const winners = [{ id: 'w1', rating: 80 }, { id: 'w2', rating: 70 }]
    const losers  = [
      { id: 'lLow',  rating: 20 },
      { id: 'lHigh', rating: 90 },
    ]
    const next1 = [{ id: 'n1', rating: 50 }, { id: 'n2', rating: 50 }]
    const { newNextTeams } = advanceQueue(winners, losers, [next1], 2, {}, 2)

    const queueOrder = newNextTeams.flat().map(p => p.id)
    // losers devem estar na fila (em alguma posição)
    expect(queueOrder).toContain('lLow')
    expect(queueOrder).toContain('lHigh')
    // losers devem manter sua ordem relativa entre si
    expect(queueOrder.indexOf('lLow')).toBeLessThan(queueOrder.indexOf('lHigh'))
  })

  it('[RED] BUG-FIFO: quem ja estava na 2a proxima deve subir para 1a, losers vao para o FINAL da fila', () => {
    // Cenario: teamSize=2
    // times A e B estão no campo
    // 1ª próxima = [n1, n2] — sobe para o campo como novo oponente
    // 2ª próxima = [n3, n4] — deve subir para 1ª próxima
    // losers = [l1, l2] — devem ir para o FINAL (nova 2ª próxima)
    //
    // Resultado esperado:
    //   newOpponent = [n1, n2]  ← 1ª próxima sobe
    //   newNextTeams[0] = [n3, n4]  ← 2ª próxima sobe para 1ª
    //   newNextTeams[1] = [l1, l2]  ← losers vão para o final
    const winners = [{ id: 'w1', rating: 80 }, { id: 'w2', rating: 75 }]
    const losers  = [{ id: 'l1', rating: 50 }, { id: 'l2', rating: 45 }]
    const next1   = [{ id: 'n1', rating: 60 }, { id: 'n2', rating: 55 }]
    const next2   = [{ id: 'n3', rating: 40 }, { id: 'n4', rating: 35 }]

    const { newOpponent, newNextTeams } = advanceQueue(
      winners, losers, [next1, next2], 2, {}, 3
    )

    // 1ª próxima vira o oponente
    expect(newOpponent.map(p => p.id)).toEqual(['n1', 'n2'])

    // 2ª próxima sobe para 1ª posição na nova fila
    expect(newNextTeams[0].map(p => p.id)).toEqual(['n3', 'n4'])

    // Losers vão para o FINAL (2ª posição na nova fila)
    expect(newNextTeams[1].map(p => p.id)).toEqual(['l1', 'l2'])

    // Não há duplicações
    const allIds = [
      ...newOpponent.map(p => p.id),
      ...newNextTeams.flat().map(p => p.id),
    ]
    expect(new Set(allIds).size).toBe(allIds.length)
  })

  it('[RED] BUG-FIFO: cenario com 22 jogadores e teamSize=6', () => {
    // Estado após distributeAllPlayers com 22 jogadores, teamSize=6:
    //   campo: A(6) + B(6) = 12
    //   1ª próxima: [q1..q6] (6 jogadores)
    //   2ª próxima: [q7..q10] (4 jogadores, incompleta)
    //
    // Ao encerrar: 1ª próxima vira oponente.
    // losers (6) devem ir para DEPOIS de q7..q10.
    // Resultado esperado:
    //   newOpponent = [q1..q6]
    //   newNextTeams[0] = [q7, q8, q9, q10, l1, l2]  ← q7..q10 + 2 losers completam
    //   newNextTeams[1] = [l3, l4, l5, l6]            ← losers restantes
    //
    // O que o bug produz hoje:
    //   newOpponent = [q1..q6]
    //   newNextTeams[0] = [l1, l2, l3, l4, l5, l6]   ← losers na frente! ERRADO
    //   newNextTeams[1] = [q7, q8, q9, q10]           ← 2ª próxima fica atrás dos losers! ERRADO

    const winners = [
      { id: 'w1', rating: 80 }, { id: 'w2', rating: 78 },
      { id: 'w3', rating: 76 }, { id: 'w4', rating: 74 },
      { id: 'w5', rating: 72 }, { id: 'w6', rating: 70 },
    ]
    const losers = [
      { id: 'l1', rating: 68 }, { id: 'l2', rating: 66 },
      { id: 'l3', rating: 64 }, { id: 'l4', rating: 62 },
      { id: 'l5', rating: 60 }, { id: 'l6', rating: 58 },
    ]
    const next1 = [
      { id: 'q1', rating: 56 }, { id: 'q2', rating: 54 },
      { id: 'q3', rating: 52 }, { id: 'q4', rating: 50 },
      { id: 'q5', rating: 48 }, { id: 'q6', rating: 46 },
    ]
    const next2 = [
      { id: 'q7', rating: 44 }, { id: 'q8', rating: 42 },
      { id: 'q9', rating: 40 }, { id: 'q10', rating: 38 },
    ]

    const { newOpponent, newNextTeams } = advanceQueue(
      winners, losers, [next1, next2], 6, {}, 3
    )

    // 1ª próxima sobe para o campo
    expect(newOpponent.map(p => p.id)).toEqual(next1.map(p => p.id))

    // q7..q10 devem aparecer ANTES dos losers na nova fila
    const queueFlat = newNextTeams.flat().map(p => p.id)
    const idxQ7  = queueFlat.indexOf('q7')
    const idxL1  = queueFlat.indexOf('l1')
    expect(idxQ7).toBeGreaterThanOrEqual(0)
    expect(idxL1).toBeGreaterThanOrEqual(0)
    expect(idxQ7).toBeLessThan(idxL1)  // q7 vem ANTES de l1

    // Todos os 10 jogadores (4 da 2ª + 6 losers) devem estar na fila
    expect(queueFlat.length).toBe(10)

    // Sem duplicações
    expect(new Set(queueFlat).size).toBe(10)
  })
})

describe('distributeAllPlayers — cancelamento reseta estado para nova instancia', () => {
  it('[RED] apos cancelar, distributeAllPlayers retorna fila sem levar historico de rating em conta na ordem', () => {
    const players = [
      { id: 'p1', rating: 90 },
      { id: 'p2', rating: 80 },
      { id: 'p3', rating: 70 },
      { id: 'p4', rating: 60 },
      { id: 'p5', rating: 50 },
      { id: 'p6', rating: 40 },
    ]
    const { teamA, teamB, nextTeams } = distributeAllPlayers(players, 2)
    expect(teamA.length).toBe(2)
    expect(teamB.length).toBe(2)
    expect(nextTeams.flat().length).toBe(2)
  })
})

describe('[RED] BUG4: cancelar partida e formar times — nova formacao usa snake draft (overall), nao FIFO', () => {
  it('apos cancelamento, distributeAllPlayers usa rating para formar os times (snake draft)', () => {
    // Simula o que acontece quando o usuario cancela e clica em "Formar times":
    // distributeAllPlayers deve ser chamado e retornar times balanceados por rating.
    // Os jogadores com maior rating devem ir para o campo, nao a fila.
    const players = [
      { id: 'p1', rating: 90 },
      { id: 'p2', rating: 85 },
      { id: 'p3', rating: 70 },
      { id: 'p4', rating: 65 },
      { id: 'p5', rating: 30 },
      { id: 'p6', rating: 20 },
    ]
    const { teamA, teamB, nextTeams } = distributeAllPlayers(players, 2)

    // Os 4 com maior rating devem estar no campo
    const onField = [...teamA, ...teamB].map(p => p.id)
    expect(onField).toContain('p1')
    expect(onField).toContain('p2')
    expect(onField).toContain('p3')
    expect(onField).toContain('p4')

    // Os 2 com menor rating devem estar na fila
    const inQueue = nextTeams.flat().map(p => p.id)
    expect(inQueue).toContain('p5')
    expect(inQueue).toContain('p6')

    // Times devem ser balanceados (medias proximas)
    const avgA = teamA.reduce((s, p) => s + p.rating, 0) / teamA.length
    const avgB = teamB.reduce((s, p) => s + p.rating, 0) / teamB.length
    expect(Math.abs(avgA - avgB)).toBeLessThanOrEqual(15)
  })

  it('[RED] BUG4: apos cancelar, distributeAllPlayers usa rating para colocar os melhores no campo', () => {
    // Simula o que acontece quando o usuario cancela e clica em "Formar times":
    // distributeAllPlayers deve ser chamado com teamSize=2.
    // Com 6 jogadores e teamSize=2: top 4 no campo (teamSize*2=4), 2 na fila.
    const players = [
      { id: 'highRating', rating: 95 },
      { id: 'midHigh', rating: 80 },
      { id: 'mid1', rating: 60 },
      { id: 'mid2', rating: 55 },
      { id: 'lowRating1', rating: 20 },
      { id: 'lowRating2', rating: 15 },
    ]
    const { teamA, teamB, nextTeams } = distributeAllPlayers(players, 2)

    // Os 4 com maior rating devem estar no campo
    const onField = [...teamA, ...teamB].map(p => p.id)
    expect(onField).toContain('highRating')
    expect(onField).toContain('midHigh')
    expect(onField).toContain('mid1')
    expect(onField).toContain('mid2')

    // Os 2 com menor rating devem estar na fila
    const inQueue = nextTeams.flat().map(p => p.id)
    expect(inQueue).toContain('lowRating1')
    expect(inQueue).toContain('lowRating2')

    // Times devem ser balanceados (medias proximas)
    const avgA = teamA.reduce((s, p) => s + p.rating, 0) / teamA.length
    const avgB = teamB.reduce((s, p) => s + p.rating, 0) / teamB.length
    expect(Math.abs(avgA - avgB)).toBeLessThanOrEqual(15)
  })
})

describe('[RED] BUG5: overall so deve impactar na primeira formacao de times', () => {
  it('advanceQueue: ao completar time incompleto, deve priorizar roundsOut (tempo de espera), nao rating', () => {
    // Cenario: 1a proxima tem 1 jogador, precisa de mais 1.
    // Ha 2 candidatos no pool: um com alto rating, outro com muito tempo de fora.
    // Deve escolher o que tem mais tempo de fora (roundsOut maior).
    const winners = [{ id: 'w1', rating: 80 }, { id: 'w2', rating: 75 }]
    const losers = [{ id: 'l1', rating: 50 }, { id: 'l2', rating: 45 }]
    const firstNext = [{ id: 'n1', rating: 90 }] // time incompleto, precisa de 1 mais
    // Pool apos popar firstNext: losers + remainingNext.flat()
    // Candidatos para completar: l1 (rating 50, roundsOut=0), l2 (rating 45, roundsOut=5)
    const roundsOut = { l1: 0, l2: 5 }

    const { newOpponent } = advanceQueue(winners, losers, [firstNext], 2, roundsOut, 2)

    // l2 tem roundsOut >= maxRoundsOut (5 >= 2), deve ter prioridade sobre l1
    expect(newOpponent.map(p => p.id)).toContain('l2')
  })

  it('[RED] BUG5: ao completar time incompleto, jogador com alto rating mas roundsOut=0 NAO tem prioridade sobre quem espera ha mais tempo', () => {
    // Cenario: 1a proxima tem 1 jogador (q1, rating=90), precisa de mais 1.
    // Pool: highRating (rating=99, roundsOut=0), waitingLong (rating=30, roundsOut=4)
    // maxRoundsOut=2, entao waitingLong e urgente e deve ter prioridade.
    const winners = [{ id: 'w1', rating: 70 }]
    const losers = [
      { id: 'highRating', rating: 99 },
      { id: 'waitingLong', rating: 30 },
    ]
    const firstNext = [{ id: 'q1', rating: 90 }] // precisa de 1 a mais (teamSize=2)
    const roundsOut = { highRating: 0, waitingLong: 4, q1: 0 }

    const { newOpponent } = advanceQueue(winners, losers, [firstNext], 2, roundsOut, 2)

    // waitingLong e urgente (roundsOut=4 >= maxRoundsOut=2), deve entrar, nao highRating
    expect(newOpponent.map(p => p.id)).toContain('waitingLong')
    expect(newOpponent.map(p => p.id)).not.toContain('highRating')
  })

  it('[RED] BUG5: fila de proximas respeita FIFO, nao rating dos perdedores', () => {
    // Apos encerrar partida, os perdedores que nao entram no novo oponente vao para o final da fila.
    // A ordem na fila deve ser FIFO (ordem original dos perdedores), nao por rating.
    // Cenario: teamSize=2, winners=2, losers=4, nextTeams=[time com 2 jogadores]
    // O 1o time da fila vira o oponente. Os 4 perdedores vao para a nova fila.
    // A nova fila deve ter os perdedores na ordem original.
    const winners = [{ id: 'w1', rating: 80 }, { id: 'w2', rating: 75 }]
    const losers = [
      { id: 'lFirst', rating: 10 },   // primeiro na lista, baixo rating
      { id: 'lSecond', rating: 95 },  // segundo na lista, alto rating
      { id: 'lThird', rating: 50 },
      { id: 'lFourth', rating: 45 },
    ]
    const next1 = [{ id: 'n1', rating: 60 }, { id: 'n2', rating: 55 }]
    // next1 vira o oponente; losers vao para a nova fila
    const { newNextTeams } = advanceQueue(winners, losers, [next1], 2, {}, 2)

    // A fila deve ter os perdedores na ordem original (FIFO), nao reordenada por rating
    const queueIds = newNextTeams.flat().map(p => p.id)
    // lFirst deve aparecer antes de lSecond (ordem de chegada, nao por rating)
    expect(queueIds.indexOf('lFirst')).toBeLessThan(queueIds.indexOf('lSecond'))
    // Todos os perdedores devem estar na fila
    expect(queueIds).toContain('lFirst')
    expect(queueIds).toContain('lSecond')
    expect(queueIds).toContain('lThird')
    expect(queueIds).toContain('lFourth')
  })
})
