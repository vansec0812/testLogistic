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
    <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
            <Navigation className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900 uppercase tracking-tight">
              SƠ ĐỒ LỘ TRÌNH VẬN CHUYỂN TÁI SỬ DỤNG
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Khoảng cách d: <span className="font-mono font-bold text-blue-700">{distanceKm} km</span> · Khả thi thời gian: {timeFeasible ? <strong className="text-emerald-700">HỢP LỆ</strong> : <strong className="text-red-600">KHÔNG ĐỦ THỜI GIAN</strong>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-white border border-slate-200 text-slate-700 shadow-sm">
            Điểm D: {scoreD}/100
          </span>
          <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-white border border-slate-200 text-slate-700 shadow-sm">
            Điểm T: {scoreT}/100
          </span>
        </div>
      </div>

      {/* So sánh hai mô hình */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* TUYẾN ECONT (TỐI ƯU) */}
        <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-emerald-800 uppercase flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              TUYẾN ECONT (TÁI SỬ DỤNG TRỰC TIẾP)
            </span>
            <span className="text-xs px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-mono font-bold border border-emerald-200">
              Chỉ 1 chuyến xe ({distanceKm} km)
            </span>
          </div>

          <div className="relative pl-6 space-y-3 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-emerald-500">
            <div className="relative">
              <div className="absolute -left-6 top-1 w-3 h-3 rounded-full bg-emerald-600 ring-4 ring-emerald-100"></div>
              <div className="text-xs font-bold text-slate-800">Kho Bên A (Điểm lấy vỏ rỗng):</div>
              <div className="text-xs text-slate-600 font-medium">{locationA}</div>
            </div>

            <div className="relative">
              <div className="absolute -left-6 top-1 w-3 h-3 rounded-full bg-emerald-500 ring-4 ring-emerald-100"></div>
              <div className="text-xs font-bold text-slate-800">Kho Bên B (Đóng hàng xuất khẩu):</div>
              <div className="text-xs text-slate-600 font-medium">{locationB}</div>
            </div>
          </div>

          <div className="mt-3.5 pt-2.5 border-t border-emerald-200 text-xs text-emerald-900 flex items-center justify-between font-medium">
            <span>Thời gian di chuyển ước tính:</span>
            <span className="font-mono font-bold text-emerald-800">{Math.round(distanceKm * 2 + 30)} phút</span>
          </div>
        </div>

        {/* TUYẾN TRUYỀN THỐNG (LÃNG PHÍ) */}
        <div className="p-4 rounded-xl bg-white border border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5">
              <Truck className="w-4 h-4 text-slate-500" />
              TUYẾN TRUYỀN THỐNG (CHẠY RỖNG VỀ DEPOT)
            </span>
            <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-mono font-bold border border-slate-200">
              2 chuyến xe riêng biệt
            </span>
          </div>

          <div className="space-y-2 text-xs text-slate-600">
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
              <span>Chuyến 1: A kéo cont rỗng hạ về Depot ({depotReturn})</span>
              <span className="text-rose-600 font-mono font-bold">+T_A</span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
              <span>Chuyến 2: B thuê xe kéo cont rỗng từ Depot về đóng hàng</span>
              <span className="text-rose-600 font-mono font-bold">+T_B</span>
            </div>
          </div>

          <div className="mt-3.5 pt-2.5 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between font-medium">
            <span>Tổng thời gian chờ hạ/nâng tại depot:</span>
            <span className="font-mono font-bold text-rose-600">2 ~ 4 giờ kẹt xe</span>
          </div>
        </div>
      </div>
    </div>
  );
};

