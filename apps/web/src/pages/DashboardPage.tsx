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
import { Transaction } from '../types';

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
    blue: { icon: 'text-blue-600 bg-blue-50', border: 'border-blue-100 hover:border-blue-300' },
    emerald: { icon: 'text-emerald-600 bg-emerald-50', border: 'border-emerald-100 hover:border-emerald-300' },
    amber: { icon: 'text-amber-600 bg-amber-50', border: 'border-amber-100 hover:border-amber-300' },
    violet: { icon: 'text-violet-600 bg-violet-50', border: 'border-violet-100 hover:border-violet-300' },
    red: { icon: 'text-red-600 bg-red-50', border: 'border-red-100 hover:border-red-300' },
  };
  const c = colorMap[color];
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`w-full min-w-0 text-left rounded-2xl border bg-white p-4 sm:p-5 shadow-sm hover:shadow-md transition-all ${
        onClick ? 'hover:-translate-y-0.5 cursor-pointer' : 'cursor-default'
      } ${c.border}`}
    >
      <div className="flex items-start justify-between">
        <div className={`p-2.5 rounded-xl ${c.icon}`}>
          <Icon className="w-5 h-5" />
        </div>
        {onClick && <ArrowUpRight className="w-4 h-4 text-slate-400 mt-1" />}
      </div>
      <p className="text-2xl sm:text-3xl lg:text-2xl font-bold text-slate-900 mt-3 font-mono whitespace-nowrap truncate">{value}</p>
      <p className="text-sm text-slate-600 mt-1 font-medium">{label}</p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
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
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 cursor-pointer hover:opacity-95 shadow-sm ${
        countdown.isExpired
          ? 'bg-red-50 border-red-200'
          : 'bg-amber-50 border-amber-200'
      }`}
      onClick={() => {
        setSelectedTxnId?.(txn.id);
        setCurrentTab('transactions');
      }}
    >
      <Clock className={`w-4 h-4 mt-0.5 shrink-0 ${countdown.isExpired ? 'text-red-600' : 'text-amber-600'} animate-pulse`} />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${countdown.isExpired ? 'text-red-800' : 'text-amber-800'}`}>
          {countdown.isExpired ? '⛔ Đã hết hạn' : `⏰ Còn ${countdown.display}`} · {txn.id}
        </p>
        <p className="text-xs sm:text-sm text-slate-600 mt-0.5 truncate">{txn.nextAction}</p>
      </div>
      <TransactionStatusBadge status={txn.status} size="sm" />
    </div>
  );
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ setCurrentTab }) => {
  const { currentRole, currentCompany, currentUserName, roleBadge } = useAuth();
  const isSupplierRole = currentRole === 'ENTERPRISE_A' || currentRole === 'ENTERPRISE_BOTH';
  const isRequesterRole = currentRole === 'ENTERPRISE_B' || currentRole === 'ENTERPRISE_BOTH';
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
      // Payment review stats handled by Ops
      pendingPayments: transactions.filter(t => t.status === 'AWAITING_PAYMENT').length,
    };
  }, [assets, offers, requests, transactions, cases, currentCompany.id]);

  const myNotifications = notifications.filter(n => n.recipientCompanyId === currentCompany.id).slice(0, 5);
  const urgentTxns = useMemo(() => {
    return transactions.filter(t => {
      if (['COMPLETED', 'CANCELLED', 'REJECTED', 'EXPIRED'].includes(t.status)) return false;
      if (t.companyAId !== currentCompany.id && t.companyBId !== currentCompany.id &&
          currentRole !== 'OPS') return false;
      const cd = formatCountdown(t.dueAt);
      return cd.isUrgent || cd.isExpired;
    });
  }, [transactions, currentCompany.id, currentRole]);

  return (
    <div className="space-y-6">
      {/* Welcome Banner (Light Modern Enterprise SaaS Style) */}
      <div className="bg-gradient-to-r from-blue-50/90 via-indigo-50/40 to-white rounded-2xl p-6 sm:p-7 border border-blue-200/80 shadow-sm relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-blue-100/30 to-transparent pointer-events-none" />
        <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${roleBadge.color} ${roleBadge.bgColor}`}>
                {roleBadge.icon} {roleBadge.label}
              </span>
              <span className="text-xs text-slate-500 font-medium">· {roleBadge.desc}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Xin chào, {currentUserName.split('(')[0].trim()} 👋
            </h2>
            <p className="text-sm sm:text-base text-slate-600 mt-1.5 font-medium">
              Doanh nghiệp: <span className="font-bold text-slate-900">{currentCompany.companyName}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {isSupplierRole && (
              <button
                onClick={() => setCurrentTab('offers')}
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold flex items-center gap-2 shadow-sm transition-all"
              >
                <Box className="w-4 h-4" />
                Đăng nguồn vỏ cont
              </button>
            )}
            {isRequesterRole && (
              <button
                onClick={() => setCurrentTab('requests')}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold flex items-center gap-2 shadow-sm transition-all"
              >
                <Sparkles className="w-4 h-4" />
                Tìm vỏ ghép đôi
              </button>
            )}
            {currentRole === 'OPS' && (
              <button
                onClick={() => setCurrentTab('ops')}
                className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold flex items-center gap-2 shadow-sm transition-all"
              >
                <Activity className="w-4 h-4" />
                Vào cổng Vận hành
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Urgent deadline alerts */}
      {urgentTxns.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm sm:text-base font-bold text-slate-800 flex items-center gap-2">
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
        <h3 className="text-sm sm:text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-blue-600" />
          Tổng quan chỉ số
          {currentRole === 'ENTERPRISE_A' && ' · Nhà cung cấp Container'}
          {currentRole === 'ENTERPRISE_B' && ' · Cần vỏ Container'}
          {currentRole === 'ENTERPRISE_BOTH' && ' · Nhà cung cấp & Cần vỏ Container'}
          {currentRole === 'OPS' && ' · Vận hành & Điều phối'}
        </h3>

        {(isSupplierRole || isRequesterRole) && (
          <div className={`grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 ${
            currentRole === 'ENTERPRISE_BOTH' ? 'lg:grid-cols-7' : currentRole === 'ENTERPRISE_A' ? 'lg:grid-cols-6' : 'lg:grid-cols-5'
          }`}>
            {isSupplierRole && (
              <KpiCard
                icon={Box} label="Container đang quản lý" value={stats.myAssets}
                color="blue" onClick={() => setCurrentTab('offers')}
              />
            )}
            {isSupplierRole && (
              <KpiCard
                icon={Package} label="Offer đang hoạt động" value={stats.myActiveOffers}
                color="emerald" onClick={() => setCurrentTab('offers')}
              />
            )}
            {isRequesterRole && (
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
              icon={AlertCircle} label="Sự cố & Khiếu nại" value={stats.openCases}
              color={stats.openCases > 0 ? 'red' : 'blue'} onClick={() => setCurrentTab('cases')}
            />
          </div>
        )}

        {currentRole === 'OPS' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            <KpiCard icon={FileText} label="Offer chờ thẩm định" value={stats.pendingOpsOffers}
              color={stats.pendingOpsOffers > 0 ? 'amber' : 'blue'} onClick={() => setCurrentTab('offers')} />
            <KpiCard icon={FileText} label="Nhu cầu chờ xác minh" value={stats.pendingOpsRequests}
              color={stats.pendingOpsRequests > 0 ? 'amber' : 'blue'} onClick={() => setCurrentTab('requests')} />
            <KpiCard icon={Ship} label="Chờ hãng tàu duyệt RU" value={stats.pendingCarrier}
              color={stats.pendingCarrier > 0 ? 'amber' : 'blue'} onClick={() => setCurrentTab('ops')} />
            <KpiCard icon={Handshake} label="Giao dịch hoạt động" value={transactions.filter(t => !['COMPLETED','CANCELLED','REJECTED','EXPIRED'].includes(t.status)).length}
              color="violet" onClick={() => setCurrentTab('transactions')} />
            <KpiCard icon={CreditCard} label="Chờ Ops xác nhận tiền" value={stats.pendingPayments}
              color={stats.pendingPayments > 0 ? 'amber' : 'blue'} onClick={() => setCurrentTab('transactions')} />
            <KpiCard icon={AlertCircle} label="Case cần xử lý" value={stats.openCases}
              color={stats.openCases > 0 ? 'red' : 'blue'} onClick={() => setCurrentTab('cases')} />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Recent transactions */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h3 className="text-sm sm:text-base font-bold text-slate-900">Giao dịch gần đây</h3>
            <button
              onClick={() => setCurrentTab('transactions')}
              className="text-xs sm:text-sm text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1"
            >
              Xem tất cả <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>
          <div className="divide-y divide-slate-100">
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
                    <span className="text-sm font-bold text-slate-900 font-mono">{txn.id}</span>
                    <TransactionStatusBadge status={txn.status} size="sm" />
                    {txn.isOnHold && (
                      <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-1.5 py-0.5">⏸ HOLD</span>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm text-slate-600 mt-1 truncate">
                    {txn.asset.containerNumber} · {txn.companyAName} → {txn.companyBName}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5 truncate">{txn.nextAction}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs sm:text-sm font-mono font-bold text-emerald-600">
                    {formatVnd(Math.max(txn.quote.sAVnd, 0) + Math.max(txn.quote.sBVnd, 0))}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">{formatRelativeTime(txn.updatedAt)}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
              <Bell className="w-4 h-4 text-slate-500" />
              Thông báo
              {unreadNotificationCount > 0 && (
                <span className="min-w-[20px] h-5 rounded-full bg-red-600 text-white text-xs font-bold px-1.5 leading-none flex items-center justify-center">
                  {unreadNotificationCount}
                </span>
              )}
            </h3>
          </div>
          <div className="divide-y divide-slate-100">
            {myNotifications.length === 0 && (
              <p className="px-5 py-8 text-sm text-slate-400 text-center">Không có thông báo mới</p>
            )}
            {myNotifications.map(notif => (
              <button
                key={notif.id}
                onClick={() => markNotificationRead(notif.id)}
                className={`w-full px-5 py-3.5 text-left transition-colors hover:bg-slate-50 ${
                  !notif.isRead ? 'bg-blue-50/30' : ''
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {!notif.isRead && (
                    <span className="w-2 h-2 rounded-full bg-blue-600 mt-1.5 shrink-0" />
                  )}
                  <div className={!notif.isRead ? '' : 'pl-3'}>
                    <p className={`text-xs sm:text-sm font-bold leading-snug ${notif.isRead ? 'text-slate-600' : 'text-slate-900'}`}>
                      {notif.title}
                    </p>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">{notif.body}</p>
                    <p className="text-xs text-slate-400 mt-1">{formatRelativeTime(notif.createdAt)}</p>
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
