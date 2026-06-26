import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useSessionStore } from '../../store/useSessionStore'
import { usePlayerStore } from '../../store/usePlayerStore'
import { useMatchStore } from '../../store/useMatchStore'
import { exportSession } from '../../utils/session-code'

export default function ExportSession() {
  const { code } = useParams()
  const navigate = useNavigate()
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
  const shareText = `Vôlei App — Sessão ${session.code}\n\nAcesse:\n${shareUrl}`

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
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
      <button
        onClick={() => navigate(-1)}
        className="text-stone-400 text-sm mb-5 flex items-center gap-1"
      >
        ← Voltar
      </button>

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
        {sessionPlayers.length === 0 && (
          <div className="px-4 py-3 text-sm text-stone-400 text-center">
            Nenhum jogador registrado
          </div>
        )}
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
