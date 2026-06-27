export function formTeams(players, teamSize = 6) {
  const sorted = [...players].sort((a, b) => b.rating - a.rating)

  const teamA = []
  const teamB = []
  const playing = sorted.slice(0, teamSize * 2)
  const waiting = sorted.slice(teamSize * 2)

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

export function teamAverage(players) {
  if (players.length === 0) return 0
  return Math.round(players.reduce((sum, p) => sum + p.rating, 0) / players.length)
}

export function shuffleTeams(teamA, teamB, swaps = 3) {
  let a = [...teamA]
  let b = [...teamB]

  const pairs = []
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      if (a[i].id === b[j].id) continue
      pairs.push({ i, j, ratingDiff: Math.abs(a[i].rating - b[j].rating) })
    }
  }
  pairs.sort((x, y) => x.ratingDiff - y.ratingDiff)

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
