// ==============================================================================
// ECont Authentication & Role Context - Version 2.0
// Demo role switcher - Production: thay bằng JWT/Supabase session server-side
// ==============================================================================

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { UserRole, Company } from '../types';
import { INITIAL_COMPANIES } from '../data/mockData';

interface RoleBadge {
  label: string;
  color: string;
  bgColor: string;
  desc: string;
  icon: string;
}

interface AuthContextType {
  currentRole: UserRole;
  setRole: (role: UserRole) => void;
  currentCompany: Company;
  currentUserEmail: string;
  currentUserName: string;
  currentUserId: string;
  roleBadge: RoleBadge;
  // Quyền theo role - để UI biết hiển thị gì (server vẫn check riêng)
  canCreateOffers: boolean;
  canCreateRequests: boolean;
  canOpsReview: boolean;
  canFinanceReconcile: boolean;
  canAdmin: boolean;
  // Kiểm tra xem user có phải là Bên A hay B trong giao dịch cụ thể không
  isPartyA: (companyAId: string) => boolean;
  isPartyB: (companyBId: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ROLE_INFO: Record<UserRole, RoleBadge> = {
  ENTERPRISE_A: {
    label: 'Bên A · Đơn vị quản lý nguồn vỏ',
    color: 'text-emerald-700 border-emerald-300',
    bgColor: 'bg-emerald-50',
    desc: 'Hưng Thịnh Logistics — Quản lý cont rỗng nhập khẩu cần trả vỏ',
    icon: '🏭',
  },
  ENTERPRISE_B: {
    label: 'Bên B · Đơn vị có nhu cầu',
    color: 'text-blue-700 border-blue-300',
    bgColor: 'bg-blue-50',
    desc: 'Toàn Cầu Export Corp — Tìm vỏ cont đóng hàng xuất khẩu',
    icon: '📦',
  },
  OPS: {
    label: 'Vận hành (Ops)',
    color: 'text-amber-700 border-amber-300',
    bgColor: 'bg-amber-50',
    desc: 'Điều phối viên ECont — Thẩm định DN, duyệt RU, xử lý sự cố',
    icon: '⚙️',
  },
  FINANCE: {
    label: 'Tài chính & Đối soát',
    color: 'text-purple-700 border-purple-300',
    bgColor: 'bg-purple-50',
    desc: 'Kế toán ECont — Đối soát ngân hàng, thu hộ RU, hoàn tiền',
    icon: '💰',
  },
  SUPER_ADMIN: {
    label: 'Quản trị hệ thống',
    color: 'text-rose-700 border-rose-300',
    bgColor: 'bg-rose-50',
    desc: 'Quản trị viên — Cấu hình hệ thống, audit log, toàn quyền',
    icon: '🛡️',
  },
};

// Demo user mapping theo role
const ROLE_USERS: Record<UserRole, { companyIndex: number; email: string; name: string; userId: string }> = {
  ENTERPRISE_A: {
    companyIndex: 0,
    email: 'hung.nguyen@hungthinhlog.vn',
    name: 'Nguyễn Văn Hưng (Giám đốc Điều vận)',
    userId: 'USR-A01',
  },
  ENTERPRISE_B: {
    companyIndex: 1,
    email: 'mai.tran@toancaugroups.vn',
    name: 'Trần Thị Mai (Trưởng phòng XNK)',
    userId: 'USR-B01',
  },
  OPS: {
    companyIndex: 0, // Ops thuộc ECont, dùng company đầu tiên làm placeholder
    email: 'ops.lead@econt.vn',
    name: 'Vũ Minh Trí (Trưởng ban Điều phối)',
    userId: 'USR-OPS01',
  },
  FINANCE: {
    companyIndex: 0,
    email: 'finance@econt.vn',
    name: 'Đặng Thu Thảo (Kế toán trưởng)',
    userId: 'USR-FIN01',
  },
  SUPER_ADMIN: {
    companyIndex: 0,
    email: 'admin@econt.vn',
    name: 'Quản trị viên Hệ thống',
    userId: 'USR-ADMIN01',
  },
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentRole, setCurrentRole] = useState<UserRole>(() => {
    const saved = localStorage.getItem('econt_active_role') as UserRole;
    return saved && Object.keys(ROLE_INFO).includes(saved) ? saved : 'ENTERPRISE_A';
  });

  useEffect(() => {
    localStorage.setItem('econt_active_role', currentRole);
  }, [currentRole]);

  const setRole = (role: UserRole) => setCurrentRole(role);

  const value = useMemo((): AuthContextType => {
    const userInfo = ROLE_USERS[currentRole];
    const currentCompany = INITIAL_COMPANIES[userInfo.companyIndex];

    return {
      currentRole,
      setRole,
      currentCompany,
      currentUserEmail: userInfo.email,
      currentUserName: userInfo.name,
      currentUserId: userInfo.userId,
      roleBadge: ROLE_INFO[currentRole],
      canCreateOffers: currentRole === 'ENTERPRISE_A',
      canCreateRequests: currentRole === 'ENTERPRISE_B',
      canOpsReview: currentRole === 'OPS' || currentRole === 'SUPER_ADMIN',
      canFinanceReconcile: currentRole === 'FINANCE' || currentRole === 'SUPER_ADMIN',
      canAdmin: currentRole === 'SUPER_ADMIN',
      isPartyA: (companyAId: string) =>
        currentRole === 'ENTERPRISE_A' && currentCompany.id === companyAId,
      isPartyB: (companyBId: string) =>
        currentRole === 'ENTERPRISE_B' && currentCompany.id === companyBId,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRole]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
