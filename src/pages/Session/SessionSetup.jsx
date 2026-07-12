import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSessionStore } from '../../store/useSessionStore'

export default function SessionSetup() {
  const navigate = useNavigate()
  const createSession = useSessionStore(s => s.createSession)

  const [name, setName] = useState('')
  const [teamSize, setTeamSize] = useState(6)

  async function handleCreate() {
    if (!name.trim()) return
    const session = await createSession(name.trim(), { teamSize })
    navigate(`/session/${session.code}/checkin`)
  }

  return (
    <div className="min-h-screen px-6 py-10 bg-stone-50 dark:bg-stone-900">
      <button
        onClick={() => navigate(-1)}
        className="text-stone-400 text-sm mb-6 flex items-center gap-1"
      >
        ← Voltar
      </button>

      <h1 className="text-xl font-medium text-stone-800 dark:text-stone-100 mb-1">Nova sessão</h1>
      <p className="text-sm text-stone-500 dark:text-stone-400 mb-8">
        Configure a pelada de hoje. O código será gerado automaticamente.
      </p>

      <div className="space-y-5">
        <div>
          <label className="text-sm font-medium text-stone-600 dark:text-stone-300 block mb-1.5">
            Nome da sessão
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            placeholder="Ex: Vôlei da Sexta"
            className="w-full bg-white dark:bg-stone-800 border border-sand dark:border-stone-600
                       rounded-xl px-3 py-2.5 text-base text-stone-700 dark:text-stone-100
                       focus:outline-none focus:border-sage"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-stone-600 dark:text-stone-300 block mb-1.5">
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
                    : 'bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-300 border-sand dark:border-stone-600'
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
