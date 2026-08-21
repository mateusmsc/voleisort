-- RoundsOut confiável: snapshot dos participantes originais da partida
-- (teams.A + teams.B + nextTeams no momento da criação). Usado para
-- distinguir "ficou de fora" de "chegou depois" mesmo no primeiro dia.

ALTER TABLE matches ADD COLUMN IF NOT EXISTS original_participant_ids uuid[];
