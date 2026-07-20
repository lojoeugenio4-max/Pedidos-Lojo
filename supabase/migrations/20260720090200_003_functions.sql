-- Cash Lojo: migración incremental de STAGING a PRODUCCIÓN
-- Solo estructura. No copia datos de staging.
-- Conserva todas las filas existentes en producción.
-- Generado a partir de los dumps aportados por el usuario.

BEGIN;

CREATE OR REPLACE FUNCTION "public"."actualizar_updated_at_clientes"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."attach_bingo_game_to_participation"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  new_game_id uuid;
begin
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

CREATE OR REPLACE FUNCTION "public"."cantar_bola_bingo"("p_promocion_id" "uuid", "p_numero" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_edition uuid; begin
 select edition_id into v_edition from public.promociones_bingo where id=p_promocion_id;
 insert into public.bingo_draws(promotion_id,edition_id,number) values(p_promocion_id,v_edition,p_numero) on conflict do nothing;
end $$;

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
  v_total := greatest(
    coalesce(v_entry.bingo_plays_total, 0),
    case when coalesce(v_entry.bingo_eligible, false) then 1 else 0 end
  );
  v_used := coalesce(v_entry.bingo_plays_used, 0);
  if v_used >= v_total then
    return jsonb_build_object('ok', false, 'reason', 'used', 'message', 'La bola de Bingo de este pedido ya fue consumida.');
  end if;
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

CREATE OR REPLACE FUNCTION "public"."nuevo_bingo"("p_promocion_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_new uuid:=gen_random_uuid(); begin
 update public.bingo_cards set status=case when bingo_completed then 'won' else 'expired' end where promotion_id=p_promocion_id and status='active';
 update public.promociones_bingo set edition_id=v_new,updated_at=now() where id=p_promocion_id;
 return v_new;
end $$;

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

COMMIT;
