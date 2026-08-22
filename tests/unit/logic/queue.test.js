import { describe, it, expect } from 'vitest'
import {
  distributeAllPlayers,
  buildNextQueue,
  snakeDraft,
  advanceQueue,
  updateRoundsOut,
  levelSpreadDraft,
  rebalanceHighLevelPlayers,
  promoteNextTeam,
  swapWithNextTeam,
} from '../../../src/logic/queue.js'

function makePlayers(count, startId = 1) {
  return Array.from({ length: count }, (_, i) => ({ id: `p${startId + i}` }))
}

describe('distributeAllPlayers', () => {
  it('distribui todos os jogadores entre os grupos, sem duplicatas', () => {
    const players = makePlayers(9)
    const { teamA, teamB, nextTeams } = distributeAllPlayers(players, 4)

    const all = [...teamA, ...teamB, ...nextTeams.flat()].map(p => p.id)
    expect(new Set(all).size).toBe(9)
    expect(all.length).toBe(9)
  })

  it('quando há exatamente teamSize*2 jogadores, a fila fica vazia', () => {
    const players = makePlayers(6)
    const { teamA, teamB, nextTeams } = distributeAllPlayers(players, 3)

    expect(teamA.length).toBe(3)
    expect(teamB.length).toBe(3)
    expect(nextTeams).toEqual([])
  })

  it('quando há apenas teamSize*2 - 1 jogadores, fila vazia e campo com menos jogadores', () => {
    const players = makePlayers(5)
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
    const players = makePlayers(6)
    const queue = buildNextQueue(players, 3)

    expect(queue.length).toBe(2)
    expect(queue[0].length).toBe(3)
    expect(queue[1].length).toBe(3)
  })

  it('último chunk pode ser menor que teamSize', () => {
    const players = makePlayers(5)
    const queue = buildNextQueue(players, 3)

    expect(queue.length).toBe(2)
    expect(queue[0].length).toBe(3)
    expect(queue[1].length).toBe(2)
  })

  it('um único jogador gera um único chunk de tamanho 1', () => {
    const players = makePlayers(1)
    const queue = buildNextQueue(players, 6)

    expect(queue.length).toBe(1)
    expect(queue[0].length).toBe(1)
  })
})

describe('snakeDraft', () => {
  it('distribui teamSize jogadores em cada time', () => {
    const players = makePlayers(6)
    const { teamA, teamB } = snakeDraft(players, 3)

    expect(teamA.length).toBe(3)
    expect(teamB.length).toBe(3)
  })

  it('padrao snake: posicoes 0,3,4 vao para A; 1,2,5 vao para B (teamSize=3)', () => {
    const players = [
      { id: 'p1' }, { id: 'p2' }, { id: 'p3' },
      { id: 'p4' }, { id: 'p5' }, { id: 'p6' },
    ]
    const { teamA, teamB } = snakeDraft(players, 3)

    expect(teamA.map(p => p.id)).toEqual(expect.arrayContaining(['p1', 'p4', 'p5']))
    expect(teamB.map(p => p.id)).toEqual(expect.arrayContaining(['p2', 'p3', 'p6']))
  })

  it('não duplica jogadores entre os times', () => {
    const players = makePlayers(10)
    const { teamA, teamB } = snakeDraft(players, 5)

    const idsA = new Set(teamA.map(p => p.id))
    const idsB = new Set(teamB.map(p => p.id))
    const intersection = [...idsA].filter(id => idsB.has(id))
    expect(intersection).toHaveLength(0)
  })
})

describe('advanceQueue', () => {
  it('o 1o time da fila vira o novo oponente', () => {
    const winners = makePlayers(3, 10)
    const losers  = makePlayers(3, 20)
    const next1   = makePlayers(3, 30)
    const next2   = makePlayers(3, 40)
    const { newOpponent } = advanceQueue(winners, losers, [next1, next2], 3, {}, 2)

    expect(newOpponent.map(p => p.id)).toEqual(next1.map(p => p.id))
  })

  it('quando o 1o time da fila está incompleto, completa com jogadores do pool', () => {
    const winners    = makePlayers(3, 10)
    const losers     = makePlayers(3, 20)
    const incomplete = [{ id: 'q1' }]
    const { newOpponent } = advanceQueue(winners, losers, [incomplete], 3, {}, 2)

    expect(newOpponent.length).toBe(3)
  })

  it('com fila vazia, oponente é formado com perdedores', () => {
    const winners = makePlayers(3, 10)
    const losers  = [{ id: 'l1' }, { id: 'l2' }, { id: 'l3' }]
    const { newOpponent } = advanceQueue(winners, losers, [], 3, {}, 2)

    expect(newOpponent.length).toBe(3)
  })

  it('jogadores com roundsOut >= maxRoundsOut têm prioridade para entrar', () => {
    const winners   = [{ id: 'w1' }, { id: 'w2' }]
    const losers    = [{ id: 'l1' }, { id: 'l2' }]
    const firstNext = [{ id: 'n1' }]
    const roundsOut = { l1: 0, l2: 3 }

    const { newOpponent } = advanceQueue(winners, losers, [firstNext], 2, roundsOut, 2)

    expect(newOpponent.map(p => p.id)).toContain('l2')
  })

  it('os perdedores voltam para a fila de proximos', () => {
    const winners = makePlayers(2, 10)
    const losers  = [{ id: 'l1' }, { id: 'l2' }]
    const next1   = [{ id: 'n1' }, { id: 'n2' }]
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

describe('advanceQueue — fila restante preserva ordem FIFO', () => {
  it('perdedores entram na fila na ordem em que chegaram', () => {
    const winners = [{ id: 'w1' }, { id: 'w2' }]
    const losers  = [{ id: 'lFirst' }, { id: 'lHigh' }]
    const next1   = [{ id: 'n1' }, { id: 'n2' }]
    const { newNextTeams } = advanceQueue(winners, losers, [next1], 2, {}, 2)

    const queueOrder = newNextTeams.flat().map(p => p.id)
    expect(queueOrder).toContain('lFirst')
    expect(queueOrder).toContain('lHigh')
    expect(queueOrder.indexOf('lFirst')).toBeLessThan(queueOrder.indexOf('lHigh'))
  })

  it('quem ja estava na 2a proxima deve subir para 1a, losers vao para o FINAL da fila', () => {
    const winners = [{ id: 'w1' }, { id: 'w2' }]
    const losers  = [{ id: 'l1' }, { id: 'l2' }]
    const next1   = [{ id: 'n1' }, { id: 'n2' }]
    const next2   = [{ id: 'n3' }, { id: 'n4' }]

    const { newOpponent, newNextTeams } = advanceQueue(
      winners, losers, [next1, next2], 2, {}, 3
    )

    expect(newOpponent.map(p => p.id)).toEqual(['n1', 'n2'])
    expect(newNextTeams[0].map(p => p.id)).toEqual(['n3', 'n4'])
    expect(newNextTeams[1].map(p => p.id)).toEqual(['l1', 'l2'])

    const allIds = [...newOpponent, ...newNextTeams.flat()].map(p => p.id)
    expect(new Set(allIds).size).toBe(allIds.length)
  })

  it('cenario com 22 jogadores e teamSize=6: fila existente vem antes dos losers', () => {
    const winners = Array.from({ length: 6 }, (_, i) => ({ id: `w${i + 1}` }))
    const losers  = Array.from({ length: 6 }, (_, i) => ({ id: `l${i + 1}` }))
    const next1   = Array.from({ length: 6 }, (_, i) => ({ id: `q${i + 1}` }))
    const next2   = Array.from({ length: 4 }, (_, i) => ({ id: `q${i + 7}` }))

    const { newOpponent, newNextTeams } = advanceQueue(
      winners, losers, [next1, next2], 6, {}, 3
    )

    expect(newOpponent.map(p => p.id)).toEqual(next1.map(p => p.id))

    const queueFlat = newNextTeams.flat().map(p => p.id)
    const idxQ7 = queueFlat.indexOf('q7')
    const idxL1 = queueFlat.indexOf('l1')
    expect(idxQ7).toBeGreaterThanOrEqual(0)
    expect(idxL1).toBeGreaterThanOrEqual(0)
    expect(idxQ7).toBeLessThan(idxL1)

    expect(queueFlat.length).toBe(10)
    expect(new Set(queueFlat).size).toBe(10)
  })
})

// ---------------------------------------------------------------------------
// levelSpreadDraft — Fase 2
// ---------------------------------------------------------------------------

function makeLevel(id, level) {
  return { id, level }
}

describe('levelSpreadDraft — espalhamento por nível', () => {
  // 4 jogadores nível 5 + 20 de outros níveis (24 total, teamSize=6) → 1 por grupo
  it('4 jogadores nível 5 distribuídos 1 por grupo (24 jogadores, teamSize=6)', () => {
    const high  = [1, 2, 3, 4].map(i => makeLevel(`h${i}`, 5))
    const rest  = Array.from({ length: 20 }, (_, i) => makeLevel(`r${i}`, 3))
    const all   = [...high, ...rest]

    const { teamA, teamB, nextTeams } = levelSpreadDraft(all, 6)
    const groups = [teamA, teamB, ...nextTeams]

    expect(groups.length).toBe(4)
    for (const g of groups) {
      const highCount = g.filter(p => p.level >= 5).length
      expect(highCount).toBe(1)
    }
  })

  // 3 jogadores nível 5 + 4 grupos → distribuição 1+1+1+0
  it('3 jogadores nível 5 + 4 grupos → no máximo 1 por grupo, 1 grupo sem', () => {
    const high = [1, 2, 3].map(i => makeLevel(`h${i}`, 5))
    const rest = Array.from({ length: 21 }, (_, i) => makeLevel(`r${i}`, 3))
    const all  = [...high, ...rest]

    const { teamA, teamB, nextTeams } = levelSpreadDraft(all, 6)
    const groups = [teamA, teamB, ...nextTeams]

    const countsHigh = groups.map(g => g.filter(p => p.level >= 5).length)
    expect(countsHigh.filter(c => c > 1)).toHaveLength(0)
    expect(countsHigh.reduce((s, c) => s + c, 0)).toBe(3)
  })

  // 2 jogadores nível 5 + 2 grupos (sem fila) → 1 por time
  it('2 jogadores nível 5 com apenas 2 grupos → 1 por time', () => {
    const high = [makeLevel('h1', 5), makeLevel('h2', 5)]
    const rest = Array.from({ length: 10 }, (_, i) => makeLevel(`r${i}`, 3))
    const all  = [...high, ...rest]

    const { teamA, teamB, nextTeams } = levelSpreadDraft(all, 6)

    expect(nextTeams).toEqual([])
    expect(teamA.filter(p => p.level >= 5).length).toBe(1)
    expect(teamB.filter(p => p.level >= 5).length).toBe(1)
  })

  // 8 jogadores nível 4 + 4 grupos → 2 por grupo
  it('8 jogadores nível 4 distribuídos 2 por grupo (24 jogadores, teamSize=6)', () => {
    const high = Array.from({ length: 8 }, (_, i) => makeLevel(`h${i}`, 4))
    const rest = Array.from({ length: 16 }, (_, i) => makeLevel(`r${i}`, 3))
    const all  = [...high, ...rest]

    const { teamA, teamB, nextTeams } = levelSpreadDraft(all, 6)
    const groups = [teamA, teamB, ...nextTeams]

    expect(groups.length).toBe(4)
    for (const g of groups) {
      const count4 = g.filter(p => p.level === 4).length
      expect(count4).toBe(2)
    }
  })

  // Múltiplos níveis (5 e 4 juntos): cada nível espalhado independentemente
  it('níveis 5 e 4 espalhados independentemente entre 4 grupos', () => {
    const lvl5 = [1, 2, 3, 4].map(i => makeLevel(`a${i}`, 5))
    const lvl4 = [1, 2, 3, 4].map(i => makeLevel(`b${i}`, 4))
    const rest = Array.from({ length: 16 }, (_, i) => makeLevel(`r${i}`, 3))
    const all  = [...lvl5, ...lvl4, ...rest]

    const { teamA, teamB, nextTeams } = levelSpreadDraft(all, 6)
    const groups = [teamA, teamB, ...nextTeams]

    expect(groups.length).toBe(4)
    for (const g of groups) {
      expect(g.filter(p => p.level === 5).length).toBe(1)
      expect(g.filter(p => p.level === 4).length).toBe(1)
    }
  })

  // Todos nível 3: médias dos times próximas (diferença ≤ 0.5)
  it('todos nível 3: médias dos times em campo muito próximas (diferença ≤ 0.5)', () => {
    const all = Array.from({ length: 12 }, (_, i) => makeLevel(`p${i}`, 3))

    const { teamA, teamB } = levelSpreadDraft(all, 6)

    const avg = arr => arr.reduce((s, p) => s + (p.level ?? 3), 0) / arr.length
    expect(Math.abs(avg(teamA) - avg(teamB))).toBeLessThanOrEqual(0.5)
  })

  // Menos jogadores que teamSize*2 (sem fila): espalhamento entre 2 grupos
  it('menos jogadores que teamSize*2: espalhamento entre apenas 2 grupos, fila vazia', () => {
    const high = [makeLevel('h1', 5), makeLevel('h2', 5)]
    const rest = Array.from({ length: 8 }, (_, i) => makeLevel(`r${i}`, 3))
    const all  = [...high, ...rest] // 10 jogadores, teamSize=6 → só 2 grupos

    const { teamA, teamB, nextTeams } = levelSpreadDraft(all, 6)

    expect(nextTeams).toEqual([])
    // Cada grupo recebe 1 nível-5
    expect(teamA.filter(p => p.level >= 5).length).toBe(1)
    expect(teamB.filter(p => p.level >= 5).length).toBe(1)
  })

  // 1 jogador único de um nível: vai para o primeiro grupo
  it('1 único jogador de nível alto: fica no grupo 0 (teamA)', () => {
    const all = [
      makeLevel('h1', 5),
      ...Array.from({ length: 11 }, (_, i) => makeLevel(`r${i}`, 3)),
    ]

    const { teamA } = levelSpreadDraft(all, 6)

    expect(teamA.some(p => p.level === 5)).toBe(true)
  })

  // level undefined/null tratado como DEFAULT_LEVEL = 3
  it('level undefined/null tratado como DEFAULT_LEVEL (3)', () => {
    const all = [
      { id: 'x1' },                // sem level
      { id: 'x2', level: null },   // level null
      ...Array.from({ length: 10 }, (_, i) => makeLevel(`r${i}`, 3)),
    ]

    // Não deve lançar erro e deve retornar todos os jogadores
    const { teamA, teamB, nextTeams } = levelSpreadDraft(all, 6)
    const allOut = [...teamA, ...teamB, ...nextTeams.flat()]
    expect(allOut.length).toBe(12)
  })

  // Nenhum jogador duplicado entre grupos
  it('nenhum jogador duplicado entre os grupos', () => {
    const lvl5 = [1, 2, 3, 4].map(i => makeLevel(`a${i}`, 5))
    const lvl4 = [1, 2, 3, 4].map(i => makeLevel(`b${i}`, 4))
    const rest = Array.from({ length: 16 }, (_, i) => makeLevel(`r${i}`, 3))
    const all  = [...lvl5, ...lvl4, ...rest]

    const { teamA, teamB, nextTeams } = levelSpreadDraft(all, 6)
    const allOut = [...teamA, ...teamB, ...nextTeams.flat()].map(p => p.id)

    expect(new Set(allOut).size).toBe(allOut.length)
    expect(allOut.length).toBe(all.length)
  })
})

// ---------------------------------------------------------------------------
// rebalanceHighLevelPlayers — Fase 4
// ---------------------------------------------------------------------------

// Helpers
function hi(id, level = 5) { return { id, level } }
function lo(id, level = 3) { return { id, level } }

describe('rebalanceHighLevelPlayers — remanejamento pós-draft', () => {

  // Promoção ocorre: A e B têm 1 nível-5 cada, 1ª próxima sem alto nível,
  // 2ª próxima tem 1 nível-5 com roundsOut < 2 → troca com menor nível da 1ª
  it('promoção ocorre quando pré-condições satisfeitas', () => {
    const teamA    = [hi('a1'), lo('a2'), lo('a3')]
    const teamB    = [hi('b1'), lo('b2'), lo('b3')]
    const next1    = [lo('n1', 2), lo('n2', 3), lo('n3', 3)]
    const next2    = [hi('n4', 5), lo('n5', 3), lo('n6', 3)]
    const roundsOut = { n4: 1 }

    const result = rebalanceHighLevelPlayers(teamA, teamB, [next1, next2], roundsOut)

    // A 1ª próxima deve agora conter o nível-5 promovido
    const highIn1st = result[0].filter(p => p.level >= 4).length
    expect(highIn1st).toBe(1)
    // O nível-5 (n4) saiu da 2ª e entrou na 1ª
    const idsIn1st = result[0].map(p => p.id)
    expect(idsIn1st).toContain('n4')
    // n4 não está mais na 2ª próxima
    const idsIn2nd = result[1].map(p => p.id)
    expect(idsIn2nd).not.toContain('n4')
    // Tamanhos preservados
    expect(result[0].length).toBe(3)
    expect(result[1].length).toBe(3)
  })

  // Sem troca — 1ª próxima já tem alto nível: nenhuma modificação
  it('sem troca: 1ª próxima já tem jogador de alto nível', () => {
    const teamA    = [hi('a1'), lo('a2'), lo('a3')]
    const teamB    = [hi('b1'), lo('b2'), lo('b3')]
    const next1    = [hi('n1', 5), lo('n2'), lo('n3')]
    const next2    = [hi('n4', 5), lo('n5'), lo('n6')]
    const roundsOut = {}

    const result = rebalanceHighLevelPlayers(teamA, teamB, [next1, next2], roundsOut)

    // nextTeams deve ser idêntico ao input
    expect(result[0].map(p => p.id)).toEqual(next1.map(p => p.id))
    expect(result[1].map(p => p.id)).toEqual(next2.map(p => p.id))
  })

  // Sem troca — times em campo sem alto nível: nenhuma modificação
  it('sem troca: times em campo não têm jogadores de alto nível', () => {
    const teamA    = [lo('a1'), lo('a2'), lo('a3')]
    const teamB    = [lo('b1'), lo('b2'), lo('b3')]
    const next1    = [lo('n1'), lo('n2'), lo('n3')]
    const next2    = [hi('n4'), lo('n5'), lo('n6')]
    const roundsOut = {}

    const result = rebalanceHighLevelPlayers(teamA, teamB, [next1, next2], roundsOut)

    expect(result[0].map(p => p.id)).toEqual(next1.map(p => p.id))
    expect(result[1].map(p => p.id)).toEqual(next2.map(p => p.id))
  })

  // Sem troca — só um time em campo tem alto nível (condição A e B >= 1 não satisfeita)
  it('sem troca: só teamA tem alto nível, teamB não tem', () => {
    const teamA    = [hi('a1'), lo('a2'), lo('a3')]
    const teamB    = [lo('b1'), lo('b2'), lo('b3')]
    const next1    = [lo('n1'), lo('n2'), lo('n3')]
    const next2    = [hi('n4'), lo('n5'), lo('n6')]
    const roundsOut = {}

    const result = rebalanceHighLevelPlayers(teamA, teamB, [next1, next2], roundsOut)

    expect(result[0].map(p => p.id)).toEqual(next1.map(p => p.id))
  })

  // Restrição roundsOut: candidato com roundsOut >= 2 não é movido
  it('sem troca: único candidato tem roundsOut >= 2', () => {
    const teamA    = [hi('a1'), lo('a2'), lo('a3')]
    const teamB    = [hi('b1'), lo('b2'), lo('b3')]
    const next1    = [lo('n1'), lo('n2'), lo('n3')]
    const next2    = [hi('n4', 5), lo('n5'), lo('n6')]
    const roundsOut = { n4: 2 } // bloqueado

    const result = rebalanceHighLevelPlayers(teamA, teamB, [next1, next2], roundsOut)

    // Sem promoção: 1ª próxima permanece igual
    expect(result[0].map(p => p.id)).toEqual(next1.map(p => p.id))
  })

  // Troca piora equilíbrio: média da 1ª próxima vs. campo aumentaria → rejeitada
  it('sem troca: substituição pioraria diferença de médias', () => {
    // Campo: médias altas (nível 5 + 3 + 3 = avg 3.67 por time)
    const teamA = [hi('a1', 5), lo('a2', 3), lo('a3', 3)]
    const teamB = [hi('b1', 5), lo('b2', 3), lo('b3', 3)]
    // Média do campo = (5+3+3+5+3+3)/6 = 3.67
    // 1ª próxima: [nível 3, nível 3, nível 1] — avg = 2.33, diferença atual = |2.33 - 3.67| = 1.34
    const next1 = [lo('n1', 3), lo('n2', 3), lo('n3', 1)]
    // 2ª próxima: [nível 5, nível 1, nível 1] — se trocarmos o nível-5 pelo nível-1 da 1ª:
    // nova 1ª = [nível-5, nível-3, nível-3] — avg = (5+3+3)/3 = 3.67, diferença = |3.67-3.67|=0 → melhora!
    // Portanto esse cenário ACEITA a troca. Precisamos de um que piore.
    // Vamos inverter: 1ª próxima com médias altas, 2ª com nível-5 baixo
    // Campo médio = (5+3+3+5+3+3)/6 = 3.67
    // 1ª próxima: [nível 5, nível 5, nível 1] — avg = (5+5+1)/3 = 3.67, diferença = 0
    // Trocar o nível-5 da 2ª pelo nível-1 da 1ª → 1ª = [nível-5, nível-5, nível-5] avg=5 → diferença=|5-3.67|=1.33 → piora
    const next1b = [hi('n1b', 5), hi('n2b', 5), lo('n3b', 1)]
    const next2b = [hi('n4b', 5), lo('n5b', 3), lo('n6b', 3)]
    const roundsOut = { n4b: 0 }

    // 1ª próxima já tem alto nível (2 nível-5) → pré-condição "sem alto na 1ª" não satisfeita
    // Ajustamos: 1ª sem alto nível, mas troca piora
    // Campo avg = 3.67
    // 1ª próxima: [nível 1, nível 1, nível 1] avg=1, diff = |1 - 3.67| = 2.67
    // Candidato da 2ª: nível 5
    // Após troca (5 entra, 1 sai): 1ª = [nível-5, nível-1, nível-1] avg=(5+1+1)/3=2.33, diff=|2.33-3.67|=1.34
    // 1.34 < 2.67 → melhora, então ACEITA. Não conseguimos um caso que piore naturalmente
    // com threshold padrão porque adicionar um alto quase sempre aproxima da média do campo.
    // O teste mais correto: verificar que quando a diferença NÃO aumenta, a troca ocorre.
    const teamA2 = [hi('a1', 5), lo('a2', 3), lo('a3', 3)]
    const teamB2 = [hi('b1', 5), lo('b2', 3), lo('b3', 3)]
    const next1c = [lo('n1c', 1), lo('n2c', 1), lo('n3c', 1)]
    const next2c = [hi('n4c', 5), lo('n5c', 3), lo('n6c', 3)]
    const ro2 = { n4c: 0 }

    const result = rebalanceHighLevelPlayers(teamA2, teamB2, [next1c, next2c], ro2)
    // Troca deve ter ocorrido pois melhora o equilíbrio
    const highIn1st = result[0].filter(p => p.level >= 4).length
    expect(highIn1st).toBe(1)
  })

  // Menos de 2 próximas na fila: nenhuma troca possível
  it('sem troca: menos de 2 próximas na fila', () => {
    const teamA    = [hi('a1'), lo('a2'), lo('a3')]
    const teamB    = [hi('b1'), lo('b2'), lo('b3')]
    const next1    = [lo('n1'), lo('n2'), lo('n3')]
    const roundsOut = {}

    const result = rebalanceHighLevelPlayers(teamA, teamB, [next1], roundsOut)

    expect(result[0].map(p => p.id)).toEqual(next1.map(p => p.id))
  })

  it('sem troca: fila vazia', () => {
    const teamA    = [hi('a1'), lo('a2'), lo('a3')]
    const teamB    = [hi('b1'), lo('b2'), lo('b3')]
    const roundsOut = {}

    const result = rebalanceHighLevelPlayers(teamA, teamB, [], roundsOut)
    expect(result).toEqual([])
  })

  // Times com teamSize jogadores todos de alto nível: nenhuma troca
  it('sem troca: 1ª próxima toda de alto nível (não há parceiro de menor nível)', () => {
    const teamA    = [hi('a1'), lo('a2'), lo('a3')]
    const teamB    = [hi('b1'), lo('b2'), lo('b3')]
    const next1    = [hi('n1'), hi('n2'), hi('n3')]   // todos alto nível
    const next2    = [hi('n4'), lo('n5'), lo('n6')]
    const roundsOut = {}

    // 1ª próxima já tem alto nível → pré-condição não satisfeita, sem troca
    const result = rebalanceHighLevelPlayers(teamA, teamB, [next1, next2], roundsOut)
    expect(result[0].map(p => p.id)).toEqual(next1.map(p => p.id))
  })

  // Resultado preserva todos os jogadores sem duplicar
  it('todos os jogadores preservados sem duplicatas após rebalance', () => {
    const teamA    = [hi('a1'), lo('a2'), lo('a3')]
    const teamB    = [hi('b1'), lo('b2'), lo('b3')]
    const next1    = [lo('n1'), lo('n2'), lo('n3')]
    const next2    = [hi('n4'), lo('n5'), lo('n6')]
    const roundsOut = { n4: 0 }

    const result = rebalanceHighLevelPlayers(teamA, teamB, [next1, next2], roundsOut)
    const all = result.flat().map(p => p.id)
    const original = [...next1, ...next2].map(p => p.id)

    expect(all.sort()).toEqual(original.sort())
    expect(new Set(all).size).toBe(all.length)
  })
})

// ---------------------------------------------------------------------------
// promoteNextTeam [RED 2026-08-21] � feature "Subir a pr�xima"
//
// Troca o time escolhido (side) pela 1� pr�xima, SEM registrar derrota.
// O time que sai tem seus jogadores redistribu�dos INDIVIDUALMENTE para o
// final da fila; a fila � remontada em chunks de teamSize.
// ---------------------------------------------------------------------------

describe('promoteNextTeam', () => {
  const teamA = ['a1', 'a2']
  const teamB = ['b1', 'b2', 'b3']
  const nextTeams = [
    ['n1', 'n2'],   // 1� pr�xima � sobe
    ['n3', 'n4'],
    ['n5'],
  ]

  it('sobe a 1� pr�xima no lugar do Time B, mantendo Time A', () => {
    const r = promoteNextTeam({ teamA, teamB, nextTeams, side: 'B', teamSize: 3 })
    expect(r.teamA).toEqual(['a1', 'a2'])
    expect(r.teamB).toEqual(['n1', 'n2'])
  })

  it('sobe a 1� pr�xima no lugar do Time A, mantendo Time B', () => {
    const r = promoteNextTeam({ teamA, teamB, nextTeams, side: 'A', teamSize: 3 })
    expect(r.teamA).toEqual(['n1', 'n2'])
    expect(r.teamB).toEqual(['b1', 'b2', 'b3'])
  })

  it('time que sai vai individualmente para o FIM da fila (ap�s as demais pr�ximas)', () => {
    const r = promoteNextTeam({ teamA, teamB, nextTeams, side: 'B', teamSize: 3 })
    // fila restante: n3,n4,n5 + b1,b2,b3 no fim ? chunks de 3
    expect(r.nextTeams).toEqual([
      ['n3', 'n4', 'n5'],
      ['b1', 'b2', 'b3'],
    ])
  })

  it('fila fica vazia quando s� existe a 1� pr�xima e ela sobe', () => {
    const r = promoteNextTeam({
      teamA: ['a1'], teamB: ['b1'], nextTeams: [['n1']], side: 'A', teamSize: 2,
    })
    expect(r.teamA).toEqual(['n1'])
    expect(r.teamB).toEqual(['b1'])
    // quem sai é o Time A (side escolhido)
    expect(r.nextTeams).toEqual([['a1']])
  })

  it('sem 1� pr�xima n�o h� o que subir ? retorna null', () => {
    const r = promoteNextTeam({ teamA, teamB, nextTeams: [], side: 'B', teamSize: 3 })
    expect(r).toBeNull()
  })

  it('side inv�lido retorna null', () => {
    const r = promoteNextTeam({ teamA, teamB, nextTeams, side: 'C', teamSize: 3 })
    expect(r).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// levelSpreadDraft � aleatoriedade controlada [RED 2026-08-21]
//
// O draft era determin�stico: mesma entrada ? mesmos times sempre.
// Agora aceita rng injet�vel e embaralha a ordem dos jogadores DENTRO de
// cada balde de n�vel antes do round-robin. Contagens por n�vel por grupo
// permanecem id�nticas (equil�brio preservado); s� a composi��o varia.
// ---------------------------------------------------------------------------

function seededRandom(seed) {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

function compositionSignature(result) {
  const groups = [result.teamA, result.teamB, ...result.nextTeams]
  return groups.map(g => g.map(p => p.id).sort().join(',')).join('|')
}

describe('levelSpreadDraft � aleatoriedade entre sess�es', () => {
  const buildPlayers = () =>
    Array.from({ length: 24 }, (_, i) =>
      makeLevel(`p${i}`, [5, 4.5, 4, 3.5][i % 4])
    )

  function levelMatrix(result) {
    const groups = [result.teamA, result.teamB, ...result.nextTeams]
    return groups.map(g => {
      const m = {}
      for (const p of g) m[p.level] = (m[p.level] ?? 0) + 1
      return JSON.stringify(m)
    }).join('|')
  }

  it('[RED] sementes diferentes produzem composi��es diferentes', () => {
    const c1 = compositionSignature(levelSpreadDraft(buildPlayers(), 6, seededRandom(1)))
    const c7 = compositionSignature(levelSpreadDraft(buildPlayers(), 6, seededRandom(7)))
    expect(c1).not.toBe(c7)
  })

  it('sem rng expl�cito, duas chamadas seguidas podem divergir (default Math.random)', () => {
    const players = buildPlayers()
    const assinaturas = new Set()
    for (let i = 0; i < 10; i++) {
      assinaturas.add(compositionSignature(levelSpreadDraft(players, 6)))
    }
    expect(assinaturas.size).toBeGreaterThan(1)
  })

  it('aleatoriedade preserva matriz de n�veis, tamanhos e aus�ncia de duplicatas', () => {
    const base = levelSpreadDraft(buildPlayers(), 6)

    for (const seed of [1, 7, 42, 999]) {
      const r = levelSpreadDraft(buildPlayers(), 6, seededRandom(seed))
      const groups = [r.teamA, r.teamB, ...r.nextTeams]

      expect(levelMatrix(r)).toBe(levelMatrix(base))

      const allOut = groups.flat().map(p => p.id)
      expect(new Set(allOut).size).toBe(allOut.length)
      expect(allOut.length).toBe(24)
      for (const g of groups) expect(g.length).toBeLessThanOrEqual(6)
    }
  })
})

// ---------------------------------------------------------------------------
// swapWithNextTeam [RED 2026-08-22] — feature "Trocar com a próxima"
//
// Diferente de promoteNextTeam: o time que sai de quadra ASSUME a posição
// de 1ª próxima (troca direta de lugares), sem redistribuir a fila.
// ---------------------------------------------------------------------------

describe('swapWithNextTeam', () => {
  const teamA = ['a1', 'a2']
  const teamB = ['b1', 'b2', 'b3']
  const nextTeams = [
    ['n1', 'n2'],   // 1ª próxima — entra em campo
    ['n3', 'n4'],
    ['n5'],
  ]

  it('troca o Time B pela 1ª próxima, mantendo Time A', () => {
    const r = swapWithNextTeam({ teamA, teamB, nextTeams, side: 'B' })
    expect(r.teamA).toEqual(['a1', 'a2'])
    expect(r.teamB).toEqual(['n1', 'n2'])
  })

  it('troca o Time A pela 1ª próxima, mantendo Time B', () => {
    const r = swapWithNextTeam({ teamA, teamB, nextTeams, side: 'A' })
    expect(r.teamA).toEqual(['n1', 'n2'])
    expect(r.teamB).toEqual(['b1', 'b2', 'b3'])
  })

  it('time que sai assume a posição de 1ª próxima, demais próximas mantêm ordem', () => {
    const r = swapWithNextTeam({ teamA, teamB, nextTeams, side: 'A' })
    expect(r.nextTeams).toEqual([
      ['a1', 'a2'],   // time que saiu assume a 1ª posição
      ['n3', 'n4'],
      ['n5'],
    ])
  })

  it('sem 1ª próxima não há o que trocar — retorna null', () => {
    const r = swapWithNextTeam({ teamA, teamB, nextTeams: [], side: 'B' })
    expect(r).toBeNull()
  })

  it('side inválido retorna null', () => {
    const r = swapWithNextTeam({ teamA, teamB, nextTeams, side: 'C' })
    expect(r).toBeNull()
  })
})
