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
