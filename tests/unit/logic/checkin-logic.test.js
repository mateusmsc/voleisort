import { describe, it, expect } from 'vitest'
import {
  insertPlayerIntoQueue,
  applySubstitutions,
  getRemovedFromMatch,
  getNewcomers,
  applyCheckinWithActiveMatch,
  fillGapsFromNextQueues,
} from '../../../src/logic/checkin-logic.js'

// ---------------------------------------------------------------------------
// insertPlayerIntoQueue
// ---------------------------------------------------------------------------
describe('insertPlayerIntoQueue', () => {
  it('cria nova fila quando vazia', () => {
    expect(insertPlayerIntoQueue([], 'p1', 6)).toEqual([['p1']])
  })

  it('encaixa no ultimo time se incompleto', () => {
    const result = insertPlayerIntoQueue([['a','b','c'],['d','e']], 'f', 3)
    expect(result).toEqual([['a','b','c'],['d','e','f']])
  })

  it('cria novo time se o ultimo ja estiver cheio', () => {
    const result = insertPlayerIntoQueue([['a','b','c'],['d','e','f']], 'g', 3)
    expect(result).toEqual([['a','b','c'],['d','e','f'],['g']])
  })

  it('nao muta a fila original', () => {
    const queue = [['a','b']]
    insertPlayerIntoQueue(queue, 'c', 3)
    expect(queue).toEqual([['a','b']])
  })

  it('funciona com teamSize=6 e unico time incompleto', () => {
    const result = insertPlayerIntoQueue([['a','b','c','d','e']], 'f', 6)
    expect(result[0].length).toBe(6)
    expect(result.length).toBe(1)
  })

  it('teamSize=6 com ultimo time cheio cria novo time', () => {
    const result = insertPlayerIntoQueue([['a','b','c','d','e','f']], 'g', 6)
    expect(result.length).toBe(2)
    expect(result[1]).toEqual(['g'])
  })
})

// ---------------------------------------------------------------------------
// getRemovedFromMatch
// ---------------------------------------------------------------------------
describe('getRemovedFromMatch', () => {
  it('retorna IDs que sairam do check-in', () => {
    expect(getRemovedFromMatch(['p1','p2','p3','p4'], new Set(['p1','p3']))).toEqual(['p2','p4'])
  })

  it('retorna vazio se nenhum saiu', () => {
    expect(getRemovedFromMatch(['p1','p2'], new Set(['p1','p2','p3']))).toEqual([])
  })

  it('retorna todos se check-in ficou vazio', () => {
    expect(getRemovedFromMatch(['p1','p2','p3'], new Set())).toEqual(['p1','p2','p3'])
  })
})

// ---------------------------------------------------------------------------
// getNewcomers
// ---------------------------------------------------------------------------
describe('getNewcomers', () => {
  it('retorna jogadores presentes que nao estavam na partida', () => {
    const present = [{ id:'p1' },{ id:'p2' },{ id:'p3' }]
    expect(getNewcomers(present, ['p1']).map(p => p.id)).toEqual(['p2','p3'])
  })

  it('retorna vazio se todos ja estavam', () => {
    expect(getNewcomers([{ id:'p1' },{ id:'p2' }], ['p1','p2'])).toHaveLength(0)
  })

  it('retorna todos se nenhum estava', () => {
    expect(getNewcomers([{ id:'p1' },{ id:'p2' },{ id:'p3' }], [])).toHaveLength(3)
  })
})

// ---------------------------------------------------------------------------
// applySubstitutions
// ---------------------------------------------------------------------------
describe('applySubstitutions', () => {
  function mkGet(players) {
    const map = Object.fromEntries(players.map(p => [p.id, p]))
    return id => map[id]
  }

  it('remove do teamA sem substituto (cascata fica para applyCheckinWithActiveMatch)', () => {
    const all = [{ id:'p1', rating:90 },{ id:'p2', rating:70 },{ id:'p3', rating:60 },{ id:'p4', rating:50 }]
    const { newTeamA } = applySubstitutions({
      teamA:['p1','p2'], teamB:['p3','p4'], nextTeams:[],
      removedFromMatch:['p1'], newcomers:[], getPlayer:mkGet(all),
    })
    expect(newTeamA).not.toContain('p1')
    expect(newTeamA.length).toBe(1)
  })

  it('remove do teamB', () => {
    const all = [{ id:'p3', rating:60 },{ id:'p4', rating:50 }]
    const { newTeamB } = applySubstitutions({
      teamA:['p1','p2'], teamB:['p3','p4'], nextTeams:[],
      removedFromMatch:['p3'], newcomers:[], getPlayer:mkGet(all),
    })
    expect(newTeamB).not.toContain('p3')
    expect(newTeamB.length).toBe(1)
  })

  it('remove de nextTeams -- slot fica vazio (cascata cuida depois)', () => {
    const all = [{ id:'q1', rating:75 },{ id:'q2', rating:65 }]
    const { newNextTeams } = applySubstitutions({
      teamA:['p1','p2'], teamB:['p3','p4'], nextTeams:[['q1','q2']],
      removedFromMatch:['q1'], newcomers:[], getPlayer:mkGet(all),
    })
    expect(newNextTeams[0]).not.toContain('q1')
    expect(newNextTeams[0]).toEqual(['q2'])
  })

  it('remove de nextTeams -- newcomers passados NAO preenchem o slot', () => {
    const newcomers = [{ id:'n1', rating:70 }]
    const all = [{ id:'q1', rating:75 },{ id:'q2', rating:65 },{ id:'n1', rating:70 }]
    const { newNextTeams } = applySubstitutions({
      teamA:['p1','p2'], teamB:['p3','p4'], nextTeams:[['q1','q2']],
      removedFromMatch:['q1'], newcomers, getPlayer:mkGet(all),
    })
    // q1 removido, n1 NAO entrou no slot (newcomers nao preenchem proximas direto)
    expect(newNextTeams[0]).not.toContain('q1')
    expect(newNextTeams[0]).not.toContain('n1')
    expect(newNextTeams[0]).toEqual(['q2'])
  })

  it('remove multiplos de lugares diferentes', () => {
    const all = ['p1','p2','p3','p4','q1','q2'].map(id => ({ id, rating:50 }))
    const { newTeamA, newTeamB, newNextTeams } = applySubstitutions({
      teamA:['p1','p2'], teamB:['p3','p4'], nextTeams:[['q1','q2']],
      removedFromMatch:['p1','p3','q1'], newcomers:[], getPlayer:mkGet(all),
    })
    expect(newTeamA).not.toContain('p1')
    expect(newTeamB).not.toContain('p3')
    expect(newNextTeams[0]).not.toContain('q1')
  })

  it('nao muta os arrays de entrada', () => {
    const teamA=['p1','p2'], teamB=['p3','p4'], nextTeams=[['q1']]
    applySubstitutions({
      teamA, teamB, nextTeams,
      removedFromMatch:['p1'], newcomers:[], getPlayer:() => undefined,
    })
    expect(teamA).toEqual(['p1','p2'])
    expect(teamB).toEqual(['p3','p4'])
    expect(nextTeams).toEqual([['q1']])
  })
})

// ---------------------------------------------------------------------------
// applyCheckinWithActiveMatch -- comportamento geral
// ---------------------------------------------------------------------------
describe('applyCheckinWithActiveMatch', () => {
  function mkGet(players) {
    const map = Object.fromEntries(players.map(p => [p.id, p]))
    return id => map[id]
  }

  it('newcomer entra no FINAL da fila ao fazer check-in com partida ativa', () => {
    const all = [
      { id:'a1', rating:80 },{ id:'a2', rating:70 },
      { id:'b1', rating:60 },{ id:'b2', rating:50 },
      { id:'q1', rating:45 },{ id:'q2', rating:40 },
      { id:'newcomer', rating:55 },
    ]
    const result = applyCheckinWithActiveMatch({
      teamA:['a1','a2'], teamB:['b1','b2'], nextTeams:[['q1','q2']],
      checkedInSet: new Set(['a1','a2','b1','b2','q1','q2','newcomer']),
      presentPlayers: all,
      currentInMatch: ['a1','a2','b1','b2','q1','q2'],
      teamSize:2, getPlayer:mkGet(all),
    })
    const flat = result.newNextTeams.flat()
    expect(flat).toContain('newcomer')
    // newcomer vai para o final (depois de q1 e q2)
    expect(flat.indexOf('newcomer')).toBeGreaterThan(flat.indexOf('q2'))
  })

  it('jogador removido do time A -- 1a proxima sobe para o time', () => {
    const all = [
      { id:'a1', rating:80 },{ id:'a2', rating:70 },
      { id:'b1', rating:60 },{ id:'b2', rating:50 },
      { id:'q1', rating:45 },{ id:'q2', rating:40 },
    ]
    const result = applyCheckinWithActiveMatch({
      teamA:['a1','a2'], teamB:['b1','b2'], nextTeams:[['q1','q2']],
      checkedInSet: new Set(['a2','b1','b2','q1','q2']),
      presentPlayers: all.filter(p => ['a2','b1','b2','q1','q2'].includes(p.id)),
      currentInMatch: ['a1','a2','b1','b2','q1','q2'],
      teamSize:2, getPlayer:mkGet(all),
    })
    expect(result.newTeamA).not.toContain('a1')
    expect(result.newTeamA.length).toBe(2)
    // q1 subiu para o time A
    expect(result.newTeamA).toContain('q1')
    // 1a proxima ficou com apenas q2
    expect(result.newNextTeams.flat()).toContain('q2')
  })

  it('newcomer com alto rating vai para o FINAL, nao desloca quem ja esperava', () => {
    const all = [
      { id:'a1', rating:50 },{ id:'a2', rating:50 },{ id:'a3', rating:50 },
      { id:'b1', rating:50 },{ id:'b2', rating:50 },{ id:'b3', rating:50 },
      { id:'q1', rating:50 },{ id:'q2', rating:50 },{ id:'q3', rating:50 },
      { id:'q4', rating:50 },{ id:'q5', rating:50 },{ id:'q6', rating:50 },
      { id:'new1', rating:99 },
    ]
    const result = applyCheckinWithActiveMatch({
      teamA:['a1','a2','a3'], teamB:['b1','b2','b3'],
      nextTeams:[['q1','q2','q3'],['q4','q5','q6']],
      checkedInSet: new Set(all.map(p => p.id)),
      presentPlayers: all,
      currentInMatch: ['a1','a2','a3','b1','b2','b3','q1','q2','q3','q4','q5','q6'],
      teamSize:3, getPlayer:mkGet(all),
    })
    const flat = result.newNextTeams.flat()
    expect(flat).toContain('new1')
    expect(result.newTeamA).not.toContain('new1')
    expect(result.newTeamB).not.toContain('new1')
    expect(flat.lastIndexOf('new1')).toBe(flat.length - 1)
    for (const id of ['q1','q2','q3','q4','q5','q6']) expect(flat).toContain(id)
  })

  it('multiplos novos vao para o fim na ordem de chegada', () => {
    const all = [
      { id:'a1', rating:50 },{ id:'a2', rating:50 },
      { id:'b1', rating:50 },{ id:'b2', rating:50 },
      { id:'q1', rating:50 },{ id:'q2', rating:50 },
      { id:'new1', rating:99 },{ id:'new2', rating:95 },
    ]
    const result = applyCheckinWithActiveMatch({
      teamA:['a1','a2'], teamB:['b1','b2'], nextTeams:[['q1','q2']],
      checkedInSet: new Set(all.map(p => p.id)),
      presentPlayers: all,
      currentInMatch: ['a1','a2','b1','b2','q1','q2'],
      teamSize:2, getPlayer:mkGet(all),
    })
    const flat = result.newNextTeams.flat()
    expect(flat.indexOf('new1')).toBeGreaterThan(flat.indexOf('q2'))
    expect(flat.indexOf('new2')).toBeGreaterThan(flat.indexOf('q2'))
  })
})

// ---------------------------------------------------------------------------
// [RED] CASCATA: checkout sem newcomer deve promover da proxima imediata
// ---------------------------------------------------------------------------
describe('[RED] cascata ao fazer checkout sem newcomer disponivel', () => {
  function mkGet(players) {
    const map = Object.fromEntries(players.map(p => [p.id, p]))
    return id => map[id]
  }

  it('[RED] CHECKOUT-1a-PROXIMA: remover da 1a proxima puxa da 2a (sem newcomer)', () => {
    // teamSize=6
    // q1 sai do check-in (estava na 1a proxima)
    // Esperado: 1a proxima fica com 6 (puxou q7 da 2a), 2a proxima fica com 5
    const teamA  = ['a1','a2','a3','a4','a5','a6']
    const teamB  = ['b1','b2','b3','b4','b5','b6']
    const next1  = ['q1','q2','q3','q4','q5','q6']
    const next2  = ['q7','q8','q9','q10','q11','q12']
    const allIds = [...teamA,...teamB,...next1,...next2]
    const allPlayers = allIds.map(id => ({ id, rating:50 }))
    const getPlayer = mkGet(allPlayers)

    // q1 sai -- sem newcomers
    const checkedInSet = new Set(allIds.filter(id => id !== 'q1'))
    const result = applyCheckinWithActiveMatch({
      teamA, teamB, nextTeams:[next1, next2],
      checkedInSet,
      presentPlayers: allPlayers.filter(p => checkedInSet.has(p.id)),
      currentInMatch: allIds,
      teamSize:6, getPlayer,
    })

    const allResult = [...result.newTeamA,...result.newTeamB,...result.newNextTeams.flat()]
    expect(allResult).not.toContain('q1')
    expect(result.newNextTeams[0].length).toBe(6)   // 1a proxima completa
    expect(result.newNextTeams[1].length).toBe(5)   // 2a cedeu um
    expect(new Set(allResult).size).toBe(allResult.length)
  })

  it('[RED] CHECKOUT-1a-PROXIMA: cascata em 3 proximas (teamSize=2)', () => {
    // Remove q1 da 1a proxima
    // 1a puxada da 2a -> 2a puxada da 3a
    // Resultado: 1a=2, 2a=2, 3a=1 (9 jogadores na fila menos 1 removido = 5 restantes - 4 no campo)
    // Campo: 4, Proximas: q2+q3=1a, q4+q5=2a, q6=3a
    const teamA  = ['a1','a2']
    const teamB  = ['b1','b2']
    const next1  = ['q1','q2']
    const next2  = ['q3','q4']
    const next3  = ['q5','q6']
    const allIds = [...teamA,...teamB,...next1,...next2,...next3]
    const allPlayers = allIds.map(id => ({ id, rating:50 }))
    const getPlayer = mkGet(allPlayers)

    const checkedInSet = new Set(allIds.filter(id => id !== 'q1'))
    const result = applyCheckinWithActiveMatch({
      teamA, teamB, nextTeams:[next1,next2,next3],
      checkedInSet,
      presentPlayers: allPlayers.filter(p => checkedInSet.has(p.id)),
      currentInMatch: allIds,
      teamSize:2, getPlayer,
    })

    const allResult = [...result.newTeamA,...result.newTeamB,...result.newNextTeams.flat()]
    expect(allResult).not.toContain('q1')

    // 1a e 2a devem estar completas (2 cada), 3a com 1
    expect(result.newNextTeams[0].length).toBe(2)
    expect(result.newNextTeams[1].length).toBe(2)
    expect(result.newNextTeams[2].length).toBe(1)
    expect(new Set(allResult).size).toBe(allResult.length)
  })

  it('[RED] CHECKOUT-TIME-A: remover do time A promove 1a proxima ao time e 2a sobe para 1a', () => {
    // a1 sai do check-in (estava no time A)
    // Esperado: time A pega q1 da 1a proxima, 1a proxima pega q7 da 2a
    // time A = 6, 1a proxima = 6, 2a proxima = 5
    const teamA  = ['a1','a2','a3','a4','a5','a6']
    const teamB  = ['b1','b2','b3','b4','b5','b6']
    const next1  = ['q1','q2','q3','q4','q5','q6']
    const next2  = ['q7','q8','q9','q10','q11','q12']
    const allIds = [...teamA,...teamB,...next1,...next2]
    const allPlayers = allIds.map(id => ({ id, rating:50 }))
    const getPlayer = mkGet(allPlayers)

    const checkedInSet = new Set(allIds.filter(id => id !== 'a1'))
    const result = applyCheckinWithActiveMatch({
      teamA, teamB, nextTeams:[next1,next2],
      checkedInSet,
      presentPlayers: allPlayers.filter(p => checkedInSet.has(p.id)),
      currentInMatch: allIds,
      teamSize:6, getPlayer,
    })

    const allResult = [...result.newTeamA,...result.newTeamB,...result.newNextTeams.flat()]
    expect(allResult).not.toContain('a1')

    // time A completo com 6
    expect(result.newTeamA.length).toBe(6)

    // 1a proxima completa com 6 (puxou da 2a)
    expect(result.newNextTeams[0].length).toBe(6)

    // 2a proxima com 5
    expect(result.newNextTeams[1].length).toBe(5)

    expect(new Set(allResult).size).toBe(allResult.length)
  })

  it('[RED] CHECKOUT-TIME-A: sem proximas, time fica incompleto sem crash', () => {
    const teamA  = ['a1','a2','a3']
    const teamB  = ['b1','b2','b3']
    const allPlayers = ['a1','a2','a3','b1','b2','b3'].map(id => ({ id, rating:50 }))
    const getPlayer = mkGet(allPlayers)

    const checkedInSet = new Set(['a2','a3','b1','b2','b3'])
    const result = applyCheckinWithActiveMatch({
      teamA, teamB, nextTeams:[],
      checkedInSet,
      presentPlayers: allPlayers.filter(p => checkedInSet.has(p.id)),
      currentInMatch: ['a1','a2','a3','b1','b2','b3'],
      teamSize:3, getPlayer,
    })

    expect(result.newTeamA).not.toContain('a1')
    expect(result.newTeamA.length).toBe(2)
    expect(result.newNextTeams).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// fillGapsFromNextQueues
// ---------------------------------------------------------------------------
describe('fillGapsFromNextQueues', () => {
  it('remove da 1a proxima e promove da 2a priorizando roundsOut', () => {
    const result = fillGapsFromNextQueues({
      nextTeams:[['n1','n2'],['n3','n4']],
      removedIds:['n1'],
      roundsOut:{ n1:0, n2:0, n3:3, n4:1 },
      teamSize:2,
    })
    expect(result[0]).not.toContain('n1')
    expect(result[0]).toContain('n3')
  })

  it('empate no roundsOut respeita FIFO', () => {
    const result = fillGapsFromNextQueues({
      nextTeams:[['n1','n2'],['n3','n4']],
      removedIds:['n1'],
      roundsOut:{ n1:0, n2:0, n3:1, n4:1 },
      teamSize:2,
    })
    expect(result[0]).not.toContain('n1')
    expect(result[0]).toContain('n3')
  })

  it('nao duplica jogadores apos promocao', () => {
    const result = fillGapsFromNextQueues({
      nextTeams:[['n1','n2'],['n3','n4']],
      removedIds:['n1'],
      roundsOut:{},
      teamSize:2,
    })
    const all = result.flat()
    expect(new Set(all).size).toBe(all.length)
  })

  it('cascata: 2a proxima tambem e completada pela 3a', () => {
    const result = fillGapsFromNextQueues({
      nextTeams:[['n1','n2'],['n3','n4'],['n5','n6']],
      removedIds:['n1'],
      roundsOut:{ n1:0, n2:0, n3:2, n4:1, n5:1, n6:0 },
      teamSize:2,
    })
    expect(result[0].length).toBe(2)
    expect(result[0]).toContain('n2')
    expect(result[0]).toContain('n3')
    expect(result[1].length).toBe(2)
    const all = result.flat()
    expect(new Set(all).size).toBe(all.length)
  })

  it('checkout de 1a proxima (teamSize=6) puxa da 2a, nao deixa com 5', () => {
    const result = fillGapsFromNextQueues({
      nextTeams:[
        ['a','b','c','d','e','f'],
        ['g','h','i','j','k','l'],
      ],
      removedIds:['a'],
      roundsOut:{ a:0,b:0,c:0,d:0,e:0,f:0,g:2,h:1,i:1,j:0,k:0,l:0 },
      teamSize:6,
    })
    expect(result[0].length).toBe(6)
    expect(result[0]).not.toContain('a')
    expect(result[1].length).toBe(5)
    const all = result.flat()
    expect(new Set(all).size).toBe(all.length)
  })
})
