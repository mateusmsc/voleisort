/**
 * Forma times equilibrados a partir de uma lista de jogadores presentes.
 *
 * @param {Player[]} players - jogadores com check-in, ordenados por rating desc
 * @param {number} teamSize - tamanho de cada time (padrão 6)
 * @returns {{ teamA: Player[], teamB: Player[], waiting: Player[] }}
 */
export function formTeams(players, teamSize = 6) {
  // Ordenar do maior para o menor rating
  const sorted = [...players].sort((a, b) => b.rating - a.rating)

  const teamA = []
  const teamB = []
  const playing = sorted.slice(0, teamSize * 2)
  const waiting = sorted.slice(teamSize * 2)

  // Distribuição em cobra: A, B, B, A, A, B, B, A...
  playing.forEach((player, i) => {
    const group = Math.floor(i / 2)
    const isEvenGroup = group % 2 === 0
    const isFirstInPair = i % 2 === 0

    if (isEvenGroup) {
      isFirstInPair ? teamA.push(player) : teamB.push(player)
    } else {
      isFirstInPair ? teamB.push(player) : teamA.push(player)
    }
  })

  return { teamA, teamB, waiting }
}

/**
 * Calcula a média de rating de um time.
 */
export function teamAverage(players) {
  if (players.length === 0) return 0
  return Math.round(players.reduce((sum, p) => sum + p.rating, 0) / players.length)
}

/**
 * Mistura os jogadores de dois times trocando exatamente `swaps` pares.
 *
 * Escolhe aleatoriamente entre os pares de jogadores com rating mais próximo
 * (mais intercambiáveis), garantindo variação a cada clique e mantendo
 * o desequilíbrio gerado pequeno.
 *
 * @param {Player[]} teamA
 * @param {Player[]} teamB
 * @param {number} swaps - número de trocas (padrão 3)
 * @returns {{ teamA: Player[], teamB: Player[] }}
 */
export function shuffleTeams(teamA, teamB, swaps = 3) {
  let a = [...teamA]
  let b = [...teamB]

  // Monta todos os pares possíveis ordenados por proximidade de rating
  const pairs = []
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      if (a[i].id === b[j].id) continue
      pairs.push({ i, j, ratingDiff: Math.abs(a[i].rating - b[j].rating) })
    }
  }
  pairs.sort((x, y) => x.ratingDiff - y.ratingDiff)

  // Pega os N pares mais próximos em rating como pool de candidatos
  const poolSize = Math.min(pairs.length, swaps * 4)
  const pool = pairs.slice(0, poolSize)

  // Sorteia `swaps` pares distintos (sem repetir índices já usados)
  const usedA = new Set()
  const usedB = new Set()
  let done = 0

  // Embaralha o pool para aleatoriedade
  for (let k = pool.length - 1; k > 0; k--) {
    const r = Math.floor(Math.random() * (k + 1));
    [pool[k], pool[r]] = [pool[r], pool[k]]
  }

  for (const { i, j } of pool) {
    if (done >= swaps) break
    if (usedA.has(i) || usedB.has(j)) continue

    // Aplica a troca
    const tmp = a[i]
    a = a.map((p, idx) => idx === i ? b[j] : p)
    b = b.map((p, idx) => idx === j ? tmp : p)

    usedA.add(i)
    usedB.add(j)
    done++
  }

  return { teamA: a, teamB: b }
}
