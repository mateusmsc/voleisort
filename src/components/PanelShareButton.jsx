import { useState } from 'react'
import { panelPath } from '../logic/panel'

export default function PanelShareButton({ code }) {
  const [copied, setCopied] = useState(false)

  if (!code) return null

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}${panelPath(code)}`
      )
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard indisponível — sem feedback, comportamento inofensivo
    }
  }

  return (
    <button
      onClick={handleCopy}
      className="py-1.5 text-xs text-stone-400 underline
                 hover:text-stone-600 dark:hover:text-stone-300"
    >
      {copied ? '✓ Link do painel copiado!' : '📺 Painel público'}
    </button>
  )
}
