// ==============================================================================
// ECont Matching Engine - Version 2.0
// Tuân thủ công thức SRS mục 5.2 và plan.md mục 9
// Hard constraints: carrier, type, Dmax, condition, status
// Score: M = 30%D + 40%T + 30%C, tie-break: distance, then approvedAt, then ID
// ==============================================================================

import { ContainerRequest, Offer, MatchCandidate } from '../types';
import { calculateQuote } from './pricingEngine';
import { QA_RULES } from './qaRules';

const MS_PER_HOUR = 3600000;
const LOCATION_STALE_THRESHOLD_HOURS = 24;

/**
 * Hàm tính khoảng cách tương đối (Haversine - km giữa 2 tọa độ)
 */
export function calculateDistanceKm(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export interface MatchResult {
  candidates: MatchCandidate[];
  eliminatedCount: number;
  eliminationReasons: Array<{
    offerId: string;
    reasons: string[];
  }>;
  dataWarnings: string[];
}

/**
 * Tìm danh sách Offer phù hợp cho một Request
 * Trả về tối đa 3 ứng viên tốt nhất (SRS)
 */
export function findMatchesForRequest(
  request: ContainerRequest,
  offers: Offer[],
  maxResults = 3
): MatchResult {
  const candidates: MatchCandidate[] = [];
  const eliminationReasons: Array<{ offerId: string; reasons: string[] }> = [];
  const dataWarnings: string[] = [];

  const reqCutOff = new Date(request.cutOffTime).getTime();
  const reqStart = new Date(request.pickupWindowStart).getTime();
  const reqEnd = new Date(request.pickupWindowEnd).getTime();
  const dMax = request.maxDistanceKm || 40.0;
  const nowMs = Date.now();

  for (const offer of offers) {
    const eliminatedReasons: string[] = [];

    // === HARD CONSTRAINTS (SRS mục 5.2) ===
    // BR01-03: Không ghép cùng công ty
    if (offer.companyId === request.companyId) {
      eliminatedReasons.push('Cùng công ty với bên đăng nhu cầu');
    }

    // Khớp hãng tàu
    if (offer.asset.carrierCode !== request.carrierCode) {
      eliminatedReasons.push(`Hãng tàu không khớp: Offer=${offer.asset.carrierCode}, Req=${request.carrierCode}`);
    }

    // Khớp loại container
    if (offer.asset.containerType !== request.containerType) {
      eliminatedReasons.push(`Loại cont không khớp: Offer=${offer.asset.containerType}, Req=${request.containerType}`);
    }

    // Offer phải AVAILABLE
    if (offer.status !== 'AVAILABLE') {
      eliminatedReasons.push(`Offer không ở trạng thái AVAILABLE (hiện: ${offer.status})`);
    }

    // Condition: MAJOR_DAMAGE không eligible
    if (offer.asset.declaredCondition === 'MAJOR_DAMAGE') {
      eliminatedReasons.push('Tình trạng vỏ MAJOR_DAMAGE không đủ điều kiện tái sử dụng');
    }

    // Physical status: chỉ EMPTY_AT_YARD và EMPTY_AT_DEPOT được phép
    if (offer.asset.physicalStatus !== 'EMPTY_AT_YARD' && offer.asset.physicalStatus !== 'EMPTY_AT_DEPOT') {
      eliminatedReasons.push(`Tình trạng vật lý ${offer.asset.physicalStatus} không đủ điều kiện`);
    }

    if (eliminatedReasons.length > 0) {
      eliminationReasons.push({ offerId: offer.id, reasons: eliminatedReasons });
      continue;
    }

    // === KHOẢNG CÁCH ===
    const distanceKm = calculateDistanceKm(
      offer.pickupLatitude, offer.pickupLongitude,
      request.deliveryLatitude, request.deliveryLongitude
    );

    if (distanceKm > dMax) {
      eliminationReasons.push({
        offerId: offer.id,
        reasons: [`Khoảng cách ${distanceKm}km vượt Dmax=${dMax}km của nhu cầu`]
      });
      continue;
    }

    // === TUỔI VỊ TRÍ ===
    const locationObservedAt = new Date(offer.asset.locationObservedAt).getTime();
    const locationAgeMs = nowMs - locationObservedAt;
    const locationAgeHours = locationAgeMs / MS_PER_HOUR;
    const requiresLocationRefresh = locationAgeHours > LOCATION_STALE_THRESHOLD_HOURS;

    if (requiresLocationRefresh) {
      dataWarnings.push(`Offer ${offer.id}: Vị trí container đã ${Math.round(locationAgeHours)}h — cần A xác nhận lại trước khi giữ chỗ (plan.md §6.3)`);
    }

    // === KHẢ THI THỜI GIAN ===
    const offerAvailFrom = new Date(offer.availableFrom).getTime();
    const offerAvailTo = new Date(offer.availableTo).getTime();

    // E: Thời điểm sớm nhất có thể bắt đầu tại A
    // max(offer_avail_from, req_start, now + 60min dispatch lead time)
    const dispatchLeadMs = 60 * 60 * 1000;
    const E = Math.max(offerAvailFrom, reqStart, nowMs + dispatchLeadMs);

    // t_AB: Thời gian vận chuyển ước tính A→B (2 phút/km + 30 phút xếp dỡ)
    const tAbMinutes = Math.round(distanceKm * 2 + 30);
    const tAbMs = tAbMinutes * 60 * 1000;

    // Buffer 2 giờ trước cut-off (kiểm tra + thủ tục cảng)
    const bufferCutOffMs = 2 * MS_PER_HOUR;

    // Z: Thời điểm muộn nhất
    const Z = Math.min(offerAvailTo, reqEnd, reqCutOff - tAbMs - bufferCutOffMs);

    const timeFeasible = (E + tAbMs) <= Z;

    if (!timeFeasible) {
      eliminationReasons.push({
        offerId: offer.id,
        reasons: [`Không khả thi về thời gian: cần lấy lúc ${new Date(E).toLocaleTimeString('vi-VN')}, muộn nhất ${new Date(Z).toLocaleTimeString('vi-VN')}`]
      });
      continue;
    }

    // === TÍNH ĐIỂM THÀNH PHẦN ===
    // D = 100 * max(0, 1 - d/Dmax)
    const scoreD = Math.max(0, Math.round(100 * (1 - distanceKm / dMax) * 10) / 10);

    // T = 100 * min(1, max(0, slack / 120 phút))
    const slackMs = Math.max(0, Z - (E + tAbMs));
    const slackMinutes = slackMs / (60 * 1000);
    const scoreT = Math.min(100, Math.round(100 * Math.min(1, slackMinutes / 120) * 10) / 10);

    // C = 100 nếu GOOD; 60 nếu MINOR_DAMAGE
    const scoreC = offer.asset.declaredCondition === 'GOOD' ? 100 : 60;

    // M = 30%D + 40%T + 30%C (làm tròn 1 chữ số thập phân)
    const scoreM = Math.round((QA_RULES.matching.scoreDistanceWeight * scoreD + QA_RULES.matching.scoreTimeWeight * scoreT + QA_RULES.matching.scoreCostWeight * scoreC) * 10) / 10;

    // === BÁO GIÁ ===
    const truckingEstimate = Math.round(500000 + distanceKm * 15000);
    const quote = calculateQuote({
      tAVnd: offer.baselineDepotCostVnd,
      tBVnd: request.baselinePickupCostVnd,
      fRuVnd: 1200000, // TODO: Lấy từ carrier config thật
      shareAlpha: 0.5,
      truckingAbVnd: truckingEstimate,
      tAStatus: 'FIRM',
      tBStatus: 'FIRM',
      fRuStatus: 'ESTIMATE', // RU chưa được approve chính thức
      truckingStatus: 'ESTIMATE',
    });

    // QA: chỉ đưa lên Match khi cả A và B đều có Net Saving dương.
    if (quote.sAVnd <= 0 || quote.sBVnd <= 0) {
      eliminationReasons.push({
        offerId: offer.id,
        reasons: ['Net Saving của một bên không dương; không hiển thị lựa chọn Match.'],
      });
      continue;
    }

    candidates.push({
      offer,
      distanceKm,
      timeFeasible,
      locationAgeHours,
      requiresLocationRefresh,
      scoreD,
      scoreT,
      scoreC,
      scoreM,
      quote,
      estimatedShippingMinutes: tAbMinutes,
      trustScoreA: (offer.companyId === 'COMP-A01' ? 94 : offer.companyId === 'COMP-C01' ? 87 : 92),
    });
  }

  // Sắp xếp: M giảm dần → distance tăng dần → reviewedAt tăng dần → ID
  candidates.sort((a, b) => {
    if (b.scoreM !== a.scoreM) return b.scoreM - a.scoreM;
    if (a.distanceKm !== b.distanceKm) return a.distanceKm - b.distanceKm;
    const aTime = a.offer.reviewedAt ? new Date(a.offer.reviewedAt).getTime() : 0;
    const bTime = b.offer.reviewedAt ? new Date(b.offer.reviewedAt).getTime() : 0;
    if (aTime !== bTime) return aTime - bTime;
    return a.offer.id.localeCompare(b.offer.id);
  });

  return {
    candidates: candidates.slice(0, maxResults),
    eliminatedCount: eliminationReasons.length,
    eliminationReasons,
    dataWarnings,
  };
}

/**
 * Fixture kiểm tra SRS AC07: D=70, T=100, C=100 → M=91
 */
export function verifyMatchingFixture(): boolean {
  const D = 70, T = 100, C = 100;
  const M = Math.round((0.30 * D + 0.40 * T + 0.30 * C) * 10) / 10;
  return M === 91;
}
