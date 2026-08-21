import { describe, it, expect } from 'vitest'
import { computeSessionStats, computeWinStreak } from '../../../src/logic/session-stats'

function match(id, { status = 'finished', a = [], b = [], winner = 'A' } = {}) {
  return {
    id,
    status,
    teams: { A: a, B: b },
    nextTeams: [],
    winner,
  }
}

const players = [
  { id: 'ana', name: 'Ana' },
  { id: 'bruno', name: 'Bruno' },
  { id: 'carla', name: 'Carla' },
  { id: 'davi', name: 'Davi' },
]

describe('computeSessionStats — total de partidas', () => {
  it('sessão com 3 partidas finalizadas → totalMatches = 3', () => {
    const matches = [
      match('m1', { a: ['ana'], b: ['bruno'], winner: 'A' }),
      match('m2', { a: ['carla'], b: ['davi'], winner: 'B' }),
      match('m3', { a: ['ana'], b: ['carla'], winner: 'A' }),
    ]
    const stats = computeSessionStats(matches, players)
    expect(stats.totalMatches).toBe(3)
  })

  it('sessão sem partidas → totalMatches = 0 e ranking vazio', () => {
    const stats = computeSessionStats([], players)
    expect(stats.totalMatches).toBe(0)
    expect(stats.ranking).toEqual([])
  })

  it('partidas canceladas são ignoradas no total', () => {
    const matches = [
      match('m1', { a: ['ana'], b: ['bruno'] }),
      match('m2', { status: 'cancelled', a: ['carla'], b: ['davi'] }),
    ]
    const stats = computeSessionStats(matches, players)
    expect(stats.totalMatches).toBe(1)
  })

  it('partidas em andamento são ignoradas no total', () => {
    const matches = [
      match('m1', { a: ['ana'], b: ['bruno'] }),
      match('m2', { status: 'ongoing', a: ['carla'], b: ['davi'] }),
    ]
    const stats = computeSessionStats(matches, players)
    expect(stats.totalMatches).toBe(1)
  })
})

describe('computeSessionStats — contagem por jogador', () => {
  it('jogador com 2 vitórias e 0 derrotas → 100% de vitórias', () => {
    const matches = [
      match('m1', { a: ['ana'], b: ['bruno'], winner: 'A' }),
      match('m2', { a: ['ana'], b: ['carla'], winner: 'A' }),
    ]
    const stats = computeSessionStats(matches, players)

    const ana = stats.ranking.find(r => r.id === 'ana')
    expect(ana.played).toBe(2)
    expect(ana.wins).toBe(2)
    expect(ana.losses).toBe(0)
    expect(ana.winPct).toBe(100)
  })

  it('jogador com 1 vitória e 1 derrota → 50% de vitórias', () => {
    const matches = [
      match('m1', { a: ['ana'], b: ['bruno'], winner: 'A' }),
      match('m2', { a: ['bruno'], b: ['carla'], winner: 'A' }),
    ]
    const stats = computeSessionStats(matches, players)

    const bruno = stats.ranking.find(r => r.id === 'bruno')
    expect(bruno.played).toBe(2)
    expect(bruno.wins).toBe(1)
    expect(bruno.losses).toBe(1)
    expect(bruno.winPct).toBe(50)
  })

  it('jogador que não jogou nenhuma partida não aparece no ranking', () => {
    const matches = [match('m1', { a: ['ana'], b: ['bruno'] })]
    const stats = computeSessionStats(matches, players)

    expect(stats.ranking.find(r => r.id === 'carla')).toBeUndefined()
    expect(stats.ranking.find(r => r.id === 'davi')).toBeUndefined()
  })

  it('jogador presente em múltiplos times acumula todas as participações', () => {
    const matches = [
      match('m1', { a: ['ana'], b: ['bruno'], winner: 'A' }),
      match('m2', { a: ['bruno'], b: ['carla'], winner: 'A' }),
      match('m3', { a: ['davi'], b: ['bruno'], winner: 'B' }),
    ]
    const stats = computeSessionStats(matches, players)

    const bruno = stats.ranking.find(r => r.id === 'bruno')
    expect(bruno.played).toBe(3)
  })

  it('soma de V/D do ranking confere com o total de participações', () => {
    const matches = [
      match('m1', { a: ['ana', 'bruno'], b: ['carla', 'davi'], winner: 'A' }),
      match('m2', { a: ['carla'], b: ['ana'], winner: 'B' }),
    ]
    const stats = computeSessionStats(matches, players)

    const totalPlayed = stats.ranking.reduce((sum, r) => sum + r.played, 0)
    const totalWins = stats.ranking.reduce((sum, r) => sum + r.wins, 0)
    const totalLosses = stats.ranking.reduce((sum, r) => sum + r.losses, 0)

    // m1: 4 participantes (2 vencedores, 2 perdedores); m2: 2 participantes (1 e 1)
    expect(totalPlayed).toBe(6)
    expect(totalWins).toBe(3)
    expect(totalLosses).toBe(3)
  })

  it('jogador removido da lista mas presente em partidas mantém estatísticas', () => {
    const matches = [match('m1', { a: ['ana'], b: ['fantasma'], winner: 'B' })]
    const stats = computeSessionStats(matches, players)

    const fantasma = stats.ranking.find(r => r.id === 'fantasma')
    expect(fantasma.played).toBe(1)
    expect(fantasma.wins).toBe(1)
  })
})

describe('computeSessionStats — ordenação do ranking', () => {
  it('ordena por % de vitórias decrescente', () => {
    const matches = [
      match('m1', { a: ['ana'], b: ['bruno'], winner: 'A' }),   // ana V, bruno D
      match('m2', { a: ['carla'], b: ['bruno'], winner: 'A' }), // carla V, bruno D
      match('m3', { a: ['bruno'], b: ['davi'], winner: 'A' }),  // bruno V, davi D
    ]
    // ana e carla: 100%; bruno: 33.3% (1V/2D); davi: 0%
    const stats = computeSessionStats(matches, players)
    const ids = stats.ranking.map(r => r.id)

    expect(ids.indexOf('ana')).toBeLessThan(ids.indexOf('bruno'))
    expect(ids.indexOf('carla')).toBeLessThan(ids.indexOf('bruno'))
    expect(ids[ids.length - 1]).toBe('davi')
  })

  it('empate no % é desempatado por mais partidas jogadas', () => {
    const matches = [
      // ana: 1V/0D (100%, 1 partida); bruno: 2V/0D (100%, 2 partidas)
      match('m1', { a: ['ana'], b: ['carla'], winner: 'A' }),
      match('m2', { a: ['bruno'], b: ['davi'], winner: 'A' }),
      match('m3', { a: ['bruno'], b: ['carla'], winner: 'A' }),
    ]
    const stats = computeSessionStats(matches, players)

    const first = stats.ranking[0]
    expect(first.winPct).toBe(100)
    expect(first.played).toBe(2)
    expect(first.id).toBe('bruno')
  })

  it('winPct é arredondado para 1 casa decimal', () => {
    const matches = [
      match('m1', { a: ['ana'], b: ['bruno'], winner: 'A' }),   // bruno D
      match('m2', { a: ['carla'], b: ['bruno'], winner: 'A' }), // bruno D
      match('m3', { a: ['bruno'], b: ['davi'], winner: 'A' }),  // bruno V
    ]
    // bruno: 1V/2D → 33.333...% → 33.3
    const stats = computeSessionStats(matches, players)
    const bruno = stats.ranking.find(r => r.id === 'bruno')
    expect(bruno.winPct).toBeCloseTo(33.3, 5)
    expect(String(bruno.winPct)).toMatch(/^33\.3$/)
  })
})


// ---------------------------------------------------------------------------
// computeWinStreak(fieldTeamIds, finishedMatches) ? number [RED 2026-08-21]
//
// Streak do time em campo (grupo flexivel): conta vitorias consecutivas
// encadeadas � cada partida anterior precisa ter sido vencida por um time
// que compartilhe ao menos 1 jogador com o campeao da sequencia.
// Substituicoes de jogadores NAO zeram o streak; derrota zera.
// ---------------------------------------------------------------------------

function finMatch(id, aIds, bIds, winner) {
  return { id, status: 'finished', teams: { A: aIds, B: bIds }, winner }
}

describe('computeWinStreak', () => {
  it('historico vazio ou sem campo ? 0', () => {
    expect(computeWinStreak(['p1'], [])).toBe(0)
  })

  it('venceu a ultima partida pela primeira vez ? 1', () => {
    const matches = [finMatch('m1', ['p1', 'p2'], ['p3', 'p4'], 'A')]
    expect(computeWinStreak(['p1', 'p2'], matches)).toBe(1)
  });

  it('duas vitorias seguidas do mesmo grupo ? 2', () => {
    const matches = [
      finMatch('m1', ['p1', 'p2'], ['p3', 'p4'], 'A'),
      finMatch('m2', ['p1', 'p2'], ['p5', 'p6'], 'A'),
    ]
    expect(computeWinStreak(['p1', 'p2'], matches)).toBe(2)
  })

  it('substituicao nao zera: cadeia por interseccao de jogadores', () => {
    const matches = [
      finMatch('m1', ['p1', 'p2'], ['p3', 'p4'], 'A'),        // p1,p2 campeoes
      finMatch('m2', ['p1', 'p5'], ['p3', 'p4'], 'A'),        // p1 ficou (flexivel), p5 substituiu p2
      finMatch('m3', ['p1', 'p5'], ['p6', 'p7'], 'A'),        // mesma dupla venceu de novo
    ]
    expect(computeWinStreak(['p1', 'p5'], matches)).toBe(3)
  })

  it('desafiante que venceu o campeao comeca com streak 1', () => {
    const matches = [
      finMatch('m1', ['p1', 'p2'], ['p3', 'p4'], 'A'),
      finMatch('m2', ['p1', 'p2'], ['p3', 'p4'], 'B'),
    ]
    expect(computeWinStreak(['p3', 'p4'], matches)).toBe(1)
  })

  it('cadeia quebra quando vencedor nao tem ligacao com o campeao', () => {
    const matches = [
      finMatch('m1', ['p9', 'p10'], ['p8', 'p11'], 'A'),      // vencido por grupo sem ligacao
      finMatch('m2', ['p1', 'p2'], ['p3', 'p4'], 'A'),        // campeao atual venceu m2
    ]
    expect(computeWinStreak(['p1', 'p2'], matches)).toBe(1)
  })
})
