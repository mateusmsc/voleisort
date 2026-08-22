-- Troca manual com a 1ª próxima: marca a rodada em que as vitórias seguidas
-- foram zeradas (o time que saiu de quadra perde a sequência). O cálculo do
-- winStreak usa max(rounds_out_reset_at, streak_reset_at) como corte.

ALTER TABLE matches ADD COLUMN IF NOT EXISTS streak_reset_at integer;
