// ==============================================================================
// ECont Trust Score Calculation Engine
// Tuân thủ nghiêm ngặt SRS mục 5.3 và plan.md mục 7.3
// ==============================================================================

import { calculateQaTrustScore } from './qaRules';

export interface TrustMetricsA {
  completedRate: number; // Tỷ lệ hoàn thành giao dịch (0..1)
  accuracyRate: number;  // Tỷ lệ độ chính xác hiện trạng cont (0..1)
  punctualityRate: number; // Tỷ lệ bàn giao đúng giờ (0..1)
  averageRating: number; // Đánh giá trung bình từ đối tác (1..5)
  totalCompletedDeals: number;
  disputeRate?: number;
}

export interface TrustMetricsB {
  completedRate: number; // Tỷ lệ hoàn thành (0..1)
  punctualityRate: number; // Tỷ lệ nhận cont & hạ cont đúng hẹn (0..1)
  averageRating: number; // Đánh giá trung bình từ đối tác (1..5)
  totalCompletedDeals: number;
  disputeRate?: number;
  accuracyRate?: number;
}

export function calculateTrustScoreA(metrics: TrustMetricsA): {
  score: number | null;
  label: string;
  isPublished: boolean;
} {
  // Bất biến: Tối thiểu 5 giao dịch hoàn tất trong 180 ngày mới công bố điểm
  if (metrics.totalCompletedDeals < 5) {
    return {
      score: null,
      label: 'Chưa đủ dữ liệu (Cần tối thiểu 5 giao dịch)',
      isPublished: false
    };
  }

  const result = calculateQaTrustScore({
    completedRate: metrics.completedRate,
    punctualityRate: metrics.punctualityRate,
    averageRating: metrics.averageRating,
    disputeRate: metrics.disputeRate ?? 0,
    accuracyRate: metrics.accuracyRate,
    completedTransactions: metrics.totalCompletedDeals,
  });
  const score = result.score as number;

  return {
    score,
    label: score >= 90 ? 'Rất uy tín (Hạng Kim Cương)' : score >= 80 ? 'Uy tín cao' : 'Tiêu chuẩn',
    isPublished: result.isPublished
  };
}

export function calculateTrustScoreB(metrics: TrustMetricsB): {
  score: number | null;
  label: string;
  isPublished: boolean;
} {
  if (metrics.totalCompletedDeals < 5) {
    return {
      score: null,
      label: 'Chưa đủ dữ liệu (Cần tối thiểu 5 giao dịch)',
      isPublished: false
    };
  }

  const result = calculateQaTrustScore({
    completedRate: metrics.completedRate,
    punctualityRate: metrics.punctualityRate,
    averageRating: metrics.averageRating,
    disputeRate: metrics.disputeRate ?? 0,
    accuracyRate: metrics.accuracyRate ?? 1,
    completedTransactions: metrics.totalCompletedDeals,
  });
  const score = result.score as number;

  return {
    score,
    label: score >= 90 ? 'Rất uy tín (Hạng Kim Cương)' : score >= 80 ? 'Uy tín cao' : 'Tiêu chuẩn',
    isPublished: result.isPublished
  };
}
