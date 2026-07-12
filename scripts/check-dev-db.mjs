/**
 * scripts/check-dev-db.mjs
 *
 * Verifica se o banco de desenvolvimento está configurado corretamente.
 * Uso: node scripts/check-dev-db.mjs
 *
 * Pré-requisitos:
 *   1. Aplicar migrations/dev_setup.sql no SQL Editor do Supabase Dev
 *   2. Habilitar Anonymous sign-ins no Supabase Dashboard:
 *      Authentication → Providers → Anonymous → Enable
 */

const DEV_URL = 'https://mmdwggvyalmoqmrbhfqo.supabase.co'
const DEV_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tZHdnZ3Z5YWxtb3FtcmJoZnFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3MzIwODcsImV4cCI6MjA5OTMwODA4N30.pxj2YPmALV1M2Jh1Xfs6yOFnXZAOmR8ewV37hAgRU0k'

const headers = {
  apikey: DEV_KEY,
  Authorization: `Bearer ${DEV_KEY}`,
  'Content-Type': 'application/json',
}

let passed = 0
let failed = 0

function ok(msg)   { console.log(`  ✓ ${msg}`); passed++ }
function fail(msg) { console.error(`  ✗ ${msg}`); failed++ }

async function get(path) {
  const r = await fetch(`${DEV_URL}${path}`, { headers })
  return { status: r.status, body: await r.json().catch(() => ({})) }
}

async function post(path, body) {
  const r = await fetch(`${DEV_URL}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  return { status: r.status, body: await r.json().catch(() => ({})) }
}

// ──────────────────────────────────────────────────────────────
console.log('\n=== Verificação do banco de desenvolvimento ===\n')

// 1. Tabelas existem?
console.log('1. Tabelas REST acessíveis (requer RLS + tabelas criadas):')
for (const table of ['players', 'sessions', 'matches']) {
  const { status, body } = await get(`/rest/v1/${table}?limit=1`)
  if (status === 200) {
    ok(`${table} — OK (${Array.isArray(body) ? body.length : '?'} rows)`)
  } else if (status === 401) {
    fail(`${table} — 401 Unauthorized (RLS bloqueando sem auth — normal se anon auth desabilitado)`)
  } else {
    fail(`${table} — ${status}: ${JSON.stringify(body).slice(0, 120)}`)
  }
}

// 2. Anonymous auth habilitado?
console.log('\n2. Anonymous sign-in:')
const authResp = await post('/auth/v1/token?grant_type=anonymous', {})
if (authResp.status === 200 && authResp.body.access_token) {
  ok('Anonymous sign-in funcionando')

  // 3. Tabelas com token autenticado
  const authedHeaders = {
    ...headers,
    Authorization: `Bearer ${authResp.body.access_token}`,
  }
  console.log('\n3. Tabelas com usuário autenticado:')
  for (const table of ['players', 'sessions', 'matches']) {
    const r = await fetch(`${DEV_URL}/rest/v1/${table}?limit=1`, { headers: authedHeaders })
    const body = await r.json().catch(() => ({}))
    if (r.status === 200) {
      ok(`${table} — OK`)
    } else {
      fail(`${table} — ${r.status}: ${JSON.stringify(body).slice(0, 120)}`)
    }
  }

  // 4. Coluna level existe?
  console.log('\n4. Coluna level nos players:')
  const r = await fetch(`${DEV_URL}/rest/v1/players?select=id,level&limit=0`, { headers: authedHeaders })
  if (r.status === 200) {
    ok('Coluna level existe em players')
  } else {
    const b = await r.json().catch(() => ({}))
    fail(`Coluna level ausente: ${JSON.stringify(b).slice(0, 120)}`)
  }
} else {
  fail(`Anonymous sign-in falhou (${authResp.status}): ${JSON.stringify(authResp.body).slice(0, 120)}`)
  console.log('\n  → Acesse o Supabase Dashboard e habilite:')
  console.log(`    ${DEV_URL.replace('https://', 'https://supabase.com/dashboard/project/').replace('.supabase.co', '')}/auth/providers`)
  console.log('    Authentication → Providers → Anonymous → Enable\n')
}

// ──────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(45)}`)
console.log(`  Resultado: ${passed} ✓  ${failed} ✗`)
if (failed === 0) {
  console.log('  Banco de dev pronto! Execute: npm run dev\n')
} else {
  console.log('  Corrija os itens acima e rode novamente.\n')
  process.exit(1)
}
