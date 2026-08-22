-- ---------------------------------------------------------------------------
-- Limpeza da sessão TESTE em produção
-- ---------------------------------------------------------------------------
-- Este script apaga a sessão TESTE e suas partidas associadas. Use apenas se
-- deseja limpar o ambiente de teste para nova execução do clone.
--------------------------------------------------------------------------------

-- 1. Primeiro, retirar matches da sessão TESTE (foreign key não restringe mas é boa prática)
DELETE FROM matches WHERE session_id = (
  SELECT id FROM sessions WHERE code = 'TESTE'
);

-- 2. Verificar quantos matches foram deletados
SELECT (SELECT COUNT(*) FROM matches WHERE session_id = (SELECT id FROM sessions WHERE code = 'TESTE')) AS deleted_matches;

-- 3. Remover a sessão TESTE
DELETE FROM sessions WHERE code = 'TESTE';

-- 4. Confirmar que está limpo
SELECT COUNT(*) AS remaining_teste_session FROM sessions WHERE code = 'TESTE';
