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
- Estado global em `src/store/` via Zustand com `persist`.
- Utilitários em `src/utils/`.
- Testes ficam ao lado do arquivo que testam: `foo.js` → `foo.test.js`.

## Regras de negócio consolidadas

### Formação inicial de times
- O overall (rating) é usado **somente na primeira formação de times** de uma sessão, via snake draft.
- Uma vez iniciada a sessão (partida criada), o critério de avanço é **fila + tempo de fora**.

### Fila de próximos times (`nextTeams`)
- A fila é estritamente **FIFO**: o primeiro time da fila é o primeiro a entrar em campo.
- Dentro da fila, a prioridade para preencher lacunas é: **tempo de fora** (maior `roundsOut` entra primeiro). Rating é critério secundário apenas no desempate de urgência igual.
- Se um jogador é removido de uma próxima, o substituto deve ser promovido da próxima fila respeitando a ordem e o tempo de fora.
- **Nunca** usar overall como critério de balanceamento após a primeira partida.

### Check-in com partida ativa
- Ao fazer check-in de um jogador já cadastrado (não novo) com partida ativa, ele deve entrar automaticamente na fila (`nextTeams`), da mesma forma que um novo jogador.
- Ao remover um jogador do check-in, ele é substituído pelo melhor disponível (critério: tempo de fora, depois rating).

### Substituições
- Cada substituto é usado no máximo uma vez.
- Jogador removido sem substituto disponível sai sem preenchimento do slot.
- Jogadores envolvidos em troca manual (EditTeamsModal) não podem aparecer duplicados: quem entra no time sai da próxima; quem saiu do time vai para a próxima.

### Cancelamento de partida
- Cancelar uma partida equivale a uma nova instância: zera `roundsOut` de todos os jogadores e o próximo "Formar times" executa um novo snake draft do zero.

### Mistura de times
- O botão de mistura (shuffle) dos times em campo deve existir e ser testado. Nunca removê-lo.

### Encerramento de partida
- Ao encerrar, o primeiro time da fila sobe para campo como novo oponente.
- Perdedores voltam para o final da fila.
- `roundsOut` é atualizado: quem jogou zera, quem ficou de fora incrementa.
