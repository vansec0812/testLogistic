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

const semanticColorMap: Record<
  string,
  {
    iconBox: string;
    arrow: string;
  }
> = {
  blue: {
    iconBox: "bg-blue-50 text-blue-600 border-blue-200",
    arrow: "group-hover:text-blue-600 group-hover:bg-blue-50",
  },
  sky: {
    iconBox: "bg-sky-50 text-sky-600 border-sky-200",
    arrow: "group-hover:text-sky-600 group-hover:bg-sky-50",
  },
  amber: {
    iconBox: "bg-amber-50 text-amber-600 border-amber-200",
    arrow: "group-hover:text-amber-600 group-hover:bg-amber-50",
  },
  emerald: {
    iconBox: "bg-emerald-50 text-emerald-600 border-emerald-200",
    arrow: "group-hover:text-emerald-600 group-hover:bg-emerald-50",
  },
  violet: {
    iconBox: "bg-violet-50 text-violet-600 border-violet-200",
    arrow: "group-hover:text-violet-600 group-hover:bg-violet-50",
  },
  teal: {
    iconBox: "bg-teal-50 text-teal-600 border-teal-200",
    arrow: "group-hover:text-teal-600 group-hover:bg-teal-50",
  },
  red: {
    iconBox: "bg-red-50 text-red-600 border-red-200",
    arrow: "group-hover:text-red-600 group-hover:bg-red-50",
  },
  slate: {
    iconBox: "bg-slate-100 text-slate-600 border-slate-200",
    arrow: "group-hover:text-slate-600 group-hover:bg-slate-100",
  },
};

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  color = "blue",
  onClick,
  className = "",
  isAlert = false,
  tier,
  badge,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color?: "blue" | "sky" | "amber" | "emerald" | "violet" | "teal" | "red" | "slate";
  onClick?: () => void;
  className?: string;
  isAlert?: boolean;
  tier?: "active" | "neutral" | "alert";
  badge?: string;
}) {
  const alertActive = isAlert || tier === "alert";
  const colorConf = semanticColorMap[color] || semanticColorMap.blue;

  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`w-full min-w-0 text-left rounded-2xl transition-all group relative flex flex-col justify-between h-full ${
        onClick ? "hover:-translate-y-0.5 cursor-pointer" : "cursor-default"
      } border border-slate-200/90 bg-white hover:border-slate-300 shadow-2xs hover:shadow-xs ${className || "p-4 sm:p-5"}`}
    >
      <div className="w-full flex-1 flex flex-col">
        <div className="flex items-start justify-between">
          {/* Uniform 44x44px icon container with semantic color formula */}
          <div
            className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${colorConf.iconBox}`}
          >
            <Icon className="w-5 h-5" />
          </div>

          {onClick && (
            <span
              className={`p-1.5 rounded-lg text-slate-400 transition-all ${colorConf.arrow} group-hover:translate-x-0.5 group-hover:-translate-y-0.5`}
              title="Nhấn để mở danh sách chi tiết"
            >
              <ArrowUpRight className="w-4 h-4" />
            </span>
          )}
        </div>

        {badge && (
          <div className="mt-2.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-red-100 text-red-700 border border-red-200 shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse shrink-0" />
              {badge}
            </span>
          </div>
        )}

        <div className="mt-auto pt-3">
          <p
            className={`text-2xl sm:text-3xl font-extrabold font-mono whitespace-nowrap tracking-tight ${
              alertActive ? "text-red-700" : "text-slate-900"
            }`}
          >
            {value}
          </p>
          <p className="text-xs sm:text-sm mt-1 font-semibold text-slate-600 leading-snug">
            {label}
          </p>
        </div>
      </div>
      {sub && (
        <p
          className={`text-[11px] mt-2 leading-snug font-medium ${
            alertActive ? "text-red-600 font-semibold" : "text-slate-400"
          }`}
        >
          {sub}
        </p>
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

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex-1 max-w-3xl">
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/10 text-blue-200 border border-white/15 backdrop-blur-md">
                <span>{roleBadge.icon}</span>
                <span>{roleBadge.label}</span>
              </span>
              {currentRole === "OPS" ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-800/60 text-blue-200 border border-blue-500/30">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Ban Điều Phối Trung Tâm
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Đã định danh IICL
                </span>
              )}
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Xin chào, {currentUserName.split("(")[0].trim()} 👋
            </h2>

            <p className="text-slate-300 text-xs sm:text-sm mt-1.5 leading-relaxed line-clamp-2 sm:line-clamp-1">
              {currentRole === "ENTERPRISE_A" &&
                "Kết nối street-turn trực tiếp nguồn cont rỗng tại bãi với các đơn vị xuất khẩu."}
              {currentRole === "ENTERPRISE_B" &&
                "Tìm kiếm và tái sử dụng vỏ cont rỗng đúng hãng tàu chỉ định ngay trên tuyến đường xe chạy."}
              {currentRole === "ENTERPRISE_BOTH" &&
                "Linh hoạt luân chuyển vỏ cont 2 chiều xuất nhập khẩu với quy trình kiểm soát IICL."}
              {currentRole === "OPS" &&
                "Trung tâm điều hành: kiểm duyệt nguồn vỏ, duyệt Reuse RU và quản lý quỹ ký quỹ."}
            </p>
          </div>

          {/* Quick Action CTA Buttons */}
          <div className="flex flex-col sm:flex-row md:flex-col lg:flex-row items-stretch sm:items-center gap-3 shrink-0 w-full md:w-auto">
            {isSupplierRole && (
              <button
                type="button"
                onClick={() => setCurrentTab("offers")}
                className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold flex items-center justify-center gap-2.5 shadow-lg shadow-blue-600/30 transition-all hover:scale-[1.02] whitespace-nowrap"
              >
                <Box className="w-4 h-4" />
                <span>Đăng nguồn vỏ cont</span>
              </button>
            )}
            {isRequesterRole && (
              <button
                type="button"
                onClick={() => setCurrentTab("requests")}
                className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold flex items-center justify-center gap-2.5 shadow-lg shadow-emerald-600/30 transition-all hover:scale-[1.02] whitespace-nowrap"
              >
                <Sparkles className="w-4 h-4" />
                <span>Tìm vỏ ghép đôi</span>
              </button>
            )}
            {currentRole === "OPS" && (
              <button
                type="button"
                onClick={() => setCurrentTab("ops")}
                className="px-5 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-bold flex items-center justify-center gap-2.5 shadow-lg shadow-amber-600/30 transition-all hover:scale-[1.02] whitespace-nowrap"
              >
                <Activity className="w-4 h-4" />
                <span>Cổng Điều phối Ops</span>
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
            className={`grid grid-cols-2 md:grid-cols-3 gap-4 items-stretch ${
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
                sub={
                  stats.myActiveOffers > 0 ? "Chờ ghép đôi" : "Chưa có nguồn vỏ"
                }
                color="blue"
                onClick={() => setCurrentTab("offers")}
              />
            )}
            {isRequesterRole && (
              <KpiCard
                icon={Sparkles}
                label="Nhu cầu đang tìm"
                value={stats.myActiveRequests}
                sub={
                  stats.myActiveRequests > 0
                    ? "Hệ thống quét radar"
                    : "Chưa có nhu cầu"
                }
                color="sky"
                onClick={() => setCurrentTab("requests")}
              />
            )}
            <KpiCard
              icon={Handshake}
              label="Đang diễn ra"
              value={stats.activeTxns}
              sub={
                stats.activeTxns > 0
                  ? "Giao dịch đang chạy"
                  : "Chưa có giao dịch"
              }
              color="amber"
              onClick={() => setCurrentTab("transactions")}
            />
            <KpiCard
              icon={CheckCircle2}
              label="Giao dịch hoàn tất"
              value={stats.completedTxns}
              sub={
                stats.completedTxns > 0
                  ? "Đã quyết toán EIR"
                  : "Chưa có giao dịch"
              }
              color="emerald"
              onClick={() => setCurrentTab("transactions")}
            />
            <KpiCard
              icon={stats.totalSaving > 0 ? TrendingUp : BarChart3}
              label="Tổng tiết kiệm ròng"
              value={
                stats.totalSaving === 0
                  ? "0 VNĐ"
                  : `${new Intl.NumberFormat("vi-VN").format(Math.round(stats.totalSaving))} VNĐ`
              }
              sub={
                stats.totalSaving > 0
                  ? "Tối ưu chi phí kéo rỗng"
                  : "Chưa có dữ liệu"
              }
              color="violet"
            />
            <KpiCard
              icon={AlertCircle}
              label="Sự cố & Khiếu nại"
              value={stats.openCases}
              sub={
                stats.openCases > 0
                  ? "Cần giải quyết ngay"
                  : "An toàn · 0 sự cố"
              }
              color="red"
              isAlert={stats.openCases > 0}
              badge={stats.openCases > 0 ? "Cần xử lý" : undefined}
              onClick={() => setCurrentTab("cases")}
            />
          </div>
        )}

        {currentRole === "OPS" && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5 items-stretch">
            <KpiCard
              icon={FileText}
              label="Offer chờ thẩm định"
              value={stats.pendingOpsOffers}
              sub={
                stats.pendingOpsOffers > 0
                  ? "Cần phê duyệt ảnh 7 góc"
                  : "Đã duyệt hết"
              }
              color="blue"
              onClick={() => setCurrentTab("offers")}
              className="min-h-[140px] flex flex-col justify-between p-4"
            />
            <KpiCard
              icon={FileText}
              label="Nhu cầu chờ xác minh"
              value={stats.pendingOpsRequests}
              sub={
                stats.pendingOpsRequests > 0
                  ? "Xác minh booking đóng hàng"
                  : "Đã duyệt hết"
              }
              color="sky"
              onClick={() => setCurrentTab("requests")}
              className="min-h-[140px] flex flex-col justify-between p-4"
            />
            <KpiCard
              icon={Ship}
              label="Chờ hãng tàu duyệt RU"
              value={stats.pendingCarrier}
              sub={
                stats.pendingCarrier > 0
                  ? "Thẩm tra chấp thuận Reuse"
                  : "Không có"
              }
              color="amber"
              onClick={() => setCurrentTab("ops")}
              className="min-h-[140px] flex flex-col justify-between p-4"
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
              color="emerald"
              onClick={() => setCurrentTab("transactions")}
              className="min-h-[140px] flex flex-col justify-between p-4"
            />
            <KpiCard
              icon={CreditCard}
              label="Chờ duyệt ký quỹ"
              value={stats.pendingPayments}
              sub={
                stats.pendingPayments > 0 ? "Xác nhận tiền đặt cọc" : "Không có"
              }
              color="violet"
              onClick={() => setCurrentTab("transactions")}
              className="min-h-[140px] flex flex-col justify-between p-4"
            />
            <KpiCard
              icon={AlertCircle}
              label="Sự cố cần giải quyết"
              value={stats.openCases}
              sub={
                stats.openCases > 0
                  ? "Tranh chấp giám định"
                  : "An toàn · 0 sự cố"
              }
              color="red"
              isAlert={stats.openCases > 0}
              badge={stats.openCases > 0 ? "Cần xử lý" : undefined}
              onClick={() => setCurrentTab("cases")}
              className="min-h-[140px] flex flex-col justify-between p-4"
            />
          </div>
        )}
      </div>

      {/* Main 2-Column Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Recent Transactions Table (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden flex flex-col min-h-[420px]">
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

          <div className="divide-y divide-slate-100 flex-1 pb-3">
            {transactions.length === 0 ? (
              <div className="px-5 py-12 text-center flex flex-col items-center justify-center">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200/80 flex items-center justify-center text-slate-400 mb-3 shadow-2xs">
                  <Handshake className="w-7 h-7 text-slate-400" />
                </div>
                <p className="text-sm font-bold text-slate-800">
                  Chưa có giao dịch nào
                </p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm leading-relaxed">
                  {isSupplierRole
                    ? "Đăng nguồn vỏ cont để bắt đầu kết nối street-turn và ghép đôi tự động."
                    : "Tạo nhu cầu tìm vỏ cont để bắt đầu kết nối street-turn và ghép đôi tự động."}
                </p>
                {isSupplierRole ? (
                  <button
                    type="button"
                    onClick={() => setCurrentTab("offers")}
                    className="mt-4 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold inline-flex items-center gap-2 shadow-sm transition-all hover:scale-105 cursor-pointer"
                  >
                    <Box className="w-4 h-4" />
                    <span>Đăng nguồn vỏ cont</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setCurrentTab("requests")}
                    className="mt-4 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-2 shadow-sm transition-all hover:scale-105 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Tìm vỏ cont ngay</span>
                  </button>
                )}
              </div>
            ) : (
              transactions.slice(0, 5).map((txn) => (
                <button
                  key={txn.id}
                  type="button"
                  onClick={() => setCurrentTab("transactions")}
                  className="w-full px-5 py-4 flex items-start gap-4 hover:bg-slate-50/80 text-left transition-colors group"
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

                    <div className="flex items-center gap-2 text-xs text-slate-600 mt-1.5 flex-wrap">
                      <span className="font-mono font-semibold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded">
                        {txn.asset.containerNumber}
                      </span>
                      <span>·</span>
                      <span className="font-medium text-slate-700">
                        {txn.companyAName}
                      </span>
                      <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="font-medium text-slate-700">
                        {txn.companyBName}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 mt-1.5 leading-relaxed break-words">
                      <span className="text-slate-400">Tiếp theo:</span>{" "}
                      <span className="text-slate-700 font-medium">
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
                      <div
                        className={`flex-1 min-w-0 ${!notif.isRead ? "" : "pl-1.5"}`}
                      >
                        <p
                          className={`text-xs font-bold leading-snug break-words ${notif.isRead ? "text-slate-700" : "text-slate-900"}`}
                        >
                          {notif.title}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-1 leading-relaxed break-words">
                          {notif.body}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-1.5">
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
