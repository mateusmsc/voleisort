/**
 * Lógica do painel público por código de sessão.
 */

export function panelPath(sessionCode) {
  return `/panel/${sessionCode}`
}

export function findSessionByCode(sessions, code) {
  return Object.values(sessions).find(s => s.code === code) ?? null
}
