// ==============================================================================
// ECont Navbar - Version 2.0
// Navigation với notification badges, role indicator, và conditional nav items
// ==============================================================================

import React, { useState } from 'react';
import {
  Box, Boxes, Database, Handshake, HeadphonesIcon, LayoutDashboard,
  MessageCircle, PackageOpen, Search, ShieldCheck, WalletCards,
  Bell, AlertCircle, RefreshCw, ChevronDown, BarChart3
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useDatabase } from '../context/DatabaseContext';
import { UserRole } from '../types';

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
}

const ROLE_OPTIONS: Array<{ value: UserRole; label: string; icon: string }> = [
  { value: 'ENTERPRISE_A', label: 'Bên A · Chủ container', icon: '🏭' },
  { value: 'ENTERPRISE_B', label: 'Bên B · Cần container', icon: '📦' },
  { value: 'OPS', label: 'Điều phối vận hành', icon: '⚙️' },
  { value: 'FINANCE', label: 'Tài chính & đối soát', icon: '💰' },
  { value: 'SUPER_ADMIN', label: 'Quản trị hệ thống', icon: '🛡️' },
];

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  roles?: UserRole[];
  badge?: number;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, setCurrentTab }) => {
  const { currentRole, setRole, roleBadge, currentCompany, currentUserName } = useAuth();
  const { unreadNotificationCount, notifications, cases, offers, requests, transactions } = useDatabase();
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Badge counts
  const pendingOffers = offers.filter(o => o.status === 'UNDER_REVIEW').length;
  const pendingRequests = requests.filter(r => r.status === 'UNDER_REVIEW').length;
  const openCases = cases.filter(c => c.status === 'OPEN' || c.status === 'IN_REVIEW').length;
  const activeTransactions = transactions.filter(t =>
    !['COMPLETED', 'CANCELLED', 'REJECTED', 'EXPIRED'].includes(t.status)
  ).length;

  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'Bàn làm việc', icon: LayoutDashboard },
    {
      id: 'assets', label: 'Vỏ container', icon: Boxes,
      roles: ['OPS', 'SUPER_ADMIN'],
    },
    {
      id: 'offers', label: 'Nguồn cung', icon: PackageOpen,
      badge: (currentRole === 'OPS' || currentRole === 'SUPER_ADMIN') ? pendingOffers : undefined,
    },
    {
      id: 'requests', label: 'Nhu cầu', icon: Search,
      badge: (currentRole === 'OPS' || currentRole === 'SUPER_ADMIN') ? pendingRequests : undefined,
    },
    {
      id: 'transactions', label: 'Giao dịch', icon: Handshake,
      badge: activeTransactions > 0 ? activeTransactions : undefined,
    },
    { id: 'chat', label: 'Tin nhắn', icon: MessageCircle },
    {
      id: 'ops', label: 'Vận hành', icon: HeadphonesIcon,
      roles: ['OPS', 'SUPER_ADMIN'],
      badge: openCases > 0 ? openCases : undefined,
    },
    {
      id: 'finance', label: 'Tài chính', icon: WalletCards,
      roles: ['FINANCE', 'SUPER_ADMIN'],
    },
    {
      id: 'cases', label: 'Sự cố / Case', icon: AlertCircle,
      badge: openCases > 0 ? openCases : undefined,
    },
    {
      id: 'database', label: 'Dữ liệu', icon: Database,
      roles: ['OPS', 'FINANCE', 'SUPER_ADMIN'],
    },
  ];

  const visibleNavItems = navItems.filter(item =>
    !item.roles || item.roles.includes(currentRole)
  );

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur-xl">
      <div className="max-w-[1480px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="min-h-[68px] flex items-center justify-between gap-3 py-2">
          {/* Logo */}
          <button
            type="button"
            onClick={() => setCurrentTab('dashboard')}
            className="flex items-center gap-2.5 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 shrink-0"
          >
            <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-md shadow-brand-200 shrink-0">
              <Box className="w-5 h-5 text-white" />
            </span>
            <span className="hidden sm:block">
              <span className="flex items-center gap-2">
                <strong className="text-xl leading-none tracking-tight text-slate-900">ECONT</strong>
                <span className="px-1.5 py-0.5 text-[10px] font-bold bg-brand-50 text-brand-700 border border-brand-200 rounded">
                  v2.0
                </span>
              </span>
              <span className="text-[11px] text-slate-500 block mt-0.5">
                Kết nối & tái sử dụng container rỗng
              </span>
            </span>
          </button>

          {/* Right: User controls */}
          <div className="flex items-center gap-2 shrink-0">
            {/* System status */}
            <span className="hidden xl:flex items-center gap-1.5 px-2.5 h-9 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
              <span className="relative flex w-1.5 h-1.5">
                <span className="absolute inline-flex w-full h-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-emerald-500" />
              </span>
              Trực tuyến
            </span>

            {/* Notification bell */}
            <button
              onClick={() => setCurrentTab('dashboard')}
              className="relative h-9 w-9 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
              title="Thông báo"
            >
              <Bell className="w-4 h-4" />
              {unreadNotificationCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center px-1">
                  {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
                </span>
              )}
            </button>

            {/* Role Switcher (DEMO) */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className={`h-9 pl-2.5 pr-2 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                  showUserMenu ? 'bg-slate-100 border-slate-300' : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${roleBadge.bgColor}`}>
                  {roleBadge.icon}
                </span>
                <span className="hidden sm:block text-slate-700 max-w-[120px] truncate">{currentCompany.shortName}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
              </button>

              {showUserMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowUserMenu(false)}
                  />
                  <div className="absolute right-0 top-full mt-1.5 w-72 bg-white border border-slate-200 rounded-xl shadow-xl z-50">
                    {/* User info */}
                    <div className="px-4 py-3 border-b border-slate-100">
                      <p className="text-xs font-semibold text-slate-700 truncate">{currentUserName}</p>
                      <p className="text-xs text-slate-500 truncate mt-0.5">{currentCompany.companyName}</p>
                      <span className={`mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${roleBadge.color} ${roleBadge.bgColor}`}>
                        {roleBadge.label}
                      </span>
                    </div>
                    {/* DEMO mode indicator */}
                    <div className="px-4 py-2 bg-amber-50 border-b border-amber-100">
                      <p className="text-[10px] text-amber-600 font-semibold">⚠️ DEMO: Chuyển đổi vai trò</p>
                      <p className="text-[10px] text-amber-500">Production sẽ dùng JWT session thật</p>
                    </div>
                    {/* Role options */}
                    <div className="py-1">
                      {ROLE_OPTIONS.map(option => (
                        <button
                          key={option.value}
                          onClick={() => { setRole(option.value); setShowUserMenu(false); }}
                          className={`w-full px-4 py-2.5 flex items-center gap-2.5 text-left text-sm hover:bg-slate-50 transition-colors ${
                            currentRole === option.value ? 'bg-brand-50 text-brand-700' : 'text-slate-700'
                          }`}
                        >
                          <span className="text-base">{option.icon}</span>
                          <span className="font-medium">{option.label}</span>
                          {currentRole === option.value && (
                            <span className="ml-auto text-xs text-brand-600 font-bold">Đang dùng</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation tabs */}
      <div className="border-t border-slate-100 bg-slate-50/50">
        <nav
          className="max-w-[1480px] mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-0.5 overflow-x-auto scrollbar-none"
          aria-label="Điều hướng chính"
        >
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setCurrentTab(item.id)}
                className={`relative min-h-11 px-3 flex items-center gap-1.5 whitespace-nowrap text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 ${
                  isActive
                    ? 'text-brand-700 bg-white'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
                }`}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-brand-600' : 'text-slate-400'}`} />
                <span>{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className={`min-w-[18px] h-4.5 rounded-full text-[10px] font-bold px-1.5 py-0.5 leading-none ${
                    isActive ? 'bg-brand-600 text-white' : 'bg-red-500 text-white'
                  }`}>
                    {item.badge}
                  </span>
                )}
                {isActive && (
                  <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-brand-600" />
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
