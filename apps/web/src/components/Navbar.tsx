// ==============================================================================
// ECont Navigation Bar & Global Role Switcher
// ==============================================================================

import React from 'react';
import {
  Box,
  Boxes,
  Database,
  ExternalLink,
  Handshake,
  Headphones,
  LayoutDashboard,
  PackageOpen,
  RefreshCw,
  Search,
  ShieldCheck,
  WalletCards,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useDatabase } from '../context/DatabaseContext';
import { UserRole } from '../types';

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
}

const ROLE_OPTIONS: Array<{ value: UserRole; label: string }> = [
  { value: 'ENTERPRISE_A', label: 'Bên A · Chủ container' },
  { value: 'ENTERPRISE_B', label: 'Bên B · Cần container' },
  { value: 'OPS', label: 'Điều phối vận hành' },
  { value: 'FINANCE', label: 'Tài chính & đối soát' },
  { value: 'SUPER_ADMIN', label: 'Quản trị hệ thống' },
];

export const Navbar: React.FC<NavbarProps> = ({ currentTab, setCurrentTab }) => {
  const { currentRole, setRole, roleBadge } = useAuth();
  const { onlineConfig, isSyncing, syncAllToOnlineDb } = useDatabase();

  const navItems = [
    { id: 'dashboard', label: 'Bàn làm việc', icon: LayoutDashboard },
    { id: 'assets', label: 'Vỏ container', icon: Boxes },
    { id: 'offers', label: 'Nguồn cung', icon: PackageOpen },
    { id: 'requests', label: 'Nhu cầu', icon: Search },
    { id: 'transactions', label: 'Giao dịch', icon: Handshake },
    { id: 'ops', label: 'Vận hành', icon: Headphones },
    { id: 'finance', label: 'Tài chính', icon: WalletCards },
    { id: 'database', label: 'Dữ liệu', icon: Database },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur-xl">
      <div className="max-w-[1480px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="min-h-[72px] flex flex-wrap items-center justify-between gap-3 py-3">
          <button
            type="button"
            onClick={() => setCurrentTab('dashboard')}
            className="flex items-center gap-3 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
            aria-label="Về bàn làm việc"
          >
            <span className="econt-logo w-11 h-11 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-lg shadow-brand-200">
              <Box className="w-6 h-6 text-white" />
            </span>
            <span>
              <span className="flex items-center gap-2">
                <strong className="text-xl leading-none tracking-tight text-slate-900">ECONT</strong>
                <span className="px-1.5 py-0.5 text-[10px] font-bold bg-brand-50 text-brand-700 border border-brand-200 rounded-md">
                  v1.0
                </span>
              </span>
              <span className="text-[11px] text-slate-500 hidden sm:block mt-1">
                Kết nối & tái sử dụng container rỗng
              </span>
            </span>
          </button>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="hidden xl:flex items-center gap-2 px-3 h-10 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
              <span className="relative flex w-2 h-2">
                <span className="absolute inline-flex w-full h-full rounded-full bg-emerald-400 opacity-60 animate-ping"></span>
                <span className="relative inline-flex w-2 h-2 rounded-full bg-emerald-500"></span>
              </span>
              Hệ thống trực tuyến
            </span>

            <button
              type="button"
              onClick={syncAllToOnlineDb}
              disabled={isSyncing}
              className="h-10 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 text-xs font-semibold flex items-center gap-2 transition-colors disabled:opacity-60"
              title="Đồng bộ dữ liệu"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-brand-600' : ''}`} />
              <span className="hidden sm:inline">{isSyncing ? 'Đang đồng bộ' : 'Đồng bộ'}</span>
            </button>

            <a
              href={onlineConfig.adminDashboardUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="h-10 px-3 rounded-xl bg-brand-50 hover:bg-brand-100 text-brand-700 border border-brand-200 text-xs font-semibold flex items-center gap-2 transition-colors"
              title="Mở cơ sở dữ liệu trực tuyến"
            >
              <Database className="w-3.5 h-3.5" />
              <span className="hidden md:inline">CSDL Online</span>
              <ExternalLink className="w-3 h-3 opacity-60" />
            </a>

            <div className="relative">
              <label htmlFor="role-switcher" className="sr-only">Vai trò đang sử dụng</label>
              <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-600 pointer-events-none" />
              <select
                id="role-switcher"
                value={currentRole}
                onChange={(event) => setRole(event.target.value as UserRole)}
                className="h-10 min-w-[176px] pl-9 pr-8 rounded-xl bg-white text-slate-700 border border-slate-200 text-xs font-semibold shadow-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                title={roleBadge.desc}
              >
                {ROLE_OPTIONS.map((role) => (
                  <option key={role.value} value={role.value}>{role.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-100 bg-slate-50/80">
        <nav className="max-w-[1480px] mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-1 overflow-x-auto" aria-label="Điều hướng chính">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setCurrentTab(item.id)}
                className={`relative min-h-12 px-3.5 flex items-center gap-2 whitespace-nowrap text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 ${
                  isActive
                    ? 'text-brand-700 bg-white'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
                }`}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-brand-600' : 'text-slate-400'}`} />
                <span>{item.label}</span>
                {isActive && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-brand-600"></span>}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
