-- Cash Lojo: migración incremental de STAGING a PRODUCCIÓN
-- Solo estructura. No copia datos de staging.
-- Conserva todas las filas existentes en producción.
-- Generado a partir de los dumps aportados por el usuario.

BEGIN;

DROP TRIGGER IF EXISTS "bingo_games_keep_last_two_completed" ON "public"."bingo_games";
CREATE OR REPLACE TRIGGER "bingo_games_keep_last_two_completed" AFTER INSERT OR UPDATE OF "status", "completed_at" ON "public"."bingo_games" FOR EACH ROW EXECUTE FUNCTION "public"."keep_last_two_completed_bingo_games"();

DROP TRIGGER IF EXISTS "clientes_updated_at" ON "public"."clientes";
CREATE OR REPLACE TRIGGER "clientes_updated_at" BEFORE UPDATE ON "public"."clientes" FOR EACH ROW EXECUTE FUNCTION "public"."actualizar_updated_at_clientes"();

DROP TRIGGER IF EXISTS "promotion_participation_create_bingo" ON "public"."promotion_participations";
CREATE OR REPLACE TRIGGER "promotion_participation_create_bingo" AFTER INSERT ON "public"."promotion_participations" FOR EACH ROW EXECUTE FUNCTION "public"."attach_bingo_game_to_participation"();

COMMIT;
