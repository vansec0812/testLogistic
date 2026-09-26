// ==============================================================================
// ECont TransactionStepper - Version 2.0
// Hiển thị vòng đời giao dịch 7 bước với deadline countdown
// ==============================================================================

import React, { useEffect, useState } from "react";
import { Transaction, TransactionStatus } from "../types";
import { formatCountdown } from "../lib/utils";
import {
  FileText,
  Ship,
  CreditCard,
  QrCode,
  Eye,
  PenTool,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Lock,
} from "lucide-react";

const STEPS: Array<{
  status: TransactionStatus;
  label: string;
  sublabel: string;
  icon: React.ElementType;
  step: number;
}> = [
  {
    status: "NEGOTIATING",
    label: "Thương lượng",
    sublabel: "Ký Thỏa thuận",
    icon: FileText,
    step: 1,
  },
  {
    status: "PENDING_CARRIER",
    label: "Hãng tàu",
    sublabel: "Xin duyệt RU",
    icon: Ship,
    step: 2,
  },
  {
    status: "AWAITING_PAYMENT",
    label: "Thanh toán",
    sublabel: "Nộp tiền ECont",
    icon: CreditCard,
    step: 3,
  },
  {
    status: "READY_FOR_PICKUP",
    label: "Phiếu điều phối",
    sublabel: "Phát DP / QR",
    icon: QrCode,
    step: 4,
  },
  {
    status: "INSPECTION",
    label: "Kiểm tra cont",
    sublabel: "7 ảnh chuẩn IICL",
    icon: Eye,
    step: 5,
  },
  {
    status: "HANDOVER_PENDING",
    label: "Bàn giao",
    sublabel: "Ký 2 chiều",
    icon: PenTool,
    step: 6,
  },
  {
    status: "COMPLETED",
    label: "Hoàn tất",
    sublabel: "Custody chuyển cho đơn vị cần vỏ",
    icon: CheckCircle2,
    step: 7,
  },
];

const TERMINAL_STATUSES: TransactionStatus[] = [
  "CANCELLED",
  "REJECTED",
  "EXPIRED",
  "DISPUTED",
  "PICKUP_REFUSED",
  "CARRIER_REJECTED",
  "PAYMENT_EXPIRED",
];
const STATUS_TO_STEP: Partial<Record<TransactionStatus, number>> = {
  NEGOTIATING: 1,
  PENDING_CARRIER: 2,
  AWAITING_PAYMENT: 3,
  READY_FOR_PICKUP: 4,
  INSPECTION: 5,
  HANDOVER_PENDING: 6,
  COMPLETED: 7,
};

interface TransactionStepperProps {
  transaction: Transaction;
  selectedStep?: number | null;
  onStepClick?: (step: number) => void;
}

export const TransactionStepper: React.FC<TransactionStepperProps> = ({
  transaction,
  selectedStep,
  onStepClick,
}) => {
  const { status, isOnHold, dueAt } = transaction;
  const [countdown, setCountdown] = useState(formatCountdown(dueAt));

  useEffect(() => {
    const isTerminal =
      TERMINAL_STATUSES.includes(status) || status === "COMPLETED";
    if (isTerminal) return;
    const interval = setInterval(() => {
      setCountdown(formatCountdown(dueAt));
    }, 1000);
    return () => clearInterval(interval);
  }, [dueAt, status]);

  const currentStep = STATUS_TO_STEP[status] ?? 0;
  const isTerminal = TERMINAL_STATUSES.includes(status);

  if (isTerminal) {
    const label =
      status === "CANCELLED"
        ? "Giao dịch đã bị HỦY"
        : status === "REJECTED" || status === "CARRIER_REJECTED"
          ? "Hãng tàu TỪ CHỐI duyệt RU"
          : status === "DISPUTED" || status === "PICKUP_REFUSED"
            ? "Giao dịch đang có Case/Dispute"
            : status === "PAYMENT_EXPIRED"
              ? "Quá hạn thanh toán"
              : "Giao dịch HẾT HẠN";
    return (
      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <AlertTriangle className="w-5 h-5 text-slate-400 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-slate-600">{label}</p>
          <p className="text-xs text-slate-400 mt-0.5">
            {transaction.nextAction}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* ON_HOLD Banner */}
      {isOnHold && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <Lock className="w-4 h-4 text-amber-600 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-700">
              ⏸ Giao dịch đang TẠM DỪNG
            </p>
            <p className="text-xs text-amber-600 mt-0.5">
              {transaction.holdReason}
            </p>
          </div>
        </div>
      )}

      {/* Step bar */}
      <div className="relative">
        <div className="flex items-start justify-between gap-0">
          {STEPS.map((step, idx) => {
            const isCompleted = currentStep > step.step;
            const isCurrent = currentStep === step.step;
            const isFuture = currentStep < step.step;
            const isReviewable = step.step < currentStep;
            const isSelected =
              selectedStep === step.step || (selectedStep == null && isCurrent);
            const Icon = step.icon;

            return (
              <React.Fragment key={step.status}>
                {/* Connector line before */}
                {idx > 0 && (
                  <div
                    className={`flex-1 h-0.5 mt-4 mx-0.5 transition-all duration-500 ${
                      isCompleted || currentStep > idx
                        ? "bg-brand-500"
                        : "bg-slate-200"
                    }`}
                  />
                )}

                {/* Step node */}
                <div
                  className={`flex flex-col items-center shrink-0 ${isReviewable ? "cursor-pointer" : ""}`}
                  onClick={() => isReviewable && onStepClick?.(step.step)}
                  onKeyDown={(event) => {
                    if (
                      isReviewable &&
                      (event.key === "Enter" || event.key === " ")
                    ) {
                      event.preventDefault();
                      onStepClick?.(step.step);
                    }
                  }}
                  role={isReviewable ? "button" : undefined}
                  tabIndex={isReviewable ? 0 : undefined}
                  title={
                    isReviewable
                      ? "Xem lại bước đã hoàn tất (chỉ xem)"
                      : step.label
                  }
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                      isSelected && isReviewable
                        ? "bg-white border-brand-500 shadow-md shadow-brand-200 ring-2 ring-brand-200"
                        : isCompleted
                          ? "bg-brand-500 border-brand-500"
                          : isCurrent
                            ? "bg-white border-brand-500 shadow-md shadow-brand-200 ring-2 ring-brand-200"
                            : "bg-white border-slate-200"
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="w-4 h-4 text-white" />
                    ) : (
                      <Icon
                        className={`w-3.5 h-3.5 ${isCurrent ? "text-brand-600" : "text-slate-300"}`}
                      />
                    )}
                  </div>
                  <div
                    className={`mt-1.5 text-center ${isCurrent || isSelected ? "block" : "hidden md:block"}`}
                  >
                    <p
                      className={`text-xs font-bold leading-tight ${
                        isSelected
                          ? "text-brand-700"
                          : isCompleted
                            ? "text-slate-600"
                            : "text-slate-400"
                      }`}
                    >
                      {step.label}
                    </p>
                    <p
                      className={`text-xs leading-tight mt-0.5 ${
                        isSelected
                          ? "text-brand-600 font-medium"
                          : "text-slate-400"
                      }`}
                    >
                      {step.sublabel}
                    </p>
                  </div>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {currentStep > 1 && (
        <p className="text-center text-[11px] text-slate-500">
          Chọn các bước đã hoàn tất để xem lại thông tin đã gửi. Nội dung xem
          lại ở chế độ chỉ đọc.
        </p>
      )}

      {/* Deadline countdown */}
      {!isTerminal && status !== "COMPLETED" && (
        <div className="flex items-center justify-center">
          <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 border border-red-200 bg-red-50 text-red-600 text-xs sm:text-sm font-semibold shadow-xs">
            <Clock className="w-4 h-4 text-red-500 animate-pulse shrink-0" />
            <span>
              {countdown.isExpired
                ? "Đã hết hạn"
                : `Deadline: ${countdown.display}`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
