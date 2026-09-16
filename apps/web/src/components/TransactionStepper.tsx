// ==============================================================================
// ECont Transaction Stepper: Máy trạng thái giao dịch 7 bước chuẩn SRS
// ==============================================================================

import React from 'react';
import { Transaction, TransactionStatus } from '../types';
import { 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  FileText, 
  Ship, 
  CreditCard, 
  QrCode, 
  Eye, 
  PenTool, 
  CheckCircle 
} from 'lucide-react';
import { formatDateTime } from '../lib/utils';

interface StepperProps {
  transaction: Transaction;
}

const STEPS: { status: TransactionStatus; number: number; label: string; icon: React.ElementType }[] = [
  { status: 'NEGOTIATING', number: 1, label: 'Thương lượng & Thỏa thuận', icon: FileText },
  { status: 'PENDING_CARRIER', number: 2, label: 'Hãng tàu duyệt RU', icon: Ship },
  { status: 'AWAITING_PAYMENT', number: 3, label: 'Nộp tiền & Đối soát', icon: CreditCard },
  { status: 'READY_FOR_PICKUP', number: 4, label: 'Phiếu điều phối (Permit)', icon: QrCode },
  { status: 'INSPECTION', number: 5, label: 'Kiểm tra cont 6 mặt', icon: Eye },
  { status: 'HANDOVER_PENDING', number: 6, label: 'Ký biên bản bàn giao', icon: PenTool },
  { status: 'COMPLETED', number: 7, label: 'Giao nhận hoàn tất', icon: CheckCircle }
];

export const TransactionStepper: React.FC<StepperProps> = ({ transaction }) => {
  const currentStepIndex = STEPS.findIndex(s => s.status === transaction.status);
  const isCompleted = transaction.status === 'COMPLETED';

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
      {/* 1. Header with Hold Alert & Due Countdown */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-white tracking-tight">
              TIẾN ĐỘ GIAO DỊCH 7 BƯỚC (TRANSACTION LIFECYCLE)
            </h3>
            <span className="text-xs font-mono text-slate-400">#{transaction.id}</span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Container: <span className="text-brand-400 font-mono font-bold">{transaction.asset.containerNumber}</span> ({transaction.asset.containerType}) · Hãng tàu: {transaction.asset.carrierCode}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {transaction.isOnHold ? (
            <div className="px-3 py-1 rounded-full bg-rose-950/80 border border-rose-600 text-rose-300 text-xs font-semibold flex items-center gap-1.5 animate-pulse">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>ĐANG TẠM DỪNG (ON_HOLD): {transaction.holdReason}</span>
            </div>
          ) : (
            <div className="px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-xs flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>Hạn xử lý: {formatDateTime(transaction.dueAt)}</span>
            </div>
          )}
        </div>
      </div>

      {/* 2. Step Progress Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {STEPS.map((step, idx) => {
          const isPassed = idx < currentStepIndex || isCompleted;
          const isCurrent = idx === currentStepIndex && !isCompleted;
          const Icon = step.icon;

          return (
            <div
              key={step.status}
              className={`p-3 rounded-lg border transition-all relative ${
                isCurrent
                  ? 'bg-brand-950/70 border-brand-500 shadow-md ring-1 ring-brand-500/50'
                  : isPassed
                  ? 'bg-slate-850 border-emerald-800/60 text-emerald-400'
                  : 'bg-slate-900/50 border-slate-800 text-slate-500'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className={`text-[11px] font-mono font-bold px-1.5 py-0.2 rounded ${
                  isCurrent ? 'bg-brand-600 text-white' : isPassed ? 'bg-emerald-950 text-emerald-400' : 'bg-slate-800 text-slate-400'
                }`}>
                  BƯỚC {step.number}
                </span>
                {isPassed ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Icon className={`w-4 h-4 ${isCurrent ? 'text-brand-400 animate-pulse' : 'text-slate-600'}`} />
                )}
              </div>

              <div className={`text-xs font-semibold line-clamp-2 ${isCurrent ? 'text-white' : isPassed ? 'text-slate-200' : 'text-slate-400'}`}>
                {step.label}
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. Next Action Guidance */}
      <div className="mt-5 p-3 rounded-lg bg-slate-950 border border-slate-800/80 flex items-start gap-3 text-xs">
        <div className="w-6 h-6 rounded-full bg-brand-900/80 text-brand-300 flex items-center justify-center shrink-0 mt-0.5">
          <Clock className="w-3.5 h-3.5" />
        </div>
        <div>
          <span className="font-bold text-slate-300">HÀNH ĐỘNG TIẾP THEO THEO HỆ THỐNG:</span>
          <p className="text-slate-400 mt-0.5">{transaction.nextAction}</p>
        </div>
      </div>
    </div>
  );
};

