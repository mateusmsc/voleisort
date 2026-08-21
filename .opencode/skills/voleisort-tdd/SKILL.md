---
name: voleisort-tdd
description: Use SEMPRE ao implementar qualquer feature, regra de negocio ou correcao de bug no voleisort. Enforca o TDD obrigatorio do projeto (Red->Green->Refactor), os padroes de teste, as regras com teste obrigatorio e a Definition of Done.
---

# voleisort - TDD obrigatorio

O projeto adota **TDD obrigatorio** conforme `premissas.md`. Nenhuma regra de negocio ou
correcao de bug entra sem teste previo. Seguir este fluxo em **toda** alteracao:

## 1. Ciclo Red -> Green -> Refactor

1. **Red** - escreva o teste que falha e que expressa a regra de negocio. Rode e **confirme
   que falha pelo motivo esperado** (nao por erro de montagem). Para bug: o teste reproduz o defeito.
2. **Green** - implemente o minimo necessario para passar no teste (sem codigo extra).
3. **Refactor** - remova duplicacao/melhore o design **sem mudar comportamento**; rode a suite de novo.

> Se nao houver "momento Red", e teste depois da implementacao - nao e TDD. Nao aceite isso.

## 2. Nivel do teste (piramide)

| Nivel | Onde | Stack |
|-------|------|-------|
| **Unitario** (muitos) | `src/logic/`, `src/utils/` | Vitest |
| **Unitario services** (medios) | `src/services/` | Vitest + mocks do Supabase |
| **Integracao** (medios) | Entre modulos (`logic` + `services` + `store`) | Vitest |

Regra pratica: regra de negocio pura -> **unitario em `tests/unit/logic/`**;
service/acesso a dados -> **unitario em `tests/unit/services/`**;
fluxo completo entre modulos -> **integracao em `tests/integration/`**.

## 3. Estrutura de testes

```
tests/
  unit/
    logic/      # testes de src/logic/ (imports relativos: ../../../src/logic/foo.js)
    services/   # testes de src/services/ (imports via alias @/: @/services/supabase.js)
  integration/  # testes de integracao entre modulos
```

**Convencoes:**
- Imports em `tests/unit/logic/`: relativos (`../../../src/logic/foo.js`)
- Imports em `tests/unit/services/`: alias `@/` (ex: `@/services/supabase.js`)
- O alias `@` aponta para `src/` e esta configurado no `vite.config.js`

## 4. Regras com teste obrigatorio (lista nao exaustiva)

| Modulo | Regra |
|--------|-------|
| Distribuicao de times | `levelSpreadDraft` - espalhamento por nivel |
| Distribuicao de times | `rebalanceHighLevelPlayers` - correcao pos-draft |
| Distribuicao de times | `distributeAllPlayers` - orquestracao completa |
| Balanceamento | `shuffleTeams` - restricao de nivel (nao concentrar 2+ alto nivel) |
| Fila | `advanceQueue` - FIFO, preenchimento por roundsOut |
| Check-in ativo | `applyCheckinWithActiveMatch` - substituicoes, cascata na fila |
| Services | mappers `toDb`/`fromDb` - conversao camelCase <-> snake_case |
| Services | normalizacao de arrays null -> [] |

## 5. Cenarios que DEVEM ter teste

- **Distribuicao inicial**: jogadores de alto nivel espalhados entre grupos
- **Fila FIFO**: primeiro time da fila e sempre o proximo
- **Lacunas na fila**: preenchidas por roundsOut decrescente
- **Shuffle**: nunca concentra 2+ alto nivel num time com 0 no outro
- **Substituicoes**: cada substituto usado no maximo uma vez
- **Troca manual**: sem duplicatas (quem entra sai da origem)
- **Cancelar partida**: zera roundsOut
- **Services**: toDb inclui campos corretos, fromDb normaliza valores null

## 6. O que e obrigatorio nas entregas

- **Testes existentes sao contratos**: nenhuma alteracao de logica pode quebrar um teste ja
  consolidado. Se um teste precisar mudar, justificar explicitamente por que o contrato mudou.
- **Fluxo obrigatorio para bugs**: escrever primeiro o teste que falha (red), depois corrigir
  o codigo ate o teste passar (green).
- **Fluxo obrigatorio para features**: escrever primeiro o teste, depois implementar.

## 7. Comandos de teste

```bash
# Rodar todos os testes
npm test

# Rodar testes em modo watch
npm run test:watch

# Rodar testes de um arquivo especifico
npm test -- tests/unit/logic/queue.test.js

# Rodar testes com padrao no nome
npm test -- -t "levelSpreadDraft"
```

## 8. Definition of Done (DoD)

O trabalho so esta pronto quando:

1. TDD aplicado (teste de Red registrado ou justificado).
2. Suite local verde (`npm test`).
3. Regras de negocio novas cobertas por testes unitarios.
4. Nenhum teste existente quebrado (contratos preservados).
5. Documentacao atualizada se houver mudanca de comportamento.

## 9. Referencias

- `premissas.md` - regras de processo e arquitetura
- `CONTEXTO.md` - visao geral do projeto
- `docs/ROADMAP.md` - roadmap de implementacao
- `.opencode/skills/development-guidelines/SKILL.md` - diretrizes gerais
