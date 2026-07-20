


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';


SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."promotion_participations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "promotion_id" "uuid" NOT NULL,
    "order_id" "uuid",
    "customer_phone" "text",
    "customer_name" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "prize_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "played_at" timestamp with time zone,
    "expires_at" timestamp with time zone,
    "created_by" "text",
    "used_by" "text",
    "notes" "text",
    "spins_total" integer DEFAULT 1 NOT NULL,
    "spins_used" integer DEFAULT 0 NOT NULL,
    "is_permanent" boolean DEFAULT false NOT NULL,
    CONSTRAINT "promotion_participations_played_at_check" CHECK (((("status" = 'played'::"text") AND ("played_at" IS NOT NULL)) OR (("status" <> 'played'::"text") AND ("played_at" IS NULL)))),
    CONSTRAINT "promotion_participations_prize_check" CHECK (((("status" = 'played'::"text") AND ("prize_id" IS NOT NULL)) OR (("status" <> 'played'::"text") AND ("prize_id" IS NULL)))),
    CONSTRAINT "promotion_participations_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'played'::"text", 'expired'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."promotion_participations" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_promotion_participation"("p_promotion_id" "uuid", "p_order_id" "uuid" DEFAULT NULL::"uuid", "p_customer_phone" "text" DEFAULT NULL::"text", "p_customer_name" "text" DEFAULT NULL::"text", "p_expires_at" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_created_by" "text" DEFAULT 'system'::"text") RETURNS "public"."promotion_participations"
    LANGUAGE "plpgsql"
    AS $$
declare
    new_row public.promotion_participations;
begin
    insert into public.promotion_participations (
        code,
        promotion_id,
        order_id,
        customer_phone,
        customer_name,
        expires_at,
        created_by,
        status
    )
    values (
        public.generate_promotion_code(),
        p_promotion_id,
        p_order_id,
        p_customer_phone,
        p_customer_name,
        p_expires_at,
        p_created_by,
        'pending'
    )
    returning *
    into new_row;

    return new_row;
end;
$$;


ALTER FUNCTION "public"."create_promotion_participation"("p_promotion_id" "uuid", "p_order_id" "uuid", "p_customer_phone" "text", "p_customer_name" "text", "p_expires_at" timestamp with time zone, "p_created_by" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_promotion_code"() RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$declare
    chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    result text;
    i int;
    exists_code boolean;
begin
    loop
        result := 'LJ';

        for i in 1..6 loop
            result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
        end loop;

        select exists (
            select 1
            from public.promotion_participations
            where code = result
        )
        into exists_code;

        exit when not exists_code;
    end loop;

    return result;
end;$$;


ALTER FUNCTION "public"."generate_promotion_code"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."play_promotion_participation"("p_code" "text", "p_used_by" "text" DEFAULT 'tienda'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_entry public.promotion_participations;
  v_prize public.promociones_ruleta_premios;
  v_total numeric;
  v_draw numeric;
begin
  select *
  into v_entry
  from public.promotion_participations
  where code = upper(trim(p_code))
  for update;

  if v_entry.id is null then
    raise exception 'Código no encontrado';
  end if;

  if v_entry.status <> 'pending' then
    raise exception 'Código ya utilizado o no disponible';
  end if;

  if v_entry.expires_at is not null and v_entry.expires_at <= now() then
    update public.promotion_participations
    set status = 'expired'
    where id = v_entry.id;

    raise exception 'Código caducado';
  end if;

  select sum(greatest(coalesce(probabilidad, 0), 0))
  into v_total
  from public.promociones_ruleta_premios
  where promocion_id = v_entry.promotion_id
    and activo = true;

  if coalesce(v_total, 0) <= 0 then
    raise exception 'No hay premios activos con probabilidad mayor que 0';
  end if;

  v_draw := random() * v_total;

  with premios_ponderados as (
    select
      p.*,
      sum(greatest(coalesce(p.probabilidad, 0), 0)) over (
        order by p.orden asc nulls last, p.created_at asc, p.id asc
      ) as acumulado
    from public.promociones_ruleta_premios p
    where p.promocion_id = v_entry.promotion_id
      and p.activo = true
      and greatest(coalesce(p.probabilidad, 0), 0) > 0
  )
  select *
  into v_prize
  from premios_ponderados
  where acumulado >= v_draw
  order by acumulado asc
  limit 1;

  if v_prize.id is null then
    select *
    into v_prize
    from public.promociones_ruleta_premios
    where promocion_id = v_entry.promotion_id
      and activo = true
      and greatest(coalesce(probabilidad, 0), 0) > 0
    order by orden desc nulls last, created_at desc, id desc
    limit 1;
  end if;

  update public.promotion_participations
  set
    status = 'played',
    prize_id = v_prize.id,
    played_at = now(),
    used_by = p_used_by
  where id = v_entry.id
    and status = 'pending'
  returning *
  into v_entry;

  if v_entry.id is null then
    raise exception 'Código ya utilizado';
  end if;

  return jsonb_build_object(
    'entry', to_jsonb(v_entry),
    'prize', to_jsonb(v_prize)
  );
end;
$$;


ALTER FUNCTION "public"."play_promotion_participation"("p_code" "text", "p_used_by" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."register_promotion_spin"("p_participation_id" "uuid", "p_prize_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_participation public.promotion_participations%rowtype;
  v_spin public.promotion_spins%rowtype;
  v_spin_number integer;
  v_new_spins_used integer;
begin
  select *
    into v_participation
  from public.promotion_participations
  where id = p_participation_id
  for update;

  if not found then
    raise exception 'No se encontró la participación';
  end if;

  if coalesce(v_participation.spins_used, 0)
       >= greatest(coalesce(v_participation.spins_total, 1), 1) then
    raise exception 'Esta participación no tiene tiradas disponibles';
  end if;

  v_spin_number := coalesce(v_participation.spins_used, 0) + 1;
  v_new_spins_used := v_spin_number;

  insert into public.promotion_spins (
    participation_id,
    spin_number,
    prize_id,
    played_at
  )
  values (
    v_participation.id,
    v_spin_number,
    p_prize_id,
    now()
  )
  returning * into v_spin;

  update public.promotion_participations
  set
    spins_used = v_new_spins_used,
    status = case
      when v_new_spins_used >= greatest(coalesce(spins_total, 1), 1)
        then 'played'
      else 'pending'
    end,

    played_at = case
      when v_new_spins_used >= greatest(coalesce(spins_total, 1), 1)
        then now()
      else null
    end,

    prize_id = case
      when v_new_spins_used >= greatest(coalesce(spins_total, 1), 1)
        then p_prize_id
      else null
    end,

    updated_at = now()
  where id = v_participation.id;

  return jsonb_build_object(
    'spin', to_jsonb(v_spin),
    'spins_total', greatest(coalesce(v_participation.spins_total, 1), 1),
    'spins_used', v_new_spins_used,
    'spins_remaining',
      greatest(coalesce(v_participation.spins_total, 1), 1)
      - v_new_spins_used
  );
end;
$$;


ALTER FUNCTION "public"."register_promotion_spin"("p_participation_id" "uuid", "p_prize_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_promotion_participation_spins"("p_participation_id" "uuid" DEFAULT NULL::"uuid", "p_code" "text" DEFAULT NULL::"text", "p_spins_total" integer DEFAULT 1) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_participation public.promotion_participations%rowtype;
  v_total integer := greatest(1, coalesce(p_spins_total, 1));
  v_used integer;
begin
  if p_participation_id is null
     and nullif(trim(p_code), '') is null then
    raise exception
      'Es necesario indicar el id o el código de la participación';
  end if;

  select *
    into v_participation
  from public.promotion_participations
  where
    (p_participation_id is not null and id = p_participation_id)
    or
    (
      p_participation_id is null
      and code = trim(p_code)
    )
  for update;

  if not found then
    raise exception 'No se encontró la participación de ruleta';
  end if;

  v_used := least(
    greatest(coalesce(v_participation.spins_used, 0), 0),
    v_total
  );

  update public.promotion_participations
  set
    spins_total = v_total,
    spins_used = v_used,

    status = case
      when v_used >= v_total then 'played'
      else 'pending'
    end,

    played_at = case
      when v_used >= v_total then played_at
      else null
    end,

    prize_id = case
      when v_used >= v_total then prize_id
      else null
    end,

    updated_at = now()
  where id = v_participation.id
  returning * into v_participation;

  return to_jsonb(v_participation);
end;
$$;


ALTER FUNCTION "public"."set_promotion_participation_spins"("p_participation_id" "uuid", "p_code" "text", "p_spins_total" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
    new.updated_at = now();
    return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."use_promotion_participation"("p_code" "text", "p_prize_id" "uuid", "p_used_by" "text" DEFAULT NULL::"text") RETURNS "public"."promotion_participations"
    LANGUAGE "plpgsql"
    AS $$
declare
    updated_row public.promotion_participations;
begin
    update public.promotion_participations
    set
        status = 'played',
        prize_id = p_prize_id,
        played_at = now(),
        used_by = p_used_by
    where code = upper(trim(p_code))
      and status = 'pending'
      and (expires_at is null or expires_at > now())
    returning *
    into updated_row;

    if updated_row.id is null then
        raise exception 'Código inválido, caducado o ya utilizado';
    end if;

    return updated_row;
end;
$$;


ALTER FUNCTION "public"."use_promotion_participation"("p_code" "text", "p_prize_id" "uuid", "p_used_by" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."articulos" (
    "id" bigint NOT NULL,
    "codigo" integer NOT NULL,
    "nombre" "text" NOT NULL,
    "departamento_id" bigint,
    "precio" numeric,
    "permite_unidades" boolean DEFAULT true,
    "foto" "text",
    "activo" boolean DEFAULT true,
    "novedad" boolean DEFAULT false,
    "oculto" boolean DEFAULT false
);


ALTER TABLE "public"."articulos" OWNER TO "postgres";


ALTER TABLE "public"."articulos" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."articulos_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."departamentos" (
    "id" bigint NOT NULL,
    "nombre" "text" NOT NULL
);


ALTER TABLE "public"."departamentos" OWNER TO "postgres";


ALTER TABLE "public"."departamentos" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."departamentos_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."estadisticas_articulos_dia" (
    "fecha" "date" NOT NULL,
    "articulo_id" bigint NOT NULL,
    "codigo_articulo" "text",
    "nombre_articulo" "text",
    "departamento" "text",
    "cajas" numeric DEFAULT 0,
    "unidades" numeric DEFAULT 0,
    "veces_pedido" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."estadisticas_articulos_dia" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."estadisticas_movimientos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "codigo_articulo" "text",
    "nombre_articulo" "text",
    "departamento" "text",
    "cajas" numeric DEFAULT 0,
    "unidades" numeric DEFAULT 0,
    "pedido_id" "uuid"
);


ALTER TABLE "public"."estadisticas_movimientos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."estadisticas_pedidos_dia" (
    "fecha" "date" NOT NULL,
    "total_pedidos" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."estadisticas_pedidos_dia" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ofertas" (
    "id" bigint NOT NULL,
    "articulo_id" bigint,
    "texto" "text",
    "fecha_inicio" "date",
    "fecha_fin" "date",
    "es_push" boolean DEFAULT false,
    "push_titulo" "text",
    "push_activo" boolean DEFAULT false
);


ALTER TABLE "public"."ofertas" OWNER TO "postgres";


ALTER TABLE "public"."ofertas" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."ofertas_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."promociones_ruleta" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre" "text" DEFAULT 'Promoción ruleta'::"text" NOT NULL,
    "activa" boolean DEFAULT true NOT NULL,
    "mensaje_cliente" "text" DEFAULT 'Tu pedido participa en la ruleta promocional.'::"text",
    "fecha_inicio" "date",
    "fecha_fin" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "variedad_minima" integer DEFAULT 15 NOT NULL
);


ALTER TABLE "public"."promociones_ruleta" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."promociones_ruleta_articulos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "promocion_id" "uuid" NOT NULL,
    "articulo_id" bigint,
    "codigo_articulo" "text" NOT NULL,
    "nombre_articulo" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "cantidad_minima" integer DEFAULT 1 NOT NULL
);


ALTER TABLE "public"."promociones_ruleta_articulos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."promociones_ruleta_departamentos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "promocion_id" "uuid" NOT NULL,
    "departamento_id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."promociones_ruleta_departamentos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."promociones_ruleta_giros" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "premio_id" "uuid",
    "premio_nombre" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."promociones_ruleta_giros" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."promociones_ruleta_premios" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre" "text" NOT NULL,
    "color" "text" DEFAULT '#f59e0b'::"text" NOT NULL,
    "probabilidad" numeric DEFAULT 0 NOT NULL,
    "stock" integer,
    "activo" boolean DEFAULT true NOT NULL,
    "orden" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "promocion_id" "uuid",
    "tipo_sonido" "text" DEFAULT 'campana'::"text" NOT NULL,
    "imagen_url" "text",
    "articulo_id" bigint,
    CONSTRAINT "promociones_ruleta_premios_tipo_sonido_check" CHECK (("tipo_sonido" = ANY (ARRAY['normal'::"text", 'campana'::"text", 'sirena'::"text", 'jackpot'::"text"])))
);


ALTER TABLE "public"."promociones_ruleta_premios" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."promociones_ruleta_tiradas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "promocion_id" "uuid",
    "premio_id" "uuid",
    "premio_nombre" "text",
    "cliente" "text",
    "cajas_validas" integer,
    "pedido_json" "jsonb",
    "ip" "text",
    "user_agent" "text"
);


ALTER TABLE "public"."promociones_ruleta_tiradas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."promotion_spins" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "participation_id" "uuid" NOT NULL,
    "spin_number" integer NOT NULL,
    "prize_id" "uuid",
    "played_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "promotion_spins_spin_number_check" CHECK (("spin_number" > 0))
);


ALTER TABLE "public"."promotion_spins" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."push_articulos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "push_id" "uuid",
    "orden" integer NOT NULL,
    "articulo_id" bigint,
    "codigo_articulo" "text",
    "nombre_articulo" "text",
    "texto" "text",
    "imagen_url" "text",
    "comprable" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."push_articulos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."push_calendario" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "push_id" "uuid",
    "fecha" "date" NOT NULL
);


ALTER TABLE "public"."push_calendario" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."push_cliente_visto" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cliente_id" bigint,
    "push_id" "uuid",
    "fecha" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."push_cliente_visto" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."push_ofertas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "titulo" "text" NOT NULL,
    "descripcion" "text",
    "codigo_articulo" "text" NOT NULL,
    "nombre_articulo" "text" NOT NULL,
    "departamento" "text",
    "fecha_inicio" "date" NOT NULL,
    "fecha_fin" "date" NOT NULL,
    "dias_semana" "text"[] DEFAULT '{}'::"text"[],
    "activo" boolean DEFAULT true,
    "creado_en" timestamp without time zone DEFAULT "now"(),
    "articulo_id" bigint,
    "texto" "text",
    "ruta" "text",
    "activa" boolean DEFAULT true,
    "color" "text" DEFAULT '#ea580c'::"text",
    "imagen_url" "text"
);


ALTER TABLE "public"."push_ofertas" OWNER TO "postgres";


ALTER TABLE ONLY "public"."articulos"
    ADD CONSTRAINT "articulos_codigo_key" UNIQUE ("codigo");



ALTER TABLE ONLY "public"."articulos"
    ADD CONSTRAINT "articulos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."departamentos"
    ADD CONSTRAINT "departamentos_nombre_key" UNIQUE ("nombre");



ALTER TABLE ONLY "public"."departamentos"
    ADD CONSTRAINT "departamentos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."estadisticas_articulos_dia"
    ADD CONSTRAINT "estadisticas_articulos_dia_pkey" PRIMARY KEY ("fecha", "articulo_id");



ALTER TABLE ONLY "public"."estadisticas_movimientos"
    ADD CONSTRAINT "estadisticas_movimientos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."estadisticas_pedidos_dia"
    ADD CONSTRAINT "estadisticas_pedidos_dia_pkey" PRIMARY KEY ("fecha");



ALTER TABLE ONLY "public"."ofertas"
    ADD CONSTRAINT "ofertas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."promociones_ruleta_articulos"
    ADD CONSTRAINT "promociones_ruleta_articulos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."promociones_ruleta_articulos"
    ADD CONSTRAINT "promociones_ruleta_articulos_unico" UNIQUE ("promocion_id", "codigo_articulo");



ALTER TABLE ONLY "public"."promociones_ruleta_departamentos"
    ADD CONSTRAINT "promociones_ruleta_departament_promocion_id_departamento_id_key" UNIQUE ("promocion_id", "departamento_id");



ALTER TABLE ONLY "public"."promociones_ruleta_departamentos"
    ADD CONSTRAINT "promociones_ruleta_departamentos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."promociones_ruleta_giros"
    ADD CONSTRAINT "promociones_ruleta_giros_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."promociones_ruleta"
    ADD CONSTRAINT "promociones_ruleta_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."promociones_ruleta_premios"
    ADD CONSTRAINT "promociones_ruleta_premios_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."promociones_ruleta_tiradas"
    ADD CONSTRAINT "promociones_ruleta_tiradas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."promotion_participations"
    ADD CONSTRAINT "promotion_participations_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."promotion_participations"
    ADD CONSTRAINT "promotion_participations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."promotion_spins"
    ADD CONSTRAINT "promotion_spins_participation_spin_unique" UNIQUE ("participation_id", "spin_number");



ALTER TABLE ONLY "public"."promotion_spins"
    ADD CONSTRAINT "promotion_spins_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_articulos"
    ADD CONSTRAINT "push_articulos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_articulos"
    ADD CONSTRAINT "push_articulos_push_id_orden_key" UNIQUE ("push_id", "orden");



ALTER TABLE ONLY "public"."push_calendario"
    ADD CONSTRAINT "push_calendario_fecha_key" UNIQUE ("fecha");



ALTER TABLE ONLY "public"."push_calendario"
    ADD CONSTRAINT "push_calendario_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_cliente_visto"
    ADD CONSTRAINT "push_cliente_visto_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_ofertas"
    ADD CONSTRAINT "push_ofertas_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_promociones_ruleta_activa" ON "public"."promociones_ruleta" USING "btree" ("activa");



CREATE INDEX "idx_promociones_ruleta_articulos_codigo" ON "public"."promociones_ruleta_articulos" USING "btree" ("codigo_articulo");



CREATE INDEX "idx_promociones_ruleta_articulos_promocion" ON "public"."promociones_ruleta_articulos" USING "btree" ("promocion_id");



CREATE INDEX "idx_promotion_participations_code" ON "public"."promotion_participations" USING "btree" ("code");



CREATE INDEX "idx_promotion_participations_created_at" ON "public"."promotion_participations" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_promotion_participations_order_id" ON "public"."promotion_participations" USING "btree" ("order_id");



CREATE INDEX "idx_promotion_participations_promotion_id" ON "public"."promotion_participations" USING "btree" ("promotion_id");



CREATE INDEX "idx_promotion_participations_status" ON "public"."promotion_participations" USING "btree" ("status");



CREATE INDEX "idx_ruleta_tiradas_fecha" ON "public"."promociones_ruleta_tiradas" USING "btree" ("created_at" DESC);



CREATE INDEX "promotion_spins_participation_id_idx" ON "public"."promotion_spins" USING "btree" ("participation_id");



CREATE INDEX "promotion_spins_prize_id_idx" ON "public"."promotion_spins" USING "btree" ("prize_id");



CREATE OR REPLACE TRIGGER "trg_promotion_participations_updated_at" BEFORE UPDATE ON "public"."promotion_participations" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."articulos"
    ADD CONSTRAINT "articulos_departamento_id_fkey" FOREIGN KEY ("departamento_id") REFERENCES "public"."departamentos"("id");



ALTER TABLE ONLY "public"."ofertas"
    ADD CONSTRAINT "ofertas_articulo_id_fkey" FOREIGN KEY ("articulo_id") REFERENCES "public"."articulos"("id");



ALTER TABLE ONLY "public"."promociones_ruleta_articulos"
    ADD CONSTRAINT "promociones_ruleta_articulos_promocion_id_fkey" FOREIGN KEY ("promocion_id") REFERENCES "public"."promociones_ruleta"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."promociones_ruleta_departamentos"
    ADD CONSTRAINT "promociones_ruleta_departamentos_departamento_id_fkey" FOREIGN KEY ("departamento_id") REFERENCES "public"."departamentos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."promociones_ruleta_departamentos"
    ADD CONSTRAINT "promociones_ruleta_departamentos_promocion_id_fkey" FOREIGN KEY ("promocion_id") REFERENCES "public"."promociones_ruleta"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."promociones_ruleta_giros"
    ADD CONSTRAINT "promociones_ruleta_giros_premio_id_fkey" FOREIGN KEY ("premio_id") REFERENCES "public"."promociones_ruleta_premios"("id");



ALTER TABLE ONLY "public"."promociones_ruleta_premios"
    ADD CONSTRAINT "promociones_ruleta_premios_promocion_id_fkey" FOREIGN KEY ("promocion_id") REFERENCES "public"."promociones_ruleta"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."promociones_ruleta_tiradas"
    ADD CONSTRAINT "promociones_ruleta_tiradas_premio_id_fkey" FOREIGN KEY ("premio_id") REFERENCES "public"."promociones_ruleta_premios"("id");



ALTER TABLE ONLY "public"."promociones_ruleta_tiradas"
    ADD CONSTRAINT "promociones_ruleta_tiradas_promocion_id_fkey" FOREIGN KEY ("promocion_id") REFERENCES "public"."promociones_ruleta"("id");



ALTER TABLE ONLY "public"."promotion_spins"
    ADD CONSTRAINT "promotion_spins_participation_id_fkey" FOREIGN KEY ("participation_id") REFERENCES "public"."promotion_participations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."push_articulos"
    ADD CONSTRAINT "push_articulos_push_id_fkey" FOREIGN KEY ("push_id") REFERENCES "public"."push_ofertas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."push_calendario"
    ADD CONSTRAINT "push_calendario_push_id_fkey" FOREIGN KEY ("push_id") REFERENCES "public"."push_ofertas"("id") ON DELETE CASCADE;



CREATE POLICY "Allow insert promotion participations" ON "public"."promotion_participations" FOR INSERT WITH CHECK (true);



CREATE POLICY "Allow read promotion participations" ON "public"."promotion_participations" FOR SELECT USING (true);



CREATE POLICY "Allow update promotion participations" ON "public"."promotion_participations" FOR UPDATE USING (true) WITH CHECK (true);



CREATE POLICY "Public can read promotion spins" ON "public"."promotion_spins" FOR SELECT USING (true);



ALTER TABLE "public"."estadisticas_articulos_dia" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."estadisticas_movimientos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."estadisticas_pedidos_dia" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."promociones_ruleta_tiradas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."promotion_participations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."promotion_spins" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "public_delete_push_articulos" ON "public"."push_articulos" FOR DELETE TO "anon" USING (true);



CREATE POLICY "public_delete_push_calendario" ON "public"."push_calendario" FOR DELETE TO "anon" USING (true);



CREATE POLICY "public_delete_push_ofertas" ON "public"."push_ofertas" FOR DELETE TO "anon" USING (true);



CREATE POLICY "public_insert_estadisticas_articulos_dia" ON "public"."estadisticas_articulos_dia" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "public_insert_estadisticas_movimientos" ON "public"."estadisticas_movimientos" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "public_insert_estadisticas_pedidos_dia" ON "public"."estadisticas_pedidos_dia" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "public_insert_push_articulos" ON "public"."push_articulos" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "public_insert_push_calendario" ON "public"."push_calendario" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "public_insert_push_ofertas" ON "public"."push_ofertas" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "public_read_push_calendario" ON "public"."push_calendario" FOR SELECT TO "anon" USING (true);



CREATE POLICY "public_read_push_ofertas" ON "public"."push_ofertas" FOR SELECT TO "anon" USING (true);



CREATE POLICY "public_select_estadisticas_articulos_dia" ON "public"."estadisticas_articulos_dia" FOR SELECT TO "anon" USING (true);



CREATE POLICY "public_select_estadisticas_movimientos" ON "public"."estadisticas_movimientos" FOR SELECT TO "anon" USING (true);



CREATE POLICY "public_select_estadisticas_pedidos_dia" ON "public"."estadisticas_pedidos_dia" FOR SELECT TO "anon" USING (true);



CREATE POLICY "public_select_push_articulos" ON "public"."push_articulos" FOR SELECT TO "anon" USING (true);



CREATE POLICY "public_update_estadisticas_articulos_dia" ON "public"."estadisticas_articulos_dia" FOR UPDATE TO "anon" USING (true) WITH CHECK (true);



CREATE POLICY "public_update_estadisticas_pedidos_dia" ON "public"."estadisticas_pedidos_dia" FOR UPDATE TO "anon" USING (true) WITH CHECK (true);



CREATE POLICY "public_update_push_articulos" ON "public"."push_articulos" FOR UPDATE TO "anon" USING (true) WITH CHECK (true);



CREATE POLICY "public_update_push_calendario" ON "public"."push_calendario" FOR UPDATE TO "anon" USING (true) WITH CHECK (true);



CREATE POLICY "public_update_push_ofertas" ON "public"."push_ofertas" FOR UPDATE TO "anon" USING (true) WITH CHECK (true);



ALTER TABLE "public"."push_articulos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."push_calendario" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."push_cliente_visto" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."push_ofertas" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON TABLE "public"."promotion_participations" TO "anon";
GRANT ALL ON TABLE "public"."promotion_participations" TO "authenticated";
GRANT ALL ON TABLE "public"."promotion_participations" TO "service_role";



GRANT ALL ON FUNCTION "public"."create_promotion_participation"("p_promotion_id" "uuid", "p_order_id" "uuid", "p_customer_phone" "text", "p_customer_name" "text", "p_expires_at" timestamp with time zone, "p_created_by" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_promotion_participation"("p_promotion_id" "uuid", "p_order_id" "uuid", "p_customer_phone" "text", "p_customer_name" "text", "p_expires_at" timestamp with time zone, "p_created_by" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_promotion_participation"("p_promotion_id" "uuid", "p_order_id" "uuid", "p_customer_phone" "text", "p_customer_name" "text", "p_expires_at" timestamp with time zone, "p_created_by" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_promotion_code"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_promotion_code"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_promotion_code"() TO "service_role";



GRANT ALL ON FUNCTION "public"."play_promotion_participation"("p_code" "text", "p_used_by" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."play_promotion_participation"("p_code" "text", "p_used_by" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."play_promotion_participation"("p_code" "text", "p_used_by" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."register_promotion_spin"("p_participation_id" "uuid", "p_prize_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."register_promotion_spin"("p_participation_id" "uuid", "p_prize_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."register_promotion_spin"("p_participation_id" "uuid", "p_prize_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."register_promotion_spin"("p_participation_id" "uuid", "p_prize_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_promotion_participation_spins"("p_participation_id" "uuid", "p_code" "text", "p_spins_total" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."set_promotion_participation_spins"("p_participation_id" "uuid", "p_code" "text", "p_spins_total" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_promotion_participation_spins"("p_participation_id" "uuid", "p_code" "text", "p_spins_total" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."use_promotion_participation"("p_code" "text", "p_prize_id" "uuid", "p_used_by" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."use_promotion_participation"("p_code" "text", "p_prize_id" "uuid", "p_used_by" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."use_promotion_participation"("p_code" "text", "p_prize_id" "uuid", "p_used_by" "text") TO "service_role";



GRANT ALL ON TABLE "public"."articulos" TO "anon";
GRANT ALL ON TABLE "public"."articulos" TO "authenticated";
GRANT ALL ON TABLE "public"."articulos" TO "service_role";



GRANT ALL ON SEQUENCE "public"."articulos_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."articulos_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."articulos_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."departamentos" TO "anon";
GRANT ALL ON TABLE "public"."departamentos" TO "authenticated";
GRANT ALL ON TABLE "public"."departamentos" TO "service_role";



GRANT ALL ON SEQUENCE "public"."departamentos_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."departamentos_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."departamentos_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."estadisticas_articulos_dia" TO "anon";
GRANT ALL ON TABLE "public"."estadisticas_articulos_dia" TO "authenticated";
GRANT ALL ON TABLE "public"."estadisticas_articulos_dia" TO "service_role";



GRANT ALL ON TABLE "public"."estadisticas_movimientos" TO "anon";
GRANT ALL ON TABLE "public"."estadisticas_movimientos" TO "authenticated";
GRANT ALL ON TABLE "public"."estadisticas_movimientos" TO "service_role";



GRANT ALL ON TABLE "public"."estadisticas_pedidos_dia" TO "anon";
GRANT ALL ON TABLE "public"."estadisticas_pedidos_dia" TO "authenticated";
GRANT ALL ON TABLE "public"."estadisticas_pedidos_dia" TO "service_role";



GRANT ALL ON TABLE "public"."ofertas" TO "anon";
GRANT ALL ON TABLE "public"."ofertas" TO "authenticated";
GRANT ALL ON TABLE "public"."ofertas" TO "service_role";



GRANT ALL ON SEQUENCE "public"."ofertas_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."ofertas_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."ofertas_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."promociones_ruleta" TO "anon";
GRANT ALL ON TABLE "public"."promociones_ruleta" TO "authenticated";
GRANT ALL ON TABLE "public"."promociones_ruleta" TO "service_role";



GRANT ALL ON TABLE "public"."promociones_ruleta_articulos" TO "anon";
GRANT ALL ON TABLE "public"."promociones_ruleta_articulos" TO "authenticated";
GRANT ALL ON TABLE "public"."promociones_ruleta_articulos" TO "service_role";



GRANT ALL ON TABLE "public"."promociones_ruleta_departamentos" TO "anon";
GRANT ALL ON TABLE "public"."promociones_ruleta_departamentos" TO "authenticated";
GRANT ALL ON TABLE "public"."promociones_ruleta_departamentos" TO "service_role";



GRANT ALL ON TABLE "public"."promociones_ruleta_giros" TO "anon";
GRANT ALL ON TABLE "public"."promociones_ruleta_giros" TO "authenticated";
GRANT ALL ON TABLE "public"."promociones_ruleta_giros" TO "service_role";



GRANT ALL ON TABLE "public"."promociones_ruleta_premios" TO "anon";
GRANT ALL ON TABLE "public"."promociones_ruleta_premios" TO "authenticated";
GRANT ALL ON TABLE "public"."promociones_ruleta_premios" TO "service_role";



GRANT ALL ON TABLE "public"."promociones_ruleta_tiradas" TO "anon";
GRANT ALL ON TABLE "public"."promociones_ruleta_tiradas" TO "authenticated";
GRANT ALL ON TABLE "public"."promociones_ruleta_tiradas" TO "service_role";



GRANT ALL ON TABLE "public"."promotion_spins" TO "anon";
GRANT ALL ON TABLE "public"."promotion_spins" TO "authenticated";
GRANT ALL ON TABLE "public"."promotion_spins" TO "service_role";



GRANT ALL ON TABLE "public"."push_articulos" TO "anon";
GRANT ALL ON TABLE "public"."push_articulos" TO "authenticated";
GRANT ALL ON TABLE "public"."push_articulos" TO "service_role";



GRANT ALL ON TABLE "public"."push_calendario" TO "anon";
GRANT ALL ON TABLE "public"."push_calendario" TO "authenticated";
GRANT ALL ON TABLE "public"."push_calendario" TO "service_role";



GRANT ALL ON TABLE "public"."push_cliente_visto" TO "anon";
GRANT ALL ON TABLE "public"."push_cliente_visto" TO "authenticated";
GRANT ALL ON TABLE "public"."push_cliente_visto" TO "service_role";



GRANT ALL ON TABLE "public"."push_ofertas" TO "anon";
GRANT ALL ON TABLE "public"."push_ofertas" TO "authenticated";
GRANT ALL ON TABLE "public"."push_ofertas" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







