# Vôlei App — Visão Geral e Arquitetura

## O que é o app

Aplicativo PWA para organizar peladas de vôlei. Permite cadastrar jogadores, fazer check-in de quem está presente, formar times equilibrados automaticamente e registrar o resultado das partidas. A cada sessão (ex: volêi da sexta), o app gera um código de acesso que pode ser reutilizado nas semanas seguintes, mantendo o histórico e os ratings dos jogadores.

---

## Stack tecnológica

| Camada | Tecnologia | Motivo |
|---|---|---|
| Framework | React 18 + Vite | Ecosistema maduro, PWA fácil, build rápido |
| Estilo | Tailwind CSS | Utilitário, mobile-first, fácil de manter |
| Roteamento | React Router v6 | Navegação entre telas sem reload |
| Estado global | Zustand | Simples, sem boilerplate, fácil migrar para API |
| Persistência | localStorage | Zero infra, suficiente para MVP |
| PWA | vite-plugin-pwa | Service worker + manifest gerados automaticamente |

---

## Estrutura de pastas

```
volei-app/
├── public/
│   └── icons/               # ícones do PWA (192x192, 512x512)
├── src/
│   ├── components/          # componentes reutilizáveis
│   │   ├── Avatar.jsx
│   │   ├── PlayerRow.jsx
│   │   ├── RatingBar.jsx
│   │   └── TeamCard.jsx
│   ├── pages/               # uma pasta por tela principal
│   │   ├── Home/
│   │   ├── Session/
│   │   ├── Checkin/
│   │   ├── Match/
│   │   └── Player/
│   ├── store/               # estado global (Zustand)
│   │   ├── useSessionStore.js
│   │   ├── usePlayerStore.js
│   │   └── useMatchStore.js
│   ├── logic/               # algoritmos puros (sem UI)
│   │   ├── balancing.js     # formação de times
│   │   ├── rating.js        # cálculo de rating pós-partida
│   │   └── queue.js         # fila de espera entre partidas
│   ├── utils/
│   │   ├── storage.js       # wrapper do localStorage
│   │   └── session-code.js  # encode/decode de sessão
│   └── App.jsx
├── docs/                    # ← estes arquivos
└── vite.config.js
```

---

## Modelo de dados

### Jogador (`Player`)

```json
{
  "id": "uuid-v4",
  "name": "Marcos R.",
  "rating": 78,
  "createdAt": "2025-06-20T00:00:00Z",
  "stats": {
    "matches": 48,
    "wins": 30,
    "losses": 18
  }
}
```

### Sessão (`Session`)

```json
{
  "id": "uuid-v4",
  "code": "ABC123",
  "name": "Volêi da Sexta",
  "createdAt": "2025-06-20T00:00:00Z",
  "config": {
    "teamSize": 6,
    "ratingDeltaThreshold": 10,
    "maxRoundsOut": 2
  },
  "playerIds": ["uuid-1", "uuid-2", "..."],
  "checkedInIds": ["uuid-1", "uuid-2"],
  "matchIds": ["uuid-match-1"]
}
```

### Partida (`Match`)

```json
{
  "id": "uuid-v4",
  "sessionId": "uuid-session",
  "round": 3,
  "status": "ongoing",
  "teams": {
    "A": { "playerIds": ["uuid-1", "uuid-3", "uuid-5"] },
    "B": { "playerIds": ["uuid-2", "uuid-4", "uuid-6"] }
  },
  "waitingIds": ["uuid-7", "uuid-8", "uuid-9"],
  "winner": null,
  "startedAt": "2025-06-20T20:15:00Z",
  "finishedAt": null
}
```

---

## Fluxo principal

```
Início
  ↓
Criar sessão  ←→  Entrar com código
  ↓
Check-in dos presentes
  ↓
Formar times (algoritmo de balanceamento)
  ↓
Partida em andamento
  ↓
Encerrar partida → Selecionar vencedor
  ↓
Atualizar ratings + estatísticas
  ↓
Montar próximo time desafiante
  ↓
Nova partida  ←  (repete)
  ↓
Encerrar sessão → Exportar código
```

---

## Lógica de sessão com código

O código da sessão (ex: `ABC123`) é apenas um identificador humano legível. O estado completo da sessão (jogadores, ratings, histórico) fica no `localStorage`. Para compartilhar com outros dispositivos ou retomar na semana seguinte, o usuário exporta a sessão como um JSON codificado em base64 — que pode ser colado ou compartilhado via link.

Formato do link de compartilhamento:
```
https://volei-app.com/#/session?code=ABC123&data=<base64>
```

Na semana seguinte, o usuário acessa o link ou cola o código + payload, e o app restaura o estado completo.

---

## Regras de rating

- Todos os jogadores começam em **50**
- Escala: **0 a 100**
- Vitória: `+2 pontos` (mínimo +1 se o time adversário era mais fraco)
- Derrota: `−1 ponto` (mínimo 0, rating nunca vai abaixo de 0)
- Ajuste dinâmico: se o time vencedor tinha média muito maior, o ganho é menor (e vice-versa)
- Detalhes do cálculo em `03-logica-balanceamento.md`

---

## Documentos deste plano

| Arquivo | Conteúdo |
|---|---|
| `00-visao-geral.md` | Este arquivo — arquitetura e modelo de dados |
| `01-setup-projeto.md` | Criação do projeto, dependências, PWA |
| `02-dados-e-storage.md` | Stores Zustand + localStorage |
| `03-logica-balanceamento.md` | Algoritmo de times + fila de espera + rating |
| `04-telas-home-sessao.md` | Tela inicial + criar/entrar em sessão |
| `05-tela-checkin.md` | Check-in de jogadores presentes |
| `06-tela-partida.md` | Partida em andamento + encerrar + selecionar vencedor |
| `07-tela-jogador.md` | Perfil, estatísticas e histórico |
| `08-exportar-sessao.md` | Código de sessão e compartilhamento |
