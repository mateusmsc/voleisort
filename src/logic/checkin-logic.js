export function insertPlayerIntoQueue(currentNextTeams, playerId, teamSize) {
  if (currentNextTeams.length === 0) {
    return [[playerId]]
  }

  const lastTeam = currentNextTeams[currentNextTeams.length - 1]

  if (lastTeam.length < teamSize) {
    return [
      ...currentNextTeams.slice(0, -1),
      [...lastTeam, playerId],
    ]
  }

  return [...currentNextTeams, [playerId]]
}

export function fillGapsFromNextQueues({ nextTeams, removedIds, roundsOut, teamSize }) {
  const removedSet = new Set(removedIds)

  // Remove jogadores removidos de todas as posições
  const result = nextTeams.map(team => team.filter(id => !removedSet.has(id)))

  // Percorre todos os times (exceto o último) e faz cascata:
  // se um time ficou incompleto, puxa candidatos dos times seguintes
  for (let i = 0; i < result.length - 1; i++) {
    while (result[i].length < teamSize) {
      // Coleta todos os candidatos disponíveis nos times seguintes com suas posições originais
      const pool = []
      for (let j = i + 1; j < result.length; j++) {
        for (const id of result[j]) {
          pool.push({ id, queuePos: j })
        }
      }
      if (pool.length === 0) break

      // Ordena: maior roundsOut primeiro; em empate, menor queuePos (FIFO)
      pool.sort((a, b) => {
        const aOut = roundsOut[a.id] ?? 0
        const bOut = roundsOut[b.id] ?? 0
        if (bOut !== aOut) return bOut - aOut
        return a.queuePos - b.queuePos
      })

      const promoted = pool[0]
      result[i].push(promoted.id)

      // Remove o promovido de onde estava
      for (let j = i + 1; j < result.length; j++) {
        result[j] = result[j].filter(id => id !== promoted.id)
      }
    }
  }

  return result.filter(team => team.length > 0)
}

export function applySubstitutions({ teamA, teamB, nextTeams, removedFromMatch, newcomers, getPlayer }) {
  let newTeamA = [...teamA]
  let newTeamB = [...teamB]
  let newNextTeams = nextTeams.map(team => [...team])

  // Remove todos os jogadores que sairam do check-in de onde estiverem.
  // Nao usa newcomers para substituir -- a cascata e os inserimentos no final
  // sao responsabilidade de applyCheckinWithActiveMatch.
  for (const removedId of removedFromMatch) {
    if (newTeamA.includes(removedId)) {
      newTeamA = newTeamA.filter(id => id !== removedId)
    } else if (newTeamB.includes(removedId)) {
      newTeamB = newTeamB.filter(id => id !== removedId)
    } else {
      newNextTeams = newNextTeams.map(team =>
        team.includes(removedId) ? team.filter(id => id !== removedId) : team
      )
    }
  }

  return { newTeamA, newTeamB, newNextTeams }
}

export function applyCheckinWithActiveMatch({
  teamA,
  teamB,
  nextTeams,
  checkedInSet,
  presentPlayers,
  currentInMatch,
  teamSize,
  getPlayer,
  roundsOut = {},
}) {
  const removedFromMatch = getRemovedFromMatch(currentInMatch, checkedInSet)
  const newcomers = getNewcomers(presentPlayers, currentInMatch)

  if (removedFromMatch.length === 0 && newcomers.length === 0) {
    return { newTeamA: [...teamA], newTeamB: [...teamB], newNextTeams: nextTeams.map(t => [...t]), changed: false }
  }

  let workTeamA = [...teamA]
  let workTeamB = [...teamB]
  let workNextTeams = nextTeams.map(t => [...t])

  if (removedFromMatch.length > 0) {
    // Passo 1: substituir removidos por newcomers (quando existirem)
    const { newTeamA, newTeamB, newNextTeams } = applySubstitutions({
      teamA: workTeamA,
      teamB: workTeamB,
      nextTeams: workNextTeams,
      removedFromMatch,
      newcomers,
      getPlayer,
    })
    workTeamA = newTeamA
    workTeamB = newTeamB
    workNextTeams = newNextTeams

    // Passo 2: se o time A ficou com buraco (sem newcomer disponivel),
    // promover o primeiro da 1a proxima para o time A
    while (workTeamA.length < teamSize && workNextTeams.length > 0 && workNextTeams[0].length > 0) {
      const promoted = workNextTeams[0][0]
      workTeamA = [...workTeamA, promoted]
      workNextTeams = [workNextTeams[0].slice(1), ...workNextTeams.slice(1)]
    }

    // Passo 3: se o time B ficou com buraco, promover da 1a proxima
    while (workTeamB.length < teamSize && workNextTeams.length > 0 && workNextTeams[0].length > 0) {
      const promoted = workNextTeams[0][0]
      workTeamB = [...workTeamB, promoted]
      workNextTeams = [workNextTeams[0].slice(1), ...workNextTeams.slice(1)]
    }

    // Passo 4: limpar proximas vazias e fazer cascata para preencher buracos restantes
    workNextTeams = workNextTeams.filter(t => t.length > 0)
    if (workNextTeams.length > 0) {
      workNextTeams = fillGapsFromNextQueues({
        nextTeams: workNextTeams,
        removedIds: [],   // remocoes ja foram feitas; apenas cascata de preenchimento
        roundsOut,
        teamSize,
      })
    }

    // Passo 5: newcomers que nao foram usados como substitutos vao para o fim da fila
    const remainingNewcomers = newcomers.filter(p => {
      const allNow = [...workTeamA, ...workTeamB, ...workNextTeams.flat()]
      return !allNow.includes(p.id)
    })
    for (const nc of remainingNewcomers) {
      workNextTeams = insertPlayerIntoQueue(workNextTeams, nc.id, teamSize)
    }
  } else {
    // Sem remocoes: apenas inserir newcomers no fim da fila
    for (const nc of newcomers) {
      workNextTeams = insertPlayerIntoQueue(workNextTeams, nc.id, teamSize)
    }
  }

  return { newTeamA: workTeamA, newTeamB: workTeamB, newNextTeams: workNextTeams, changed: true }
}

export function getRemovedFromMatch(currentInMatch, checkedInSet) {
  return currentInMatch.filter(id => !checkedInSet.has(id))
}

export function getNewcomers(presentPlayers, currentInMatch) {
  return presentPlayers.filter(p => !currentInMatch.includes(p.id))
}
