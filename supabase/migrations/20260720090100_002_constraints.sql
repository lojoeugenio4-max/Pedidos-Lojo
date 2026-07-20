-- Cash Lojo: migración incremental de STAGING a PRODUCCIÓN
-- Solo estructura. No copia datos de staging.
-- Conserva todas las filas existentes en producción.
-- Generado a partir de los dumps aportados por el usuario.

BEGIN;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bingo_cards_edition_id_cliente_id_key'
      AND conrelid = '"public"."bingo_cards"'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."bingo_cards"
    ADD CONSTRAINT "bingo_cards_edition_id_cliente_id_key" UNIQUE ("edition_id", "cliente_id");
  END IF;
END
$migration$;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bingo_cards_pkey'
      AND conrelid = '"public"."bingo_cards"'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."bingo_cards"
    ADD CONSTRAINT "bingo_cards_pkey" PRIMARY KEY ("id");
  END IF;
END
$migration$;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bingo_cartones_pkey'
      AND conrelid = '"public"."bingo_cartones"'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."bingo_cartones"
    ADD CONSTRAINT "bingo_cartones_pkey" PRIMARY KEY ("id");
  END IF;
END
$migration$;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bingo_draws_edition_id_number_key'
      AND conrelid = '"public"."bingo_draws"'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."bingo_draws"
    ADD CONSTRAINT "bingo_draws_edition_id_number_key" UNIQUE ("edition_id", "number");
  END IF;
END
$migration$;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bingo_draws_pkey'
      AND conrelid = '"public"."bingo_draws"'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."bingo_draws"
    ADD CONSTRAINT "bingo_draws_pkey" PRIMARY KEY ("id");
  END IF;
END
$migration$;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bingo_entitlements_edition_id_cliente_id_key'
      AND conrelid = '"public"."bingo_entitlements"'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."bingo_entitlements"
    ADD CONSTRAINT "bingo_entitlements_edition_id_cliente_id_key" UNIQUE ("edition_id", "cliente_id");
  END IF;
END
$migration$;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bingo_entitlements_pkey'
      AND conrelid = '"public"."bingo_entitlements"'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."bingo_entitlements"
    ADD CONSTRAINT "bingo_entitlements_pkey" PRIMARY KEY ("id");
  END IF;
END
$migration$;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bingo_entitlements_promotion_id_order_id_key'
      AND conrelid = '"public"."bingo_entitlements"'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."bingo_entitlements"
    ADD CONSTRAINT "bingo_entitlements_promotion_id_order_id_key" UNIQUE ("promotion_id", "order_id");
  END IF;
END
$migration$;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bingo_games_pkey'
      AND conrelid = '"public"."bingo_games"'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."bingo_games"
    ADD CONSTRAINT "bingo_games_pkey" PRIMARY KEY ("id");
  END IF;
END
$migration$;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'clientes_favoritos_cliente_articulo_unique'
      AND conrelid = '"public"."clientes_favoritos"'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."clientes_favoritos"
    ADD CONSTRAINT "clientes_favoritos_cliente_articulo_unique" UNIQUE ("cliente_id", "articulo_id");
  END IF;
END
$migration$;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'clientes_favoritos_pkey'
      AND conrelid = '"public"."clientes_favoritos"'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."clientes_favoritos"
    ADD CONSTRAINT "clientes_favoritos_pkey" PRIMARY KEY ("id");
  END IF;
END
$migration$;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'clientes_pkey'
      AND conrelid = '"public"."clientes"'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."clientes"
    ADD CONSTRAINT "clientes_pkey" PRIMARY KEY ("id");
  END IF;
END
$migration$;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'clientes_token_key'
      AND conrelid = '"public"."clientes"'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."clientes"
    ADD CONSTRAINT "clientes_token_key" UNIQUE ("token");
  END IF;
END
$migration$;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'game_entitlements_code_key'
      AND conrelid = '"public"."game_entitlements"'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."game_entitlements"
    ADD CONSTRAINT "game_entitlements_code_key" UNIQUE ("code");
  END IF;
END
$migration$;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'game_entitlements_order_id_key'
      AND conrelid = '"public"."game_entitlements"'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."game_entitlements"
    ADD CONSTRAINT "game_entitlements_order_id_key" UNIQUE ("order_id");
  END IF;
END
$migration$;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'game_entitlements_pkey'
      AND conrelid = '"public"."game_entitlements"'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."game_entitlements"
    ADD CONSTRAINT "game_entitlements_pkey" PRIMARY KEY ("id");
  END IF;
END
$migration$;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'promociones_bingo_articulos_pkey'
      AND conrelid = '"public"."promociones_bingo_articulos"'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."promociones_bingo_articulos"
    ADD CONSTRAINT "promociones_bingo_articulos_pkey" PRIMARY KEY ("id");
  END IF;
END
$migration$;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'promociones_bingo_articulos_promocion_id_codigo_articulo_key'
      AND conrelid = '"public"."promociones_bingo_articulos"'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."promociones_bingo_articulos"
    ADD CONSTRAINT "promociones_bingo_articulos_promocion_id_codigo_articulo_key" UNIQUE ("promocion_id", "codigo_articulo");
  END IF;
END
$migration$;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'promociones_bingo_pkey'
      AND conrelid = '"public"."promociones_bingo"'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."promociones_bingo"
    ADD CONSTRAINT "promociones_bingo_pkey" PRIMARY KEY ("id");
  END IF;
END
$migration$;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bingo_cards_cliente_id_fkey'
      AND conrelid = '"public"."bingo_cards"'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."bingo_cards"
    ADD CONSTRAINT "bingo_cards_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE CASCADE;
  END IF;
END
$migration$;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bingo_cards_entitlement_id_fkey'
      AND conrelid = '"public"."bingo_cards"'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."bingo_cards"
    ADD CONSTRAINT "bingo_cards_entitlement_id_fkey" FOREIGN KEY ("entitlement_id") REFERENCES "public"."bingo_entitlements"("id") ON DELETE CASCADE;
  END IF;
END
$migration$;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bingo_cards_promotion_id_fkey'
      AND conrelid = '"public"."bingo_cards"'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."bingo_cards"
    ADD CONSTRAINT "bingo_cards_promotion_id_fkey" FOREIGN KEY ("promotion_id") REFERENCES "public"."promociones_bingo"("id") ON DELETE CASCADE;
  END IF;
END
$migration$;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bingo_cartones_cliente_id_fkey'
      AND conrelid = '"public"."bingo_cartones"'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."bingo_cartones"
    ADD CONSTRAINT "bingo_cartones_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE CASCADE;
  END IF;
END
$migration$;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bingo_draws_promotion_id_fkey'
      AND conrelid = '"public"."bingo_draws"'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."bingo_draws"
    ADD CONSTRAINT "bingo_draws_promotion_id_fkey" FOREIGN KEY ("promotion_id") REFERENCES "public"."promociones_bingo"("id") ON DELETE CASCADE;
  END IF;
END
$migration$;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bingo_entitlements_cliente_id_fkey'
      AND conrelid = '"public"."bingo_entitlements"'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."bingo_entitlements"
    ADD CONSTRAINT "bingo_entitlements_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE CASCADE;
  END IF;
END
$migration$;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bingo_entitlements_promotion_id_fkey'
      AND conrelid = '"public"."bingo_entitlements"'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."bingo_entitlements"
    ADD CONSTRAINT "bingo_entitlements_promotion_id_fkey" FOREIGN KEY ("promotion_id") REFERENCES "public"."promociones_bingo"("id") ON DELETE CASCADE;
  END IF;
END
$migration$;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bingo_games_participation_id_fkey'
      AND conrelid = '"public"."bingo_games"'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."bingo_games"
    ADD CONSTRAINT "bingo_games_participation_id_fkey" FOREIGN KEY ("created_from_participation_id") REFERENCES "public"."promotion_participations"("id") ON DELETE SET NULL;
  END IF;
END
$migration$;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'clientes_favoritos_cliente_id_fkey'
      AND conrelid = '"public"."clientes_favoritos"'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."clientes_favoritos"
    ADD CONSTRAINT "clientes_favoritos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE CASCADE;
  END IF;
END
$migration$;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'promociones_bingo_articulos_articulo_id_fkey'
      AND conrelid = '"public"."promociones_bingo_articulos"'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."promociones_bingo_articulos"
    ADD CONSTRAINT "promociones_bingo_articulos_articulo_id_fkey" FOREIGN KEY ("articulo_id") REFERENCES "public"."articulos"("id") ON DELETE CASCADE;
  END IF;
END
$migration$;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'promociones_bingo_articulos_promocion_id_fkey'
      AND conrelid = '"public"."promociones_bingo_articulos"'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."promociones_bingo_articulos"
    ADD CONSTRAINT "promociones_bingo_articulos_promocion_id_fkey" FOREIGN KEY ("promocion_id") REFERENCES "public"."promociones_bingo"("id") ON DELETE CASCADE;
  END IF;
END
$migration$;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'promotion_participations_bingo_game_id_fkey'
      AND conrelid = '"public"."promotion_participations"'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."promotion_participations"
    ADD CONSTRAINT "promotion_participations_bingo_game_id_fkey" FOREIGN KEY ("bingo_game_id") REFERENCES "public"."bingo_games"("id") ON DELETE SET NULL;
  END IF;
END
$migration$;

COMMIT;
