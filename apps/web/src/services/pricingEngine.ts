// ==============================================================================
// ECont Pricing & Savings Calculation Engine
// Tuân thủ nghiêm ngặt công thức SRS mục 5.2 và plan.md mục 7.2
// ==============================================================================

import { Quote } from '../types';

export interface PricingInput {
  tAVnd: number;       // Cước hạ cont A về depot theo kế hoạch cũ (VD: 3,000,000 VND)
  tBVnd: number;       // Cước lấy cont B từ depot theo kế hoạch cũ (VD: 3,400,000 VND)
  fRuVnd: number;      // Phí duyệt cấp lại (RU) của hãng tàu (VD: 1,200,000 VND)
  shareAlpha?: number; // Tỷ lệ gánh phí RU của bên A (0 <= alpha <= 1, mặc định 0.5)
  truckingAbVnd?: number; // Cước xe vận chuyển từ kho A sang kho B (VD: 800,000 VND)
  extrasAVnd?: number; // Chi phí phát sinh phía A (VD: phí nâng hạ bổ sung nếu có)
  extrasBVnd?: number; // Chi phí phát sinh phía B
}

export function calculateQuote(input: PricingInput, id = 'QUOTE-' + Math.random().toString(36).substring(2, 9)): Quote {
  const tA = Math.round(input.tAVnd);
  const tB = Math.round(input.tBVnd);
  const fRu = Math.round(input.fRuVnd);
  const alpha = input.shareAlpha ?? 0.5;
  const truckingAb = Math.round(input.truckingAbVnd ?? 800000);
  const extrasA = Math.round(input.extrasAVnd ?? 0);
  const extrasB = Math.round(input.extrasBVnd ?? 0);

  // 1. Chi phí mới phát sinh khi tái sử dụng trực tiếp
  const rA0 = Math.round(alpha * fRu + extrasA);
  const rB0 = Math.round(truckingAb + (1 - alpha) * fRu + extrasB);

  // 2. Mức tiết kiệm gộp trước phí nền tảng
  const gA = tA - rA0;
  const gB = tB - rB0;

  // 3. Phí dịch vụ nền tảng ECont (chỉ thu trên phần tiết kiệm dương)
  // Phí A: 25% trên G_A; Phí B: 15% trên G_B
  const fA = Math.round(0.25 * Math.max(gA, 0));
  const fB = Math.round(0.15 * Math.max(gB, 0));

  // 4. Mức tiết kiệm ròng thực tế của từng bên
  const sA = gA - fA;
  const sB = gB - fB;

  // 5. Số tiền ECont thu hộ và thu phí nền tảng
  // A nộp: phần phí RU của A + Phí nền tảng F_A
  const econtCollectedFromA = Math.round(alpha * fRu + fA);
  // B nộp qua ECont: phần phí RU của B + Phí nền tảng F_B (Cước xe B thanh toán riêng cho nhà xe)
  const econtCollectedFromB = Math.round((1 - alpha) * fRu + fB);

  return {
    id,
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
    econtCollectedFromB
  };
}

/**
 * Kiểm thử bộ Fixture bắt buộc của SRS:
 * Input: T_A=3.000.000, T_B=3.400.000, F_RU=1.200.000, alpha=0.5, trucking_AB=800.000, extras=0
 * Kỳ vọng: A tiết kiệm 1.800.000; B tiết kiệm 1.700.000; A nộp 1.200.000; B nộp 900.000
 */
export function verifySrsFixture(): {
  passed: boolean;
  actual: Quote;
  expected: { sA: number; sB: number; collectedA: number; collectedB: number };
} {
  const actual = calculateQuote({
    tAVnd: 3000000,
    tBVnd: 3400000,
    fRuVnd: 1200000,
    shareAlpha: 0.5,
    truckingAbVnd: 800000,
    extrasAVnd: 0,
    extrasBVnd: 0
  });

  const expected = {
    sA: 1800000,
    sB: 1700000,
    collectedA: 1200000,
    collectedB: 900000
  };

  const passed = 
    actual.sAVnd === expected.sA &&
    actual.sBVnd === expected.sB &&
    actual.econtCollectedFromA === expected.collectedA &&
    actual.econtCollectedFromB === expected.collectedB;

  return { passed, actual, expected };
}

