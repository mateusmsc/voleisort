# Plano de Implementação — Painel Público de Sessão

> **Feature**: URL pública `/panel/:hash` para visualização readonly de uma sessão.
> Status: `[ ] Pendente` — pronto para implementação.

---

## Visão geral

| Aspecto | Decisão |
|---|---|
| **Quando existe** | Hash gerado automaticamente na criação da sessão |
| **URL** | `/panel/:hash` (hash curto tipo código de sessão) |
| **Conteúdo Sessão Ativa** | Times em campo + fila de próximos (readonly, sem ações e sem níveis) |
| **Conteúdo Sessão Finalizada** | Total de partidas + ranking de jogadores por % vitórias (com V/D detalhes) |
| **Acesso** | Público via link; não requer app instalado |
| **Compartilhamento** | Botões em Match e Checkin |
| **Atualização** | Carrega ao abrir/recarregar (sem polling) |

### Ranking Final (sessão finalizada)

- Ordenado por % de vitórias (desc)
- Mínimo 1 partida jogada para aparecer
- Colunas: nome, partidas, vitórias, derrotas, % vitórias
- Fonte: matches da sessão com `status === 'finished'`

---

## Arquitetura

```
[Visita /panel/:hash]
    → main.jsx: ensureAuth → hydrateStores (carrega tudo)
    → Panel.jsx: busca sessão por panelHash nos stores
    → Se ativa: mostra times do match atual
    → Se finalizada: calcula stats via sessionStats(matches, players)
```

### Novos arquivos

| Camada | Arquivo | Função |
|---|---|---|
| DB | `migrations/006_session_panel_hash.sql` | Coluna `panel_hash text UNIQUE` em sessions |
| Logic | `src/logic/session-stats.js` | `computeSessionStats(matches, players)` → ranking |
| Page | `src/pages/Panel/Panel.jsx` | UI readonly do painel |
| Test | `tests/unit/logic/session-stats.test.js` | TDD da lógica de ranking |

### Modificações

| Arquivo | Mudança |
|---|---|
| `src/utils/session-code.js` | Exportar `generateCode` para reuso (hash = código estilo) |
| `src/services/sessionService.js` | `toDb`/`fromDb` incluem `panelHash`; `getByPanelHash(hash)` |
| `src/store/useSessionStore.js` | `createSession`: gera `panelHash` com `generateCode()` |
| `src/pages/Match/Match.jsx` | Botão "Painel público" (copiar link) |
| `src/pages/Checkin/Checkin.jsx` | Botão "Painel público" (copiar link) |
| `src/App.jsx` | Rota `/panel/:hash` → Panel |
| `migrations/dev_setup.sql` | Adicionar seção 006 para coluna panel_hash |
| `tests/unit/services/sessionService.test.js` | Testes de `panelHash` e `getByPanelHash` |

---

## Fases de Implementação

### Fase 1 — Infraestrutura de dados

#### Passo 1.1
- [x] **[DB]** Criar `migrations/006_session_panel_hash.sql`
  - `ALTER TABLE sessions ADD COLUMN IF NOT EXISTS panel_hash text`
  - `CREATE UNIQUE INDEX sessions_panel_hash_unique ON sessions (panel_hash)`
  - Atualizar `migrations/dev_setup.sql` com seção **006**
  - ✅ Aplicado no Supabase de PROD (`wcoqwgogjzjiyivlsopn`) em 2026-08-21 via Management API — coluna e índice verificados
  - _Sem dependências_

#### Passo 1.2
- [x] **[Service]** Atualizar `src/services/sessionService.js`
  - `toDb`: incluir `panel_hash: session.panelHash`
  - `fromDb`: incluir `panelHash: row.panel_hash ?? null`
  - `update`: incluir `if (patch.panelHash !== undefined) dbPatch.panel_hash = patch.panelHash`
  - Nova função `getByPanelHash(hash)` → retorna sessão ou null
  - ✅ Concluído em 2026-08-21
  - _Depende de: 1.1_

#### Passo 1.3
- [x] **[Test]** Atualizar `tests/unit/services/sessionService.test.js`
  - `create` inclui `panelHash` no objeto enviado
  - `fromDb` com `panel_hash: null` retorna `panelHash: null`
  - `getByPanelHash` retorna sessão correta
  - `getByPanelHash` retorna null se não encontrar
  - ✅ Concluído em 2026-08-21 (TDD Red→Green; contrato do `fromDb` atualizado para incluir `panelHash` — modelo de dados mudou)
  - _Depende de: 1.2_

#### Passo 1.4
- [x] **[Utils]** Atualizar `src/utils/session-code.js`
  - ✅ Verificado em 2026-08-21: `generateCode` **já é named export** — nada a fazer. Reuso direto.
  - _Sem dependências_

#### Passo 1.5
- [x] **[Store]** Atualizar `src/store/useSessionStore.js`
  - `createSession`: gerar `panelHash = generateCode()` antes de salvar
  - Incluir `panelHash` no objeto session criado
  - ✅ Concluído em 2026-08-21 (TDD Red→Green; testes em `tests/unit/stores/useSessionStore.test.js` — nova pasta `stores` para testes de store)
  - _Depende de: 1.4_

---

### Fase 2 — Lógica de ranking

#### Passo 2.1
- [x] **[Test]** Criar `tests/unit/logic/session-stats.test.js` _(Red phase)_ ✅ 2026-08-21 — 13 testes
  - _Depende de: 0 (novo arquivo)_

#### Passo 2.2
- [x] **[Logic]** Criar `src/logic/session-stats.js` ✅ 2026-08-21 (TDD Red→Green)
  - `computeSessionStats(matches, players)`
  - Filtra apenas matches `finished`; vencedores por `match.winner`
  - Retorna `{ totalMatches, ranking: [{ id, name, played, wins, losses, winPct }] }`
  - Ordena por `winPct desc`, desempate `played desc`
  - `winPct` arredondado para 1 casa decimal (escala 0–100)
  - Jogador removido da lista mas presente em partidas mantém stats (`name: null`)
  - _Depende de: 2.1_

---

### Fase 3 — UI do Painel

#### Passo 3.1
- [x] **[UI]** Criar `src/pages/Panel/Panel.jsx` ✅ 2026-08-21
  - Busca sessão por `panelHash`; não encontrada → "Sessão não encontrada"
  - Sessão ativa: reutiliza `FieldTeams` (sem handlers = readonly, sem níveis) + `WaitingQueue`
  - Sem match em andamento → "Sessão em andamento — nenhuma partida em quadra"
  - Sessão finalizada: total de partidas + jogadores + ranking via `computeSessionStats`
  - Suporte a dark mode (padrão `dark:` do projeto)
  - _Nota: sem teste automatizado — projeto não tem infra de UI testing; validação manual na Fase 5_
  - _Depende de: 2.2_

#### Passo 3.2
- [x] **[UI]** Atualizar `src/App.jsx` ✅ 2026-08-21
  - Rota `/panel/:hash` → Panel
  - _Depende de: 3.1_

---

### Fase 4 — Compartilhamento

#### Passo 4.1
- [x] **[UI]** Atualizar `src/pages/Match/Match.jsx` ✅ 2026-08-21
  - Botão "📺 Painel público" no footer (ao lado de "Finalizar sessão"), via componente compartilhado
  - Oculto se `!session.panelHash` (sessões legadas)
  - _Depende de: 1.5_

#### Passo 4.2
- [x] **[UI]** Atualizar `src/pages/Checkin/Checkin.jsx` ✅ 2026-08-21
  - Mesmo botão no rodapé da lista de jogadores
  - _Depende de: 1.5_

**Nota:** lógica de copiar link centralizada em `src/components/PanelShareButton.jsx` (novo), evitando duplicação entre as telas.

---

### Fase 5 — Verificação

#### Passo 5.1
- [ ] **[Verificação]** Executar `npm test`
  - 0 regressões + novos testes passando
  - _Depende de: todas as fases anteriores_

#### Passo 5.2
- [ ] **[Verificação]** Validar manualmente
  - Criar sessão nova → verificar `panelHash` gerado
  - Acessar `/panel/:hash` → times em campo aparecem (sessão ativa)
  - Finalizar sessão → painel mostra ranking correto
  - Sessão legada (sem `panelHash`) → botão oculto
  - Copiar link e abrir em outro dispositivo/navegador
  - _Depende de: 5.1_

---

## Tabela de dependências

```
1.1 ──► 1.2 ──► 1.3
              │
1.4 ──► 1.5 ─┘──► 4.1
               └──► 4.2

2.1 ──► 2.2 ──► 3.1 ──► 3.2

5.1 depende de tudo acima
5.2 depende de 5.1
```

---

## Arquivos resumo

| Arquivo | Ação |
|---|---|
| `migrations/006_session_panel_hash.sql` | Criar |
| `src/logic/session-stats.js` | Criar |
| `src/pages/Panel/Panel.jsx` | Criar |
| `tests/unit/logic/session-stats.test.js` | Criar |
| `migrations/dev_setup.sql` | Modificar (adicionar seção 006) |
| `src/utils/session-code.js` | Modificar |
| `src/services/sessionService.js` | Modificar |
| `src/store/useSessionStore.js` | Modificar |
| `src/pages/Match/Match.jsx` | Modificar |
| `src/pages/Checkin/Checkin.jsx` | Modificar |
| `src/App.jsx` | Modificar |
| `tests/unit/services/sessionService.test.js` | Modificar |

**Total: 4 arquivos novos · 8 arquivos existentes modificados · 1 migration SQL**

---

## Edge cases e decisões

1. **Sessões legadas**: `ensurePanelHash(sessionId)` gera e persiste o hash na primeira
   visita ao Checkin/Match (TDD em `useSessionStore.test.js`).
2. **Colisão de hash**: índice UNIQUE no banco impede; probabilidade trivial (36^6).
3. **Ranking vazio**: sessão finalizada sem partidas → mostra "Nenhuma partida registrada".
4. **Match sem ganhador** (cancelled): ignorado no cálculo.
5. **Jogador removido da sessão**: se participou de partidas, seus stats ainda contam.
6. **Sessão semanal (2026-08-21, revisado)**: a sessão é reutilizada entre semanas.
   - `resumeSession` (ao formar times numa sessão finalizada) faz o "início do dia":
     status → `active`, **rotaciona `panelHash`** (um link novo por dia) e grava
     `stats_reset_at` = agora (início da janela de estatísticas).
   - `finishSession` apenas marca `finished` — não toca em `stats_reset_at`.
   - Painel finished mostra **apenas partidas com started_at > stats_reset_at**
     (o dia recém-encerrado), não o histórico acumulado.
