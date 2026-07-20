-- Cash Lojo: migración incremental de STAGING a PRODUCCIÓN
-- Solo estructura. No copia datos de staging.
-- Conserva todas las filas existentes en producción.
-- Generado a partir de los dumps aportados por el usuario.

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS "bingo_games_one_active_per_customer" ON "public"."bingo_games" USING "btree" ("customer_phone") WHERE ("status" = 'active'::"text");

CREATE UNIQUE INDEX IF NOT EXISTS "bingo_un_carton_activo_por_cliente" ON "public"."bingo_cartones" USING "btree" ("cliente_id") WHERE ("estado" = 'activo'::"text");

CREATE INDEX IF NOT EXISTS "clientes_favoritos_cliente_idx" ON "public"."clientes_favoritos" USING "btree" ("cliente_id");

CREATE INDEX IF NOT EXISTS "clientes_nombre_idx" ON "public"."clientes" USING "btree" ("nombre");

CREATE INDEX IF NOT EXISTS "clientes_telefono_idx" ON "public"."clientes" USING "btree" ("telefono");

CREATE UNIQUE INDEX IF NOT EXISTS "clientes_token_idx" ON "public"."clientes" USING "btree" ("token");

CREATE INDEX IF NOT EXISTS "game_entitlements_code_idx" ON "public"."game_entitlements" USING "btree" ("code");

CREATE INDEX IF NOT EXISTS "game_entitlements_customer_token_idx" ON "public"."game_entitlements" USING "btree" ("customer_token");

CREATE INDEX IF NOT EXISTS "promociones_bingo_articulos_promocion_idx" ON "public"."promociones_bingo_articulos" USING "btree" ("promocion_id");

COMMIT;
