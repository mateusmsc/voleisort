# Premissas do Projeto

## Regras de processo

- **Nunca remover código, arquivos ou funcionalidades sem diretiva explícita no prompt ou pergunta ao usuário.** Se algo parece desnecessário, perguntar antes de agir.
- **Sempre ler este arquivo antes de qualquer implementação.**
- **Testes existentes são contratos.** Nenhuma alteração de lógica pode quebrar um teste já consolidado. Se um teste precisar mudar, justificar explicitamente por que o contrato mudou.
- **Fluxo obrigatório para bugs:** escrever primeiro o teste que falha (red), depois corrigir o código até o teste passar (green).
- **Fluxo obrigatório para features:** escrever primeiro o teste, depois implementar.
- Antes de criar um arquivo novo, verificar se já existe um adequado para receber o código.

## Arquitetura

- Lógica pura (sem React, sem stores) vive em `src/logic/`.
- Componentes de UI em `src/components/` e `src/pages/`.
- Estado global em `src/store/` via Zustand (em memória, sem `persist`, hidratado no boot via Supabase).
  - Exceção: `useThemeStore` ainda usa `persist` no localStorage (preferência visual, não é dado de negócio).
- Acesso ao banco em `src/services/` — cada entidade tem seu service (`playerService`, `sessionService`, `matchService`).
- Autenticação anônima em `src/services/auth.js` (`ensureAuth`).
- Boot em `src/services/bootstrap.js` (`hydrateStores`): sequência obrigatória `ensureAuth → hydrateStores → render`.
- Utilitários em `src/utils/`.
- Testes ficam em `tests/`, separados do código de produção:
  - `tests/unit/logic/` — testes de `src/logic/`
  - `tests/unit/services/` — testes de `src/services/`
  - `tests/integration/` — testes de integração entre módulos
- Imports nos testes de lógica: relativos (`../../../src/logic/foo.js`).
- Imports nos testes de services: usar alias `@/` (ex: `@/services/supabase.js`). O alias `@` aponta para `src/` e está configurado no `vite.config.js`.

## Padrão de stores (Fase 2 — Supabase)

- **Sem `persist` nos stores de negócio.** Os dados vêm do Supabase no boot via `_hydrate`.
- **Actions são `async`**: primeiro atualizam o estado em memória (optimistic update), depois chamam o service correspondente.
- **Nunca chamar `setState` direto em componentes** para alterar dados de negócio — sempre usar as actions dos stores.
- `_hydrate(data)` é chamado exclusivamente pelo bootstrap; nunca invocar manualmente em componentes.
- IDs são gerados no cliente com `uuid()` antes da chamada ao banco (sem round-trip extra).

## Camada de serviços

- Cada service usa mappers `toDb` (camelCase → snake_case) e `fromDb` (snake_case → camelCase) para isolar o schema do banco da lógica frontend.
- Campos JSONB no banco (`stats`, `config`, `teams`, `next_teams`): passados diretamente sem conversão de chaves.
- Arrays que podem ser `null` no banco (`player_ids`, `checked_in_ids`, `match_ids`, `next_teams`) são normalizados para `[]` no `fromDb`.
- `roundsOutResetAt` é opcional na match: só é incluído no objeto se presente.

## Regras de negócio consolidadas

### Formação inicial de times
- O **nível** (`level`, escala 1–5, default 3) é o critério de balanceamento na formação de times, via `levelSpreadDraft`: jogadores de nível alto são espalhados entre todos os grupos (campo + fila) em round-robin.
- Após o `levelSpreadDraft`, `rebalanceHighLevelPlayers` é chamado automaticamente por `distributeAllPlayers` para corrigir concentrações de alto nível na fila quando a 1ª próxima ficou sem nenhum.
- Uma vez iniciada a sessão (partida criada), o critério de avanço é **fila + tempo de fora**.

### Fila de próximos times (`nextTeams`)
- A fila é estritamente **FIFO**: o primeiro time da fila é o primeiro a entrar em campo.
- Dentro da fila, a prioridade para preencher lacunas é: **tempo de fora** (maior `roundsOut` entra primeiro). É critério secundário apenas no desempate de urgência igual.
- Se um jogador é removido de uma próxima, o substituto deve ser promovido da próxima fila respeitando a ordem e o tempo de fora.
- **Nunca** usar nível como critério de avanço de fila — `levelSpreadDraft` só é chamado na formação inicial.

### Check-in com partida ativa
- Ao fazer check-in de um jogador já cadastrado (não novo) com partida ativa, ele deve entrar automaticamente na fila (`nextTeams`), da mesma forma que um novo jogador.
- Ao remover um jogador do check-in, ele é substituído pelo melhor disponível (critério: tempo de fora).

### Substituições
- Cada substituto é usado no máximo uma vez.
- Jogador removido sem substituto disponível sai sem preenchimento do slot.
- Jogadores envolvidos em troca manual (EditTeamsModal) não podem aparecer duplicados: quem entra no time sai da próxima; quem saiu do time vai para a próxima.

### Cancelamento de partida
- Cancelar uma partida equivale a uma nova instância: zera `roundsOut` de todos os jogadores e o próximo "Formar times" executa um novo `levelSpreadDraft` do zero.

### Mistura de times
- O botão de mistura (shuffle) dos times em campo deve existir e ser testado. Nunca removê-lo.
- O shuffle respeita restrição de nível: trocas que concentrariam 2+ jogadores de alto nível (≥ `HIGH_LEVEL_THRESHOLD = 4`) num time enquanto o outro ficaria com 0 são rejeitadas silenciosamente.

### Encerramento de partida
- Ao encerrar, o primeiro time da fila sobe para campo como novo oponente.
- Perdedores voltam para o final da fila.
- `roundsOut` é atualizado: quem jogou zera, quem ficou de fora incrementa.
