# Retomada de Contexto — voleisort

> Documento de retomada rápida para qualquer dev ou modelo de IA.
> Leia nesta ordem: `premissas.md` → `CONTEXTO.md` → este arquivo.
> Última atualização: 2026-08-21 · Suíte: **259 testes / 14 arquivos, todos passando**.

---

## 1. Snapshot do projeto

- **O que é**: PWA para organizar peladas de vôlei — registro de jogadores, check-in no dia,
  formação de times balanceados por nível (`levelSpreadDraft`) e fila de espera com equidade
  por tempo de fora (`roundsOut`).
- **Stack**: React 18 + Vite 5 + Tailwind CSS 3 + Zustand 5 + Supabase (PostgreSQL) +
  React Router v7 + Vitest + vite-plugin-pwa.
- **Estado geral**: Fases 1–6 do roadmap **concluídas** e commitadas (`57b70e9`).
  Documentação (`AGENTS.md`, `docs/`, skills `.opencode`) ainda **não versionada** no git.

## 2. Onde está cada coisa

| Camada | Local | Regras |
|---|---|---|
| Lógica pura | `src/logic/` | Sem React, sem stores. Testada em `tests/unit/logic/` |
| Estado global | `src/store/` | Zustand sem `persist`; `_hydrate` só via bootstrap; actions async com optimistic update |
| Banco | `src/services/` | Mappers `toDb`/`fromDb`; arrays null → `[]`; JSONB sem conversão |
| UI | `src/pages/`, `src/components/` | Uma pasta por rota; nunca `setState` direto em dados de negócio |
| Utils | `src/utils/` | `levels.js`, `session-code.js` |
| Migrations | `migrations/` | `dev_setup.sql` consolida schema+RLS+004+005; `004_player_level.sql`; `005_session_status.sql` |

### Funções-chave da lógica

- `queue.js`: `levelSpreadDraft`, `distributeAllPlayers` (= draft + rebalance),
  `rebalanceHighLevelPlayers`, `advanceQueue`, `updateRoundsOut`, `snakeDraft` (legado mantido).
- `checkin-logic.js`: `applyCheckinWithActiveMatch`, `insertPlayerIntoQueue`,
  `fillGapsFromNextQueues`, `applySubstitutions`.
- `balancing.js`: `shuffleTeams` (**nunca remover**), `swapPlayers`.
- `rounds-out.js`: `computeRoundsOut`.

### Rotas

`/` Home · `/session/new` SessionSetup · `/session/:code/checkin` Checkin ·
`/session/:code/match/:matchId` Match · `/session/:code/export` ExportSession ·
`/player/:playerId` PlayerProfile · `/dev/supabase` SupabaseCheck.

### Boot

`main.jsx`: `useThemeStore.init()` → `ensureAuth()` → `hydrateStores()` → render.
Falha no boot renderiza mesmo assim com dados vazios.

### Banco de desenvolvimento (Supabase CLI local — substitui a nuvem)

- O dev **não usa mais Supabase na nuvem**. A stack completa roda em Docker via CLI:
  - Subir: `supabase start` · Parar: `supabase stop` · Status/keys: `supabase status -o env`
  - API: `http://127.0.0.1:54321` · DB: porta 54322 · Studio web: `http://127.0.0.1:54323`
- `.env.development` aponta para a stack local com as chaves padrão do Supabase local.
- Auth anônimo habilitado em `supabase/config.toml` (`enable_anonymous_sign_ins = true`).
- Schema + dados de produção aplicados no container `supabase_db_voleisort`:
  `dev_setup.sql` (inclui GRANTs para anon/authenticated) + `seed.sql`.
- ⚠️ **Encoding**: NUNCA aplicar SQL via pipe do PowerShell (`Get-Content | docker exec -i`) —
  o PS 5.1 re-encoda UTF-8 para o codepage local e corrige acentos (`Vinícius` → `Vin??cius`).
  Método seguro:
  ```powershell
  docker cp backups/prod-snapshot/seed.sql supabase_db_voleisort:/tmp/seed.sql
  docker exec supabase_db_voleisort psql -U postgres -d postgres -f /tmp/seed.sql
  ```
- Resetar banco do zero: `supabase db reset` e reaplicar os dois SQLs acima.

### Snapshot de dados de produção (local)

- `node scripts/export-prod-data.mjs` exporta as 3 tabelas do Supabase de produção
  para `backups/prod-snapshot/` (JSON exato + `seed.sql` com INSERTs idempotentes).
- Requer `SUPABASE_ACCESS_TOKEN` no ambiente.
- `backups/` está no `.gitignore` — contém nomes reais de jogadores, não versionar.
- Para restaurar num banco dev futuro: aplicar `dev_setup.sql` e depois rodar `seed.sql`.

## 3. Cobertura de testes (real, 2026-08-21)

**Total: 243 testes passando em 12 arquivos.**

| Arquivo | Testes |
|---|---|
| `tests/unit/logic/teamsize.test.js` | 65 |
| `tests/unit/logic/queue.test.js` | 42 |
| `tests/unit/logic/checkin-logic.test.js` | 31 |
| `tests/unit/logic/edit-teams.test.js` | 15 |
| `tests/unit/services/sessionService.test.js` | 23 |
| `tests/unit/services/playerService.test.js` | 15 |
| `tests/unit/services/matchService.test.js` | 13 |
| `tests/integration/finish-session.test.js` | 12 |
| `tests/unit/logic/balancing.test.js` | 8 |
| `tests/unit/logic/rounds-out.test.js` | 8 |
| `tests/unit/logic/display-name.test.js` | 4 |
| `tests/integration/checkin-integration.test.js` | 4 |

Comando: `npm test` (run) · `npm run test:watch` · `npm run lint` · `npm run build`.

> Nota: contagens em `CONTEXTO.md` (227) e `SUMARIO.md` (178) estão desatualizadas.
> Este arquivo é a referência vigente.

## 4. Pendências de desenvolvimento (decidir: faz ou não faz?)

Nenhum TODO/FIXME no código. Todas as pendências estão listadas abaixo, priorizadas,
para decisão explícita antes de desenvolver.

### 🔴 Alta — segurança e infraestrutura

| # | Pendência | Origem | Esforço estimado | Decisão |
|---|---|---|---|---|
| P1 | **Fase 2 de segurança**: coluna `owner_id` nas tabelas + RLS por dono (isolamento por device). Hoje o auth é anônimo e qualquer cliente autenticado enxerga os dados conforme policies atuais. | CONTEXTO.md "Próximos passos" | Médio (migration + services + testes) | `[ ] decidir` |
| ~~P2~~ | ✅ **Confirmado em 2026-08-21**: produção (`wcoqwgogjzjiyivlsopn`) tem `players.level` e `sessions.status` aplicadas. ⚠️ Porém o projeto de **dev** (`mmdwggvyalmoqmrbhfqo`) está inacessível — DNS não resolve (projeto deletado ou pausado no Supabase). Se precisar de banco dev, restaurar/criar projeto e atualizar `.env.development`. | Verificação via REST API | — | `[x] concluída` |

### 🟡 Média — qualidade e verificação

| # | Pendência | Origem | Esforço estimado | Decisão |
|---|---|---|---|---|
| P3 | **Fase 7 do roadmap nunca foi formalmente fechada**: rodar verificação final (7.1 já implicitamente satisfeita — suíte verde) e validar cenários manuais do passo 7.2 (jogador legado sem `level`, check-in tardio, shuffle mesmo nível, sessão finalizada reaberta na semana seguinte). Depois marcar `[x]` no ROADMAP. | ROADMAP.md:299–317 | Baixo | `[ ] decidir` |
| P4 | **Hook `useSessionData(code)`** para hydration lazy por sessão (performance — hoje o boot carrega tudo). | CONTEXTO.md "Próximos passos" | Médio | `[ ] decidir` |
| ~~P5~~ | ✅ **Concluída em 2026-08-21** (autorização do usuário). Excluídos: `src/logic/checkin-logic.test.js.bak`, `docs/arquivado/frontend/06-tela-partida (1).md`, `src/utils/storage.js` (sem imports). Suíte verde após exclusão: 235/235. | Varredura 2026-08-21 | — | `[x] concluída` |
| P6 | **Atualizar docs desatualizadas**: contagens de teste no SUMARIO/CONTEXTO; SUMARIO cita migrations `001`/`002` que foram consolidadas no `dev_setup.sql`; caminhos antigos de testes (`src/logic/*.test.js`). | Varredura 2026-08-21 | Baixo | `[ ] decidir` |

### 🟦 Feature planejada — Painel Público

| # | Pendência | Origem | Esforço estimado | Decisão |
|---|---|---|---|---|
| P9 | **Painel público `/panel/:hash`**: plano detalhado em `docs/PAINEL-PUBLICO.md`. Hash gerado na criação da sessão; mostra times em campo (ativa) ou ranking final (finished). Readonly, link compartilhável em Match/Checkin. | Feature solicitada 2026-08-21 | Médio | `[ ] implementar` |

### 🟢 Baixa — evolução futura

| # | Pendência | Origem | Esforço estimado | Decisão |
|---|---|---|---|---|
| ~~P7~~ | ❌ **Fechada sem implementação (2026-08-21)** — múltiplos usuários na mesma sessão (`session_members`) não será feito por ora. | Decisão do usuário | — | `[x] fechada` |
| P8 | **Versionar a documentação**: `AGENTS.md`, `docs/`, `.opencode/skills/` e este arquivo estão untracked no git. Commitar para não perder o contexto. | git status | Trivial | `[ ] decidir` |

### Dívida técnica conhecida (aceita, não urgente)

- `snakeDraft` é legado mantido deliberadamente (regra: nunca remover sem diretiva
  explícita). `storage.js` foi removido em 2026-08-21 (P5) por não ter nenhum import.
- `display-name.test.js` testa função definida inline (teste documental do "BUG6"),
  não cobre código de produção.
- Docs arquivadas em `docs/arquivado/` descrevem o modelo antigo (rating 50–100,
  snakeDraft, cancelar partida) — válidas apenas como histórico.

## 5. Checklist de retomada para agentes/devs

1. Ler `premissas.md` (regras invioláveis) e `CONTEXTO.md` (arquitetura detalhada).
2. Consultar a tabela de pendências acima (seção 4) — nada além disso está pendente.
3. TDD obrigatório: Red → Green → Refactor (skill `voleisort-tdd`).
4. Rodar `npm test` antes de encerrar qualquer tarefa — os 235 testes são contratos.
5. Ao concluir uma pendência desta lista, atualizar a coluna "Decisão"/status aqui
   e no `docs/ROADMAP.md` quando aplicável.
