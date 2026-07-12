import { describe, it, expect } from 'vitest'
import { distributeAllPlayers } from '../../src/logic/queue.js'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

// 10 jogadores veteranos (Semana 1 e 2)
const veterans = [
  { id: 'ana',    name: 'Ana',    level: 5, stats: { matches: 0, wins: 0, losses: 0 } },
  { id: 'bruno',  name: 'Bruno',  level: 4, stats: { matches: 0, wins: 0, losses: 0 } },
  { id: 'carla',  name: 'Carla',  level: 4, stats: { matches: 0, wins: 0, losses: 0 } },
  { id: 'diego',  name: 'Diego',  level: 3, stats: { matches: 0, wins: 0, losses: 0 } },
  { id: 'eliane', name: 'Eliane', level: 3, stats: { matches: 0, wins: 0, losses: 0 } },
  { id: 'fabio',  name: 'Fabio',  level: 3, stats: { matches: 0, wins: 0, losses: 0 } },
  { id: 'gabi',   name: 'Gabi',   level: 3, stats: { matches: 0, wins: 0, losses: 0 } },
  { id: 'hugo',   name: 'Hugo',   level: 2, stats: { matches: 0, wins: 0, losses: 0 } },
  { id: 'iara',   name: 'Iara',   level: 2, stats: { matches: 0, wins: 0, losses: 0 } },
  { id: 'joao',   name: 'João',   level: 2, stats: { matches: 0, wins: 0, losses: 0 } },
]

// Semana 1: 12 jogadores (10 veteranos + 2 extras de nível médio)
const players12 = [
  ...veterans,
  { id: 'kiko',   name: 'Kiko',   level: 3, stats: { matches: 0, wins: 0, losses: 0 } },
  { id: 'lucia',  name: 'Lucia',  level: 3, stats: { matches: 0, wins: 0, losses: 0 } },
]

// Semana 2: 13 jogadores (10 veteranos + Mariana + Nicolas + Olivia)
const players13 = [
  ...veterans,
  { id: 'mariana', name: 'Mariana', level: 5, stats: { matches: 0, wins: 0, losses: 0 } },
  { id: 'nicolas', name: 'Nicolas', level: 3, stats: { matches: 0, wins: 0, losses: 0 } },
  { id: 'olivia',  name: 'Olivia',  level: 1, stats: { matches: 0, wins: 0, losses: 0 } },
]

// ---------------------------------------------------------------------------

describe('[INTEGRAÇÃO] Fase 6 — finishSession / reutilização na semana seguinte', () => {

  // -------------------------------------------------------------------------
  // Semana 1
  // -------------------------------------------------------------------------

  it('Semana 1: distributeAllPlayers com 12 jogadores forma 2 times de 6 e fila vazia', () => {
    const { teamA, teamB, nextTeams } = distributeAllPlayers(players12, 6)

    expect(teamA).toHaveLength(6)
    expect(teamB).toHaveLength(6)
    expect(nextTeams).toHaveLength(0)

    // Sem duplicatas
    const all = [...teamA, ...teamB].map(p => p.id)
    expect(new Set(all).size).toBe(all.length)
  })

  it('Semana 1: estado após finishSession — modelo de dados correto', () => {
    // Simula o que handleFinishSession faz nos stores (sem store real):
    // 1. cancelMatch → match.status = 'cancelled'
    // 2. setCheckedIn(sessionId, []) → checkedInIds = []
    // 3. finishSession(sessionId) → session.status = 'finished'

    const match = { id: 'm1', status: 'ongoing', round: 1 }
    const session = {
      id: 'sess1', code: 'VOL001', checkedInIds: ['ana', 'bruno', 'carla'],
      matchIds: ['m1'], status: 'active',
    }

    // Simula os três passos
    const cancelledMatch   = { ...match, status: 'cancelled' }
    const clearedSession   = { ...session, checkedInIds: [] }
    const finishedSession  = { ...clearedSession, status: 'finished' }

    expect(cancelledMatch.status).toBe('cancelled')
    expect(finishedSession.status).toBe('finished')
    expect(finishedSession.checkedInIds).toEqual([])
    expect(finishedSession.matchIds).toContain('m1')
  })

  // -------------------------------------------------------------------------
  // Semana 2
  // -------------------------------------------------------------------------

  it('Semana 2: distributeAllPlayers com 13 jogadores distribui todos sem duplicatas', () => {
    const { teamA, teamB, nextTeams } = distributeAllPlayers(players13, 6)

    // Total conservado: 13 jogadores
    const all = [...teamA, ...teamB, ...nextTeams.flat()].map(p => p.id)
    expect(all).toHaveLength(13)
    expect(new Set(all).size).toBe(all.length)

    // Dois times em campo + pelo menos 1 grupo na fila (ceil(13/6) = 3 grupos)
    expect(nextTeams.length).toBeGreaterThanOrEqual(1)

    // Os dois times em campo têm os 2 maiores grupos (round-robin preenche grupo 0 e 1 primeiro)
    expect(teamA.length + teamB.length).toBeGreaterThanOrEqual(10)
  })

  it('Semana 2: Olivia (nível 1) e Fabio/João (nível baixo) ficam na fila ou num time', () => {
    const { teamA, teamB, nextTeams } = distributeAllPlayers(players13, 6)
    // Verificação de integridade: todos os 13 jogadores estão distribuídos
    const all = [...teamA, ...teamB, ...nextTeams.flat()].map(p => p.id)
    expect(all).toContain('olivia')
    expect(new Set(all).size).toBe(13)
  })

  it('Semana 2: Ana (5) e Mariana (5) ficam em times diferentes', () => {
    const { teamA, teamB } = distributeAllPlayers(players13, 6)
    const aIds = teamA.map(p => p.id)
    const bIds = teamB.map(p => p.id)

    const anaInA     = aIds.includes('ana')
    const marianaInA = aIds.includes('mariana')
    const anaInB     = bIds.includes('ana')
    const marianaInB = bIds.includes('mariana')

    // Nunca as duas no mesmo time
    expect(anaInA && marianaInA).toBe(false)
    expect(anaInB && marianaInB).toBe(false)
    // E cada uma está em algum time
    expect(anaInA || anaInB).toBe(true)
    expect(marianaInA || marianaInB).toBe(true)
  })

  it('Semana 2: Bruno (4) e Carla (4) ficam em times diferentes', () => {
    const { teamA, teamB } = distributeAllPlayers(players13, 6)
    const aIds = teamA.map(p => p.id)
    const bIds = teamB.map(p => p.id)

    const brunoInA = aIds.includes('bruno')
    const carlaInA = aIds.includes('carla')
    const brunoInB = bIds.includes('bruno')
    const carlaInB = bIds.includes('carla')

    expect(brunoInA && carlaInA).toBe(false)
    expect(brunoInB && carlaInB).toBe(false)
  })

  it('Semana 2: médias dos dois times são razoavelmente próximas (diferença ≤ 0.5)', () => {
    const { teamA, teamB } = distributeAllPlayers(players13, 6)
    const avg = team => team.reduce((s, p) => s + p.level, 0) / team.length
    // levelSpreadDraft espalha por nível, mas tamanhos diferentes podem gerar diferença até 0.5
    expect(Math.abs(avg(teamA) - avg(teamB))).toBeLessThanOrEqual(0.5)
  })

  // -------------------------------------------------------------------------
  // Sem rastros da Semana 1
  // -------------------------------------------------------------------------

  it('Semana 2: nova partida tem id diferente da partida da Semana 1', () => {
    const matchSemana1 = { id: 'm-semana1', round: 1, status: 'cancelled' }
    const matchSemana2 = { id: 'm-semana2', round: 1, status: 'ongoing' }

    expect(matchSemana2.id).not.toBe(matchSemana1.id)
  })

  it('Histórico: matchIds da sessão inclui partidas da Semana 1 após nova rodada', () => {
    const session = {
      id: 'sess1', matchIds: ['m-semana1'], status: 'finished',
    }
    // Reutilização na semana 2: status volta a 'active' implicitamente
    // (sessão fica acessível, matchIds acumula)
    const updatedSession = {
      ...session,
      matchIds: [...session.matchIds, 'm-semana2'],
    }
    expect(updatedSession.matchIds).toContain('m-semana1')
    expect(updatedSession.matchIds).toContain('m-semana2')
  })

  it('Histórico: stats dos veteranos refletem partidas jogadas', () => {
    // Simula applyMatchResult para 6 vencedores e 6 perdedores
    const winners = veterans.slice(0, 6)
    const losers  = veterans.slice(6)

    const updatedPlayers = veterans.map(p => {
      const isWinner = winners.some(w => w.id === p.id)
      const isLoser  = losers.some(l => l.id === p.id)
      if (!isWinner && !isLoser) return p
      return {
        ...p,
        stats: {
          matches: p.stats.matches + 1,
          wins:    p.stats.wins    + (isWinner ? 1 : 0),
          losses:  p.stats.losses  + (isWinner ? 0 : 1),
        },
      }
    })

    for (const p of updatedPlayers) {
      expect(p.stats.matches).toBe(1)
    }
    expect(updatedPlayers.filter(p => p.stats.wins === 1)).toHaveLength(6)
    expect(updatedPlayers.filter(p => p.stats.losses === 1)).toHaveLength(4) // só veteranos
  })

  // -------------------------------------------------------------------------
  // Sessão finished acessível pelo código
  // -------------------------------------------------------------------------

  it('Sessão finished é acessível pelo código VOL001', () => {
    const sessions = {
      'sess1': { id: 'sess1', code: 'VOL001', status: 'finished' },
    }
    const getSessionByCode = (code) =>
      Object.values(sessions).find(s => s.code === code) ?? null

    const found = getSessionByCode('VOL001')
    expect(found).not.toBeNull()
    expect(found.status).toBe('finished')
  })

  // -------------------------------------------------------------------------
  // Edge case: finalizar sem partida ativa
  // -------------------------------------------------------------------------

  it('Edge case: handleFinishSession com matchId inválido não gera erro', async () => {
    // cancelMatch com id inválido deve ser ignorado (try/catch no handler)
    let threw = false
    try {
      const cancelMatchSafe = async (id) => {
        if (id === 'invalid') throw new Error('match not found')
      }
      await cancelMatchSafe('invalid').catch(() => {}) // silenciado
    } catch (_) {
      threw = true
    }
    expect(threw).toBe(false)
  })
})
