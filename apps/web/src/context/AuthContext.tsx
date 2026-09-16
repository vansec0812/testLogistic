// ==============================================================================
// ECont Authentication & Role Switcher Context
// Cho phép chuyển đổi tức thì giữa 5 vai trò thực tế
// ==============================================================================

import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserRole, Company } from '../types';
import { INITIAL_COMPANIES } from '../data/mockData';

interface AuthContextType {
  currentRole: UserRole;
  setRole: (role: UserRole) => void;
  currentCompany: Company;
  currentUserEmail: string;
  currentUserName: string;
  roleBadge: { label: string; color: string; desc: string };
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ROLE_INFO: Record<UserRole, { label: string; color: string; desc: string }> = {
  ENTERPRISE_A: {
    label: 'Doanh nghiệp A (Chủ nguồn vỏ)',
    color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
    desc: 'Hưng Thịnh Logistics — Quản lý cont rỗng nhập khẩu cần trả vỏ'
  },
  ENTERPRISE_B: {
    label: 'Doanh nghiệp B (Chủ nhu cầu vỏ)',
    color: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
    desc: 'Toàn Cầu Export Corp — Tìm vỏ cont đóng hàng xuất khẩu'
  },
  OPS: {
    label: 'Vận hành nền tảng (Ops)',
    color: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
    desc: 'Điều phối viên ECont — Thẩm định DN, duyệt RU hãng tàu, xử lý sự cố'
  },
  FINANCE: {
    label: 'Tài chính & Đối soát',
    color: 'bg-purple-500/20 text-purple-400 border-purple-500/40',
    desc: 'Kế toán ECont — Đối soát ngân hàng, thu hộ RU, hoàn tiền'
  },
  SUPER_ADMIN: {
    label: 'Quản trị hệ thống',
    color: 'bg-rose-500/20 text-rose-400 border-rose-500/40',
    desc: 'Quản trị viên cấp cao — Cấu hình CSDL Online, audit log và hệ thống'
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentRole, setCurrentRole] = useState<UserRole>(() => {
    return (localStorage.getItem('econt_active_role') as UserRole) || 'ENTERPRISE_A';
  });
  useEffect(() => {
    localStorage.setItem('econt_active_role', currentRole);
  }, [currentRole]);

  const setRole = (role: UserRole) => {
    setCurrentRole(role);
  };

  // Xác định thông tin công ty dựa trên vai trò hiện tại
  let currentCompany = INITIAL_COMPANIES[0]; // Bên A
  let currentUserEmail = 'hung.nguyen@hungthinhlog.vn';
  let currentUserName = 'Nguyễn Văn Hưng (Giám đốc Điều vận)';

  if (currentRole === 'ENTERPRISE_B') {
    currentCompany = INITIAL_COMPANIES[1]; // Bên B
    currentUserEmail = 'mai.tran@toancaugroups.vn';
    currentUserName = 'Trần Thị Mai (Trưởng phòng XNK)';
  } else if (currentRole === 'OPS') {
    currentUserEmail = 'ops.lead@econt.vn';
    currentUserName = 'Vũ Minh Trí (Trưởng ban Điều phối)';
  } else if (currentRole === 'FINANCE') {
    currentUserEmail = 'finance@econt.vn';
    currentUserName = 'Đặng Thu Thảo (Kế toán trưởng)';
  } else if (currentRole === 'SUPER_ADMIN') {
    currentUserEmail = 'admin@econt.vn';
    currentUserName = 'Quản trị viên Hệ thống';
  }

  return (
    <AuthContext.Provider
      value={{
        currentRole,
        setRole,
        currentCompany,
        currentUserEmail,
        currentUserName,
        roleBadge: ROLE_INFO[currentRole]
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
};
