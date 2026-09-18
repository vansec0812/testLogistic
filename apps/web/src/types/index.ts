// ==============================================================================
// ECont Core TypeScript Types & Enums - Version 2.0
// Tuân thủ đầy đủ SRS v1.0, agent.md và plan.md §6.2
// ==============================================================================

export type UserRole =
  | 'ENTERPRISE_A'   // Đơn vị quản lý nguồn vỏ (Bên A)
  | 'ENTERPRISE_B'   // Đơn vị có nhu cầu (Bên B)
  | 'OPS'            // Vận hành nền tảng ECont
  | 'FINANCE'        // Tài chính & đối soát
  | 'SUPER_ADMIN';   // Quản trị hệ thống

// ISO 6346: chỉ 20GP và 40HC; alias 20DC->20GP, 40HQ->40HC qua mapping
export type ContainerType = '20GP' | '40HC';
export type CarrierCode = string;

// SRS §4.4: Tình trạng vật lý (physical status)
export type PhysicalStatus =
  | 'AT_CUSTOMER'      // Đang tại khách hàng/đang sử dụng
  | 'EMPTY_AT_YARD'    // Rỗng tại bãi (eligible cho Offer)
  | 'IN_TRANSIT'       // Đang trên đường vận chuyển
  | 'EMPTY_AT_DEPOT';  // Rỗng tại depot của hãng

// SRS §4.4: Tình trạng tình trạng vỏ
export type PhysicalCondition = 'GOOD' | 'MINOR_DAMAGE' | 'MAJOR_DAMAGE';

// SRS §4.4 + plan.md §6.2: Trạng thái Offer đầy đủ
export type OfferStatus =
  | 'AI_CHECK_PENDING'
  | 'DRAFT'              // Nháp, chưa gửi review
  | 'UNDER_REVIEW'       // Đã gửi, Ops đang xem xét
  | 'CHANGES_REQUIRED'   // Ops yêu cầu bổ sung/sửa đổi
  | 'REJECTED'           // Ops từ chối dứt khoát
  | 'AVAILABLE'          // Đã duyệt, đang hiển thị
  | 'HELD'               // Đang bị giữ chỗ (NEGOTIATING)
  | 'ALLOCATED'          // Đã phân bổ vào giao dịch chính thức
  | 'FULFILLED'          // Giao nhận hoàn tất, cont đã sang Bên B
  | 'WITHDRAWN'          // A chủ động rút tin
  | 'EXPIRED';           // Hết available_until hoặc hạn chứng từ

// SRS §4.4 + plan.md §6.2: Trạng thái Request đầy đủ
export type RequestStatus =
  | 'DRAFT'
  | 'UNDER_REVIEW'
  | 'CHANGES_REQUIRED'
  | 'REJECTED'
  | 'OPEN'               // Đã review, đang tìm matching
  | 'HELD'
  | 'ALLOCATED'
  | 'FULFILLED'
  | 'WITHDRAWN'
  | 'EXPIRED';

// SRS §4.4: Trạng thái giao dịch chính
export type TransactionStatus =
  | 'MATCH_REQUESTED'
  | 'MATCH_ACCEPTED'
  | 'NEGOTIATING'         // Bước 1: Giữ chỗ & thảo luận thỏa thuận
  | 'PENDING_CARRIER'     // Bước 2: Chờ hãng tàu duyệt RU
  | 'AWAITING_PAYMENT'    // Bước 3: Chờ nộp tiền & đối soát
  | 'READY_FOR_PICKUP'    // Bước 4: Phát phiếu điều phối
  | 'INSPECTION'          // Bước 5: Kiểm tra cont tại bãi A
  | 'HANDOVER_PENDING'    // Bước 6: Chờ 2 bên xác nhận bàn giao
  | 'COMPLETED'           // Bước 7: Hoàn tất giao nhận, custody A→B
  | 'DISPUTED'
  | 'PICKUP_REFUSED'
  | 'CARRIER_REJECTED'
  | 'PAYMENT_EXPIRED'
  | 'CANCELLED'           // Hủy giao dịch
  | 'REJECTED'            // Carrier từ chối RU
  | 'EXPIRED';            // Hết deadline tự động

// plan.md §6.2: CarrierApproval status
export type CarrierApprovalStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'NEEDS_INFO'
  | 'APPROVED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'REVOKED';

// plan.md §6.2: Payment order status
export type PaymentOrderStatus =
  | 'OPEN'
  | 'PARTIAL'
  | 'PAID'
  | 'EXPIRED'
  | 'CANCELLED';

// plan.md §6.2: Refund order status
export type RefundOrderStatus =
  | 'REQUESTED'
  | 'APPROVED'
  | 'REFUND_PENDING'
  | 'REFUNDED'
  | 'FAILED'
  | 'REJECTED';

// plan.md §6.2: Handover record status
export type HandoverRecordStatus =
  | 'DRAFT'
  | 'PENDING_CONFIRMATION'
  | 'COMPLETED'
  | 'SUPERSEDED';

// plan.md §6.2: Case status
export type CaseStatus =
  | 'OPEN'
  | 'IN_REVIEW'
  | 'NEEDS_INFO'
  | 'RESOLVED'
  | 'CLOSED';

// plan.md §6.2: Company verification status
export type CompanyStatus =
  | 'BLOCKED'
  | 'PENDING_VERIFICATION'
  | 'NEEDS_INFO'
  | 'VERIFIED'
  | 'REJECTED'
  | 'SUSPENDED';

// plan.md §6.2: Dispatch permit status
export type PermitStatus =
  | 'GENERATING'
  | 'ACTIVE'
  | 'USED'
  | 'EXPIRED'
  | 'REVOKED'
  | 'FAILED';

// plan.md §6.2: Document verification status
export type DocumentVerificationStatus =
  | 'UNVERIFIED'
  | 'NEEDS_INFO'
  | 'VERIFIED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'REVOKED'
  | 'SUPERSEDED';

export type AiInspectionStatus = 'NOT_RUN' | 'CLEAN' | 'ANOMALY' | 'ERROR' | 'OPS_VERIFIED' | 'OPS_REJECTED';

export interface AiInspectionResult {
  success: boolean;
  status: AiInspectionStatus;
  score?: number;
  condition?: PhysicalCondition;
  summary?: string;
  details?: string[];
  requiresOpsReview: boolean;
  error?: string;
}

export interface AssetAiInspection {
  status: AiInspectionStatus;
  score?: number;
  condition?: PhysicalCondition;
  summary: string;
  details: string[];
  requiresOpsReview: boolean;
  inspectedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  opsDecisionNotes?: string;
}

// Allocation state cho giữ chỗ
export type AllocationState = 'HELD' | 'ALLOCATED' | 'RELEASED';

// ==================== ENTITY INTERFACES ====================

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
  verificationStatus: CompanyStatus;
  verificationNotes?: string;
  verifiedAt?: string;
  trustScoreA?: number;  // 0..100 (Trust với vai Bên A)
  trustScoreB?: number;  // 0..100 (Trust với vai Bên B)
  totalCompletedAsA: number;
  totalCompletedAsB: number;
  isOnHold?: boolean;    // Tài khoản tạm dừng
}

export interface Carrier {
  id: string;
  code: string;    // MSK, CMA, ONE, EMC, COSCO
  name: string;
  defaultRuFeeVnd: number;
  ruPolicyNotes?: string;
  isActive: boolean;
}

export interface Depot {
  id: string;
  code: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  operatingHours: string;
  supportedCarriers: string[];  // Mảng carrier code
}

export interface ContainerAsset {
  id: string;
  containerNumber: string;     // ISO 6346 (MSKU8421093)
  containerType: ContainerType;
  carrierId: string;
  carrierCode: string;
  currentCustodianId: string;
  currentCustodianName: string;
  physicalStatus: PhysicalStatus;    // SRS §4.4
  declaredCondition: PhysicalCondition;    // Condition A khai báo
  reviewedCondition?: PhysicalCondition;   // Condition Ops xác nhận
  conditionNotes?: string;
  currentDepotReturnId?: string;
  currentDepotName?: string;
  currentLocationName: string;
  currentLatitude: number;
  currentLongitude: number;
  locationObservedAt: string;   // Thời điểm vị trí được cập nhật (UTC)
  locationVerifiedAt?: string;  // Thời điểm Ops xác nhận vị trí (UTC)
  freeTimeDetentionEnd?: string; // ISO UTC timestamp
  freeTimeSource?: string;       // Nguồn thông tin hạn
  photos: string[];              // URLs ảnh (ít nhất 6 góc cho Offer)
  edoEvidenceName?: string;
  aiInspection?: AssetAiInspection;
  hasEdoDocument: boolean;       // Đã có e-DO/hồ sơ tương đương
  edoVerificationStatus?: DocumentVerificationStatus;
  isLocked: boolean;             // Khóa khi đang có giao dịch HELD/ALLOCATED
  activeAllocationId?: string;   // ID reservation hiện tại nếu có
  createdAt: string;
  updatedAt: string;
}

export interface EvidenceFile {
  id: string;
  documentType: 'E_DO' | 'BOOKING' | 'RU_APPROVAL' | 'PAYMENT_RECEIPT' | 'INSPECTION_PHOTO' | 'HANDOVER_PHOTO' | 'EIR' | 'OTHER';
  objectKey: string;
  originalName: string;
  sha256?: string;
  mimeType: string;
  sizeBytes: number;
  scanStatus: 'PENDING' | 'CLEAN' | 'INFECTED' | 'ERROR';
  uploadedBy: string;
  uploadedAt: string;
  isPrivate: boolean;
  retentionClass?: string;
  legalHold?: boolean;
}

export interface OfferAiCheckResult {
  passed: boolean;
  score: number;
  summary: string;
  hasAnomaly: boolean;
  anomalyReason?: string;
  edoChecked?: boolean;
  edoValid?: boolean;
  edoAnomaly?: boolean;
  photoChecked?: boolean;
  photoCondition?: PhysicalCondition;
  photoConditionNotes?: string;
  verificationStatus?: 'VERIFIED' | 'MANUAL_REVIEW' | 'INVALID' | 'ERROR';
  details?: string[];
}

export interface Offer {
  id: string;
  assetId: string;
  asset: ContainerAsset;
  companyId: string;
  companyName: string;
  status: OfferStatus;
  version: number;                 // Row version chống stale write
  reviewerNotes?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  pickupLocationName: string;
  pickupLatitude: number;
  pickupLongitude: number;
  availableFrom: string;
  availableTo: string;
  expectedDepotId?: string;
  expectedDepotName?: string;
  baselineDepotCostVnd: number;    // T_A (chi phí baseline về depot)
  vehicleRequirements?: string;    // Yêu cầu xe vận chuyển
  photoUrls: string[];             // 6+ ảnh theo checklist
  photoChecklistComplete: boolean; // Đã đủ 6 góc ảnh
  edoDocumentIds: string[];        // IDs của e-DO/hồ sơ đính kèm
  edoFileName?: string;            // Tên file e-DO (chỉ Ops xem, không public cho B)
  edoNumber?: string;              // Số lệnh e-DO (chỉ Ops xem, không public cho B)
  conditionNotes?: string;         // Mô tả chi tiết tình trạng vỏ
  aiCheck?: OfferAiCheckResult;    // Kết quả AI OCR & AI Vision kiểm tra
  requiresOpsManualReview?: boolean; // Bất thường cần Ops kiểm tra thủ công
  withdrawReason?: string;
  changeReason?: string;           // Lý do sửa đổi
  createdAt: string;
  updatedAt: string;
}

export interface Booking {
  id: string;
  companyId: string;
  bookingNumber: string;
  carrierId: string;
  carrierCode: string;
  containerType: ContainerType;
  quantityTotal: number;            // Tổng số cont trong booking
  quantityUsed: number;             // Đã sử dụng (hold + allocated + fulfilled)
  cutOffTime: string;               // Deadline gửi hàng xuống tàu
  validUntil?: string;              // Booking hết hiệu lực
  status: 'ACTIVE' | 'CANCELLED' | 'EXPIRED' | 'FULFILLED';
  verificationStatus: DocumentVerificationStatus;
  verifiedBy?: string;
  verifiedAt?: string;
  createdAt: string;
}

export interface ContainerRequest {
  id: string;
  companyId: string;
  companyName: string;
  bookingId?: string;              // Liên kết Booking được xác minh
  carrierId: string;
  carrierCode: string;
  containerType: ContainerType;
  bookingNumber: string;           // Hiển thị UI (private trong Matching L0)
  status: RequestStatus;
  version: number;
  reviewerNotes?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  deliveryLocationName: string;
  deliveryLatitude: number;
  deliveryLongitude: number;
  pickupWindowStart: string;       // Sớm nhất bắt đầu kiểm tra tại A
  pickupWindowEnd: string;         // Muộn nhất bắt đầu
  cutOffTime: string;              // Cut-off booking (không phải ngày tàu)
  maxDistanceKm: number;           // Dmax (mặc định 40km)
  cargoType: string;               // Mô tả loại hàng
  cargoRequirements?: string;      // Sạch/khô/không mùi/tiêu chuẩn đặc biệt
  baselinePickupCostVnd: number;   // T_B (chi phí baseline lấy cont từ depot)
  withdrawReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatThread {
  id: string;
  companyAId: string;
  companyAName: string;
  companyBId: string;
  companyBName: string;
  offerId?: string;
  requestId?: string;
  transactionId?: string;
  contextLabel: string;
  contextType: 'PRE_BOOKING' | 'TRANSACTION' | 'CASE' | 'OPS_SUPPORT';
  containerNumber?: string;
  carrierCode?: string;
  containerType?: string;
  pickupLocationName?: string;
  isModerated?: boolean;
  moderationNote?: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt?: string;
  unreadCountA?: number;
  unreadCountB?: number;
}

export interface ChatMessage {
  id: string;
  clientId?: string;               // Dedup client-side ID
  threadId: string;
  senderCompanyId: string;
  senderCompanyName: string;
  senderRole: 'A' | 'B' | 'OPS';
  senderName: string;
  body: string;
  attachmentIds?: string[];
  isHidden?: boolean;             // Moderation ẩn, bản gốc vẫn lưu
  hiddenReason?: string;
  createdAt: string;
}

export interface MatchCandidate {
  offer: Offer;
  distanceKm: number;
  timeFeasible: boolean;
  locationAgeHours: number;        // Tuổi vị trí tính theo giờ
  requiresLocationRefresh: boolean; // >24h cần A xác nhận lại
  scoreD: number;                  // 0..100
  scoreT: number;                  // 0..100
  scoreC: number;                  // 100/60
  scoreM: number;                  // 0.30D + 0.40T + 0.30C
  quote: Quote;
  estimatedShippingMinutes?: number; // Thời gian vận chuyển ước tính
  trustScoreA?: number;              // Điểm uy tín Bên A
  hardConstraintReasons?: string[]; // Lý do loại nếu không pass
}

export type MatchStatus = 'POTENTIAL_MATCH' | 'MATCH_REQUESTED' | 'MATCH_ACCEPTED' | 'MATCH_REJECTED' | 'MATCH_EXPIRED';

export interface Match {
  id: string;
  offerId: string;
  requestId: string;
  assetId: string;
  companyAId: string;
  companyBId: string;
  scoreM: number;
  scoreD: number;
  scoreT: number;
  scoreC: number;
  quote: Quote;
  status: MatchStatus;
  requestedAt: string;
  expiresAt: string;
  respondedAt?: string;
  respondedBy?: string;
  responseReason?: string;
  transactionId?: string;
}

export interface Quote {
  id: string;
  version: number;
  snapshotAt: string;              // Thời điểm tạo quote
  tAVnd: number;                   // 3,000,000 - chi phí baseline A
  tBVnd: number;                   // 3,400,000 - chi phí baseline B
  fRuVnd: number;                  // 1,200,000 - phí RU hãng tàu
  shareAlpha: number;              // 0.50
  truckingAbVnd: number;           // 800,000 - cước xe A→B (B tự bố trí)
  extrasAVnd: number;
  extrasBVnd: number;
  rA0Vnd: number;                  // alpha * F_RU + extras_A
  rB0Vnd: number;                  // trucking_AB + (1-alpha)*F_RU + extras_B
  gAVnd: number;                   // T_A - R_A0 (tiết kiệm gộp A)
  gBVnd: number;                   // T_B - R_B0 (tiết kiệm gộp B)
  fAVnd: number;                   // 0.25 * max(G_A, 0) - phí nền tảng A
  fBVnd: number;                   // 0.15 * max(G_B, 0) - phí nền tảng B
  sAVnd: number;                   // G_A - F_A (tiết kiệm ròng A)
  sBVnd: number;                   // G_B - F_B (tiết kiệm ròng B)
  econtCollectedFromA: number;
  econtCollectedFromB: number;
  // Loại dữ liệu quote
  tAStatus: 'FIRM' | 'ESTIMATE' | 'MISSING';
  tBStatus: 'FIRM' | 'ESTIMATE' | 'MISSING';
  fRuStatus: 'FIRM' | 'ESTIMATE' | 'MISSING';
  truckingStatus: 'FIRM' | 'ESTIMATE' | 'MISSING';
  // Nếu saving âm
  negativeSavingA: boolean;
  negativeSavingB: boolean;
  savingRatioAvailable: boolean;   // False nếu T_A + T_B = 0
}

export interface Agreement {
  id: string;
  transactionId: string;
  version: number;
  contentHash: string;             // Hash của nội dung thỏa thuận
  createdAt: string;
  // Acceptance của từng bên
  companyAAcceptedAt?: string;
  companyAAcceptedBy?: string;     // actor ID/email
  companyACompanyId?: string;
  companyBAcceptedAt?: string;
  companyBAcceptedBy?: string;
  companyBCompanyId?: string;
  // Nếu bị supersede
  supersededAt?: string;
  supersededReason?: string;
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
  rowVersion: number;              // Chống stale write
  isOnHold: boolean;
  holdReason?: string;
  holdSetAt?: string;
  holdSetBy?: string;
  holdCaseId?: string;
  dueAt: string;                   // Deadline hiện tại (UTC)
  nextAction: string;
  allowedActions: string[];        // Các action được phép theo role hiện tại
  blockingReasons?: string[];      // Lý do bị chặn nếu có
  // Agreement lifecycle
  currentAgreementVersion: number;
  agreements: Agreement[];
  // Financial
  quote: Quote;
  paymentOrderA?: PaymentOrder;
  paymentOrderB?: PaymentOrder;
  externalObligations?: ExternalObligation[];
  // Carrier
  carrierSubmission?: CarrierSubmission;
  carrierApproval?: CarrierApproval;
  // Handover
  dispatchPermit?: DispatchPermit;
  inspection?: Inspection;
  handoverRecord?: HandoverRecord;
  // Metadata
  createdAt: string;
  updatedAt: string;
}

export interface CarrierSubmission {
  id: string;
  transactionId: string;
  submittedBy: string;             // Ops email
  submittedAt: string;
  carrierCode: string;
  referenceNumber?: string;
  notes?: string;
  evidenceFileIds: string[];
  status: 'SUBMITTED' | 'ACKNOWLEDGED' | 'PENDING_RESPONSE';
}

export interface CarrierApproval {
  id: string;
  transactionId: string;
  carrierCode: string;
  approvalReference: string;
  status: CarrierApprovalStatus;
  scope: {                         // Phạm vi RU (snapshot)
    containerNumber: string;
    bookingNumber: string;
    companyAId: string;
    companyBId: string;
    pickupPoint: string;
    deliveryPoint: string;
    validFrom: string;
    validUntil: string;
  };
  opsReviewerName: string;
  opsReviewerEmail: string;
  evidenceFileIds: string[];
  notes?: string;
  approvedAt?: string;
  expiresAt?: string;
  revokedAt?: string;
  revokeReason?: string;
}

export interface PaymentOrder {
  id: string;
  transactionId: string;
  companyId: string;
  companyName: string;
  payerRole: 'PARTY_A' | 'PARTY_B';
  amountVnd: number;
  status: PaymentOrderStatus;
  // Reconciliation
  paidAmountVnd?: number;
  partialPayments?: PaymentEvent[];
  bankReference?: string;
  settledAt?: string;
  settledBy?: string;
  // Suspense
  suspenseAmountVnd?: number;
  suspenseReason?: string;
  // Refund
  refundOrders?: RefundOrder[];
  expiresAt: string;
}

export interface PaymentEvent {
  id: string;
  paymentOrderId: string;
  providerId?: string;
  providerEventId?: string;        // Dedup
  amountVnd: number;
  currency: string;
  reference: string;
  receivedAt: string;
  reconciliationStatus: 'MATCHED' | 'SUSPENSE' | 'OVERPAID' | 'MISMATCH';
  notes?: string;
}

export interface ExternalObligation {
  id: string;
  transactionId: string;
  description: string;
  amountVnd?: number;
  collector: string;               // Bên nhận (hãng tàu, depot,...)
  payer: 'PARTY_A' | 'PARTY_B';
  status: 'PENDING' | 'SETTLED' | 'WAIVED';
  evidenceFileId?: string;
  notes?: string;
}

export interface RefundOrder {
  id: string;
  paymentOrderId: string;
  transactionId: string;
  requestedBy: string;
  requestedAt: string;
  amountVnd: number;
  reason: string;
  status: RefundOrderStatus;
  approvedBy?: string;
  approvedAt?: string;
  providerRef?: string;            // Stable reference cho provider
  settledAt?: string;
  failureReason?: string;
}

export interface DispatchPermit {
  id: string;
  transactionId: string;
  permitNumber: string;
  verificationToken: string;       // Random token cho QR
  driverName: string;
  truckPlate: string;
  driverIdNumber?: string;
  delegationBasis?: string;        // Cơ sở ủy quyền người nhận
  validFrom: string;
  validUntil: string;
  status: PermitStatus;
  generatedAt: string;
  pdfHash?: string;
  revokedAt?: string;
  revokeReason?: string;
}

export interface Inspection {
  id: string;
  transactionId: string;
  inspectorName: string;
  inspectorCompanyId: string;
  checklistFloor: boolean;
  checklistWalls: boolean;
  checklistRoof: boolean;
  checklistDoors: boolean;
  checklistGaskets: boolean;
  checklistUndercarriage: boolean;
  isDiscrepancyFound: boolean;
  discrepancyNotes?: string;
  discrepancySeverity?: 'MINOR' | 'MAJOR';
  photoIds: string[];
  inspectedAt: string;
  version: number;
  contentHash: string;
}

export interface HandoverRecord {
  id: string;
  transactionId: string;
  version: number;
  contentHash: string;             // Hash biên bản để 2 bên xác nhận cùng version
  status: HandoverRecordStatus;
  // Xác nhận Bên A (giao)
  confirmationA?: {
    confirmedAt: string;
    confirmedBy: string;           // Email/actor
    companyId: string;
    recordVersion: number;
    recordHash: string;
  };
  // Xác nhận Bên B (nhận)
  confirmationB?: {
    confirmedAt: string;
    confirmedBy: string;
    companyId: string;
    recordVersion: number;
    recordHash: string;
  };
  completedAt?: string;
  pdfGeneratedAt?: string;
  pdfHash?: string;
}

export interface CaseIssue {
  id: string;
  transactionId?: string;
  assetId?: string;
  openedByCompanyId: string;
  openedByCompanyName: string;
  assignedToOpsEmail?: string;
  caseType: 'CONDITION_MISMATCH' | 'NO_SHOW' | 'WRONG_CONTAINER' | 'LATE_HANDOVER' | 'DAMAGE_DISPUTE' | 'PAYMENT_ISSUE' | 'CARRIER_REJECTION' | 'DOCUMENT_FRAUD' | 'RU_SCOPE_MISMATCH' | 'OTHER';
  title: string;
  description: string;
  status: CaseStatus;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  evidenceFileIds?: string[];
  holdTransactionId?: string;     // Giao dịch bị ON_HOLD vì Case này
  resolution?: {
    summary: string;
    faultParty?: 'PARTY_A' | 'PARTY_B' | 'PLATFORM' | 'CARRIER' | 'NONE';
    resolvedBy: string;
    resolvedAt: string;
    refundProposal?: number;      // VND đề xuất hoàn
  };
  appealedAt?: string;
  appealReason?: string;
  closedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Rating {
  id: string;
  transactionId: string;
  ratedByCompanyId: string;
  ratedByRole: 'A' | 'B';
  ratedCompanyId: string;
  stars: 1 | 2 | 3 | 4 | 5;
  comment?: string;
  isPublic: boolean;               // False trong 7 ngày blind window
  submittedAt: string;
  windowExpiresAt: string;         // 7 ngày sau COMPLETED
}

export interface TrustSnapshot {
  id: string;
  companyId: string;
  role: 'A' | 'B';
  score: number;                   // 0..100
  sampleSize: number;              // Số giao dịch đủ dữ liệu
  isPublishable: boolean;          // False nếu sampleSize < ngưỡng
  calculatedAt: string;
  factors?: {
    completionRate: number;
    onTimeRate: number;
    ratingAvg: number;
    disputeRate: number;
  };
}

export interface AuditEvent {
  id: string;
  correlationId?: string;
  timestamp: string;               // UTC ISO8601
  actorEmail: string;
  actorCompanyId?: string;
  actorRole?: string;
  action: string;                  // Enum-like: HOLD_RESERVATION_CREATED, OFFER_APPROVED,...
  entityType: string;
  entityId: string;
  aggregateVersion?: number;
  details: string;
  requestId?: string;              // HTTP request ID
  ipAddress?: string;
}

export interface Notification {
  id: string;
  recipientCompanyId: string;
  recipientUserId?: string;
  type: 'TRANSACTION_UPDATE' | 'PAYMENT_REQUIRED' | 'DEADLINE_ALERT' | 'CASE_UPDATE' | 'RATING_REMINDER' | 'SYSTEM' | 'OPS_ALERT';
  title: string;
  body: string;
  relatedEntityId?: string;
  relatedEntityType?: string;
  isRead: boolean;
  createdAt: string;
  expiresAt?: string;
}

// ==================== HELPER TYPES ====================

export interface AllowedAction {
  action: string;
  label: string;
  requiresConfirmation?: boolean;
  confirmMessage?: string;
}

export interface PageState<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated?: string;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: {
    code: string;
    message: string;
    fieldErrors?: ValidationError[];
    correlationId?: string;
  };
}

// ==================== FORM TYPES ====================

export interface CreateAssetForm {
  containerNumber: string;
  containerType: ContainerType;
  carrierId: string;
  physicalStatus: PhysicalStatus;
  declaredCondition: PhysicalCondition;
  conditionNotes?: string;
  currentLocationName: string;
  currentLatitude: number;
  currentLongitude: number;
  currentDepotReturnId?: string;
  freeTimeDetentionEnd?: string;
  freeTimeSource?: string;
  photos?: string[];
  edoEvidenceName?: string;
  hasEdoDocument?: boolean;
  edoVerificationStatus?: DocumentVerificationStatus;
  aiInspection?: AssetAiInspection;
}

export interface CreateOfferForm {
  assetId?: string;
  // Container info (1 offer = 1 cont)
  containerNumber?: string;
  containerType?: ContainerType;
  carrierId?: string;
  declaredCondition?: PhysicalCondition;
  conditionNotes?: string;
  photos?: string[];

  // eDO info (1 offer = 1 file eDO, chỉ gửi Ops thẩm định; mã/depot là metadata tùy chọn)
  edoFileName?: string;
  edoNumber?: string;
  edoReturnDepot?: string;
  edoExpiryDate?: string;

  // Vị trí (Maps) & Thời gian bàn giao
  pickupLocationName: string;
  pickupLatitude: number;
  pickupLongitude: number;
  availableFrom: string;
  availableTo: string;
  expectedDepotId?: string;
  baselineDepotCostVnd: number;
  vehicleRequirements?: string;

  // AI & Ops check
  aiCheck?: OfferAiCheckResult;
  requiresOpsManualReview?: boolean;
}

export interface CreateRequestForm {
  carrierId: string;
  containerType: ContainerType;
  bookingNumber: string;
  deliveryLocationName: string;
  deliveryLatitude: number;
  deliveryLongitude: number;
  pickupWindowStart: string;
  pickupWindowEnd: string;
  cutOffTime: string;
  maxDistanceKm: number;
  cargoType?: string;
  cargoRequirements?: string;
  baselinePickupCostVnd: number;
}
