# 03 — Lógica de Balanceamento

Todos os algoritmos ficam em `src/logic/` como funções puras (sem estado, sem UI). Isso facilita testar e futuramente mover para um backend.

---

## Formação dos times iniciais (`src/logic/balancing.js`)

### Algoritmo "cobra"

Ordena os jogadores por rating e distribui alternando entre os times, criando um S (cobra). Isso garante que nenhum time concentre todos os melhores jogadores.

```
Rating: [90, 80, 70, 65, 60, 55, 50, 45, 40, 35, 30, 25]
                ↓ distribuição cobra (times de 4)
Time A: [90, 65, 60, 25]  → média 60
Time B: [80, 70, 55, 30]  → média 58,7
Espera: [50, 45, 40, 35]
```

```js
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
```

---

## Fila de espera entre partidas (`src/logic/queue.js`)

Após cada partida, os perdedores deixam o campo e se juntam aos jogadores que estavam aguardando para formar o próximo desafiante.

### Regras da fila

1. **Jogadores em espera são priorizados** — quem está há mais partidas fora entra primeiro.
2. **Dentro do mesmo tempo de espera**, prioriza o rating que melhor equilibra o time.
3. **Exceção de urgência** — se um jogador atingiu `maxRoundsOut` partidas sem jogar, ele entra independente do impacto no equilíbrio.

```js
/**
 * Monta o time desafiante após uma partida.
 *
 * @param {Player[]} winners           - time vencedor que permanece
 * @param {Player[]} losers            - perdedores que saem do campo
 * @param {Player[]} waiting           - fila de espera atual
 * @param {number[]} roundsOut         - { [playerId]: rounds sem jogar }
 * @param {object} config              - configurações da sessão
 * @returns {{ challenger: Player[], newWaiting: Player[] }}
 */
export function buildChallenger(winners, losers, waiting, roundsOut, config) {
  const { teamSize, maxRoundsOut, ratingDeltaThreshold } = config

  // Pool disponível = perdedores + quem estava na fila
  const pool = [...losers, ...waiting]

  // Alvo de rating: média do time vencedor
  const winnerAvg = teamAverage(winners)

  const challenger = []
  const remaining = [...pool]

  while (challenger.length < teamSize && remaining.length > 0) {
    const currentAvg = teamAverage(challenger)
    const spotsLeft = teamSize - challenger.length
    // Rating ideal do próximo jogador para atingir a média alvo
    const targetRating = winnerAvg * teamSize - currentAvg * challenger.length

    // Verificar se alguém está há muitas rodadas fora (urgência)
    const urgentPlayers = remaining.filter(
      p => (roundsOut[p.id] ?? 0) >= maxRoundsOut
    )

    let chosen

    if (urgentPlayers.length > 0) {
      // Urgência: pega o mais próximo do rating ideal dentre os urgentes
      chosen = urgentPlayers.reduce((best, p) =>
        Math.abs(p.rating - targetRating) < Math.abs(best.rating - targetRating)
          ? p : best
      )
    } else {
      // Normal: melhor encaixe por rating
      const ideal = remaining.reduce((best, p) =>
        Math.abs(p.rating - targetRating) < Math.abs(best.rating - targetRating)
          ? p : best
      )

      // Verificar se há alguém aguardando que está bem próximo do ideal
      // e que levaria vantagem por tempo de espera
      const waitingCandidates = remaining.filter(p =>
        waiting.includes(p) &&
        Math.abs(p.rating - targetRating) <= ratingDeltaThreshold + 10
      )

      if (waitingCandidates.length > 0) {
        // Prefere quem está na fila há mais tempo (maior roundsOut)
        chosen = waitingCandidates.reduce((best, p) =>
          (roundsOut[p.id] ?? 0) > (roundsOut[best.id] ?? 0) ? p : best
        )
      } else {
        chosen = ideal
      }
    }

    challenger.push(chosen)
    remaining.splice(remaining.indexOf(chosen), 1)
  }

  return {
    challenger,
    newWaiting: remaining,
  }
}

/**
 * Atualiza o contador de rodadas fora de cada jogador.
 * Jogadores que jogaram voltam a zero. Quem ficou fora incrementa.
 *
 * @param {string[]} allCheckedInIds
 * @param {string[]} playingNowIds    - jogadores das duas equipes atuais
 * @param {object} currentRoundsOut   - estado anterior { [id]: number }
 * @returns {object}                  - novo estado { [id]: number }
 */
export function updateRoundsOut(allCheckedInIds, playingNowIds, currentRoundsOut) {
  const updated = {}
  for (const id of allCheckedInIds) {
    if (playingNowIds.includes(id)) {
      updated[id] = 0
    } else {
      updated[id] = (currentRoundsOut[id] ?? 0) + 1
    }
  }
  return updated
}
```

---

## Cálculo de rating pós-partida (`src/logic/rating.js`)

```js
/**
 * Calcula os deltas de rating após uma partida.
 * Leva em conta a diferença de médias entre os times.
 *
 * @param {Player[]} winners
 * @param {Player[]} losers
 * @returns {{ [playerId]: number }} - positivo = ganhou, negativo = perdeu
 */
export function calculateRatingDeltas(winners, losers) {
  const winAvg = teamAverage(winners)
  const loseAvg = teamAverage(losers)
  const diff = winAvg - loseAvg  // positivo = vencedor era favorito

  // Ganho base: +2 se equilibrado, menos se eram favoritos
  // Perda base: -1 se equilibrado, menos se eram azarões
  const baseWin  = 2
  const baseLose = -1

  // Fator de ajuste: times mais fortes ganham menos, perdem mais
  // diff > 0 = vencedor era favorito → ganho reduzido / perda menor
  // diff < 0 = vencedor era azarão  → ganho ampliado / perda maior
  const adjustFactor = Math.max(-0.5, Math.min(0.5, diff / 40))

  const winDelta  = Math.round(baseWin  - adjustFactor)
  const loseDelta = Math.round(baseLose - adjustFactor * 0.5)

  const deltas = {}
  winners.forEach(p => { deltas[p.id] = winDelta })
  losers.forEach(p => { deltas[p.id] = loseDelta })

  return deltas
}

// Importar aqui para evitar dependência circular
function teamAverage(players) {
  if (players.length === 0) return 0
  return players.reduce((sum, p) => sum + p.rating, 0) / players.length
}
```

### Tabela de exemplo dos deltas

| Situação | Vencedor era | Delta vencedores | Delta perdedores |
|---|---|---|---|
| Times iguais (diff ≈ 0) | — | +2 | −1 |
| Vencedor muito mais forte (diff +20) | Favorito | +1 | 0 |
| Vencedor muito mais fraco (diff −20) | Azarão | +3 | −2 |

> Os valores são intencionalmente simples para o MVP. Podem ser substituídos por um sistema ELO completo no futuro sem mudar a interface — basta reescrever `calculateRatingDeltas`.

---

## Utilitário de código de sessão (`src/utils/session-code.js`)

```js
/**
 * Gera um código legível de 6 caracteres para a sessão.
 * Ex: "ABC123", "VOL007"
 */
export function generateCode() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'  // sem I e O (confundem com 1 e 0)
  const digits  = '0123456789'
  const rand = arr => arr[Math.floor(Math.random() * arr.length)]

  return (
    rand(letters) + rand(letters) + rand(letters) +
    rand(digits)  + rand(digits)  + rand(digits)
  )
}

/**
 * Exporta uma sessão + dados dos jogadores como string base64.
 * Usada para gerar o link de compartilhamento.
 */
export function exportSession(session, players) {
  const payload = { session, players, exportedAt: new Date().toISOString() }
  return btoa(JSON.stringify(payload))
}

/**
 * Importa uma sessão a partir de uma string base64.
 */
export function importSession(base64) {
  try {
    return JSON.parse(atob(base64))
  } catch {
    return null
  }
}
```
