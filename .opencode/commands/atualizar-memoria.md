---
description: Analisa o código atual e atualiza premissas.md e CONTEXTO.md para refletir o estado real do projeto.
---

Analise o estado atual do projeto voleisort e atualize os arquivos de documentação `premissas.md` e `CONTEXTO.md` para que reflitam fielmente o código existente.

## Passos obrigatórios

1. Leia `premissas.md` e `CONTEXTO.md` para entender o que já está documentado.
2. Explore o código atual nas pastas `src/logic/`, `src/store/`, `src/services/`, `src/pages/`, `src/components/`, `src/utils/` e `docs/SUMARIO.md`.
3. Compare o que está documentado com o que o código realmente faz.
4. Identifique divergências: funcionalidades novas, removidas ou alteradas; regras de negócio que mudaram; novos arquivos, stores, services ou testes.
5. Atualize `premissas.md` e `CONTEXTO.md` apenas onde houver divergência — não reescreva o que já está correto.
6. Informe ao usuário um resumo objetivo das mudanças feitas (ou "nenhuma divergência encontrada" se tudo já estava correto).

## Restrições

- Não altere lógica de código — apenas arquivos de documentação.
- Não remova seções existentes sem justificativa explícita.
- Preserve o estilo e formato já adotado nos arquivos.
- Se encontrar algo ambíguo no código, documente como está, sem inferir intenção.
