// ==============================================================================
// ECont Matching Engine Modal - Version 2.0
// Hiển thị danh sách ứng viên ghép đôi theo thuật toán SRS mục 5.2 kèm nút Giữ chỗ nguyên tử
// ==============================================================================

import React, { useState } from 'react';
import { ContainerRequest, MatchCandidate } from '../types';
import { useDatabase } from '../context/DatabaseContext';
import { findMatchesForRequest } from '../services/matchingEngine';
import { formatVnd, formatDistance } from '../lib/utils';
import { RouteVisualizer } from './RouteVisualizer';
import { PricingBreakdownCard } from './PricingBreakdownCard';
import { 
  Sparkles, 
  X, 
  Lock, 
  AlertTriangle, 
  CheckCircle2,
  MapPin,
  Clock
} from 'lucide-react';

interface MatchingModalProps {
  request: ContainerRequest;
  onClose: () => void;
  onGoToTransaction: (txnId: string) => void;
}

export const MatchingModal: React.FC<MatchingModalProps> = ({
  request,
  onClose,
  onGoToTransaction
}) => {
  const { offers, holdAtomicReservation } = useDatabase();
  const [isHolding, setIsHolding] = useState(false);

  // Chạy thuật toán Matching
  const matchResult = findMatchesForRequest(request, offers.filter(o => o.status === 'AVAILABLE'));
  const candidates = matchResult.candidates;

  const handleHold = (candidate: MatchCandidate) => {
    setIsHolding(true);
    const res = holdAtomicReservation(candidate, request);
    setIsHolding(false);

    if (res.success) {
      const data = res.data as { transactionId: string } | undefined;
      alert(res.message);
      onClose();
      if (data?.transactionId) {
        onGoToTransaction(data.transactionId);
      }
    } else {
      alert(res.message || 'Không thể giữ chỗ.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl relative my-8">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-950 border border-brand-700/60 flex items-center justify-center text-brand-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                KẾT QUẢ GHÉP ĐÔI CONTAINER (MATCHING ENGINE)
              </h3>
              <p className="text-xs text-slate-400">
                Booking: <span className="font-mono text-slate-200">{request.bookingNumber}</span> ({request.containerType} - Hãng {request.carrierCode}) · Tìm thấy <strong className="text-emerald-400">{candidates.length}</strong> vỏ phù hợp
              </p>
            </div>
          </div>

          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content list */}
        <div className="p-6 overflow-y-auto space-y-6">
          {matchResult.dataWarnings.length > 0 && (
            <div className="p-3 rounded-lg bg-amber-950/60 border border-amber-800 text-amber-300 text-xs space-y-1">
              {matchResult.dataWarnings.map((w, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}

          {candidates.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
              <h4 className="text-base font-semibold text-white">Không tìm thấy vỏ cont phù hợp</h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Hiện chưa có Offer nào thỏa mãn đồng thời: Khớp hãng tàu ({request.carrierCode}), cùng loại ({request.containerType}), trong bán kính {request.maxDistanceKm}km và khả thi về giờ cắt máng ({matchResult.eliminatedCount} vỏ bị loại).
              </p>
            </div>
          ) : (
            candidates.map((cand, idx) => (
              <div
                key={cand.offer.id}
                className="bg-slate-950 border border-slate-800 rounded-xl p-5 hover:border-brand-500/70 transition-all space-y-4"
              >
                {/* Top candidate header */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-full bg-brand-900 text-brand-300 font-mono font-bold text-xs flex items-center justify-center">
                      #{idx + 1}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-base text-white">
                          {cand.offer.asset.containerNumber}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-brand-950 text-brand-400 border border-brand-800">
                          {cand.offer.asset.containerType}
                        </span>
                        <span className="text-xs text-slate-400">
                          Chủ vỏ: <strong className="text-slate-200">{cand.offer.companyName}</strong>
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Điểm lấy vỏ: {cand.offer.pickupLocationName}
                      </p>
                    </div>
                  </div>

                  {/* Matching score badge */}
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <div className="text-xl font-bold font-mono text-emerald-400">
                        {cand.scoreM}<span className="text-xs text-slate-500 font-normal">/100</span>
                      </div>
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">Điểm M (30/40/30)</div>
                    </div>

                    <button
                      onClick={() => handleHold(cand)}
                      disabled={isHolding || cand.requiresLocationRefresh}
                      className="ml-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-950 transition-all"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>GIỮ CHỖ 30 PHÚT (ATOMIC HOLD)</span>
                    </button>
                  </div>
                </div>

                {/* Score breakdown metrics */}
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2 rounded bg-slate-900 border border-slate-800">
                    <div className="text-slate-400 text-[11px]">Khoảng cách d</div>
                    <div className="font-mono font-bold text-white mt-0.5">{cand.distanceKm} km (Điểm D: {cand.scoreD})</div>
                  </div>
                  <div className="p-2 rounded bg-slate-900 border border-slate-800">
                    <div className="text-slate-400 text-[11px]">Độ giãn thời gian T</div>
                    <div className="font-mono font-bold text-emerald-400 mt-0.5">{cand.scoreT}/100 ({cand.timeFeasible ? 'Khả thi' : 'Không khả thi'})</div>
                  </div>
                  <div className="p-2 rounded bg-slate-900 border border-slate-800">
                    <div className="text-slate-400 text-[11px]">Chất lượng vỏ C</div>
                    <div className="font-mono font-bold text-blue-400 mt-0.5">{cand.scoreC}/100 ({cand.offer.asset.declaredCondition})</div>
                  </div>
                </div>

                {/* Route Visualizer preview */}
                <RouteVisualizer
                  locationA={cand.offer.pickupLocationName}
                  locationB={request.deliveryLocationName}
                  depotReturn={cand.offer.expectedDepotName || 'Depot chỉ định'}
                  distanceKm={cand.distanceKm}
                  timeFeasible={cand.timeFeasible}
                  scoreD={cand.scoreD}
                  scoreT={cand.scoreT}
                />

                {/* Financial breakdown preview */}
                <PricingBreakdownCard quote={cand.quote} context="match_preview" />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
