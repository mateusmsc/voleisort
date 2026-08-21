# Roadmap de Implementação — voleisort

> Atualizar o status de cada passo conforme a implementação avança.
>
> **Legenda:**
> - `[ ]` Pendente
> - `[~]` Em andamento
> - `[x]` Concluído
> - `[!]` Bloqueado (dependência não satisfeita)
>
> Cada passo indica suas **dependências** entre parênteses.

---

## Visão geral das mudanças

| # | Mudança | Status geral |
|---|---|---|
| A | Novo sistema de ranking por nível (1–5) | Concluído |
| B | Distribuição global por nível (levelSpreadDraft) | Concluído |
| C | Balanceamento no shuffle por nível | Concluído |
| D | Remanejamento pós-draft (rebalanceHighLevelPlayers) | Concluído |
| E | Edição de jogador na tela de check-in | Concluído |
| F | Substituir "Cancelar partida" por "Finalizar sessão" | Concluído |

---

## Fase 1 — Infraestrutura de dados (nível do jogador)

> Dependência de todas as outras fases. Deve ser concluída primeiro.

### Passo 1.1
- [x] **[DB]** Criar `migrations/004_player_level.sql`
  - `ALTER TABLE players ADD COLUMN IF NOT EXISTS level numeric DEFAULT 3`
  - Aplicar no Supabase via SQL Editor
  - _Sem dependências_

### Passo 1.2
- [x] **[Service]** Atualizar `src/services/playerService.js`
  - `toDb`: incluir `level: player.level`
  - `fromDb`: incluir `level: row.level ?? 3`
  - `update`: incluir `if (changes.level !== undefined) patch.level = changes.level`
  - `upsertMany`: campo `level` preservado via `toDb`
  - _Depende de: 1.1_

### Passo 1.3
- [x] **[Test]** Escrever testes em `tests/unit/services/playerService.test.js`
  - `create` inclui `level` no objeto enviado ao banco
  - `fromDb` com `level: null` normaliza para `3`
  - `update` patch parcial `{ level: 4.5 }` envia apenas `level`
  - `upsertMany` preserva `level` em cada registro
  - _Depende de: 1.2_

### Passo 1.4
- [x] **[Utils]** Criar `src/utils/levels.js`
  - `export const LEVELS = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]`
  - `export const DEFAULT_LEVEL = 3`
  - `export const HIGH_LEVEL_THRESHOLD = 4`
  - _Sem dependências_

### Passo 1.5
- [x] **[Store]** Atualizar `src/store/usePlayerStore.js`
  - `addPlayer(name, level = DEFAULT_LEVEL)`: incluir `level` no objeto criado
  - _Depende de: 1.1, 1.4_

---

## Fase 2 — Lógica de distribuição por nível (levelSpreadDraft)

> Núcleo do novo balanceamento. Substitui a ordenação por rating no
> `distributeAllPlayers`.

### Passo 2.1
- [x] **[Test]** Escrever testes de `levelSpreadDraft` em `tests/unit/logic/queue.test.js` _(red phase)_
  - 4 jogadores nível 5 + 4 grupos (24 jogadores, teamSize=6) → 1 por grupo
  - 3 jogadores nível 5 + 4 grupos → distribuição 1+1+1+0
  - 2 jogadores nível 5 + 2 grupos (só campo, sem fila) → 1 por time
  - 8 jogadores nível 4 + 4 grupos → 2 por grupo
  - Múltiplos níveis (5 e 4 juntos): cada nível espalhado independentemente
  - Todos nível 3: médias dos times próximas (diferença ≤ 0.5)
  - Menos jogadores que `teamSize*2` (sem fila): espalhamento entre 2 grupos
  - 1 jogador único de um nível: vai para o primeiro grupo (campo)
  - `level undefined/null` tratado como `DEFAULT_LEVEL = 3`
  - Nenhum jogador duplicado entre grupos
  - _Depende de: 1.4_

### Passo 2.2
- [x] **[Logic]** Implementar `levelSpreadDraft` em `src/logic/queue.js`
  - Agrupar jogadores por nível
  - Calcular número de grupos: `ceil(allPlayers.length / teamSize)`, mínimo 2
  - Round-robin por nível (do mais alto ao mais baixo): atribuir cada jogador
    ao grupo com menos representantes daquele nível (desempate: menor índice)
  - Retornar `{ teamA: groups[0], teamB: groups[1], nextTeams: groups.slice(2) }`
  - `level ?? DEFAULT_LEVEL` como fallback em toda a função
  - _Depende de: 1.4_

### Passo 2.3
- [x] **[Logic]** Atualizar `distributeAllPlayers` em `src/logic/queue.js`
  - Substituir `snakeDraft(inField) + buildNextQueue(rest)` por `levelSpreadDraft(allPlayers, teamSize)`
  - Manter interface pública inalterada: retorna `{ teamA, teamB, nextTeams }`
  - _Depende de: 2.2_

### Passo 2.4
- [x] **[Test]** Atualizar testes existentes impactados em `tests/unit/logic/teamsize.test.js`
  - Substituída asserção `'os teamSize*2 com maior rating vao para o campo'`
    por: "jogadores de nível alto não se concentram em um único grupo"
  - Testes de tamanho fixo de grupo atualizados para refletir distribuição por espalhamento
  - Adicionado `level` nos fixtures onde necessário
  - Todos os 195 testes continuam passando
  - _Depende de: 2.3_

---

## Fase 3 — Balanceamento no shuffle

> Garante que `shuffleTeams` não concentre jogadores do mesmo nível
> no mesmo time após a mistura aleatória.

### Passo 3.1
- [x] **[Test]** Escrever testes de espalhamento em `tests/unit/logic/balancing.test.js` _(red phase)_
  - Após 100 shuffles: nunca 2 jogadores nível 5 no mesmo time (quando havia 1 em cada)
  - Todas as trocas inválidas: shuffle retorna times inalterados sem travar
  - Times sem jogadores de alto nível: shuffle funciona normalmente (sem restrição)
  - Desequilíbrio preexistente (2 nível-5 em B, 1 em A): shuffle nunca cria 2+ vs 0
  - _Depende de: 1.4_

### Passo 3.2
- [x] **[Logic]** Atualizar `shuffleTeams` em `src/logic/balancing.js`
  - Antes de executar cada troca: verifica se o resultado concentraria 2+
    jogadores do mesmo nível num time quando outro time não teria nenhum
  - Se violar: pula o par (não conta como swap tentado)
  - Não trava se todos os pares forem inválidos
  - Testes antigos (1–4 de shuffleTeams) continuam passando
  - _Depende de: 1.4_

---

## Fase 4 — Remanejamento pós-draft (rebalanceHighLevelPlayers)

> Corrige concentração de jogadores de alto nível nas próximas após
> `advanceQueue`, que usa FIFO e não garante espalhamento.

### Passo 4.1
- [x] **[Test]** Escrever testes de `rebalanceHighLevelPlayers` em `tests/unit/logic/queue.test.js` _(red phase)_
  - **Promoção ocorre:** A e B com 1 nível-5 cada; 1ª próxima sem alto nível;
    2ª próxima com 1 nível-5 (roundsOut < 2) → troca com menor nível da 1ª
  - **Sem troca — 1ª próxima já tem alto nível:** nenhuma modificação
  - **Sem troca — times em campo sem alto nível:** nenhuma modificação
  - **Restrição roundsOut:** candidato com `roundsOut[id] >= 2` não é movido
  - **Troca melhora equilíbrio:** verificado que troca é aceita quando reduz diff de médias
  - **Menos de 2 próximas na fila:** nenhuma troca possível
  - **Só um time em campo tem alto nível:** nenhuma troca
  - **Fila vazia:** retorna array vazio sem erro
  - **1ª próxima toda de alto nível:** pré-condição não satisfeita, sem troca
  - **Todos os jogadores preservados sem duplicatas após rebalance**
  - _Depende de: 1.4_

### Passo 4.2
- [x] **[Logic]** Implementar `rebalanceHighLevelPlayers` em `src/logic/queue.js`
  - Assinatura: `rebalanceHighLevelPlayers(teamA, teamB, nextTeams, roundsOut, threshold = HIGH_LEVEL_THRESHOLD)`
  - Verifica pré-condições: ambos os times em campo têm `>= 1` jogador com
    `level >= threshold`; 1ª próxima tem `< 1` jogador com `level >= threshold`;
    existe 2ª+ próxima com candidato (level >= threshold, roundsOut < 2)
  - Candidato a promoção: primeiro jogador elegível na 2ª+ próxima
  - Parceiro na 1ª próxima: jogador de menor nível
  - Critério de aceitação (Opção A): diferença de médias não aumenta
  - Retorna `nextTeams` modificado ou inalterado se nenhuma troca válida
  - _Depende de: 1.4_

### Passo 4.3
- [x] **[Logic]** Integrar `rebalanceHighLevelPlayers` em `distributeAllPlayers`
  - Chamada após `levelSpreadDraft`, com `roundsOut = {}`
  - _Depende de: 2.3, 4.2_

---

## Fase 5 — UI: edição de jogador no check-in

> Permite editar nome e nível diretamente na lista de check-in.

### Passo 5.1
- [x] **[UI]** Atualizar `src/pages/Checkin/AddPlayerModal.jsx`
  - Adicionar seletor de nível (array `LEVELS`, default `DEFAULT_LEVEL = 3`)
  - `onConfirm(name, level)` em vez de `onConfirm(name)`
  - _Depende de: 1.4_

### Passo 5.2
- [x] **[UI]** Atualizar `src/pages/Checkin/Checkin.jsx` — `handleAddNewPlayer`
  - Receber `level` do `AddPlayerModal`
  - Chamar `addPlayer(name, level)` com o nível escolhido
  - _Depende de: 1.5, 5.1_

### Passo 5.3
- [x] **[UI]** Criar `src/pages/Checkin/EditPlayerModal.jsx`
  - Props: `player`, `existingNames`, `onConfirm({ name, level })`, `onCancel`
  - Campos: `name` (input texto) e `level` (seletor `LEVELS`)
  - Validação: nome não vazio; nome não duplica outro jogador (excluindo o próprio)
  - _Depende de: 1.4_

### Passo 5.4
- [x] **[UI]** Atualizar `src/components/PlayerRow.jsx`
  - Nova prop `onEdit`
  - Adicionar opção "Editar jogador" no menu dropdown
    (ao lado de "Ver perfil" e "Excluir")
  - _Sem dependências de lógica_

### Passo 5.5
- [x] **[UI]** Atualizar `src/pages/Checkin/Checkin.jsx` — integração de edição
  - Estado: `const [editingPlayer, setEditingPlayer] = useState(null)`
  - Passar `onEdit={(player) => setEditingPlayer(player)}` para `<PlayerRow>`
  - Handler: `handleEditPlayer({ name, level })` → `updatePlayer(id, { name, level })`
  - Renderizar `<EditPlayerModal>` quando `editingPlayer !== null`
  - `existingNames` para o modal: lista de nomes excluindo o próprio jogador editado
  - _Depende de: 5.3, 5.4_

### Passo 5.6
- [x] **[Test]** Escrever testes em `tests/unit/services/playerService.test.js`
  - `update` com `{ name: 'Novo Nome', level: 4 }` envia ambos os campos
  - `update` com `{ level: 2.5 }` envia apenas `level` (patch parcial)
  - _Depende de: 1.2_
  - _Obs: estes testes podem ser escritos junto com o passo 1.3_

---

## Fase 6 — "Finalizar sessão"

> Substitui "Cancelar partida" por um fluxo que encerra a sessão do dia
> e permite reutilizá-la na semana seguinte.

### Passo 6.1
- [x] **[DB]** Criar `migrations/005_session_status.sql`
  - `ALTER TABLE sessions ADD COLUMN IF NOT EXISTS status text DEFAULT 'active'`
  - Aplicar no Supabase via SQL Editor
  - _Sem dependências_

### Passo 6.2
- [x] **[Service]** Atualizar `src/services/sessionService.js`
  - `toDb`: incluir `status: session.status ?? 'active'`
  - `fromDb`: incluir `status: row.status ?? 'active'`
  - `update`: incluir `if (patch.status !== undefined) dbPatch.status = patch.status`
  - Nova função `finishSession(sessionId)`:
    → chama `this.update(sessionId, { status: 'finished' })`
  - _Depende de: 6.1_

### Passo 6.3
- [x] **[Test]** Escrever testes em `tests/unit/services/sessionService.test.js`
  - `finishSession` chama `update` com `{ status: 'finished' }` para o id correto
  - `create` (toDb) inclui `status: 'active'` no objeto enviado ao banco
  - `fromDb` com `status: 'finished'` retorna `status: 'finished'`
  - `fromDb` com `status: null` (sessão legada) retorna `status: 'active'`
  - `update` com `{ status: 'finished' }` envia `{ status: 'finished' }` ao banco
  - `update` sem `status` no patch não inclui `status` no objeto enviado
  - _Depende de: 6.2_

### Passo 6.4
- [x] **[Store]** Atualizar `src/store/useSessionStore.js`
  - `createSession`: adicionar `status: 'active'` no objeto criado
  - Nova action `async finishSession(sessionId)`:
    1. Optimistic update: `sessions[sessionId].status = 'finished'`
    2. `await sessionService.finishSession(sessionId)`
  - _Depende de: 6.2_

### Passo 6.5
- [x] **[UI]** Atualizar `src/pages/Match/Match.jsx`
  - **Removido:**
    - Botão "Cancelar partida (iniciada por engano)" no footer
    - Handler `handleCancel`
    - Modal `mode === 'confirmCancel'` e seu bloco JSX
    - Caso `'confirmCancel'` do estado `mode`
  - **Adicionado:**
    - Botão "Finalizar sessão" no footer: `onClick → setMode('confirmFinishSession')`
    - Handler `handleFinishSession`:
      1. `await cancelMatch(matchId)` (com try/catch para matchId inválido)
      2. `await setCheckedIn(session.id, [])` — limpa check-in para próxima semana
      3. `await finishSession(session.id)` — sessão vai para `'finished'`
      4. `navigate('/')`
    - Modal `mode === 'confirmFinishSession'` com texto adequado
    - Importados `finishSession` e `setCheckedIn` do `useSessionStore`
  - _Depende de: 6.4_

### Passo 6.6
- [x] **[Test]** Criar `tests/integration/finish-session.test.js`
  - Semana 1: distribuição 12 jogadores → 2 times + fila vazia
  - Semana 1: modelo de dados após finishSession (status, checkedInIds, matchIds)
  - Semana 2: 13 jogadores distribuídos sem duplicatas, com fila
  - Semana 2: Olivia distribuída em algum lugar (integridade)
  - Semana 2: Ana e Mariana (nível 5) em times diferentes
  - Semana 2: Bruno e Carla (nível 4) em times diferentes
  - Semana 2: médias próximas (≤ 0.5)
  - Sem rastros da Semana 1: nova partida tem id diferente
  - Histórico preservado: matchIds acumula entre semanas
  - Stats dos veteranos refletem partidas jogadas
  - Sessão finished acessível pelo código
  - Edge case: matchId inválido não gera erro
  - _Depende de: 2.3, 6.4_

---

## Fase 7 — Verificação final

### Passo 7.1
- [ ] **[Verificação]** Executar `vitest run`
  - 0 regressões nos 178 testes originais
  - Todos os novos testes passando
  - _Depende de: todas as fases anteriores_

### Passo 7.2
- [ ] **[Verificação]** Validar cenários manuais
  - Jogador legado (sem `level` no banco): `fromDb` retorna `level: 3`
  - Jogador criado no meio de sessão ativa com nível escolhido: inserido na fila,
    `rebalance` não o move se `roundsOut = 0`
  - Check-out de jogador de alto nível da 1ª próxima com remanejamento válido
  - Shuffle com todos jogadores do mesmo nível: sem restrição, funciona normalmente
  - Sessão VOL001 finalizada → acessível na semana seguinte
  - Times da Semana 2 com espalhamento correto (Ana e Mariana em times diferentes)
  - _Depende de: 7.1_

---

## Tabela de dependências

```
1.1 ──► 1.2 ──► 1.3
         │
1.4 ─────┤──────────────────────► 2.1 ──► 2.2 ──► 2.3 ──► 2.4
         │                                          │
         │                                          └──► 4.3
         │                                                 ▲
         ├──► 3.1 ──► 3.2                                  │
         │                                                  │
         └──► 4.1 ──► 4.2 ─────────────────────────────────┘

1.4 ──► 5.1 ──► 5.2
              │
1.4 ──► 5.3 ─┤
              │
        5.4 ─┘──► 5.5

1.2 ──► 5.6

6.1 ──► 6.2 ──► 6.3
              │
              └──► 6.4 ──► 6.5

2.3 ──► 6.6
6.4 ──► 6.6

7.1 depende de tudo acima
7.2 depende de 7.1
```

---

## Arquivos a criar / modificar (resumo total)

| Arquivo | Ação | Fase |
|---|---|---|
| `migrations/004_player_level.sql` | Criar | 1 |
| `migrations/005_session_status.sql` | Criar | 6 |
| `src/utils/levels.js` | Criar | 1 |
| `src/pages/Checkin/EditPlayerModal.jsx` | Criar | 5 |
| `tests/integration/finish-session.test.js` | Criar | 6 |
| `src/services/playerService.js` | Modificar | 1 |
| `src/store/usePlayerStore.js` | Modificar | 1 |
| `src/logic/queue.js` | Modificar | 2, 4 |
| `src/logic/balancing.js` | Modificar | 3 |
| `src/pages/Checkin/AddPlayerModal.jsx` | Modificar | 5 |
| `src/pages/Checkin/Checkin.jsx` | Modificar | 5 |
| `src/components/PlayerRow.jsx` | Modificar | 5 |
| `src/services/sessionService.js` | Modificar | 6 |
| `src/store/useSessionStore.js` | Modificar | 6 |
| `src/pages/Match/Match.jsx` | Modificar | 6 |
| `tests/unit/logic/queue.test.js` | Modificar | 2, 4 |
| `tests/unit/logic/balancing.test.js` | Modificar | 3 |
| `tests/unit/logic/teamsize.test.js` | Modificar | 2 |
| `tests/unit/services/playerService.test.js` | Modificar | 1, 5 |
| `tests/unit/services/sessionService.test.js` | Modificar | 6 |

**Total: 5 arquivos novos · 15 arquivos existentes modificados · 2 migrations SQL**
