// ==============================================================================
// ECont Pricing & Savings Breakdown Card
// Hiển thị trực quan toàn bộ công thức tài chính và mức tiết kiệm chuẩn SRS
// ==============================================================================

import React, { useState } from 'react';
import { Quote } from '../types';
import { formatVnd } from '../lib/utils';
import { Calculator, CheckCircle2, Info, ArrowRight, Shield } from 'lucide-react';
import { verifySrsFixture } from '../services/pricingEngine';

interface PricingCardProps {
  quote: Quote;
  showFixtureCheck?: boolean;
}

export const PricingBreakdownCard: React.FC<PricingCardProps> = ({ quote, showFixtureCheck = true }) => {
  const [fixtureResult, setFixtureResult] = useState<{ passed: boolean; message: string } | null>(null);

  const runFixtureTest = () => {
    const res = verifySrsFixture();
    if (res.passed) {
      setFixtureResult({
        passed: true,
        message: 'PASS 100%: Khớp hoàn toàn với bảng thử nghiệm SRS! (A tiết kiệm 1.800.000đ, B tiết kiệm 1.700.000đ, A nộp 1.200.000đ, B nộp 900.000đ).'
      });
    } else {
      setFixtureResult({
        passed: false,
        message: 'FAIL: Sai lệch so với công thức chuẩn.'
      });
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-950 border border-emerald-700/60 flex items-center justify-center text-emerald-400">
            <Calculator className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white uppercase tracking-tight">
              BẢNG BÓC TÁCH CHI PHÍ & MỨC TIẾT KIỆM (SRS MỤC 5.2)
            </h4>
            <p className="text-[11px] text-slate-400">
              Công thức minh bạch: Phí nền tảng ECont chỉ thu trên phần tiết kiệm dương
            </p>
          </div>
        </div>

        {showFixtureCheck && (
          <button
            onClick={runFixtureTest}
            className="px-2.5 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-colors"
          >
            <Shield className="w-3.5 h-3.5 text-brand-400" />
            <span>Kiểm tra Fixture SRS</span>
          </button>
        )}
      </div>

      {fixtureResult && (
        <div className={`mb-4 p-3 rounded-lg text-xs flex items-start gap-2 border ${
          fixtureResult.passed ? 'bg-emerald-950/60 border-emerald-700 text-emerald-300' : 'bg-rose-950/60 border-rose-700 text-rose-300'
        }`}>
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
          <div>
            <span className="font-bold">KẾT QUẢ KIỂM CHỨNG TỰ ĐỘNG: </span>
            <span>{fixtureResult.message}</span>
          </div>
        </div>
      )}

      {/* 2 cột so sánh A và B */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* CỘT BÊN A */}
        <div className="bg-slate-950 rounded-lg p-4 border border-slate-800/80">
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-800">
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wide">
              BÊN A — CHỦ NGUỒN VỎ
            </span>
            <span className="text-xs font-mono text-slate-400">T_A: {formatVnd(quote.tAVnd)}</span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Cước hạ depot cũ (T_A):</span>
              <span className="font-mono text-slate-200">{formatVnd(quote.tAVnd)}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Phí RU phải gánh (α = {quote.shareAlpha}):</span>
              <span className="font-mono text-slate-200">-{formatVnd(quote.rA0Vnd)}</span>
            </div>
            <div className="flex justify-between text-slate-300 pt-1 border-t border-slate-800/60">
              <span>Tiết kiệm gộp (G_A):</span>
              <span className="font-mono font-semibold text-emerald-400">+{formatVnd(quote.gAVnd)}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Phí dịch vụ ECont (25% G_A):</span>
              <span className="font-mono text-amber-400">-{formatVnd(quote.fAVnd)}</span>
            </div>

            <div className="mt-3 p-2.5 rounded bg-emerald-950/40 border border-emerald-800/60 flex items-center justify-between">
              <div>
                <div className="text-[11px] text-emerald-300 font-semibold uppercase">TIẾT KIỆM THỰC TẾ (S_A):</div>
                <div className="text-xs text-slate-400">A nộp ECont: {formatVnd(quote.econtCollectedFromA)}</div>
              </div>
              <div className="text-base font-bold font-mono text-emerald-400">
                +{formatVnd(quote.sAVnd)}
              </div>
            </div>
          </div>
        </div>

        {/* CỘT BÊN B */}
        <div className="bg-slate-950 rounded-lg p-4 border border-slate-800/80">
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-800">
            <span className="text-xs font-bold text-blue-400 uppercase tracking-wide">
              BÊN B — CHỦ NHU CẦU VỎ
            </span>
            <span className="text-xs font-mono text-slate-400">T_B: {formatVnd(quote.tBVnd)}</span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Cước lấy cont depot cũ (T_B):</span>
              <span className="font-mono text-slate-200">{formatVnd(quote.tBVnd)}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Cước xe kéo A→B:</span>
              <span className="font-mono text-slate-200">-{formatVnd(quote.truckingAbVnd)}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Phí RU phải gánh (1 - α):</span>
              <span className="font-mono text-slate-200">-{formatVnd((1 - quote.shareAlpha) * quote.fRuVnd)}</span>
            </div>
            <div className="flex justify-between text-slate-300 pt-1 border-t border-slate-800/60">
              <span>Tiết kiệm gộp (G_B):</span>
              <span className="font-mono font-semibold text-blue-400">+{formatVnd(quote.gBVnd)}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Phí dịch vụ ECont (15% G_B):</span>
              <span className="font-mono text-amber-400">-{formatVnd(quote.fBVnd)}</span>
            </div>

            <div className="mt-3 p-2.5 rounded bg-blue-950/40 border border-blue-800/60 flex items-center justify-between">
              <div>
                <div className="text-[11px] text-blue-300 font-semibold uppercase">TIẾT KIỆM THỰC TẾ (S_B):</div>
                <div className="text-xs text-slate-400">B nộp ECont: {formatVnd(quote.econtCollectedFromB)}</div>
              </div>
              <div className="text-base font-bold font-mono text-blue-400">
                +{formatVnd(quote.sBVnd)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Ghi chú thanh toán */}
      <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
        <div className="flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-brand-400" />
          <span>Tổng mức tiết kiệm xã hội từ việc tái sử dụng cont này:</span>
        </div>
        <span className="font-mono font-bold text-emerald-400 text-sm">
          +{formatVnd(quote.sAVnd + quote.sBVnd)} (Tránh 2 chuyến xe rỗng)
        </span>
      </div>
    </div>
  );
};

