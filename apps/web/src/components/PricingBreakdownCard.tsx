// ==============================================================================
// ECont PricingBreakdownCard - Version 2.0
// Hiển thị bảng báo giá minh bạch theo SRS công thức tiết kiệm
// ==============================================================================

import React, { useState } from "react";
import { Quote } from "../types";
import { formatVnd } from "../lib/utils";
import {
  ChevronDown,
  ChevronUp,
  Info,
  TrendingDown,
  TrendingUp,
  AlertCircle,
} from "lucide-react";

interface PricingBreakdownCardProps {
  quote: Quote;
  showDetails?: boolean;
  context?: "match_preview" | "transaction_detail" | "settlement";
}

function StatusChip({ status }: { status: "FIRM" | "ESTIMATE" | "MISSING" }) {
  if (status === "FIRM") {
    return (
      <span className="text-[10px] font-medium text-gray-500 bg-gray-100 border border-gray-200/80 rounded px-1.5 py-0.5 tracking-tight">
        CHÍNH XÁC
      </span>
    );
  }
  if (status === "ESTIMATE") {
    return (
      <span className="text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200/80 rounded px-1.5 py-0.5 tracking-tight">
        ƯỚC TÍNH
      </span>
    );
  }
  return (
    <span className="text-[10px] font-medium text-slate-500 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 tracking-tight">
      THIẾU DỮ LIỆU
    </span>
  );
}

export const PricingBreakdownCard: React.FC<PricingBreakdownCardProps> = ({
  quote,
  showDetails: initialShowDetails = false,
  context = "transaction_detail",
}) => {
  const [showDetails, setShowDetails] = useState(initialShowDetails);

  const totalSaving = Math.max(quote.sAVnd, 0) + Math.max(quote.sBVnd, 0);
  const totalEcont = quote.econtCollectedFromA + quote.econtCollectedFromB;
  const hasMissingData =
    quote.tAStatus === "MISSING" ||
    quote.tBStatus === "MISSING" ||
    quote.fRuStatus === "MISSING";
  const hasEstimateData =
    quote.tAStatus === "ESTIMATE" ||
    quote.tBStatus === "ESTIMATE" ||
    quote.truckingStatus === "ESTIMATE";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
      {/* Header: Summary */}
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-emerald-100 px-4 py-3.5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs sm:text-sm text-emerald-800 font-bold flex items-center gap-1.5">
              <TrendingDown className="w-4 h-4 text-emerald-600" />
              Tổng tiết kiệm ròng hai bên
            </p>
            <p className="text-xl sm:text-2xl font-bold text-emerald-800 mt-0.5 font-mono">
              {formatVnd(totalSaving)}
            </p>
            {hasMissingData && (
              <p className="text-xs text-amber-700 flex items-center gap-1 mt-1 font-medium">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                Một số thông số chưa có — báo giá sẽ chính xác hơn sau khi hai
                bên xác nhận
              </p>
            )}
            {!hasMissingData && hasEstimateData && (
              <p className="text-xs text-amber-700 flex items-center gap-1 mt-1 font-medium">
                <Info className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                Một số thông số là ước tính — sẽ được chốt sau Carrier Approval
              </p>
            )}
          </div>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="p-1.5 rounded-lg hover:bg-emerald-100/80 text-emerald-700 transition-colors"
          >
            {showDetails ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Summary row: A savings vs B savings */}
      <div className="grid grid-cols-2 divide-x divide-slate-100 border-b border-slate-100">
        <div className="px-4 py-3">
          <p className="text-xs text-slate-500 font-medium">
            Nhà cung cấp tiết kiệm ròng
          </p>
          <p
            className={`text-base sm:text-lg font-bold font-mono mt-0.5 ${quote.negativeSavingA ? "text-red-600" : "text-slate-900"}`}
          >
            {quote.negativeSavingA ? "- " : ""}
            {formatVnd(Math.abs(quote.sAVnd))}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            Vs phương án hạ về depot ({formatVnd(quote.tAVnd)})
          </p>
        </div>
        <div className="px-4 py-3">
          <p className="text-xs text-slate-500 font-medium">
            Đơn vị cần vỏ tiết kiệm ròng
          </p>
          <p
            className={`text-base sm:text-lg font-bold font-mono mt-0.5 ${quote.negativeSavingB ? "text-red-600" : "text-slate-900"}`}
          >
            {quote.negativeSavingB ? "- " : ""}
            {formatVnd(Math.abs(quote.sBVnd))}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            Vs phương án lấy từ depot ({formatVnd(quote.tBVnd)})
          </p>
        </div>
      </div>

      {/* ECont collected */}
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-medium">
              ECont thu (phí RU + phí nền tảng)
            </p>
            <p className="text-sm sm:text-base font-bold text-slate-800 font-mono mt-0.5">
              Nhà cung cấp: {formatVnd(quote.econtCollectedFromA)} · Đơn vị cần
              vỏ: {formatVnd(quote.econtCollectedFromB)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400 font-medium">Tổng ECont</p>
            <p className="text-sm sm:text-base font-bold text-blue-700 font-mono">
              {formatVnd(totalEcont)}
            </p>
          </div>
        </div>
      </div>

      {/* Detailed breakdown (collapsible) */}
      {showDetails && (
        <div className="px-4 py-3 space-y-3 text-xs sm:text-sm">
          <p className="font-bold text-slate-700 uppercase tracking-wide text-xs">
            Chi tiết công thức tính toán
          </p>

          {/* Input parameters */}
          <div className="space-y-0.5">
            <p className="text-xs font-bold text-slate-400 uppercase mb-1">
              Thông số đầu vào
            </p>
            <Row
              label="Cước hạ cont về depot (nhà cung cấp)"
              value={formatVnd(quote.tAVnd)}
              status={quote.tAStatus}
            />
            <Row
              label="Cước lấy cont từ depot (đơn vị cần vỏ)"
              value={formatVnd(quote.tBVnd)}
              status={quote.tBStatus}
            />
            <Row
              label="F_RU · Phí duyệt RU hãng tàu"
              value={formatVnd(quote.fRuVnd)}
              status={quote.fRuStatus}
            />
            <Row
              label={`α · Tỷ lệ nhà cung cấp gánh F_RU`}
              value={`${(quote.shareAlpha * 100).toFixed(0)}%`}
            />
            <Row
              label="Cước xe giữa hai điểm (đơn vị cần vỏ tự bố trí)"
              value={formatVnd(quote.truckingAbVnd)}
              status={quote.truckingStatus}
              note="Đơn vị cần vỏ thanh toán riêng"
            />
            {quote.extrasAVnd > 0 && (
              <Row
                label="Chi phí phát sinh của nhà cung cấp"
                value={formatVnd(quote.extrasAVnd)}
              />
            )}
            {quote.extrasBVnd > 0 && (
              <Row
                label="Chi phí phát sinh của đơn vị cần vỏ"
                value={formatVnd(quote.extrasBVnd)}
              />
            )}
          </div>

          {/* Calculation steps */}
          <div className="space-y-0.5 border-t border-dashed border-slate-200 pt-2.5">
            <p className="text-xs font-bold text-slate-400 uppercase mb-1">
              Tính toán
            </p>
            <Row
              label="Chi phí mới phát sinh của nhà cung cấp"
              value={formatVnd(quote.rA0Vnd)}
              note="phần RU + chi phí riêng"
            />
            <Row
              label="Chi phí mới phát sinh của đơn vị cần vỏ"
              value={formatVnd(quote.rB0Vnd)}
              note="cước xe + phần RU + chi phí riêng"
            />
            <Row
              label="Tiết kiệm gộp của nhà cung cấp"
              value={formatVnd(quote.gAVnd)}
              highlight={quote.gAVnd < 0 ? "negative" : "positive"}
            />
            <Row
              label="Tiết kiệm gộp của đơn vị cần vỏ"
              value={formatVnd(quote.gBVnd)}
              highlight={quote.gBVnd < 0 ? "negative" : "positive"}
            />
            <Row
              label="Phí nền tảng của nhà cung cấp"
              value={formatVnd(quote.fAVnd)}
            />
            <Row
              label="Phí nền tảng của đơn vị cần vỏ"
              value={formatVnd(quote.fBVnd)}
            />
          </div>

          {/* Results */}
          <div className="space-y-1 border-t border-dashed border-slate-200 pt-2.5">
            <p className="text-xs font-bold text-slate-400 uppercase mb-1">
              Kết quả
            </p>
            <Row
              label="Tiết kiệm ròng của nhà cung cấp"
              value={formatVnd(quote.sAVnd)}
              highlight={quote.sAVnd < 0 ? "negative" : "positive"}
              bold
              isFinalResult
            />
            <Row
              label="Tiết kiệm ròng của đơn vị cần vỏ"
              value={formatVnd(quote.sBVnd)}
              highlight={quote.sBVnd < 0 ? "negative" : "positive"}
              bold
              isFinalResult
            />
            <Row
              label="ECont thu từ nhà cung cấp"
              value={formatVnd(quote.econtCollectedFromA)}
              note="phần RU + phí nền tảng"
            />
            <Row
              label="ECont thu từ đơn vị cần vỏ"
              value={formatVnd(quote.econtCollectedFromB)}
              note="phần RU + phí nền tảng"
            />
          </div>

          {/* Transaction binding note */}
          {context === "transaction_detail" && (
            <div className="rounded-xl bg-blue-50 border border-blue-200 px-3 py-2 mt-2">
              <p className="text-xs text-blue-700">
                <Info className="w-3.5 h-3.5 inline mr-1" />
                Báo giá mang tính ràng buộc khi cả hai bên xác nhận ký Thỏa
                thuận giao dịch.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

function Row({
  label,
  value,
  status,
  note,
  highlight,
  bold,
  isFinalResult,
}: {
  label: string;
  value: string;
  status?: "FIRM" | "ESTIMATE" | "MISSING";
  note?: string;
  highlight?: "positive" | "negative";
  bold?: boolean;
  isFinalResult?: boolean;
}) {
  const valueColor =
    highlight === "positive"
      ? "text-emerald-600"
      : highlight === "negative"
        ? "text-red-600"
        : bold
          ? "text-slate-900"
          : "text-slate-800";

  if (isFinalResult) {
    return (
      <div className="flex items-center justify-between gap-3 py-2 px-3 rounded-lg bg-emerald-50/70 border border-emerald-200/80 my-1">
        <div className="flex-1 min-w-0 flex items-center gap-1.5 flex-wrap">
          <span className="font-semibold text-slate-900 text-xs sm:text-sm">
            {label}
          </span>
          {status && <StatusChip status={status} />}
          {note && <span className="text-slate-500 text-xs">({note})</span>}
        </div>
        <span
          className={`font-mono shrink-0 font-bold text-sm sm:text-base ${valueColor}`}
        >
          {value}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 py-1.5 border-b border-slate-100 last:border-b-0 hover:bg-slate-50/60 px-1 rounded transition-colors">
      <div className="flex-1 min-w-0 flex items-center gap-1.5 flex-wrap">
        <span
          className={`leading-snug ${bold ? "font-semibold text-slate-800" : "text-slate-600"}`}
        >
          {label}
        </span>
        {status && <StatusChip status={status} />}
        {note && <span className="text-slate-400 text-xs">({note})</span>}
      </div>
      <span
        className={`font-mono shrink-0 ${bold ? "font-bold text-slate-900" : "font-medium text-slate-700"} ${valueColor}`}
      >
        {value}
      </span>
    </div>
  );
}
