import { BookingAiCheckResult, ContainerRequest } from '../types';
import { BookingRegistrationData, BookingVerificationResult, reconcileBookingVerificationResult } from './aiService';

export function mapBookingAiResult(result: BookingVerificationResult): BookingAiCheckResult {
  return { ...result, isValid: result.status === 'VALID' && result.isLegal && result.matchesRegistration === true && !result.requiresOpsReview };
}

export function bookingVerificationFromCheck(ai: BookingAiCheckResult): BookingVerificationResult {
  return { ...ai, success: !ai.error, isLegal: ai.isValid };
}

export function reconcileBookingAiCheck(ai: BookingAiCheckResult | undefined, expected: BookingRegistrationData): BookingAiCheckResult | undefined {
  return ai ? mapBookingAiResult(reconcileBookingVerificationResult(bookingVerificationFromCheck(ai), expected)) : undefined;
}

/** Whether a Booking must be routed to Ops instead of staying in the draft flow. */
export function bookingNeedsOpsReview(ai?: BookingAiCheckResult): boolean {
  return !ai
    || ai.requiresOpsReview
    || !ai.isValid
    || ai.matchesRegistration !== true
    || ai.comparisonStatus !== 'MATCHED';
}

/** Short Vietnamese title used in the requester form, Ops queue and notifications. */
export function getBookingAiReviewTitle(ai?: BookingAiCheckResult): string {
  if (!ai) return 'Chưa có kết quả AI đối chiếu file Booking';

  const mismatchedFields = ai.mismatchedFields || [];
  if (mismatchedFields.includes('BOOKING_NUMBER')) return 'Số Booking không khớp thông tin đã nhập';
  if (mismatchedFields.includes('CARRIER_CODE')) return 'Hãng tàu trên file không khớp thông tin đã chọn';
  if (mismatchedFields.includes('CONTAINER_TYPE')) return 'Loại container trên file không khớp thông tin đã chọn';
  if (mismatchedFields.includes('CUT_OFF_TIME')) return 'Ngày cut-off trên file không khớp thông tin đã nhập';
  if (ai.comparisonStatus === 'MISMATCH' || ai.matchesRegistration === false) {
    return 'File Booking có thông tin không khớp dữ liệu đăng ký';
  }
  if (ai.status === 'INVALID') return 'File Booking không hợp lệ, cần Ops kiểm tra';
  if (ai.status === 'ANOMALY' || (ai.hasAnomaly && !ai.error)) return 'File Booking có dấu hiệu bất thường';
  if (ai.status === 'ERROR' || ai.error) return 'Không thể quét file Booking, cần Ops kiểm tra';
  if (ai.status === 'VALID' && ai.matchesRegistration) return 'File Booking hợp lệ và khớp thông tin đã nhập';
  if (ai.status === 'MANUAL_REVIEW') {
    return 'Hồ sơ Booking chờ Ops thẩm định';
  }
  if (ai.comparisonStatus === 'PENDING') {
    return 'Đang chờ đối chiếu thông tin Booking';
  }
  return ai.summary || 'Ops cần kiểm tra file Booking';
}

/** Ops queue: pending (UNDER_REVIEW) first, then approved (OPEN); newest records first within each group. */
export function sortRequestsForOps(requests: ContainerRequest[]): ContainerRequest[] {
  const statusRank = (request: ContainerRequest) =>
    request.status === 'UNDER_REVIEW' ? 0 : request.status === 'OPEN' ? 1 : 2;
  return [...requests].sort((a, b) => {
    const rankDiff = statusRank(a) - statusRank(b);
    if (rankDiff !== 0) return rankDiff;
    const createdAtA = new Date(a.createdAt || 0).getTime() || 0;
    const createdAtB = new Date(b.createdAt || 0).getTime() || 0;
    return createdAtB - createdAtA;
  });
}

export function getBookingAiEvidence(ai?: BookingAiCheckResult): string[] {
  if (!ai) return [];
  return [...new Set([
    ...(ai.mismatchDetails || []),
    ...(ai.details || []),
    ai.anomalyReason || '',
    ai.error || '',
  ].map(item => item.trim()).filter(Boolean))];
}
