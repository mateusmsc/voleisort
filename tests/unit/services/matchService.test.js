import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- mock do supabase ---
const mockSingle = vi.fn()
const mockEq     = vi.fn()
const mockOrder  = vi.fn()
const mockSelect = vi.fn()
const mockInsert = vi.fn()
const mockUpdate = vi.fn()

const chain = {
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate,
  eq:     mockEq,
  order:  mockOrder,
  single: mockSingle,
}

Object.values(chain).forEach(fn => fn.mockReturnValue(chain))

vi.mock('@/services/supabase.js', () => ({
  supabase: { from: vi.fn(() => chain) },
}))

const { matchService } = await import('@/services/matchService.js')

// ------------------------------------------------------------------

describe('matchService — mapeamento toDb (create)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('converte todos os campos camelCase → snake_case ao inserir', async () => {
    mockInsert.mockReturnValue({ error: null })

    const match = {
      id:         'm1',
      sessionId:  'sess1',
      round:      1,
      status:     'ongoing',
      teams:      { A: ['p1', 'p2'], B: ['p3', 'p4'] },
      nextTeams:  [['p5', 'p6']],
      winner:     null,
      startedAt:  '2024-01-01T10:00:00.000Z',
      finishedAt: null,
    }
    await matchService.create(match)

    expect(mockInsert).toHaveBeenCalledWith({
      id:          'm1',
      session_id:  'sess1',
      round:       1,
      status:      'ongoing',
      teams:       { A: ['p1', 'p2'], B: ['p3', 'p4'] },
      next_teams:  [['p5', 'p6']],
      winner:      null,
      started_at:  '2024-01-01T10:00:00.000Z',
      finished_at: null,
    })
  })

  it('inclui rounds_out_reset_at quando definido', async () => {
    mockInsert.mockReturnValue({ error: null })

    const match = {
      id: 'm1', sessionId: 's1', round: 2, status: 'ongoing',
      teams: { A: [], B: [] }, nextTeams: [], winner: null,
      startedAt: '', finishedAt: null,
      roundsOutResetAt: 2,
    }
    await matchService.create(match)

    const inserted = mockInsert.mock.calls[0][0]
    expect(inserted).toHaveProperty('rounds_out_reset_at', 2)
  })

  it('omite rounds_out_reset_at quando undefined', async () => {
    mockInsert.mockReturnValue({ error: null })

    const match = {
      id: 'm1', sessionId: 's1', round: 1, status: 'ongoing',
      teams: { A: [], B: [] }, nextTeams: [], winner: null,
      startedAt: '', finishedAt: null,
      // roundsOutResetAt ausente
    }
    await matchService.create(match)

    const inserted = mockInsert.mock.calls[0][0]
    expect(inserted).not.toHaveProperty('rounds_out_reset_at')
  })

  it('lança erro se o banco retornar erro', async () => {
    mockInsert.mockReturnValue({ error: { message: 'insert error' } })

    const match = {
      id: 'm1', sessionId: 's1', round: 1, status: 'ongoing',
      teams: {}, nextTeams: [], winner: null, startedAt: '', finishedAt: null,
    }
    await expect(matchService.create(match)).rejects.toMatchObject({ message: 'insert error' })
  })
})

// ------------------------------------------------------------------

describe('matchService — mapeamento fromDb (getBySession)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('converte snake_case → camelCase ao ler', async () => {
    const dbRow = {
      id:          'm1',
      session_id:  'sess1',
      round:       1,
      status:      'finished',
      teams:       { A: ['p1'], B: ['p2'] },
      next_teams:  [['p3']],
      winner:      'A',
      started_at:  '2024-01-01T10:00:00.000Z',
      finished_at: '2024-01-01T11:00:00.000Z',
      rounds_out_reset_at: null,
    }
    mockOrder.mockReturnValue({ data: [dbRow], error: null })

    const result = await matchService.getBySession('sess1')

    expect(result).toEqual([
      {
        id:         'm1',
        sessionId:  'sess1',
        round:      1,
        status:     'finished',
        teams:      { A: ['p1'], B: ['p2'] },
        nextTeams:  [['p3']],
        winner:     'A',
        startedAt:  '2024-01-01T10:00:00.000Z',
        finishedAt: '2024-01-01T11:00:00.000Z',
        // roundsOutResetAt ausente quando null
      },
    ])
  })

  it('usa [] como default para next_teams null', async () => {
    const dbRow = {
      id: 'm1', session_id: 's1', round: 1, status: 'ongoing',
      teams: {}, next_teams: null, winner: null,
      started_at: '', finished_at: null, rounds_out_reset_at: null,
    }
    mockOrder.mockReturnValue({ data: [dbRow], error: null })

    const [result] = await matchService.getBySession('s1')
    expect(result.nextTeams).toEqual([])
  })

  it('usa null como default para winner null', async () => {
    const dbRow = {
      id: 'm1', session_id: 's1', round: 1, status: 'ongoing',
      teams: {}, next_teams: [], winner: null,
      started_at: '', finished_at: null, rounds_out_reset_at: null,
    }
    mockOrder.mockReturnValue({ data: [dbRow], error: null })

    const [result] = await matchService.getBySession('s1')
    expect(result.winner).toBeNull()
  })

  it('inclui roundsOutResetAt apenas quando não é null/undefined', async () => {
    const dbRowWithReset = {
      id: 'm1', session_id: 's1', round: 3, status: 'ongoing',
      teams: {}, next_teams: [], winner: null,
      started_at: '', finished_at: null,
      rounds_out_reset_at: 3,
    }
    mockOrder.mockReturnValue({ data: [dbRowWithReset], error: null })

    const [result] = await matchService.getBySession('s1')
    expect(result).toHaveProperty('roundsOutResetAt', 3)
  })

  it('omite roundsOutResetAt quando null no banco', async () => {
    const dbRow = {
      id: 'm1', session_id: 's1', round: 1, status: 'ongoing',
      teams: {}, next_teams: [], winner: null,
      started_at: '', finished_at: null,
      rounds_out_reset_at: null,
    }
    mockOrder.mockReturnValue({ data: [dbRow], error: null })

    const [result] = await matchService.getBySession('s1')
    expect(result).not.toHaveProperty('roundsOutResetAt')
  })
})

// ------------------------------------------------------------------

describe('matchService — updateNextTeams', () => {
  beforeEach(() => vi.clearAllMocks())

  it('mapeia nextTeams → next_teams no update', async () => {
    mockEq.mockReturnValue({ error: null })
    await matchService.updateNextTeams('m1', [['p5', 'p6']])

    expect(mockUpdate).toHaveBeenCalledWith({ next_teams: [['p5', 'p6']] })
  })
})

// ------------------------------------------------------------------

describe('matchService — finish e cancel', () => {
  beforeEach(() => vi.clearAllMocks())

  it('finish envia status finished e winner', async () => {
    mockEq.mockReturnValue({ error: null })
    await matchService.finish('m1', 'B')

    const patch = mockUpdate.mock.calls[0][0]
    expect(patch.status).toBe('finished')
    expect(patch.winner).toBe('B')
    expect(patch).toHaveProperty('finished_at')
  })

  it('cancel envia status cancelled', async () => {
    mockEq.mockReturnValue({ error: null })
    await matchService.cancel('m1')

    const patch = mockUpdate.mock.calls[0][0]
    expect(patch.status).toBe('cancelled')
    expect(patch).toHaveProperty('finished_at')
  })
})

// ------------------------------------------------------------------

describe('matchService — updateRoundsOutResetAt', () => {
  beforeEach(() => vi.clearAllMocks())

  it('mapeia round → rounds_out_reset_at no update', async () => {
    mockEq.mockReturnValue({ error: null })
    await matchService.updateRoundsOutResetAt('m1', 4)

    expect(mockUpdate).toHaveBeenCalledWith({ rounds_out_reset_at: 4 })
  })
})
