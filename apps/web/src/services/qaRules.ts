/**
 * Quy tac nghiep vu chot sau QA khach hang (logistic.pdf).
 * Day la mot nguon hang so cho cac guard/UI; cac gia tri nay khong duoc
 * lap lai tung noi trong component.
 */
export const QA_RULES = {
  pricing: {
    // Chi phí nội bộ dùng cho quote/matching; không yêu cầu người dùng nhập.
    defaultBaselineDepotCostVnd: 3000000,
    defaultBaselinePickupCostVnd: 3400000,
  },
  offer: {
    minPhotoCount: 6,
    availableWindowRequired: true,
    edoRequired: true,
    oneAvailableOfferPerAsset: true,
  },
  matching: {
    scoreDistanceWeight: 0.3,
    scoreTimeWeight: 0.4,
    scoreCostWeight: 0.3,
    matchExpiryHours: 2,
    carrierIsHardConstraint: true,
    containerTypeIsHardConstraint: true,
    bookingValidityIsHardConstraint: true,
    returnDeadlineIsHardConstraint: false,
  },
  carrier: {
    approvalRequired: true,
    responseTimeoutHours: 24,
  },
  payment: {
    deadlineHours: 3,
    gatewayOutOfScope: true,
  },
  handover: {
    noShowMinutes: 30,
    completesAtPickup: true,
  },
  dispute: {
    openWindowDays: 7,
    responseHours: 48,
  },
  rating: {
    deadlineDays: 7,
    minimumCompletedTransactions: 5,
    weights: {
      completion: 0.25,
      punctuality: 0.25,
      rating: 0.20,
      dispute: 0.15,
      accuracy: 0.15,
    },
  },
} as const;

export const OFFER_PHOTO_ANGLES = [
  'FRONT',
  'DOOR_BACK',
  'LEFT',
  'RIGHT',
  'ROOF',
  'UNDERCARRIAGE',
] as const;

export type OfferPhotoAngle = typeof OFFER_PHOTO_ANGLES[number];

export const OFFER_PHOTO_ANGLE_LABELS = [
  'Mặt trước',
  'Mặt sau',
  'Mặt trái',
  'Mặt phải',
  'Trên nóc',
  'Dưới gầm',
] as const;

export const DEFAULT_BASELINE_DEPOT_COST_VND = QA_RULES.pricing.defaultBaselineDepotCostVnd;
export const DEFAULT_BASELINE_PICKUP_COST_VND = QA_RULES.pricing.defaultBaselinePickupCostVnd;

export const PAYMENT_DEADLINE_MS = QA_RULES.payment.deadlineHours * 60 * 60 * 1000;
export const CARRIER_TIMEOUT_MS = QA_RULES.carrier.responseTimeoutHours * 60 * 60 * 1000;
export const MATCH_EXPIRY_MS = QA_RULES.matching.matchExpiryHours * 60 * 60 * 1000;

export function isWithinDisputeWindow(completedAt: string, now = Date.now()): boolean {
  return now - new Date(completedAt).getTime() <= QA_RULES.dispute.openWindowDays * 24 * 60 * 60 * 1000;
}

export function hasRequiredOfferPhotos(photoUrls: string[]): boolean {
  return photoUrls.filter(Boolean).length >= QA_RULES.offer.minPhotoCount;
}

export function calculateQaTrustScore(input: {
  completedRate: number;
  punctualityRate: number;
  averageRating: number;
  disputeRate: number;
  accuracyRate: number;
  completedTransactions: number;
}): { score: number | null; isPublished: boolean; label: string } {
  if (input.completedTransactions < QA_RULES.rating.minimumCompletedTransactions) {
    return { score: null, isPublished: false, label: 'NEW' };
  }
  const normalizedRating = Math.max(0, Math.min(5, input.averageRating)) / 5 * 100;
  const score = Math.round(
    QA_RULES.rating.weights.completion * input.completedRate * 100 +
    QA_RULES.rating.weights.punctuality * input.punctualityRate * 100 +
    QA_RULES.rating.weights.rating * normalizedRating +
    QA_RULES.rating.weights.dispute * (1 - input.disputeRate) * 100 +
    QA_RULES.rating.weights.accuracy * input.accuracyRate * 100,
  );
  return {
    score,
    isPublished: true,
    label: score >= 90 ? 'Rất tốt' : score >= 80 ? 'Tốt' : 'Cần xem chi tiết',
  };
}
