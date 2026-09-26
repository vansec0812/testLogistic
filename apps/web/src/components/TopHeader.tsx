// ==============================================================================
// ECont TopHeader - Thanh Tiêu Đề & Thanh Tác Vụ Nhanh Trên Cùng
// ==============================================================================

import React from "react";
import { Menu, ChevronRight, UserCircle2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { NotificationCenter } from "./NotificationCenter";

interface TopHeaderProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  setSelectedTxnId?: (id: string) => void;
  setIsMobileOpen: (open: boolean) => void;
}

const PAGE_METADATA: Record<
  string,
  { title: string; subtitle: string; category: string }
> = {
  dashboard: {
    category: "Tổng quan",
    title: "Bàn làm việc & Chỉ số",
    subtitle:
      "Theo dõi chỉ số luân chuyển, radar ghép đôi vỏ cont rỗng thời gian thực",
  },
  assets: {
    category: "Nghiệp vụ Vỏ Cont",
    title: "Quản lý Kho Vỏ Container",
    subtitle:
      "Danh mục tài sản vỏ cont rỗng, thẩm định chất lượng IICL và kiểm tra 7 góc",
  },
  offers: {
    category: "Nghiệp vụ Vỏ Cont",
    title: "Nguồn cung Vỏ Container",
    subtitle:
      "Đăng Offer nguồn vỏ cont rỗng, tối ưu hóa điểm trả vỏ và tạo giao dịch",
  },
  requests: {
    category: "Kết nối & Giao dịch",
    title: "Nhu cầu Tìm Vỏ Container",
    subtitle:
      "Đăng nhu cầu đóng hàng, công cụ ghép đôi tự động và giữ chỗ tức thời",
  },
  transactions: {
    category: "Kết nối & Giao dịch",
    title: "Vòng đời Giao dịch 7 Bước",
    subtitle:
      "Quy trình chuẩn hóa từ Thỏa thuận, Duyệt hãng tàu, Ký quỹ đến Bàn giao EIR",
  },
  chat: {
    category: "Kết nối & Giao dịch",
    title: "Tin nhắn Trao đổi Trực tiếp",
    subtitle:
      "Kênh liên lạc thời gian thực giữa hai bên giao dịch và Điều phối viên Ops",
  },
  ops: {
    category: "Điều hành & Hỗ trợ",
    title: "Cổng Vận Hành ECont Ops",
    subtitle:
      "Thẩm định Doanh nghiệp, Phê duyệt Hãng tàu & Giám sát Đối soát Street-turn",
  },
  cases: {
    category: "Điều hành & Hỗ trợ",
    title: "Quản lý Sự cố & Khiếu nại",
    subtitle:
      "Ghi nhận hư hỏng, điều tra nguyên nhân và kết luận giải quyết đền bù",
  },
  database: {
    category: "Điều hành & Hỗ trợ",
    title: "Cơ sở Dữ liệu & Đồng bộ",
    subtitle:
      "Cấu hình đồng bộ dữ liệu thời gian thực và quản lý tài nguyên hệ thống",
  },
  profile: {
    category: "Tài khoản",
    title: "Hồ sơ Doanh nghiệp & Tài khoản",
    subtitle:
      "Cập nhật thông tin định danh, giấy phép kinh doanh và người đại diện",
  },
  "change-password": {
    category: "Tài khoản",
    title: "Bảo mật & Đổi mật khẩu",
    subtitle: "Xác thực OTP và thiết lập mật khẩu bảo vệ tài khoản",
  },
};

export const TopHeader: React.FC<TopHeaderProps> = ({
  currentTab,
  setCurrentTab,
  setSelectedTxnId,
  setIsMobileOpen,
}) => {
  const { currentUserName } = useAuth();

  const pageInfo = PAGE_METADATA[currentTab] || {
    category: "Hệ thống",
    title: "ECont Logistics",
    subtitle: "Nền tảng kết nối và tái sử dụng container rỗng thông minh",
  };

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/90 px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4 shadow-2xs">
      {/* Left: Mobile Toggle & Breadcrumbs / Title */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={() => setIsMobileOpen(true)}
          className="p-2 -ml-1 rounded-xl text-slate-600 hover:bg-slate-100 lg:hidden focus:outline-none transition-colors"
          aria-label="Mở menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="min-w-0">
          {/* Breadcrumb path */}
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
            <span
              className="hover:text-slate-600 cursor-pointer"
              onClick={() => setCurrentTab("dashboard")}
            >
              ECont
            </span>
            <ChevronRight className="w-3 h-3 text-slate-300" />
            <span className="text-slate-500">{pageInfo.category}</span>
          </div>

          {/* Page title & Subtitle */}
          <div className="flex items-center gap-2 mt-0.5">
            <h1 className="text-base sm:text-lg font-bold text-slate-900 truncate tracking-tight">
              {pageInfo.title}
            </h1>
          </div>
          <p className="text-xs text-slate-500 hidden md:block mt-0.5 leading-relaxed">
            {pageInfo.subtitle}
          </p>
        </div>
      </div>

      {/* Right: Notification Center & Profile */}
      <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
        {/* Notification Center */}
        <NotificationCenter
          setCurrentTab={setCurrentTab}
          setSelectedTxnId={setSelectedTxnId}
        />

        {/* Profile Avatar / Quick Link */}
        <button
          type="button"
          onClick={() => setCurrentTab("profile")}
          className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors border border-transparent hover:border-slate-200"
          title={`Hồ sơ cá nhân: ${currentUserName}`}
        >
          <UserCircle2 className="w-6 h-6 text-slate-700" />
        </button>
      </div>
    </header>
  );
};
