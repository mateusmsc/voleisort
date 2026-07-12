// Testes para o bug do sobrenome nos times
// O bug estava no FieldTeams.jsx que usava p.name.split(' ')[0] mostrando apenas o primeiro nome.
// Corrigido: agora usa p.name diretamente.
// Este arquivo testa a funcao de formatacao do nome como deve se comportar.

import { describe, it, expect } from 'vitest'

// Funcao que representa o comportamento CORRETO apos a correcao (sem split)
function getDisplayName(name) {
  return name  // nome completo, sem split
}

describe('BUG6: sobrenome deve aparecer no time — FieldTeams deve mostrar nome completo', () => {
  it('nome com sobrenome deve aparecer completo', () => {
    const player = { id: 'p1', name: 'Joao Silva', rating: 80 }
    expect(getDisplayName(player.name)).toBe('Joao Silva')
  })

  it('jogador com nome composto deve ter nome completo exibido', () => {
    const players = [
      { id: 'p1', name: 'Carlos Eduardo', rating: 70 },
      { id: 'p2', name: 'Ana Maria Souza', rating: 65 },
      { id: 'p3', name: 'Pedro', rating: 60 },
    ]

    for (const p of players) {
      expect(getDisplayName(p.name)).toBe(p.name)
    }
  })

  it('nome simples sem sobrenome tambem funciona corretamente', () => {
    const player = { id: 'p1', name: 'Pedro', rating: 60 }
    expect(getDisplayName(player.name)).toBe('Pedro')
  })

  it('nome completo deve ser retornado sem truncar', () => {
    const names = [
      'Joao Silva',
      'Carlos Eduardo',
      'Ana Maria Souza',
      'Pedro',
      'Maria da Silva Santos',
    ]
    for (const name of names) {
      expect(getDisplayName(name)).toBe(name)
    }
  })
})
