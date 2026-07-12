import { playerService }  from './playerService'
import { sessionService } from './sessionService'
import { matchService }   from './matchService'
import { usePlayerStore }  from '../store/usePlayerStore'
import { useSessionStore } from '../store/useSessionStore'
import { useMatchStore }   from '../store/useMatchStore'

export async function hydrateStores() {
  // Busca sessões primeiro — elas determinam quais players e matches carregar
  const sessions = await sessionService.getAll()

  const sessionIds = sessions.map(s => s.id)

  // Coleta os IDs de players referenciados por qualquer sessão (sem duplicatas)
  const playerIdSet = new Set(sessions.flatMap(s => s.playerIds ?? []))
  const playerIds = [...playerIdSet]

  // Busca players e matches em paralelo, apenas os referenciados pelas sessões
  const [players, matchArrays] = await Promise.all([
    playerService.getManyByIds(playerIds),
    sessionIds.length > 0
      ? Promise.all(sessionIds.map(id => matchService.getBySession(id)))
      : Promise.resolve([]),
  ])

  const matches = matchArrays.flat()

  // Popula os stores em memória
  usePlayerStore.getState()._hydrate(players)
  useSessionStore.getState()._hydrate(sessions)
  useMatchStore.getState()._hydrate(matches)
}
