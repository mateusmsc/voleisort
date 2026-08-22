import fs from 'fs'
import path from 'path'

const ProjectRef = 'wcoqwgogjzjiyivlsopn'
const AccessToken = process.env.SUPABASE_ACCESS_TOKEN

async function runSqlScript(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ProjectRef}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${AccessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  })
  const body = await res.json()
  if (!res.ok) {
    console.error('❌ Erro ao executar script:', res.status, JSON.stringify(body, null, 2))
    process.exit(1)
  }
  return body
}

async function main() {
  console.log('🚀 Executando clone-nyn201-to-teste.sql...\n')
  const scriptPath = path.join(__dirname, 'scripts', 'clone-nyn201-to-teste.sql')
  const script = fs.readFileSync(scriptPath, 'utf-8')

  try {
    // Execução em blocos maiores são mais eficientes para o endpoint da API
    const blocks = script.split(/^GO$/gim).map(b => b.trim()).filter(b => b)

    for (const block of blocks) {
      if (!block) continue
      console.log('Executando bloco SQL...')
      const result = await runSqlScript(block)
      if (result.rows && result.rows.length > 0) {
        console.log('Resultado:', JSON.stringify(result.rows, null, 2))
      }
      console.log('✓ Bloco concluído\n')
    }

    console.log('✅ Script clone-nyn201-to-teste.sql executado com sucesso!')

    // Final check: mostrar sessão TESTE resultante
    console.log('\n📊 Sessão TESTE criada:')
    const sessions = await runSqlScript(
      `SELECT id, code, name, status, stats_reset_at FROM sessions WHERE code = 'TESTE'`
    )
    if (sessions.data && sessions.data.length > 0) {
      console.log(JSON.stringify(sessions.data[0], null, 2))
    }

    console.log('\n📋 Matches da sessão TESTE:')
    const matches = await runSqlScript(
      `SELECT COUNT(*) as total_matches FROM matches WHERE session_id = (SELECT id FROM sessions WHERE code = 'TESTE')`
    )
    if (matches.data && matches.data.length > 0) {
      console.log(JSON.stringify(matches.data[0], null, 2))
    }
  } catch (err) {
    console.error('❌ Erro ao executar script:', err.message)
    process.exit(1)
  }
}

main()
