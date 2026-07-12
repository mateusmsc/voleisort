import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- mock do supabase ---
const mockSingle = vi.fn()
const mockEq     = vi.fn()
const mockSelect = vi.fn()
const mockInsert = vi.fn()
const mockUpdate = vi.fn()
const mockDelete = vi.fn()
const mockUpsert = vi.fn()

const chain = {
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate,
  delete: mockDelete,
  upsert: mockUpsert,
  eq:     mockEq,
  single: mockSingle,
}

// Cada método retorna o próprio chain para permitir encadeamento
Object.values(chain).forEach(fn => fn.mockReturnValue(chain))

vi.mock('@/services/supabase.js', () => ({
  supabase: { from: vi.fn(() => chain) },
}))

// Importa DEPOIS do mock
const { playerService } = await import('@/services/playerService.js')

// ------------------------------------------------------------------

describe('playerService — mapeamento toDb (create)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('converte camelCase → snake_case ao inserir', async () => {
    mockInsert.mockReturnValue({ error: null })

    const player = {
      id: 'p1',
      name: 'Ana',
      createdAt: '2024-01-01T00:00:00.000Z',
      stats: { matches: 0, wins: 0, losses: 0 },
      level: 4,
    }
    await playerService.create(player)

    expect(mockInsert).toHaveBeenCalledWith({
      id:         'p1',
      name:       'Ana',
      created_at: '2024-01-01T00:00:00.000Z',
      stats:      { matches: 0, wins: 0, losses: 0 },
      level:      4,
    })
  })

  it('inclui level no objeto enviado ao banco', async () => {
    mockInsert.mockReturnValue({ error: null })

    const player = {
      id: 'p2',
      name: 'Bruno',
      createdAt: '2024-01-01T00:00:00.000Z',
      stats: { matches: 0, wins: 0, losses: 0 },
      level: 2.5,
    }
    await playerService.create(player)

    const inserted = mockInsert.mock.calls[0][0]
    expect(inserted).toHaveProperty('level', 2.5)
  })

  it('lança erro se o banco retornar erro', async () => {
    mockInsert.mockReturnValue({ error: { message: 'db error' } })

    const player = { id: 'p1', name: 'Ana', createdAt: '', stats: {}, level: 3 }
    await expect(playerService.create(player)).rejects.toMatchObject({ message: 'db error' })
  })
})

// ------------------------------------------------------------------

describe('playerService — mapeamento fromDb (getAll)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('converte snake_case → camelCase ao ler', async () => {
    const dbRow = {
      id:         'p1',
      name:       'Ana',
      created_at: '2024-01-01T00:00:00.000Z',
      stats:      { matches: 3, wins: 2, losses: 1 },
      level:      4.5,
    }
    mockSelect.mockReturnValue({ data: [dbRow], error: null })

    const result = await playerService.getAll()

    expect(result).toEqual([
      {
        id:        'p1',
        name:      'Ana',
        createdAt: '2024-01-01T00:00:00.000Z',
        stats:     { matches: 3, wins: 2, losses: 1 },
        level:     4.5,
      },
    ])
  })

  it('normaliza level: null para 3 (DEFAULT_LEVEL)', async () => {
    const dbRow = {
      id:         'p3',
      name:       'Carlos',
      created_at: '2024-01-01T00:00:00.000Z',
      stats:      { matches: 0, wins: 0, losses: 0 },
      level:      null,
    }
    mockSelect.mockReturnValue({ data: [dbRow], error: null })

    const result = await playerService.getAll()

    expect(result[0].level).toBe(3)
  })

  it('normaliza level: undefined para 3 (DEFAULT_LEVEL)', async () => {
    const dbRow = {
      id:         'p4',
      name:       'Dani',
      created_at: '2024-01-01T00:00:00.000Z',
      stats:      { matches: 0, wins: 0, losses: 0 },
    }
    mockSelect.mockReturnValue({ data: [dbRow], error: null })

    const result = await playerService.getAll()

    expect(result[0].level).toBe(3)
  })

  it('retorna array vazio quando não há jogadores', async () => {
    mockSelect.mockReturnValue({ data: [], error: null })
    const result = await playerService.getAll()
    expect(result).toEqual([])
  })
})

// ------------------------------------------------------------------

describe('playerService — update (patch parcial)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('envia só os campos presentes no patch', async () => {
    mockEq.mockReturnValue({ error: null })
    await playerService.update('p1', { name: 'Bia' })

    expect(mockUpdate).toHaveBeenCalledWith({ name: 'Bia' })
  })

  it('converte createdAt → created_at no patch', async () => {
    mockEq.mockReturnValue({ error: null })
    await playerService.update('p1', { createdAt: '2024-06-01T00:00:00.000Z' })

    expect(mockUpdate).toHaveBeenCalledWith({ created_at: '2024-06-01T00:00:00.000Z' })
  })

  it('não inclui campos ausentes no patch', async () => {
    mockEq.mockReturnValue({ error: null })
    await playerService.update('p1', { stats: { matches: 1, wins: 1, losses: 0 } })

    const patch = mockUpdate.mock.calls[0][0]
    expect(patch).not.toHaveProperty('name')
    expect(patch).not.toHaveProperty('created_at')
    expect(patch).toHaveProperty('stats')
  })

  it('envia level no patch parcial { level: 4.5 }', async () => {
    mockEq.mockReturnValue({ error: null })
    await playerService.update('p1', { level: 4.5 })

    expect(mockUpdate).toHaveBeenCalledWith({ level: 4.5 })
  })

  it('patch { level: 4.5 } não inclui outros campos', async () => {
    mockEq.mockReturnValue({ error: null })
    await playerService.update('p1', { level: 4.5 })

    const patch = mockUpdate.mock.calls[0][0]
    expect(patch).not.toHaveProperty('name')
    expect(patch).not.toHaveProperty('created_at')
    expect(patch).not.toHaveProperty('stats')
    expect(patch).toHaveProperty('level', 4.5)
  })

  it('envia name e level juntos quando ambos estão no patch', async () => {
    mockEq.mockReturnValue({ error: null })
    await playerService.update('p1', { name: 'Novo Nome', level: 4 })

    expect(mockUpdate).toHaveBeenCalledWith({ name: 'Novo Nome', level: 4 })
  })
})

// ------------------------------------------------------------------

describe('playerService — upsertMany', () => {
  beforeEach(() => vi.clearAllMocks())

  it('converte lista para snake_case antes do upsert', async () => {
    mockUpsert.mockReturnValue({ error: null })

    await playerService.upsertMany([
      { id: 'p1', name: 'Ana', createdAt: '2024-01-01T00:00:00.000Z', stats: {}, level: 5 },
      { id: 'p2', name: 'Bia', createdAt: '2024-02-01T00:00:00.000Z', stats: {}, level: 3 },
    ])

    expect(mockUpsert).toHaveBeenCalledWith(
      [
        { id: 'p1', name: 'Ana', created_at: '2024-01-01T00:00:00.000Z', stats: {}, level: 5 },
        { id: 'p2', name: 'Bia', created_at: '2024-02-01T00:00:00.000Z', stats: {}, level: 3 },
      ],
      { onConflict: 'id' }
    )
  })

  it('preserva level em cada registro do upsert', async () => {
    mockUpsert.mockReturnValue({ error: null })

    await playerService.upsertMany([
      { id: 'p1', name: 'Ana', createdAt: '2024-01-01T00:00:00.000Z', stats: {}, level: 4.5 },
    ])

    const rows = mockUpsert.mock.calls[0][0]
    expect(rows[0]).toHaveProperty('level', 4.5)
  })
})
