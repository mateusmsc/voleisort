# Database — Visão Geral

## Contexto

O app migrou de `localStorage` (Zustand `persist`) para Supabase (PostgreSQL).
A lógica de negócio permanece 100% no frontend — o banco é apenas camada de
persistência. Nenhuma stored procedure ou trigger é necessária nesta fase.

---

## Hospedagem

| Camada      | Serviço          | Observação                              |
|-------------|------------------|-----------------------------------------|
| Frontend    | Vercel (static)  | `npm run build` → deploy automático     |
| Banco       | Supabase         | PostgreSQL gerenciado, integrado Vercel |
| Auth        | Supabase Auth    | Anônimo por device (fase 1)             |

---

## Tabelas

### `players`

Jogadores cadastrados globalmente. Não são vinculados a uma sessão — existem
independentemente e podem participar de múltiplas sessões.

| Coluna       | Tipo        | Notas                            |
|--------------|-------------|----------------------------------|
| `id`         | `uuid`      | PK, gerado no cliente (uuid v4)  |
| `name`       | `text`      | Nome do jogador                  |
| `created_at` | `timestamptz` | ISO timestamp de criação       |
| `stats`      | `jsonb`     | `{ matches, wins, losses }`      |

---

### `sessions`

Cada "pelada" é uma sessão. Identificada por um código legível (ex: `ABC123`).

| Coluna            | Tipo          | Notas                                      |
|-------------------|---------------|--------------------------------------------|
| `id`              | `uuid`        | PK                                         |
| `code`            | `text`        | Único, 6 chars (ex: `ABC123`)              |
| `name`            | `text`        | Nome da sessão (ex: "Vôlei da Sexta")      |
| `created_at`      | `timestamptz` |                                            |
| `config`          | `jsonb`       | `{ teamSize, maxRoundsOut, ... }`          |
| `player_ids`      | `uuid[]`      | Jogadores já participantes desta sessão    |
| `checked_in_ids`  | `uuid[]`      | Presentes no último check-in               |
| `match_ids`       | `uuid[]`      | IDs das partidas em ordem cronológica      |

---

### `matches`

Uma partida dentro de uma sessão.

| Coluna                 | Tipo          | Notas                                        |
|------------------------|---------------|----------------------------------------------|
| `id`                   | `uuid`        | PK                                           |
| `session_id`           | `uuid`        | FK → `sessions.id`                           |
| `round`                | `integer`     | Número da rodada (1-indexado)                |
| `status`               | `text`        | `ongoing` \| `finished` \| `cancelled`      |
| `teams`                | `jsonb`       | `{ A: uuid[], B: uuid[] }`                   |
| `next_teams`           | `jsonb`       | `uuid[][]` — fila de próximos times          |
| `winner`               | `text`        | `'A'` \| `'B'` \| `null`                    |
| `started_at`           | `timestamptz` |                                              |
| `finished_at`          | `timestamptz` | `null` enquanto ongoing                      |
| `rounds_out_reset_at`  | `integer`     | Round a partir do qual reiniciar contagem    |

---

## Decisões de design

### Por que JSONB para `teams`, `next_teams`, `config` e `stats`?

Os dados são arrays de IDs e objetos de configuração simples, sem necessidade
de queries relacionais sobre eles. Usar JSONB evita tabelas de junção desnecessárias
nesta fase e mantém o schema próximo do modelo que já existe no frontend.

Caso surja necessidade de queries analíticas (ex: "quais jogadores jogaram mais
partidas juntos"), a normalização pode ser feita em uma migration futura sem
quebrar a interface do frontend.

### Por que `uuid[]` para `player_ids`, `checked_in_ids` e `match_ids`?

Preservam a ordem de inserção (importante para `match_ids` que é cronológico)
e são simples de manipular via SQL array functions (`array_append`, `@>`, etc.)
quando necessário.

### IDs gerados no cliente

O frontend continua gerando UUIDs v4 antes de persistir. Isso evita round-trips
para obter IDs e simplifica a lógica de criação otimista.

---

## Segurança — RLS (Row Level Security)

RLS está habilitado em todas as tabelas. A política inicial usa **auth anônimo**:
cada device recebe um `user_id` único via `supabase.auth.signInAnonymously()`.

Políticas planejadas (fase 1 — sem multiusuário por sessão):

| Tabela     | SELECT                        | INSERT / UPDATE / DELETE        |
|------------|-------------------------------|---------------------------------|
| `players`  | `auth.uid() IS NOT NULL`      | `auth.uid() IS NOT NULL`        |
| `sessions` | `auth.uid() IS NOT NULL`      | dono da sessão (`owner_id`)     |
| `matches`  | via `session_id` do dono      | dono da sessão                  |

> Fase 2 (multiusuário): adicionar coluna `owner_id uuid` em `sessions` e
> política de convidados via `session.code`.

---

## Migrations

As migrations ficam em `migrations/` na raiz do projeto, numeradas sequencialmente.
Cada arquivo é idempotente (usa `IF NOT EXISTS` / `OR REPLACE`) e pode ser
executado no SQL Editor do Supabase ou via Supabase CLI.

| Arquivo                              | Conteúdo                              |
|--------------------------------------|---------------------------------------|
| `001_initial_schema.sql`             | Criação das 3 tabelas + índices       |
| `002_rls_policies.sql`               | Habilita RLS + políticas de acesso    |

---

## Fluxo de dados (após migração)

```
Browser
  │
  ├── src/services/supabase.js     ← cliente singleton
  ├── src/services/playerService.js
  ├── src/services/sessionService.js
  └── src/services/matchService.js
        │
        └── Supabase REST API (PostgREST)
              │
              └── PostgreSQL (tabelas acima)
```

Os stores Zustand deixam de usar `persist` middleware e passam a:
1. Chamar o service correspondente (async)
2. Atualizar o estado em memória após confirmação
