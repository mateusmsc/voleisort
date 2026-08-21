/**
 * scripts/export-prod-data.mjs
 *
 * Exporta uma cópia exata das tabelas do Supabase de produção para arquivos locais:
 *   - backups/prod-snapshot/<tabela>.json  (dados brutos)
 *   - backups/prod-snapshot/seed.sql       (INSERTs para restaurar em qualquer banco)
 *
 * Uso: node scripts/export-prod-data.mjs
 * Requer: variável de ambiente SUPABASE_ACCESS_TOKEN e SUPABASE_PROJECT_REF
 */

import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF ?? 'wcoqwgogjzjiyivlsopn'
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN

if (!TOKEN) {
  console.error('ERRO: SUPABASE_ACCESS_TOKEN não definido no ambiente.')
  process.exit(1)
}

const OUT_DIR = 'backups/prod-snapshot'
const TABLES = ['players', 'sessions', 'matches']

// Colunas que são arrays nativos do Postgres (uuid[]) — o resto de
// array/objeto é JSONB no schema do projeto.
const PG_ARRAY_COLUMNS = new Set([
  'player_ids',
  'checked_in_ids',
  'match_ids',
])

function sqlLiteral(table, column, value) {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (PG_ARRAY_COLUMNS.has(column)) {
    const items = value.map(v => `'${String(v).replaceAll("'", "''")}'`)
    return `ARRAY[${items.join(', ')}]::uuid[]`
  }
  if (Array.isArray(value) || typeof value === 'object') {
    return `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`
  }
  return `'${String(value).replaceAll("'", "''")}'`
}

async function query(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  })
  const body = await res.json()
  if (!res.ok) throw new Error(`${res.status}: ${JSON.stringify(body)}`)
  return body
}

mkdirSync(OUT_DIR, { recursive: true })

const lines = [
  '-- Snapshot gerado por scripts/export-prod-data.mjs',
  `-- Origem: projeto ${PROJECT_REF} · ${new Date().toISOString()}`,
  '-- Restaurar em banco com schema já aplicado (dev_setup.sql).',
  '',
]

for (const table of TABLES) {
  const rows = await query(`SELECT * FROM ${table};`)
  console.log(`${table}: ${rows.length} linhas`)

  writeFileSync(join(OUT_DIR, `${table}.json`), JSON.stringify(rows, null, 2))

  for (const row of rows) {
    const cols = Object.keys(row)
    const values = cols.map(c => sqlLiteral(table, c, row[c]))
    // ON CONFLICT evita erro ao restaurar em banco já populado
    lines.push(
      `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${values.join(', ')})`,
      `ON CONFLICT (id) DO NOTHING;`
    )
  }
}

writeFileSync(join(OUT_DIR, 'seed.sql'), lines.join('\n') + '\n')
console.log(`\nSnapshot salvo em ${OUT_DIR}/ (JSON + seed.sql)`)
