// ==============================================================================
// ECont Vertical Sidebar - Điều hướng Dọc Chuyên Nghiệp Theo Phân Quyền
// ==============================================================================

import React, { useState } from "react";
import {
  Box,
  Boxes,
  LayoutDashboard,
  PackageOpen,
  Search,
  Handshake,
  MessageCircle,
  HeadphonesIcon,
  AlertCircle,
  Database,
  ChevronDown,
  User,
  ShieldCheck,
  LogOut,
  Check,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { useAuth, ROLE_OPTIONS } from "../context/AuthContext";
import { useDatabase } from "../context/DatabaseContext";
import { UserRole } from "../types";

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  isMobileOpen?: boolean;
  setIsMobileOpen?: (open: boolean) => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  roles?: UserRole[];
  badge?: number;
}

interface NavGroup {
  groupName: string;
  items: NavItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  setCurrentTab,
  isMobileOpen = false,
  setIsMobileOpen,
}) => {
  const {
    currentRole,
    setRole,
    logout,
    roleBadge,
    currentCompany,
    currentUserName,
  } = useAuth();
  const { cases, offers, requests, transactions, chatThreads } = useDatabase();
  const [showRoleSwitcher, setShowRoleSwitcher] = useState(false);

  // Badge calculations
  const pendingOffers = offers.filter(
    (o) => o.status === "UNDER_REVIEW",
  ).length;
  const pendingRequests = requests.filter(
    (r) => r.status === "UNDER_REVIEW",
  ).length;
  const openCases = cases.filter(
    (c) =>
      ["OPEN", "IN_REVIEW"].includes(c.status) &&
      (currentRole === "OPS" || c.openedByCompanyId === currentCompany.id),
  ).length;
  const activeTransactions = transactions.filter(
    (t) =>
      !["COMPLETED", "CANCELLED", "REJECTED", "EXPIRED"].includes(t.status) &&
      (currentRole === "OPS" ||
        t.companyAId === currentCompany.id ||
        t.companyBId === currentCompany.id),
  ).length;
  const unreadChatTotal = chatThreads.reduce((sum, t) => {
    const isParticipant =
      t.companyAId === currentCompany.id || t.companyBId === currentCompany.id;
    if (currentRole !== "OPS" && !isParticipant) return sum;
    if (currentRole === "OPS" || currentRole === "ENTERPRISE_BOTH") {
      return sum + (t.unreadCountA ?? 0) + (t.unreadCountB ?? 0);
    }
    return (
      sum +
      (currentRole === "ENTERPRISE_A"
        ? (t.unreadCountA ?? 0)
        : (t.unreadCountB ?? 0))
    );
  }, 0);

  // Nhóm menu điều hướng theo phân hệ nghiệp vụ
  const navGroups: NavGroup[] = [
    {
      groupName: "TỔNG QUAN",
      items: [
        {
          id: "dashboard",
          label: "Bàn làm việc",
          icon: LayoutDashboard,
        },
      ],
    },
    {
      groupName: "NGHIỆP VỤ VỎ CONT",
      items: [
        {
          id: "offers",
          label:
            currentRole === "OPS" ? "Thẩm định Nguồn vỏ" : "Nguồn cung vỏ Cont",
          icon: PackageOpen,
          roles: ["ENTERPRISE_A", "ENTERPRISE_BOTH", "OPS"],
          badge:
            currentRole === "OPS" && pendingOffers > 0
              ? pendingOffers
              : undefined,
        },
        {
          id: "requests",
          label:
            currentRole === "OPS"
              ? "Thẩm định Nhu cầu vỏ"
              : "Nhu cầu tìm vỏ Cont",
          icon: Search,
          roles: ["ENTERPRISE_A", "ENTERPRISE_B", "ENTERPRISE_BOTH", "OPS"],
          badge:
            currentRole === "OPS" && pendingRequests > 0
              ? pendingRequests
              : undefined,
        },
      ],
    },
    {
      groupName: "KẾT NỐI & GIAO DỊCH",
      items: [
        {
          id: "transactions",
          label: "Giao dịch Street-turn",
          icon: Handshake,
          badge: activeTransactions > 0 ? activeTransactions : undefined,
        },
        {
          id: "chat",
          label: "Tin nhắn trao đổi",
          icon: MessageCircle,
          badge: unreadChatTotal > 0 ? unreadChatTotal : undefined,
        },
      ],
    },
    {
      groupName: "ĐIỀU HÀNH & HỖ TRỢ",
      items: [
        {
          id: "ops",
          label: "Cổng Vận Hành Ops",
          icon: HeadphonesIcon,
          roles: ["OPS"],
          badge: openCases > 0 ? openCases : undefined,
        },
        {
          id: "assets",
          label: "Kho Dữ liệu Vỏ Cont",
          icon: Boxes,
          roles: ["OPS"],
        },
        {
          id: "cases",
          label: "Sự cố & Khiếu nại",
          icon: AlertCircle,
          badge: openCases > 0 ? openCases : undefined,
        },
        {
          id: "database",
          label: "Cơ sở dữ liệu",
          icon: Database,
          roles: ["OPS"],
        },
      ],
    },
  ];

  const handleTabClick = (tabId: string) => {
    setCurrentTab(tabId);
    setIsMobileOpen?.(false);
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 z-40 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsMobileOpen?.(false)}
        />
      )}

      {/* Main Vertical Sidebar */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-72 bg-white text-slate-800 flex flex-col transition-transform duration-300 ease-in-out border-r border-slate-200/90 shadow-sm ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Brand Logo Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
          <button
            type="button"
            onClick={() => handleTabClick("dashboard")}
            className="flex items-center gap-3 text-left focus:outline-none group w-full"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-teal-500 flex items-center justify-center shadow-md shadow-blue-500/25 shrink-0 group-hover:scale-105 transition-transform">
              <Box className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-xl tracking-tight text-slate-900 leading-none">
                  ECONT
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200/70">
                  v2.0
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
                Sàn Điều Phối Vỏ Cont
              </p>
            </div>
          </button>
        </div>

        {/* Current Active Enterprise & Role Card */}
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100/70 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0">
              {currentCompany.shortName.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <p
                  className="text-xs font-bold text-slate-800 truncate"
                  title={currentCompany.companyName}
                >
                  {currentCompany.shortName}
                </p>
                <span title="Doanh nghiệp đã xác thực" className="inline-flex">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                </span>
              </div>
              <p className="text-[11px] text-slate-500 truncate font-medium">
                {roleBadge.label}
              </p>
            </div>
            <span
              className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 ring-4 ring-emerald-100"
              title="Trực tuyến"
            />
          </div>
        </div>

        {/* Navigation Groups */}
        <nav className="flex-1 px-3 py-3 space-y-4 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 hover:scrollbar-thumb-slate-300">
          {navGroups.map((group) => {
            // Filter items visible to current role
            const visibleItems = group.items.filter(
              (item) => !item.roles || item.roles.includes(currentRole),
            );
            if (visibleItems.length === 0) return null;

            return (
              <div key={group.groupName} className="space-y-1">
                <div className="text-[10px] font-bold text-slate-400 uppercase px-3 py-1 tracking-wider">
                  {group.groupName}
                </div>

                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentTab === item.id;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleTabClick(item.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all group relative ${
                        isActive
                          ? "bg-blue-600 text-white font-semibold shadow-md shadow-blue-500/20"
                          : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/90 font-medium"
                      }`}
                    >
                      <Icon
                        className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${
                          isActive
                            ? "text-white"
                            : "text-slate-500 group-hover:text-slate-700"
                        }`}
                      />
                      <span className="flex-1 text-left truncate font-medium">
                        {item.label}
                      </span>

                      {item.badge !== undefined && item.badge > 0 && (
                        <span
                          className={`shrink-0 min-w-[20px] h-5 rounded-full text-[10px] font-extrabold px-1.5 flex items-center justify-center leading-none tracking-tight transition-colors ${
                            isActive
                              ? "bg-white/25 text-white"
                              : "bg-rose-600 text-white shadow-xs border border-white/20"
                          }`}
                        >
                          {item.badge > 99 ? "99+" : item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Bottom User Profile & Role Switcher */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/70 relative">
          <button
            type="button"
            onClick={() => setShowRoleSwitcher(!showRoleSwitcher)}
            className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-200/60 text-left transition-colors border border-slate-200/70 bg-white shadow-xs"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200/80 flex items-center justify-center text-xs font-bold text-blue-700 shrink-0">
              <User className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-800 truncate">
                {currentUserName.split("(")[0]}
              </p>
              <p className="text-[11px] text-slate-500 truncate font-medium">
                Đổi vai trò hệ thống
              </p>
            </div>
            <ChevronDown
              className={`w-4 h-4 text-slate-400 transition-transform ${
                showRoleSwitcher ? "rotate-180" : ""
              }`}
            />
          </button>

          {/* Role Switcher Popover */}
          {showRoleSwitcher && (
            <>
              <div
                className="fixed inset-0 z-50"
                onClick={() => setShowRoleSwitcher(false)}
              />
              <div className="absolute bottom-full left-3 right-3 mb-2 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150">
                <div className="p-3.5 bg-slate-50 border-b border-slate-200">
                  <p className="text-xs font-bold text-slate-900">
                    Chuyển đổi vai trò trải nghiệm
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Giao diện sẽ tự động cập nhật phân quyền
                  </p>
                </div>

                <div className="p-1.5 space-y-1">
                  {ROLE_OPTIONS.map((opt) => {
                    const isSelected = currentRole === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          setRole(opt.value);
                          setShowRoleSwitcher(false);
                          // Reset currentTab to dashboard if current tab is unauthorized
                          if (
                            opt.value === "ENTERPRISE_A" &&
                            (currentTab === "assets" ||
                              currentTab === "ops" ||
                              currentTab === "database")
                          ) {
                            setCurrentTab("dashboard");
                          } else if (
                            opt.value === "ENTERPRISE_B" &&
                            (currentTab === "assets" ||
                              currentTab === "offers" ||
                              currentTab === "ops" ||
                              currentTab === "database")
                          ) {
                            setCurrentTab("dashboard");
                          }
                        }}
                        className={`w-full p-2.5 rounded-xl flex items-start gap-2.5 text-left transition-colors ${
                          isSelected
                            ? "bg-blue-50 border border-blue-200 text-blue-900"
                            : "hover:bg-slate-100 text-slate-700"
                        }`}
                      >
                        <span className="text-lg shrink-0 mt-0.5">
                          {opt.icon}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold leading-none">
                            {opt.label}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">
                            {opt.desc}
                          </p>
                        </div>
                        {isSelected && (
                          <Check className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          <button
            type="button"
            onClick={() => {
              setShowRoleSwitcher(false);
              logout();
            }}
            className="w-full mt-2 flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-red-200/80 bg-white text-red-600 hover:bg-red-50 text-xs font-semibold transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Đăng xuất
          </button>
        </div>
      </aside>
    </>
  );
};
