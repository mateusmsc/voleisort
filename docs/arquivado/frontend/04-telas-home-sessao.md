# 04 — Telas: Home e Sessão

---

## Tela Home (`src/pages/Home/Home.jsx`)

Ponto de entrada do app. O usuário pode criar uma nova sessão ou entrar em uma existente pelo código.

```jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSessionStore } from '../../store/useSessionStore'
import { importSession } from '../../utils/session-code'

export default function Home() {
  const navigate = useNavigate()
  const { createSession, getSessionByCode, importSession: importToStore } = useSessionStore()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')

  function handleNewSession() {
    navigate('/session/new')
  }

  function handleEnterSession() {
    const trimmed = code.trim().toUpperCase()
    if (trimmed.length < 6) {
      setError('Código inválido — deve ter 6 caracteres.')
      return
    }

    // Verificar se a sessão já está no localStorage
    const existing = getSessionByCode(trimmed)
    if (existing) {
      navigate(`/session/${trimmed}/checkin`)
      return
    }

    // Verificar se veio via URL (link compartilhado)
    const params = new URLSearchParams(window.location.search)
    const data = params.get('data')
    if (data) {
      const parsed = importSession(data)
      if (parsed?.session?.code === trimmed) {
        importToStore(parsed.session)
        // Importar jogadores também (ver usePlayerStore.importPlayers)
        navigate(`/session/${trimmed}/checkin`)
        return
      }
    }

    setError('Sessão não encontrada. Verifique o código ou o link compartilhado.')
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6"
         style={{ background: 'linear-gradient(160deg, #e8f0e8 0%, #f0ebe2 100%)' }}>

      {/* Logo */}
      <div className="w-16 h-16 bg-sage rounded-2xl flex items-center justify-center
                      text-4xl mb-3 shadow-sm">
        🏐
      </div>
      <h1 className="text-2xl font-medium text-stone-800 mb-1">Vôlei App</h1>
      <p className="text-sm text-stone-500 mb-8">Organize sua pelada com inteligência</p>

      {/* Ações */}
      <div className="w-full max-w-sm space-y-3">
        <button
          onClick={handleNewSession}
          className="w-full bg-sage-dark text-white rounded-xl py-3 text-base font-medium"
        >
          + Nova sessão
        </button>

        <div className="text-center text-xs text-stone-400">
          ou entre em uma sessão existente
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={code}
            onChange={e => { setCode(e.target.value); setError('') }}
            onKeyDown={e => e.key === 'Enter' && handleEnterSession()}
            placeholder="ABC123"
            maxLength={6}
            className="flex-1 bg-white border border-sand rounded-xl px-3 py-2.5
                       text-base tracking-widest uppercase text-stone-700
                       focus:outline-none focus:border-sage"
          />
          <button
            onClick={handleEnterSession}
            className="bg-sand text-stone-700 rounded-xl px-4 py-2.5 text-sm font-medium"
          >
            Entrar →
          </button>
        </div>

        {error && (
          <p className="text-sm text-red-500 text-center">{error}</p>
        )}
      </div>
    </div>
  )
}
```

---

## Tela de criação de sessão (`src/pages/Session/SessionSetup.jsx`)

Formulário para dar nome à sessão e configurar opções básicas.

```jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSessionStore } from '../../store/useSessionStore'

export default function SessionSetup() {
  const navigate = useNavigate()
  const createSession = useSessionStore(s => s.createSession)

  const [name, setName] = useState('')
  const [teamSize, setTeamSize] = useState(6)

  function handleCreate() {
    if (!name.trim()) return
    const session = createSession(name.trim(), { teamSize })
    navigate(`/session/${session.code}/checkin`)
  }

  return (
    <div className="min-h-screen px-6 py-10">
      <button
        onClick={() => navigate(-1)}
        className="text-stone-400 text-sm mb-6 flex items-center gap-1"
      >
        ← Voltar
      </button>

      <h1 className="text-xl font-medium text-stone-800 mb-1">Nova sessão</h1>
      <p className="text-sm text-stone-500 mb-8">
        Configure a pelada de hoje. O código será gerado automaticamente.
      </p>

      <div className="space-y-5">
        {/* Nome */}
        <div>
          <label className="text-sm font-medium text-stone-600 block mb-1.5">
            Nome da sessão
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ex: Volêi da Sexta"
            className="w-full bg-white border border-sand rounded-xl px-3 py-2.5
                       text-base text-stone-700 focus:outline-none focus:border-sage"
          />
        </div>

        {/* Tamanho do time */}
        <div>
          <label className="text-sm font-medium text-stone-600 block mb-1.5">
            Jogadores por time
          </label>
          <div className="flex gap-2">
            {[4, 5, 6, 7].map(n => (
              <button
                key={n}
                onClick={() => setTeamSize(n)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                  teamSize === n
                    ? 'bg-sage-dark text-white border-sage-dark'
                    : 'bg-white text-stone-600 border-sand'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleCreate}
          disabled={!name.trim()}
          className="w-full bg-sage-dark text-white rounded-xl py-3 text-base
                     font-medium disabled:opacity-40 mt-4"
        >
          Criar sessão
        </button>
      </div>
    </div>
  )
}
```
