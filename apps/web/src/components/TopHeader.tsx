// ==============================================================================
// ECont TopHeader - Thanh Tiêu Đề & Thanh Tác Vụ Nhanh Trên Cùng
// ==============================================================================

import React from 'react';
import { Menu } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { NotificationCenter } from './NotificationCenter';

interface TopHeaderProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  setSelectedTxnId?: (id: string) => void;
  setIsMobileOpen: (open: boolean) => void;
}

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  dashboard: {
    title: 'Bàn làm việc & Tổng quan',
    subtitle: 'Theo dõi chỉ số, radar tự động ghép đôi và cảnh báo vòng đời',
  },
  assets: {
    title: 'Quản lý Vỏ Container',
    subtitle: 'Danh mục tài sản vỏ cont, tải ảnh 6 góc và thẩm định chất lượng IICL',
  },
  offers: {
    title: 'Nguồn cung vỏ container',
    subtitle: 'Đăng Offer nguồn vỏ cont rỗng và điều phối giao dịch',
  },
  requests: {
    title: 'Nhu cầu tìm vỏ container',
    subtitle: 'Đăng nhu cầu đóng hàng, công cụ ghép đôi tự động và giữ chỗ tức thời',
  },
  transactions: {
    title: 'Vòng đời giao dịch 7 bước',
    subtitle: 'Quy trình chuẩn hóa từ Thỏa thuận, Duyệt hãng tàu, Ký quỹ đến Bàn giao EIR',
  },
  chat: {
    title: 'Tin nhắn trao đổi trực tiếp',
    subtitle: 'Trao đổi nghiệp vụ giữa Bên A, Bên B và Đội ngũ Vận hành Ops',
  },
  ops: {
    title: 'Cổng Vận Hành ECont',
    subtitle: 'Thẩm định Doanh nghiệp, Quản lý Hãng tàu & Đối soát RU',
  },
  cases: {
    title: 'Quản lý Sự cố & Khiếu nại',
    subtitle: 'Ghi nhận, điều tra và kết luận giải quyết tranh chấp giao dịch',
  },
  database: {
    title: 'Cơ sở Dữ liệu & Đồng bộ Trực tuyến',
    subtitle: 'Cấu hình Supabase, sao lưu và đồng bộ dữ liệu thời gian thực',
  },
};

export const TopHeader: React.FC<TopHeaderProps> = ({
  currentTab,
  setCurrentTab,
  setSelectedTxnId,
  setIsMobileOpen,
}) => {
  const pageInfo = PAGE_TITLES[currentTab] || {
    title: 'Hệ thống ECont',
    subtitle: 'Nền tảng kết nối và tái sử dụng container rỗng thông minh',
  };

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-4 shadow-sm">
      {/* Left: Mobile Toggle & Page Title */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={() => setIsMobileOpen(true)}
          className="p-2 rounded-xl text-slate-600 hover:bg-slate-100 lg:hidden focus:outline-none"
          aria-label="Mở menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="min-w-0">
          <h1 className="text-base sm:text-xl font-bold text-slate-900 truncate flex items-center gap-2">
            {pageInfo.title}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 hidden sm:block truncate mt-0.5 font-normal">
            {pageInfo.subtitle}
          </p>
        </div>
      </div>

      {/* Right: Notifications & System Status */}
      <div className="flex items-center gap-2.5 shrink-0">
        {/* Online system badge */}
        <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          <span>Hệ thống trực tuyến</span>
        </div>

        {/* Notification Center */}
        <NotificationCenter
          setCurrentTab={setCurrentTab}
          setSelectedTxnId={setSelectedTxnId}
        />
      </div>
    </header>
  );
};
