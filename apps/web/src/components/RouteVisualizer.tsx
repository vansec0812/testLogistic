// ==============================================================================
// ECont Route Visualizer: Sơ đồ tuyến đường & so sánh lộ trình ECont vs Truyền thống
// ==============================================================================

import React from 'react';
import { Navigation, MapPin, Truck, ArrowRight, ShieldCheck, Clock } from 'lucide-react';

interface RouteProps {
  locationA: string;
  locationB: string;
  depotReturn: string;
  distanceKm: number;
  timeFeasible: boolean;
  scoreD: number;
  scoreT: number;
}

export const RouteVisualizer: React.FC<RouteProps> = ({
  locationA,
  locationB,
  depotReturn,
  distanceKm,
  timeFeasible,
  scoreD,
  scoreT
}) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand-950 border border-brand-700/60 flex items-center justify-center text-brand-400">
            <Navigation className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white uppercase tracking-tight">
              SƠ ĐỒ LỘ TRÌNH VẬN CHUYỂN TÁI SỬ DỤNG
            </h4>
            <p className="text-[11px] text-slate-400">
              Khoảng cách d: <span className="font-mono font-bold text-brand-300">{distanceKm} km</span> · Khả thi thời gian: {timeFeasible ? 'HỢP LỆ' : 'KHÔNG ĐỦ THỜI GIAN'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-800 border border-slate-700 text-slate-300">
            Điểm D: {scoreD}/100
          </span>
          <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-800 border border-slate-700 text-slate-300">
            Điểm T: {scoreT}/100
          </span>
        </div>
      </div>

      {/* So sánh hai mô hình */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* TUYẾN ECONT (TỐI ƯU) */}
        <div className="p-3.5 rounded-lg bg-emerald-950/20 border border-emerald-800/40">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-emerald-400 uppercase flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" />
              TUYẾN ECONT (TÁI SỬ DỤNG TRỰC TIẾP)
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 font-mono font-bold">
              Chỉ 1 chuyến xe ({distanceKm} km)
            </span>
          </div>

          <div className="relative pl-6 space-y-3 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-emerald-600">
            <div className="relative">
              <div className="absolute -left-6 top-1 w-3 h-3 rounded-full bg-emerald-500 ring-4 ring-emerald-950"></div>
              <div className="text-xs font-semibold text-slate-200">Kho Bên A (Điểm lấy vỏ rỗng):</div>
              <div className="text-[11px] text-slate-400">{locationA}</div>
            </div>

            <div className="relative">
              <div className="absolute -left-6 top-1 w-3 h-3 rounded-full bg-emerald-400 ring-4 ring-emerald-950"></div>
              <div className="text-xs font-semibold text-slate-200">Kho Bên B (Đóng hàng xuất khẩu):</div>
              <div className="text-[11px] text-slate-400">{locationB}</div>
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-emerald-900/40 text-[11px] text-emerald-300 flex items-center justify-between">
            <span>Thời gian di chuyển ước tính:</span>
            <span className="font-mono font-bold">{Math.round(distanceKm * 2 + 30)} phút</span>
          </div>
        </div>

        {/* TUYẾN TRUYỀN THỐNG (LÃNG PHÍ) */}
        <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800/80">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1.5">
              <Truck className="w-4 h-4 text-slate-500" />
              TUYẾN TRUYỀN THỐNG (CHẠY RỖNG VỀ DEPOT)
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
              2 chuyến xe riêng biệt
            </span>
          </div>

          <div className="space-y-2 text-[11px] text-slate-400">
            <div className="p-2 rounded bg-slate-900 border border-slate-800 flex items-center justify-between">
              <span>Chuyến 1: A kéo cont rỗng hạ về Depot ({depotReturn})</span>
              <span className="text-rose-400 font-mono">+T_A</span>
            </div>
            <div className="p-2 rounded bg-slate-900 border border-slate-800 flex items-center justify-between">
              <span>Chuyến 2: B thuê xe kéo cont rỗng từ Depot về đóng hàng</span>
              <span className="text-rose-400 font-mono">+T_B</span>
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Tổng thời gian chờ hạ/nâng tại depot:</span>
            <span className="font-mono text-rose-400">2 ~ 4 giờ kẹt xe</span>
          </div>
        </div>
      </div>
    </div>
  );
};

