-- Painel público: adiciona coluna panel_hash às sessões
-- Aplicar no Supabase via SQL Editor

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS panel_hash text;

CREATE UNIQUE INDEX IF NOT EXISTS sessions_panel_hash_unique ON sessions (panel_hash);
