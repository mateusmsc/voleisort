/**
 * computeRoundsOut(allIds, finishedMatches, originalParticipantIds?) → { [id]: number }
 *
 * Para cada id em allIds, conta quantas partidas CONSECUTIVAS (do fim ao início
 * do histórico) aquele jogador ficou de fora (não apareceu em teams.A ou teams.B).
 *
 * Regra crítica de equidade: se o jogador NÃO estava entre os participantes
 * originais da partida atual (chegou via check-in tardio ou foi criado no meio),
 * seu roundsOut é sempre 0 — ele não "ficou de fora", simplesmente não existia/
 * não havia chegado ainda.
 *
 * @param {string[]} allIds                  - IDs de todos os jogadores na partida atual
 * @param {object[]} finishedMatches         - Partidas finalizadas do histórico
 * @param {string[]} [originalParticipantIds] - IDs que estavam na partida quando ela começou
 *                                             (teams.A + teams.B + nextTeams da criação).
 *                                             Se omitido, usa heurística: jogadores que
 *                                             aparecem em pelo menos uma partida histórica.
 */
export function computeRoundsOut(allIds, finishedMatches, originalParticipantIds) {
  const counts = {}
  const originalSet = originalParticipantIds
    ? new Set(originalParticipantIds)
    : null

  for (const id of allIds) {
    // Determina se o jogador era participante original:
    // - se originalSet foi fornecido: usa ele diretamente
    // - se não: verifica se apareceu em pelo menos uma partida histórica
    const isOriginal = originalSet
      ? originalSet.has(id)
      : finishedMatches.some(m => m.teams.A.includes(id) || m.teams.B.includes(id))

    // Recém-chegado / check-in tardio → roundsOut = 0
    if (!isOriginal) {
      counts[id] = 0
      continue
    }

    // Conta partidas consecutivas do fim ao início em que não jogou
    let consecutive = 0
    for (let i = finishedMatches.length - 1; i >= 0; i--) {
      const m = finishedMatches[i]
      const played = [...m.teams.A, ...m.teams.B]
      if (played.includes(id)) break
      consecutive++
    }
    counts[id] = consecutive
  }

  return counts
}

/**
 * finishedDayMatches(match, sessionMatches) → partidas finalizadas na janela
 * do dia (round >= match.roundsOutResetAt), excluindo a própria partida.
 * Usada por roundsOut e winStreak.
 */
export function finishedDayMatches(match, sessionMatches) {
  const resetFromRound = match.roundsOutResetAt ?? 0
  return sessionMatches.filter(
    m => m.id !== match.id && m.status === 'finished' && m.round >= resetFromRound
  )
}

/**
 * nextRoundForDay(sessionMatches, statsResetAt) → número da próxima rodada
 *
 * A numeração de partidas reinicia a cada dia: quando a sessão tem marco de
 * retomada (stats_reset_at), apenas partidas iniciadas depois dele contam.
 * Sem marco (sessão nova), mantém o comportamento antigo (máximo global + 1).
 * Partidas canceladas do dia continuam contando para não repetir número.
 */
export function nextRoundForDay(sessionMatches, statsResetAt) {
  const dayMatches = statsResetAt
    ? sessionMatches.filter(m => new Date(m.startedAt) > new Date(statsResetAt))
    : sessionMatches

  if (dayMatches.length === 0) return 1
  return Math.max(...dayMatches.map(m => m.round)) + 1
}

/**
 * dayMatchNumber(currentMatch, sessionMatches, statsResetAt) → número exibido
 *
 * Contador de partida por dia: retorna a posição da partida entre as partidas
 * do dia atual (iniciadas após stats_reset_at; sem marco, usa tudo).
 * A rodada interna (round) permanece global — só o número EXIBIDO é diário.
 * Partidas canceladas não contam.
 */
export function dayMatchNumber(currentMatch, sessionMatches, statsResetAt) {
  const pool = statsResetAt
    ? sessionMatches.filter(m => new Date(m.startedAt) > new Date(statsResetAt))
    : sessionMatches

  const ordered = pool
    .filter(m => m.status !== 'cancelled')
    .sort((a, b) => a.round - b.round)

  const idx = ordered.findIndex(m => m.id === currentMatch.id)
  return idx === -1 ? ordered.length + 1 : idx + 1
}

/**
 * computeCurrentMatchRoundsOut(match, sessionMatches) → { [id]: number }
 *
 * RoundsOut da partida atual para exibição (tela Match e painel público).
 *
 * - Janela do dia: apenas partidas finalizadas com round >= match.roundsOutResetAt
 *   contam como "fora consecutivo" (o reset semanal zera a contagem).
 * - Identificação de participante original usa o histórico COMPLETO da sessão:
 *   veterano de semanas anteriores que ficou fora na 1ª partida do dia deve
 *   aparecer com 1 fora. Se usasse só a janela, ele seria confundido com
 *   recém-chegado e ficaria incorretamente com 0.
 */
export function computeCurrentMatchRoundsOut(match, sessionMatches) {
  const windowedFinished = finishedDayMatches(match, sessionMatches)

  // Participantes originais: preferir a lista persistida na criação da partida
  // (match.originalIds). Fallback heurístico para partidas antigas sem a lista:
  // quem aparece em alguma partida finalizada do histórico.
  let originalParticipantIds
  if (Array.isArray(match.originalIds)) {
    originalParticipantIds = match.originalIds
  } else {
    const historicalIds = new Set(
      sessionMatches
        .filter(m => m.status === 'finished')
        .flatMap(m => [...m.teams.A, ...m.teams.B])
    )
    const allIds = [
      ...(match.teams.A ?? []),
      ...(match.teams.B ?? []),
      ...(match.nextTeams ?? []).flat(),
    ]
    originalParticipantIds = allIds.filter(id => historicalIds.has(id))
  }

  const allIds = [
    ...(match.teams.A ?? []),
    ...(match.teams.B ?? []),
    ...(match.nextTeams ?? []).flat(),
  ]

  return computeRoundsOut(allIds, windowedFinished, originalParticipantIds)
}
