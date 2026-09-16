// ==============================================================================
// ECont Initial Dataset (Seed Data)
// Dữ liệu mẫu chuẩn hóa theo thực tế ngành Logistics & Cảng biển Việt Nam
// ==============================================================================

import {
  Company,
  Carrier,
  Depot,
  ContainerAsset,
  Offer,
  ContainerRequest,
  Transaction,
  CaseIssue,
  AuditEvent
} from '../types';
import { calculateCheckDigit } from '../services/iso6346';
import { calculateQuote } from '../services/pricingEngine';

// Helper tạo mã cont chuẩn ISO
function makeIsoCont(prefix: string, serial6: string): string {
  const first10 = prefix.toUpperCase() + serial6;
  const cd = calculateCheckDigit(first10) ?? 0;
  return first10 + cd;
}

export const INITIAL_COMPANIES: Company[] = [
  {
    id: 'COMP-A01',
    taxCode: '0314589234',
    companyName: 'Công ty TNHH Tiếp Vận Hưng Thịnh (Bên A - Chủ nguồn vỏ)',
    shortName: 'Hưng Thịnh Logistics',
    businessType: 'FORWARDER',
    address: 'Khu Công Nghiệp Cát Lái 2, P. Thạnh Mỹ Lợi, TP. Thủ Đức, TP.HCM',
    representativeName: 'Nguyễn Văn Hưng',
    representativePhone: '0903123456',
    representativeEmail: 'hung.nguyen@hungthinhlog.vn',
    verificationStatus: 'VERIFIED',
    trustScoreA: 94,
    trustScoreB: 88,
    totalCompletedDeals: 28
  },
  {
    id: 'COMP-B01',
    taxCode: '0316789123',
    companyName: 'Công ty Cổ phần Xuất Nhập Khẩu Toàn Cầu (Bên B - Cần mượn vỏ)',
    shortName: 'Toàn Cầu Export Corp',
    businessType: 'FACTORY',
    address: 'Lô B3, KCN Sóng Thần 1, TP. Dĩ An, Tỉnh Bình Dương',
    representativeName: 'Trần Thị Mai',
    representativePhone: '0918765432',
    representativeEmail: 'mai.tran@toancaugroups.vn',
    verificationStatus: 'VERIFIED',
    trustScoreA: 85,
    trustScoreB: 92,
    totalCompletedDeals: 34
  },
  {
    id: 'COMP-C01',
    taxCode: '0309876541',
    companyName: 'Công ty TNHH Vận Tải & Dịch Vụ Cảng Biển Miền Nam',
    shortName: 'Cảng Miền Nam Logistics',
    businessType: 'TRUCKER',
    address: 'Đường Nguyễn Thị Định, P. Cát Lái, TP. Thủ Đức, TP.HCM',
    representativeName: 'Lê Hoàng Nam',
    representativePhone: '0982334455',
    representativeEmail: 'nam.le@cangmiennam.com',
    verificationStatus: 'VERIFIED',
    totalCompletedDeals: 52
  }
];

export const INITIAL_CARRIERS: Carrier[] = [
  {
    id: 'CARR-MSK',
    code: 'MSK',
    name: 'Maersk Line A/S',
    defaultRuFeeVnd: 1200000,
    ruPolicyUrl: 'https://www.maersk.com/local-information/vietnam/empty-reuse'
  },
  {
    id: 'CARR-CMA',
    code: 'CMA',
    name: 'CMA CGM Group',
    defaultRuFeeVnd: 1300000,
    ruPolicyUrl: 'https://www.cma-cgm.com/local/vietnam'
  },
  {
    id: 'CARR-ONE',
    code: 'ONE',
    name: 'Ocean Network Express (ONE)',
    defaultRuFeeVnd: 1100000,
    ruPolicyUrl: 'https://vn.one-line.com'
  },
  {
    id: 'CARR-EMC',
    code: 'EMC',
    name: 'Evergreen Marine Corp',
    defaultRuFeeVnd: 1200000,
    ruPolicyUrl: 'https://www.evergreen-marine.com'
  }
];

export const INITIAL_DEPOTS: Depot[] = [
  {
    id: 'DEPOT-TC01',
    code: 'TC-CATLAI',
    name: 'Depot Tân Cảng Cát Lái',
    carrierId: 'CARR-MSK',
    address: 'Cổng B, Cảng Cát Lái, P. Cát Lái, TP. Thủ Đức, TP.HCM',
    latitude: 10.7584,
    longitude: 106.7932,
    operatingHours: '24/7'
  },
  {
    id: 'DEPOT-PL01',
    code: 'ICD-PHUOCLONG',
    name: 'ICD Phước Long 3',
    carrierId: 'CARR-CMA',
    address: 'Đường Song Hành Xa Lộ Hà Nội, P. Phước Long A, TP. Thủ Đức',
    latitude: 10.8225,
    longitude: 106.7681,
    operatingHours: '06:00 - 22:00'
  },
  {
    id: 'DEPOT-SOTRANS',
    code: 'ICD-SOTRANS',
    name: 'ICD Sotrans Thủ Đức',
    carrierId: 'CARR-ONE',
    address: 'Km 9 Xa Lộ Hà Nội, P. Trường Thọ, TP. Thủ Đức, TP.HCM',
    latitude: 10.8351,
    longitude: 106.7612,
    operatingHours: '07:00 - 21:00'
  }
];

export const INITIAL_ASSETS: ContainerAsset[] = [
  {
    id: 'ASSET-01',
    containerNumber: makeIsoCont('MSKU', '842109'),
    containerType: '40HC',
    carrierId: 'CARR-MSK',
    carrierCode: 'MSK',
    currentCustodianId: 'COMP-A01',
    currentCustodianName: 'Hưng Thịnh Logistics',
    physicalCondition: 'GOOD',
    conditionNotes: 'Sàn gỗ sạch, không thủng nóc, cửa đóng khít, đủ chốt seal.',
    currentDepotReturnId: 'DEPOT-TC01',
    currentDepotName: 'Depot Tân Cảng Cát Lái',
    currentLocationName: 'Kho Ngoại quan Tân Cảng, TP. Thủ Đức',
    currentLatitude: 10.7812,
    currentLongitude: 106.7845,
    freeTimeDetentionEnd: new Date(Date.now() + 4 * 86400000).toISOString(), // Còn 4 ngày free detention
    photos: [
      'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1578575437130-527eed3abbec?w=600&auto=format&fit=crop&q=80'
    ],
    isLocked: false
  },
  {
    id: 'ASSET-02',
    containerNumber: makeIsoCont('CMAU', '519283'),
    containerType: '40HC',
    carrierId: 'CARR-CMA',
    carrierCode: 'CMA',
    currentCustodianId: 'COMP-A01',
    currentCustodianName: 'Hưng Thịnh Logistics',
    physicalCondition: 'GOOD',
    conditionNotes: 'Cont chuẩn thực phẩm, sạch sẽ, không mùi hôi.',
    currentDepotReturnId: 'DEPOT-PL01',
    currentDepotName: 'ICD Phước Long 3',
    currentLocationName: 'Kho ICD Transimex, Thủ Đức, TP.HCM',
    currentLatitude: 10.8241,
    currentLongitude: 106.7712,
    freeTimeDetentionEnd: new Date(Date.now() + 3 * 86400000).toISOString(),
    photos: [
      'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=600&auto=format&fit=crop&q=80'
    ],
    isLocked: false
  },
  {
    id: 'ASSET-03',
    containerNumber: makeIsoCont('ONEU', '124982'),
    containerType: '20GP',
    carrierId: 'CARR-ONE',
    carrierCode: 'ONE',
    currentCustodianId: 'COMP-A01',
    currentCustodianName: 'Hưng Thịnh Logistics',
    physicalCondition: 'MINOR_DAMAGE',
    conditionNotes: 'Có vết xước nhẹ ngoài vách phải, không rách tôn, kín nước 100%.',
    currentDepotReturnId: 'DEPOT-SOTRANS',
    currentDepotName: 'ICD Sotrans Thủ Đức',
    currentLocationName: 'Kho Cảng Phú Hữu, TP. Thủ Đức',
    currentLatitude: 10.7932,
    currentLongitude: 106.8124,
    freeTimeDetentionEnd: new Date(Date.now() + 5 * 86400000).toISOString(),
    photos: [],
    isLocked: false
  }
];

export const INITIAL_OFFERS: Offer[] = [
  {
    id: 'OFR-2026-001',
    assetId: 'ASSET-01',
    asset: INITIAL_ASSETS[0],
    companyId: 'COMP-A01',
    companyName: 'Hưng Thịnh Logistics',
    status: 'AVAILABLE',
    pickupLocationName: 'Kho Ngoại quan Tân Cảng, TP. Thủ Đức',
    pickupLatitude: 10.7812,
    pickupLongitude: 106.7845,
    availableFrom: new Date(Date.now() - 3600000).toISOString(),
    availableTo: new Date(Date.now() + 3 * 86400000).toISOString(),
    expectedDepotId: 'DEPOT-TC01',
    expectedDepotName: 'Depot Tân Cảng Cát Lái',
    baselineDepotCostVnd: 3000000,
    reviewNotes: 'Đã thẩm định: Hạn detention hợp lệ, cont đạt chuẩn xuất khẩu.',
    createdAt: new Date(Date.now() - 24 * 3600000).toISOString()
  },
  {
    id: 'OFR-2026-002',
    assetId: 'ASSET-02',
    asset: INITIAL_ASSETS[1],
    companyId: 'COMP-A01',
    companyName: 'Hưng Thịnh Logistics',
    status: 'AVAILABLE',
    pickupLocationName: 'Kho ICD Transimex, Thủ Đức, TP.HCM',
    pickupLatitude: 10.8241,
    pickupLongitude: 106.7712,
    availableFrom: new Date(Date.now() - 7200000).toISOString(),
    availableTo: new Date(Date.now() + 2 * 86400000).toISOString(),
    expectedDepotId: 'DEPOT-PL01',
    expectedDepotName: 'ICD Phước Long 3',
    baselineDepotCostVnd: 2800000,
    reviewNotes: 'Đã thẩm định hình ảnh 6 góc cont.',
    createdAt: new Date(Date.now() - 12 * 3600000).toISOString()
  }
];

export const INITIAL_REQUESTS: ContainerRequest[] = [
  {
    id: 'REQ-2026-001',
    companyId: 'COMP-B01',
    companyName: 'Toàn Cầu Export Corp',
    carrierId: 'CARR-MSK',
    carrierCode: 'MSK',
    containerType: '40HC',
    bookingNumber: 'MSK-VN-984210',
    status: 'OPEN',
    deliveryLocationName: 'Nhà máy May Toàn Cầu, KCN Sóng Thần 1, Dĩ An, Bình Dương',
    deliveryLatitude: 10.8924,
    deliveryLongitude: 106.7451,
    pickupWindowStart: new Date(Date.now() + 7200000).toISOString(),
    pickupWindowEnd: new Date(Date.now() + 48 * 3600000).toISOString(),
    cutOffTime: new Date(Date.now() + 72 * 3600000).toISOString(),
    maxDistanceKm: 45.0,
    cargoType: 'Hàng dệt may xuất khẩu đi Mỹ',
    baselinePickupCostVnd: 3400000,
    createdAt: new Date(Date.now() - 8 * 3600000).toISOString()
  },
  {
    id: 'REQ-2026-002',
    companyId: 'COMP-B01',
    companyName: 'Toàn Cầu Export Corp',
    carrierId: 'CARR-CMA',
    carrierCode: 'CMA',
    containerType: '40HC',
    bookingNumber: 'CMA-VN-771290',
    status: 'OPEN',
    deliveryLocationName: 'Kho Nông sản KCN Nhơn Trạch 2, Đồng Nai',
    deliveryLatitude: 10.7251,
    deliveryLongitude: 106.8912,
    pickupWindowStart: new Date(Date.now() + 10800000).toISOString(),
    pickupWindowEnd: new Date(Date.now() + 36 * 3600000).toISOString(),
    cutOffTime: new Date(Date.now() + 60 * 3600000).toISOString(),
    maxDistanceKm: 35.0,
    cargoType: 'Hạt điều & Cà phê rang xay xuất khẩu EU',
    baselinePickupCostVnd: 3200000,
    createdAt: new Date(Date.now() - 4 * 3600000).toISOString()
  }
];

// Tạo 1 giao dịch mẫu ở trạng thái NEGOTIATING để trải nghiệm liền
const sampleQuote = calculateQuote({
  tAVnd: 3000000,
  tBVnd: 3400000,
  fRuVnd: 1200000,
  shareAlpha: 0.5,
  truckingAbVnd: 800000,
  extrasAVnd: 0,
  extrasBVnd: 0
});

export const INITIAL_TRANSACTIONS: Transaction[] = [
  {
    id: 'TXN-2026-0042',
    offerId: INITIAL_OFFERS[0].id,
    requestId: INITIAL_REQUESTS[0].id,
    assetId: INITIAL_ASSETS[0].id,
    companyAId: 'COMP-A01',
    companyAName: 'Hưng Thịnh Logistics',
    companyBId: 'COMP-B01',
    companyBName: 'Toàn Cầu Export Corp',
    asset: INITIAL_ASSETS[0],
    status: 'NEGOTIATING',
    isOnHold: false,
    dueAt: new Date(Date.now() + 28 * 60000).toISOString(), // 28 phút giữ chỗ còn lại
    nextAction: 'Hai bên A và B xem xét nội dung Thỏa thuận tái sử dụng và bấm Ký chấp thuận.',
    agreementVersion: 1,
    quote: sampleQuote,
    createdAt: new Date(Date.now() - 15 * 60000).toISOString()
  }
];

export const INITIAL_CASES: CaseIssue[] = [
  {
    id: 'CASE-001',
    transactionId: 'TXN-2026-0042',
    openedByCompanyId: 'COMP-B01',
    openedByCompanyName: 'Toàn Cầu Export Corp',
    caseType: 'DAMAGE_DISPUTE',
    title: 'Nghi ngờ rách ron cao su cánh cửa trái',
    description: 'Biên bản kiểm tra ghi nhận gioăng cửa hơi hở 3cm, yêu cầu Ops xem xét trước khi nhận cont.',
    status: 'RESOLVED',
    resolutionSummary: 'Ops đã đối chiếu ảnh gốc và xác nhận vệt xước ngoài, đã kiểm tra phun nước không lọt sáng/nước. Đồng ý cho phép tiếp tục.',
    resolvedAt: new Date(Date.now() - 3600000).toISOString(),
    createdAt: new Date(Date.now() - 7200000).toISOString()
  }
];

export const INITIAL_AUDIT_LOGS: AuditEvent[] = [
  {
    id: 'AUD-001',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    actorEmail: 'system@econt.vn',
    action: 'HOLD_RESERVATION_CREATED',
    entityName: 'Reservation',
    entityId: 'RES-001',
    details: 'Đã tạo khóa giữ chỗ nguyên tử 30 phút cho Asset ' + INITIAL_ASSETS[0].containerNumber
  },
  {
    id: 'AUD-002',
    timestamp: new Date(Date.now() - 1800000).toISOString(),
    actorEmail: 'ops.admin@econt.vn',
    action: 'OFFER_VERIFIED_APPROVED',
    entityName: 'Offer',
    entityId: INITIAL_OFFERS[0].id,
    details: 'Thẩm định hồ sơ cont đạt chuẩn xuất khẩu.'
  }
];

