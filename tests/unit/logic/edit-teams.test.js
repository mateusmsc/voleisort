import { describe, it, expect } from 'vitest'
import { swapPlayers, shuffleTeams, rebuildNextTeamsAfterFieldSwap } from '../../../src/logic/balancing.js'

describe('shuffleTeams — botao de mistura deve existir e funcionar', () => {
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

describe('swapPlayers — logica de troca usada pelo EditTeamsModal', () => {
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
// [RED] BUG-FIELD-SWAP: troca manual entre time em campo e 1ª próxima
//
// Cenário reportado: jogador A (time em campo) é trocado com jogador B
// (1ª próxima). O jogador A deveria entrar na 1ª próxima no lugar de B.
// Bug atual: handleSaveCurrentTeams usa splice sequencial sobre o pool
// achatado, que não preserva a estrutura dos times da fila. O jogador A
// acaba no fim da fila, não na 1ª próxima.
//
// Correção: rebuildNextTeamsAfterFieldSwap(origNexts, poolPlayers)
//   - origNexts: array de arrays de IDs (formato original antes do swap)
//   - poolPlayers: jogadores no pool após o swapPlayers (nova composição)
//   - retorna: array de arrays de IDs com a estrutura preservada, apenas
//     substituindo os jogadores que mudaram dentro de cada time.
// ---------------------------------------------------------------------------
describe('[RED] BUG-FIELD-SWAP: troca entre campo e 1ª próxima deve preservar posição na fila', () => {
  // Monta situação: campo=[a1..a6, b1..b6], 1ª próxima=[q1..q6], 2ª próxima=[q7..q12]
  // Usuário troca a1 (campo) com q1 (1ª próxima)
  // pool após swapPlayers = [a1, q2, q3, q4, q5, q6, q7, q8, q9, q10, q11, q12]
  // (a1 entra no pool; q1 saiu do pool e foi para campo)

  const mk = id => ({ id, rating: 50 })

  const origNexts = [
    ['q1','q2','q3','q4','q5','q6'],
    ['q7','q8','q9','q10','q11','q12'],
  ]
  // pool após a troca: a1 entrou, q1 saiu
  const poolAfterSwap = ['a1','q2','q3','q4','q5','q6','q7','q8','q9','q10','q11','q12'].map(mk)

  it('a1 fica na 1ª próxima (posição de q1), não cai na 2ª nem vai para o fim', () => {
    const result = rebuildNextTeamsAfterFieldSwap(origNexts, poolAfterSwap)
    expect(result[0]).toContain('a1')      // a1 deve estar na 1ª próxima
    expect(result[0]).not.toContain('q1')  // q1 saiu (foi para campo)
    expect(result[1]).not.toContain('a1')  // a1 NÃO deve estar na 2ª próxima
  })

  it('2ª próxima permanece intacta quando só a 1ª foi afetada', () => {
    const result = rebuildNextTeamsAfterFieldSwap(origNexts, poolAfterSwap)
    expect(result[1]).toEqual(['q7','q8','q9','q10','q11','q12'])
  })

  it('sem duplicatas em toda a fila', () => {
    const result = rebuildNextTeamsAfterFieldSwap(origNexts, poolAfterSwap)
    const all = result.flat()
    expect(new Set(all).size).toBe(all.length)
  })

  it('tamanho de cada time é preservado', () => {
    const result = rebuildNextTeamsAfterFieldSwap(origNexts, poolAfterSwap)
    expect(result[0].length).toBe(6)
    expect(result[1].length).toBe(6)
  })

  it('troca na 2ª próxima também preserva a estrutura da 1ª', () => {
    // Usuário troca a2 (campo) com q7 (1ª posição da 2ª próxima)
    // pool após swap: [q1..q6, a2, q8..q12]
    const origNexts2 = [
      ['q1','q2','q3','q4','q5','q6'],
      ['q7','q8','q9','q10','q11','q12'],
    ]
    const poolAfter2 = ['q1','q2','q3','q4','q5','q6','a2','q8','q9','q10','q11','q12'].map(mk)
    const result = rebuildNextTeamsAfterFieldSwap(origNexts2, poolAfter2)
    expect(result[0]).toEqual(['q1','q2','q3','q4','q5','q6'])   // 1ª intacta
    expect(result[1]).toContain('a2')                              // a2 na 2ª
    expect(result[1]).not.toContain('q7')                          // q7 saiu
  })
})
//
// O fluxo do modal de edicao de proxima (editingNext):
//   - initialGroups = [nexts[idx]]          -- so a proxima que esta sendo editada
//   - extraPool     = [...teamA, ...teamB, ...nexts.filter(i != idx).flat()]
//   - ao salvar, chama onSave(groups, pool)
//
// O BUG esta em Match.jsx linha 344:
//   onSave={(groups) => handleSaveNextTeam(editingNextIdx, groups)}
//                ^^^^^ pool e ignorado! handleSaveNextTeam recebe pool=undefined
//               e cai no `else` que so salva a proxima editada sem tocar nas outras.
//
// Resultado: jogador da 2a que foi para a 1a fica TAMBEM na 2a (duplicado).
// ---------------------------------------------------------------------------
describe('[RED] BUG-SWAP-PROXIMAS: troca entre proximas via modal deixa jogador duplicado', () => {
  // Simula o que handleSaveNextTeam faz HOJE (com o bug -- pool ignorado)
  function handleSaveNextTeamBuggy(idx, nexts, newGroupPlayers) {
    // Comportamento atual com bug: apenas substitui a proxima editada, ignora o pool
    return nexts.map((team, i) =>
      i === idx ? newGroupPlayers.map(p => p.id) : team.map(p => p.id)
    )
  }

  // Simula o que handleSaveNextTeam deve fazer CORRETAMENTE (recebendo o pool)
  function handleSaveNextTeamCorrect(idx, nexts, newGroupPlayers, poolPlayers) {
    const newNextTeamIds = newGroupPlayers.map(p => p.id)
    const poolIds = poolPlayers.map(p => p.id)

    // Separar do pool os jogadores que sao de outras proximas (nao do campo)
    // Para simplificar: pool aqui contem apenas as outras proximas (sem teamA/B)
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
    // Estado: 1a proxima=[q1,q2], 2a proxima=[q7,q8]
    // Usuario edita a 1a proxima e troca q1 com q7 (que esta no pool)
    // Apos a troca no modal: groups[0]=[q7,q2], pool=[q1,q8] (q1 foi para o pool)
    const nexts = [
      [{ id:'q1',rating:50 },{ id:'q2',rating:50 }],
      [{ id:'q7',rating:50 },{ id:'q8',rating:50 }],
    ]
    const editingIdx = 0  // editando a 1a proxima

    // Resultado do swapPlayers dentro do modal:
    const newGroup = [{ id:'q7',rating:50 },{ id:'q2',rating:50 }]  // q7 entrou, q1 saiu
    const newPool  = [{ id:'q1',rating:50 },{ id:'q8',rating:50 }]  // q1 no pool, q8 ficou

    // COM O BUG: pool e ignorado
    const buggyResult = handleSaveNextTeamBuggy(editingIdx, nexts, newGroup)

    // q7 esta na 1a proxima (correto) E na 2a proxima (ERRADO -- duplicado!)
    const allIds = buggyResult.flat()
    expect(allIds.filter(id => id === 'q7').length).toBe(2)  // duplicado!
    expect(allIds.filter(id => id === 'q1').length).toBe(0)  // q1 sumiu!
  })

  it('[GREEN esperado] correto: trocar q1 com q7 resulta em 1a=[q7,q2] e 2a=[q1,q8]', () => {
    // Estado: 1a proxima=[q1,q2], 2a proxima=[q7,q8]
    // Troca q1 com q7: 1a=[q7,q2], 2a=[q1,q8]
    const nexts = [
      [{ id:'q1',rating:50 },{ id:'q2',rating:50 }],
      [{ id:'q7',rating:50 },{ id:'q8',rating:50 }],
    ]
    const editingIdx = 0

    const newGroup = [{ id:'q7',rating:50 },{ id:'q2',rating:50 }]
    const newPool  = [{ id:'q1',rating:50 },{ id:'q8',rating:50 }]

    const correctResult = handleSaveNextTeamCorrect(editingIdx, nexts, newGroup, newPool)

    // Sem duplicacoes
    const allIds = correctResult.flat()
    expect(new Set(allIds).size).toBe(allIds.length)

    // 1a proxima tem q7 (subiu) e q2 (ficou)
    expect(correctResult[0]).toContain('q7')
    expect(correctResult[0]).toContain('q2')
    expect(correctResult[0]).not.toContain('q1')

    // 2a proxima tem q1 (desceu) e q8 (ficou)
    expect(correctResult[1]).toContain('q1')
    expect(correctResult[1]).toContain('q8')
    expect(correctResult[1]).not.toContain('q7')
  })

  it('[RED] com bug: trocar q3 (1a proxima) com q8 (2a proxima) em sessao com teamSize=6', () => {
    // 1a=[q1..q6], 2a=[q7..q12]
    // Edita a 1a proxima, troca q3 com q8
    const nexts = [
      [{ id:'q1',r:50 },{ id:'q2',r:50 },{ id:'q3',r:50 },{ id:'q4',r:50 },{ id:'q5',r:50 },{ id:'q6',r:50 }].map(p=>({id:p.id,rating:50})),
      [{ id:'q7',r:50 },{ id:'q8',r:50 },{ id:'q9',r:50 },{ id:'q10',r:50 },{ id:'q11',r:50 },{ id:'q12',r:50 }].map(p=>({id:p.id,rating:50})),
    ]
    const editingIdx = 0
    // Apos troca: q3 foi para o pool, q8 entrou na 1a
    const newGroup = ['q1','q2','q8','q4','q5','q6'].map(id=>({id,rating:50}))
    const newPool  = ['q3','q7','q9','q10','q11','q12'].map(id=>({id,rating:50}))

    const buggyResult = handleSaveNextTeamBuggy(editingIdx, nexts, newGroup)

    const allIds = buggyResult.flat()
    // q8 aparece duplicado com bug
    expect(allIds.filter(id => id === 'q8').length).toBe(2)
    // q3 sumiu
    expect(allIds.filter(id => id === 'q3').length).toBe(0)

    // COM A CORRECAO: q3 vai para a 2a, q8 sai da 2a
    const correctResult = handleSaveNextTeamCorrect(editingIdx, nexts, newGroup, newPool)
    const allCorrect = correctResult.flat()
    expect(new Set(allCorrect).size).toBe(allCorrect.length)
    expect(correctResult[0]).toContain('q8')
    expect(correctResult[0]).not.toContain('q3')
    expect(correctResult[1]).toContain('q3')
    expect(correctResult[1]).not.toContain('q8')
  })
})


describe('shuffleTeams — botao de mistura deve existir e funcionar', () => {
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

describe('swapPlayers — logica de troca usada pelo EditTeamsModal', () => {
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
    // Cenario real: time A = [a1, a2, a3], proxima (pool) = [q1, q2, q3]
    // Troca a1 com q1: a1 vai para pool, q1 vai para grupo 0
    // Resultado: total de jogadores deve ser conservado, sem duplicatas
    const groups = [
      [{ id: 'a1', rating: 90 }, { id: 'a2', rating: 80 }, { id: 'a3', rating: 70 }],
      [{ id: 'b1', rating: 60 }, { id: 'b2', rating: 55 }, { id: 'b3', rating: 50 }],
    ]
    const pool = [
      { id: 'q1', rating: 85 }, { id: 'q2', rating: 75 }, { id: 'q3', rating: 65 },
    ]

    const result = swapPlayers({ groups, pool, idA: 'a1', fromA: 0, idB: 'q1', fromB: 'pool' })

    // Total de jogadores deve ser conservado
    const totalBefore = groups.flat().length + pool.length
    const totalAfter = result.groups.flat().length + result.pool.length
    expect(totalAfter).toBe(totalBefore)

    // Nenhuma duplicacao
    const allIds = [...result.groups.flat(), ...result.pool].map(p => p.id)
    const unique = new Set(allIds)
    expect(unique.size).toBe(allIds.length)

    // q1 deve estar no grupo 0 (time A), a1 deve estar no pool
    expect(result.groups[0].map(p => p.id)).toContain('q1')
    expect(result.groups[0].map(p => p.id)).not.toContain('a1')
    expect(result.pool.map(p => p.id)).toContain('a1')
    expect(result.pool.map(p => p.id)).not.toContain('q1')
  })

  it('[RED] BUG3: apos troca entre grupos, o total de jogadores por grupo deve ser conservado', () => {
    // Troca de um grupo com o pool nao deve mudar o tamanho do grupo
    const groups = [
      [{ id: 'a1', rating: 90 }, { id: 'a2', rating: 80 }, { id: 'a3', rating: 70 }],
    ]
    const pool = [{ id: 'p1', rating: 50 }, { id: 'p2', rating: 40 }]

    const result = swapPlayers({ groups, pool, idA: 'a1', fromA: 0, idB: 'p1', fromB: 'pool' })

    // Grupo 0 deve continuar com 3 jogadores
    expect(result.groups[0].length).toBe(3)
    // Pool deve continuar com 2 jogadores
    expect(result.pool.length).toBe(2)
  })
})
