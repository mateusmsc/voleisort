export function generateCode() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const digits  = '0123456789'
  const rand = arr => arr[Math.floor(Math.random() * arr.length)]

  return (
    rand(letters) + rand(letters) + rand(letters) +
    rand(digits)  + rand(digits)  + rand(digits)
  )
}

export function exportSession(session, players) {
  const payload = { session, players, exportedAt: new Date().toISOString() }
  return btoa(JSON.stringify(payload))
}

export function importSession(base64) {
  try {
    return JSON.parse(atob(base64))
  } catch {
    return null
  }
}
