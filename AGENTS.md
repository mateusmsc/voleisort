# AGENTS.md - Instrucoes para Agentes de IA

## Visao Geral do Projeto

**voleisort** e uma PWA para organizar peladas de volei: registra jogadores, faz check-in no
dia, forma times balanceados por nivel via `levelSpreadDraft` e gerencia uma fila de espera
com criterio de equidade (tempo de fora).

**Stack**: React 18 + Vite 5 + Tailwind CSS 3 + Zustand 5 + Supabase (PostgreSQL) + React Router v7 + Vitest.

## Arquivos de Referencia OBRIGATORIOS

Antes de qualquer implementacao, leia na ordem:

1. `premissas.md` - regras de processo que NUNCA devem ser violadas
2. `CONTEXTO.md` - visao geral do projeto, arquitetura, modelo de dados, fluxos
3. `docs/ROADMAP.md` - se trabalhando numa feature do roadmap

## Regras Criticas

### Nunca Fazer Sem Autorizacao

- Remover codigo, arquivos ou funcionalidades
- Quebrar testes existentes (sao contratos)
- Remover `shuffleTeams` ou funcionalidade de shuffle

### Sempre Fazer

- Ler `premissas.md` antes de implementar
- Seguir TDD: Red -> Green -> Refactor
- Verificar se arquivo ja existe antes de criar novo
- Preservar testes existentes como contratos

## Arquitetura

```
src/
  logic/      # logica pura (sem React, sem stores) - TESTADA
  store/      # estado global Zustand (em memoria, hidratado no boot)
  services/   # acesso ao Supabase (auth, CRUD, bootstrap)
  pages/      # telas da aplicacao (uma pasta por rota)
  components/ # componentes reutilizaveis
  utils/      # utilitarios (session-code, storage, levels)
tests/
  unit/
    logic/    # testes de src/logic/ (imports relativos)
    services/ # testes de src/services/ (imports via alias @/)
  integration/ # testes de integracao entre modulos
```

## Padroes de Codigo

### Testes

- Imports em `tests/unit/logic/`: relativos (`../../../src/logic/foo.js`)
- Imports em `tests/unit/services/`: alias `@/` (ex: `@/services/supabase.js`)
- TDD obrigatorio para bugs e features

### Stores Zustand

- Sem `persist` nos stores de negocio (exceto `useThemeStore`)
- Actions sao `async` com optimistic update
- Nunca `setState` direto em componentes para dados de negocio

### Services

- Mappers `toDb` (camelCase -> snake_case) e `fromDb` (snake_case -> camelCase)
- Arrays `null` do banco normalizados para `[]` no `fromDb`

## Comandos Uteis

```bash
npm test           # rodar todos os testes
npm run test:watch # testes em modo watch
npm run dev        # servidor de desenvolvimento
npm run build      # build de producao
```

## Skills Disponiveis

- `voleisort-tdd` - TDD obrigatorio, ciclo Red/Green/Refactor
- `development-guidelines` - diretrizes gerais de desenvolvimento

## Documentacao Adicional

- `docs/SUMARIO.md` - historico de todas as fases
- `docs/arquivado/database/` - planos concluidos da migracao para Supabase (Fase 2)
- `docs/arquivado/frontend/` - planos concluidos das telas e componentes (Fase 1)
