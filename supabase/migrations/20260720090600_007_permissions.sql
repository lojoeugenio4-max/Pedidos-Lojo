-- Cash Lojo: migración incremental de STAGING a PRODUCCIÓN
-- Solo estructura. No copia datos de staging.
-- Conserva todas las filas existentes en producción.
-- Generado a partir de los dumps aportados por el usuario.

BEGIN;

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

GRANT ALL ON FUNCTION "public"."keep_last_two_completed_bingo_games"() TO "anon";

GRANT ALL ON FUNCTION "public"."keep_last_two_completed_bingo_games"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."keep_last_two_completed_bingo_games"() TO "service_role";

GRANT ALL ON FUNCTION "public"."nuevo_bingo"("p_promocion_id" "uuid") TO "anon";

GRANT ALL ON FUNCTION "public"."nuevo_bingo"("p_promocion_id" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."nuevo_bingo"("p_promocion_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."obtener_o_crear_carton_bingo"("p_token" "text", "p_carton" "jsonb") TO "anon";

GRANT ALL ON FUNCTION "public"."obtener_o_crear_carton_bingo"("p_token" "text", "p_carton" "jsonb") TO "authenticated";

GRANT ALL ON FUNCTION "public"."obtener_o_crear_carton_bingo"("p_token" "text", "p_carton" "jsonb") TO "service_role";

GRANT ALL ON FUNCTION "public"."registrar_pedido_bingo"("p_token" "text", "p_order_id" "text", "p_items" "jsonb") TO "anon";

GRANT ALL ON FUNCTION "public"."registrar_pedido_bingo"("p_token" "text", "p_order_id" "text", "p_items" "jsonb") TO "authenticated";

GRANT ALL ON FUNCTION "public"."registrar_pedido_bingo"("p_token" "text", "p_order_id" "text", "p_items" "jsonb") TO "service_role";

GRANT ALL ON FUNCTION "public"."reserve_game_bingo_ball_by_code"("p_code" "text") TO "anon";

GRANT ALL ON FUNCTION "public"."reserve_game_bingo_ball_by_code"("p_code" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."reserve_game_bingo_ball_by_code"("p_code" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."resolve_game_entitlement"("p_code" "text") TO "anon";

GRANT ALL ON FUNCTION "public"."resolve_game_entitlement"("p_code" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."resolve_game_entitlement"("p_code" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."validate_game_qr"("p_code" "text") TO "anon";

GRANT ALL ON FUNCTION "public"."validate_game_qr"("p_code" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."validate_game_qr"("p_code" "text") TO "service_role";

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

GRANT ALL ON TABLE "public"."promociones_bingo" TO "anon";

GRANT ALL ON TABLE "public"."promociones_bingo" TO "authenticated";

GRANT ALL ON TABLE "public"."promociones_bingo" TO "service_role";

GRANT ALL ON TABLE "public"."promociones_bingo_articulos" TO "anon";

GRANT ALL ON TABLE "public"."promociones_bingo_articulos" TO "authenticated";

GRANT ALL ON TABLE "public"."promociones_bingo_articulos" TO "service_role";

COMMIT;
