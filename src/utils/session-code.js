/**
 * Gera um código legível de 6 caracteres para a sessão.
 * Ex: "ABC123", "VOL007"
 */
export function generateCode() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'  // sem I e O (confundem com 1 e 0)
  const digits  = '0123456789'
  const rand = arr => arr[Math.floor(Math.random() * arr.length)]

  return (
    rand(letters) + rand(letters) + rand(letters) +
    rand(digits)  + rand(digits)  + rand(digits)
  )
}

/**
 * Exporta uma sessão + dados dos jogadores como string base64.
 * Usada para gerar o link de compartilhamento.
 */
export function exportSession(session, players) {
  const payload = { session, players, exportedAt: new Date().toISOString() }
  return btoa(JSON.stringify(payload))
}

/**
 * Importa uma sessão a partir de uma string base64.
 */
export function importSession(base64) {
  try {
    return JSON.parse(atob(base64))
  } catch {
    return null
  }
}
