


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



CREATE OR REPLACE FUNCTION "public"."actualizar_updated_at_clientes"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."actualizar_updated_at_clientes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."attach_bingo_game_to_participation"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  new_game_id uuid;
begin
  -- Si la participación ya viene enlazada, no hacemos nada.
  if new.bingo_game_id is not null then
    return new;
  end if;

  insert into public.bingo_games (
    customer_phone,
    created_from_participation_id,
    status,
    card,
    remaining_numbers,
    drawn_numbers,
    line_completed,
    bingo_completed
  )
  values (
    new.customer_phone,
    new.id,
    'active',
    public.generate_bingo_card(),
    (
      select jsonb_agg(number_value order by number_value)
      from generate_series(1, 90) as number_value
    ),
    '[]'::jsonb,
    false,
    false
  )
  returning id into new_game_id;

  update public.promotion_participations
  set
    bingo_game_id = new_game_id,
    bingo_plays_total = greatest(coalesce(bingo_plays_total, 0), 1),
    bingo_plays_used = coalesce(bingo_plays_used, 0)
  where id = new.id;

  return new;
end;
$$;


ALTER FUNCTION "public"."attach_bingo_game_to_participation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cantar_bola_bingo"("p_promocion_id" "uuid", "p_numero" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_edition uuid; begin
 select edition_id into v_edition from public.promociones_bingo where id=p_promocion_id;
 insert into public.bingo_draws(promotion_id,edition_id,number) values(p_promocion_id,v_edition,p_numero) on conflict do nothing;
end $$;


ALTER FUNCTION "public"."cantar_bola_bingo"("p_promocion_id" "uuid", "p_numero" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."consume_game_bingo_play"("p_entitlement_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_entry public.game_entitlements%rowtype;
  v_total integer;
  v_used integer;
  v_ball integer;
  v_today date := current_date;
begin
  -- FOR UPDATE impide que dos cajas consuman simultáneamente la misma bola.
  select * into v_entry
  from public.game_entitlements
  where id = p_entitlement_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found', 'message', 'Participación no encontrada.');
  end if;

  if coalesce(lower(v_entry.status), 'pending') in ('disabled','cancelled','canceled','blocked') then
    return jsonb_build_object('ok', false, 'reason', 'blocked', 'message', 'Este código está bloqueado.');
  end if;

  if v_entry.expires_at is not null and v_entry.expires_at < now() then
    return jsonb_build_object('ok', false, 'reason', 'expired', 'message', 'Este código está caducado.');
  end if;

  -- Los pedidos históricos elegibles conservan al menos una jugada aunque
  -- bingo_plays_total se haya inicializado a 0 durante la migración.
  v_total := greatest(
    coalesce(v_entry.bingo_plays_total, 0),
    case when coalesce(v_entry.bingo_eligible, false) then 1 else 0 end
  );
  v_used := coalesce(v_entry.bingo_plays_used, 0);

  if v_used >= v_total then
    return jsonb_build_object('ok', false, 'reason', 'used', 'message', 'La bola de Bingo de este pedido ya fue consumida.');
  end if;

  -- El número debe venir fijado por registrar_pedido_bingo para que caja solo lo revele/consuma.
  v_ball := coalesce(
    nullif(v_entry.bingo_reference->>'ball_number', '')::integer,
    nullif(v_entry.bingo_reference->>'numero', '')::integer,
    nullif(v_entry.bingo_reference->>'bola', '')::integer
  );

  if v_ball is null or v_ball < 1 or v_ball > 90 then
    return jsonb_build_object(
      'ok', false,
      'reason', 'missing_ball',
      'message', 'La participación de Bingo no tiene una bola válida asignada.'
    );
  end if;

  -- Máximo una bola de Bingo por cliente y día. La comprobación se realiza dentro del bloqueo.
  if v_entry.last_bingo_play_at is not null and v_entry.last_bingo_play_at::date = v_today then
    return jsonb_build_object('ok', false, 'reason', 'daily_limit', 'message', 'Este cliente ya consumió una bola de Bingo hoy.');
  end if;

  update public.game_entitlements
  set bingo_plays_used = v_used + 1,
      last_bingo_play_at = now(),
      updated_at = now()
  where id = v_entry.id;

  return jsonb_build_object(
    'ok', true,
    'ball_number', v_ball,
    'bingo_remaining', greatest(0, v_total - v_used - 1),
    'message', format('Bola de Bingo %s registrada correctamente.', v_ball)
  );
end;
$$;


ALTER FUNCTION "public"."consume_game_bingo_play"("p_entitlement_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."consume_game_bingo_play_by_code"("p_code" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_entry public.game_entitlements%rowtype;
  v_promotion record;
  v_total integer;
  v_used integer;
  v_ball integer;
  v_today date := current_date;
begin
  select * into v_entry
  from public.game_entitlements
  where upper(regexp_replace(code, '\s+', '', 'g')) = upper(regexp_replace(p_code, '\s+', '', 'g'))
  limit 1
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found', 'message', 'No se encontró la participación de Bingo para este QR.');
  end if;

  if coalesce(lower(v_entry.status), 'pending') in ('disabled','cancelled','canceled','blocked') then
    return jsonb_build_object('ok', false, 'reason', 'blocked', 'message', 'Este código está bloqueado.');
  end if;

  if v_entry.expires_at is not null and v_entry.expires_at < now() then
    return jsonb_build_object('ok', false, 'reason', 'expired', 'message', 'Este código está caducado.');
  end if;

  v_total := greatest(coalesce(v_entry.bingo_plays_total, 0), case when coalesce(v_entry.bingo_eligible, false) then 1 else 0 end);
  v_used := coalesce(v_entry.bingo_plays_used, 0);

  if v_total < 1 then
    return jsonb_build_object('ok', false, 'reason', 'not_eligible', 'message', 'Este pedido no tiene participación de Bingo.');
  end if;
  if v_used >= v_total then
    return jsonb_build_object('ok', false, 'reason', 'used', 'message', 'La jugada de Bingo de este pedido ya fue consumida.');
  end if;
  if v_entry.last_bingo_play_at is not null and v_entry.last_bingo_play_at::date = v_today then
    return jsonb_build_object('ok', false, 'reason', 'daily_limit', 'message', 'Este cliente ya jugó al Bingo hoy.');
  end if;

  select id, edition_id into v_promotion
  from public.promociones_bingo
  where coalesce(activa, false) = true
    and (fecha_inicio is null or fecha_inicio <= current_date)
    and (fecha_fin is null or fecha_fin >= current_date)
    and edition_id is not null
  order by updated_at desc nulls last
  limit 1
  for update;

  if v_promotion.id is null then
    return jsonb_build_object('ok', false, 'reason', 'no_active_bingo', 'message', 'No hay un Bingo activo con bombo disponible.');
  end if;

  select n into v_ball
  from generate_series(1, 90) as n
  where not exists (
    select 1 from public.bingo_draws d
    where d.edition_id = v_promotion.edition_id and d.number = n
  )
  order by random()
  limit 1;

  if v_ball is null then
    return jsonb_build_object('ok', false, 'reason', 'drum_empty', 'message', 'El bombo no tiene bolas disponibles.');
  end if;

  -- La bola se crea ahora, al terminar el giro del bombo. Nunca se exige antes.
  perform public.cantar_bola_bingo(v_promotion.id, v_ball);

  update public.game_entitlements
  set bingo_plays_used = v_used + 1,
      last_bingo_play_at = now(),
      bingo_reference = coalesce(bingo_reference, '{}'::jsonb) || jsonb_build_object(
        'ball_number', v_ball,
        'promotion_id', v_promotion.id,
        'edition_id', v_promotion.edition_id,
        'drawn_at', now()
      ),
      updated_at = now()
  where id = v_entry.id;

  return jsonb_build_object(
    'ok', true,
    'ball_number', v_ball,
    'edition_id', v_promotion.edition_id,
    'bingo_remaining', greatest(0, v_total - v_used - 1),
    'message', format('Bola %s extraída y cantada correctamente.', v_ball)
  );
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'reason', 'concurrent_draw', 'message', 'Otra caja extrajo una bola al mismo tiempo. Vuelve a pulsar Bingo.');
end;
$$;


ALTER FUNCTION "public"."consume_game_bingo_play_by_code"("p_code" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."consume_game_roulette_play_by_code"("p_code" "text", "p_prize_id" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_entry public.game_entitlements%rowtype;
  v_participation public.promotion_participations%rowtype;
  v_spin jsonb;
  v_prize_uuid uuid;
  v_total integer;
  v_used integer;
  v_remaining integer;
begin
  select ge.*
    into v_entry
  from public.game_entitlements ge
  where upper(regexp_replace(ge.code, '\s+', '', 'g')) =
        upper(regexp_replace(p_code, '\s+', '', 'g'))
  limit 1
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found', 'message', 'No se encontró el pedido asociado a este QR.');
  end if;

  if coalesce(lower(v_entry.status), 'pending') in
     ('disabled','cancelled','canceled','blocked') then
    return jsonb_build_object('ok', false, 'reason', 'blocked', 'message', 'Este código está bloqueado.');
  end if;

  if v_entry.expires_at is not null and v_entry.expires_at < now() then
    return jsonb_build_object('ok', false, 'reason', 'expired', 'message', 'Este código está caducado.');
  end if;

  if v_entry.roulette_participation_id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_eligible', 'message', 'Este pedido no tiene participación de Ruleta.');
  end if;

  select pp.*
    into v_participation
  from public.promotion_participations pp
  where pp.id = v_entry.roulette_participation_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'missing_participation', 'message', 'No se encontró la participación de Ruleta vinculada al QR.');
  end if;

  begin
    v_prize_uuid := nullif(trim(p_prize_id), '')::uuid;
  exception when invalid_text_representation then
    return jsonb_build_object('ok', false, 'reason', 'invalid_prize', 'message', 'El premio seleccionado no tiene un identificador válido.');
  end;

  if v_prize_uuid is null then
    return jsonb_build_object('ok', false, 'reason', 'missing_prize', 'message', 'La Ruleta no devolvió un premio válido.');
  end if;

  v_total := greatest(
    1,
    coalesce(v_entry.roulette_plays_total, 0),
    coalesce(v_participation.spins_total, 1)
  );
  v_used := greatest(
    0,
    coalesce(v_entry.roulette_plays_used, 0),
    coalesce(v_participation.spins_used, 0)
  );

  if v_used >= v_total then
    return jsonb_build_object(
      'ok', false,
      'reason', 'used',
      'message', 'La tirada de Ruleta de este pedido ya fue consumida.',
      'spins_total', v_total,
      'spins_used', v_used,
      'spins_remaining', 0
    );
  end if;

  v_spin := public.register_promotion_spin(v_participation.id, v_prize_uuid);

  if not coalesce((v_spin ->> 'ok')::boolean, false) then
    return coalesce(
      v_spin,
      jsonb_build_object('ok', false, 'reason', 'spin_failed', 'message', 'No se pudo registrar la tirada.')
    );
  end if;

  v_used := coalesce((v_spin ->> 'spins_used')::integer, v_used + 1);
  v_remaining := coalesce((v_spin ->> 'spins_remaining')::integer, greatest(0, v_total - v_used));

  update public.game_entitlements ge
  set roulette_plays_used = v_used,
      updated_at = now()
  where ge.id = v_entry.id;

  return v_spin || jsonb_build_object(
    'ok', true,
    'spins_total', v_total,
    'spins_used', v_used,
    'spins_remaining', v_remaining,
    'message', 'Tirada de Ruleta registrada correctamente.'
  );
exception
  when others then
    return jsonb_build_object('ok', false, 'reason', 'database_error', 'message', sqlerrm);
end;
$$;


ALTER FUNCTION "public"."consume_game_roulette_play_by_code"("p_code" "text", "p_prize_id" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."game_entitlements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "order_id" "text" NOT NULL,
    "customer_token" "text",
    "customer_name" "text",
    "roulette_participation_id" "uuid",
    "roulette_eligible" boolean DEFAULT false NOT NULL,
    "roulette_plays_total" integer DEFAULT 0 NOT NULL,
    "bingo_eligible" boolean DEFAULT false NOT NULL,
    "bingo_reference" "jsonb",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "roulette_plays_used" integer DEFAULT 0 NOT NULL,
    "bingo_plays_total" integer DEFAULT 0 NOT NULL,
    "bingo_plays_used" integer DEFAULT 0 NOT NULL,
    "last_bingo_play_at" timestamp with time zone,
    CONSTRAINT "game_entitlements_roulette_plays_total_check" CHECK (("roulette_plays_total" >= 0)),
    CONSTRAINT "game_entitlements_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'completed'::"text", 'cancelled'::"text", 'blocked'::"text"])))
);


ALTER TABLE "public"."game_entitlements" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_or_update_game_entitlement"("p_order_id" "text", "p_customer_token" "text" DEFAULT NULL::"text", "p_customer_name" "text" DEFAULT NULL::"text", "p_roulette_participation_id" "uuid" DEFAULT NULL::"uuid", "p_roulette_eligible" boolean DEFAULT false, "p_roulette_plays_total" integer DEFAULT 0, "p_bingo_eligible" boolean DEFAULT false, "p_bingo_reference" "jsonb" DEFAULT NULL::"jsonb", "p_expires_at" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS "public"."game_entitlements"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_row public.game_entitlements;
begin
  if nullif(trim(p_order_id), '') is null then
    raise exception 'order_id_required';
  end if;

  if not coalesce(p_roulette_eligible, false) and not coalesce(p_bingo_eligible, false) then
    raise exception 'no_game_eligible';
  end if;

  insert into public.game_entitlements (
    code,
    order_id,
    customer_token,
    customer_name,
    roulette_participation_id,
    roulette_eligible,
    roulette_plays_total,
    bingo_eligible,
    bingo_reference,
    expires_at
  ) values (
    public.generate_game_entitlement_code(),
    trim(p_order_id),
    nullif(trim(coalesce(p_customer_token, '')), ''),
    nullif(trim(coalesce(p_customer_name, '')), ''),
    p_roulette_participation_id,
    coalesce(p_roulette_eligible, false),
    greatest(0, coalesce(p_roulette_plays_total, 0)),
    coalesce(p_bingo_eligible, false),
    p_bingo_reference,
    p_expires_at
  )
  on conflict (order_id) do update set
    customer_token = coalesce(excluded.customer_token, game_entitlements.customer_token),
    customer_name = coalesce(excluded.customer_name, game_entitlements.customer_name),
    roulette_participation_id = coalesce(excluded.roulette_participation_id, game_entitlements.roulette_participation_id),
    roulette_eligible = excluded.roulette_eligible,
    roulette_plays_total = excluded.roulette_plays_total,
    bingo_eligible = excluded.bingo_eligible,
    bingo_reference = coalesce(excluded.bingo_reference, game_entitlements.bingo_reference),
    expires_at = coalesce(excluded.expires_at, game_entitlements.expires_at),
    updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;


ALTER FUNCTION "public"."create_or_update_game_entitlement"("p_order_id" "text", "p_customer_token" "text", "p_customer_name" "text", "p_roulette_participation_id" "uuid", "p_roulette_eligible" boolean, "p_roulette_plays_total" integer, "p_bingo_eligible" boolean, "p_bingo_reference" "jsonb", "p_expires_at" timestamp with time zone) OWNER TO "postgres";


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
    "bingo_game_id" "uuid",
    "bingo_plays_total" integer DEFAULT 0 NOT NULL,
    "bingo_plays_used" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "promotion_participations_bingo_plays_valid" CHECK ((("bingo_plays_total" >= 0) AND ("bingo_plays_used" >= 0) AND ("bingo_plays_used" <= "bingo_plays_total"))),
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


CREATE OR REPLACE FUNCTION "public"."ensure_customer_bingo_card"("p_token" "text", "p_carton" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_token text := nullif(trim(p_token), '');
  v_client public.clientes%rowtype;
  v_entry public.game_entitlements%rowtype;
  v_result jsonb;
begin
  if v_token is null then
    return jsonb_build_object('ok', false, 'reason', 'missing_token', 'message', 'El enlace personal del cliente no contiene un token válido.');
  end if;

  select * into v_client
  from public.clientes
  where token = v_token
    and estado = 'activo'
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'customer_not_found', 'message', 'El enlace personal no corresponde a un cliente activo.');
  end if;

  select * into v_entry
  from public.game_entitlements ge
  where coalesce(ge.bingo_eligible, false) = true
    and (
      ge.customer_token = v_token
      or ge.bingo_reference ->> 'customer_token' = v_token
      or ge.bingo_reference ->> 'token' = v_token
      or ge.bingo_reference ->> 'cliente_token' = v_token
      or ge.bingo_reference #>> '{customer,token}' = v_token
      or ge.bingo_reference #>> '{cliente,token}' = v_token
    )
  order by ge.created_at desc nulls last
  limit 1;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'reason', 'no_bingo_entitlement',
      'message', 'Tu cliente está identificado, pero todavía no consta una participación de Bingo vinculada a este enlace.'
    );
  end if;

  -- Repara pedidos históricos para que futuras consultas sean directas.
  if v_entry.customer_token is distinct from v_token then
    update public.game_entitlements
    set customer_token = v_token,
        updated_at = now()
    where id = v_entry.id;
  end if;

  v_result := public.ensure_game_bingo_card_by_code(v_entry.code, p_carton);
  return v_result;
end;
$$;


ALTER FUNCTION "public"."ensure_customer_bingo_card"("p_token" "text", "p_carton" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_game_bingo_card_by_code"("p_code" "text", "p_carton" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_entry public.game_entitlements%rowtype;
  v_token text;
  v_customer_count integer := 0;
  v_card jsonb;
begin
  select * into v_entry
  from public.game_entitlements
  where upper(regexp_replace(code, '\\s+', '', 'g')) = upper(regexp_replace(p_code, '\\s+', '', 'g'))
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found', 'message', 'Código QR no encontrado.');
  end if;

  if not coalesce(v_entry.bingo_eligible, false) then
    return jsonb_build_object('ok', false, 'reason', 'not_eligible', 'message', 'Este pedido no tiene participación de Bingo.');
  end if;

  v_token := nullif(trim(coalesce(
    v_entry.customer_token,
    v_entry.bingo_reference ->> 'customer_token',
    v_entry.bingo_reference ->> 'token',
    v_entry.bingo_reference ->> 'cliente_token',
    v_entry.bingo_reference #>> '{customer,token}',
    v_entry.bingo_reference #>> '{cliente,token}'
  )), '');

  -- Recuperación segura para pedidos antiguos: solo se usa el nombre cuando identifica
  -- de forma inequívoca a un único cliente activo.
  if v_token is null and nullif(trim(v_entry.customer_name), '') is not null then
    select count(*), min(token)
      into v_customer_count, v_token
    from public.clientes
    where estado = 'activo'
      and lower(trim(nombre)) = lower(trim(v_entry.customer_name))
      and nullif(trim(token), '') is not null;

    if v_customer_count <> 1 then
      v_token := null;
    end if;
  end if;

  if v_token is null then
    return jsonb_build_object(
      'ok', false,
      'reason', 'customer_not_linked',
      'message', 'El QR tiene Bingo, pero el pedido no está vinculado de forma inequívoca a un cliente activo.'
    );
  end if;

  -- Guardamos la relación recuperada para que los siguientes usos no dependan del fallback.
  if v_entry.customer_token is distinct from v_token then
    update public.game_entitlements
    set customer_token = v_token,
        updated_at = now()
    where id = v_entry.id;
  end if;

  begin
    select to_jsonb(card_row)
      into v_card
    from public.obtener_o_crear_carton_bingo(v_token, p_carton) as card_row
    limit 1;
  exception
    when others then
      return jsonb_build_object(
        'ok', false,
        'reason', 'card_rpc_error',
        'message', 'No se pudo obtener o crear el cartón del cliente: ' || SQLERRM
      );
  end;

  if v_card is null then
    return jsonb_build_object(
      'ok', false,
      'reason', 'card_not_created',
      'message', 'El cliente está vinculado, pero no se pudo crear su cartón en la edición activa.'
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'customer_token', v_token,
    'carton_id', coalesce(v_card ->> 'carton_id', v_card ->> 'id'),
    'edition_id', v_card ->> 'edition_id',
    'card', coalesce(v_card -> 'carton', v_card -> 'card'),
    'card_result', v_card
  );
end;
$$;


ALTER FUNCTION "public"."ensure_game_bingo_card_by_code"("p_code" "text", "p_carton" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."finalize_game_bingo_ball_by_code"("p_code" "text", "p_reservation_token" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_entry public.game_entitlements%rowtype;
  v_promotion_id uuid;
  v_edition_id uuid;
  v_ball integer;
  v_total integer;
  v_used integer;
begin
  select ge.* into v_entry
  from public.game_entitlements ge
  where upper(regexp_replace(ge.code, '\s+', '', 'g')) = upper(regexp_replace(p_code, '\s+', '', 'g'))
  limit 1
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found', 'message', 'No se encontró la participación de Bingo para este QR.');
  end if;

  if v_entry.bingo_reference->>'state' <> 'reserved'
     or v_entry.bingo_reference->>'reservation_token' <> p_reservation_token then
    return jsonb_build_object('ok', false, 'reason', 'invalid_reservation', 'message', 'La reserva de la bola no es válida o ya fue publicada.');
  end if;

  if coalesce((v_entry.bingo_reference->>'reserved_at')::timestamptz, '-infinity'::timestamptz) < now() - interval '2 minutes' then
    return jsonb_build_object('ok', false, 'reason', 'reservation_expired', 'message', 'La reserva ha caducado. Vuelve a girar el bombo.');
  end if;

  v_ball := (v_entry.bingo_reference->>'ball_number')::integer;
  v_promotion_id := (v_entry.bingo_reference->>'promotion_id')::uuid;
  v_edition_id := (v_entry.bingo_reference->>'edition_id')::uuid;
  v_total := greatest(coalesce(v_entry.bingo_plays_total, 0), case when coalesce(v_entry.bingo_eligible, false) then 1 else 0 end);
  v_used := coalesce(v_entry.bingo_plays_used, 0);

  perform pg_advisory_xact_lock(hashtext(v_edition_id::text));

  if exists (
    select 1 from public.bingo_draws d
    where d.edition_id = v_edition_id and d.number = v_ball
  ) then
    return jsonb_build_object('ok', false, 'reason', 'already_drawn', 'message', 'La bola reservada ya fue extraída por otra caja.');
  end if;

  -- Esta llamada inserta bingo_draws y dispara Realtime justo al aparecer la bola.
  perform public.cantar_bola_bingo(v_promotion_id, v_ball);

  update public.game_entitlements
  set bingo_plays_used = v_used + 1,
      last_bingo_play_at = now(),
      bingo_reference = coalesce(bingo_reference, '{}'::jsonb) || jsonb_build_object(
        'state', 'published',
        'drawn_at', now()
      ),
      updated_at = now()
  where id = v_entry.id;

  return jsonb_build_object(
    'ok', true,
    'ball_number', v_ball,
    'edition_id', v_edition_id,
    'bingo_remaining', greatest(0, v_total - v_used - 1),
    'message', format('Bola %s publicada correctamente.', v_ball)
  );
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'reason', 'concurrent_draw', 'message', 'Otra caja publicó una bola al mismo tiempo. Vuelve a girar el bombo.');
end;
$$;


ALTER FUNCTION "public"."finalize_game_bingo_ball_by_code"("p_code" "text", "p_reservation_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_bingo_card"() RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  occupied integer[];
  card_values integer[];
  selected_columns integer[];
  selected_numbers integer[];
  column_count integer;
  row_index integer;
  column_index integer;
  position_index integer;
  number_index integer;
  valid_layout boolean;
  range_start integer;
  range_end integer;
begin
  -- Creamos una distribución de 3 filas x 9 columnas:
  -- 5 números por fila y al menos 1 número en cada columna.
  loop
    occupied := array_fill(0, array[27]);

    for row_index in 0..2 loop
      select array_agg(column_number order by column_number)
      into selected_columns
      from (
        select column_number
        from generate_series(1, 9) as column_number
        order by random()
        limit 5
      ) chosen_columns;

      foreach column_index in array selected_columns loop
        position_index := row_index * 9 + column_index;
        occupied[position_index] := 1;
      end loop;
    end loop;

    valid_layout := true;

    for column_index in 1..9 loop
      column_count :=
        occupied[column_index] +
        occupied[9 + column_index] +
        occupied[18 + column_index];

      if column_count < 1 or column_count > 3 then
        valid_layout := false;
        exit;
      end if;
    end loop;

    exit when valid_layout;
  end loop;

  card_values := array_fill(null::integer, array[27]);

  -- Generamos los números de cada columna y los colocamos ordenados.
  for column_index in 1..9 loop
    column_count :=
      occupied[column_index] +
      occupied[9 + column_index] +
      occupied[18 + column_index];

    if column_index = 1 then
      range_start := 1;
      range_end := 9;
    elsif column_index = 9 then
      range_start := 80;
      range_end := 90;
    else
      range_start := (column_index - 1) * 10;
      range_end := range_start + 9;
    end if;

    select array_agg(number_value order by number_value)
    into selected_numbers
    from (
      select number_value
      from generate_series(range_start, range_end) as number_value
      order by random()
      limit column_count
    ) chosen_numbers;

    number_index := 1;

    for row_index in 0..2 loop
      position_index := row_index * 9 + column_index;

      if occupied[position_index] = 1 then
        card_values[position_index] := selected_numbers[number_index];
        number_index := number_index + 1;
      end if;
    end loop;
  end loop;

  return jsonb_build_array(
    jsonb_build_array(
      card_values[1], card_values[2], card_values[3],
      card_values[4], card_values[5], card_values[6],
      card_values[7], card_values[8], card_values[9]
    ),
    jsonb_build_array(
      card_values[10], card_values[11], card_values[12],
      card_values[13], card_values[14], card_values[15],
      card_values[16], card_values[17], card_values[18]
    ),
    jsonb_build_array(
      card_values[19], card_values[20], card_values[21],
      card_values[22], card_values[23], card_values[24],
      card_values[25], card_values[26], card_values[27]
    )
  );
end;
$$;


ALTER FUNCTION "public"."generate_bingo_card"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_game_entitlement_code"() RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_code text;
  v_random text;
begin
  loop
    v_random := upper(md5(
      random()::text
      || clock_timestamp()::text
      || pg_backend_pid()::text
    ));

    v_code := 'LJ-' || substr(v_random, 1, 4)
      || '-' || substr(v_random, 5, 4);

    exit when not exists (
      select 1
      from public.game_entitlements
      where code = v_code
    );
  end loop;

  return v_code;
end;
$$;


ALTER FUNCTION "public"."generate_game_entitlement_code"() OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."keep_last_two_completed_bingo_games"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if new.status = 'completed' then
    delete from public.bingo_games
    where id in (
      select id
      from public.bingo_games
      where customer_phone = new.customer_phone
        and status = 'completed'
      order by
        completed_at desc nulls last,
        created_at desc,
        id desc
      offset 2
    );
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."keep_last_two_completed_bingo_games"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."nuevo_bingo"("p_promocion_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_new uuid:=gen_random_uuid(); begin
 update public.bingo_cards set status=case when bingo_completed then 'won' else 'expired' end where promotion_id=p_promocion_id and status='active';
 update public.promociones_bingo set edition_id=v_new,updated_at=now() where id=p_promocion_id;
 return v_new;
end $$;


ALTER FUNCTION "public"."nuevo_bingo"("p_promocion_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."obtener_o_crear_carton_bingo"("p_token" "text", "p_carton" "jsonb") RETURNS TABLE("carton_id" "uuid", "carton" "jsonb", "numeros_marcados" integer[], "estado" "text", "edition_id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_cliente public.clientes%ROWTYPE;
  v_promo public.promociones_bingo%ROWTYPE;
  v_right public.bingo_entitlements%ROWTYPE;
  v_card public.bingo_cards%ROWTYPE;
BEGIN
  SELECT c.*
  INTO v_cliente
  FROM public.clientes AS c
  WHERE c.token = p_token
    AND c.activo = true
  LIMIT 1;

  SELECT pb.*
  INTO v_promo
  FROM public.promociones_bingo AS pb
  WHERE pb.activa = true
    AND (pb.fecha_inicio IS NULL OR pb.fecha_inicio <= CURRENT_DATE)
    AND (pb.fecha_fin IS NULL OR pb.fecha_fin >= CURRENT_DATE)
  ORDER BY pb.updated_at DESC NULLS LAST
  LIMIT 1;

  IF v_cliente.id IS NULL OR v_promo.id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.bingo_cards AS bc
  SET status = 'expired'
  WHERE bc.cliente_id = v_cliente.id
    AND bc.edition_id <> v_promo.edition_id
    AND bc.status = 'active';

  SELECT be.*
  INTO v_right
  FROM public.bingo_entitlements AS be
  WHERE be.cliente_id = v_cliente.id
    AND be.edition_id = v_promo.edition_id
  LIMIT 1;

  IF v_right.id IS NULL THEN
    RETURN;
  END IF;

  SELECT bc.*
  INTO v_card
  FROM public.bingo_cards AS bc
  WHERE bc.cliente_id = v_cliente.id
    AND bc.edition_id = v_promo.edition_id
  LIMIT 1;

  IF v_card.id IS NULL THEN
    INSERT INTO public.bingo_cards(
      promotion_id,
      edition_id,
      cliente_id,
      entitlement_id,
      card
    )
    VALUES (
      v_promo.id,
      v_promo.edition_id,
      v_cliente.id,
      v_right.id,
      p_carton
    )
    RETURNING * INTO v_card;

    UPDATE public.bingo_entitlements AS be
    SET consumed_at = NOW()
    WHERE be.id = v_right.id;
  END IF;

  IF v_card.status <> 'active' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    v_card.id,
    v_card.card,
    COALESCE(
      ARRAY(
        SELECT bd.number::integer
        FROM public.bingo_draws AS bd
        WHERE bd.edition_id = v_promo.edition_id
        ORDER BY bd.drawn_at
      ),
      '{}'::integer[]
    ),
    v_card.status,
    v_promo.edition_id;
END;
$$;


ALTER FUNCTION "public"."obtener_o_crear_carton_bingo"("p_token" "text", "p_carton" "jsonb") OWNER TO "postgres";


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
  v_prize public.promociones_ruleta_premios%rowtype;
  v_total integer;
  v_used integer;
  v_remaining integer;
begin
  select pp.*
    into v_participation
  from public.promotion_participations pp
  where pp.id = p_participation_id
  for update;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'reason', 'not_found',
      'message', 'No se encontró la participación de Ruleta.'
    );
  end if;

  if coalesce(lower(v_participation.status), 'pending') in
     ('disabled', 'cancelled', 'canceled', 'blocked') then
    return jsonb_build_object(
      'ok', false,
      'reason', 'blocked',
      'message', 'Esta participación está bloqueada.'
    );
  end if;

  if v_participation.expires_at is not null
     and v_participation.expires_at < now() then
    return jsonb_build_object(
      'ok', false,
      'reason', 'expired',
      'message', 'Esta participación está caducada.'
    );
  end if;

  if p_prize_id is null then
    return jsonb_build_object(
      'ok', false,
      'reason', 'missing_prize',
      'message', 'La Ruleta no devolvió un premio válido.'
    );
  end if;

  select pr.*
    into v_prize
  from public.promociones_ruleta_premios pr
  where pr.id = p_prize_id
    and pr.promocion_id = v_participation.promotion_id
    and coalesce(pr.activo, true) = true
  limit 1;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'reason', 'invalid_prize',
      'message', 'El premio seleccionado no pertenece a esta promoción o está desactivado.'
    );
  end if;

  v_total := greatest(1, coalesce(v_participation.spins_total, 1));
  v_used := greatest(0, coalesce(v_participation.spins_used, 0));

  if v_used >= v_total then
    return jsonb_build_object(
      'ok', false,
      'reason', 'used',
      'message', 'Esta participación ya no tiene tiradas disponibles.',
      'spins_total', v_total,
      'spins_used', v_used,
      'spins_remaining', 0
    );
  end if;

  v_used := v_used + 1;
  v_remaining := greatest(0, v_total - v_used);

  -- Premio, contador y estado se guardan juntos. Esto satisface
  -- promotion_participations_prize_check al pasar a estado played.
  update public.promotion_participations pp
  set prize_id = p_prize_id,
      spins_used = v_used,
      status = case when v_remaining = 0 then 'played' else 'pending' end,
      played_at = case
        when v_remaining = 0 then coalesce(pp.played_at, now())
        else pp.played_at
      end
  where pp.id = p_participation_id;

  return jsonb_build_object(
    'ok', true,
    'participation_id', p_participation_id,
    'prize_id', p_prize_id,
    'prize_name', v_prize.nombre,
    'spins_total', v_total,
    'spins_used', v_used,
    'spins_remaining', v_remaining,
    'status', case when v_remaining = 0 then 'played' else 'pending' end
  );
exception
  when check_violation then
    return jsonb_build_object(
      'ok', false,
      'reason', 'constraint_error',
      'message', 'No se pudo guardar el premio porque los datos de la participación no cumplen las reglas de Ruleta.',
      'detail', sqlerrm
    );
  when others then
    return jsonb_build_object(
      'ok', false,
      'reason', 'database_error',
      'message', sqlerrm
    );
end;
$$;


ALTER FUNCTION "public"."register_promotion_spin"("p_participation_id" "uuid", "p_prize_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."registrar_pedido_bingo"("p_token" "text", "p_order_id" "text", "p_items" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_cliente public.clientes%rowtype;
  v_promo public.promociones_bingo%rowtype;
  v_validos integer;
  v_requeridos integer;
  v_entitlement public.bingo_entitlements%rowtype;
BEGIN
  SELECT *
  INTO v_cliente
  FROM public.clientes
  WHERE token = p_token
    AND activo = true
  LIMIT 1;

  IF v_cliente.id IS NULL THEN
    RETURN jsonb_build_object(
      'qualified', false,
      'reason', 'Cliente no válido'
    );
  END IF;

  SELECT *
  INTO v_promo
  FROM public.promociones_bingo
  WHERE activa = true
    AND (fecha_inicio IS NULL OR fecha_inicio <= current_date)
    AND (fecha_fin IS NULL OR fecha_fin >= current_date)
  ORDER BY updated_at DESC NULLS LAST, created_at DESC
  LIMIT 1;

  IF v_promo.id IS NULL THEN
    RETURN jsonb_build_object(
      'qualified', false,
      'reason', 'No hay Bingo activo'
    );
  END IF;

  v_requeridos := greatest(1, coalesce(v_promo.variedad_minima, 1));

  /*
   * Bingo se obtiene por variedad de referencias pedidas en cajas:
   * - Cada código de artículo distinto con al menos una caja cuenta una vez.
   * - Las unidades quedan excluidas.
   * - No se consulta promociones_bingo_articulos.
   */
  SELECT count(DISTINCT trim(i.item->>'codigo'))::integer
  INTO v_validos
  FROM jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) AS i(item)
  WHERE nullif(trim(i.item->>'codigo'), '') IS NOT NULL
    AND coalesce(nullif(i.item->>'cajas', '')::numeric, 0) > 0;

  IF v_validos < v_requeridos THEN
    RETURN jsonb_build_object(
      'qualified', false,
      'matched', v_validos,
      'required', v_requeridos
    );
  END IF;

  INSERT INTO public.bingo_entitlements(
    promotion_id,
    edition_id,
    cliente_id,
    order_id
  )
  VALUES (
    v_promo.id,
    v_promo.edition_id,
    v_cliente.id,
    p_order_id
  )
  ON CONFLICT (edition_id, cliente_id)
  DO UPDATE SET order_id = excluded.order_id
  RETURNING * INTO v_entitlement;

  RETURN jsonb_build_object(
    'qualified', true,
    'matched', v_validos,
    'required', v_requeridos,
    'entitlement_id', v_entitlement.id,
    'edition_id', v_promo.edition_id
  );
END
$$;


ALTER FUNCTION "public"."registrar_pedido_bingo"("p_token" "text", "p_order_id" "text", "p_items" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reserve_game_bingo_ball_by_code"("p_code" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_entry public.game_entitlements%rowtype;
  v_promotion record;
  v_total integer;
  v_used integer;
  v_ball integer;
  v_token uuid := gen_random_uuid();
  v_today date := current_date;
begin
  select ge.* into v_entry
  from public.game_entitlements ge
  where upper(regexp_replace(ge.code, '\s+', '', 'g')) = upper(regexp_replace(p_code, '\s+', '', 'g'))
  limit 1
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found', 'message', 'No se encontró la participación de Bingo para este QR.');
  end if;

  if coalesce(lower(v_entry.status), 'pending') in ('disabled','cancelled','canceled','blocked') then
    return jsonb_build_object('ok', false, 'reason', 'blocked', 'message', 'Este código está bloqueado.');
  end if;

  if v_entry.expires_at is not null and v_entry.expires_at < now() then
    return jsonb_build_object('ok', false, 'reason', 'expired', 'message', 'Este código está caducado.');
  end if;

  v_total := greatest(coalesce(v_entry.bingo_plays_total, 0), case when coalesce(v_entry.bingo_eligible, false) then 1 else 0 end);
  v_used := coalesce(v_entry.bingo_plays_used, 0);

  if v_total < 1 then
    return jsonb_build_object('ok', false, 'reason', 'not_eligible', 'message', 'Este pedido no tiene participación de Bingo.');
  end if;
  if v_used >= v_total then
    return jsonb_build_object('ok', false, 'reason', 'used', 'message', 'La jugada de Bingo de este pedido ya fue consumida.');
  end if;
  if v_entry.last_bingo_play_at is not null and v_entry.last_bingo_play_at::date = v_today then
    return jsonb_build_object('ok', false, 'reason', 'daily_limit', 'message', 'Este cliente ya jugó al Bingo hoy.');
  end if;

  -- Si existe una reserva reciente del mismo QR, se reutiliza para evitar dobles clics.
  if v_entry.bingo_reference->>'state' = 'reserved'
     and coalesce((v_entry.bingo_reference->>'reserved_at')::timestamptz, '-infinity'::timestamptz) > now() - interval '2 minutes' then
    return jsonb_build_object(
      'ok', true,
      'ball_number', (v_entry.bingo_reference->>'ball_number')::integer,
      'reservation_token', v_entry.bingo_reference->>'reservation_token',
      'edition_id', v_entry.bingo_reference->>'edition_id',
      'message', 'Reserva recuperada correctamente.'
    );
  end if;

  select pb.id, pb.edition_id into v_promotion
  from public.promociones_bingo pb
  where coalesce(pb.activa, false) = true
    and (pb.fecha_inicio is null or pb.fecha_inicio <= current_date)
    and (pb.fecha_fin is null or pb.fecha_fin >= current_date)
    and pb.edition_id is not null
  order by pb.updated_at desc nulls last
  limit 1
  for update;

  if v_promotion.id is null then
    return jsonb_build_object('ok', false, 'reason', 'no_active_bingo', 'message', 'No hay un Bingo activo con bombo disponible.');
  end if;

  -- Serializa las reservas de una misma edición para que dos cajas no elijan la misma bola.
  perform pg_advisory_xact_lock(hashtext(v_promotion.edition_id::text));

  select n into v_ball
  from generate_series(1, 90) as n
  where not exists (
    select 1 from public.bingo_draws d
    where d.edition_id = v_promotion.edition_id and d.number = n
  )
  and not exists (
    select 1
    from public.game_entitlements ge
    where ge.bingo_reference->>'state' = 'reserved'
      and ge.bingo_reference->>'edition_id' = v_promotion.edition_id::text
      and (ge.bingo_reference->>'ball_number')::integer = n
      and coalesce((ge.bingo_reference->>'reserved_at')::timestamptz, '-infinity'::timestamptz) > now() - interval '2 minutes'
  )
  order by random()
  limit 1;

  if v_ball is null then
    return jsonb_build_object('ok', false, 'reason', 'drum_empty', 'message', 'El bombo no tiene bolas disponibles.');
  end if;

  update public.game_entitlements
  set bingo_reference = coalesce(bingo_reference, '{}'::jsonb) || jsonb_build_object(
        'state', 'reserved',
        'ball_number', v_ball,
        'promotion_id', v_promotion.id,
        'edition_id', v_promotion.edition_id,
        'reservation_token', v_token,
        'reserved_at', now()
      ),
      updated_at = now()
  where id = v_entry.id;

  return jsonb_build_object(
    'ok', true,
    'ball_number', v_ball,
    'reservation_token', v_token,
    'edition_id', v_promotion.edition_id,
    'message', format('Bola %s reservada para la animación.', v_ball)
  );
end;
$$;


ALTER FUNCTION "public"."reserve_game_bingo_ball_by_code"("p_code" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resolve_game_entitlement"("p_code" "text") RETURNS TABLE("id" "uuid", "code" "text", "order_id" "text", "customer_name" "text", "roulette_participation_id" "uuid", "roulette_eligible" boolean, "roulette_plays_total" integer, "bingo_eligible" boolean, "status" "text", "expires_at" timestamp with time zone, "created_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    ge.id,
    ge.code,
    ge.order_id,
    ge.customer_name,
    ge.roulette_participation_id,
    ge.roulette_eligible,
    ge.roulette_plays_total,
    ge.bingo_eligible,
    ge.status,
    ge.expires_at,
    ge.created_at
  from public.game_entitlements ge
  where ge.code = upper(trim(p_code))
  limit 1;
$$;


ALTER FUNCTION "public"."resolve_game_entitlement"("p_code" "text") OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."validate_game_qr"("p_code" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_entry public.game_entitlements%rowtype;
  v_roulette public.promotion_participations%rowtype;
  v_now timestamptz := now();
  v_roulette_remaining integer := 0;
  v_bingo_remaining integer := 0;
begin
  select * into v_entry
  from public.game_entitlements
  where upper(regexp_replace(code, '\\s+', '', 'g')) = upper(regexp_replace(p_code, '\\s+', '', 'g'))
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found', 'message', 'Código no encontrado.');
  end if;

  if coalesce(lower(v_entry.status), 'pending') in ('disabled','cancelled','canceled','blocked') then
    return jsonb_build_object('ok', false, 'reason', 'blocked', 'message', 'Este código está bloqueado.');
  end if;

  if v_entry.expires_at is not null and v_entry.expires_at < v_now then
    return jsonb_build_object('ok', false, 'reason', 'expired', 'message', 'Este código está caducado.');
  end if;

  if v_entry.roulette_participation_id is not null then
    select * into v_roulette
    from public.promotion_participations
    where id = v_entry.roulette_participation_id;

    if found then
      v_roulette_remaining := greatest(
        0,
        greatest(coalesce(v_entry.roulette_plays_total, 0), coalesce(v_roulette.spins_total, 1))
        - greatest(coalesce(v_entry.roulette_plays_used, 0), coalesce(v_roulette.spins_used, 0))
      );
    end if;
  end if;

  -- Compatibilidad con pedidos creados antes de añadir bingo_plays_total.
  -- La columna quedó a 0 por defecto, aunque bingo_eligible ya fuese true.
  v_bingo_remaining := greatest(
    0,
    greatest(
      coalesce(v_entry.bingo_plays_total, 0),
      case when coalesce(v_entry.bingo_eligible, false) then 1 else 0 end
    ) - coalesce(v_entry.bingo_plays_used, 0)
  );

  if v_roulette_remaining = 0 and v_bingo_remaining = 0 then
    return jsonb_build_object('ok', false, 'reason', 'used', 'message', 'Este código ya no tiene juegos disponibles.');
  end if;

  return jsonb_build_object(
    'ok', true,
    'id', v_entry.id,
    'code', v_entry.code,
    'order_id', v_entry.order_id,
    'customer_name', v_entry.customer_name,
    'roulette_participation_id', v_entry.roulette_participation_id,
    'roulette_available', v_roulette_remaining > 0,
    'roulette_remaining', v_roulette_remaining,
    'bingo_available', v_bingo_remaining > 0,
    'bingo_remaining', v_bingo_remaining,
    'bingo_reference', v_entry.bingo_reference,
    'expires_at', v_entry.expires_at
  );
end;
$$;


ALTER FUNCTION "public"."validate_game_qr"("p_code" "text") OWNER TO "postgres";


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



CREATE TABLE IF NOT EXISTS "public"."bingo_cards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "promotion_id" "uuid" NOT NULL,
    "edition_id" "uuid" NOT NULL,
    "cliente_id" "uuid" NOT NULL,
    "entitlement_id" "uuid" NOT NULL,
    "card" "jsonb" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "line_completed" boolean DEFAULT false NOT NULL,
    "bingo_completed" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "won_at" timestamp with time zone,
    CONSTRAINT "bingo_cards_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'won'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."bingo_cards" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bingo_cartones" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cliente_id" "uuid" NOT NULL,
    "carton" "jsonb" NOT NULL,
    "numeros_marcados" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "estado" "text" DEFAULT 'activo'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "bingo_cartones_estado_check" CHECK (("estado" = ANY (ARRAY['activo'::"text", 'completado'::"text", 'archivado'::"text"])))
);


ALTER TABLE "public"."bingo_cartones" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bingo_draws" (
    "id" bigint NOT NULL,
    "promotion_id" "uuid" NOT NULL,
    "edition_id" "uuid" NOT NULL,
    "number" smallint NOT NULL,
    "drawn_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "bingo_draws_number_check" CHECK ((("number" >= 1) AND ("number" <= 90)))
);


ALTER TABLE "public"."bingo_draws" OWNER TO "postgres";


ALTER TABLE "public"."bingo_draws" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."bingo_draws_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."bingo_entitlements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "promotion_id" "uuid" NOT NULL,
    "edition_id" "uuid" NOT NULL,
    "cliente_id" "uuid" NOT NULL,
    "order_id" "text" NOT NULL,
    "qualified_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "consumed_at" timestamp with time zone
);


ALTER TABLE "public"."bingo_entitlements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bingo_games" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_phone" "text" NOT NULL,
    "created_from_participation_id" "uuid",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "card" "jsonb" NOT NULL,
    "remaining_numbers" "jsonb" NOT NULL,
    "drawn_numbers" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "line_completed" boolean DEFAULT false NOT NULL,
    "bingo_completed" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    CONSTRAINT "bingo_games_status_valid" CHECK (("status" = ANY (ARRAY['active'::"text", 'completed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."bingo_games" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clientes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre" "text" NOT NULL,
    "telefono" "text" NOT NULL,
    "activo" boolean DEFAULT true NOT NULL,
    "token" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "enlace_personal" "text",
    "estado" "text" DEFAULT 'activo'::"text"
);


ALTER TABLE "public"."clientes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clientes_favoritos" (
    "id" bigint NOT NULL,
    "cliente_id" "uuid" NOT NULL,
    "articulo_id" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."clientes_favoritos" OWNER TO "postgres";


ALTER TABLE "public"."clientes_favoritos" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."clientes_favoritos_id_seq"
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



CREATE TABLE IF NOT EXISTS "public"."promociones_bingo" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre" "text" DEFAULT 'Promoción bingo principal'::"text" NOT NULL,
    "activa" boolean DEFAULT false NOT NULL,
    "variedad_minima" integer DEFAULT 15 NOT NULL,
    "mensaje_cliente" "text" DEFAULT 'Tu pedido cumple las condiciones para participar en el Bingo.'::"text" NOT NULL,
    "fecha_inicio" "date",
    "fecha_fin" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "premio_linea_activo" boolean DEFAULT true NOT NULL,
    "premio_linea_nombre" "text" DEFAULT ''::"text" NOT NULL,
    "premio_linea_descripcion" "text" DEFAULT ''::"text" NOT NULL,
    "premio_bingo_activo" boolean DEFAULT true NOT NULL,
    "premio_bingo_nombre" "text" DEFAULT ''::"text" NOT NULL,
    "premio_bingo_descripcion" "text" DEFAULT ''::"text" NOT NULL,
    "premio_linea_mensaje" "text" DEFAULT ''::"text" NOT NULL,
    "premio_bingo_mensaje" "text" DEFAULT ''::"text" NOT NULL,
    "premio_linea_articulo_id" "text",
    "premio_bingo_articulo_id" "text",
    "premio_especial_activo" boolean DEFAULT false NOT NULL,
    "premio_especial_nombre" "text" DEFAULT ''::"text" NOT NULL,
    "premio_especial_mensaje" "text" DEFAULT ''::"text" NOT NULL,
    "premio_especial_articulo_id" bigint,
    "premio_especial_max_bolas" integer DEFAULT 50 NOT NULL,
    "edition_id" "uuid" DEFAULT "gen_random_uuid"(),
    CONSTRAINT "promociones_bingo_fechas_validas" CHECK ((("fecha_inicio" IS NULL) OR ("fecha_fin" IS NULL) OR ("fecha_fin" >= "fecha_inicio"))),
    CONSTRAINT "promociones_bingo_premio_bingo_nombre_activo_check" CHECK (((NOT "premio_bingo_activo") OR ("length"("btrim"("premio_bingo_nombre")) > 0))),
    CONSTRAINT "promociones_bingo_premio_especial_activo_check" CHECK (((NOT "premio_especial_activo") OR (("premio_especial_articulo_id" IS NOT NULL) AND ("length"("btrim"("premio_especial_nombre")) > 0)))),
    CONSTRAINT "promociones_bingo_premio_especial_bolas_check" CHECK ((("premio_especial_max_bolas" >= 1) AND ("premio_especial_max_bolas" <= 90))),
    CONSTRAINT "promociones_bingo_premio_linea_nombre_activo_check" CHECK (((NOT "premio_linea_activo") OR ("length"("btrim"("premio_linea_nombre")) > 0))),
    CONSTRAINT "promociones_bingo_variedad_minima_check" CHECK (("variedad_minima" >= 1))
);


ALTER TABLE "public"."promociones_bingo" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."promociones_bingo_articulos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "promocion_id" "uuid" NOT NULL,
    "articulo_id" bigint,
    "codigo_articulo" "text" NOT NULL,
    "nombre_articulo" "text" DEFAULT ''::"text" NOT NULL,
    "cantidad_minima" integer DEFAULT 1 NOT NULL,
    "cuenta_por_venta" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "promociones_bingo_articulos_cantidad_minima_check" CHECK (("cantidad_minima" >= 1))
);


ALTER TABLE "public"."promociones_bingo_articulos" OWNER TO "postgres";


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



ALTER TABLE ONLY "public"."bingo_cards"
    ADD CONSTRAINT "bingo_cards_edition_id_cliente_id_key" UNIQUE ("edition_id", "cliente_id");



ALTER TABLE ONLY "public"."bingo_cards"
    ADD CONSTRAINT "bingo_cards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bingo_cartones"
    ADD CONSTRAINT "bingo_cartones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bingo_draws"
    ADD CONSTRAINT "bingo_draws_edition_id_number_key" UNIQUE ("edition_id", "number");



ALTER TABLE ONLY "public"."bingo_draws"
    ADD CONSTRAINT "bingo_draws_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bingo_entitlements"
    ADD CONSTRAINT "bingo_entitlements_edition_id_cliente_id_key" UNIQUE ("edition_id", "cliente_id");



ALTER TABLE ONLY "public"."bingo_entitlements"
    ADD CONSTRAINT "bingo_entitlements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bingo_entitlements"
    ADD CONSTRAINT "bingo_entitlements_promotion_id_order_id_key" UNIQUE ("promotion_id", "order_id");



ALTER TABLE ONLY "public"."bingo_games"
    ADD CONSTRAINT "bingo_games_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clientes_favoritos"
    ADD CONSTRAINT "clientes_favoritos_cliente_articulo_unique" UNIQUE ("cliente_id", "articulo_id");



ALTER TABLE ONLY "public"."clientes_favoritos"
    ADD CONSTRAINT "clientes_favoritos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clientes"
    ADD CONSTRAINT "clientes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clientes"
    ADD CONSTRAINT "clientes_token_key" UNIQUE ("token");



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



ALTER TABLE ONLY "public"."game_entitlements"
    ADD CONSTRAINT "game_entitlements_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."game_entitlements"
    ADD CONSTRAINT "game_entitlements_order_id_key" UNIQUE ("order_id");



ALTER TABLE ONLY "public"."game_entitlements"
    ADD CONSTRAINT "game_entitlements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ofertas"
    ADD CONSTRAINT "ofertas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."promociones_bingo_articulos"
    ADD CONSTRAINT "promociones_bingo_articulos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."promociones_bingo_articulos"
    ADD CONSTRAINT "promociones_bingo_articulos_promocion_id_codigo_articulo_key" UNIQUE ("promocion_id", "codigo_articulo");



ALTER TABLE ONLY "public"."promociones_bingo"
    ADD CONSTRAINT "promociones_bingo_pkey" PRIMARY KEY ("id");



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



CREATE UNIQUE INDEX "bingo_games_one_active_per_customer" ON "public"."bingo_games" USING "btree" ("customer_phone") WHERE ("status" = 'active'::"text");



CREATE UNIQUE INDEX "bingo_un_carton_activo_por_cliente" ON "public"."bingo_cartones" USING "btree" ("cliente_id") WHERE ("estado" = 'activo'::"text");



CREATE INDEX "clientes_favoritos_cliente_idx" ON "public"."clientes_favoritos" USING "btree" ("cliente_id");



CREATE INDEX "clientes_nombre_idx" ON "public"."clientes" USING "btree" ("nombre");



CREATE INDEX "clientes_telefono_idx" ON "public"."clientes" USING "btree" ("telefono");



CREATE UNIQUE INDEX "clientes_token_idx" ON "public"."clientes" USING "btree" ("token");



CREATE INDEX "game_entitlements_code_idx" ON "public"."game_entitlements" USING "btree" ("code");



CREATE INDEX "game_entitlements_customer_token_idx" ON "public"."game_entitlements" USING "btree" ("customer_token");



CREATE INDEX "idx_promociones_ruleta_activa" ON "public"."promociones_ruleta" USING "btree" ("activa");



CREATE INDEX "idx_promociones_ruleta_articulos_codigo" ON "public"."promociones_ruleta_articulos" USING "btree" ("codigo_articulo");



CREATE INDEX "idx_promociones_ruleta_articulos_promocion" ON "public"."promociones_ruleta_articulos" USING "btree" ("promocion_id");



CREATE INDEX "idx_promotion_participations_code" ON "public"."promotion_participations" USING "btree" ("code");



CREATE INDEX "idx_promotion_participations_created_at" ON "public"."promotion_participations" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_promotion_participations_order_id" ON "public"."promotion_participations" USING "btree" ("order_id");



CREATE INDEX "idx_promotion_participations_promotion_id" ON "public"."promotion_participations" USING "btree" ("promotion_id");



CREATE INDEX "idx_promotion_participations_status" ON "public"."promotion_participations" USING "btree" ("status");



CREATE INDEX "idx_ruleta_tiradas_fecha" ON "public"."promociones_ruleta_tiradas" USING "btree" ("created_at" DESC);



CREATE INDEX "promociones_bingo_articulos_promocion_idx" ON "public"."promociones_bingo_articulos" USING "btree" ("promocion_id");



CREATE OR REPLACE TRIGGER "bingo_games_keep_last_two_completed" AFTER INSERT OR UPDATE OF "status", "completed_at" ON "public"."bingo_games" FOR EACH ROW EXECUTE FUNCTION "public"."keep_last_two_completed_bingo_games"();



CREATE OR REPLACE TRIGGER "clientes_updated_at" BEFORE UPDATE ON "public"."clientes" FOR EACH ROW EXECUTE FUNCTION "public"."actualizar_updated_at_clientes"();



CREATE OR REPLACE TRIGGER "promotion_participation_create_bingo" AFTER INSERT ON "public"."promotion_participations" FOR EACH ROW EXECUTE FUNCTION "public"."attach_bingo_game_to_participation"();



CREATE OR REPLACE TRIGGER "trg_promotion_participations_updated_at" BEFORE UPDATE ON "public"."promotion_participations" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."articulos"
    ADD CONSTRAINT "articulos_departamento_id_fkey" FOREIGN KEY ("departamento_id") REFERENCES "public"."departamentos"("id");



ALTER TABLE ONLY "public"."bingo_cards"
    ADD CONSTRAINT "bingo_cards_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bingo_cards"
    ADD CONSTRAINT "bingo_cards_entitlement_id_fkey" FOREIGN KEY ("entitlement_id") REFERENCES "public"."bingo_entitlements"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bingo_cards"
    ADD CONSTRAINT "bingo_cards_promotion_id_fkey" FOREIGN KEY ("promotion_id") REFERENCES "public"."promociones_bingo"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bingo_cartones"
    ADD CONSTRAINT "bingo_cartones_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bingo_draws"
    ADD CONSTRAINT "bingo_draws_promotion_id_fkey" FOREIGN KEY ("promotion_id") REFERENCES "public"."promociones_bingo"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bingo_entitlements"
    ADD CONSTRAINT "bingo_entitlements_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bingo_entitlements"
    ADD CONSTRAINT "bingo_entitlements_promotion_id_fkey" FOREIGN KEY ("promotion_id") REFERENCES "public"."promociones_bingo"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bingo_games"
    ADD CONSTRAINT "bingo_games_participation_id_fkey" FOREIGN KEY ("created_from_participation_id") REFERENCES "public"."promotion_participations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."clientes_favoritos"
    ADD CONSTRAINT "clientes_favoritos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ofertas"
    ADD CONSTRAINT "ofertas_articulo_id_fkey" FOREIGN KEY ("articulo_id") REFERENCES "public"."articulos"("id");



ALTER TABLE ONLY "public"."promociones_bingo_articulos"
    ADD CONSTRAINT "promociones_bingo_articulos_articulo_id_fkey" FOREIGN KEY ("articulo_id") REFERENCES "public"."articulos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."promociones_bingo_articulos"
    ADD CONSTRAINT "promociones_bingo_articulos_promocion_id_fkey" FOREIGN KEY ("promocion_id") REFERENCES "public"."promociones_bingo"("id") ON DELETE CASCADE;



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



ALTER TABLE ONLY "public"."promotion_participations"
    ADD CONSTRAINT "promotion_participations_bingo_game_id_fkey" FOREIGN KEY ("bingo_game_id") REFERENCES "public"."bingo_games"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."push_articulos"
    ADD CONSTRAINT "push_articulos_push_id_fkey" FOREIGN KEY ("push_id") REFERENCES "public"."push_ofertas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."push_calendario"
    ADD CONSTRAINT "push_calendario_push_id_fkey" FOREIGN KEY ("push_id") REFERENCES "public"."push_ofertas"("id") ON DELETE CASCADE;



CREATE POLICY "Allow insert promotion participations" ON "public"."promotion_participations" FOR INSERT WITH CHECK (true);



CREATE POLICY "Allow read promotion participations" ON "public"."promotion_participations" FOR SELECT USING (true);



CREATE POLICY "Allow update promotion participations" ON "public"."promotion_participations" FOR UPDATE USING (true) WITH CHECK (true);



ALTER TABLE "public"."bingo_cards" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bingo_cartones" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bingo_draws" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bingo_entitlements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."clientes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "clientes_delete_anon" ON "public"."clientes" FOR DELETE TO "anon" USING (true);



ALTER TABLE "public"."clientes_favoritos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "clientes_favoritos_delete_anon" ON "public"."clientes_favoritos" FOR DELETE TO "anon" USING (true);



CREATE POLICY "clientes_favoritos_insert_anon" ON "public"."clientes_favoritos" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "clientes_favoritos_select_anon" ON "public"."clientes_favoritos" FOR SELECT TO "anon" USING (true);



CREATE POLICY "clientes_insert_anon" ON "public"."clientes" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "clientes_select_anon" ON "public"."clientes" FOR SELECT TO "anon" USING (true);



CREATE POLICY "clientes_update_anon" ON "public"."clientes" FOR UPDATE TO "anon" USING (true) WITH CHECK (true);



ALTER TABLE "public"."estadisticas_articulos_dia" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."estadisticas_movimientos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."estadisticas_pedidos_dia" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."game_entitlements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."promociones_bingo" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."promociones_bingo_articulos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "promociones_bingo_articulos_escritura" ON "public"."promociones_bingo_articulos" TO "authenticated", "anon" USING (true) WITH CHECK (true);



CREATE POLICY "promociones_bingo_articulos_lectura" ON "public"."promociones_bingo_articulos" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "promociones_bingo_escritura" ON "public"."promociones_bingo" TO "authenticated", "anon" USING (true) WITH CHECK (true);



CREATE POLICY "promociones_bingo_lectura" ON "public"."promociones_bingo" FOR SELECT TO "authenticated", "anon" USING (true);



ALTER TABLE "public"."promociones_ruleta_tiradas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."promotion_participations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "public read bingo draws" ON "public"."bingo_draws" FOR SELECT USING (true);



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



GRANT ALL ON FUNCTION "public"."actualizar_updated_at_clientes"() TO "anon";
GRANT ALL ON FUNCTION "public"."actualizar_updated_at_clientes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."actualizar_updated_at_clientes"() TO "service_role";



GRANT ALL ON FUNCTION "public"."attach_bingo_game_to_participation"() TO "anon";
GRANT ALL ON FUNCTION "public"."attach_bingo_game_to_participation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."attach_bingo_game_to_participation"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cantar_bola_bingo"("p_promocion_id" "uuid", "p_numero" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."cantar_bola_bingo"("p_promocion_id" "uuid", "p_numero" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cantar_bola_bingo"("p_promocion_id" "uuid", "p_numero" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."consume_game_bingo_play"("p_entitlement_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."consume_game_bingo_play"("p_entitlement_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."consume_game_bingo_play"("p_entitlement_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."consume_game_bingo_play_by_code"("p_code" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."consume_game_bingo_play_by_code"("p_code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."consume_game_bingo_play_by_code"("p_code" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."consume_game_roulette_play_by_code"("p_code" "text", "p_prize_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."consume_game_roulette_play_by_code"("p_code" "text", "p_prize_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."consume_game_roulette_play_by_code"("p_code" "text", "p_prize_id" "text") TO "service_role";



GRANT ALL ON TABLE "public"."game_entitlements" TO "service_role";



GRANT ALL ON FUNCTION "public"."create_or_update_game_entitlement"("p_order_id" "text", "p_customer_token" "text", "p_customer_name" "text", "p_roulette_participation_id" "uuid", "p_roulette_eligible" boolean, "p_roulette_plays_total" integer, "p_bingo_eligible" boolean, "p_bingo_reference" "jsonb", "p_expires_at" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."create_or_update_game_entitlement"("p_order_id" "text", "p_customer_token" "text", "p_customer_name" "text", "p_roulette_participation_id" "uuid", "p_roulette_eligible" boolean, "p_roulette_plays_total" integer, "p_bingo_eligible" boolean, "p_bingo_reference" "jsonb", "p_expires_at" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_or_update_game_entitlement"("p_order_id" "text", "p_customer_token" "text", "p_customer_name" "text", "p_roulette_participation_id" "uuid", "p_roulette_eligible" boolean, "p_roulette_plays_total" integer, "p_bingo_eligible" boolean, "p_bingo_reference" "jsonb", "p_expires_at" timestamp with time zone) TO "service_role";



GRANT ALL ON TABLE "public"."promotion_participations" TO "anon";
GRANT ALL ON TABLE "public"."promotion_participations" TO "authenticated";
GRANT ALL ON TABLE "public"."promotion_participations" TO "service_role";



GRANT ALL ON FUNCTION "public"."create_promotion_participation"("p_promotion_id" "uuid", "p_order_id" "uuid", "p_customer_phone" "text", "p_customer_name" "text", "p_expires_at" timestamp with time zone, "p_created_by" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_promotion_participation"("p_promotion_id" "uuid", "p_order_id" "uuid", "p_customer_phone" "text", "p_customer_name" "text", "p_expires_at" timestamp with time zone, "p_created_by" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_promotion_participation"("p_promotion_id" "uuid", "p_order_id" "uuid", "p_customer_phone" "text", "p_customer_name" "text", "p_expires_at" timestamp with time zone, "p_created_by" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_customer_bingo_card"("p_token" "text", "p_carton" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_customer_bingo_card"("p_token" "text", "p_carton" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_customer_bingo_card"("p_token" "text", "p_carton" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_game_bingo_card_by_code"("p_code" "text", "p_carton" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_game_bingo_card_by_code"("p_code" "text", "p_carton" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_game_bingo_card_by_code"("p_code" "text", "p_carton" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."finalize_game_bingo_ball_by_code"("p_code" "text", "p_reservation_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."finalize_game_bingo_ball_by_code"("p_code" "text", "p_reservation_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."finalize_game_bingo_ball_by_code"("p_code" "text", "p_reservation_token" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_bingo_card"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_bingo_card"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_bingo_card"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_game_entitlement_code"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_game_entitlement_code"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_game_entitlement_code"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_promotion_code"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_promotion_code"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_promotion_code"() TO "service_role";



GRANT ALL ON FUNCTION "public"."keep_last_two_completed_bingo_games"() TO "anon";
GRANT ALL ON FUNCTION "public"."keep_last_two_completed_bingo_games"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."keep_last_two_completed_bingo_games"() TO "service_role";



GRANT ALL ON FUNCTION "public"."nuevo_bingo"("p_promocion_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."nuevo_bingo"("p_promocion_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."nuevo_bingo"("p_promocion_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."obtener_o_crear_carton_bingo"("p_token" "text", "p_carton" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."obtener_o_crear_carton_bingo"("p_token" "text", "p_carton" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."obtener_o_crear_carton_bingo"("p_token" "text", "p_carton" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."play_promotion_participation"("p_code" "text", "p_used_by" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."play_promotion_participation"("p_code" "text", "p_used_by" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."play_promotion_participation"("p_code" "text", "p_used_by" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."register_promotion_spin"("p_participation_id" "uuid", "p_prize_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."register_promotion_spin"("p_participation_id" "uuid", "p_prize_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."register_promotion_spin"("p_participation_id" "uuid", "p_prize_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."registrar_pedido_bingo"("p_token" "text", "p_order_id" "text", "p_items" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."registrar_pedido_bingo"("p_token" "text", "p_order_id" "text", "p_items" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."registrar_pedido_bingo"("p_token" "text", "p_order_id" "text", "p_items" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."reserve_game_bingo_ball_by_code"("p_code" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."reserve_game_bingo_ball_by_code"("p_code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reserve_game_bingo_ball_by_code"("p_code" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."resolve_game_entitlement"("p_code" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."resolve_game_entitlement"("p_code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."resolve_game_entitlement"("p_code" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."use_promotion_participation"("p_code" "text", "p_prize_id" "uuid", "p_used_by" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."use_promotion_participation"("p_code" "text", "p_prize_id" "uuid", "p_used_by" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."use_promotion_participation"("p_code" "text", "p_prize_id" "uuid", "p_used_by" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_game_qr"("p_code" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."validate_game_qr"("p_code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_game_qr"("p_code" "text") TO "service_role";



GRANT ALL ON TABLE "public"."articulos" TO "anon";
GRANT ALL ON TABLE "public"."articulos" TO "authenticated";
GRANT ALL ON TABLE "public"."articulos" TO "service_role";



GRANT ALL ON SEQUENCE "public"."articulos_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."articulos_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."articulos_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."bingo_cards" TO "anon";
GRANT ALL ON TABLE "public"."bingo_cards" TO "authenticated";
GRANT ALL ON TABLE "public"."bingo_cards" TO "service_role";



GRANT ALL ON TABLE "public"."bingo_cartones" TO "anon";
GRANT ALL ON TABLE "public"."bingo_cartones" TO "authenticated";
GRANT ALL ON TABLE "public"."bingo_cartones" TO "service_role";



GRANT ALL ON TABLE "public"."bingo_draws" TO "anon";
GRANT ALL ON TABLE "public"."bingo_draws" TO "authenticated";
GRANT ALL ON TABLE "public"."bingo_draws" TO "service_role";



GRANT ALL ON SEQUENCE "public"."bingo_draws_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."bingo_draws_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."bingo_draws_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."bingo_entitlements" TO "anon";
GRANT ALL ON TABLE "public"."bingo_entitlements" TO "authenticated";
GRANT ALL ON TABLE "public"."bingo_entitlements" TO "service_role";



GRANT ALL ON TABLE "public"."bingo_games" TO "anon";
GRANT ALL ON TABLE "public"."bingo_games" TO "authenticated";
GRANT ALL ON TABLE "public"."bingo_games" TO "service_role";



GRANT ALL ON TABLE "public"."clientes" TO "anon";
GRANT ALL ON TABLE "public"."clientes" TO "authenticated";
GRANT ALL ON TABLE "public"."clientes" TO "service_role";



GRANT ALL ON TABLE "public"."clientes_favoritos" TO "anon";
GRANT ALL ON TABLE "public"."clientes_favoritos" TO "authenticated";
GRANT ALL ON TABLE "public"."clientes_favoritos" TO "service_role";



GRANT ALL ON SEQUENCE "public"."clientes_favoritos_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."clientes_favoritos_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."clientes_favoritos_id_seq" TO "service_role";



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



GRANT ALL ON TABLE "public"."promociones_bingo" TO "anon";
GRANT ALL ON TABLE "public"."promociones_bingo" TO "authenticated";
GRANT ALL ON TABLE "public"."promociones_bingo" TO "service_role";



GRANT ALL ON TABLE "public"."promociones_bingo_articulos" TO "anon";
GRANT ALL ON TABLE "public"."promociones_bingo_articulos" TO "authenticated";
GRANT ALL ON TABLE "public"."promociones_bingo_articulos" TO "service_role";



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







