// ==============================================================================
// ECont PricingBreakdownCard - Version 2.0
// Hiển thị bảng báo giá minh bạch theo SRS công thức tiết kiệm
// ==============================================================================

import React, { useState } from 'react';
import { Quote } from '../types';
import { formatVnd } from '../lib/utils';
import { ChevronDown, ChevronUp, Info, TrendingDown, TrendingUp, AlertCircle } from 'lucide-react';

interface PricingBreakdownCardProps {
  quote: Quote;
  showDetails?: boolean;
  context?: 'match_preview' | 'transaction_detail' | 'settlement';
}

function StatusChip({ status }: { status: 'FIRM' | 'ESTIMATE' | 'MISSING' }) {
  if (status === 'FIRM') {
    return <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-1.5 py-0.5">CHÍNH XÁC</span>;
  }
  if (status === 'ESTIMATE') {
    return <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-1.5 py-0.5">ƯỚC TÍNH</span>;
  }
  return <span className="text-xs font-bold text-slate-500 bg-slate-100 border border-slate-200 rounded-md px-1.5 py-0.5">THIẾU DỮ LIỆU</span>;
}

export const PricingBreakdownCard: React.FC<PricingBreakdownCardProps> = ({
  quote,
  showDetails: initialShowDetails = false,
  context = 'transaction_detail',
}) => {
  const [showDetails, setShowDetails] = useState(initialShowDetails);

  const totalSaving = Math.max(quote.sAVnd, 0) + Math.max(quote.sBVnd, 0);
  const totalEcont = quote.econtCollectedFromA + quote.econtCollectedFromB;
  const hasMissingData = quote.tAStatus === 'MISSING' || quote.tBStatus === 'MISSING' || quote.fRuStatus === 'MISSING';
  const hasEstimateData = quote.tAStatus === 'ESTIMATE' || quote.tBStatus === 'ESTIMATE' || quote.truckingStatus === 'ESTIMATE';

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
                Một số thông số chưa có — báo giá sẽ chính xác hơn sau khi hai bên xác nhận
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
            {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Summary row: A savings vs B savings */}
      <div className="grid grid-cols-2 divide-x divide-slate-100 border-b border-slate-100">
        <div className="px-4 py-3">
          <p className="text-xs text-slate-500 font-medium">Bên A tiết kiệm ròng</p>
          <p className={`text-base sm:text-lg font-bold font-mono mt-0.5 ${quote.negativeSavingA ? 'text-red-600' : 'text-slate-900'}`}>
            {quote.negativeSavingA ? '- ' : ''}{formatVnd(Math.abs(quote.sAVnd))}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            Vs phương án hạ về depot ({formatVnd(quote.tAVnd)})
          </p>
        </div>
        <div className="px-4 py-3">
          <p className="text-xs text-slate-500 font-medium">Bên B tiết kiệm ròng</p>
          <p className={`text-base sm:text-lg font-bold font-mono mt-0.5 ${quote.negativeSavingB ? 'text-red-600' : 'text-slate-900'}`}>
            {quote.negativeSavingB ? '- ' : ''}{formatVnd(Math.abs(quote.sBVnd))}
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
            <p className="text-xs text-slate-500 font-medium">ECont thu (phí RU + phí nền tảng)</p>
            <p className="text-sm sm:text-base font-bold text-slate-800 font-mono mt-0.5">
              A: {formatVnd(quote.econtCollectedFromA)} · B: {formatVnd(quote.econtCollectedFromB)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400 font-medium">Tổng ECont</p>
            <p className="text-sm sm:text-base font-bold text-blue-700 font-mono">{formatVnd(totalEcont)}</p>
          </div>
        </div>
      </div>

      {/* Detailed breakdown (collapsible) */}
      {showDetails && (
        <div className="px-4 py-3 space-y-3 text-xs sm:text-sm">
          <p className="font-bold text-slate-700 uppercase tracking-wide text-xs">Chi tiết công thức tính toán</p>

          {/* Input parameters */}
          <div className="space-y-1.5">
            <p className="text-xs font-bold text-slate-400 uppercase">Thông số đầu vào</p>
            <Row label="T_A · Cước hạ cont về depot (Bên A)" value={formatVnd(quote.tAVnd)} status={quote.tAStatus} />
            <Row label="T_B · Cước lấy cont từ depot (Bên B)" value={formatVnd(quote.tBVnd)} status={quote.tBStatus} />
            <Row label="F_RU · Phí duyệt RU hãng tàu" value={formatVnd(quote.fRuVnd)} status={quote.fRuStatus} />
            <Row label={`α · Tỷ lệ Bên A gánh F_RU`} value={`${(quote.shareAlpha * 100).toFixed(0)}%`} />
            <Row label="Cước xe A→B (Bên B tự bố trí)" value={formatVnd(quote.truckingAbVnd)} status={quote.truckingStatus} note="B thanh toán riêng" />
            {quote.extrasAVnd > 0 && <Row label="Chi phí phát sinh A" value={formatVnd(quote.extrasAVnd)} />}
            {quote.extrasBVnd > 0 && <Row label="Chi phí phát sinh B" value={formatVnd(quote.extrasBVnd)} />}
          </div>

          {/* Calculation steps */}
          <div className="space-y-1.5 border-t border-dashed border-slate-200 pt-2">
            <p className="text-xs font-bold text-slate-400 uppercase">Tính toán</p>
            <Row label="R_A0 · Chi phí mới phát sinh A" value={formatVnd(quote.rA0Vnd)} note="α×F_RU + extras_A" />
            <Row label="R_B0 · Chi phí mới phát sinh B" value={formatVnd(quote.rB0Vnd)} note="trucking + (1-α)×F_RU + extras_B" />
            <Row label="G_A · Tiết kiệm gộp A" value={formatVnd(quote.gAVnd)} highlight={quote.gAVnd < 0 ? 'negative' : 'positive'} />
            <Row label="G_B · Tiết kiệm gộp B" value={formatVnd(quote.gBVnd)} highlight={quote.gBVnd < 0 ? 'negative' : 'positive'} />
            <Row label="F_A · Phí nền tảng A (25% × max(G_A,0))" value={formatVnd(quote.fAVnd)} />
            <Row label="F_B · Phí nền tảng B (15% × max(G_B,0))" value={formatVnd(quote.fBVnd)} />
          </div>

          {/* Results */}
          <div className="space-y-1.5 border-t border-dashed border-slate-200 pt-2">
            <p className="text-xs font-bold text-slate-400 uppercase">Kết quả</p>
            <Row label="S_A · Tiết kiệm ròng A" value={formatVnd(quote.sAVnd)} highlight={quote.sAVnd < 0 ? 'negative' : 'positive'} bold />
            <Row label="S_B · Tiết kiệm ròng B" value={formatVnd(quote.sBVnd)} highlight={quote.sBVnd < 0 ? 'negative' : 'positive'} bold />
            <Row label="ECont thu từ A" value={formatVnd(quote.econtCollectedFromA)} note="α×F_RU + F_A" />
            <Row label="ECont thu từ B" value={formatVnd(quote.econtCollectedFromB)} note="(1-α)×F_RU + F_B" />
          </div>

          {/* SRS fixture note */}
          {context === 'transaction_detail' && (
            <div className="rounded-xl bg-blue-50 border border-blue-200 px-3 py-2">
              <p className="text-xs text-blue-700">
                <Info className="w-3.5 h-3.5 inline mr-1" />
                Công thức theo SRS v1.0 §5.2. Báo giá mang tính ràng buộc khi cả hai bên ký Thỏa thuận (Agreement).
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

function Row({
  label, value, status, note, highlight, bold
}: {
  label: string;
  value: string;
  status?: 'FIRM' | 'ESTIMATE' | 'MISSING';
  note?: string;
  highlight?: 'positive' | 'negative';
  bold?: boolean;
}) {
  const valueColor =
    highlight === 'positive' ? 'text-emerald-600' :
    highlight === 'negative' ? 'text-red-600' :
    'text-slate-800';

  return (
    <div className="flex items-start justify-between gap-2">
      <div className="flex-1 min-w-0">
        <span className={`leading-snug ${bold ? 'font-semibold text-slate-700' : 'text-slate-500'}`}>{label}</span>
        {status && <span className="ml-1"><StatusChip status={status} /></span>}
        {note && <span className="text-slate-400 ml-1">({note})</span>}
      </div>
      <span className={`font-mono shrink-0 ${bold ? 'font-bold' : 'font-medium'} ${valueColor}`}>{value}</span>
    </div>
  );
}
