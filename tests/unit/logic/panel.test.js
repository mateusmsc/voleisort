import { describe, it, expect } from 'vitest'
import { panelPath, findSessionByCode } from '../../../src/logic/panel.js'

describe('panelPath — URL pública do painel por código da sessão', () => {
  it('monta /panel/<código> a partir do código da sessão', () => {
    expect(panelPath('NYN201')).toBe('/panel/NYN201')
  })

  it('aceita código em qualquer formato', () => {
    expect(panelPath('ABC123')).toBe('/panel/ABC123')
  })
})

describe('findSessionByCode — resolução do painel pela sessão', () => {
  const sessions = {
    s1: { id: 's1', code: 'NYN201', name: 'Quinta' },
    s2: { id: 's2', code: 'ABC123', name: 'Sexta' },
  }

  it('encontra a sessão pelo código', () => {
    expect(findSessionByCode(sessions, 'NYN201')).toEqual(sessions.s1)
  })

  it('retorna null quando o código não existe', () => {
    expect(findSessionByCode(sessions, 'ZZZ999')).toBeNull()
  })
})
