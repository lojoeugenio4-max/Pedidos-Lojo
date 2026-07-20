export const PROMOTION_QR_STATUS = Object.freeze({
  PENDING: "pending",
  REDEEMED: "redeemed",
  CANCELLED: "cancelled",
});

export function hasPendingPromotionQr(qrCodes, customerId) {
  return qrCodes.some(
    (qr) =>
      qr.customerId === customerId &&
      qr.status === PROMOTION_QR_STATUS.PENDING
  );
}

export function createPromotionQr({
  customerId,
  orderId,
  rewards = {},
  existingQrCodes = [],
}) {
  if (!customerId) {
    throw new Error("customer_id_required");
  }

  if (!orderId) {
    throw new Error("order_id_required");
  }

  if (hasPendingPromotionQr(existingQrCodes, customerId)) {
    throw new Error("customer_already_has_pending_qr");
  }

  const rouletteSpins = Number(rewards.rouletteSpins ?? 0);
  const bingoPlays = Number(rewards.bingoPlays ?? 0);

  if (
    !Number.isInteger(rouletteSpins) ||
    rouletteSpins < 0
  ) {
    throw new Error("invalid_roulette_spins");
  }

  if (
    !Number.isInteger(bingoPlays) ||
    bingoPlays < 0
  ) {
    throw new Error("invalid_bingo_plays");
  }

  if (rouletteSpins === 0 && bingoPlays === 0) {
    throw new Error("promotion_qr_without_rewards");
  }

  return {
    id: crypto.randomUUID(),
    token: crypto.randomUUID(),

    customerId,
    orderId,

    bingoGameId: null,

    rewards: {
      rouletteSpins,
      bingoPlays,
    },

    status: PROMOTION_QR_STATUS.PENDING,

    createdAt: new Date().toISOString(),
    redeemedAt: null,
    cancelledAt: null,
  };
}

export function redeemPromotionQr(qr) {
  if (!qr) {
    throw new Error("promotion_qr_required");
  }

  if (qr.status !== PROMOTION_QR_STATUS.PENDING) {
    throw new Error("promotion_qr_not_pending");
  }

  return {
    ...qr,
    status: PROMOTION_QR_STATUS.REDEEMED,
    redeemedAt: new Date().toISOString(),
  };
}

export function cancelPromotionQr(qr) {
  if (!qr) {
    throw new Error("promotion_qr_required");
  }

  if (qr.status !== PROMOTION_QR_STATUS.PENDING) {
    throw new Error("promotion_qr_not_pending");
  }

  return {
    ...qr,
    status: PROMOTION_QR_STATUS.CANCELLED,
    cancelledAt: new Date().toISOString(),
  };
}