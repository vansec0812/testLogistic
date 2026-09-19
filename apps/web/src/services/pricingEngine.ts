// ==============================================================================
// ECont Pricing & Savings Calculation Engine - Version 2.0
// Tuân thủ công thức SRS mục 5.2-5.4 và plan.md mục 9
// ==============================================================================

import { Quote } from '../types';

export interface PricingInput {
  tAVnd: number;           // Chi phí baseline A về depot (VD: 3,000,000 VND)
  tBVnd: number;           // Chi phí baseline B lấy cont từ depot (VD: 3,400,000 VND)
  fRuVnd: number;          // Phí RU của hãng tàu (VD: 1,200,000 VND)
  shareAlpha?: number;     // Tỷ lệ phí RU của nhà cung cấp (0..1, mặc định 0.5)
  truckingAbVnd?: number;  // Cước xe A→B (B tự bố trí, KHÔNG phải ECont thu)
  extrasAVnd?: number;     // Chi phí phát sinh phía A
  extrasBVnd?: number;     // Chi phí phát sinh phía B
  // Trạng thái dữ liệu
  tAStatus?: 'FIRM' | 'ESTIMATE' | 'MISSING';
  tBStatus?: 'FIRM' | 'ESTIMATE' | 'MISSING';
  fRuStatus?: 'FIRM' | 'ESTIMATE' | 'MISSING';
  truckingStatus?: 'FIRM' | 'ESTIMATE' | 'MISSING';
}

export function calculateQuote(
  input: PricingInput,
  id = 'QUOTE-' + Math.random().toString(36).substring(2, 9),
  version = 1
): Quote {
  const tAStatus = input.tAStatus ?? (input.tAVnd > 0 ? 'FIRM' : 'MISSING');
  const tBStatus = input.tBStatus ?? (input.tBVnd > 0 ? 'FIRM' : 'MISSING');
  const fRuStatus = input.fRuStatus ?? (input.fRuVnd > 0 ? 'FIRM' : 'MISSING');
  const truckingStatus = input.truckingStatus ?? (input.truckingAbVnd !== undefined ? 'ESTIMATE' : 'MISSING');

  const tA = Math.round(input.tAVnd);
  const tB = Math.round(input.tBVnd);
  const fRu = Math.round(input.fRuVnd);
  const alpha = input.shareAlpha ?? 0.5;
  const truckingAb = Math.round(input.truckingAbVnd ?? 800000);
  const extrasA = Math.round(input.extrasAVnd ?? 0);
  const extrasB = Math.round(input.extrasBVnd ?? 0);

  // 1. Chi phí mới phát sinh khi tái sử dụng trực tiếp
  // R_A0 = alpha * F_RU + extras_A (A gánh phần RU + chi phí riêng)
  const rA0 = Math.round(alpha * fRu + extrasA);
  // R_B0 = trucking_AB + (1-alpha)*F_RU + extras_B
  // Chú ý: trucking_AB là B tự trả ngoài ECont, ECont chỉ ghi nhận để tính saving
  const rB0 = Math.round(truckingAb + (1 - alpha) * fRu + extrasB);

  // 2. Mức tiết kiệm gộp trước phí nền tảng
  // G_A = T_A - R_A0 (A tiết kiệm được vs phương án cũ hạ về depot)
  const gA = tA - rA0;
  // G_B = T_B - R_B0 (B tiết kiệm được vs phương án cũ lấy cont từ depot)
  const gB = tB - rB0;

  // 3. Phí dịch vụ nền tảng ECont
  // Chỉ thu trên phần tiết kiệm dương (G > 0)
  // F_A = 25% trên G_A; F_B = 15% trên G_B
  const fA = Math.round(0.25 * Math.max(gA, 0));
  const fB = Math.round(0.15 * Math.max(gB, 0));

  // 4. Tiết kiệm ròng thực tế
  const sA = gA - fA;
  const sB = gB - fB;

  // 5. ECont thu hộ và thu phí nền tảng
  // A nộp ECont: phần phí RU của A (thu hộ cho hãng) + Phí nền tảng F_A
  const econtCollectedFromA = Math.round(alpha * fRu + fA);
  // B nộp ECont: phần phí RU của B (thu hộ) + Phí nền tảng F_B
  // Trucking B thanh toán riêng cho đơn vị vận tải, không qua ECont
  const econtCollectedFromB = Math.round((1 - alpha) * fRu + fB);

  // 6. Kiểm tra đặc biệt
  const negativeSavingA = gA < 0;
  const negativeSavingB = gB < 0;
  const savingRatioAvailable = (tA + tB) > 0; // False nếu baseline = 0

  return {
    id,
    version,
    snapshotAt: new Date().toISOString(),
    tAVnd: tA,
    tBVnd: tB,
    fRuVnd: fRu,
    shareAlpha: alpha,
    truckingAbVnd: truckingAb,
    extrasAVnd: extrasA,
    extrasBVnd: extrasB,
    rA0Vnd: rA0,
    rB0Vnd: rB0,
    gAVnd: gA,
    gBVnd: gB,
    fAVnd: fA,
    fBVnd: fB,
    sAVnd: sA,
    sBVnd: sB,
    econtCollectedFromA,
    econtCollectedFromB,
    tAStatus,
    tBStatus,
    fRuStatus,
    truckingStatus,
    negativeSavingA,
    negativeSavingB,
    savingRatioAvailable,
  };
}

/**
 * Kiểm thử bộ Fixture bắt buộc của SRS (plan.md AC09):
 * Input: T_A=3.000.000, T_B=3.400.000, F_RU=1.200.000, alpha=0.5, trucking_AB=800.000, extras=0
 * Kỳ vọng: 
 *   S_A = 1.800.000 (A tiết kiệm ròng)
 *   S_B = 1.700.000 (B tiết kiệm ròng)
 *   ECont thu từ A = 1.200.000
 *   ECont thu từ B = 900.000
 *   Tổng ECont = 2.100.000
 */
export function verifySrsFixture(): {
  passed: boolean;
  actual: Quote;
  expected: { sA: number; sB: number; collectedA: number; collectedB: number; totalEcont: number };
  details: string[];
} {
  const actual = calculateQuote({
    tAVnd: 3000000,
    tBVnd: 3400000,
    fRuVnd: 1200000,
    shareAlpha: 0.5,
    truckingAbVnd: 800000,
    extrasAVnd: 0,
    extrasBVnd: 0,
  });

  const expected = {
    sA: 1800000,
    sB: 1700000,
    collectedA: 1200000,
    collectedB: 900000,
    totalEcont: 2100000,
  };

  const checks: Array<{ name: string; actual: number; expected: number; pass: boolean }> = [
    { name: 'S_A (tiết kiệm ròng A)', actual: actual.sAVnd, expected: expected.sA, pass: actual.sAVnd === expected.sA },
    { name: 'S_B (tiết kiệm ròng B)', actual: actual.sBVnd, expected: expected.sB, pass: actual.sBVnd === expected.sB },
    { name: 'ECont thu từ A', actual: actual.econtCollectedFromA, expected: expected.collectedA, pass: actual.econtCollectedFromA === expected.collectedA },
    { name: 'ECont thu từ B', actual: actual.econtCollectedFromB, expected: expected.collectedB, pass: actual.econtCollectedFromB === expected.collectedB },
    { name: 'Tổng ECont', actual: actual.econtCollectedFromA + actual.econtCollectedFromB, expected: expected.totalEcont, pass: (actual.econtCollectedFromA + actual.econtCollectedFromB) === expected.totalEcont },
  ];

  const passed = checks.every((c) => c.pass);
  const details = checks.map((c) =>
    `${c.pass ? '✓' : '✗'} ${c.name}: kỳ vọng ${c.expected.toLocaleString('vi-VN')} ₫, thực tế ${c.actual.toLocaleString('vi-VN')} ₫`
  );

  return { passed, actual, expected, details };
}

/**
 * Định dạng số tiền VND an toàn (không dùng float để tránh lỗi làm tròn)
 */
export function formatVndAmount(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Tính tổng chi phí thực tế A phải trả trong ECont
 */
export function getActualCostA(quote: Quote): number {
  return quote.econtCollectedFromA;
}

/**
 * Tính tổng chi phí thực tế B phải trả qua ECont (chưa tính trucking B)
 */
export function getActualCostB(quote: Quote): number {
  return quote.econtCollectedFromB;
}

/**
 * Tính tổng tiết kiệm của cả 2 bên trong một giao dịch
 */
export function getTotalNetSaving(quote: Quote): number {
  return (quote.sAVnd > 0 ? quote.sAVnd : 0) + (quote.sBVnd > 0 ? quote.sBVnd : 0);
}
