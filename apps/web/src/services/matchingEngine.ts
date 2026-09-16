// ==============================================================================
// ECont Matching Engine
// Tuân thủ nghiêm ngặt công thức SRS mục 5.2 và plan.md mục 7.1
// ==============================================================================

import { ContainerRequest, Offer, MatchCandidate } from '../types';
import { calculateQuote } from './pricingEngine';

// Hàm tính khoảng cách tương đối (Haversine công thức tính km giữa 2 tọa độ)
export function calculateDistanceKm(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371; // Bán kính trái đất (km)
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export function findMatchesForRequest(
  request: ContainerRequest,
  offers: Offer[]
): MatchCandidate[] {
  const candidates: MatchCandidate[] = [];

  const reqCutOff = new Date(request.cutOffTime).getTime();
  const reqStart = new Date(request.pickupWindowStart).getTime();
  const reqEnd = new Date(request.pickupWindowEnd).getTime();
  const dMax = request.maxDistanceKm || 40.0;

  for (const offer of offers) {
    // 1. HARD CONSTRAINTS (SRS mục 5.2):
    // - Khớp hãng tàu
    if (offer.asset.carrierCode !== request.carrierCode) continue;
    // - Khớp loại container (20GP hoặc 40HC)
    if (offer.asset.containerType !== request.containerType) continue;
    // - Offer phải ở trạng thái AVAILABLE
    if (offer.status !== 'AVAILABLE') continue;
    // - Không tự ghép với chính công ty mình (BR01-03)
    if (offer.companyId === request.companyId) continue;

    // 2. TÍNH KHOẢNG CÁCH THỰC TẾ d (Kho A -> Kho B)
    const distanceKm = calculateDistanceKm(
      offer.pickupLatitude, offer.pickupLongitude,
      request.deliveryLatitude, request.deliveryLongitude
    );

    // Không vượt quá bán kính Dmax
    if (distanceKm > dMax) continue;

    // 3. KHẢ THI VỀ THỜI GIAN (Time Feasibility)
    const offerAvailFrom = new Date(offer.availableFrom).getTime();
    const offerAvailTo = new Date(offer.availableTo).getTime();
    
    // E: Thời điểm sớm nhất có thể bốc cont tại A
    // max(a0, b0, now + dispatch_lead_time 60 phút)
    const leadTimeMs = 60 * 60 * 1000;
    const nowMs = Date.now();
    const E = Math.max(offerAvailFrom, reqStart, nowMs + leadTimeMs);

    // tAB (thời gian vận chuyển A->B, ước tính 2 phút/km + 30 phút xếp dỡ)
    const tAbMinutes = Math.round(distanceKm * 2 + 30);
    const tAbMs = tAbMinutes * 60 * 1000;

    // Z: Thời điểm muộn nhất phải hoàn thành
    // min(a1, b1 + p, cut_off - tAB - buffer)
    const bufferCutOffMs = 120 * 60 * 1000; // 2 giờ đệm trước cut-off
    const Z = Math.min(offerAvailTo, reqEnd, reqCutOff - tAbMs - bufferCutOffMs);

    // Điều kiện khả thi: E + tAB <= Z
    const timeFeasible = E + tAbMs <= Z;
    if (!timeFeasible) continue;

    // 4. TÍNH ĐIỂM THÀNH PHẦN (D, T, C)
    // D = 100 * max(0, 1 - d / Dmax)
    const scoreD = Math.max(0, Math.round(100 * (1 - distanceKm / dMax)));

    // T = 100 * min(1, max(0, (Z - E - tAB) / 120 phút))
    const slackMinutes = Math.max(0, (Z - (E + tAbMs)) / (60 * 1000));
    const scoreT = Math.min(100, Math.round(100 * Math.min(1, slackMinutes / 120)));

    // C = 100 nếu GOOD; 60 nếu MINOR_DAMAGE
    let scoreC = 100;
    if (offer.asset.physicalCondition === 'MINOR_DAMAGE') {
      scoreC = 60;
    } else if (offer.asset.physicalCondition === 'MAJOR_DAMAGE') {
      // Hư hỏng nặng không thể tái sử dụng
      continue;
    }

    // 5. ĐIỂM MATCHING TỔNG HỢP (M = 30% D + 40% T + 30% C)
    const scoreM = Math.round(0.30 * scoreD + 0.40 * scoreT + 0.30 * scoreC);

    // 6. TÍNH BÁO GIÁ MINH BẠCH
    const truckingCost = Math.round(500000 + distanceKm * 15000); // Cước xe A->B
    const quote = calculateQuote({
      tAVnd: offer.baselineDepotCostVnd,
      tBVnd: request.baselinePickupCostVnd,
      fRuVnd: 1200000,
      shareAlpha: 0.5,
      truckingAbVnd: truckingCost,
      extrasAVnd: 0,
      extrasBVnd: 0
    });

    candidates.push({
      offer,
      distanceKm,
      timeFeasible,
      scoreD,
      scoreT,
      scoreC,
      scoreM,
      quote
    });
  }

  // Sắp xếp theo thứ tự ưu tiên: M giảm dần, khoảng cách d tăng dần
  candidates.sort((a, b) => {
    if (b.scoreM !== a.scoreM) return b.scoreM - a.scoreM;
    return a.distanceKm - b.distanceKm;
  });

  return candidates;
}

