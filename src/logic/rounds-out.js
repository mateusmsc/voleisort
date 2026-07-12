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
