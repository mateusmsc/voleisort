-- Painel: marca o início da janela de estatísticas do dia.
-- finishSession grava o timestamp; o painel finished mostra apenas
-- partidas com started_at > stats_reset_at.

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS stats_reset_at timestamptz;
