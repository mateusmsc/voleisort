-- =============================================================================
-- dev_setup.sql — Setup completo do banco de desenvolvimento
--
-- Executar no Supabase SQL Editor:
--   https://supabase.com/dashboard/project/mmdwggvyalmoqmrbhfqo/sql/new
--
-- Idempotente: seguro para rodar múltiplas vezes.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 001 — Schema inicial
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.players (
  id          uuid        PRIMARY KEY,
  name        text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  stats       jsonb       NOT NULL DEFAULT '{"matches": 0, "wins": 0, "losses": 0}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.sessions (
  id               uuid        PRIMARY KEY,
  code             text        NOT NULL,
  name             text        NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  config           jsonb       NOT NULL DEFAULT '{}'::jsonb,
  player_ids       uuid[]      NOT NULL DEFAULT '{}',
  checked_in_ids   uuid[]      NOT NULL DEFAULT '{}',
  match_ids        uuid[]      NOT NULL DEFAULT '{}'
);

CREATE UNIQUE INDEX IF NOT EXISTS sessions_code_unique ON public.sessions (code);

CREATE TABLE IF NOT EXISTS public.matches (
  id                    uuid        PRIMARY KEY,
  session_id            uuid        NOT NULL REFERENCES public.sessions (id) ON DELETE CASCADE,
  round                 integer     NOT NULL,
  status                text        NOT NULL DEFAULT 'ongoing'
                          CHECK (status IN ('ongoing', 'finished', 'cancelled')),
  teams                 jsonb       NOT NULL DEFAULT '{"A": [], "B": []}'::jsonb,
  next_teams            jsonb       NOT NULL DEFAULT '[]'::jsonb,
  winner                text        CHECK (winner IN ('A', 'B')),
  started_at            timestamptz NOT NULL DEFAULT now(),
  finished_at           timestamptz,
  rounds_out_reset_at   integer
);

CREATE INDEX IF NOT EXISTS matches_session_id_idx ON public.matches (session_id, round);


-- ---------------------------------------------------------------------------
-- 002 — Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE public.players  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches  ENABLE ROW LEVEL SECURITY;

-- players
DROP POLICY IF EXISTS "players_select" ON public.players;
CREATE POLICY "players_select"
  ON public.players FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "players_insert" ON public.players;
CREATE POLICY "players_insert"
  ON public.players FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "players_update" ON public.players;
CREATE POLICY "players_update"
  ON public.players FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "players_delete" ON public.players;
CREATE POLICY "players_delete"
  ON public.players FOR DELETE TO authenticated USING (true);

-- sessions
DROP POLICY IF EXISTS "sessions_select" ON public.sessions;
CREATE POLICY "sessions_select"
  ON public.sessions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "sessions_insert" ON public.sessions;
CREATE POLICY "sessions_insert"
  ON public.sessions FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "sessions_update" ON public.sessions;
CREATE POLICY "sessions_update"
  ON public.sessions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "sessions_delete" ON public.sessions;
CREATE POLICY "sessions_delete"
  ON public.sessions FOR DELETE TO authenticated USING (true);

-- matches
DROP POLICY IF EXISTS "matches_select" ON public.matches;
CREATE POLICY "matches_select"
  ON public.matches FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "matches_insert" ON public.matches;
CREATE POLICY "matches_insert"
  ON public.matches FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "matches_update" ON public.matches;
CREATE POLICY "matches_update"
  ON public.matches FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "matches_delete" ON public.matches;
CREATE POLICY "matches_delete"
  ON public.matches FOR DELETE TO authenticated USING (true);


-- ---------------------------------------------------------------------------
-- 004 — Fase 1: coluna level nos jogadores
-- ---------------------------------------------------------------------------

ALTER TABLE public.players ADD COLUMN IF NOT EXISTS level numeric DEFAULT 3;


-- ---------------------------------------------------------------------------
-- 005 — Fase 6: coluna status nas sessões
-- ---------------------------------------------------------------------------

ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';


-- ---------------------------------------------------------------------------
-- 006 — Painel público: coluna panel_hash nas sessões
-- ---------------------------------------------------------------------------

ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS panel_hash text;

CREATE UNIQUE INDEX IF NOT EXISTS sessions_panel_hash_unique ON public.sessions (panel_hash);


-- ---------------------------------------------------------------------------
-- 007 — Grants para PostgREST (necessário no Supabase CLI local; na nuvem é
--       automático via default privileges)
-- ---------------------------------------------------------------------------

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;


-- ---------------------------------------------------------------------------
-- 008 — Painel: janela de estatísticas do dia (stats_reset_at)
-- ---------------------------------------------------------------------------

ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS stats_reset_at timestamptz;


-- ---------------------------------------------------------------------------
-- 009 — RoundsOut: participantes originais da partida
-- ---------------------------------------------------------------------------

ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS original_participant_ids uuid[];


-- ---------------------------------------------------------------------------
-- Verificação final
-- ---------------------------------------------------------------------------

SELECT
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns c
   WHERE c.table_name = t.table_name AND c.table_schema = 'public') AS col_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_name IN ('players', 'sessions', 'matches')
ORDER BY table_name;
