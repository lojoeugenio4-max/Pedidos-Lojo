-- Cash Lojo: migración incremental de STAGING a PRODUCCIÓN
-- Solo estructura. No copia datos de staging.
-- Conserva todas las filas existentes en producción.
-- Generado a partir de los dumps aportados por el usuario.

-- Ejecutar DESPUÉS de aplicar las migraciones. Solo lectura.

-- Tablas que deben existir
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Columnas añadidas a promotion_participations
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema='public' AND table_name='promotion_participations'
  AND column_name IN ('bingo_game_id','bingo_plays_total','bingo_plays_used')
ORDER BY column_name;

-- Recuento de objetos principales
SELECT 'tables' AS object_type, count(*)::bigint AS total
FROM information_schema.tables WHERE table_schema='public'
UNION ALL
SELECT 'functions', count(*) FROM information_schema.routines WHERE routine_schema='public'
UNION ALL
SELECT 'policies', count(*) FROM pg_policies WHERE schemaname='public'
UNION ALL
SELECT 'indexes', count(*) FROM pg_indexes WHERE schemaname='public';

-- Confirmar que la tabla exclusiva de producción sigue existiendo
SELECT to_regclass('public.promotion_spins') AS production_only_table_preserved;
