// ==============================================================================
// ECont Utility Functions
// ==============================================================================

/**
 * Format tiền VND (integer) - KHÔNG dùng toFixed() hay float arithmetic
 */
export function formatVnd(amount: number | undefined | null): string {
  if (amount === undefined || amount === null) return "—";
  return `${new Intl.NumberFormat("vi-VN").format(Math.round(amount))} VNĐ`;
}

/**
 * Format số thuần VND có đơn vị
 */
export function formatVndShort(amount: number | undefined | null): string {
  if (amount === undefined || amount === null) return "—";
  const v = Math.round(amount);
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)} tỷ VNĐ`;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)} triệu VNĐ`;
  if (v >= 1_000) return `${(v / 1000).toFixed(0)}k VNĐ`;
  return `${v} VNĐ`;
}

/**
 * Format ISO timestamp thành chuỗi ngày giờ Việt Nam (UTC+7)
 */
export function formatDateTime(isoStr: string | undefined | null): string {
  if (!isoStr) return "—";
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Ho_Chi_Minh",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(isoStr));
    const value = Object.fromEntries(
      parts.map((part) => [part.type, part.value]),
    );
    return `${value.day}/${value.month}/${value.year} ${value.hour}:${value.minute}`;
  } catch {
    return "—";
  }
}

/**
 * Format chỉ ngày
 */
export function formatDate(isoStr: string | undefined | null): string {
  if (!isoStr) return "—";
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Ho_Chi_Minh",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).formatToParts(new Date(isoStr));
    const value = Object.fromEntries(
      parts.map((part) => [part.type, part.value]),
    );
    return `${value.day}/${value.month}/${value.year}`;
  } catch {
    return "—";
  }
}

/**
 * Format giá trị của input datetime-local mà không đổi múi giờ.
 * Kết quả hiển thị thống nhất theo dd/mm/yyyy HH:mm.
 */
export function formatDateTimeLocal(value: string | undefined | null): string {
  if (!value) return "—";
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) return "—";
  return `${match[3]}/${match[2]}/${match[1]} ${match[4]}:${match[5]}`;
}

/**
 * Format khoảng thời gian tương đối (vd: "2 giờ trước", "còn 30 phút")
 */
export function formatRelativeTime(
  isoStr: string | undefined | null,
  future = false,
): string {
  if (!isoStr) return "—";
  try {
    const diffMs = new Date(isoStr).getTime() - Date.now();
    const absDiffMs = Math.abs(diffMs);
    const isFuture = diffMs > 0;

    const minutes = Math.round(absDiffMs / 60000);
    const hours = Math.floor(absDiffMs / 3600000);
    const days = Math.floor(absDiffMs / 86400000);

    let label: string;
    if (absDiffMs < 60000) {
      label = "vừa xong";
    } else if (minutes < 60) {
      label = `${minutes} phút`;
    } else if (hours < 24) {
      label = `${hours} giờ`;
    } else {
      label = `${days} ngày`;
    }

    if (label === "vừa xong") return label;
    return isFuture ? `còn ${label}` : `${label} trước`;
  } catch {
    return "—";
  }
}

/**
 * Format countdown timer (đếm ngược còn bao nhiêu: "28:45" - mm:ss hoặc "2h 15p")
 */
export function formatCountdown(isoDeadline: string | undefined | null): {
  display: string;
  isUrgent: boolean;
  isExpired: boolean;
  remainMs: number;
} {
  if (!isoDeadline)
    return { display: "—", isUrgent: false, isExpired: false, remainMs: 0 };
  const remainMs = new Date(isoDeadline).getTime() - Date.now();
  if (remainMs <= 0) {
    return { display: "HẾT HẠN", isUrgent: true, isExpired: true, remainMs: 0 };
  }
  const hours = Math.floor(remainMs / 3600000);
  const minutes = Math.floor((remainMs % 3600000) / 60000);
  const seconds = Math.floor((remainMs % 60000) / 1000);

  let display: string;
  if (hours > 0) {
    display = `${hours}h ${minutes}p`;
  } else {
    display = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return {
    display,
    isUrgent: remainMs < 30 * 60000, // < 30 phút
    isExpired: false,
    remainMs,
  };
}

/**
 * Format khoảng cách
 */
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

/**
 * Rút gọn chuỗi nếu quá dài
 */
export function truncate(str: string, max = 50): string {
  if (!str) return "";
  return str.length > max ? str.slice(0, max) + "…" : str;
}

/**
 * Tạo class names an toàn (tương tự clsx)
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

/**
 * Helper che (masking) thông tin nhạy cảm theo tài liệu ECont Round Use Workflow:
 * - Trạng thái TRƯỚC ACCEPTED (DRAFT, OFFER_CREATED, AVAILABLE, OPEN, MATCH_REQUESTED, MATCHED, NEGOTIATING):
 *   Tự động chuyển đổi các trường Tên công ty, Số điện thoại (phone), Địa chỉ chi tiết (address) thành dạng ẩn '***'.
 * - Trạng thái TỪ ACCEPTED TRỞ ĐI (ACCEPTED, CARRIER_APPROVAL_PENDING, CARRIER_APPROVED, PAYMENT_CONFIRMED, HANDOVER, COMPLETED...)
 *   hoặc khi có xác nhận của Ops (isOps: true), hoặc là chính chủ sở hữu (isOwner: true):
 *   Hiển thị đầy đủ thông tin gốc.
 */
export function maskPrivateData(
  text: string | undefined | null,
  state: string | undefined | null,
  options?: {
    isOps?: boolean;
    isOwner?: boolean;
    field?: "company" | "phone" | "address" | "general";
    preserveRegion?: boolean;
  },
): string {
  if (!text) return "";

  // 1. Đặc quyền: Ops hoặc Chính chủ sở hữu xem được toàn bộ thông tin
  if (options?.isOps || options?.isOwner) {
    return text;
  }

  const normalizedState = (state || "").toUpperCase().trim();

  // 2. Trạng thái sau ACCEPTED được phép hiển thị đầy đủ
  const POST_ACCEPTED_STATES = new Set([
    "ACCEPTED",
    "MATCH_ACCEPTED",
    "CARRIER_APPROVAL_PENDING",
    "PENDING_CARRIER",
    "CARRIER_APPROVED",
    "PAYMENT_PENDING",
    "PAYMENT_CONFIRMED",
    "AWAITING_PAYMENT",
    "READY_FOR_PICKUP",
    "INSPECTION",
    "HANDOVER_PENDING",
    "HANDOVER_IN_PROGRESS",
    "HANDOVER_CONFIRMED",
    "COMPLETED",
    "DISPUTE_PENDING",
    "DISPUTE_OPEN",
    "UNDER_REVIEW_DISPUTE",
    "RESOLVED",
    "CLOSED",
  ]);

  if (POST_ACCEPTED_STATES.has(normalizedState)) {
    return text;
  }

  // 3. Trạng thái TRƯỚC ACCEPTED -> Masking bảo mật dữ liệu nhạy cảm
  if (options?.field === "phone") {
    return "***";
  }

  if (options?.field === "company") {
    return "***";
  }

  if (options?.field === "address") {
    // Với địa chỉ: nếu cấu hình preserveRegion !== false và địa chỉ có phân tách quận/huyện/tỉnh
    // Giữ lại khu vực/tỉnh thành để doanh nghiệp nhận biết vùng hoạt động
    if (options?.preserveRegion !== false) {
      const parts = text.split(",").map((p) => p.trim());
      if (parts.length > 1) {
        const region = parts.slice(1).join(", ");
        return `***, ${region}`;
      }
    }
    return "***";
  }

  return "***";
}
