-- Cash Lojo: migración incremental de STAGING a PRODUCCIÓN
-- Solo estructura. No copia datos de staging.
-- Conserva todas las filas existentes en producción.
-- Generado a partir de los dumps aportados por el usuario.

BEGIN;

ALTER TABLE "public"."bingo_cards" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."bingo_cartones" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."bingo_draws" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."bingo_entitlements" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."clientes" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."clientes_favoritos" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."game_entitlements" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."promociones_bingo" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."promociones_bingo_articulos" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clientes_delete_anon" ON "public"."clientes";
CREATE POLICY "clientes_delete_anon" ON "public"."clientes" FOR DELETE TO "anon" USING (true);

DROP POLICY IF EXISTS "clientes_favoritos_delete_anon" ON "public"."clientes_favoritos";
CREATE POLICY "clientes_favoritos_delete_anon" ON "public"."clientes_favoritos" FOR DELETE TO "anon" USING (true);

DROP POLICY IF EXISTS "clientes_favoritos_insert_anon" ON "public"."clientes_favoritos";
CREATE POLICY "clientes_favoritos_insert_anon" ON "public"."clientes_favoritos" FOR INSERT TO "anon" WITH CHECK (true);

DROP POLICY IF EXISTS "clientes_favoritos_select_anon" ON "public"."clientes_favoritos";
CREATE POLICY "clientes_favoritos_select_anon" ON "public"."clientes_favoritos" FOR SELECT TO "anon" USING (true);

DROP POLICY IF EXISTS "clientes_insert_anon" ON "public"."clientes";
CREATE POLICY "clientes_insert_anon" ON "public"."clientes" FOR INSERT TO "anon" WITH CHECK (true);

DROP POLICY IF EXISTS "clientes_select_anon" ON "public"."clientes";
CREATE POLICY "clientes_select_anon" ON "public"."clientes" FOR SELECT TO "anon" USING (true);

DROP POLICY IF EXISTS "clientes_update_anon" ON "public"."clientes";
CREATE POLICY "clientes_update_anon" ON "public"."clientes" FOR UPDATE TO "anon" USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "promociones_bingo_articulos_escritura" ON "public"."promociones_bingo_articulos";
CREATE POLICY "promociones_bingo_articulos_escritura" ON "public"."promociones_bingo_articulos" TO "authenticated", "anon" USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "promociones_bingo_articulos_lectura" ON "public"."promociones_bingo_articulos";
CREATE POLICY "promociones_bingo_articulos_lectura" ON "public"."promociones_bingo_articulos" FOR SELECT TO "authenticated", "anon" USING (true);

DROP POLICY IF EXISTS "promociones_bingo_escritura" ON "public"."promociones_bingo";
CREATE POLICY "promociones_bingo_escritura" ON "public"."promociones_bingo" TO "authenticated", "anon" USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "promociones_bingo_lectura" ON "public"."promociones_bingo";
CREATE POLICY "promociones_bingo_lectura" ON "public"."promociones_bingo" FOR SELECT TO "authenticated", "anon" USING (true);

DROP POLICY IF EXISTS "public read bingo draws" ON "public"."bingo_draws";
CREATE POLICY "public read bingo draws" ON "public"."bingo_draws" FOR SELECT USING (true);

COMMIT;
