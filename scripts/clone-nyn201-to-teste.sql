-- ---------------------------------------------------------------------------
-- Clone da sessão NYN201 em produção para clonar no dia
-- ---------------------------------------------------------------------------
-- O objetivo é criar uma cópia isolada em produção (código TESTE) com os
-- mesmos dados de partidas para validar o fix do contador de partidas.
-- Ao usar stats_reset_at = null, o contador vai usar mesmo-dia agrupando
-- por start_at como fallback, permitindo testar sem termo de hoje.
--------------------------------------------------------------------------------

-- 1. Criar nova sessão TESTE (ou atualizar se já existir)
INSERT INTO sessions (
  id,
  code,
  name,
  status,
  config,
  player_ids,
  stats_reset_at,
  created_at,
  created_by
) (
  SELECT
    gen_random_uuid() AS id,
    'TESTE' AS code,
    (name || ' (TESTE)') AS name,
    status,
    config,
    (player_ids IS NOT NULL AND array_length(player_ids, 1) IS NOT NULL) ? 'nyn201'
      ? player_ids || [ny201.id]::jsonb  -- anexar ny201 aos jogadores da sessão TESTE
      : (
          (player_ids IS NOT NULL AND array_length(player_ids, 1) IS NOT NULL)
            ? player_ids || [nyn201.id]::jsonb
            : [nyn201.id]
        ),
    NULL AS stats_reset_at,
    created_at AS created_at,
    'SAAS_TESTE' AS created_by
  FROM sessions AS nyn201
)

ON CONFLICT (code)
DO UPDATE SET
    name = EXCLUDED.name,
    config = EXCLUDED.config,
    player_ids = EXCLUDED.player_ids,
    stats_reset_at = EXCLUDED.stats_reset_at,
    updated_at = now();

-- 2. Obter o ID da sessão TESTE criada (ou atualizada)
WITH teste_session AS (
  SELECT id
  FROM sessions
  WHERE code = 'TESTE'
)
SELECT
  (SELECT id FROM teste_session) AS teste_session_id,
  (SELECT code FROM sessions WHERE code = 'NYN201') AS nyn201_code;

-- 3. Copiar todas as partidas da NYN201 para TESTE, mantendo start_at original UTC
-- (não precisamos alterar o start_at para fazer testes do fallback)
INSERT INTO matches (
  id,
  session_id,
  round,
  status,
  teams,
  next_teams,
  winner,
  started_at,
  finished_at,
  rounds_out_reset_at
  -- streak_reset_at será null na cópia, representando a mesma condição
)
SELECT
  gen_random_uuid() AS id,
  (SELECT id FROM teste_session) AS session_id,
  round,
  status,
  teams,
  next_teams,
  winner,
  started_at,
  finished_at,
  rounds_out_reset_at
FROM matches AS nyn201_matches
WHERE session_id = (SELECT id FROM sessions WHERE code = 'NYN201')
  AND status != 'cancelled'  -- pendências e canceladas opcionalmente
ON CONFLICT DO NOTHING;

-- 4. Contar quantas partidas foram copiadas
SELECT
  (SELECT COUNT(*) FROM matches WHERE session_id = (SELECT id FROM teste_session)) AS total_matches_copied,
  (SELECT COUNT(*) FROM matches WHERE session_id = (SELECT id FROM sessions WHERE code = 'NYN201')) AS nyn201_total_matches;

-- 5. Verificar estrutura e integridade
SELECT
  s.id,
  s.code,
  s.name,
  s.status,
  s.stats_reset_at,
  COUNT(m.id) as match_count
FROM sessions s
LEFT JOIN matches m ON m.session_id = s.id
WHERE s.code = 'TESTE'
GROUP BY s.id, s.code, s.name, s.status, s.stats_reset_at;

-- ---------------------------------------------------------------------------
-- Notas:
-- - A nova cópia mantém stats_reset_at = NULL, simulando a sessão legada que
--   causava "números estranhos" no contador (contagem global em vez de seu dia).
-- - Os dados originais (NYN201) permanecem intactos.
-- - Para rollback, use scripts/cleanup-teste.sql (opcional).
--------------------------------------------------------------------------------
