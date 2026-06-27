import { describe, it, expect } from 'vitest'
import { formTeams, teamAverage, shuffleTeams } from './balancing.js'

function makePlayers(ratings) {
  return ratings.map((r, i) => ({ id: `p${i + 1}`, rating: r }))
}

describe('formTeams', () => {
  it('coloca teamSize*2 jogadores nos times e o restante em waiting', () => {
    const players = makePlayers([90, 80, 70, 60, 50, 40, 30, 20])
    const { teamA, teamB, waiting } = formTeams(players, 3)

    expect(teamA.length).toBe(3)
    expect(teamB.length).toBe(3)
    expect(waiting.length).toBe(2)
  })

  it('usa teamSize=6 como padrão', () => {
    const players = makePlayers([90, 85, 80, 75, 70, 65, 60, 55, 50, 45, 40, 35, 30, 25])
    const { teamA, teamB, waiting } = formTeams(players)

    expect(teamA.length).toBe(6)
    expect(teamB.length).toBe(6)
    expect(waiting.length).toBe(2)
  })

  it('os jogadores em waiting têm os menores ratings', () => {
    const players = makePlayers([90, 80, 70, 60, 50, 40, 30, 20])
    const { waiting } = formTeams(players, 3)

    const waitingRatings = waiting.map(p => p.rating)
    const maxWaiting = Math.max(...waitingRatings)
    expect(maxWaiting).toBeLessThanOrEqual(40)
  })

  it('não duplica jogadores entre teamA, teamB e waiting', () => {
    const players = makePlayers([90, 80, 70, 60, 50, 40, 30, 20, 10])
    const { teamA, teamB, waiting } = formTeams(players, 4)

    const all = [...teamA, ...teamB, ...waiting].map(p => p.id)
    const unique = new Set(all)
    expect(unique.size).toBe(all.length)
  })

  it('quando há exatamente teamSize*2 jogadores, waiting fica vazio', () => {
    const players = makePlayers([90, 80, 70, 60, 50, 40])
    const { waiting } = formTeams(players, 3)

    expect(waiting).toHaveLength(0)
  })

  it('médias dos times são próximas (diferença ≤ 10) com 8 jogadores, teamSize=4', () => {
    const players = makePlayers([100, 90, 80, 70, 60, 50, 40, 30])
    const { teamA, teamB } = formTeams(players, 4)

    const diff = Math.abs(teamAverage(teamA) - teamAverage(teamB))
    expect(diff).toBeLessThanOrEqual(10)
  })
})

describe('teamAverage', () => {
  it('retorna 0 para time vazio', () => {
    expect(teamAverage([])).toBe(0)
  })

  it('calcula a média corretamente para um time simples', () => {
    const team = makePlayers([80, 60, 40])
    expect(teamAverage(team)).toBe(60)
  })

  it('arredonda a média para inteiro', () => {
    const team = makePlayers([100, 50])
    expect(teamAverage(team)).toBe(75)

    const team2 = makePlayers([100, 51])
    expect(teamAverage(team2)).toBe(76)
  })

  it('funciona com um único jogador', () => {
    const team = [{ id: 'x', rating: 73 }]
    expect(teamAverage(team)).toBe(73)
  })
})

describe('shuffleTeams', () => {
  it('mantém o mesmo total de jogadores após o shuffle', () => {
    const a = makePlayers([90, 70, 50, 30])
    const b = makePlayers([80, 60, 40, 20])
    const { teamA, teamB } = shuffleTeams(a, b, 2)

    expect(teamA.length).toBe(4)
    expect(teamB.length).toBe(4)
  })

  it('não duplica jogadores: todos os IDs originais continuam presentes', () => {
    const a = makePlayers([90, 70, 50, 30])
    const b = makePlayers([80, 60, 40, 20])
    const original = new Set([...a, ...b].map(p => p.id))
    const { teamA, teamB } = shuffleTeams(a, b, 3)

    const result = new Set([...teamA, ...teamB].map(p => p.id))
    expect(result).toEqual(original)
  })

  it('com swaps=0 os times ficam inalterados ou diferentes (aceitável dado o pool aleatório)', () => {
    const a = makePlayers([90, 70])
    const b = makePlayers([80, 60])
    const { teamA, teamB } = shuffleTeams(a, b, 0)

    expect(new Set(teamA.map(p => p.id))).toEqual(new Set(a.map(p => p.id)))
    expect(new Set(teamB.map(p => p.id))).toEqual(new Set(b.map(p => p.id)))
  })

  it('não mistura o mesmo jogador nos dois times ao mesmo tempo', () => {
    const a = [
      { id: 'a1', rating: 90 },
      { id: 'a2', rating: 80 },
      { id: 'a3', rating: 70 },
      { id: 'a4', rating: 60 },
      { id: 'a5', rating: 50 },
    ]
    const b = [
      { id: 'b1', rating: 85 },
      { id: 'b2', rating: 75 },
      { id: 'b3', rating: 65 },
      { id: 'b4', rating: 55 },
      { id: 'b5', rating: 45 },
    ]
    const { teamA, teamB } = shuffleTeams(a, b, 3)

    const idsA = new Set(teamA.map(p => p.id))
    const idsB = new Set(teamB.map(p => p.id))
    const intersection = [...idsA].filter(id => idsB.has(id))
    expect(intersection).toHaveLength(0)
  })
})
