// ==============================================================================
// ECont StatusBadge Component - Hiển thị badge trạng thái chuẩn cho mọi entity
// ==============================================================================

import React from "react";
import {
  OfferStatus,
  RequestStatus,
  TransactionStatus,
  PhysicalCondition,
  PhysicalStatus,
  CompanyStatus,
  PermitStatus,
  CaseStatus,
  AiInspectionStatus,
} from "../types";

interface BadgeProps {
  size?: "xs" | "sm" | "md";
}

interface StatusBadgeInfo {
  label: string;
  className: string;
  dot?: string;
}

function getBadgeClasses(size: "xs" | "sm" | "md") {
  const base =
    "inline-flex items-center gap-1 rounded-full font-semibold border";
  const sizes = {
    xs: "px-2 py-0.5 text-xs font-semibold",
    sm: "px-2.5 py-0.5 text-xs font-bold",
    md: "px-3.5 py-1 text-sm font-bold",
  };
  return `${base} ${sizes[size]}`;
}

// ==================== OFFER STATUS ====================

const OFFER_STATUS_MAP: Record<OfferStatus, StatusBadgeInfo> = {
  AI_CHECK_PENDING: {
    label: "Chá» AI/Ops",
    className: "bg-violet-50 text-violet-700 border-violet-200",
  },
  DRAFT: {
    label: "Nháp",
    className: "bg-slate-100 text-slate-600 border-slate-200",
  },
  UNDER_REVIEW: {
    label: "Đang thẩm định",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  CHANGES_REQUIRED: {
    label: "Cần bổ sung",
    className: "bg-orange-50 text-orange-700 border-orange-200",
  },
  REJECTED: {
    label: "Bị từ chối",
    className: "bg-red-50 text-red-700 border-red-200",
  },
  AVAILABLE: {
    label: "Sẵn sàng",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  HELD: {
    label: "Đang giữ chỗ",
    className: "bg-blue-50 text-blue-700 border-blue-200",
  },
  ALLOCATED: {
    label: "Đã phân bổ",
    className: "bg-violet-50 text-violet-700 border-violet-200",
  },
  FULFILLED: {
    label: "Đã hoàn tất",
    className: "bg-teal-50 text-teal-700 border-teal-200",
  },
  WITHDRAWN: {
    label: "Đã rút",
    className: "bg-slate-100 text-slate-500 border-slate-200",
  },
  EXPIRED: {
    label: "Hết hạn",
    className: "bg-slate-100 text-slate-500 border-slate-200",
  },
};

export const OfferStatusBadge: React.FC<
  { status: OfferStatus } & BadgeProps
> = ({ status, size = "sm" }) => {
  const info = OFFER_STATUS_MAP[status] || {
    label: status,
    className: "bg-slate-100 text-slate-600 border-slate-200",
  };
  return (
    <span className={`${getBadgeClasses(size)} ${info.className}`}>
      {info.label}
    </span>
  );
};

// ==================== REQUEST STATUS ====================

const REQUEST_STATUS_MAP: Record<RequestStatus, StatusBadgeInfo> = {
  DRAFT: {
    label: "Nháp",
    className: "bg-slate-100 text-slate-600 border-slate-200",
  },
  UNDER_REVIEW: {
    label: "Đang xác minh",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  CHANGES_REQUIRED: {
    label: "Cần bổ sung",
    className: "bg-orange-50 text-orange-700 border-orange-200",
  },
  REJECTED: {
    label: "Bị từ chối",
    className: "bg-red-50 text-red-700 border-red-200",
  },
  OPEN: {
    label: "Đang tìm",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  HELD: {
    label: "Đã giữ chỗ",
    className: "bg-blue-50 text-blue-700 border-blue-200",
  },
  ALLOCATED: {
    label: "Đã ghép đôi",
    className: "bg-violet-50 text-violet-700 border-violet-200",
  },
  FULFILLED: {
    label: "Đã hoàn tất",
    className: "bg-teal-50 text-teal-700 border-teal-200",
  },
  WITHDRAWN: {
    label: "Đã rút",
    className: "bg-slate-100 text-slate-500 border-slate-200",
  },
  EXPIRED: {
    label: "Hết hạn",
    className: "bg-slate-100 text-slate-500 border-slate-200",
  },
};

export const RequestStatusBadge: React.FC<
  { status: RequestStatus } & BadgeProps
> = ({ status, size = "sm" }) => {
  const info = REQUEST_STATUS_MAP[status] || {
    label: status,
    className: "bg-slate-100 text-slate-600 border-slate-200",
  };
  return (
    <span className={`${getBadgeClasses(size)} ${info.className}`}>
      {info.label}
    </span>
  );
};

// ==================== TRANSACTION STATUS ====================

const TXN_STATUS_MAP: Record<
  TransactionStatus,
  StatusBadgeInfo & { step?: number }
> = {
  MATCH_REQUESTED: {
    label: "Match chờ nhà cung cấp",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  MATCH_ACCEPTED: {
    label: "Match đã được chấp nhận",
    className: "bg-blue-50 text-blue-700 border-blue-200",
  },
  DISPUTED: {
    label: "Đang tranh chấp",
    className: "bg-rose-50 text-rose-700 border-rose-200",
  },
  PICKUP_REFUSED: {
    label: "Đơn vị cần vỏ từ chối nhận",
    className: "bg-rose-50 text-rose-700 border-rose-200",
  },
  CARRIER_REJECTED: {
    label: "Carrier từ chối",
    className: "bg-red-50 text-red-700 border-red-200",
  },
  PAYMENT_EXPIRED: {
    label: "Quá hạn thanh toán",
    className: "bg-red-50 text-red-700 border-red-200",
  },
  NEGOTIATING: {
    label: "Bước 1 · Thương lượng",
    className: "bg-blue-50 text-blue-700 border-blue-200",
    step: 1,
  },
  PENDING_CARRIER: {
    label: "Bước 2 · Chờ hãng tàu",
    className: "bg-amber-50 text-amber-700 border-amber-200",
    step: 2,
  },
  AWAITING_PAYMENT: {
    label: "Bước 3 · Chờ thanh toán",
    className: "bg-orange-50 text-orange-700 border-orange-200",
    step: 3,
  },
  READY_FOR_PICKUP: {
    label: "Bước 4 · Sẵn sàng lấy",
    className: "bg-cyan-50 text-cyan-700 border-cyan-200",
    step: 4,
  },
  INSPECTION: {
    label: "Bước 5 · Kiểm tra cont",
    className: "bg-indigo-50 text-indigo-700 border-indigo-200",
    step: 5,
  },
  HANDOVER_PENDING: {
    label: "Bước 6 · Chờ bàn giao",
    className: "bg-violet-50 text-violet-700 border-violet-200",
    step: 6,
  },
  COMPLETED: {
    label: "Bước 7 · Hoàn tất ✓",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    step: 7,
  },
  CANCELLED: {
    label: "Đã hủy",
    className: "bg-slate-100 text-slate-500 border-slate-200",
  },
  REJECTED: {
    label: "Hãng tàu từ chối",
    className: "bg-red-50 text-red-700 border-red-200",
  },
  EXPIRED: {
    label: "Hết hạn",
    className: "bg-slate-100 text-slate-500 border-slate-200",
  },
};

export const TransactionStatusBadge: React.FC<
  { status: TransactionStatus } & BadgeProps
> = ({ status, size = "sm" }) => {
  const info = TXN_STATUS_MAP[status] || {
    label: status,
    className: "bg-slate-100 text-slate-600 border-slate-200",
  };
  return (
    <span className={`${getBadgeClasses(size)} ${info.className}`}>
      {info.label}
    </span>
  );
};

// ==================== PHYSICAL CONDITION ====================

const CONDITION_MAP: Record<PhysicalCondition, StatusBadgeInfo> = {
  GOOD: {
    label: "Đạt chuẩn",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  MINOR_DAMAGE: {
    label: "Hư nhẹ",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  MAJOR_DAMAGE: {
    label: "Hư nặng",
    className: "bg-red-50 text-red-700 border-red-200",
  },
};

export const ConditionBadge: React.FC<
  { condition: PhysicalCondition } & BadgeProps
> = ({ condition, size = "sm" }) => {
  const info = CONDITION_MAP[condition];
  return (
    <span className={`${getBadgeClasses(size)} ${info.className}`}>
      {info.label}
    </span>
  );
};

// ==================== PHYSICAL STATUS ====================

const PHYSICAL_STATUS_MAP: Record<PhysicalStatus, StatusBadgeInfo> = {
  AT_CUSTOMER: {
    label: "Tại khách hàng",
    className: "bg-blue-50 text-blue-700 border-blue-200",
  },
  EMPTY_AT_YARD: {
    label: "Rỗng tại kho",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  IN_TRANSIT: {
    label: "Đang vận chuyển",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  EMPTY_AT_DEPOT: {
    label: "Rỗng tại depot",
    className: "bg-teal-50 text-teal-700 border-teal-200",
  },
};

export const PhysicalStatusBadge: React.FC<
  { status: PhysicalStatus } & BadgeProps
> = ({ status, size = "sm" }) => {
  const info = PHYSICAL_STATUS_MAP[status] || {
    label: status,
    className: "bg-slate-100 text-slate-600 border-slate-200",
  };
  return (
    <span className={`${getBadgeClasses(size)} ${info.className}`}>
      {info.label}
    </span>
  );
};

// ==================== COMPANY STATUS ====================

const COMPANY_STATUS_MAP: Record<CompanyStatus, StatusBadgeInfo> = {
  BLOCKED: {
    label: "Bị khóa",
    className: "bg-red-50 text-red-700 border-red-200",
  },
  PENDING_VERIFICATION: {
    label: "Chờ xác minh",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  NEEDS_INFO: {
    label: "Cần bổ sung",
    className: "bg-orange-50 text-orange-700 border-orange-200",
  },
  VERIFIED: {
    label: "Đã xác minh",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  REJECTED: {
    label: "Bị từ chối",
    className: "bg-red-50 text-red-700 border-red-200",
  },
  SUSPENDED: {
    label: "Tạm dừng",
    className: "bg-slate-100 text-slate-600 border-slate-200",
  },
};

export const CompanyStatusBadge: React.FC<
  { status: CompanyStatus } & BadgeProps
> = ({ status, size = "sm" }) => {
  const info = COMPANY_STATUS_MAP[status] || {
    label: status,
    className: "bg-slate-100 text-slate-600 border-slate-200",
  };
  return (
    <span className={`${getBadgeClasses(size)} ${info.className}`}>
      {info.label}
    </span>
  );
};

// ==================== PERMIT STATUS ====================

const PERMIT_STATUS_MAP: Record<PermitStatus, StatusBadgeInfo> = {
  GENERATING: {
    label: "Đang tạo",
    className: "bg-slate-100 text-slate-600 border-slate-200",
  },
  ACTIVE: {
    label: "Đang hiệu lực",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  USED: {
    label: "Đã sử dụng",
    className: "bg-teal-50 text-teal-700 border-teal-200",
  },
  EXPIRED: {
    label: "Hết hạn",
    className: "bg-slate-100 text-slate-500 border-slate-200",
  },
  REVOKED: {
    label: "Đã thu hồi",
    className: "bg-red-50 text-red-700 border-red-200",
  },
  FAILED: {
    label: "Lỗi phát hành",
    className: "bg-red-50 text-red-700 border-red-200",
  },
};

export const PermitStatusBadge: React.FC<
  { status: PermitStatus } & BadgeProps
> = ({ status, size = "sm" }) => {
  const info = PERMIT_STATUS_MAP[status] || {
    label: status,
    className: "bg-slate-100 text-slate-600 border-slate-200",
  };
  return (
    <span className={`${getBadgeClasses(size)} ${info.className}`}>
      {info.label}
    </span>
  );
};

// ==================== CASE STATUS ====================

const CASE_STATUS_MAP: Record<CaseStatus, StatusBadgeInfo> = {
  OPEN: {
    label: "Đang mở",
    className: "bg-red-50 text-red-700 border-red-200",
  },
  IN_REVIEW: {
    label: "Đang xử lý",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  NEEDS_INFO: {
    label: "Cần bổ sung TT",
    className: "bg-orange-50 text-orange-700 border-orange-200",
  },
  APPEAL_PENDING: {
    label: "Chờ tái thẩm tra",
    className: "bg-purple-50 text-purple-700 border-purple-200",
  },
  RESOLVED: {
    label: "Đã giải quyết",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  CLOSED: {
    label: "Đã đóng",
    className: "bg-slate-100 text-slate-500 border-slate-200",
  },
};

export const CaseStatusBadge: React.FC<{ status: CaseStatus } & BadgeProps> = ({
  status,
  size = "sm",
}) => {
  const info = CASE_STATUS_MAP[status] || {
    label: status,
    className: "bg-slate-100 text-slate-600 border-slate-200",
  };
  return (
    <span className={`${getBadgeClasses(size)} ${info.className}`}>
      {info.label}
    </span>
  );
};

// ==================== SCORE BADGE ====================

export const ScoreBadge: React.FC<{ score: number; size?: "sm" | "md" }> = ({
  score,
  size = "sm",
}) => {
  const colorClass =
    score >= 80
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : score >= 60
        ? "bg-amber-50 text-amber-700 border-amber-200"
        : "bg-red-50 text-red-700 border-red-200";
  return (
    <span className={`${getBadgeClasses(size)} ${colorClass} font-mono`}>
      {score}/100
    </span>
  );
};

// ==================== TRUST SCORE ====================

export const TrustScoreBadge: React.FC<{
  score: number | undefined;
  label?: string;
}> = ({ score, label }) => {
  if (score === undefined)
    return <span className="text-xs text-slate-400">Chưa có</span>;
  const colorClass =
    score >= 90
      ? "text-emerald-600"
      : score >= 75
        ? "text-blue-600"
        : score >= 60
          ? "text-amber-600"
          : "text-red-600";
  return (
    <span className={`text-xs font-bold ${colorClass}`} title={label}>
      ★ {score}
      {label && (
        <span className="ml-1 text-slate-400 font-normal">({label})</span>
      )}
    </span>
  );
};

// ==================== AI INSPECTION STATUS ====================

const AI_INSPECTION_STATUS_MAP: Record<AiInspectionStatus, StatusBadgeInfo> = {
  NOT_RUN: {
    label: "Chưa quét AI",
    className: "bg-slate-100 text-slate-600 border-slate-200",
  },
  CLEAN: {
    label: "Đạt chuẩn AI",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  ANOMALY: {
    label: "Phát hiện bất thường",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  INSPECTION_INCOMPLETE: {
    label: "Thiếu ảnh (INCOMPLETE)",
    className: "bg-orange-50 text-orange-700 border-orange-200",
  },
  OPS_VERIFIED: {
    label: "Ops đã duyệt",
    className: "bg-blue-50 text-blue-700 border-blue-200",
  },
  OPS_REJECTED: {
    label: "Ops từ chối",
    className: "bg-red-50 text-red-700 border-red-200",
  },
  ERROR: {
    label: "Lỗi kiểm tra",
    className: "bg-red-50 text-red-700 border-red-200",
  },
};

export const AiInspectionStatusBadge: React.FC<
  { status: AiInspectionStatus } & BadgeProps
> = ({ status, size = "sm" }) => {
  const info = AI_INSPECTION_STATUS_MAP[status] || {
    label: status,
    className: "bg-slate-100 text-slate-600 border-slate-200",
  };
  return (
    <span className={`${getBadgeClasses(size)} ${info.className}`}>
      {info.label}
    </span>
  );
};
