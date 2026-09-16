// ==============================================================================
// ECont Dashboard Page: Bàn làm việc tổng quan & số liệu vận hành
// ==============================================================================

import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useDatabase } from '../context/DatabaseContext';
import { formatVnd, formatDateTime } from '../lib/utils';
import { 
  Box, 
  ArrowUpRight, 
  Clock, 
  CheckCircle2, 
  TrendingUp, 
  ShieldAlert, 
  FileText, 
  Activity,
  Award,
  Sparkles,
  ExternalLink
} from 'lucide-react';

interface DashboardPageProps {
  setCurrentTab: (tab: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ setCurrentTab }) => {
  const { currentRole, currentCompany, currentUserName, roleBadge } = useAuth();
  const { assets, offers, requests, transactions, cases, auditLogs, onlineConfig } = useDatabase();

  // Thống kê tổng quan
  const activeOffers = offers.filter(o => o.status === 'AVAILABLE').length;
  const openRequests = requests.filter(r => r.status === 'OPEN').length;
  const inProgressDeals = transactions.filter(t => t.status !== 'COMPLETED' && t.status !== 'CANCELLED').length;
  const completedDeals = transactions.filter(t => t.status === 'COMPLETED').length;
  
  // Tính tổng tiết kiệm
  const totalSavings = transactions.reduce((acc, t) => {
    return acc + (t.quote?.sAVnd || 0) + (t.quote?.sBVnd || 0);
  }, 3500000);

  return (
    <div className="space-y-6">
      {/* 1. Welcome Banner & Active Context */}
      <div className="bg-gradient-to-r from-navy-950 via-slate-900 to-navy-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-brand-900/10 to-transparent pointer-events-none"></div>
        <div className="flex flex-wrap items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${roleBadge.color}`}>
                {roleBadge.label}
              </span>
              <span className="text-xs text-slate-400">· Hệ thống đang hoạt động ổn định</span>
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              Xin chào, {currentUserName}
            </h2>
            <p className="text-sm text-slate-300 mt-1">
              Đơn vị: <span className="font-semibold text-white">{currentCompany.companyName}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {currentRole === 'ENTERPRISE_A' && (
              <button
                onClick={() => setCurrentTab('offers')}
                className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold flex items-center gap-2 shadow-lg shadow-brand-900/40 transition-all"
              >
                <Box className="w-4 h-4" />
                <span>Đăng tải nguồn vỏ cont</span>
              </button>
            )}

            {currentRole === 'ENTERPRISE_B' && (
              <button
                onClick={() => setCurrentTab('requests')}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold flex items-center gap-2 shadow-lg shadow-emerald-900/40 transition-all"
              >
                <Sparkles className="w-4 h-4" />
                <span>Tìm vỏ ghép đôi (Matching)</span>
              </button>
            )}

            <button
              onClick={() => setCurrentTab('transactions')}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-sm font-medium flex items-center gap-2 transition-colors"
            >
              <span>Xem giao dịch ({transactions.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Key Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>NGUỒN VỎ KHẢ DỤNG</span>
            <Box className="w-4 h-4 text-brand-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-white">{activeOffers}</span>
            <span className="text-xs text-emerald-400 font-medium">/{assets.length} container</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">Container sạch, đủ điều kiện tái sử dụng</p>
        </div>

        {/* Metric 2 */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>NHU CẦU ĐANG MỞ</span>
            <FileText className="w-4 h-4 text-blue-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-white">{openRequests}</span>
            <span className="text-xs text-blue-400 font-medium">booking mở</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">Sẵn sàng khớp lệnh trong bán kính Dmax</p>
        </div>

        {/* Metric 3 */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>GIAO DỊCH ĐANG XỬ LÝ</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-white">{inProgressDeals}</span>
            <span className="text-xs text-amber-400 font-medium">đang chạy luồng 7 bước</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">{completedDeals} giao dịch đã hoàn tất</p>
        </div>

        {/* Metric 4 */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>TỔNG TIẾT KIỆM TÍCH LŨY</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-emerald-400">{formatVnd(totalSavings)}</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">Giảm chi phí cước xe & phí depot</p>
        </div>
      </div>

      {/* 3. Main Operational Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Active Transactions & Action Queue */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-brand-400" />
                <span>GIAO DỊCH ĐANG DIỄN RA (7-STEP LIFECYCLE)</span>
              </h3>
              <button
                onClick={() => setCurrentTab('transactions')}
                className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1"
              >
                <span>Xem tất cả</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {transactions.length === 0 ? (
              <div className="py-10 text-center text-slate-500 text-sm">
                Chưa có giao dịch nào. Bấm vào Nhu cầu để ghép đôi container.
              </div>
            ) : (
              <div className="space-y-3">
                {transactions.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => setCurrentTab('transactions')}
                    className="p-4 rounded-lg bg-slate-950 border border-slate-800 hover:border-brand-500/60 transition-all cursor-pointer group"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-white group-hover:text-brand-300">
                          {t.asset.containerNumber}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-brand-950 text-brand-400 border border-brand-800">
                          {t.asset.containerType}
                        </span>
                        <span className="text-xs text-slate-400">· Hãng tàu {t.asset.carrierCode}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        {t.isOnHold && (
                          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-950 text-rose-400 border border-rose-700">
                            ON_HOLD
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-950/80 text-amber-400 border border-amber-800/80">
                          {t.status}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
                      <div>
                        Bên A: <span className="text-slate-200">{t.companyAName}</span> → Bên B: <span className="text-slate-200">{t.companyBName}</span>
                      </div>
                      <div className="text-[11px] text-emerald-400 font-mono">
                        Tiết kiệm ròng: +{formatVnd((t.quote?.sAVnd || 0) + (t.quote?.sBVnd || 0))}
                      </div>
                    </div>

                    <div className="mt-2 text-xs text-slate-300 bg-slate-900/60 p-2 rounded border border-slate-800/60 flex items-center justify-between">
                      <span className="truncate">▶ Tiếp theo: {t.nextAction}</span>
                      <span className="text-[11px] font-mono text-slate-400 shrink-0 ml-2">
                        Hạn: {formatDateTime(t.dueAt)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right 1 Col: Trust Score & Audit Logs */}
        <div className="space-y-6">
          {/* Trust Score Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-400" />
                <span>CHỈ SỐ UY TÍN (TRUST SCORE)</span>
              </h4>
              <span className="text-[10px] text-slate-400 font-mono">SRS MỤC 5.3</span>
            </div>

            <div className="p-4 rounded-lg bg-slate-950 border border-slate-800/80 text-center">
              <div className="text-3xl font-bold font-mono text-emerald-400 mb-1">
                {currentRole === 'ENTERPRISE_A' ? currentCompany.trustScoreA : currentCompany.trustScoreB ?? 90}
                <span className="text-sm text-slate-500 font-normal">/100</span>
              </div>
              <p className="text-xs font-semibold text-emerald-300">Hạng Kim Cương · Tỷ lệ hoàn thành 98%</p>
              <p className="text-[11px] text-slate-400 mt-2">
                Dựa trên {currentCompany.totalCompletedDeals} giao dịch hoàn tất trong 180 ngày qua
              </p>
            </div>
          </div>

          {/* Online Database Direct Link Widget */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                CSDL TRỰC TUYẾN (ONLINE DATABASE)
              </h4>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              Toàn bộ bảng dữ liệu đang được đồng bộ theo thời gian thực với CSDL PostgreSQL trên đám mây.
            </p>
            <div className="space-y-2">
              <a
                href={onlineConfig.adminDashboardUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2 px-3 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <span>Mở Bảng Điều Khiển CSDL Online</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <button
                onClick={() => setCurrentTab('database')}
                className="w-full py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-medium text-center border border-slate-700 transition-colors"
              >
                Mở Cổng Quản trị & Trình chạy SQL
              </button>
            </div>
          </div>

          {/* Recent Audit Trail */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3">
              NHẬT KÝ KIỂM TOÁN (AUDIT TRAIL)
            </h4>
            <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
              {auditLogs.slice(0, 5).map((log) => (
                <div key={log.id} className="text-xs p-2 rounded bg-slate-950 border border-slate-800/80">
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span className="font-mono text-brand-400">{log.action}</span>
                    <span>{formatDateTime(log.timestamp)}</span>
                  </div>
                  <p className="text-slate-300 mt-1 line-clamp-2">{log.details}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

