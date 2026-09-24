// ==============================================================================
// ECont Dashboard Page - Version 2.0 (Modern Enterprise Logistics Hub)
// Bàn làm việc tổng quan với KPI theo role, deadline alerts, quy trình 7 bước
// ==============================================================================

import React, { useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { useDatabase } from "../context/DatabaseContext";
import { formatVnd, formatRelativeTime, formatCountdown } from "../lib/utils";
import {
  Box,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  TrendingUp,
  AlertTriangle,
  FileText,
  Activity,
  Award,
  Sparkles,
  Bell,
  Package,
  Handshake,
  Ship,
  CreditCard,
  AlertCircle,
  BarChart3,
  RefreshCw,
  ShieldCheck,
  ArrowRight,
  Check,
  HelpCircle,
  PhoneCall,
} from "lucide-react";
import {
  TransactionStatusBadge,
  OfferStatusBadge,
  RequestStatusBadge,
} from "../components/StatusBadge";
import { Transaction } from "../types";

interface DashboardPageProps {
  setCurrentTab: (tab: string) => void;
}

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  color = "blue",
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color?: "blue" | "emerald" | "amber" | "violet" | "red";
  onClick?: () => void;
}) {
  const colorMap = {
    blue: {
      icon: "text-blue-600 bg-blue-50/80 border-blue-100",
      border: "border-slate-200/90 hover:border-blue-300",
      glow: "group-hover:shadow-blue-500/10",
    },
    emerald: {
      icon: "text-emerald-600 bg-emerald-50/80 border-emerald-100",
      border: "border-slate-200/90 hover:border-emerald-300",
      glow: "group-hover:shadow-emerald-500/10",
    },
    amber: {
      icon: "text-amber-600 bg-amber-50/80 border-amber-100",
      border: "border-slate-200/90 hover:border-amber-300",
      glow: "group-hover:shadow-amber-500/10",
    },
    violet: {
      icon: "text-violet-600 bg-violet-50/80 border-violet-100",
      border: "border-slate-200/90 hover:border-violet-300",
      glow: "group-hover:shadow-violet-500/10",
    },
    red: {
      icon: "text-rose-600 bg-rose-50/80 border-rose-100",
      border: "border-slate-200/90 hover:border-rose-300",
      glow: "group-hover:shadow-rose-500/10",
    },
  };
  const c = colorMap[color];

  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`w-full min-w-0 text-left rounded-2xl border bg-white p-4 sm:p-5 shadow-xs hover:shadow-md transition-all group relative overflow-hidden ${
        onClick ? "hover:-translate-y-0.5 cursor-pointer" : "cursor-default"
      } ${c.border} ${c.glow}`}
    >
      <div className="flex items-start justify-between">
        <div
          className={`p-2.5 rounded-xl border ${c.icon} transition-transform group-hover:scale-105`}
        >
          <Icon className="w-5 h-5" />
        </div>
        {onClick && (
          <span className="p-1 rounded-lg text-slate-400 group-hover:text-blue-600 group-hover:bg-blue-50 transition-colors">
            <ArrowUpRight className="w-4 h-4" />
          </span>
        )}
      </div>
      <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-3.5 font-mono whitespace-nowrap truncate tracking-tight">
        {value}
      </p>
      <p className="text-xs sm:text-sm text-slate-600 mt-1 font-semibold truncate">
        {label}
      </p>
      {sub && (
        <p className="text-[11px] text-slate-400 mt-0.5 truncate">{sub}</p>
      )}
    </button>
  );
}

function DeadlineAlert({
  txn,
  setCurrentTab,
  setSelectedTxnId,
}: {
  txn: Transaction;
  setCurrentTab: (t: string) => void;
  setSelectedTxnId?: (id: string) => void;
}) {
  const countdown = formatCountdown(txn.dueAt);
  if (!countdown.isUrgent && !countdown.isExpired) return null;

  return (
    <div
      className={`flex items-start gap-3 rounded-xl border p-4 cursor-pointer hover:shadow-md transition-all ${
        countdown.isExpired
          ? "bg-rose-50/90 border-rose-200 text-rose-900"
          : "bg-amber-50/90 border-amber-200 text-amber-900"
      }`}
      onClick={() => {
        setSelectedTxnId?.(txn.id);
        setCurrentTab("transactions");
      }}
    >
      <Clock
        className={`w-5 h-5 mt-0.5 shrink-0 ${countdown.isExpired ? "text-rose-600" : "text-amber-600"} animate-pulse`}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`text-xs font-bold px-2 py-0.5 rounded-md ${
              countdown.isExpired
                ? "bg-rose-200 text-rose-800"
                : "bg-amber-200 text-amber-800"
            }`}
          >
            {countdown.isExpired
              ? "⛔ Đã hết hạn"
              : `⏰ Còn ${countdown.display}`}
          </span>
          <span className="text-xs font-mono font-bold">{txn.id}</span>
          <span className="text-xs text-slate-600">
            · {txn.asset.containerNumber}
          </span>
        </div>
        <p className="text-xs sm:text-sm font-semibold mt-1 truncate">
          {txn.nextAction}
        </p>
      </div>
      <TransactionStatusBadge status={txn.status} size="sm" />
    </div>
  );
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  setCurrentTab,
}) => {
  const { currentRole, currentCompany, currentUserName, roleBadge } = useAuth();
  const isSupplierRole =
    currentRole === "ENTERPRISE_A" || currentRole === "ENTERPRISE_BOTH";
  const isRequesterRole =
    currentRole === "ENTERPRISE_B" || currentRole === "ENTERPRISE_BOTH";

  const {
    assets,
    offers,
    requests,
    transactions,
    cases,
    notifications,
    unreadNotificationCount,
    markNotificationRead,
    resetToDemoData,
  } = useDatabase();

  // Compute stats relevant to current role and company
  const stats = useMemo(() => {
    const myOffers = offers.filter((o) => o.companyId === currentCompany.id);
    const myRequests = requests.filter(
      (r) => r.companyId === currentCompany.id,
    );
    const myTxns = transactions.filter(
      (t) =>
        t.companyAId === currentCompany.id ||
        t.companyBId === currentCompany.id,
    );
    const activeTxns = myTxns.filter(
      (t) =>
        !["COMPLETED", "CANCELLED", "REJECTED", "EXPIRED"].includes(t.status),
    );
    const completedTxns = myTxns.filter((t) => t.status === "COMPLETED");
    const totalSaving = completedTxns.reduce(
      (acc, t) => acc + Math.max(t.quote.sAVnd, 0) + Math.max(t.quote.sBVnd, 0),
      0,
    );

    return {
      myAssets: assets.filter((a) => a.currentCustodianId === currentCompany.id)
        .length,
      myActiveOffers: myOffers.filter((o) =>
        ["AVAILABLE", "HELD", "ALLOCATED"].includes(o.status),
      ).length,
      myActiveRequests: myRequests.filter((r) =>
        ["OPEN", "HELD", "ALLOCATED"].includes(r.status),
      ).length,
      activeTxns: activeTxns.length,
      completedTxns: completedTxns.length,
      totalSaving,
      // Ops stats
      pendingOpsOffers: offers.filter((o) => o.status === "UNDER_REVIEW")
        .length,
      pendingOpsRequests: requests.filter((r) => r.status === "UNDER_REVIEW")
        .length,
      pendingCarrier: transactions.filter((t) => t.status === "PENDING_CARRIER")
        .length,
      openCases: cases.filter(
        (c) => c.status === "OPEN" || c.status === "IN_REVIEW",
      ).length,
      pendingPayments: transactions.filter(
        (t) => t.status === "AWAITING_PAYMENT",
      ).length,
    };
  }, [assets, offers, requests, transactions, cases, currentCompany.id]);

  const myNotifications = notifications
    .filter((n) => n.recipientCompanyId === currentCompany.id)
    .slice(0, 5);
  const urgentTxns = useMemo(() => {
    return transactions.filter((t) => {
      if (["COMPLETED", "CANCELLED", "REJECTED", "EXPIRED"].includes(t.status))
        return false;
      if (
        t.companyAId !== currentCompany.id &&
        t.companyBId !== currentCompany.id &&
        currentRole !== "OPS"
      )
        return false;
      const cd = formatCountdown(t.dueAt);
      return cd.isUrgent || cd.isExpired;
    });
  }, [transactions, currentCompany.id, currentRole]);

  return (
    <div className="space-y-6 pb-8">
      {/* Welcome Hero Banner */}
      <div className="bg-gradient-to-br from-blue-900 via-slate-900 to-indigo-950 rounded-2xl p-6 sm:p-7 text-white shadow-xl relative overflow-hidden border border-slate-800">
        {/* Ambient background glows */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-80 h-80 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 -mb-16 w-60 h-60 rounded-full bg-teal-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/10 text-blue-200 border border-white/15 backdrop-blur-md">
                <span>{roleBadge.icon}</span>
                <span>{roleBadge.label}</span>
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <ShieldCheck className="w-3.5 h-3.5" />
                Đã định danh IICL
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Xin chào, {currentUserName.split("(")[0].trim()} 👋
            </h2>

            <p className="text-slate-300 text-sm sm:text-base mt-2 leading-relaxed">
              {currentRole === "ENTERPRISE_A" && (
                <>
                  Quản lý kho cont rỗng tại bãi và đăng tải Offer để kết nối
                  street-turn trực tiếp với đơn vị xuất khẩu, cắt giảm chi phí
                  nâng hạ bãi.
                </>
              )}
              {currentRole === "ENTERPRISE_B" && (
                <>
                  Tìm kiếm nguồn cont rỗng chất lượng cao, đúng hãng tàu chỉ
                  định ngay trên tuyến đường xe chạy, tiết kiệm phí kéo rỗng.
                </>
              )}
              {currentRole === "ENTERPRISE_BOTH" && (
                <>
                  Nền tảng kết nối 2 chiều: linh hoạt luân chuyển vỏ cont nhập
                  khẩu sang đóng hàng xuất khẩu với quy trình kiểm soát IICL.
                </>
              )}
              {currentRole === "OPS" && (
                <>
                  Trung tâm giám sát điều hành: kiểm duyệt nguồn vỏ, phê duyệt
                  Reuse RU từ hãng tàu và quản lý quỹ ký quỹ giao dịch.
                </>
              )}
            </p>

            <div className="mt-3 text-xs text-blue-200/80 font-medium">
              Đơn vị:{" "}
              <span className="font-bold text-white">
                {currentCompany.companyName}
              </span>
            </div>
          </div>

          {/* Quick Action CTA Buttons */}
          <div className="flex flex-wrap sm:flex-col gap-2.5 shrink-0">
            {isSupplierRole && (
              <button
                type="button"
                onClick={() => setCurrentTab("offers")}
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 transition-all hover:scale-[1.02]"
              >
                <Box className="w-4 h-4" />
                Đăng nguồn vỏ cont
              </button>
            )}
            {isRequesterRole && (
              <button
                type="button"
                onClick={() => setCurrentTab("requests")}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all hover:scale-[1.02]"
              >
                <Sparkles className="w-4 h-4" />
                Tìm vỏ ghép đôi
              </button>
            )}
            {currentRole === "OPS" && (
              <button
                type="button"
                onClick={() => setCurrentTab("ops")}
                className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-amber-600/30 transition-all hover:scale-[1.02]"
              >
                <Activity className="w-4 h-4" />
                Cổng Điều phối Ops
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Urgent deadline alerts if any */}
      {urgentTxns.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Cảnh báo hạn chót cần xử lý ({urgentTxns.length})
          </h3>
          {urgentTxns.map((txn) => (
            <DeadlineAlert
              key={txn.id}
              txn={txn}
              setCurrentTab={setCurrentTab}
            />
          ))}
        </div>
      )}

      {/* KPI Cards Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-600" />
            Chỉ số vận hành cốt lõi
            <span className="text-xs font-normal text-slate-500">
              ({roleBadge.label})
            </span>
          </h3>
        </div>

        {(isSupplierRole || isRequesterRole) && (
          <div
            className={`grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 ${
              currentRole === "ENTERPRISE_BOTH"
                ? "lg:grid-cols-6"
                : "lg:grid-cols-5"
            }`}
          >
            {isSupplierRole && (
              <KpiCard
                icon={Package}
                label="Nguồn vỏ đang mở"
                value={stats.myActiveOffers}
                sub="Chờ ghép đôi"
                color="blue"
                onClick={() => setCurrentTab("offers")}
              />
            )}
            {isRequesterRole && (
              <KpiCard
                icon={Sparkles}
                label="Nhu cầu đang tìm"
                value={stats.myActiveRequests}
                sub="Hệ thống quét radar"
                color="emerald"
                onClick={() => setCurrentTab("requests")}
              />
            )}
            <KpiCard
              icon={Handshake}
              label="Giao dịch đang chạy"
              value={stats.activeTxns}
              sub="Đang thực hiện"
              color="amber"
              onClick={() => setCurrentTab("transactions")}
            />
            <KpiCard
              icon={CheckCircle2}
              label="Giao dịch hoàn tất"
              value={stats.completedTxns}
              sub="Đã quyết toán EIR"
              color="violet"
              onClick={() => setCurrentTab("transactions")}
            />
            <KpiCard
              icon={TrendingUp}
              label="Tổng tiết kiệm ròng"
              value={formatVnd(stats.totalSaving)}
              sub="Tối ưu chi phí kéo rỗng"
              color="emerald"
            />
            <KpiCard
              icon={AlertCircle}
              label="Sự cố & Khiếu nại"
              value={stats.openCases}
              sub={stats.openCases > 0 ? "Cần giải quyết" : "Không có"}
              color={stats.openCases > 0 ? "red" : "blue"}
              onClick={() => setCurrentTab("cases")}
            />
          </div>
        )}

        {currentRole === "OPS" && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            <KpiCard
              icon={FileText}
              label="Offer chờ thẩm định"
              value={stats.pendingOpsOffers}
              sub="Cần phê duyệt ảnh 6 góc"
              color={stats.pendingOpsOffers > 0 ? "amber" : "blue"}
              onClick={() => setCurrentTab("offers")}
            />
            <KpiCard
              icon={FileText}
              label="Nhu cầu chờ xác minh"
              value={stats.pendingOpsRequests}
              sub="Xác minh booking đóng hàng"
              color={stats.pendingOpsRequests > 0 ? "amber" : "blue"}
              onClick={() => setCurrentTab("requests")}
            />
            <KpiCard
              icon={Ship}
              label="Chờ hãng tàu duyệt RU"
              value={stats.pendingCarrier}
              sub="Thẩm tra chấp thuận Reuse"
              color={stats.pendingCarrier > 0 ? "amber" : "blue"}
              onClick={() => setCurrentTab("ops")}
            />
            <KpiCard
              icon={Handshake}
              label="Giao dịch hoạt động"
              value={
                transactions.filter(
                  (t) =>
                    !["COMPLETED", "CANCELLED", "REJECTED", "EXPIRED"].includes(
                      t.status,
                    ),
                ).length
              }
              sub="Đang giám sát tiến độ"
              color="violet"
              onClick={() => setCurrentTab("transactions")}
            />
            <KpiCard
              icon={CreditCard}
              label="Chờ duyệt ký quỹ"
              value={stats.pendingPayments}
              sub="Xác nhận tiền đặt cọc"
              color={stats.pendingPayments > 0 ? "amber" : "blue"}
              onClick={() => setCurrentTab("transactions")}
            />
            <KpiCard
              icon={AlertCircle}
              label="Sự cố cần giải quyết"
              value={stats.openCases}
              sub="Tranh chấp giám định"
              color={stats.openCases > 0 ? "red" : "blue"}
              onClick={() => setCurrentTab("cases")}
            />
          </div>
        )}
      </div>

      {/* Main 2-Column Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Recent Transactions Table (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900">
                Giao dịch Street-turn gần đây
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Tiến độ luân chuyển vỏ cont giữa các đối tác
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCurrentTab("transactions")}
              className="text-xs sm:text-sm text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1 hover:underline"
            >
              Xem tất cả <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-slate-100 flex-1">
            {transactions.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <Box className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700">
                  Chưa có giao dịch nào
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Các giao dịch phát sinh từ ghép đôi sẽ hiển thị ở đây.
                </p>
              </div>
            ) : (
              transactions.slice(0, 5).map((txn) => (
                <button
                  key={txn.id}
                  type="button"
                  onClick={() => setCurrentTab("transactions")}
                  className="w-full px-5 py-3.5 flex items-start gap-4 hover:bg-slate-50/80 text-left transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-slate-900 font-mono group-hover:text-blue-600 transition-colors">
                        {txn.id}
                      </span>
                      <TransactionStatusBadge status={txn.status} size="sm" />
                      {txn.isOnHold && (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                          ⏸ TẠM DỪNG
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-600 mt-1 truncate">
                      <span className="font-mono font-semibold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded">
                        {txn.asset.containerNumber}
                      </span>
                      <span>·</span>
                      <span className="truncate">{txn.companyAName}</span>
                      <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="truncate">{txn.companyBName}</span>
                    </div>

                    <p className="text-xs text-slate-400 mt-1 truncate">
                      Tiếp theo:{" "}
                      <span className="text-slate-600 font-medium">
                        {txn.nextAction}
                      </span>
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-xs sm:text-sm font-mono font-extrabold text-emerald-600">
                      +
                      {formatVnd(
                        Math.max(txn.quote.sAVnd, 0) +
                          Math.max(txn.quote.sBVnd, 0),
                      )}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {formatRelativeTime(txn.updatedAt)}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right: Notifications & Ops Support Box (1 col) */}
        <div className="space-y-6">
          {/* Notifications feed */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                <Bell className="w-4 h-4 text-slate-500" />
                Thông báo mới
                {unreadNotificationCount > 0 && (
                  <span className="min-w-[18px] h-4.5 rounded-full bg-rose-600 text-white text-[11px] font-bold px-1.5 flex items-center justify-center">
                    {unreadNotificationCount}
                  </span>
                )}
              </h3>
            </div>

            <div className="divide-y divide-slate-100">
              {myNotifications.length === 0 ? (
                <p className="px-5 py-8 text-xs text-slate-400 text-center">
                  Không có thông báo mới
                </p>
              ) : (
                myNotifications.map((notif) => (
                  <button
                    key={notif.id}
                    type="button"
                    onClick={() => markNotificationRead(notif.id)}
                    className={`w-full px-4 py-3 text-left transition-colors hover:bg-slate-50/80 ${
                      !notif.isRead ? "bg-blue-50/30" : ""
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      {!notif.isRead && (
                        <span className="w-2 h-2 rounded-full bg-blue-600 mt-1.5 shrink-0" />
                      )}
                      <div className={!notif.isRead ? "" : "pl-2"}>
                        <p
                          className={`text-xs font-bold leading-snug ${notif.isRead ? "text-slate-700" : "text-slate-900"}`}
                        >
                          {notif.title}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">
                          {notif.body}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-1">
                          {formatRelativeTime(notif.createdAt)}
                        </p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Support & Hotline Card */}
          <div className="rounded-2xl border border-blue-200/80 bg-gradient-to-br from-blue-50/80 to-indigo-50/40 p-4.5 shadow-xs">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-blue-500/20">
                <PhoneCall className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900">
                  Ban Điều Phối ECont Ops
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Hỗ trợ xử lý chứng từ EIR điện tử, duyệt hãng tàu và hòa giải
                  tranh chấp 24/7.
                </p>
                <div className="mt-2 text-xs font-bold text-blue-700">
                  Hotline: 1900 6868 · ops@econt.vn
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reset Demo Data Button */}
      <div className="flex justify-center pt-4">
        <button
          type="button"
          onClick={resetToDemoData}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Khôi phục dữ liệu mẫu ban đầu
        </button>
      </div>
    </div>
  );
};
