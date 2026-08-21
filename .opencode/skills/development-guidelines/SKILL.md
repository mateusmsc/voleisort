---
name: development-guidelines
description: Use SEMPRE para qualquer codigo, teste, configuracao, refatoracao, correcao de bug, otimizacao, feature ou implementacao no voleisort. Enforca engenharia simples, legivel, testavel, segura, manutenivel e consistente com a arquitetura atraves de inspecao de contexto, reutilizacao, TDD, validacao e documentacao.
---

# Development Guidelines

Esta skill e uma diretiva transversal de engenharia. Deve ser seguida **sempre** que a
solicitacao alterar codigo, testes, configuracao executavel, build ou automacao do
voleisort, incluindo pedidos como:

- implementar a proxima tarefa ou fase;
- implementar, adicionar, alterar, melhorar ou otimizar uma funcionalidade;
- corrigir um bug;
- refatorar codigo;
- alterar frontend, banco, services ou dependencias.

Ela nao substitui requisitos ou arquitetura do projeto. Esses documentos definem o **que**
o sistema deve fazer; esta skill define **como** uma alteracao deve ser executada com qualidade.

## 1. Hierarquia e Contexto

Antes de editar qualquer arquivo de codigo:

1. **OBRIGATORIO**: Leia `premissas.md` - contem regras de processo que nunca devem ser violadas.
2. Consulte `CONTEXTO.md` - visao geral do projeto, arquitetura, modelo de dados, fluxos.
3. Consulte `docs/ROADMAP.md` se estiver trabalhando numa feature do roadmap.
4. Inspecione o codigo, testes e estrutura existentes antes de propor nomes, camadas ou abstrações.
5. Procure mudancas pendentes no workspace. Nao reverta nem sobrescreva alteracoes do usuario.

Se houver conflito entre a solicitacao e uma regra de `premissas.md`, nao escolha silenciosamente.
Explique o conflito e faca a menor pergunta necessaria.

## 2. Arquitetura do Projeto

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

**Regras de arquitetura:**
- Logica pura (sem React, sem stores) vive em `src/logic/`.
- Componentes de UI em `src/components/` e `src/pages/`.
- Estado global em `src/store/` via Zustand (em memoria, sem `persist`, hidratado no boot via Supabase).
  - Excecao: `useThemeStore` usa `persist` no localStorage (preferencia visual).
- Acesso ao banco em `src/services/` - cada entidade tem seu service.
- Imports nos testes de logica: relativos (`../../../src/logic/foo.js`).
- Imports nos testes de services: alias `@/` (ex: `@/services/supabase.js`).

## 3. Reutilizacao Antes de Criacao

Antes de criar um arquivo novo, verificar se ja existe um adequado para receber o codigo.

Pesquise por:
- funcoes e logica equivalentes em `src/logic/`;
- componentes existentes em `src/components/`;
- utilitarios em `src/utils/`;
- testes que ja expressem o comportamento desejado;
- mappers e services existentes em `src/services/`.

Reutilize uma solucao existente quando ela for adequada e legivel.

## 4. Principios de Engenharia

Aplique Clean Code, SOLID, DRY, KISS, YAGNI de forma pragmatica:

- **KISS**: prefira a menor solucao correta que seja clara.
- **YAGNI**: nao implemente extensoes para um futuro hipotetico.
- **DRY**: elimine conhecimento duplicado; repeticao pequena pode ser melhor que abstracao prematura.
- **Clean Code**: use nomes que expressem intencao, fluxo simples, funcoes coesas.

Nao crie camadas, factories, facades ou interfaces sem uma necessidade observavel.

## 5. TDD e Testes

Para regras de negocio e funcionalidades relevantes, siga obrigatoriamente:

```text
RED
  Escreva o teste do comportamento desejado.
  Execute e confirme que falha pelo motivo esperado.
GREEN
  Implemente somente o necessario para passar.
  Execute o teste e a suite afetada.
REFACTOR
  Simplifique, remova duplicacao e melhore nomes sem alterar comportamento.
  Execute novamente os testes e validacoes.
```

O momento **Red** nao pode ser omitido. Um teste que apenas passa depois da implementacao e
teste posterior, nao TDD.

**Regra critica de `premissas.md`:**
> Testes existentes sao contratos. Nenhuma alteracao de logica pode quebrar um teste ja
> consolidado. Se um teste precisar mudar, justificar explicitamente por que o contrato mudou.

Para o voleisort, siga tambem a skill `voleisort-tdd`.

## 6. Padrao de Stores (Supabase)

- **Sem `persist` nos stores de negocio**. Os dados vem do Supabase no boot via `_hydrate`.
- **Actions sao `async`**: primeiro atualizam o estado em memoria (optimistic update),
  depois chamam o service correspondente.
- **Nunca chamar `setState` direto em componentes** para alterar dados de negocio -
  sempre usar as actions dos stores.
- `_hydrate(data)` e chamado exclusivamente pelo bootstrap; nunca invocar manualmente.
- IDs sao gerados no cliente com `uuid()` antes da chamada ao banco.

## 7. Camada de Services

- Cada service usa mappers `toDb` (camelCase -> snake_case) e `fromDb` (snake_case -> camelCase).
- Campos JSONB no banco (`stats`, `config`, `teams`, `next_teams`): passados sem conversao de chaves.
- Arrays que podem ser `null` no banco sao normalizados para `[]` no `fromDb`.

## 8. Procedimento de Implementacao

Execute o trabalho nesta ordem:

1. **Entender**: leia `premissas.md` e `CONTEXTO.md`, delimite arquivos afetados.
2. **Planejar**: escolha a menor mudanca que atende ao requisito e liste os testes necessarios.
3. **Red**: crie e execute os testes aplicaveis, confirmando a falha esperada.
4. **Green**: implemente a solucao minima, reutilizando padroes existentes.
5. **Refactor**: simplifique sem expandir escopo nem alterar o comportamento.
6. **Validar**: execute `npm test` e confirme suite verde.
7. **Revisar**: procure regressoes, dependencias desnecessarias, arquivos gerados indevidos.
8. **Reportar**: informe arquivos alterados, decisoes relevantes, testes executados.

Nao declare a tarefa concluida apenas porque o codigo compila. O comportamento precisa
estar validado por testes.

## 9. Regras Criticas (de `premissas.md`)

- **Nunca remover codigo, arquivos ou funcionalidades sem diretiva explicita**.
  Se algo parece desnecessario, perguntar antes de agir.
- **`shuffleTeams` nunca pode ser removido** - faz parte do contrato de UX.
- **Testes existentes sao contratos** - nao quebrar sem justificativa explicita.

## 10. Definition of Done

Uma alteracao so esta pronta quando:

1. `premissas.md` foi lido e respeitado.
2. TDD foi aplicado (teste Red registrado ou justificado).
3. Suite local verde (`npm test`).
4. Testes existentes preservados (contratos intactos).
5. Nenhum codigo/funcionalidade removido sem permissao explicita.
6. Arquitetura respeitada (logica em `src/logic/`, stores em `src/store/`, etc).

## Referencias

- `premissas.md` - regras de processo e arquitetura
- `CONTEXTO.md` - visao geral do projeto
- `docs/ROADMAP.md` - roadmap de implementacao
- `docs/SUMARIO.md` - historico de planos
- `.opencode/skills/voleisort-tdd/SKILL.md` - TDD obrigatorio
