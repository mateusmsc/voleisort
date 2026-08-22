/**
 * Lógica do painel público — identificado pelo panelHash da sessão,
 * que não expõe o código de acesso da sessão.
 */

export function panelPath(panelHash) {
  return `/panel/${panelHash}`
}

export function findSessionByCode(sessions, code) {
  return Object.values(sessions).find(s => s.code === code) ?? null
}

export function findSessionByPanelHash(sessions, panelHash) {
  if (!panelHash) return null
  return Object.values(sessions).find(s => s.panelHash === panelHash) ?? null
}
