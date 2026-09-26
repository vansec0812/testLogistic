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
    minPhotoCount: 7,
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
    onTimeToleranceMinutes: 15,
    lateThresholdMinutes: 15,
    noShowMinutes: 30,
    completesAtPickup: true,
  },
  dispute: {
    openWindowDays: 7,
    responseHours: 48,
    appealWindowHours: 48,
  },
  rating: {
    deadlineDays: 7,
    minimumCompletedTransactions: 5,
    weights: {
      completion: 0.25,
      punctuality: 0.25,
      rating: 0.2,
      dispute: 0.15,
      accuracy: 0.15,
    },
  },
} as const;

export const OFFER_PHOTO_ANGLES = [
  "front",
  "left_side",
  "right_side",
  "rear",
  "roof",
  "underbody",
  "floor",
] as const;

export type OfferPhotoAngle = (typeof OFFER_PHOTO_ANGLES)[number];

export const OFFER_PHOTO_ANGLE_LABELS = [
  "Mặt trước",
  "Mặt trái",
  "Mặt phải",
  "Mặt sau",
  "Mặt trên",
  "Mặt dưới",
  "Mặt sàn",
] as const;

export const OFFER_PHOTO_ANGLE_SHORT_LABELS = [
  "Mặt trước",
  "Mặt trái",
  "Mặt phải",
  "Mặt sau",
  "Mặt trên",
  "Mặt dưới",
  "Mặt sàn",
] as const;

/**
 * Bộ ảnh bắt buộc khi kiểm tra thực địa ở Bước 5 của giao dịch.
 * Thứ tự này là thứ tự hiển thị và được dùng chung cho UI/guard/thông báo.
 */
export const INSPECTION_PHOTO_ANGLE_LABELS = [
  "Mặt trước container",
  "Cửa sau container",
  "Vách trái",
  "Vách phải",
  "Bên trong container",
  "Sàn cont",
  "Tem số container/CSC plate",
] as const;

export const REQUIRED_INSPECTION_PHOTO_COUNT =
  INSPECTION_PHOTO_ANGLE_LABELS.length;

export const DEFAULT_BASELINE_DEPOT_COST_VND =
  QA_RULES.pricing.defaultBaselineDepotCostVnd;
export const DEFAULT_BASELINE_PICKUP_COST_VND =
  QA_RULES.pricing.defaultBaselinePickupCostVnd;

export const PAYMENT_DEADLINE_MS =
  QA_RULES.payment.deadlineHours * 60 * 60 * 1000;
export const CARRIER_TIMEOUT_MS =
  QA_RULES.carrier.responseTimeoutHours * 60 * 60 * 1000;
export const MATCH_EXPIRY_MS =
  QA_RULES.matching.matchExpiryHours * 60 * 60 * 1000;

export function isWithinDisputeWindow(
  completedAt: string,
  now = Date.now(),
): boolean {
  return (
    now - new Date(completedAt).getTime() <=
    QA_RULES.dispute.openWindowDays * 24 * 60 * 60 * 1000
  );
}

// ==================== DISPUTE APPEAL (Câu 47) ====================
export const APPEAL_WINDOW_HOURS = QA_RULES.dispute.appealWindowHours;
export const APPEAL_WINDOW_MS = APPEAL_WINDOW_HOURS * 60 * 60 * 1000;

export function isWithinAppealWindow(
  c: {
    status?: string;
    resolution?: { resolvedAt?: string };
    appealWindowExpiresAt?: string;
  },
  now = Date.now(),
): boolean {
  if (c.status !== "RESOLVED") return false;
  if (c.appealWindowExpiresAt) {
    return now <= new Date(c.appealWindowExpiresAt).getTime();
  }
  if (c.resolution?.resolvedAt) {
    return (
      now - new Date(c.resolution.resolvedAt).getTime() <= APPEAL_WINDOW_MS
    );
  }
  return false;
}

export function getAppealWindowRemainingMs(
  c: {
    status?: string;
    resolution?: { resolvedAt?: string };
    appealWindowExpiresAt?: string;
  },
  now = Date.now(),
): number {
  if (c.status !== "RESOLVED") return 0;
  let expiresAtMs = 0;
  if (c.appealWindowExpiresAt) {
    expiresAtMs = new Date(c.appealWindowExpiresAt).getTime();
  } else if (c.resolution?.resolvedAt) {
    expiresAtMs =
      new Date(c.resolution.resolvedAt).getTime() + APPEAL_WINDOW_MS;
  }
  return Math.max(0, expiresAtMs - now);
}

export function formatAppealCountdown(remainingMs: number): string {
  if (remainingMs <= 0) return "Đã hết hạn kháng nghị";
  const totalMinutes = Math.floor(remainingMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) {
    return `Còn ${hours} giờ ${minutes} phút`;
  }
  return `Còn ${minutes} phút`;
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
  if (
    input.completedTransactions < QA_RULES.rating.minimumCompletedTransactions
  ) {
    return { score: null, isPublished: false, label: "NEW" };
  }
  const normalizedRating =
    (Math.max(0, Math.min(5, input.averageRating)) / 5) * 100;
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
    label: score >= 90 ? "Rất tốt" : score >= 80 ? "Tốt" : "Cần xem chi tiết",
  };
}

import { Company, CompanyPenalty, PenaltyLevel, ViolationType } from "../types";

export interface PenaltyRuleConfig {
  level: PenaltyLevel;
  name: string;
  defaultDeduction: number;
  minDeduction: number;
  maxDeduction: number;
  matchingDeprioritizedDays?: number;
  locksNewTrading?: boolean;
  suspendsAccount?: boolean;
  isBlacklist?: boolean;
  description: string;
}

/**
 * Ma trận Phân cấp Sai phạm & Chế tài Doanh nghiệp (Câu 46 - Trust Score & Penalty Matrix)
 */
export const PENALTY_MATRIX: Record<ViolationType, PenaltyRuleConfig> = {
  // Level 1 (Nhẹ): Trễ hẹn >15p, phản hồi chat chậm >24h → Tự động trừ 1–2 điểm Trust Score
  LATE_APPOINTMENT_15M: {
    level: "LEVEL_1",
    name: "Trễ hẹn giao nhận >15 phút",
    defaultDeduction: 2,
    minDeduction: 1,
    maxDeduction: 2,
    description:
      "Trễ hẹn so với mốc bàn giao >15 phút mà không có thỏa thuận dời lịch hợp lệ.",
  },
  SLOW_CHAT_RESPONSE_24H: {
    level: "LEVEL_1",
    name: "Phản hồi trao đổi chậm >24 giờ",
    defaultDeduction: 1,
    minDeduction: 1,
    maxDeduction: 2,
    description:
      "Không phản hồi trao đổi trong luồng đàm phán/giao nhận quá 24 giờ.",
  },

  // Level 2 (Vận hành): No-show, hủy giao dịch cận giờ, khai sai quy cách cont → Trừ 5–10 điểm Trust Score + Khóa quyền ưu tiên ghép đôi (Matching Deprioritization) trong X ngày
  NO_SHOW: {
    level: "LEVEL_2",
    name: "No-show không xuất hiện giao nhận",
    defaultDeduction: 10,
    minDeduction: 5,
    maxDeduction: 10,
    matchingDeprioritizedDays: 7,
    description:
      "Không xuất hiện tại điểm giao nhận sau 30 phút mà không có thỏa thuận thay đổi hợp lệ.",
  },
  LATE_CANCELLATION: {
    level: "LEVEL_2",
    name: "Hủy giao dịch cận giờ",
    defaultDeduction: 8,
    minDeduction: 5,
    maxDeduction: 10,
    matchingDeprioritizedDays: 5,
    description:
      "Hủy giao dịch sau khi hãng tàu đã duyệt RU hoặc sát giờ điều phối xe gây thiệt hại.",
  },
  WRONG_SPECIFICATION: {
    level: "LEVEL_2",
    name: "Khai sai quy cách/tình trạng container",
    defaultDeduction: 7,
    minDeduction: 5,
    maxDeduction: 10,
    matchingDeprioritizedDays: 7,
    description:
      "Khai sai loại cont, sai năm sản xuất hoặc che giấu hư hỏng hiện trường so với thực tế.",
  },

  // Level 3 (Tài chính): Không thanh toán đúng hạn 2 giờ, chậm nộp phí RU → Khóa chức năng giao dịch mới, cảnh báo đình chỉ tài khoản
  PAYMENT_OVERDUE_2H: {
    level: "LEVEL_3",
    name: "Không thanh toán đúng hạn 2 giờ",
    defaultDeduction: 15,
    minDeduction: 10,
    maxDeduction: 20,
    locksNewTrading: true,
    suspendsAccount: true,
    description:
      "Quá hạn thanh toán 2 giờ kể từ khi lệnh thu tiền được kích hoạt.",
  },
  RU_FEE_OVERDUE: {
    level: "LEVEL_3",
    name: "Chậm nộp phí RU hãng tàu",
    defaultDeduction: 12,
    minDeduction: 10,
    maxDeduction: 15,
    locksNewTrading: true,
    suspendsAccount: true,
    description:
      "Chậm hoàn tất nộp phí Round-Use cho hãng tàu dẫn đến giao dịch bị đình trệ.",
  },

  // Level 4 (Gian lận): Làm giả ảnh giám định, giả số cont, tráo vỏ mục nát → Đưa vào blacklist, đình chỉ tài khoản vĩnh viễn (CompanyStatus: BLOCKED)
  AI_INSPECTION_FRAUD: {
    level: "LEVEL_4",
    name: "Làm giả ảnh giám định",
    defaultDeduction: 100,
    minDeduction: 100,
    maxDeduction: 100,
    locksNewTrading: true,
    suspendsAccount: true,
    isBlacklist: true,
    description:
      "Làm giả, tải ảnh cũ hoặc can thiệp kỹ thuật số vào ảnh kiểm định AI container.",
  },
  FAKE_CONTAINER_NUMBER: {
    level: "LEVEL_4",
    name: "Giả mạo số container",
    defaultDeduction: 100,
    minDeduction: 100,
    maxDeduction: 100,
    locksNewTrading: true,
    suspendsAccount: true,
    isBlacklist: true,
    description:
      "Cung cấp số container giả, không tồn tại hoặc không thuộc quyền sở hữu/quản lý.",
  },
  SWAP_DAMAGED_CONTAINER: {
    level: "LEVEL_4",
    name: "Tráo vỏ container mục nát",
    defaultDeduction: 100,
    minDeduction: 100,
    maxDeduction: 100,
    locksNewTrading: true,
    suspendsAccount: true,
    isBlacklist: true,
    description:
      "Cố tình tráo giao container mục nát, rách vách, thủng nóc hỏng sàn khác với hợp đồng.",
  },
  OTHER: {
    level: "LEVEL_1",
    name: "Vi phạm quy chế khác",
    defaultDeduction: 2,
    minDeduction: 1,
    maxDeduction: 5,
    description:
      "Vi phạm quy định vận hành hoặc thỏa thuận giao nhận theo quyết định của Ops.",
  },
};

export const PENALTY_LEVEL_INFO: Record<
  PenaltyLevel,
  { label: string; badgeClass: string; summary: string }
> = {
  LEVEL_1: {
    label: "Level 1: Nhẹ",
    badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
    summary: "Tự động trừ 1–2 điểm Trust Score",
  },
  LEVEL_2: {
    label: "Level 2: Vận hành",
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
    summary:
      "Trừ 5–10 điểm Trust Score + Khóa quyền ưu tiên ghép đôi (Matching Deprioritization) trong X ngày",
  },
  LEVEL_3: {
    label: "Level 3: Tài chính",
    badgeClass: "bg-rose-50 text-rose-700 border-rose-200",
    summary: "Khóa chức năng giao dịch mới + Cảnh báo đình chỉ tài khoản",
  },
  LEVEL_4: {
    label: "Level 4: Gian lận",
    badgeClass: "bg-red-900 text-white border-red-950 font-bold",
    summary: "Đưa vào Blacklist + Đình chỉ tài khoản vĩnh viễn (BLOCKED)",
  },
};

/**
 * Kiểm tra xem doanh nghiệp có đang bị giảm quyền ưu tiên ghép đôi hay không
 */
export function isCompanyMatchingDeprioritized(
  company?: Company | null,
  nowMs = Date.now(),
): boolean {
  if (!company?.matchingDeprioritizedUntil) return false;
  return new Date(company.matchingDeprioritizedUntil).getTime() > nowMs;
}

/**
 * Kiểm tra xem doanh nghiệp có bị khóa chức năng giao dịch mới hay đình chỉ tài khoản không
 */
export function isCompanyTradingBlocked(company?: Company | null): {
  blocked: boolean;
  reason?: string;
} {
  if (!company) return { blocked: false };
  if (company.verificationStatus === "BLOCKED" || company.isBlacklisted) {
    return {
      blocked: true,
      reason:
        "Tài khoản doanh nghiệp đã bị đưa vào Blacklist và đình chỉ vĩnh viễn (BLOCKED) do vi phạm gian lận Level 4.",
    };
  }
  if (
    company.verificationStatus === "SUSPENDED" ||
    company.isTradingBlocked ||
    company.isOnHold
  ) {
    return {
      blocked: true,
      reason:
        company.tradingBlockedReason ||
        "Tài khoản đang bị khóa chức năng tạo giao dịch mới do vi phạm nghĩa vụ hoặc chế tài Level 3.",
    };
  }
  return { blocked: false };
}

/**
 * Áp dụng chế tài và tính toán điểm trừ Trust Score theo từng vụ việc (Câu 46)
 */
export function applyCompanyPenalty(
  company: Company,
  penalty: {
    id?: string;
    level: PenaltyLevel;
    violationType: ViolationType;
    title?: string;
    description?: string;
    scoreDeduction?: number;
    matchingDeprioritizedDays?: number;
    transactionId?: string;
    caseId?: string;
    appliedBy?: string;
  },
  role: "A" | "B" | "BOTH" = "A",
): { updatedCompany: Company; appliedPenalty: CompanyPenalty } {
  const config = PENALTY_MATRIX[penalty.violationType] || PENALTY_MATRIX.OTHER;
  const level = penalty.level || config.level;
  const deduction =
    penalty.scoreDeduction !== undefined
      ? Math.max(0, penalty.scoreDeduction)
      : config.defaultDeduction;
  const now = new Date();
  const appliedAt = now.toISOString();

  let deprioritizedUntil = company.matchingDeprioritizedUntil;
  const deprioritizedDays =
    penalty.matchingDeprioritizedDays !== undefined
      ? penalty.matchingDeprioritizedDays
      : config.matchingDeprioritizedDays;

  if (deprioritizedDays && deprioritizedDays > 0) {
    const untilDate = new Date(
      now.getTime() + deprioritizedDays * 24 * 60 * 60 * 1000,
    );
    if (
      !deprioritizedUntil ||
      new Date(deprioritizedUntil).getTime() < untilDate.getTime()
    ) {
      deprioritizedUntil = untilDate.toISOString();
    }
  }

  const isLevel3 = level === "LEVEL_3";
  const isLevel4 = level === "LEVEL_4";

  const isTradingBlocked = Boolean(
    company.isTradingBlocked || isLevel3 || isLevel4 || config.locksNewTrading,
  );
  const isBlacklisted = Boolean(
    company.isBlacklisted || isLevel4 || config.isBlacklist,
  );

  let verificationStatus = company.verificationStatus;
  if (isLevel4) {
    verificationStatus = "BLOCKED";
  } else if (isLevel3 && verificationStatus === "VERIFIED") {
    verificationStatus = "SUSPENDED";
  }

  // Cập nhật Trust Score
  const currentScoreA = company.trustScoreA ?? 100;
  const currentScoreB = company.trustScoreB ?? 100;

  let newScoreA = currentScoreA;
  let newScoreB = currentScoreB;

  if (isLevel4) {
    newScoreA = 0;
    newScoreB = 0;
  } else {
    if (role === "A" || role === "BOTH") {
      newScoreA = Math.max(0, Math.min(100, currentScoreA - deduction));
    }
    if (role === "B" || role === "BOTH") {
      newScoreB = Math.max(0, Math.min(100, currentScoreB - deduction));
    }
  }

  const newPenaltyRecord: CompanyPenalty = {
    id:
      penalty.id ||
      `PEN-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
    companyId: company.id,
    transactionId: penalty.transactionId,
    caseId: penalty.caseId,
    level,
    violationType: penalty.violationType,
    title: penalty.title || config.name,
    description: penalty.description || config.description,
    scoreDeduction: deduction,
    matchingDeprioritizedDays: deprioritizedDays,
    matchingDeprioritizedUntil: deprioritizedUntil,
    isTradingBlocked,
    isBlacklisted,
    appliedAt,
    appliedBy: penalty.appliedBy || "SYSTEM_AUTO",
    status: "ACTIVE",
  };

  const updatedCompany: Company = {
    ...company,
    trustScoreA: newScoreA,
    trustScoreB: newScoreB,
    verificationStatus,
    isOnHold: isLevel4 ? true : company.isOnHold,
    isTradingBlocked,
    tradingBlockedReason: isTradingBlocked
      ? penalty.title || `${config.name} (${level})`
      : undefined,
    isBlacklisted,
    matchingDeprioritizedUntil: deprioritizedUntil,
    penalties: [newPenaltyRecord, ...(company.penalties || [])],
  };

  return { updatedCompany, appliedPenalty: newPenaltyRecord };
}
