import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreate = vi.fn()
const mockUpdate = vi.fn()

vi.mock('@/services/sessionService.js', () => ({
  sessionService: {
    create: mockCreate,
    update: mockUpdate,
    finishSession: vi.fn(),
  },
}))

vi.mock('uuid', () => ({ v4: vi.fn(() => 'fixed-id') }))

const { useSessionStore } = await import('@/store/useSessionStore.js')

describe('useSessionStore — createSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreate.mockResolvedValue(undefined)
    useSessionStore.setState({ sessions: {}, activeSessionId: null })
  })

  it('gera panelHash na criação da sessão', async () => {
    const session = await useSessionStore.getState().createSession('Pelada')

    expect(session.panelHash).toBeTruthy()
    expect(typeof session.panelHash).toBe('string')
    // mesmo formato do código de sessão: 3 letras + 3 dígitos
    expect(session.panelHash).toMatch(/^[A-Z]{3}\d{3}$/)
  })

  it('panelHash é salvo junto da sessão no estado', async () => {
    const session = await useSessionStore.getState().createSession('Pelada')

    const stored = useSessionStore.getState().sessions[session.id]
    expect(stored.panelHash).toBe(session.panelHash)
  })

  it('cada sessão criada tem seu próprio painel (hashes independentes)', async () => {
    const s1 = await useSessionStore.getState().createSession('A')
    useSessionStore.setState({ sessions: {}, activeSessionId: null })
    const s2 = await useSessionStore.getState().createSession('B')

    expect(s1.panelHash).not.toBe(s2.panelHash)
  })
})

describe('useSessionStore — ensurePanelHash (sessões legadas)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUpdate.mockResolvedValue(undefined)
    useSessionStore.setState({ sessions: {}, activeSessionId: null })
  })

  it('gera e persiste panelHash para sessão sem hash', async () => {
    useSessionStore.setState({
      sessions: { s1: { id: 's1', code: 'ABC123', name: 'Legada', panelHash: null } },
    })

    const hash = await useSessionStore.getState().ensurePanelHash('s1')

    expect(hash).toMatch(/^[A-Z]{3}\d{3}$/)
    expect(useSessionStore.getState().sessions.s1.panelHash).toBe(hash)
    expect(mockUpdate).toHaveBeenCalledWith('s1', { panelHash: hash })
  })

  it('retorna o hash existente sem chamar update', async () => {
    useSessionStore.setState({
      sessions: { s1: { id: 's1', code: 'ABC123', name: 'Nova', panelHash: 'XYZ789' } },
    })

    const hash = await useSessionStore.getState().ensurePanelHash('s1')

    expect(hash).toBe('XYZ789')
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('retorna null para sessão inexistente sem quebrar', async () => {
    const hash = await useSessionStore.getState().ensurePanelHash('fantasma')
    expect(hash).toBeNull()
    expect(mockUpdate).not.toHaveBeenCalled()
  })
})

describe('useSessionStore — finishSession / resumeSession (ciclo diário)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUpdate.mockResolvedValue(undefined)
    useSessionStore.setState({ sessions: {}, activeSessionId: null })
  })

  it('finishSession NÃO altera statsResetAt (marco é gravado ao retomar)', async () => {
    useSessionStore.setState({
      sessions: {
        s1: { id: 's1', code: 'ABC123', name: 'X', status: 'active',
              statsResetAt: '2026-08-14T12:00:00.000Z', panelHash: 'OLD111' },
      },
    })

    await useSessionStore.getState().finishSession('s1')

    const s = useSessionStore.getState().sessions.s1
    expect(s.status).toBe('finished')
    expect(s.statsResetAt).toBe('2026-08-14T12:00:00.000Z')
  })

  it('resumeSession volta para active, rotaciona o hash e marca início do dia', async () => {
    useSessionStore.setState({
      sessions: {
        s1: { id: 's1', code: 'ABC123', name: 'X', status: 'finished',
              panelHash: 'HGT440', statsResetAt: '2026-08-14T12:00:00.000Z' },
      },
    })

    const before = Date.now() - 1000
    await useSessionStore.getState().resumeSession('s1')
    const after = Date.now() + 1000

    const s = useSessionStore.getState().sessions.s1
    expect(s.status).toBe('active')
    // novo hash para o novo dia — não pode ser o antigo HGT440
    expect(s.panelHash).toMatch(/^[A-Z]{3}\d{3}$/)
    expect(s.panelHash).not.toBe('HGT440')
    // statsResetAt marca o INÍCIO do novo dia (agora)
    expect(new Date(s.statsResetAt).getTime()).toBeGreaterThanOrEqual(before)
    expect(new Date(s.statsResetAt).getTime()).toBeLessThanOrEqual(after)
    expect(mockUpdate).toHaveBeenCalledWith('s1', {
      status: 'active',
      panelHash: s.panelHash,
      statsResetAt: s.statsResetAt,
    })
  })

  it('resumeSession em sessão já ativa não altera nada', async () => {
    useSessionStore.setState({
      sessions: {
        s1: { id: 's1', code: 'ABC123', name: 'X', status: 'active', panelHash: 'CUR222' },
      },
    })

    await useSessionStore.getState().resumeSession('s1')

    expect(useSessionStore.getState().sessions.s1.panelHash).toBe('CUR222')
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('resumeSession em sessão inexistente não quebra', async () => {
    await useSessionStore.getState().resumeSession('fantasma')
    expect(mockUpdate).not.toHaveBeenCalled()
  })
})
