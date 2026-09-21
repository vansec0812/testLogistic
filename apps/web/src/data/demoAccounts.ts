import type { UserRole } from '../types';

export interface DemoLoginAccount {
  username: string;
  password: string;
  role: UserRole;
  companyId?: string;
  email?: string;
  phone?: string;
  fullName?: string;
  userId: string;
  label: string;
}

/**
 * Tài khoản dùng riêng cho môi trường demo. Không dùng danh sách này cho môi
 * trường production; production phải xác thực ở server bằng mật khẩu được băm.
 */
export const DEMO_LOGIN_ACCOUNTS: DemoLoginAccount[] = [
  {
    username: 'bena',
    password: 'bena123',
    role: 'ENTERPRISE_A',
    companyId: 'COMP-A01',
    email: 'hung.nguyen@hungthinhlog.vn',
    phone: '0901234501',
    fullName: 'Nguyễn Văn Hưng',
    userId: 'USR-A01',
    label: 'Hưng Thịnh Logistics · Nhà cung cấp Container',
  },
  {
    username: 'benb',
    password: 'benb123',
    role: 'ENTERPRISE_B',
    companyId: 'COMP-B01',
    email: 'mai.tran@toancaugroups.vn',
    phone: '0901234502',
    fullName: 'Trần Thị Mai',
    userId: 'USR-B01',
    label: 'Toàn Cầu Export Corp · Cần vỏ Container',
  },
  {
    username: 'ops',
    password: 'ops123',
    role: 'OPS',
    email: 'ops.lead@econt.vn',
    phone: '0901234503',
    fullName: 'Vũ Minh Trí',
    userId: 'USR-OPS01',
    label: 'ECont Ops · Vận hành và điều phối',
  },
  {
    username: 'cangmiennam',
    password: 'cangmiennam123',
    role: 'ENTERPRISE_A',
    companyId: 'COMP-C01',
    email: 'nam.le@cangmiennam.com',
    phone: '0901234504',
    fullName: 'Lê Hoàng Nam',
    userId: 'USR-C01',
    label: 'Cảng Miền Nam Logistics · Nhà cung cấp Container',
  },
  {
    username: 'phuquocxanh',
    password: 'phuquocxanh123',
    role: 'ENTERPRISE_B',
    companyId: 'COMP-PENDING01',
    email: 'tuan.pham@phuquocgreen.vn',
    phone: '0901234505',
    fullName: 'Phạm Thanh Tuấn',
    userId: 'USR-PENDING01',
    label: 'Phú Quốc Green Trade · Cần vỏ Container (chờ Ops xác minh)',
  },
];
