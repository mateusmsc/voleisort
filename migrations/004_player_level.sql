-- Fase 1 — Infraestrutura de dados: nível do jogador
-- Aplicar no Supabase via SQL Editor

ALTER TABLE players ADD COLUMN IF NOT EXISTS level numeric DEFAULT 3;
