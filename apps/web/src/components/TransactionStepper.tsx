// ==============================================================================
// ECont TransactionStepper - Version 2.0
// Hiển thị vòng đời giao dịch 7 bước với deadline countdown
// ==============================================================================

import React, { useEffect, useState } from 'react';
import { Transaction, TransactionStatus } from '../types';
import { formatCountdown } from '../lib/utils';
import {
  FileText, Ship, CreditCard, QrCode, Eye, PenTool, CheckCircle2,
  Clock, AlertTriangle, Lock
} from 'lucide-react';

const STEPS: Array<{
  status: TransactionStatus;
  label: string;
  sublabel: string;
  icon: React.ElementType;
  step: number;
}> = [
  { status: 'NEGOTIATING', label: 'Thương lượng', sublabel: 'Ký Thỏa thuận', icon: FileText, step: 1 },
  { status: 'PENDING_CARRIER', label: 'Hãng tàu', sublabel: 'Xin duyệt RU', icon: Ship, step: 2 },
  { status: 'AWAITING_PAYMENT', label: 'Thanh toán', sublabel: 'Nộp tiền ECont', icon: CreditCard, step: 3 },
  { status: 'READY_FOR_PICKUP', label: 'Phiếu điều phối', sublabel: 'Phát DP / QR', icon: QrCode, step: 4 },
  { status: 'INSPECTION', label: 'Kiểm tra cont', sublabel: 'Checklist 6 mặt', icon: Eye, step: 5 },
  { status: 'HANDOVER_PENDING', label: 'Bàn giao', sublabel: 'Ký 2 chiều', icon: PenTool, step: 6 },
  { status: 'COMPLETED', label: 'Hoàn tất', sublabel: 'Custody chuyển B', icon: CheckCircle2, step: 7 },
];

const TERMINAL_STATUSES: TransactionStatus[] = ['CANCELLED', 'REJECTED', 'EXPIRED'];
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
}

export const TransactionStepper: React.FC<TransactionStepperProps> = ({ transaction }) => {
  const { status, isOnHold, dueAt } = transaction;
  const [countdown, setCountdown] = useState(formatCountdown(dueAt));

  useEffect(() => {
    const isTerminal = TERMINAL_STATUSES.includes(status) || status === 'COMPLETED';
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
      status === 'CANCELLED' ? 'Giao dịch đã bị HỦY' :
      status === 'REJECTED' ? 'Hãng tàu TỪ CHỐI duyệt RU' :
      'Giao dịch HẾT HẠN';
    return (
      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <AlertTriangle className="w-5 h-5 text-slate-400 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-slate-600">{label}</p>
          <p className="text-xs text-slate-400 mt-0.5">{transaction.nextAction}</p>
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
            <p className="text-sm font-semibold text-amber-700">⏸ Giao dịch đang TẠM DỪNG</p>
            <p className="text-xs text-amber-600 mt-0.5">{transaction.holdReason}</p>
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
            const Icon = step.icon;

            return (
              <React.Fragment key={step.status}>
                {/* Connector line before */}
                {idx > 0 && (
                  <div
                    className={`flex-1 h-0.5 mt-4 mx-0.5 transition-all duration-500 ${
                      isCompleted || (currentStep > idx) ? 'bg-brand-500' : 'bg-slate-200'
                    }`}
                  />
                )}

                {/* Step node */}
                <div className="flex flex-col items-center shrink-0">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                      isCompleted
                        ? 'bg-brand-500 border-brand-500'
                        : isCurrent
                        ? 'bg-white border-brand-500 shadow-md shadow-brand-200 ring-2 ring-brand-200'
                        : 'bg-white border-slate-200'
                    }`}
                    title={step.label}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="w-4 h-4 text-white" />
                    ) : (
                      <Icon className={`w-3.5 h-3.5 ${isCurrent ? 'text-brand-600' : 'text-slate-300'}`} />
                    )}
                  </div>
                  <div className={`mt-1.5 text-center ${isCurrent ? 'block' : 'hidden md:block'}`}>
                    <p className={`text-xs font-bold leading-tight ${
                      isCurrent ? 'text-brand-700' : isCompleted ? 'text-slate-600' : 'text-slate-400'
                    }`}>
                      {step.label}
                    </p>
                    <p className={`text-xs leading-tight mt-0.5 ${
                      isCurrent ? 'text-brand-600 font-medium' : 'text-slate-400'
                    }`}>
                      {step.sublabel}
                    </p>
                  </div>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Deadline countdown */}
      {!isTerminal && status !== 'COMPLETED' && (
        <div className={`flex items-center justify-center gap-2 rounded-lg px-4 py-2 border text-sm font-semibold ${
          countdown.isExpired
            ? 'bg-red-50 border-red-200 text-red-700'
            : countdown.isUrgent
            ? 'bg-amber-50 border-amber-200 text-amber-700'
            : 'bg-slate-50 border-slate-200 text-slate-600'
        }`}>
          <Clock className={`w-4 h-4 ${countdown.isUrgent || countdown.isExpired ? 'animate-pulse' : ''}`} />
          <span>
            {countdown.isExpired ? 'Đã hết hạn' : `Deadline: ${countdown.display}`}
          </span>
        </div>
      )}
    </div>
  );
};
