// ==============================================================================
// ECont Core TypeScript Types & Enums
// Tuân thủ nghiêm ngặt SRS v1.0, agent.md và plan.md
// ==============================================================================

export type UserRole = 
  | 'ENTERPRISE_A' // Chủ container rỗng cần trả vỏ (Bên A)
  | 'ENTERPRISE_B' // Chủ hàng xuất khẩu cần mượn vỏ (Bên B)
  | 'OPS'          // Quản trị viên vận hành nền tảng ECont
  | 'FINANCE'      // Kế toán & đối soát tài chính
  | 'SUPER_ADMIN'; // Quản trị cấp cao, toàn quyền hệ thống

export type ContainerType = '20GP' | '40HC'; // Chuẩn hóa 40HQ -> 40HC

export type PhysicalCondition = 'GOOD' | 'MINOR_DAMAGE' | 'MAJOR_DAMAGE';

export type OfferStatus = 
  | 'DRAFT'
  | 'UNDER_REVIEW'
  | 'AVAILABLE'
  | 'HELD'
  | 'ALLOCATED'
  | 'COMPLETED'
  | 'CANCELLED';

export type RequestStatus = 
  | 'DRAFT'
  | 'OPEN'
  | 'HELD'
  | 'ALLOCATED'
  | 'COMPLETED'
  | 'EXPIRED'
  | 'CANCELLED';

export type TransactionStatus = 
  | 'NEGOTIATING'      // Bước 1: Giữ chỗ & xem xét thỏa thuận
  | 'PENDING_CARRIER'  // Bước 2: Chờ hãng tàu duyệt RU
  | 'AWAITING_PAYMENT' // Bước 3: Chờ nộp tiền & đối soát
  | 'READY_FOR_PICKUP' // Bước 4: Phát hành phiếu điều phối
  | 'INSPECTION'       // Bước 5: Kiểm tra cont thực tế tại bãi A
  | 'HANDOVER_PENDING' // Bước 6: Chờ 2 bên cùng ký biên bản
  | 'COMPLETED'        // Bước 7: Giao nhận thành công, chuyển custody
  | 'CANCELLED'
  | 'REJECTED'
  | 'EXPIRED';

export interface Company {
  id: string;
  taxCode: string;
  companyName: string;
  shortName: string;
  businessType: 'FORWARDER' | 'FACTORY' | 'TRUCKER' | 'SHIPPING_LINE';
  address: string;
  representativeName: string;
  representativePhone: string;
  representativeEmail: string;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'SUSPENDED';
  trustScoreA?: number; // 0..100
  trustScoreB?: number; // 0..100
  totalCompletedDeals: number;
}

export interface Carrier {
  id: string;
  code: string; // MSK, CMA, ONE, EMC, COSCO
  name: string;
  defaultRuFeeVnd: number; // Thường 1,200,000 VND
  ruPolicyUrl?: string;
  logoUrl?: string;
}

export interface Depot {
  id: string;
  code: string;
  name: string;
  carrierId: string;
  address: string;
  latitude: number;
  longitude: number;
  operatingHours: string;
}

export interface ContainerAsset {
  id: string;
  containerNumber: string; // ISO 6346 (4 chữ + 7 số, VD: TEMU1234567)
  containerType: ContainerType;
  carrierId: string;
  carrierCode: string;
  currentCustodianId: string;
  currentCustodianName: string;
  physicalCondition: PhysicalCondition;
  conditionNotes?: string;
  currentDepotReturnId: string;
  currentDepotName: string;
  currentLocationName: string;
  currentLatitude: number;
  currentLongitude: number;
  freeTimeDetentionEnd: string; // ISO timestamp
  photos: string[];
  isLocked: boolean;
}

export interface Offer {
  id: string;
  assetId: string;
  asset: ContainerAsset;
  companyId: string;
  companyName: string;
  status: OfferStatus;
  pickupLocationName: string;
  pickupLatitude: number;
  pickupLongitude: number;
  availableFrom: string;
  availableTo: string;
  expectedDepotId: string;
  expectedDepotName: string;
  baselineDepotCostVnd: number; // T_A (vd 3,000,000 VND)
  reviewNotes?: string;
  createdAt: string;
}

export interface ContainerRequest {
  id: string;
  companyId: string;
  companyName: string;
  carrierId: string;
  carrierCode: string;
  containerType: ContainerType;
  bookingNumber: string;
  status: RequestStatus;
  deliveryLocationName: string;
  deliveryLatitude: number;
  deliveryLongitude: number;
  pickupWindowStart: string;
  pickupWindowEnd: string;
  cutOffTime: string;
  maxDistanceKm: number; // Dmax (mặc định 40km)
  cargoType: string;
  baselinePickupCostVnd: number; // T_B (vd 3,400,000 VND)
  createdAt: string;
}

export interface MatchCandidate {
  offer: Offer;
  distanceKm: number; // d
  timeFeasible: boolean;
  scoreD: number; // 0..100
  scoreT: number; // 0..100
  scoreC: number; // 100 nếu GOOD, 60 nếu MINOR_DAMAGE
  scoreM: number; // 0.30D + 0.40T + 0.30C
  quote: Quote;
}

export interface Quote {
  id: string;
  tAVnd: number;       // 3,000,000
  tBVnd: number;       // 3,400,000
  fRuVnd: number;      // 1,200,000
  shareAlpha: number;  // 0.50
  truckingAbVnd: number; // 800,000
  extrasAVnd: number;
  extrasBVnd: number;
  rA0Vnd: number;      // alpha * F_RU + extras_A
  rB0Vnd: number;      // trucking_AB + (1-alpha)*F_RU + extras_B
  gAVnd: number;       // T_A - R_A0
  gBVnd: number;       // T_B - R_B0
  fAVnd: number;       // 0.25 * max(G_A, 0)
  fBVnd: number;       // 0.15 * max(G_B, 0)
  sAVnd: number;       // Net saving A: G_A - F_A
  sBVnd: number;       // Net saving B: G_B - F_B
  econtCollectedFromA: number; // Phí ECont thu hộ RU + Phí nền tảng A
  econtCollectedFromB: number; // Phí nền tảng B
}

export interface Transaction {
  id: string;
  offerId: string;
  requestId: string;
  assetId: string;
  companyAId: string;
  companyAName: string;
  companyBId: string;
  companyBName: string;
  asset: ContainerAsset;
  status: TransactionStatus;
  isOnHold: boolean;
  holdReason?: string;
  dueAt: string;
  nextAction: string;
  agreementVersion: number;
  companyAAcceptedAt?: string;
  companyBAcceptedAt?: string;
  handoverHash?: string;
  quote: Quote;
  carrierApproval?: CarrierApproval;
  paymentOrderA?: PaymentOrder;
  paymentOrderB?: PaymentOrder;
  dispatchPermit?: DispatchPermit;
  inspection?: Inspection;
  createdAt: string;
}

export interface CarrierApproval {
  id: string;
  transactionId: string;
  carrierCode: string;
  approvalReference: string; // Số văn bản RU của hãng tàu
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  opsReviewerName: string;
  evidenceFileName: string;
  evidenceFileUrl?: string;
  notes?: string;
  approvedAt: string;
  expiresAt: string;
}

export interface PaymentOrder {
  id: string;
  transactionId: string;
  companyId: string;
  companyName: string;
  payerRole: 'PARTY_A' | 'PARTY_B';
  amountVnd: number;
  status: 'PENDING' | 'SETTLED' | 'SUSPENSE' | 'REFUNDED';
  bankReference?: string;
  settledAt?: string;
  receiptUrl?: string;
}

export interface DispatchPermit {
  id: string;
  transactionId: string;
  permitNumber: string; // VD: ECONT-DP-20260916-0042
  verificationToken: string;
  driverName: string;
  truckPlate: string;
  validFrom: string;
  validUntil: string;
  status: 'ACTIVE' | 'USED' | 'REVOKED' | 'EXPIRED';
  issuedAt: string;
}

export interface Inspection {
  id: string;
  transactionId: string;
  inspectorName: string;
  checklistFloor: boolean;
  checklistWalls: boolean;
  checklistRoof: boolean;
  checklistDoors: boolean;
  checklistGaskets: boolean;
  checklistUndercarriage: boolean;
  isDiscrepancyFound: boolean;
  discrepancyNotes?: string;
  photos: string[];
  inspectedAt: string;
}

export interface CaseIssue {
  id: string;
  transactionId: string;
  openedByCompanyId: string;
  openedByCompanyName: string;
  caseType: 'DAMAGE_DISPUTE' | 'LATE_HANDOVER' | 'CARRIER_REJECTION' | 'PAYMENT_ISSUE';
  title: string;
  description: string;
  status: 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'CLOSED';
  resolutionSummary?: string;
  resolvedAt?: string;
  createdAt: string;
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  actorEmail: string;
  action: string;
  entityName: string;
  entityId: string;
  details: string;
}

