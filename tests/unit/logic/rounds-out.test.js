import { describe, it, expect } from 'vitest'
import {
  computeRoundsOut,
  computeCurrentMatchRoundsOut,
  dayMatchNumber,
  finishedMatchesForStreak,
} from '../../../src/logic/rounds-out.js'

// ---------------------------------------------------------------------------
// computeRoundsOut(allIds, finishedMatches) → { [id]: number }
//
// Para cada id em allIds, conta quantas partidas CONSECUTIVAS (do fim ao início)
// aquele jogador ficou de fora (não apareceu em teams.A ou teams.B).
//
// Regra crítica: se o jogador nunca apareceu em NENHUMA partida histórica
// (recém-chegado / check-in tardio), roundsOut deve ser 0 — ele não "ficou fora",
// simplesmente ainda não havia sido cadastrado.
// ---------------------------------------------------------------------------

// Helpers
function makeMatch(id, round, teamAIds, teamBIds) {
  return { id, round, status: 'finished', teams: { A: teamAIds, B: teamBIds } }
}

describe('computeRoundsOut — lógica base', () => {
  it('jogador que jogou na última partida tem roundsOut=0', () => {
    const matches = [makeMatch('m1', 1, ['p1', 'p2'], ['p3', 'p4'])]
    const originals = ['p1', 'p2', 'p3', 'p4']
    const result = computeRoundsOut(['p1', 'p2', 'p3', 'p4'], matches, originals)
    expect(result['p1']).toBe(0)
    expect(result['p3']).toBe(0)
  })

  it('jogador que ficou fora da última partida tem roundsOut=1', () => {
    const matches = [makeMatch('m1', 1, ['p1', 'p2'], ['p3', 'p4'])]
    // p5 era participante original (estava na fila) mas não jogou
    const originals = ['p1', 'p2', 'p3', 'p4', 'p5']
    const result = computeRoundsOut(['p1', 'p2', 'p3', 'p4', 'p5'], matches, originals)
    expect(result['p5']).toBe(1)
  })

  it('jogador que ficou fora das 2 últimas partidas tem roundsOut=2', () => {
    const matches = [
      makeMatch('m1', 1, ['p1', 'p2'], ['p3', 'p4']),
      makeMatch('m2', 2, ['p1', 'p2'], ['p3', 'p4']),
    ]
    const originals = ['p1', 'p2', 'p3', 'p4', 'p5']
    const result = computeRoundsOut(['p1', 'p2', 'p3', 'p4', 'p5'], matches, originals)
    expect(result['p5']).toBe(2)
  })

  it('contagem para se jogador jogou antes mas ficou fora depois', () => {
    const matches = [
      makeMatch('m1', 1, ['p1', 'p2'], ['p3', 'p5']), // p5 jogou aqui
      makeMatch('m2', 2, ['p1', 'p2'], ['p3', 'p4']), // p5 ficou fora aqui
    ]
    const originals = ['p1', 'p2', 'p3', 'p4', 'p5']
    const result = computeRoundsOut(['p1', 'p2', 'p3', 'p4', 'p5'], matches, originals)
    expect(result['p5']).toBe(1) // só 1 rodada fora consecutiva
  })
})

describe('[RED] computeRoundsOut — jogador recém-chegado deve ter roundsOut=0', () => {
  it('novo jogador (nunca apareceu em nenhuma partida histórica) tem roundsOut=0', () => {
    // 3 partidas já aconteceram, "novo" nunca esteve em nenhuma
    const matches = [
      makeMatch('m1', 1, ['p1', 'p2'], ['p3', 'p4']),
      makeMatch('m2', 2, ['p1', 'p2'], ['p3', 'p4']),
      makeMatch('m3', 3, ['p1', 'p2'], ['p3', 'p4']),
    ]
    // originalParticipantIds NÃO inclui 'novo' — ele chegou depois
    const originals = ['p1', 'p2', 'p3', 'p4']
    const result = computeRoundsOut(['p1', 'p2', 'p3', 'p4', 'novo'], matches, originals)
    expect(result['novo']).toBe(0)
  })

  it('jogador que fez check-in pela primeira vez com partida em andamento tem roundsOut=0', () => {
    const matches = [
      makeMatch('m1', 1, ['a1', 'a2', 'a3'], ['b1', 'b2', 'b3']),
      makeMatch('m2', 2, ['a1', 'a2', 'a3'], ['b1', 'b2', 'b3']),
    ]
    const originals = ['a1', 'a2', 'a3', 'b1', 'b2', 'b3']
    const allIds = ['a1', 'a2', 'a3', 'b1', 'b2', 'b3', 'tardio']
    const result = computeRoundsOut(allIds, matches, originals)
    expect(result['tardio']).toBe(0)
  })

  it('sem histórico de partidas, todos os jogadores têm roundsOut=0', () => {
    const result = computeRoundsOut(['p1', 'p2', 'p3'], [], ['p1', 'p2', 'p3'])
    expect(result['p1']).toBe(0)
    expect(result['p2']).toBe(0)
    expect(result['p3']).toBe(0)
  })

  it('mistura de veteranos e recém-chegados: veteranos contam certo, novos ficam 0', () => {
    const matches = [
      makeMatch('m1', 1, ['vet1', 'vet2'], ['vet3', 'vet4']),
      makeMatch('m2', 2, ['vet1', 'vet2'], ['vet3', 'vet4']),
    ]
    // vet5 era original (estava na fila); novo chegou depois
    const originals = ['vet1', 'vet2', 'vet3', 'vet4', 'vet5']
    const allIds = ['vet1', 'vet2', 'vet3', 'vet4', 'vet5', 'novo']
    const result = computeRoundsOut(allIds, matches, originals)

    expect(result['vet5']).toBe(2) // ficou fora 2x
    expect(result['novo']).toBe(0) // recém-chegado
  })
})

// ---------------------------------------------------------------------------
// computeCurrentMatchRoundsOut(match, sessionMatches) → { [id]: number }
//
// Cenário real (RED 2026-08-21): veterano que jogou em semanas anteriores
// (round < roundsOutResetAt) mas ficou de fora na 1ª partida do dia deve
// aparecer com 1 fora. A identificação de "participante original" considera
// o histórico COMPLETO da sessão; a contagem consecutiva, apenas a janela
// do dia (round >= roundsOutResetAt).
// ---------------------------------------------------------------------------

describe('computeCurrentMatchRoundsOut', () => {
  // Semana anterior (fora da janela do dia)
  const week1 = [
    { id: 'w1m1', round: 1, status: 'finished', teams: { A: ['vet1', 'vet2'], B: ['vet3', 'fila'] } },
    { id: 'w1m2', round: 2, status: 'finished', teams: { A: ['vet1', 'vet2'], B: ['vet3', 'fila'] } },
  ]
  // Hoje: T1 finalizada (fila ficou fora), T2 em andamento (fila segue na fila)
  const todayT1 = {
    id: 't1', round: 3, status: 'finished', roundsOutResetAt: 3,
    teams: { A: ['vet1', 'vet2'], B: ['vet3', 'novo'] }, nextTeams: [['fila']],
  }
  const todayT2 = {
    id: 't2', round: 4, status: 'ongoing', roundsOutResetAt: 3,
    teams: { A: ['vet1', 'vet2'], B: ['vet3', 'novo'] }, nextTeams: [['fila']],
  }
  const sessionMatches = [...week1, todayT1, todayT2]

  it('veterano de semanas anteriores fora na 1ª partida do dia tem 1 fora [RED]', () => {
    const result = computeCurrentMatchRoundsOut(todayT2, sessionMatches)
    expect(result['fila']).toBe(1)
  })

  it('quem jogou a última partida tem 0 fora', () => {
    const result = computeCurrentMatchRoundsOut(todayT2, sessionMatches)
    expect(result['vet1']).toBe(0)
    expect(result['vet3']).toBe(0)
  })

  it('recém-chegado que nunca jogou em nenhuma semana tem 0 fora', () => {
    const tardioT2 = { ...todayT2, nextTeams: [['fila', 'tardio']] }
    const result = computeCurrentMatchRoundsOut(tardioT2, sessionMatches)
    expect(result['tardio']).toBe(0)
  })

  it('exclui a própria partida da contagem e respeita janela do dia', () => {
    // fila só jogou nas semanas anteriores (fora da janela); conta apenas T1
    const result = computeCurrentMatchRoundsOut(todayT2, sessionMatches)
    expect(result['fila']).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Sessão nova, primeiro dia [RED 2026-08-21]: quem ficou de fora na partida 1
// nunca jogou nada, mas ERA participante original (saiu do draft inicial).
// Com match.original_ids persistido na criação, deve contar 1 fora —
// mesmo sem nunca ter aparecido em nenhuma partida finalizada.
// ---------------------------------------------------------------------------

describe('computeCurrentMatchRoundsOut — sessão nova com original_ids', () => {
  const dayT1 = {
    id: 'd1', round: 1, status: 'finished',
    teams: { A: ['p1', 'p2'], B: ['p3', 'p4'] }, nextTeams: [['p5', 'p6', 'p7']],
  }
  // Após encerrar T1: vencedores A, 1ª próxima subiu para B, resto na fila
  const dayT2 = {
    id: 'd2', round: 2, status: 'ongoing',
    teams: { A: ['p1', 'p2'], B: ['p5', 'p6'] }, nextTeams: [['p7', 'p3', 'p4']],
    originalIds: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'],
  }

  it('quem ficou de fora na partida 1 tem 1 fora mesmo nunca tendo jogado [RED]', () => {
    const result = computeCurrentMatchRoundsOut(dayT2, [dayT1, dayT2])
    // p5/p6/p7 ficaram de fora da T1 (mesmo nunca tendo jogado antes)
    expect(result['p5']).toBe(1)
    expect(result['p6']).toBe(1)
    expect(result['p7']).toBe(1)
    // p3/p4 jogaram a T1 → zerados
    expect(result['p3']).toBe(0)
    expect(result['p4']).toBe(0)
  })

  it('sem original_ids, mantém comportamento antigo (fallback por histórico)', () => {
    const semOriginal = { id: 'd2', round: 2, status: 'ongoing', teams: dayT2.teams, nextTeams: dayT2.nextTeams }
    const result = computeCurrentMatchRoundsOut(semOriginal, [dayT1, semOriginal])
    // p7/p3/p4 nunca jogaram: heurística antiga trata como recém-chegados → 0
    expect(result['p7']).toBe(0)
    expect(result['p3']).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// dayMatchNumber [RED 2026-08-21]
//
// Contador de partida exibido reinicia a cada dia: a rodada interna (round)
// permanece global e crescente (para não colidir com as janelas de
// roundsOutResetAt), mas o NÚMERO EXIBIDO é a posição da partida dentro do
// dia atual (delimitado por stats_reset_at). Canceladas não contam.
// ---------------------------------------------------------------------------

describe('dayMatchNumber', () => {
  const m = (id, round, startedAt, status = 'finished') => ({ id, round, startedAt, status })
  const week1 = [
    m('s1', 34, '2026-08-14T10:00Z'),
    m('s2', 35, '2026-08-14T11:00Z'),
    m('s3', 36, '2026-08-14T12:00Z', 'cancelled'),
  ]
  const today = [
    m('h1', 37, '2026-08-21T10:00Z'),
    m('h2', 38, '2026-08-21T11:00Z', 'cancelled'),
    m('h3', 39, '2026-08-21T12:00Z'),
  ]

  it('[RED] partida de hoje é numerada a partir de 1, ignorando semanas anteriores', () => {
    expect(dayMatchNumber(today[0], [...week1, ...today], '2026-08-20T20:00Z')).toBe(1)
    expect(dayMatchNumber(today[2], [...week1, ...today], '2026-08-20T20:00Z')).toBe(2)
  })

  it('sessão nova sem marco: numeração global normal', () => {
    const all = [m('a', 1, '2026-08-21T10:00Z'), m('b', 2, '2026-08-21T11:00Z')]
    expect(dayMatchNumber(all[0], all, null)).toBe(1)
    expect(dayMatchNumber(all[1], all, null)).toBe(2)
  })

  it('canceladas do dia não contam na numeração', () => {
    // h2 cancelada → h3 continua nº 2
    expect(dayMatchNumber(today[2], [...week1, ...today], '2026-08-20T20:00Z')).toBe(2)
  })

  it('partida ainda não presente na lista (recém criada) recebe o próximo número', () => {
    const nova = { id: 'h4', round: 40 }
    expect(dayMatchNumber(nova, [...week1, ...today], '2026-08-20T20:00Z')).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// [RED 2026-08-22] dayMatchNumber — sessão legada sem stats_reset_at (bug prod)
//
// A sessão NYN201 em prod foi criada antes da coluna stats_reset_at e nunca
// passou por resumeSession → stats_reset_at = null. O código atual usa TODAS
// as partidas do histórico (numeração global), então a partida nº 10 do dia
// aparecia como "Partida 34". A numeração exibida deve ser POR DIA mesmo sem
// o marco explícito — agrupando por dia de started_at.
// ---------------------------------------------------------------------------

describe('dayMatchNumber — sessão legada sem stats_reset_at (bug prod)', () => {
  const m = (id, round, startedAt, status = 'finished') => ({ id, round, startedAt, status })

  it('sem marco, conta apenas as partidas do MESMO DIA (não o histórico todo)', () => {
    const semanaAnterior = [
      m('s1', 1, '2026-08-07T10:00Z'),
      m('s2', 2, '2026-08-07T11:00Z'),
    ]
    const hoje = [
      m('h1', 3, '2026-08-21T10:00Z'),
      m('h2', 4, '2026-08-21T11:00Z'),
    ]
    const todas = [...semanaAnterior, ...hoje]

    expect(dayMatchNumber(hoje[0], todas, null)).toBe(1)
    expect(dayMatchNumber(hoje[1], todas, null)).toBe(2)
  })

  it('partida de outro dia não interfere na contagem', () => {
    const h1 = m('h1', 3, '2026-08-21T10:00Z')
    const h2 = m('h2', 4, '2026-08-21T11:00Z')
    const h3 = m('h3', 5, '2026-08-22T10:00Z')
    const todas = [h1, h2, h3]

    expect(dayMatchNumber(h3, todas, null)).toBe(1)
  })

  it('canceladas do mesmo dia não contam', () => {
    const h1 = m('h1', 3, '2026-08-21T10:00Z')
    const cx = m('cx', 4, '2026-08-21T11:00Z', 'cancelled')
    const h3 = m('h3', 5, '2026-08-21T12:00Z')
    const todas = [h1, cx, h3]

    expect(dayMatchNumber(h3, todas, null)).toBe(2)
  })

  it('sessão nova (tudo no mesmo dia) continua numerando de 1 normalmente', () => {
    const a = m('a', 1, '2026-08-21T10:00Z')
    const b = m('b', 2, '2026-08-21T11:00Z')
    expect(dayMatchNumber(a, [a, b], null)).toBe(1)
    expect(dayMatchNumber(b, [a, b], null)).toBe(2)
  })
})



// ---------------------------------------------------------------------------
// finishedMatchesForStreak [RED 2026-08-22] — feature "Trocar com a próxima"
//
// Igual a finishedDayMatches, mas o corte do histórico também respeita
// match.streakResetAt (troca manual zera as vitórias seguidas).
// O corte efetivo é max(roundsOutResetAt, streakResetAt).
// ---------------------------------------------------------------------------

describe('finishedMatchesForStreak', () => {
  function fm(id, round) {
    return { id, round, status: 'finished', teams: { A: ['p1'], B: ['p2'] } }
  }

  it('sem marcadores: retorna todas as finalizadas exceto a própria', () => {
    const hist = [fm('m1', 1), fm('m2', 2)]
    const current = { id: 'cur', round: 3, status: 'ongoing' }
    const result = finishedMatchesForStreak(current, [...hist, current])
    expect(result.map(m => m.id)).toEqual(['m1', 'm2'])
  })

  it('streakResetAt corta o histórico na rodada da troca', () => {
    const hist = [fm('m1', 1), fm('m2', 2)]
    const current = { id: 'cur', round: 3, status: 'ongoing', streakResetAt: 3 }
    const result = finishedMatchesForStreak(current, [...hist, current])
    expect(result).toEqual([])
  })

  it('usa o MAIOR entre roundsOutResetAt e streakResetAt como corte', () => {
    const hist = [fm('m1', 1), fm('m2', 2), fm('m3', 3)]
    const current = { id: 'cur', round: 4, status: 'ongoing', roundsOutResetAt: 2, streakResetAt: 3 }
    const result = finishedMatchesForStreak(current, [...hist, current])
    // corte em 3: apenas m3 conta
    expect(result.map(m => m.id)).toEqual(['m3'])
  })

  it('ignora partidas não finalizadas e canceladas', () => {
    const ongoing = { id: 'x1', round: 2, status: 'ongoing', teams: { A: [], B: [] } }
    const cancelled = { id: 'x2', round: 2, status: 'cancelled', teams: { A: [], B: [] } }
    const finished = fm('m1', 1)
    const current = { id: 'cur', round: 3, status: 'ongoing' }
    const result = finishedMatchesForStreak(current, [finished, ongoing, cancelled, current])
    expect(result.map(m => m.id)).toEqual(['m1'])
  })
})
