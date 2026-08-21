import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- mock do supabase ---
// Cada método retorna o chain inteiro para suportar qualquer sequência de encadeamento
const mockSingle = vi.fn()
const mockEq     = vi.fn()
const mockSelect = vi.fn()
const mockInsert = vi.fn()
const mockUpdate = vi.fn()
const mockUpsert = vi.fn()

const chain = {}
chain.select = mockSelect
chain.insert = mockInsert
chain.update = mockUpdate
chain.upsert = mockUpsert
chain.eq     = mockEq
chain.single = mockSingle

// Cada mock retorna o chain por padrão para suportar encadeamento,
// exceto mockSingle que termina a cadeia — cada teste configura seu retorno
function resetChainDefaults() {
  mockSelect.mockReturnValue(chain)
  mockInsert.mockReturnValue(chain)
  mockUpdate.mockReturnValue(chain)
  mockUpsert.mockReturnValue(chain)
  mockEq.mockReturnValue(chain)
}

vi.mock('@/services/supabase.js', () => ({
  supabase: { from: vi.fn(() => chain) },
}))

const { sessionService } = await import('@/services/sessionService.js')

// ------------------------------------------------------------------

describe('sessionService — mapeamento toDb (create)', () => {
  beforeEach(() => { vi.clearAllMocks(); resetChainDefaults() })

  it('converte todos os campos camelCase → snake_case ao inserir', async () => {
    mockInsert.mockReturnValue({ error: null })

    const session = {
      id:           'sess1',
      code:         'ABC123',
      name:         'Pelada Sexta',
      createdAt:    '2024-01-01T00:00:00.000Z',
      config:       { teamSize: 6, maxRoundsOut: 2, ratingDeltaThreshold: 10 },
      playerIds:    ['p1', 'p2'],
      checkedInIds: ['p1'],
      matchIds:     ['m1'],
      status:       'active',
    }
    await sessionService.create(session)

    expect(mockInsert).toHaveBeenCalledWith({
      id:             'sess1',
      code:           'ABC123',
      name:           'Pelada Sexta',
      created_at:     '2024-01-01T00:00:00.000Z',
      config:         { teamSize: 6, maxRoundsOut: 2, ratingDeltaThreshold: 10 },
      player_ids:     ['p1', 'p2'],
      checked_in_ids: ['p1'],
      match_ids:      ['m1'],
      status:         'active',
    })
  })

  it('inclui status: active no objeto enviado ao banco', async () => {
    mockInsert.mockReturnValue({ error: null })

    const session = {
      id: 's2', code: 'X', name: 'Y', createdAt: '',
      config: {}, playerIds: [], checkedInIds: [], matchIds: [],
    }
    await sessionService.create(session)

    const inserted = mockInsert.mock.calls[0][0]
    expect(inserted).toHaveProperty('status', 'active')
  })

  it('lança erro se o banco retornar erro', async () => {
    mockInsert.mockReturnValue({ error: { message: 'insert failed' } })

    const session = {
      id: 's1', code: 'X', name: 'Y', createdAt: '',
      config: {}, playerIds: [], checkedInIds: [], matchIds: [],
    }
    await expect(sessionService.create(session)).rejects.toMatchObject({ message: 'insert failed' })
  })
})

// ------------------------------------------------------------------

describe('sessionService — mapeamento fromDb (getAll)', () => {
  beforeEach(() => { vi.clearAllMocks(); resetChainDefaults() })

  it('converte snake_case → camelCase ao ler', async () => {
    const dbRow = {
      id:             'sess1',
      code:           'ABC123',
      name:           'Pelada Sexta',
      created_at:     '2024-01-01T00:00:00.000Z',
      config:         { teamSize: 6, maxRoundsOut: 2, ratingDeltaThreshold: 10 },
      player_ids:     ['p1', 'p2'],
      checked_in_ids: ['p1'],
      match_ids:      ['m1'],
      status:         'active',
    }
    mockSelect.mockReturnValue({ data: [dbRow], error: null })

    const result = await sessionService.getAll()

    expect(result).toEqual([
      {
        id:           'sess1',
        code:         'ABC123',
        name:         'Pelada Sexta',
        createdAt:    '2024-01-01T00:00:00.000Z',
        config:       { teamSize: 6, maxRoundsOut: 2, ratingDeltaThreshold: 10 },
        playerIds:    ['p1', 'p2'],
        checkedInIds: ['p1'],
        matchIds:     ['m1'],
        status:       'active',
        panelHash:    null,
        statsResetAt: null,
      },
    ])
  })

  it('usa arrays vazios como default quando colunas são null', async () => {
    const dbRow = {
      id: 's1', code: 'X', name: 'Y', created_at: '',
      config: {},
      player_ids:     null,
      checked_in_ids: null,
      match_ids:      null,
      status:         'active',
    }
    mockSelect.mockReturnValue({ data: [dbRow], error: null })

    const [result] = await sessionService.getAll()

    expect(result.playerIds).toEqual([])
    expect(result.checkedInIds).toEqual([])
    expect(result.matchIds).toEqual([])
  })

  it('retorna status: finished quando row tem status: finished', async () => {
    const dbRow = {
      id: 's1', code: 'X', name: 'Y', created_at: '',
      config: {}, player_ids: [], checked_in_ids: [], match_ids: [],
      status: 'finished',
    }
    mockSelect.mockReturnValue({ data: [dbRow], error: null })

    const [result] = await sessionService.getAll()
    expect(result.status).toBe('finished')
  })

  it('normaliza status: null (sessão legada) para active', async () => {
    const dbRow = {
      id: 's1', code: 'X', name: 'Y', created_at: '',
      config: {}, player_ids: [], checked_in_ids: [], match_ids: [],
      status: null,
    }
    mockSelect.mockReturnValue({ data: [dbRow], error: null })

    const [result] = await sessionService.getAll()
    expect(result.status).toBe('active')
  })
})

// ------------------------------------------------------------------

describe('sessionService — update (patch parcial)', () => {
  beforeEach(() => { vi.clearAllMocks(); resetChainDefaults() })

  it('mapeia playerIds → player_ids', async () => {
    mockEq.mockReturnValue({ error: null })
    await sessionService.update('s1', { playerIds: ['p1', 'p2'] })

    const patch = mockUpdate.mock.calls[0][0]
    expect(patch).toHaveProperty('player_ids', ['p1', 'p2'])
    expect(patch).not.toHaveProperty('playerIds')
  })

  it('mapeia checkedInIds → checked_in_ids', async () => {
    mockEq.mockReturnValue({ error: null })
    await sessionService.update('s1', { checkedInIds: ['p1'] })

    const patch = mockUpdate.mock.calls[0][0]
    expect(patch).toHaveProperty('checked_in_ids', ['p1'])
  })

  it('mapeia matchIds → match_ids', async () => {
    mockEq.mockReturnValue({ error: null })
    await sessionService.update('s1', { matchIds: ['m1', 'm2'] })

    const patch = mockUpdate.mock.calls[0][0]
    expect(patch).toHaveProperty('match_ids', ['m1', 'm2'])
  })

  it('não inclui campos ausentes no patch', async () => {
    mockEq.mockReturnValue({ error: null })
    await sessionService.update('s1', { config: { teamSize: 4 } })

    const patch = mockUpdate.mock.calls[0][0]
    expect(patch).toHaveProperty('config')
    expect(patch).not.toHaveProperty('player_ids')
    expect(patch).not.toHaveProperty('checked_in_ids')
    expect(patch).not.toHaveProperty('match_ids')
  })

  it('envia status: finished no patch', async () => {
    mockEq.mockReturnValue({ error: null })
    await sessionService.update('s1', { status: 'finished' })

    expect(mockUpdate).toHaveBeenCalledWith({ status: 'finished' })
  })

  it('não inclui status quando ausente do patch', async () => {
    mockEq.mockReturnValue({ error: null })
    await sessionService.update('s1', { config: { teamSize: 6 } })

    const patch = mockUpdate.mock.calls[0][0]
    expect(patch).not.toHaveProperty('status')
  })
})

// ------------------------------------------------------------------

describe('sessionService — appendPlayerId', () => {
  beforeEach(() => { vi.clearAllMocks(); resetChainDefaults() })

  // appendPlayerId faz dois supabase.from() separados:
  //   1º: .select('player_ids').eq(...).single()  → lê o array atual
  //   2º: via this.update → .update(patch).eq(...)  → persiste
  // O mock de `supabase.from` retorna sempre o mesmo chain, então
  // configuramos mockSingle para o SELECT e mockEq para o UPDATE.

  it('adiciona playerId ao array existente', async () => {
    // 1º eq: parte da cadeia SELECT → deve retornar chain para .single() funcionar
    mockEq.mockReturnValueOnce(chain)
    mockSingle.mockReturnValueOnce({ data: { player_ids: ['p1'] }, error: null })
    // 2º eq: parte da cadeia UPDATE → finaliza com { error: null }
    mockEq.mockReturnValueOnce({ error: null })

    await sessionService.appendPlayerId('s1', 'p2')

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ player_ids: ['p1', 'p2'] })
    )
  })

  it('não duplica se playerId já existe', async () => {
    mockEq.mockReturnValueOnce(chain)
    mockSingle.mockReturnValueOnce({ data: { player_ids: ['p1', 'p2'] }, error: null })

    await sessionService.appendPlayerId('s1', 'p1')

    // update não deve ter sido chamado
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('trata player_ids null como array vazio', async () => {
    mockEq.mockReturnValueOnce(chain)
    mockSingle.mockReturnValueOnce({ data: { player_ids: null }, error: null })
    mockEq.mockReturnValueOnce({ error: null })

    await sessionService.appendPlayerId('s1', 'p1')

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ player_ids: ['p1'] })
    )
  })
})

// ------------------------------------------------------------------

describe('sessionService — upsert', () => {
  beforeEach(() => { vi.clearAllMocks(); resetChainDefaults() })

  it('converte para snake_case antes do upsert', async () => {
    mockUpsert.mockReturnValue({ error: null })

    const session = {
      id: 's1', code: 'X', name: 'Y', createdAt: '2024-01-01T00:00:00.000Z',
      config: {}, playerIds: ['p1'], checkedInIds: [], matchIds: [],
    }
    await sessionService.upsert(session)

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        player_ids:     ['p1'],
        checked_in_ids: [],
        match_ids:      [],
        created_at:     '2024-01-01T00:00:00.000Z',
      }),
      { onConflict: 'id' }
    )
  })
})

// ------------------------------------------------------------------

describe('sessionService — finishSession', () => {
  beforeEach(() => { vi.clearAllMocks(); resetChainDefaults() })

  it('chama update com { status: finished } para o id correto', async () => {
    mockEq.mockReturnValue({ error: null })

    await sessionService.finishSession('sess-abc')

    expect(mockUpdate).toHaveBeenCalledWith({ status: 'finished' })
    expect(mockEq).toHaveBeenCalledWith('id', 'sess-abc')
  })
})

// ------------------------------------------------------------------

describe('sessionService — panelHash', () => {
  beforeEach(() => { vi.clearAllMocks(); resetChainDefaults() })

  it('create converte panelHash → panel_hash no objeto enviado ao banco', async () => {
    mockInsert.mockReturnValue({ error: null })

    const session = {
      id: 's1', code: 'X', name: 'Y', createdAt: '',
      config: {}, playerIds: [], checkedInIds: [], matchIds: [],
      panelHash: 'K7F2X9',
    }
    await sessionService.create(session)

    const inserted = mockInsert.mock.calls[0][0]
    expect(inserted).toHaveProperty('panel_hash', 'K7F2X9')
    expect(inserted).not.toHaveProperty('panelHash')
  })

  it('fromDb com panel_hash null retorna panelHash: null (sessão legada)', async () => {
    const dbRow = {
      id: 's1', code: 'X', name: 'Y', created_at: '',
      config: {}, player_ids: [], checked_in_ids: [], match_ids: [],
      status: 'active',
      panel_hash: null,
    }
    mockSelect.mockReturnValue({ data: [dbRow], error: null })

    const [result] = await sessionService.getAll()
    expect(result.panelHash).toBeNull()
  })

  it('fromDb converte panel_hash → panelHash ao ler', async () => {
    const dbRow = {
      id: 's1', code: 'X', name: 'Y', created_at: '',
      config: {}, player_ids: [], checked_in_ids: [], match_ids: [],
      status: 'active',
      panel_hash: 'ABC123',
    }
    mockSelect.mockReturnValue({ data: [dbRow], error: null })

    const [result] = await sessionService.getAll()
    expect(result.panelHash).toBe('ABC123')
  })

  it('update envia panel_hash no patch quando presente', async () => {
    mockEq.mockReturnValue({ error: null })
    await sessionService.update('s1', { panelHash: 'XYZ789' })

    const patch = mockUpdate.mock.calls[0][0]
    expect(patch).toHaveProperty('panel_hash', 'XYZ789')
    expect(patch).not.toHaveProperty('panelHash')
  })

  it('não inclui panel_hash quando ausente do patch', async () => {
    mockEq.mockReturnValue({ error: null })
    await sessionService.update('s1', { status: 'finished' })

    const patch = mockUpdate.mock.calls[0][0]
    expect(patch).not.toHaveProperty('panel_hash')
  })

  it('mapeia statsResetAt ↔ stats_reset_at no create e update', async () => {
    mockInsert.mockReturnValue({ error: null })
    mockEq.mockReturnValue({ error: null })

    await sessionService.create({
      id: 's1', code: 'X', name: 'Y', createdAt: '',
      config: {}, playerIds: [], checkedInIds: [], matchIds: [],
      statsResetAt: '2026-08-21T12:00:00.000Z',
    })
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ stats_reset_at: '2026-08-21T12:00:00.000Z' })
    )

    await sessionService.update('s1', { statsResetAt: '2026-08-28T12:00:00.000Z' })
    expect(mockUpdate).toHaveBeenCalledWith({ stats_reset_at: '2026-08-28T12:00:00.000Z' })
  })
})

// ------------------------------------------------------------------

describe('sessionService — getByPanelHash', () => {
  beforeEach(() => { vi.clearAllMocks(); resetChainDefaults() })

  it('busca por panel_hash e retorna a sessão mapeada', async () => {
    const dbRow = {
      id: 's1', code: 'X', name: 'Y', created_at: '',
      config: {}, player_ids: ['p1'], checked_in_ids: [], match_ids: [],
      status: 'active',
      panel_hash: 'K7F2X9',
    }
    mockEq.mockReturnValueOnce(chain)
    mockSingle.mockReturnValueOnce({ data: dbRow, error: null })

    const result = await sessionService.getByPanelHash('K7F2X9')

    expect(mockEq).toHaveBeenCalledWith('panel_hash', 'K7F2X9')
    expect(result.id).toBe('s1')
    expect(result.panelHash).toBe('K7F2X9')
  })

  it('retorna null quando não encontra (PGRST116)', async () => {
    mockEq.mockReturnValueOnce(chain)
    mockSingle.mockReturnValueOnce({ data: null, error: { code: 'PGRST116' } })

    const result = await sessionService.getByPanelHash('NAOEXISTE')
    expect(result).toBeNull()
  })

  it('lança erro para falhas que não sejam not-found', async () => {
    mockEq.mockReturnValueOnce(chain)
    mockSingle.mockReturnValueOnce({ data: null, error: { code: 'XX000', message: 'boom' } })

    await expect(sessionService.getByPanelHash('K7F2X9')).rejects.toMatchObject({ message: 'boom' })
  })
})
