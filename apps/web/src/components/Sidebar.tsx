// ==============================================================================
// ECont Vertical Sidebar - Điều hướng Dọc Chuyên Nghiệp Theo Phân Quyền
// ==============================================================================

import React, { useState } from 'react';
import {
  Box, Boxes, LayoutDashboard, PackageOpen, Search, Handshake,
  MessageCircle, HeadphonesIcon, AlertCircle, Database,
  ChevronDown, ChevronRight, User, Shield, LogOut, Check
} from 'lucide-react';
import { useAuth, ROLE_OPTIONS } from '../context/AuthContext';
import { useDatabase } from '../context/DatabaseContext';
import { UserRole } from '../types';

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

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  setCurrentTab,
  isMobileOpen = false,
  setIsMobileOpen,
}) => {
  const { currentRole, setRole, roleBadge, currentCompany, currentUserName } = useAuth();
  const { cases, offers, requests, transactions, chatThreads } = useDatabase();
  const [showRoleSwitcher, setShowRoleSwitcher] = useState(false);

  // Badge calculations
  const pendingOffers = offers.filter(o => o.status === 'UNDER_REVIEW').length;
  const pendingRequests = requests.filter(r => r.status === 'UNDER_REVIEW').length;
  const openCases = cases.filter(c => c.status === 'OPEN' || c.status === 'IN_REVIEW').length;
  const activeTransactions = transactions.filter(t =>
    !['COMPLETED', 'CANCELLED', 'REJECTED', 'EXPIRED'].includes(t.status)
  ).length;
  const unreadChatTotal = chatThreads.reduce((sum, t) => {
    return sum + (currentRole === 'ENTERPRISE_A' ? (t.unreadCountA ?? 0) : (t.unreadCountB ?? 0));
  }, 0);

  // Danh mục menu điều hướng với phân quyền nghiêm ngặt theo SRS
  const navItems: NavItem[] = [
    {
      id: 'dashboard',
      label: 'Bàn làm việc',
      icon: LayoutDashboard,
    },
    {
      id: 'assets',
      label: currentRole === 'OPS' ? 'Quản lý Vỏ Container' : 'Vỏ container của tôi',
      icon: Boxes,
      roles: ['ENTERPRISE_A', 'OPS'], // Bên B KHÔNG thấy Assets
    },
    {
      id: 'offers',
      label: currentRole === 'OPS' ? 'Thẩm định Nguồn vỏ' : 'Nguồn vỏ của tôi',
      icon: PackageOpen,
      roles: ['ENTERPRISE_A', 'OPS'], // Bên B KHÔNG thấy Offers
      badge: currentRole === 'OPS' && pendingOffers > 0 ? pendingOffers : undefined,
    },
    {
      id: 'requests',
      label: currentRole === 'OPS' ? 'Thẩm định Nhu cầu B' : 'Nhu cầu tìm vỏ cont',
      icon: Search,
      roles: ['ENTERPRISE_B', 'OPS'], // Bên A KHÔNG thấy Requests
      badge: currentRole === 'OPS' && pendingRequests > 0 ? pendingRequests : undefined,
    },
    {
      id: 'transactions',
      label: 'Giao dịch',
      icon: Handshake,
      badge: activeTransactions > 0 ? activeTransactions : undefined,
    },
    {
      id: 'chat',
      label: 'Tin nhắn trao đổi',
      icon: MessageCircle,
      badge: unreadChatTotal > 0 ? unreadChatTotal : undefined,
    },
    {
      id: 'ops',
      label: 'Cổng Vận Hành Ops',
      icon: HeadphonesIcon,
      roles: ['OPS'], // Chỉ Ops thấy Ops Portal
      badge: openCases > 0 ? openCases : undefined,
    },
    {
      id: 'cases',
      label: 'Sự cố & Khiếu nại',
      icon: AlertCircle,
      badge: openCases > 0 ? openCases : undefined,
    },
    {
      id: 'database',
      label: 'Cơ sở dữ liệu',
      icon: Database,
      roles: ['OPS'], // Chỉ Ops thấy Database
    },
  ];

  // Lọc strictly theo currentRole
  const visibleNavItems = navItems.filter(item =>
    !item.roles || item.roles.includes(currentRole)
  );

  const handleTabClick = (tabId: string) => {
    setCurrentTab(tabId);
    setIsMobileOpen?.(false);
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setIsMobileOpen?.(false)}
        />
      )}

      {/* Main Vertical Sidebar */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-white text-slate-800 flex flex-col transition-transform duration-300 ease-in-out border-r border-slate-200 shadow-sm ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Logo Header */}
        <div className="p-5 border-b border-slate-200/90 flex items-center justify-between bg-white">
          <button
            type="button"
            onClick={() => handleTabClick('dashboard')}
            className="flex items-center gap-3 text-left focus:outline-none group"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-teal-600 flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0 group-hover:scale-105 transition-transform">
              <Box className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-xl tracking-tight text-slate-900 leading-none">
                  ECONT
                </span>
                <span className="px-2 py-0.5 rounded-md text-xs font-extrabold bg-blue-50 text-blue-700 border border-blue-200">
                  v2.0
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-1">Sàn Điều Phối Vỏ Cont</p>
            </div>
          </button>
        </div>

        {/* Current Active Role Pill */}
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <span className="text-lg shrink-0">{roleBadge.icon}</span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-900 truncate">{roleBadge.label}</p>
              <p className="text-xs text-slate-500 truncate font-medium">{currentCompany.shortName}</p>
            </div>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0 ring-4 ring-emerald-100" title="Trực tuyến" />
          </div>
        </div>

        {/* Vertical Nav Items */}
        <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300">
          <div className="text-xs font-bold text-slate-400 uppercase px-3 py-1.5 tracking-wider">
            Phân hệ chức năng
          </div>

          {visibleNavItems.map(item => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleTabClick(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all group relative ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 font-bold border-r-4 border-blue-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 font-medium'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${
                    isActive ? 'text-blue-600' : 'text-slate-500 group-hover:text-slate-800'
                  }`}
                />
                <span className="truncate flex-1 text-left">{item.label}</span>

                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    className={`min-w-[20px] h-5 rounded-full text-xs font-bold px-1.5 flex items-center justify-center ${
                      isActive ? 'bg-blue-600 text-white' : 'bg-rose-500 text-white'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom: Role Switcher & User Profile */}
        <div className="p-3 border-t border-slate-200 bg-slate-50/90 relative">
          <button
            type="button"
            onClick={() => setShowRoleSwitcher(!showRoleSwitcher)}
            className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-200/70 text-left transition-colors border border-slate-200/80 bg-white"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-xs font-bold text-blue-700 shrink-0">
              <User className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-800 truncate">{currentUserName.split('(')[0]}</p>
              <p className="text-xs text-slate-500 truncate font-medium">Đổi vai trò hệ thống</p>
            </div>
            <ChevronDown
              className={`w-4 h-4 text-slate-500 transition-transform ${
                showRoleSwitcher ? 'rotate-180' : ''
              }`}
            />
          </button>

          {/* Role Switcher Popover (Strictly 3 roles) */}
          {showRoleSwitcher && (
            <>
              <div
                className="fixed inset-0 z-50"
                onClick={() => setShowRoleSwitcher(false)}
              />
              <div className="absolute bottom-full left-3 right-3 mb-2 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150">
                <div className="p-3.5 bg-slate-50 border-b border-slate-200">
                  <p className="text-xs font-bold text-slate-900">Chuyển đổi vai trò (3 Roles)</p>
                  <p className="text-xs text-slate-500 mt-0.5">Giao diện sẽ tự động cập nhật phân quyền</p>
                </div>

                <div className="p-1.5 space-y-1">
                  {ROLE_OPTIONS.map(opt => {
                    const isSelected = currentRole === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          setRole(opt.value);
                          setShowRoleSwitcher(false);
                          // Reset currentTab to dashboard if current tab is unauthorized
                          if (opt.value === 'ENTERPRISE_A' && (currentTab === 'requests' || currentTab === 'ops')) {
                            setCurrentTab('dashboard');
                          } else if (opt.value === 'ENTERPRISE_B' && (currentTab === 'assets' || currentTab === 'offers' || currentTab === 'ops')) {
                            setCurrentTab('dashboard');
                          }
                        }}
                        className={`w-full p-2.5 rounded-xl flex items-start gap-2.5 text-left transition-colors ${
                          isSelected ? 'bg-blue-50 border border-blue-200 text-blue-900' : 'hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        <span className="text-lg shrink-0 mt-0.5">{opt.icon}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold leading-none">{opt.label}</p>
                          <p className="text-xs text-slate-500 mt-1 line-clamp-1">{opt.desc}</p>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </aside>
    </>
  );
};
