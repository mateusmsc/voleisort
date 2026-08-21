# 08 — Exportar e Compartilhar Sessão

O código de sessão permite retomar uma pelada na semana seguinte com todos os dados preservados: jogadores, ratings e histórico de partidas.

---

## Como funciona

1. Ao final da sessão, o organizador clica em "Compartilhar sessão"
2. O app serializa os dados em base64 e gera um link ou texto para copiar
3. Na semana seguinte, qualquer pessoa com o link ou código+payload pode restaurar a sessão

O dado compartilhado inclui:
- A sessão (configurações, lista de jogadores, código)
- Os jogadores desta sessão com ratings atualizados
- O histórico de partidas

---

## Tela de exportação (`src/pages/Session/ExportSession.jsx`)

```jsx
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useSessionStore } from '../../store/useSessionStore'
import { usePlayerStore } from '../../store/usePlayerStore'
import { useMatchStore } from '../../store/useMatchStore'
import { exportSession } from '../../utils/session-code'

export default function ExportSession() {
  const { code } = useParams()
  const session = useSessionStore(s => s.getSessionByCode(code))
  const { getAllPlayers } = usePlayerStore()
  const getMatchesBySession = useMatchStore(s => s.getMatchesBySession)

  const [copied, setCopied] = useState(false)

  if (!session) return null

  // Montar payload
  const sessionPlayers = getAllPlayers().filter(p =>
    session.playerIds.includes(p.id)
  )
  const matches = getMatchesBySession(session.id)
  const payload = exportSession({ ...session, matchIds: matches.map(m => m.id) }, sessionPlayers)

  const shareUrl = `${window.location.origin}/?code=${session.code}&data=${payload}`
  const shareText = `Volêi App — Sessão ${session.code}\n\nAcesse:\n${shareUrl}`

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback: selecionar o texto
    }
  }

  async function handleShare() {
    if (navigator.share) {
      await navigator.share({
        title: `Vôlei App — Sessão ${session.code}`,
        text: shareText,
        url: shareUrl,
      })
    } else {
      handleCopy()
    }
  }

  // Resumo da sessão
  const totalMatches = matches.filter(m => m.status === 'finished').length

  return (
    <div className="min-h-screen px-4 py-6">
      <h1 className="text-lg font-medium text-stone-800 mb-1">
        Resumo da sessão
      </h1>
      <p className="text-sm text-stone-400 mb-6">
        Compartilhe para retomar na próxima semana
      </p>

      {/* Card da sessão */}
      <div className="bg-white rounded-2xl border border-stone-200 p-4 mb-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-medium text-stone-800">{session.name}</h2>
          <span className="text-xs font-medium bg-sage-light text-sage-dark
                           border border-sage rounded-lg px-2.5 py-1">
            {session.code}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-xl font-medium text-stone-800">{sessionPlayers.length}</p>
            <p className="text-xs text-stone-400">Jogadores</p>
          </div>
          <div>
            <p className="text-xl font-medium text-stone-800">{totalMatches}</p>
            <p className="text-xs text-stone-400">Partidas</p>
          </div>
          <div>
            <p className="text-xl font-medium text-stone-800">
              {new Date(session.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
            </p>
            <p className="text-xs text-stone-400">Data</p>
          </div>
        </div>
      </div>

      {/* Ranking rápido */}
      <h2 className="text-xs font-medium text-stone-400 uppercase tracking-wide mb-3">
        Ranking da sessão
      </h2>
      <div className="bg-white rounded-xl border border-stone-200 divide-y divide-stone-100 mb-6">
        {[...sessionPlayers]
          .sort((a, b) => b.rating - a.rating)
          .slice(0, 5)
          .map((p, i) => (
            <div key={p.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="text-xs text-stone-400 w-4">{i + 1}</span>
              <span className="text-sm text-stone-700 flex-1">{p.name}</span>
              <span className="text-xs font-medium text-sage-dark">{p.rating} pts</span>
            </div>
          ))}
      </div>

      {/* Ações de compartilhamento */}
      <div className="space-y-3">
        <button
          onClick={handleShare}
          className="w-full bg-sage-dark text-white rounded-xl py-3 text-sm font-medium"
        >
          Compartilhar sessão 🔗
        </button>
        <button
          onClick={handleCopy}
          className="w-full bg-white border border-sand text-stone-600
                     rounded-xl py-3 text-sm"
        >
          {copied ? '✓ Copiado!' : 'Copiar link'}
        </button>
      </div>

      <p className="text-xs text-stone-400 text-center mt-4">
        Quem tiver o link pode retomar a sessão com todos os ratings preservados.
      </p>
    </div>
  )
}
```

---

## Restaurar sessão na semana seguinte

Quando o usuário acessa um link compartilhado, a `Home` detecta os parâmetros na URL e oferece a opção de restaurar:

```jsx
// Em Home.jsx, adicionar no useEffect:
useEffect(() => {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')
  const data = params.get('data')

  if (code && data) {
    setCode(code)
    // Pré-preenche o campo de código e sugere restaurar
    setPendingImport({ code, data })
  }
}, [])
```

O modal de restauração:

```jsx
function ImportSessionBanner({ code, data, onImport, onDismiss }) {
  return (
    <div className="fixed bottom-0 inset-x-0 bg-white border-t border-sand
                    p-4 pb-8 z-40">
      <p className="text-sm font-medium text-stone-800 mb-1">
        Retomar sessão <span className="text-sage-dark">{code}</span>?
      </p>
      <p className="text-xs text-stone-400 mb-4">
        Vai restaurar os jogadores e ratings da última sessão.
      </p>
      <div className="flex gap-3">
        <button onClick={onDismiss}
          className="flex-1 py-2.5 rounded-xl border border-sand text-sm text-stone-500">
          Não
        </button>
        <button onClick={() => onImport(data)}
          className="flex-1 py-2.5 rounded-xl bg-sage-dark text-white text-sm font-medium">
          Restaurar
        </button>
      </div>
    </div>
  )
}
```

---

## Estrutura do payload exportado

```json
{
  "session": {
    "id": "...",
    "code": "ABC123",
    "name": "Volêi da Sexta",
    "config": { "teamSize": 6 },
    "playerIds": ["id1", "id2", "..."],
    "matchIds": ["mid1", "mid2"]
  },
  "players": [
    { "id": "id1", "name": "Marcos R.", "rating": 80, "stats": { ... } },
    { "id": "id2", "name": "Julia C.",  "rating": 67, "stats": { ... } }
  ],
  "exportedAt": "2025-06-20T22:30:00Z"
}
```

> O payload é codificado em base64 e fica na URL. Para sessões grandes (20+ jogadores, 30+ partidas), o tamanho pode chegar a ~5KB — ainda dentro do limite de URL dos navegadores (~64KB).

---

## Considerações de segurança

- O código da sessão (`ABC123`) por si só não é suficiente para acessar os dados — é necessário o payload completo
- Não há autenticação no MVP; qualquer pessoa com o link pode importar e ver a sessão
- Para uma versão futura com backend, o código seria uma chave de acesso real com senha
