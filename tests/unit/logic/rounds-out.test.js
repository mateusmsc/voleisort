import { describe, it, expect } from 'vitest'
import { computeRoundsOut } from '../../../src/logic/rounds-out.js'

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
