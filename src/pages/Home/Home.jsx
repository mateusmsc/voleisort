import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSessionStore } from '../../store/useSessionStore'
import { usePlayerStore } from '../../store/usePlayerStore'
import { useThemeStore } from '../../store/useThemeStore'
import { importSession } from '../../utils/session-code'

export default function Home() {
  const navigate = useNavigate()
  const { createSession, getSessionByCode, importSession: importToStore } = useSessionStore()
  const { importPlayers } = usePlayerStore()
  const { dark, toggleDark } = useThemeStore()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [pendingImport, setPendingImport] = useState(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const urlCode = params.get('code')
    const data = params.get('data')
    if (urlCode && data) {
      setCode(urlCode.toUpperCase())
      setPendingImport({ code: urlCode.toUpperCase(), data })
    }
  }, [])

  function handleNewSession() {
    navigate('/session/new')
  }

  function handleEnterSession() {
    const trimmed = code.trim().toUpperCase()
    if (trimmed.length < 6) {
      setError('Código inválido — deve ter 6 caracteres.')
      return
    }
    const existing = getSessionByCode(trimmed)
    if (existing) {
      navigate(`/session/${trimmed}/checkin`)
      return
    }
    setError('Sessão não encontrada. Verifique o código ou o link compartilhado.')
  }

  function handleImport(data) {
    const parsed = importSession(data)
    if (parsed?.session) {
      importToStore(parsed.session)
      if (parsed.players) importPlayers(parsed.players)
      navigate(`/session/${parsed.session.code}/checkin`)
    } else {
      setError('Falha ao restaurar sessão. Link inválido.')
      setPendingImport(null)
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6
                 dark:bg-stone-900"
      style={dark ? {} : { background: 'linear-gradient(160deg, #e8f0e8 0%, #f0ebe2 100%)' }}
    >
      <div className="absolute top-4 right-4">
        <button
          onClick={toggleDark}
          className={`relative w-12 h-6 rounded-full transition-colors duration-300 focus:outline-none
                      ${dark ? 'bg-sage-dark' : 'bg-stone-300'}`}
          title={dark ? 'Modo claro' : 'Modo noturno'}
          aria-label="Alternar modo noturno"
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow
                         flex items-center justify-center text-xs transition-transform duration-300
                         ${dark ? 'translate-x-6' : 'translate-x-0'}`}
          >
            {dark ? '🌙' : '☀️'}
          </span>
        </button>
      </div>

      <div className="w-16 h-16 bg-sage rounded-2xl flex items-center justify-center
                      text-4xl mb-3 shadow-sm">
        🏐
      </div>
      <h1 className="text-2xl font-medium text-stone-800 dark:text-stone-100 mb-1">voleisort</h1>
      <p className="text-sm text-stone-500 dark:text-stone-400 mb-8">Organize sua pelada com inteligência</p>

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
            className="flex-1 bg-white dark:bg-stone-800 dark:text-stone-100
                       dark:border-stone-600 border border-sand rounded-xl px-3 py-2.5
                       text-base tracking-widest uppercase text-stone-700
                       focus:outline-none focus:border-sage"
          />
          <button
            onClick={handleEnterSession}
            className="bg-sand dark:bg-stone-700 dark:text-stone-200
                       text-stone-700 rounded-xl px-4 py-2.5 text-sm font-medium"
          >
            Entrar →
          </button>
        </div>

        {error && (
          <p className="text-sm text-red-500 text-center">{error}</p>
        )}
      </div>

      <p className="text-xs text-stone-400 dark:text-stone-600 mt-8">v1.2</p>

      {pendingImport && (        <div className="fixed bottom-0 inset-x-0 bg-white dark:bg-stone-800
                        border-t border-sand dark:border-stone-700 p-4 pb-8 z-40">
          <p className="text-sm font-medium text-stone-800 dark:text-stone-100 mb-1">
            Retomar sessão <span className="text-sage-dark">{pendingImport.code}</span>?
          </p>
          <p className="text-xs text-stone-400 mb-4">
            Vai restaurar os jogadores e ratings da última sessão.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setPendingImport(null)}
              className="flex-1 py-2.5 rounded-xl border border-sand dark:border-stone-600
                         text-sm text-stone-500 dark:text-stone-400"
            >
              Não
            </button>
            <button
              onClick={() => handleImport(pendingImport.data)}
              className="flex-1 py-2.5 rounded-xl bg-sage-dark text-white text-sm font-medium"
            >
              Restaurar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
