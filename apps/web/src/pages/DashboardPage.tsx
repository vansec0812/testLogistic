// ==============================================================================
// ECont Dashboard Page - Version 2.0
// Bàn làm việc tổng quan với KPI theo role, deadline alerts, quick actions
// ==============================================================================

import React, { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useDatabase } from '../context/DatabaseContext';
import { formatVnd, formatRelativeTime, formatCountdown } from '../lib/utils';
import {
  Box, ArrowUpRight, Clock, CheckCircle2, TrendingUp, AlertTriangle,
  FileText, Activity, Award, Sparkles, Bell, Package, Handshake,
  Ship, CreditCard, AlertCircle, BarChart3, RefreshCw
} from 'lucide-react';
import { TransactionStatusBadge, OfferStatusBadge, RequestStatusBadge } from '../components/StatusBadge';
import { Transaction, ContainerRequest, MatchCandidate } from '../types';
import { findMatchesForRequest } from '../services/matchingEngine';

interface DashboardPageProps {
  setCurrentTab: (tab: string) => void;
}

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  color = 'blue',
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color?: 'blue' | 'emerald' | 'amber' | 'violet' | 'red';
  onClick?: () => void;
}) {
  const colorMap = {
    blue: { icon: 'text-blue-600 bg-blue-50', border: 'border-blue-100' },
    emerald: { icon: 'text-emerald-600 bg-emerald-50', border: 'border-emerald-100' },
    amber: { icon: 'text-amber-600 bg-amber-50', border: 'border-amber-100' },
    violet: { icon: 'text-violet-600 bg-violet-50', border: 'border-violet-100' },
    red: { icon: 'text-red-600 bg-red-50', border: 'border-red-100' },
  };
  const c = colorMap[color];
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`w-full text-left rounded-xl border bg-white p-4 shadow-sm hover:shadow-md transition-all ${
        onClick ? 'hover:-translate-y-0.5 cursor-pointer' : 'cursor-default'
      } ${c.border}`}
    >
      <div className="flex items-start justify-between">
        <div className={`p-2 rounded-lg ${c.icon}`}>
          <Icon className="w-4 h-4" />
        </div>
        {onClick && <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 mt-1" />}
      </div>
      <p className="text-2xl font-bold text-slate-900 mt-3 font-mono">{value}</p>
      <p className="text-xs text-slate-500 mt-0.5 font-medium">{label}</p>
      {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
    </button>
  );
}

function DeadlineAlert({ txn, setCurrentTab, setSelectedTxnId }: {
  txn: Transaction;
  setCurrentTab: (t: string) => void;
  setSelectedTxnId?: (id: string) => void;
}) {
  const countdown = formatCountdown(txn.dueAt);
  if (!countdown.isUrgent && !countdown.isExpired) return null;

  return (
    <div
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 cursor-pointer hover:opacity-90 ${
        countdown.isExpired
          ? 'bg-red-50 border-red-200'
          : 'bg-amber-50 border-amber-200'
      }`}
      onClick={() => {
        setSelectedTxnId?.(txn.id);
        setCurrentTab('transactions');
      }}
    >
      <Clock className={`w-4 h-4 mt-0.5 shrink-0 ${countdown.isExpired ? 'text-red-500' : 'text-amber-500'} animate-pulse`} />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${countdown.isExpired ? 'text-red-700' : 'text-amber-700'}`}>
          {countdown.isExpired ? '⛔ Đã hết hạn' : `⏰ Còn ${countdown.display}`} · {txn.id}
        </p>
        <p className="text-xs text-slate-500 mt-0.5 truncate">{txn.nextAction}</p>
      </div>
      <TransactionStatusBadge status={txn.status} size="xs" />
    </div>
  );
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ setCurrentTab }) => {
  const { currentRole, currentCompany, currentUserName, roleBadge } = useAuth();
  const {
    assets, offers, requests, transactions, cases, auditLogs,
    notifications, unreadNotificationCount, markNotificationRead, resetToDemoData,
  } = useDatabase();

  // Compute stats relevant to current role and company
  const stats = useMemo(() => {
    const myOffers = offers.filter(o => o.companyId === currentCompany.id);
    const myRequests = requests.filter(r => r.companyId === currentCompany.id);
    const myTxns = transactions.filter(t =>
      t.companyAId === currentCompany.id || t.companyBId === currentCompany.id
    );
    const activeTxns = myTxns.filter(t =>
      !['COMPLETED', 'CANCELLED', 'REJECTED', 'EXPIRED'].includes(t.status)
    );
    const completedTxns = myTxns.filter(t => t.status === 'COMPLETED');
    const totalSaving = completedTxns.reduce((acc, t) =>
      acc + Math.max(t.quote.sAVnd, 0) + Math.max(t.quote.sBVnd, 0), 0
    );

    return {
      myAssets: assets.filter(a => a.currentCustodianId === currentCompany.id).length,
      myActiveOffers: myOffers.filter(o => ['AVAILABLE', 'HELD', 'ALLOCATED'].includes(o.status)).length,
      myActiveRequests: myRequests.filter(r => ['OPEN', 'HELD', 'ALLOCATED'].includes(r.status)).length,
      activeTxns: activeTxns.length,
      completedTxns: completedTxns.length,
      totalSaving,
      urgentTxns: activeTxns.filter(t => {
        const cd = formatCountdown(t.dueAt);
        return cd.isUrgent || cd.isExpired;
      }),
      // Ops stats
      pendingOpsOffers: offers.filter(o => o.status === 'UNDER_REVIEW').length,
      pendingOpsRequests: requests.filter(r => r.status === 'UNDER_REVIEW').length,
      pendingCarrier: transactions.filter(t => t.status === 'PENDING_CARRIER').length,
      openCases: cases.filter(c => c.status === 'OPEN' || c.status === 'IN_REVIEW').length,
      // Finance stats
      pendingPayments: transactions.filter(t => t.status === 'AWAITING_PAYMENT').length,
    };
  }, [assets, offers, requests, transactions, cases, currentCompany.id]);

  const myNotifications = notifications.filter(n => n.recipientCompanyId === currentCompany.id).slice(0, 5);
  const urgentTxns = useMemo(() => {
    return transactions.filter(t => {
      if (['COMPLETED', 'CANCELLED', 'REJECTED', 'EXPIRED'].includes(t.status)) return false;
      if (t.companyAId !== currentCompany.id && t.companyBId !== currentCompany.id &&
          currentRole !== 'OPS' && currentRole !== 'FINANCE' && currentRole !== 'SUPER_ADMIN') return false;
      const cd = formatCountdown(t.dueAt);
      return cd.isUrgent || cd.isExpired;
    });
  }, [transactions, currentCompany.id, currentRole]);

  const availableOffers = useMemo(() => offers.filter(o => o.status === 'AVAILABLE'), [offers]);
  const openRequests = useMemo(() => requests.filter(r => r.status === 'OPEN'), [requests]);

  const liveMatches = useMemo(() => {
    const list: Array<{ req: ContainerRequest; bestCand: MatchCandidate }> = [];
    openRequests.forEach(req => {
      const res = findMatchesForRequest(req, availableOffers);
      if (res.candidates.length > 0) {
        list.push({ req, bestCand: res.candidates[0] });
      }
    });
    return list;
  }, [openRequests, availableOffers]);

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-navy-900 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-brand-900/10 to-transparent pointer-events-none" />
        <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${roleBadge.color} ${roleBadge.bgColor}`}>
                {roleBadge.icon} {roleBadge.label}
              </span>
              <span className="text-xs text-slate-400">· {roleBadge.desc}</span>
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              Xin chào, {currentUserName.split(' ')[0]} 👋
            </h2>
            <p className="text-sm text-slate-300 mt-1">
              <span className="font-semibold text-white">{currentCompany.companyName}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {currentRole === 'ENTERPRISE_A' && (
              <button
                onClick={() => setCurrentTab('offers')}
                className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold flex items-center gap-2 transition-all"
              >
                <Box className="w-4 h-4" />
                Đăng nguồn vỏ cont
              </button>
            )}
            {currentRole === 'ENTERPRISE_B' && (
              <button
                onClick={() => setCurrentTab('requests')}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold flex items-center gap-2 transition-all"
              >
                <Sparkles className="w-4 h-4" />
                Tìm vỏ ghép đôi
              </button>
            )}
            {(currentRole === 'OPS' || currentRole === 'SUPER_ADMIN') && (
              <button
                onClick={() => setCurrentTab('ops')}
                className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold flex items-center gap-2 transition-all"
              >
                <Activity className="w-4 h-4" />
                Vào cổng Vận hành
              </button>
            )}
            {(currentRole === 'FINANCE' || currentRole === 'SUPER_ADMIN') && (
              <button
                onClick={() => setCurrentTab('finance')}
                className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold flex items-center gap-2 transition-all"
              >
                <CreditCard className="w-4 h-4" />
                Cổng Tài chính
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Urgent deadline alerts */}
      {urgentTxns.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Cảnh báo deadline ({urgentTxns.length})
          </h3>
          {urgentTxns.map(txn => (
            <DeadlineAlert key={txn.id} txn={txn} setCurrentTab={setCurrentTab} />
          ))}
        </div>
      )}

      {/* KPI Cards */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-slate-400" />
          Tổng quan
          {currentRole === 'ENTERPRISE_A' && ' · Bên A'}
          {currentRole === 'ENTERPRISE_B' && ' · Bên B'}
          {currentRole === 'OPS' && ' · Vận hành'}
          {currentRole === 'FINANCE' && ' · Tài chính'}
          {currentRole === 'SUPER_ADMIN' && ' · Hệ thống'}
        </h3>

        {(currentRole === 'ENTERPRISE_A' || currentRole === 'ENTERPRISE_B') && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {currentRole === 'ENTERPRISE_A' && (
              <KpiCard
                icon={Box} label="Container đang quản lý" value={stats.myAssets}
                color="blue" onClick={() => setCurrentTab('assets')}
              />
            )}
            {currentRole === 'ENTERPRISE_A' && (
              <KpiCard
                icon={Package} label="Offer đang hoạt động" value={stats.myActiveOffers}
                color="emerald" onClick={() => setCurrentTab('offers')}
              />
            )}
            {currentRole === 'ENTERPRISE_B' && (
              <KpiCard
                icon={Sparkles} label="Nhu cầu đang tìm" value={stats.myActiveRequests}
                color="emerald" onClick={() => setCurrentTab('requests')}
              />
            )}
            <KpiCard
              icon={Handshake} label="Giao dịch đang diễn ra" value={stats.activeTxns}
              color="amber" onClick={() => setCurrentTab('transactions')}
            />
            <KpiCard
              icon={CheckCircle2} label="Giao dịch hoàn tất" value={stats.completedTxns}
              color="violet" onClick={() => setCurrentTab('transactions')}
            />
            <KpiCard
              icon={TrendingUp} label="Tổng tiết kiệm ròng" value={formatVnd(stats.totalSaving)}
              color="emerald"
              sub="Từ tất cả giao dịch hoàn tất"
            />
            <KpiCard
              icon={AlertCircle} label="Case đang mở" value={stats.openCases}
              color={stats.openCases > 0 ? 'red' : 'blue'} onClick={() => setCurrentTab('cases')}
            />
          </div>
        )}

        {(currentRole === 'OPS' || currentRole === 'SUPER_ADMIN') && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <KpiCard icon={FileText} label="Offer chờ thẩm định" value={stats.pendingOpsOffers}
              color={stats.pendingOpsOffers > 0 ? 'amber' : 'blue'} onClick={() => setCurrentTab('offers')} />
            <KpiCard icon={FileText} label="Nhu cầu chờ xác minh" value={stats.pendingOpsRequests}
              color={stats.pendingOpsRequests > 0 ? 'amber' : 'blue'} onClick={() => setCurrentTab('requests')} />
            <KpiCard icon={Ship} label="Chờ hãng tàu duyệt" value={stats.pendingCarrier}
              color={stats.pendingCarrier > 0 ? 'amber' : 'blue'} onClick={() => setCurrentTab('ops')} />
            <KpiCard icon={Handshake} label="Giao dịch hoạt động" value={transactions.filter(t => !['COMPLETED','CANCELLED','REJECTED','EXPIRED'].includes(t.status)).length}
              color="violet" onClick={() => setCurrentTab('transactions')} />
            <KpiCard icon={AlertCircle} label="Case cần xử lý" value={stats.openCases}
              color={stats.openCases > 0 ? 'red' : 'blue'} onClick={() => setCurrentTab('cases')} />
          </div>
        )}

        {currentRole === 'FINANCE' && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard icon={CreditCard} label="Chờ đối soát thanh toán" value={stats.pendingPayments}
              color={stats.pendingPayments > 0 ? 'amber' : 'blue'} onClick={() => setCurrentTab('finance')} />
            <KpiCard icon={CheckCircle2} label="Giao dịch đã hoàn tất" value={transactions.filter(t => t.status === 'COMPLETED').length}
              color="emerald" onClick={() => setCurrentTab('transactions')} />
            <KpiCard icon={TrendingUp} label="Tổng tiết kiệm ròng" value={formatVnd(transactions.filter(t => t.status === 'COMPLETED').reduce((a, t) => a + Math.max(t.quote.sAVnd, 0) + Math.max(t.quote.sBVnd, 0), 0))}
              color="violet" />
            <KpiCard icon={AlertCircle} label="Case liên quan thanh toán" value={cases.filter(c => c.caseType === 'PAYMENT_ISSUE' && c.status !== 'CLOSED').length}
              color="red" onClick={() => setCurrentTab('cases')} />
          </div>
        )}
      </div>

      {/* Auto-Match Radar Widget */}
      {liveMatches.length > 0 && (
        <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 text-white rounded-2xl p-5 border border-emerald-700/50 shadow-lg space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
              <div>
                <h3 className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
                  <span>RADAR TỰ ĐỘNG GHÉP ĐÔI REAL-TIME (AUTO-MATCH RADAR)</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500 text-slate-950">
                    LIVE
                  </span>
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Phát hiện <strong className="text-emerald-400">{liveMatches.length}</strong> cơ hội ghép vỏ container tối ưu ngay lúc này
                </p>
              </div>
            </div>

            <button
              onClick={() => setCurrentTab('requests')}
              className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5"
            >
              <span>Xem tất cả trên Sàn Nhu Cầu</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {liveMatches.slice(0, 2).map(({ req, bestCand }) => (
              <div
                key={req.id}
                className="p-3.5 rounded-xl bg-slate-900/80 border border-emerald-600/30 flex items-center justify-between gap-3"
              >
                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-white text-sm">{bestCand.offer.asset.containerNumber}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 font-mono font-bold">
                      M: {bestCand.scoreM}/100
                    </span>
                    <span className="text-slate-400">↔ {req.bookingNumber}</span>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    Khoảng cách: <strong className="text-white">{bestCand.distanceKm}km</strong> · Tiết kiệm dự kiến: <strong className="text-emerald-400 font-mono">{formatVnd(Math.abs(bestCand.quote.sBVnd))}</strong>
                  </p>
                </div>

                <button
                  onClick={() => setCurrentTab('requests')}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold whitespace-nowrap shadow-sm"
                >
                  Khớp Ngay
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Recent transactions */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">Giao dịch gần đây</h3>
            <button
              onClick={() => setCurrentTab('transactions')}
              className="text-xs text-brand-600 hover:text-brand-700 font-semibold flex items-center gap-1"
            >
              Xem tất cả <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="divide-y divide-slate-50">
            {transactions.length === 0 && (
              <p className="px-5 py-8 text-sm text-slate-400 text-center">Chưa có giao dịch nào</p>
            )}
            {transactions.slice(0, 5).map(txn => (
              <button
                key={txn.id}
                onClick={() => setCurrentTab('transactions')}
                className="w-full px-5 py-3.5 flex items-start gap-4 hover:bg-slate-50 text-left transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-slate-800 font-mono">{txn.id}</span>
                    <TransactionStatusBadge status={txn.status} size="xs" />
                    {txn.isOnHold && (
                      <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded px-1">⏸ HOLD</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1 truncate">
                    {txn.asset.containerNumber} · {txn.companyAName} → {txn.companyBName}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5 truncate">{txn.nextAction}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-mono font-semibold text-emerald-600">
                    {formatVnd(Math.max(txn.quote.sAVnd, 0) + Math.max(txn.quote.sBVnd, 0))}
                  </p>
                  <p className="text-[10px] text-slate-400">{formatRelativeTime(txn.updatedAt)}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Bell className="w-3.5 h-3.5 text-slate-400" />
              Thông báo
              {unreadNotificationCount > 0 && (
                <span className="min-w-[18px] h-4.5 rounded-full bg-red-500 text-white text-[10px] font-bold px-1.5 leading-none flex items-center justify-center">
                  {unreadNotificationCount}
                </span>
              )}
            </h3>
          </div>
          <div className="divide-y divide-slate-50">
            {myNotifications.length === 0 && (
              <p className="px-5 py-8 text-sm text-slate-400 text-center">Không có thông báo mới</p>
            )}
            {myNotifications.map(notif => (
              <button
                key={notif.id}
                onClick={() => markNotificationRead(notif.id)}
                className={`w-full px-5 py-3.5 text-left transition-colors hover:bg-slate-50 ${
                  !notif.isRead ? 'bg-brand-50/30' : ''
                }`}
              >
                <div className="flex items-start gap-2">
                  {!notif.isRead && (
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-500 mt-1.5 shrink-0" />
                  )}
                  <div className={!notif.isRead ? '' : 'pl-3.5'}>
                    <p className={`text-xs font-semibold leading-snug ${notif.isRead ? 'text-slate-500' : 'text-slate-800'}`}>
                      {notif.title}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">{notif.body}</p>
                    <p className="text-[10px] text-slate-300 mt-1">{formatRelativeTime(notif.createdAt)}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Demo: Reset to initial data */}
      <div className="flex justify-center pt-2">
        <button
          onClick={resetToDemoData}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <RefreshCw className="w-3 h-3" />
          Reset về dữ liệu demo ban đầu
        </button>
      </div>
    </div>
  );
};
