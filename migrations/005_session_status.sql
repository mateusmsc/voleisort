-- Fase 6: adiciona coluna status às sessões
-- Aplicar no Supabase via SQL Editor

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';
