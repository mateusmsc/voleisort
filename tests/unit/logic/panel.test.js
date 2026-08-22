import { describe, it, expect } from 'vitest'
import { panelPath, findSessionByCode, findSessionByPanelHash } from '../../../src/logic/panel.js'

describe('panelPath — URL pública do painel por panelHash', () => {
  it('monta /panel/<hash> a partir do panelHash da sessão', () => {
    expect(panelPath('ESQ268')).toBe('/panel/ESQ268')
  })

  it('aceita hash em qualquer formato', () => {
    expect(panelPath('ABC123')).toBe('/panel/ABC123')
  })
})

describe('findSessionByPanelHash — resolução do painel pelo hash público', () => {
  const sessions = {
    s1: { id: 's1', code: 'NYN201', panelHash: 'ESQ268', name: 'Quinta' },
    s2: { id: 's2', code: 'ABC123', panelHash: 'XYZ999', name: 'Sexta' },
    s3: { id: 's3', code: 'DEF456', panelHash: null,     name: 'Sem hash' },
  }

  it('encontra a sessão pelo panelHash', () => {
    expect(findSessionByPanelHash(sessions, 'ESQ268')).toEqual(sessions.s1)
  })

  it('retorna null quando o hash não existe', () => {
    expect(findSessionByPanelHash(sessions, 'ZZZ000')).toBeNull()
  })

  it('não confunde panelHash com code', () => {
    expect(findSessionByPanelHash(sessions, 'NYN201')).toBeNull()
  })

  it('ignora sessões com panelHash null', () => {
    expect(findSessionByPanelHash(sessions, null)).toBeNull()
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
