import type { Company, UserRole } from '../types';
import { INITIAL_COMPANIES } from '../data/mockData';
import { DEMO_LOGIN_ACCOUNTS, DemoLoginAccount } from '../data/demoAccounts';

export const REGISTERED_USERS_STORAGE_KEY = 'econt_registered_users';
export const PROFILE_OVERRIDES_STORAGE_KEY = 'econt_profile_overrides_v1';

export interface EditableAccountProfile {
  username: string;
  fullName: string;
  phone: string;
  email: string;
  role: UserRole;
  company: Company;
}

export interface AccountSnapshot {
  id: string;
  username: string;
  fullName: string;
  phone: string;
  email: string;
  password: string;
  role: UserRole;
  userId: string;
  company: Company | null;
  isDemo: boolean;
}

interface StoredRegisteredUser {
  id: string;
  username: string;
  password: string;
  fullName: string;
  phone: string;
  email: string;
  role: UserRole;
  company?: Company;
}

interface ProfileOverride {
  username?: string;
  password?: string;
  fullName?: string;
  phone?: string;
  email?: string;
  role?: UserRole;
  company?: Partial<Company>;
}

const readJson = <T,>(key: string, fallback: T): T => {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
};

const writeJson = (key: string, value: unknown): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Demo mode keeps working in browsers where storage is unavailable.
  }
};

const normalizeText = (value: string): string => value.trim().toLocaleLowerCase('vi-VN');

const normalizePhone = (value: string): string => value.replace(/[^\d+]/g, '').replace(/^\+84/, '0');

const readOverrides = (): Record<string, ProfileOverride> =>
  readJson<Record<string, ProfileOverride>>(PROFILE_OVERRIDES_STORAGE_KEY, {});

const readRegisteredUsers = (): StoredRegisteredUser[] =>
  readJson<StoredRegisteredUser[]>(REGISTERED_USERS_STORAGE_KEY, []);

const companyForDemoAccount = (account: DemoLoginAccount): Company | null => {
  if (!account.companyId) return null;
  return INITIAL_COMPANIES.find(company => company.id === account.companyId) || null;
};

const mergeCompany = (company: Company | null | undefined, override?: Partial<Company>): Company | null => {
  if (!company) return null;
  return { ...company, ...(override || {}) };
};

const applyOverride = (
  base: Omit<AccountSnapshot, 'company'> & { company: Company | null },
  override: ProfileOverride | undefined,
): AccountSnapshot => ({
  ...base,
  username: override?.username ?? base.username,
  password: override?.password ?? base.password,
  fullName: override?.fullName ?? base.fullName,
  phone: override?.phone ?? base.phone,
  email: override?.email ?? base.email,
  role: override?.role ?? base.role,
  company: mergeCompany(base.company, override?.company),
});

const demoSnapshot = (account: DemoLoginAccount, overrides: Record<string, ProfileOverride>): AccountSnapshot =>
  applyOverride(
    {
      id: account.userId,
      userId: account.userId,
      username: account.username,
      password: account.password,
      fullName: account.fullName || '',
      phone: account.phone || '',
      email: account.email || '',
      role: account.role,
      company: companyForDemoAccount(account),
      isDemo: true,
    },
    overrides[account.userId],
  );

const registeredSnapshot = (user: StoredRegisteredUser): AccountSnapshot => ({
  id: user.id,
  userId: user.id,
  username: user.username,
  password: user.password,
  fullName: user.fullName,
  phone: user.phone,
  email: user.email,
  role: user.role,
  company: user.company || null,
  isDemo: false,
});

export const getAllAccounts = (): AccountSnapshot[] => {
  const overrides = readOverrides();
  return [
    ...DEMO_LOGIN_ACCOUNTS.map(account => demoSnapshot(account, overrides)),
    ...readRegisteredUsers().map(registeredSnapshot),
  ];
};

export const getAccountById = (id: string | undefined | null): AccountSnapshot | null => {
  if (!id) return null;
  return getAllAccounts().find(account => account.id === id || account.userId === id) || null;
};

export const getAccountByCredentials = (username: string, password: string): AccountSnapshot | null => {
  const normalizedUsername = normalizeText(username);
  return getAllAccounts().find(account =>
    normalizeText(account.username) === normalizedUsername && account.password === password
  ) || null;
};

export const findAccountForRecovery = (identifier: string): AccountSnapshot | null => {
  const value = identifier.trim();
  const normalized = normalizeText(value);
  const phone = normalizePhone(value);
  return getAllAccounts().find(account =>
    normalizeText(account.username) === normalized
      || normalizeText(account.email) === normalized
      || (phone.length >= 8 && normalizePhone(account.phone) === phone)
  ) || null;
};

const hasDuplicateContact = (
  account: AccountSnapshot,
  input: EditableAccountProfile,
): boolean => getAllAccounts()
  .filter(other => other.id !== account.id)
  .some(other =>
    normalizeText(other.username) === normalizeText(input.username)
      || normalizeText(other.email) === normalizeText(input.email)
      || (normalizePhone(input.phone) && normalizePhone(other.phone) === normalizePhone(input.phone))
  );

export const saveAccountProfile = (
  accountId: string,
  input: EditableAccountProfile,
): { success: boolean; message: string; account?: AccountSnapshot } => {
  const account = getAccountById(accountId);
  if (!account) return { success: false, message: 'Không tìm thấy tài khoản đang đăng nhập.' };
  if (account.role === 'OPS' && input.role !== 'OPS') {
    return { success: false, message: 'Tài khoản Vận hành Ops không thể đổi sang vai trò doanh nghiệp.' };
  }
  if (account.role !== 'OPS' && input.role === 'OPS') {
    return { success: false, message: 'Không thể tự cấp vai trò Vận hành Ops từ hồ sơ doanh nghiệp.' };
  }
  if (hasDuplicateContact(account, input)) {
    return { success: false, message: 'Tên đăng nhập, email hoặc số điện thoại đã được tài khoản khác sử dụng.' };
  }

  if (account.isDemo) {
    const overrides = readOverrides();
    overrides[account.id] = {
      ...overrides[account.id],
      fullName: input.fullName,
      phone: input.phone,
      email: input.email,
      role: input.role,
      company: input.company,
    };
    writeJson(PROFILE_OVERRIDES_STORAGE_KEY, overrides);
  } else {
    const users = readRegisteredUsers();
    const index = users.findIndex(user => user.id === account.id);
    if (index < 0) return { success: false, message: 'Không tìm thấy dữ liệu tài khoản.' };
    users[index] = {
      ...users[index],
      fullName: input.fullName,
      phone: input.phone,
      email: input.email,
      role: input.role,
      company: input.company,
    };
    writeJson(REGISTERED_USERS_STORAGE_KEY, users);
  }

  return { success: true, message: 'Đã cập nhật hồ sơ.', account: getAccountById(account.id) || undefined };
};

export const updateAccountPassword = (
  accountId: string,
  password: string,
  currentPassword?: string,
): { success: boolean; message: string } => {
  const account = getAccountById(accountId);
  if (!account) return { success: false, message: 'Không tìm thấy tài khoản cần khôi phục.' };
  if (currentPassword !== undefined && account.password !== currentPassword) {
    return { success: false, message: 'Mật khẩu hiện tại không chính xác.' };
  }

  if (account.isDemo) {
    const overrides = readOverrides();
    overrides[account.id] = { ...overrides[account.id], password };
    writeJson(PROFILE_OVERRIDES_STORAGE_KEY, overrides);
  } else {
    const users = readRegisteredUsers();
    const index = users.findIndex(user => user.id === account.id);
    if (index < 0) return { success: false, message: 'Không tìm thấy dữ liệu tài khoản.' };
    users[index] = { ...users[index], password };
    writeJson(REGISTERED_USERS_STORAGE_KEY, users);
  }

  return { success: true, message: 'Đã cập nhật mật khẩu.' };
};
