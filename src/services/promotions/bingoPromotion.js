import { PROMOTION_TYPES } from "./promotionTypes";

export const bingoPromotion = Object.freeze({
  id: "bingo",
  type: PROMOTION_TYPES.BINGO,
  enabled: false,

  evaluate({ order, customer, config = {} }) {
    if (!customer?.id) {
      return {
        eligible: false,
        reason: "customer_not_identified",
      };
    }

    const totalUnits = Number(order?.totalUnits ?? 0);
    const minimumUnits = Number(config.minimumUnits ?? 25);

    if (totalUnits < minimumUnits) {
      return {
        eligible: false,
        reason: "minimum_units_not_reached",
        metadata: {
          totalUnits,
          minimumUnits,
        },
      };
    }

    return {
      eligible: true,
      reason: "eligible",
      metadata: {
        numbersEarned: 1,
        totalUnits,
        minimumUnits,
      },
    };
  },
});