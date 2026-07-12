import { describe, it, expect } from 'vitest'
import { applyCheckinWithActiveMatch } from '../../src/logic/checkin-logic.js'

describe('[INTEGRACAO] fluxo exato do Checkin.jsx com dados do store', () => {
  function makeStoreGetPlayer(playerMap) {
    return (id) => playerMap[id] ?? undefined
  }

  it('BASICO: checkout da 1a proxima sem newcomers -- cascata deve ocorrer', () => {
    const teamA  = ['a1','a2','a3','a4','a5','a6']
    const teamB  = ['b1','b2','b3','b4','b5','b6']
    const next1  = ['q1','q2','q3','q4','q5','q6']
    const next2  = ['q7','q8','q9','q10','q11','q12']
    const pm = {}
    ;[...teamA,...teamB,...next1,...next2].forEach(id => { pm[id] = {id,rating:50} })
    const allInMatch = [...teamA,...teamB,...next1,...next2]
    const checkedInSet = new Set(allInMatch.filter(id => id !== 'q1'))
    const result = applyCheckinWithActiveMatch({
      teamA, teamB, nextTeams:[next1,next2],
      checkedInSet,
      presentPlayers: Object.values(pm).filter(p => checkedInSet.has(p.id)),
      currentInMatch: allInMatch, teamSize:6,
      getPlayer: makeStoreGetPlayer(pm),
    })
    const all = [...result.newTeamA,...result.newTeamB,...result.newNextTeams.flat()]
    expect(all).not.toContain('q1')
    expect(result.newNextTeams[0].length).toBe(6)
    expect(result.newNextTeams[1].length).toBe(5)
    expect(new Set(all).size).toBe(all.length)
  })

  it('BASICO: checkout do time A sem newcomers -- promove da proxima com cascata', () => {
    const teamA  = ['a1','a2','a3','a4','a5','a6']
    const teamB  = ['b1','b2','b3','b4','b5','b6']
    const next1  = ['q1','q2','q3','q4','q5','q6']
    const next2  = ['q7','q8','q9','q10','q11','q12']
    const pm = {}
    ;[...teamA,...teamB,...next1,...next2].forEach(id => { pm[id] = {id,rating:50} })
    const allInMatch = [...teamA,...teamB,...next1,...next2]
    const checkedInSet = new Set(allInMatch.filter(id => id !== 'a1'))
    const result = applyCheckinWithActiveMatch({
      teamA, teamB, nextTeams:[next1,next2],
      checkedInSet,
      presentPlayers: Object.values(pm).filter(p => checkedInSet.has(p.id)),
      currentInMatch: allInMatch, teamSize:6,
      getPlayer: makeStoreGetPlayer(pm),
    })
    const all = [...result.newTeamA,...result.newTeamB,...result.newNextTeams.flat()]
    expect(all).not.toContain('a1')
    expect(result.newTeamA.length).toBe(6)
    expect(result.newNextTeams[0].length).toBe(6)
    expect(result.newNextTeams[1].length).toBe(5)
    expect(new Set(all).size).toBe(all.length)
  })

  it('[RED] BUG-REAL: newcomers tardios nao devem substituir slot da proxima -- q7 deve estar na 1a', () => {
    // Partida comecou com 22 jogadores. late1 e late2 chegaram depois
    // (estao em checkedIn, mas NAO em currentInMatch).
    // q1 fez checkout da 1a proxima.
    //
    // ERRADO: late1 ou late2 iam para o slot de q1 diretamente na proxima.
    //         q7 nao subia. 2a proxima ficava cheia.
    //
    // CORRETO: q1 removida. q7 sobe da 2a para 1a (cascata).
    //          late1/late2 vao para o FINAL da fila, nao para posicao privilegiada.
    const teamA = ['a1','a2','a3','a4','a5','a6']
    const teamB = ['b1','b2','b3','b4','b5','b6']
    const next1 = ['q1','q2','q3','q4','q5','q6']
    const next2 = ['q7','q8','q9','q10','q11','q12']
    const pm = {}
    ;[...teamA,...teamB,...next1,...next2,'late1','late2'].forEach(id => { pm[id] = {id,rating:50} })
    const allInMatch = [...teamA,...teamB,...next1,...next2]
    const checkedInSet = new Set([...allInMatch.filter(id => id !== 'q1'), 'late1','late2'])

    const result = applyCheckinWithActiveMatch({
      teamA, teamB, nextTeams:[next1,next2],
      checkedInSet,
      presentPlayers: Object.values(pm).filter(p => checkedInSet.has(p.id)),
      currentInMatch: allInMatch,
      teamSize: 6,
      getPlayer: makeStoreGetPlayer(pm),
    })

    const queueFlat = result.newNextTeams.flat()
    const all = [...result.newTeamA,...result.newTeamB,...queueFlat]

    expect(all).not.toContain('q1')

    // q7 DEVE estar na 1a proxima (cascata funcionou)
    expect(result.newNextTeams[0]).toContain('q7')

    // late1 e late2 devem aparecer DEPOIS de q7 na fila
    const idxQ7    = queueFlat.indexOf('q7')
    const idxLate1 = queueFlat.indexOf('late1')
    expect(idxLate1).toBeGreaterThan(idxQ7)

    // Total conservado: 24 originais - 1 removido + 2 tardios = 25
    expect(all.length).toBe(25)
    expect(new Set(all).size).toBe(all.length)
  })

  it('[RED] BUG-REAL: checkout time A com newcomer tardio -- q1 sobe para time A, q7 sobe para 1a proxima', () => {
    // a1 faz checkout. late1 esta no checkedIn mas nao em currentInMatch.
    // CORRETO: q1 da 1a proxima sobe para time A.
    //          q7 da 2a sobe para a 1a.
    //          late1 vai para o FINAL da fila.
    const teamA = ['a1','a2','a3','a4','a5','a6']
    const teamB = ['b1','b2','b3','b4','b5','b6']
    const next1 = ['q1','q2','q3','q4','q5','q6']
    const next2 = ['q7','q8','q9','q10','q11','q12']
    const pm = {}
    ;[...teamA,...teamB,...next1,...next2,'late1'].forEach(id => { pm[id] = {id,rating:50} })
    const allInMatch = [...teamA,...teamB,...next1,...next2]
    const checkedInSet = new Set([...allInMatch.filter(id => id !== 'a1'), 'late1'])

    const result = applyCheckinWithActiveMatch({
      teamA, teamB, nextTeams:[next1,next2],
      checkedInSet,
      presentPlayers: Object.values(pm).filter(p => checkedInSet.has(p.id)),
      currentInMatch: allInMatch,
      teamSize: 6,
      getPlayer: makeStoreGetPlayer(pm),
    })

    const queueFlat = result.newNextTeams.flat()
    const all = [...result.newTeamA,...result.newTeamB,...queueFlat]

    expect(all).not.toContain('a1')
    expect(result.newTeamA.length).toBe(6)
    // q1 foi para o time A (primeiro da 1a proxima)
    expect(result.newTeamA).toContain('q1')

    // q7 deve estar na 1a proxima (cascata)
    expect(result.newNextTeams[0]).toContain('q7')

    // late1 vai para o FINAL
    const idxQ7    = queueFlat.indexOf('q7')
    const idxLate1 = queueFlat.indexOf('late1')
    expect(idxLate1).toBeGreaterThan(idxQ7)

    expect(new Set(all).size).toBe(all.length)
  })
})
