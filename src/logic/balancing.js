import { HIGH_LEVEL_THRESHOLD } from '../utils/levels.js'

function isHigh(player, threshold) {
  return (player.level ?? 0) >= threshold
}

// Verifica se trocar a[i] com b[j] concentraria jogadores de alto nível
// num único time (2+ num time, 0 no outro).
function swapViolatesSpread(a, b, i, j, threshold) {
  const aIsHigh = isHigh(a[i], threshold)
  const bIsHigh = isHigh(b[j], threshold)

  // Se nenhum dos dois é de alto nível, a troca nunca viola
  if (!aIsHigh && !bIsHigh) return false

  // Se ambos são de alto nível, trocar um pelo outro não muda os totais
  if (aIsHigh && bIsHigh) return false

  // Um é alto, o outro não: a troca desloca um alto de um time para o outro
  const highA = a.filter(p => isHigh(p, threshold)).length
  const highB = b.filter(p => isHigh(p, threshold)).length

  let newHighA, newHighB
  if (aIsHigh) {
    // a[i] (alto) vai para B; b[j] (não-alto) vai para A
    newHighA = highA - 1
    newHighB = highB + 1
  } else {
    // b[j] (alto) vai para A; a[i] (não-alto) vai para B
    newHighA = highA + 1
    newHighB = highB - 1
  }

  return (newHighA >= 2 && newHighB === 0) || (newHighB >= 2 && newHighA === 0)
}

export function shuffleTeams(teamA, teamB, swaps = 3, threshold = HIGH_LEVEL_THRESHOLD) {
  let a = [...teamA]
  let b = [...teamB]

  const pairs = []
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      if (a[i].id === b[j].id) continue
      pairs.push({ i, j })
    }
  }

  const poolSize = Math.min(pairs.length, swaps * 4)
  const pool = pairs.slice(0, poolSize)

  const usedA = new Set()
  const usedB = new Set()
  let done = 0

  for (let k = pool.length - 1; k > 0; k--) {
    const r = Math.floor(Math.random() * (k + 1));
    [pool[k], pool[r]] = [pool[r], pool[k]]
  }

  for (const { i, j } of pool) {
    if (done >= swaps) break
    if (usedA.has(i) || usedB.has(j)) continue

    // Pula pares que concentrariam alto nível num único time
    if (swapViolatesSpread(a, b, i, j, threshold)) continue

    const tmp = a[i]
    a = a.map((p, idx) => idx === i ? b[j] : p)
    b = b.map((p, idx) => idx === j ? tmp : p)

    usedA.add(i)
    usedB.add(j)
    done++
  }

  return { teamA: a, teamB: b }
}

export function swapPlayers({ groups, pool, idA, fromA, idB, fromB }) {
  const allById = {}
  ;[...groups.flat(), ...pool].forEach(p => { allById[p.id] = p })

  const newGroups = groups.map(g => g.filter(p => p.id !== idA && p.id !== idB))
  let newPool = pool.filter(p => p.id !== idA && p.id !== idB)

  if (fromA !== 'pool' && typeof fromA === 'number') newGroups[fromA].push(allById[idB])
  else newPool = [...newPool, allById[idB]]

  if (fromB !== 'pool' && typeof fromB === 'number') newGroups[fromB].push(allById[idA])
  else newPool = [...newPool, allById[idA]]

  return { groups: newGroups, pool: newPool }
}

/**
 * rebuildNextTeamsAfterFieldSwap(origNexts, poolPlayers) → string[][]
 *
 * Reconstrói os times da fila após uma troca manual entre um time em campo
 * e um jogador das próximas (EditTeamsModal no modo campo).
 *
 * O pool resultante do swapPlayers contém todos os jogadores das próximas
 * (inclusive o jogador do campo que foi trocado), mas a ORDEM pode variar.
 * Este helper preserva a estrutura (qual time é o 1º, 2º, etc.) mantendo
 * os jogadores que não foram alterados em seus times originais e colocando
 * o novo jogador (vindo do campo) exatamente no time que perdeu um slot.
 *
 * Algoritmo:
 *   Para cada time original, verifica quais IDs ainda estão no pool.
 *   Os que estão → ficam no mesmo time.
 *   O slot vazio (jogador que foi para campo) → preenchido pelo jogador novo
 *   que está no pool mas não pertencia a nenhum time original.
 *
 * @param {string[][]} origNexts - IDs originais dos times da fila
 * @param {Array<{id:string}>} poolPlayers - jogadores no pool após o swap
 * @returns {string[][]} - nova estrutura de fila (arrays de IDs)
 */
export function rebuildNextTeamsAfterFieldSwap(origNexts, poolPlayers) {
  const poolIds = new Set(poolPlayers.map(p => p.id))
  const allOrigIds = new Set(origNexts.flat())

  // Jogadores novos no pool que não faziam parte de nenhuma próxima original
  // (são os que vieram do campo via troca)
  const incoming = poolPlayers.map(p => p.id).filter(id => !allOrigIds.has(id))
  const incomingQueue = [...incoming]

  return origNexts.map(origTeam => {
    const kept = origTeam.filter(id => poolIds.has(id))
    const missing = origTeam.length - kept.length
    const fills = incomingQueue.splice(0, missing)
    return [...kept, ...fills]
  })
}
