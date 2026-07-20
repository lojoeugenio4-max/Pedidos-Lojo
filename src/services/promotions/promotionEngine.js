import { FEATURES } from "../../config/features";

/**
 * Evalúa un pedido contra todas las promociones registradas.
 *
 * Por ahora no está conectado al flujo real de pedidos.
 * Mientras promotionsEngine sea false, devuelve una lista vacía.
 */
export function evaluatePromotions({ order, customer, promotions = [] }) {
  if (!FEATURES.promotionsEngine) {
    return [];
  }

  if (!order) {
    return [];
  }

  return promotions
    .filter((promotion) => promotion?.enabled)
    .map((promotion) => {
      try {
        const result = promotion.evaluate({
          order,
          customer,
        });

        return {
          promotionId: promotion.id,
          promotionType: promotion.type,
          eligible: Boolean(result?.eligible),
          reason: result?.reason ?? null,
          metadata: result?.metadata ?? {},
        };
      } catch (error) {
        console.error(
          `Error evaluando la promoción ${promotion?.id ?? "desconocida"}`,
          error
        );

        return {
          promotionId: promotion?.id ?? null,
          promotionType: promotion?.type ?? null,
          eligible: false,
          reason: "evaluation_error",
          metadata: {},
        };
      }
    });
}