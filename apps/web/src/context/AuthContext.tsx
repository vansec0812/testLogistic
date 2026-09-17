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
  isAuthenticated: boolean;
  login: (username: string, password: string) => { success: boolean; message: string };
  logout: () => void;
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

export const ROLE_OPTIONS: Array<{ value: UserRole; label: string; icon: string; desc: string }> = [
  { value: 'ENTERPRISE_A', label: 'Bên A · Quản lý nguồn vỏ', icon: '🏭', desc: 'Hưng Thịnh Logistics — Đơn vị cần trả vỏ rỗng' },
  { value: 'ENTERPRISE_B', label: 'Bên B · Cần vỏ container', icon: '📦', desc: 'Toàn Cầu Export Corp — Đơn vị đóng hàng xuất khẩu' },
  { value: 'OPS', label: 'Vận hành · ECont Ops', icon: '⚙️', desc: 'Trung tâm Vận hành, Duyệt hãng tàu & Đối soát ECont' },
];

export const ECONT_OPS_COMPANY: Company = {
  id: 'COMP-OPS',
  taxCode: '0318999999',
  companyName: 'Nền tảng ECont Logistics — Trung tâm Vận hành & Điều phối',
  shortName: 'ECont Operations',
  businessType: 'FORWARDER',
  address: 'Tầng 12, Tòa nhà Bitexco, Quận 1, TP.HCM',
  representativeName: 'Vũ Minh Trí (Ops Lead)',
  representativePhone: '0901239999',
  representativeEmail: 'ops.lead@econt.vn',
  verificationStatus: 'VERIFIED',
  trustScoreA: 100,
  trustScoreB: 100,
  totalCompletedAsA: 100,
  totalCompletedAsB: 100,
};

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
    label: 'Vận hành & Đối soát (Ops)',
    color: 'text-amber-700 border-amber-300',
    bgColor: 'bg-amber-50',
    desc: 'Điều phối viên ECont — Thẩm định DN, duyệt RU, đối soát & xử lý case',
    icon: '⚙️',
  },
  FINANCE: {
    label: 'Vận hành & Đối soát (Ops)',
    color: 'text-amber-700 border-amber-300',
    bgColor: 'bg-amber-50',
    desc: 'Điều phối viên ECont — Thẩm định DN, duyệt RU, đối soát & xử lý case',
    icon: '⚙️',
  },
  SUPER_ADMIN: {
    label: 'Vận hành & Đối soát (Ops)',
    color: 'text-amber-700 border-amber-300',
    bgColor: 'bg-amber-50',
    desc: 'Điều phối viên ECont — Thẩm định DN, duyệt RU, đối soát & xử lý case',
    icon: '⚙️',
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
    companyIndex: -1, // Use ECONT_OPS_COMPANY
    email: 'ops.lead@econt.vn',
    name: 'Vũ Minh Trí (Trưởng ban Điều phối & Vận hành)',
    userId: 'USR-OPS01',
  },
  FINANCE: {
    companyIndex: -1,
    email: 'ops.lead@econt.vn',
    name: 'Vũ Minh Trí (Trưởng ban Điều phối & Vận hành)',
    userId: 'USR-OPS01',
  },
  SUPER_ADMIN: {
    companyIndex: -1,
    email: 'ops.lead@econt.vn',
    name: 'Vũ Minh Trí (Trưởng ban Điều phối & Vận hành)',
    userId: 'USR-OPS01',
  },
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('econt_is_authenticated') === 'true';
  });

  const [currentRole, setCurrentRole] = useState<UserRole>(() => {
    const saved = localStorage.getItem('econt_active_role') as UserRole;
    return saved && ['ENTERPRISE_A', 'ENTERPRISE_B', 'OPS'].includes(saved) ? saved : 'ENTERPRISE_A';
  });

  // (Optional) We can also save current logged-in user details to override ROLE_USERS,
  // but for this demo, just matching the role works since ROLE_USERS provides a mock for each role.
  const [activeUserEmail, setActiveUserEmail] = useState<string | null>(null);
  const [activeUserName, setActiveUserName] = useState<string | null>(null);
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [activeCompany, setActiveCompany] = useState<Company | null>(() => {
    try {
      const saved = localStorage.getItem('econt_active_company');
      return saved ? JSON.parse(saved) as Company : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    localStorage.setItem('econt_active_role', currentRole);
  }, [currentRole]);

  useEffect(() => {
    localStorage.setItem('econt_is_authenticated', isAuthenticated ? 'true' : 'false');
  }, [isAuthenticated]);

  const login = (username: string, password: string) => {
    let success = false;
    let roleToSet: UserRole = 'ENTERPRISE_A';
    let emailToSet: string | null = null;
    let nameToSet: string | null = null;
    let registeredUser: any = null;

    if (username === 'bena' && password === 'bena123') {
      success = true; roleToSet = 'ENTERPRISE_A';
    } else if (username === 'benb' && password === 'benb123') {
      success = true; roleToSet = 'ENTERPRISE_B';
    } else if (username === 'ops' && password === 'ops123') {
      success = true; roleToSet = 'OPS';
    } else {
      const users = JSON.parse(localStorage.getItem('econt_registered_users') || '[]');
      registeredUser = users.find((u: any) => u.username === username && u.password === password);
      if (registeredUser) {
        success = true;
        roleToSet = registeredUser.role;
        emailToSet = registeredUser.email;
        nameToSet = registeredUser.fullName;
      }
    }

    if (success) {
      setCurrentRole(roleToSet);
      setIsAuthenticated(true);
      setActiveUserEmail(emailToSet);
      setActiveUserName(nameToSet);
      setActiveUserId(registeredUser?.id || ROLE_USERS[roleToSet].userId);
      setActiveCompany(registeredUser?.company || null);
      if (registeredUser?.company) localStorage.setItem('econt_active_company', JSON.stringify(registeredUser.company));
      else localStorage.removeItem('econt_active_company');
      return { success: true, message: 'Đăng nhập thành công' };
    }
    return { success: false, message: 'Sai tên đăng nhập hoặc mật khẩu' };
  };

  const logout = () => {
    setIsAuthenticated(false);
    setActiveUserEmail(null);
    setActiveUserName(null);
    setActiveUserId(null);
    setActiveCompany(null);
    localStorage.removeItem('econt_active_company');
  };

  const setRole = (role: UserRole) => {
    // If legacy role passed, map to OPS
    const normalizedRole = (role === 'FINANCE' || role === 'SUPER_ADMIN') ? 'OPS' : role;
    setCurrentRole(normalizedRole);
  };

  const value = useMemo((): AuthContextType => {
    const userInfo = ROLE_USERS[currentRole] || ROLE_USERS.OPS;
    const currentCompany = (currentRole === 'OPS' || currentRole === 'FINANCE' || currentRole === 'SUPER_ADMIN')
      ? ECONT_OPS_COMPANY
      : activeCompany || (userInfo.companyIndex === -1 ? ECONT_OPS_COMPANY : INITIAL_COMPANIES[userInfo.companyIndex]);

    const isOps = currentRole === 'OPS' || currentRole === 'FINANCE' || currentRole === 'SUPER_ADMIN';

    return {
      isAuthenticated,
      login,
      logout,
      currentRole,
      setRole,
      currentCompany,
      currentUserEmail: activeUserEmail || userInfo.email,
      currentUserName: activeUserName || userInfo.name,
      currentUserId: activeUserId || userInfo.userId,
      roleBadge: ROLE_INFO[currentRole] || ROLE_INFO.OPS,
      canCreateOffers: currentRole === 'ENTERPRISE_A' && currentCompany.verificationStatus === 'VERIFIED',
      canCreateRequests: currentRole === 'ENTERPRISE_B' && currentCompany.verificationStatus === 'VERIFIED',
      canOpsReview: isOps,
      canFinanceReconcile: isOps,
      canAdmin: isOps,
      isPartyA: (companyAId: string) =>
        currentRole === 'ENTERPRISE_A' && currentCompany.id === companyAId,
      isPartyB: (companyBId: string) =>
        currentRole === 'ENTERPRISE_B' && currentCompany.id === companyBId,
    };
  }, [currentRole, isAuthenticated, activeUserEmail, activeUserName, activeUserId, activeCompany]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
