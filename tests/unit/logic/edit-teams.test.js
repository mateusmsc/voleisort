import { describe, it, expect } from 'vitest'
import { swapPlayers, shuffleTeams, rebuildNextTeamsAfterFieldSwap, rebuildNextTeamsAfterNextSwap } from '../../../src/logic/balancing.js'

describe('shuffleTeams -- botao de mistura deve existir e funcionar', () => {
  it('mistura os times trocando pares sem duplicar jogadores', () => {
    const a = [
      { id: 'a1', rating: 90 }, { id: 'a2', rating: 80 },
      { id: 'a3', rating: 70 }, { id: 'a4', rating: 60 },
    ]
    const b = [
      { id: 'b1', rating: 85 }, { id: 'b2', rating: 75 },
      { id: 'b3', rating: 65 }, { id: 'b4', rating: 55 },
    ]
    const { teamA, teamB } = shuffleTeams(a, b, 2)
    const allIds = [...teamA, ...teamB].map(p => p.id)
    const unique = new Set(allIds)
    expect(unique.size).toBe(allIds.length)
    expect(teamA.length).toBe(4)
    expect(teamB.length).toBe(4)
  })
})

describe('swapPlayers -- logica de troca usada pelo EditTeamsModal', () => {
  it('trocar jogador de time A com jogador de time B nao gera duplicacao', () => {
    const groups = [
      [{ id: 'a1', rating: 90 }, { id: 'a2', rating: 80 }],
      [{ id: 'b1', rating: 70 }, { id: 'b2', rating: 60 }],
    ]
    const pool = []

    const result = swapPlayers({ groups, pool, idA: 'a1', fromA: 0, idB: 'b1', fromB: 1 })

    const allIds = [...result.groups.flat(), ...result.pool].map(p => p.id)
    expect(new Set(allIds).size).toBe(allIds.length)
    expect(result.groups[0].map(p => p.id)).toContain('b1')
    expect(result.groups[0].map(p => p.id)).not.toContain('a1')
    expect(result.groups[1].map(p => p.id)).toContain('a1')
    expect(result.groups[1].map(p => p.id)).not.toContain('b1')
  })

  it('trocar jogador de um grupo com jogador do pool nao gera duplicacao', () => {
    const groups = [
      [{ id: 'a1', rating: 90 }, { id: 'a2', rating: 80 }],
    ]
    const pool = [{ id: 'p1', rating: 50 }]

    const result = swapPlayers({ groups, pool, idA: 'a1', fromA: 0, idB: 'p1', fromB: 'pool' })

    const allIds = [...result.groups.flat(), ...result.pool].map(p => p.id)
    expect(new Set(allIds).size).toBe(allIds.length)
    expect(result.groups[0].map(p => p.id)).toContain('p1')
    expect(result.pool.map(p => p.id)).toContain('a1')
    expect(result.pool.map(p => p.id)).not.toContain('p1')
  })

  it('apos multiplas trocas nenhum jogador aparece em mais de um lugar', () => {
    const groups = [
      [{ id: 'a1', rating: 90 }, { id: 'a2', rating: 80 }],
      [{ id: 'b1', rating: 70 }, { id: 'b2', rating: 60 }],
    ]
    const pool = [{ id: 'p1', rating: 50 }]

    const step1 = swapPlayers({ groups, pool, idA: 'a1', fromA: 0, idB: 'b1', fromB: 1 })
    const step2 = swapPlayers({ groups: step1.groups, pool: step1.pool, idA: 'a2', fromA: 0, idB: 'p1', fromB: 'pool' })

    const allIds = [...step2.groups.flat(), ...step2.pool].map(p => p.id)
    expect(new Set(allIds).size).toBe(allIds.length)
  })

  it('trocar jogador do time A com jogador da proxima nao deve duplicar nem perder jogadores', () => {
    const groups = [
      [{ id: 'a1', rating: 90 }, { id: 'a2', rating: 80 }, { id: 'a3', rating: 70 }],
      [{ id: 'b1', rating: 60 }, { id: 'b2', rating: 55 }, { id: 'b3', rating: 50 }],
    ]
    const pool = [
      { id: 'q1', rating: 85 }, { id: 'q2', rating: 75 }, { id: 'q3', rating: 65 },
    ]

    const result = swapPlayers({ groups, pool, idA: 'a1', fromA: 0, idB: 'q1', fromB: 'pool' })

    const totalBefore = groups.flat().length + pool.length
    const totalAfter = result.groups.flat().length + result.pool.length
    expect(totalAfter).toBe(totalBefore)
    const allIds = [...result.groups.flat(), ...result.pool].map(p => p.id)
    expect(new Set(allIds).size).toBe(allIds.length)
    expect(result.groups[0].map(p => p.id)).toContain('q1')
    expect(result.groups[0].map(p => p.id)).not.toContain('a1')
    expect(result.pool.map(p => p.id)).toContain('a1')
    expect(result.pool.map(p => p.id)).not.toContain('q1')
  })

  it('troca entre grupos conserva tamanho de cada grupo', () => {
    const groups = [
      [{ id: 'a1', rating: 90 }, { id: 'a2', rating: 80 }, { id: 'a3', rating: 70 }],
    ]
    const pool = [{ id: 'p1', rating: 50 }, { id: 'p2', rating: 40 }]

    const result = swapPlayers({ groups, pool, idA: 'a1', fromA: 0, idB: 'p1', fromB: 'pool' })

    expect(result.groups[0].length).toBe(3)
    expect(result.pool.length).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// BUG-FIELD-SWAP: troca manual entre time em campo e 1a proxima
//
// Cenario reportado: jogador A (time em campo) e trocado com jogador B
// (1a proxima). O jogador A deveria entrar na 1a proxima no lugar de B.
// Correcao: rebuildNextTeamsAfterFieldSwap(origNexts, poolPlayers)
// ---------------------------------------------------------------------------
describe('[RED] BUG-FIELD-SWAP: troca entre campo e 1a proxima deve preservar posicao na fila', () => {
  const mk = id => ({ id, rating: 50 })

  const origNexts = [
    ['q1','q2','q3','q4','q5','q6'],
    ['q7','q8','q9','q10','q11','q12'],
  ]
  // pool apos a troca: a1 entrou, q1 saiu
  const poolAfterSwap = ['a1','q2','q3','q4','q5','q6','q7','q8','q9','q10','q11','q12'].map(mk)

  it('a1 fica na 1a proxima (posicao de q1), nao cai na 2a nem vai para o fim', () => {
    const result = rebuildNextTeamsAfterFieldSwap(origNexts, poolAfterSwap)
    expect(result[0]).toContain('a1')
    expect(result[0]).not.toContain('q1')
    expect(result[1]).not.toContain('a1')
  })

  it('2a proxima permanece intacta quando so a 1a foi afetada', () => {
    const result = rebuildNextTeamsAfterFieldSwap(origNexts, poolAfterSwap)
    expect(result[1]).toEqual(['q7','q8','q9','q10','q11','q12'])
  })

  it('sem duplicatas em toda a fila', () => {
    const result = rebuildNextTeamsAfterFieldSwap(origNexts, poolAfterSwap)
    const all = result.flat()
    expect(new Set(all).size).toBe(all.length)
  })

  it('tamanho de cada time e preservado', () => {
    const result = rebuildNextTeamsAfterFieldSwap(origNexts, poolAfterSwap)
    expect(result[0].length).toBe(6)
    expect(result[1].length).toBe(6)
  })

  it('troca na 2a proxima tambem preserva a estrutura da 1a', () => {
    const origNexts2 = [
      ['q1','q2','q3','q4','q5','q6'],
      ['q7','q8','q9','q10','q11','q12'],
    ]
    const poolAfter2 = ['q1','q2','q3','q4','q5','q6','a2','q8','q9','q10','q11','q12'].map(mk)
    const result = rebuildNextTeamsAfterFieldSwap(origNexts2, poolAfter2)
    expect(result[0]).toEqual(['q1','q2','q3','q4','q5','q6'])
    expect(result[1]).toContain('a2')
    expect(result[1]).not.toContain('q7')
  })
})

// ---------------------------------------------------------------------------
// BUG-SWAP-PROXIMAS: troca entre proximas via modal deixa jogador duplicado
// (historico: bug de pool ignorado em versao anterior do handleSaveNextTeam)
// ---------------------------------------------------------------------------
describe('[RED] BUG-SWAP-PROXIMAS: troca entre proximas via modal deixa jogador duplicado', () => {
  function handleSaveNextTeamBuggy(idx, nexts, newGroupPlayers) {
    return nexts.map((team, i) =>
      i === idx ? newGroupPlayers.map(p => p.id) : team.map(p => p.id)
    )
  }

  function handleSaveNextTeamCorrect(idx, nexts, newGroupPlayers, poolPlayers) {
    const newNextTeamIds = newGroupPlayers.map(p => p.id)
    const poolIds = poolPlayers.map(p => p.id)

    const otherOrigNexts = nexts.filter((_, i) => i !== idx)
    const remaining = [...poolIds]
    const reconstructedOthers = otherOrigNexts.map(origTeam => {
      return remaining.splice(0, origTeam.length)
    }).filter(t => t.length > 0)
    while (remaining.length > 0) {
      reconstructedOthers.push(remaining.splice(0, nexts[0].length))
    }

    reconstructedOthers.splice(idx, 0, newNextTeamIds)
    return reconstructedOthers
  }

  it('[RED] com bug: trocar q1 (1a proxima) com q7 (2a proxima) deixa q7 duplicado', () => {
    const nexts = [
      [{ id:'q1',rating:50 },{ id:'q2',rating:50 }],
      [{ id:'q7',rating:50 },{ id:'q8',rating:50 }],
    ]
    const editingIdx = 0

    const newGroup = [{ id:'q7',rating:50 },{ id:'q2',rating:50 }]

    const buggyResult = handleSaveNextTeamBuggy(editingIdx, nexts, newGroup)

    const allIds = buggyResult.flat()
    expect(allIds.filter(id => id === 'q7').length).toBe(2)
    expect(allIds.filter(id => id === 'q1').length).toBe(0)
  })

  it('[GREEN esperado] correto: trocar q1 com q7 resulta em 1a=[q7,q2] e 2a=[q1,q8]', () => {
    const nexts = [
      [{ id:'q1',rating:50 },{ id:'q2',rating:50 }],
      [{ id:'q7',rating:50 },{ id:'q8',rating:50 }],
    ]
    const editingIdx = 0

    const newGroup = [{ id:'q7',rating:50 },{ id:'q2',rating:50 }]
    const newPool  = [{ id:'q1',rating:50 },{ id:'q8',rating:50 }]

    const correctResult = handleSaveNextTeamCorrect(editingIdx, nexts, newGroup, newPool)

    const allIds = correctResult.flat()
    expect(new Set(allIds).size).toBe(allIds.length)

    expect(correctResult[0]).toContain('q7')
    expect(correctResult[0]).toContain('q2')
    expect(correctResult[0]).not.toContain('q1')

    expect(correctResult[1]).toContain('q1')
    expect(correctResult[1]).toContain('q8')
    expect(correctResult[1]).not.toContain('q7')
  })

  it('[RED] com bug: trocar q3 (1a proxima) com q8 (2a proxima) em sessao com teamSize=6', () => {
    const nexts = [
      [{ id:'q1',r:50 },{ id:'q2',r:50 },{ id:'q3',r:50 },{ id:'q4',r:50 },{ id:'q5',r:50 },{ id:'q6',r:50 }].map(p=>({id:p.id,rating:50})),
      [{ id:'q7',r:50 },{ id:'q8',r:50 },{ id:'q9',r:50 },{ id:'q10',r:50 },{ id:'q11',r:50 },{ id:'q12',r:50 }].map(p=>({id:p.id,rating:50})),
    ]
    const editingIdx = 0
    const newGroup = ['q1','q2','q8','q4','q5','q6'].map(id=>({id,rating:50}))
    const newPool  = ['q3','q7','q9','q10','q11','q12'].map(id=>({id,rating:50}))

    const buggyResult = handleSaveNextTeamBuggy(editingIdx, nexts, newGroup)

    const allIds = buggyResult.flat()
    expect(allIds.filter(id => id === 'q8').length).toBe(2)
    expect(allIds.filter(id => id === 'q3').length).toBe(0)

    const correctResult = handleSaveNextTeamCorrect(editingIdx, nexts, newGroup, newPool)
    const allCorrect = correctResult.flat()
    expect(new Set(allCorrect).size).toBe(allCorrect.length)
    expect(correctResult[0]).toContain('q8')
    expect(correctResult[0]).not.toContain('q3')
    expect(correctResult[1]).toContain('q3')
    expect(correctResult[1]).not.toContain('q8')
  })
})


describe('shuffleTeams -- botao de mistura deve existir e funcionar (2)', () => {
  it('mistura os times trocando pares sem duplicar jogadores', () => {
    const a = [
      { id: 'a1', rating: 90 }, { id: 'a2', rating: 80 },
      { id: 'a3', rating: 70 }, { id: 'a4', rating: 60 },
    ]
    const b = [
      { id: 'b1', rating: 85 }, { id: 'b2', rating: 75 },
      { id: 'b3', rating: 65 }, { id: 'b4', rating: 55 },
    ]
    const { teamA, teamB } = shuffleTeams(a, b, 2)
    const allIds = [...teamA, ...teamB].map(p => p.id)
    const unique = new Set(allIds)
    expect(unique.size).toBe(allIds.length)
    expect(teamA.length).toBe(4)
    expect(teamB.length).toBe(4)
  })
})

describe('swapPlayers -- logica de troca usada pelo EditTeamsModal (2)', () => {
  it('[RED] trocar jogador de time A com jogador de time B nao gera duplicacao', () => {
    const groups = [
      [{ id: 'a1', rating: 90 }, { id: 'a2', rating: 80 }],
      [{ id: 'b1', rating: 70 }, { id: 'b2', rating: 60 }],
    ]
    const pool = []

    const result = swapPlayers({ groups, pool, idA: 'a1', fromA: 0, idB: 'b1', fromB: 1 })

    const allIds = [...result.groups.flat(), ...result.pool].map(p => p.id)
    const unique = new Set(allIds)
    expect(unique.size).toBe(allIds.length)
    expect(result.groups[0].map(p => p.id)).toContain('b1')
    expect(result.groups[0].map(p => p.id)).not.toContain('a1')
    expect(result.groups[1].map(p => p.id)).toContain('a1')
    expect(result.groups[1].map(p => p.id)).not.toContain('b1')
  })

  it('[RED] trocar jogador de um grupo com jogador do pool nao gera duplicacao', () => {
    const groups = [
      [{ id: 'a1', rating: 90 }, { id: 'a2', rating: 80 }],
    ]
    const pool = [{ id: 'p1', rating: 50 }]

    const result = swapPlayers({ groups, pool, idA: 'a1', fromA: 0, idB: 'p1', fromB: 'pool' })

    const allIds = [...result.groups.flat(), ...result.pool].map(p => p.id)
    const unique = new Set(allIds)
    expect(unique.size).toBe(allIds.length)
    expect(result.groups[0].map(p => p.id)).toContain('p1')
    expect(result.pool.map(p => p.id)).toContain('a1')
    expect(result.pool.map(p => p.id)).not.toContain('p1')
  })

  it('[RED] apos multiplas trocas nenhum jogador aparece em mais de um lugar', () => {
    const groups = [
      [{ id: 'a1', rating: 90 }, { id: 'a2', rating: 80 }],
      [{ id: 'b1', rating: 70 }, { id: 'b2', rating: 60 }],
    ]
    const pool = [{ id: 'p1', rating: 50 }]

    const step1 = swapPlayers({ groups, pool, idA: 'a1', fromA: 0, idB: 'b1', fromB: 1 })
    const step2 = swapPlayers({ groups: step1.groups, pool: step1.pool, idA: 'a2', fromA: 0, idB: 'p1', fromB: 'pool' })

    const allIds = [...step2.groups.flat(), ...step2.pool].map(p => p.id)
    const unique = new Set(allIds)
    expect(unique.size).toBe(allIds.length)
  })

  it('[RED] BUG3: trocar jogador do time A com jogador da proxima nao deve duplicar nem perder jogadores', () => {
    const groups = [
      [{ id: 'a1', rating: 90 }, { id: 'a2', rating: 80 }, { id: 'a3', rating: 70 }],
      [{ id: 'b1', rating: 60 }, { id: 'b2', rating: 55 }, { id: 'b3', rating: 50 }],
    ]
    const pool = [
      { id: 'q1', rating: 85 }, { id: 'q2', rating: 75 }, { id: 'q3', rating: 65 },
    ]

    const result = swapPlayers({ groups, pool, idA: 'a1', fromA: 0, idB: 'q1', fromB: 'pool' })

    const totalBefore = groups.flat().length + pool.length
    const totalAfter = result.groups.flat().length + result.pool.length
    expect(totalAfter).toBe(totalBefore)

    const allIds = [...result.groups.flat(), ...result.pool].map(p => p.id)
    const unique = new Set(allIds)
    expect(unique.size).toBe(allIds.length)

    expect(result.groups[0].map(p => p.id)).toContain('q1')
    expect(result.groups[0].map(p => p.id)).not.toContain('a1')
    expect(result.pool.map(p => p.id)).toContain('a1')
    expect(result.pool.map(p => p.id)).not.toContain('q1')
  })

  it('[RED] BUG3: apos troca entre grupos, o total de jogadores por grupo deve ser conservado', () => {
    const groups = [
      [{ id: 'a1', rating: 90 }, { id: 'a2', rating: 80 }, { id: 'a3', rating: 70 }],
    ]
    const pool = [{ id: 'p1', rating: 50 }, { id: 'p2', rating: 40 }]

    const result = swapPlayers({ groups, pool, idA: 'a1', fromA: 0, idB: 'p1', fromB: 'pool' })

    expect(result.groups[0].length).toBe(3)
    expect(result.pool.length).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// rebuildNextTeamsAfterNextSwap: reconstroi todas as proximas apos edicao
// de uma delas via EditTeamsModal.
//
// Bug original em handleSaveNextTeam (Match.jsx):
//   Reconstruia as outras proximas via splice sequencial no pool achatado.
//   Quando um jogador saia da proxima editada para o pool (swapPlayers o
//   coloca no fim), o splice o colocava no fim da fila em vez do slot correto.
//
// Correcao: rebuildNextTeamsAfterNextSwap usa os IDs originais de cada time
// para manter os slots existentes e preenche apenas os slots vazios.
// ---------------------------------------------------------------------------
describe('rebuildNextTeamsAfterNextSwap: reconstrucao da fila apos edicao de proxima', () => {
  const origNexts = [
    ['q1', 'q2', 'q3'],
    ['q4', 'q5', 'q6'],
  ]

  it('troca entre proximas: q1 sai da 1a, q4 entra -- q1 fica na 2a no lugar de q4', () => {
    // Usuario edita a 1a proxima e troca q1 com q4 (2a proxima, no pool)
    // newTeamIds = [q4, q2, q3], poolIds (apenas das outras proximas) = [q1, q5, q6]
    const newTeamIds = ['q4', 'q2', 'q3']
    const poolIds = ['q1', 'q5', 'q6']

    const result = rebuildNextTeamsAfterNextSwap(0, origNexts, newTeamIds, poolIds)

    expect(result[0]).toContain('q4')
    expect(result[0]).not.toContain('q1')

    expect(result[1]).toContain('q1')
    expect(result[1]).not.toContain('q4')

    const all = result.flat()
    expect(new Set(all).size).toBe(all.length)
  })

  it('troca entre proximas: estrutura e tamanhos preservados', () => {
    const newTeamIds = ['q4', 'q2', 'q3']
    const poolIds = ['q1', 'q5', 'q6']

    const result = rebuildNextTeamsAfterNextSwap(0, origNexts, newTeamIds, poolIds)

    expect(result).toHaveLength(2)
    expect(result[0]).toHaveLength(3)
    expect(result[1]).toHaveLength(3)
  })

  it('troca com jogador do campo: a1 entra na 1a, pool so tem as outras proximas', () => {
    // Usuario edita a 1a proxima e troca q1 com a1 (do campo)
    // No handleSaveNextTeam, q1 vai para o campo (substitui a1)
    // poolIds ja nao inclui jogadores do campo -> apenas da 2a proxima
    const newTeamIds = ['a1', 'q2', 'q3']
    const poolIds = ['q4', 'q5', 'q6']  // apenas da 2a proxima (q1 foi para o campo)

    const result = rebuildNextTeamsAfterNextSwap(0, origNexts, newTeamIds, poolIds)

    expect(result[0]).toContain('a1')
    expect(result[0]).not.toContain('q1')

    // 2a proxima permanece intacta
    expect(result[1]).toEqual(['q4', 'q5', 'q6'])

    const all = result.flat()
    expect(new Set(all).size).toBe(all.length)
  })

  it('troca editando a 2a proxima preserva a 1a intacta', () => {
    // Usuario edita a 2a proxima e troca q4 com q1 (1a proxima, no pool)
    // newTeamIds = [q1, q5, q6], poolIds = [q2, q3, q4]
    const newTeamIds = ['q1', 'q5', 'q6']
    const poolIds = ['q2', 'q3', 'q4']

    const result = rebuildNextTeamsAfterNextSwap(1, origNexts, newTeamIds, poolIds)

    expect(result[0]).toContain('q4')
    expect(result[0]).not.toContain('q1')

    expect(result[1]).toContain('q1')
    expect(result[1]).not.toContain('q4')

    const all = result.flat()
    expect(new Set(all).size).toBe(all.length)
  })

  it('BUG reproduzido: sem a correcao, splice sequencial coloca q3 no fim errado', () => {
    // Cenario: troca q3 (1a proxima) com q4 (2a proxima)
    // newTeam = [q1, q2, q4]
    // poolIds = [q5, q6, q3]  (q3 esta no FIM do pool, como swapPlayers coloca)
    // Sem a correcao: remaining.splice poderia criar time extra ou ordem errada
    // Com a correcao: 2a deve conter q3 (veio da 1a) e nao conter q4 (foi para a 1a)

    const newTeamIds = ['q1', 'q2', 'q4']
    const poolIds = ['q5', 'q6', 'q3']  // q3 no fim do pool

    const result = rebuildNextTeamsAfterNextSwap(0, origNexts, newTeamIds, poolIds)

    expect(result[1]).toContain('q3')
    expect(result[1]).not.toContain('q4')

    expect(result[0]).toHaveLength(3)
    expect(result[1]).toHaveLength(3)

    expect(result).toHaveLength(2)
    const all = result.flat()
    expect(new Set(all).size).toBe(all.length)
  })
})
