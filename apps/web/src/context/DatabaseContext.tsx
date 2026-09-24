// ==============================================================================
// ECont Database Context & Business Logic - Version 2.0
// State management với đầy đủ actions, guards và audit trail
// ==============================================================================

import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import {
  Company, ContainerAsset, Offer, ContainerRequest, Transaction, Agreement,
  CarrierApproval, PaymentOrder, DispatchPermit, Inspection, HandoverRecord,
  CaseIssue, AuditEvent, Notification, ChatThread, ChatMessage, MatchCandidate,
  Quote, CreateAssetForm, CreateOfferForm, CreateRequestForm, TransactionStatus, Match
} from '../types';
import {
  INITIAL_COMPANIES, INITIAL_ASSETS, INITIAL_OFFERS, INITIAL_REQUESTS,
  INITIAL_TRANSACTIONS, INITIAL_CASES, INITIAL_AUDIT_LOGS,
  INITIAL_NOTIFICATIONS, INITIAL_CHAT_THREADS, INITIAL_CHAT_MESSAGES,
  INITIAL_CARRIERS, DEMO_DATASET_VERSION,
} from '../data/mockData';
import { canTransitionTo, getAllowedActions } from '../services/stateMachine';
import { calculateQuote } from '../services/pricingEngine';
import { validateContainerNumber } from '../services/iso6346';
import { onlineDb, OnlineDbConfig } from '../services/onlineDbClient';
import { useAuth } from './AuthContext';
import {
  CARRIER_TIMEOUT_MS,
  MATCH_EXPIRY_MS,
  PAYMENT_DEADLINE_MS,
  QA_RULES,
  DEFAULT_BASELINE_DEPOT_COST_VND,
  DEFAULT_BASELINE_PICKUP_COST_VND,
  hasRequiredOfferPhotos,
  isWithinDisputeWindow,
} from '../services/qaRules';
import { inferNotificationEntityType } from '../services/notificationRouting';

// ==================== CONTEXT TYPE ====================

interface ActionResult {
  success: boolean;
  message: string;
  data?: unknown;
}

interface DatabaseContextType {
  companies: Company[];
  assets: ContainerAsset[];
  offers: Offer[];
  requests: ContainerRequest[];
  transactions: Transaction[];
  cases: CaseIssue[];
  auditLogs: AuditEvent[];
  notifications: Notification[];
  chatThreads: ChatThread[];
  chatMessages: ChatMessage[];
  matches: Match[];

  // Asset actions
  addAsset: (form: CreateAssetForm) => ActionResult;
  updateAsset: (assetId: string, updates: Partial<ContainerAsset>) => ActionResult;
  deleteAsset: (assetId: string) => ActionResult;
  opsReviewAsset: (assetId: string, decision: 'APPROVE' | 'REJECT', notes: string) => ActionResult;

  // Offer actions
  addOffer: (form: CreateOfferForm) => ActionResult;
  updateOffer: (offerId: string, updates: Partial<Offer>) => ActionResult;
  submitOfferForReview: (offerId: string) => ActionResult;
  withdrawOffer: (offerId: string, reason: string) => ActionResult;
  deleteOffer: (offerId: string) => ActionResult;
  opsReviewOffer: (offerId: string, decision: 'APPROVE' | 'REQUEST_CHANGES' | 'REJECT', notes: string) => ActionResult;

  // Request actions
  addRequest: (form: CreateRequestForm) => ActionResult;
  updateRequest: (requestId: string, updates: Partial<ContainerRequest>) => ActionResult;
  submitRequestForReview: (requestId: string) => ActionResult;
  withdrawRequest: (requestId: string, reason: string) => ActionResult;
  deleteRequest: (requestId: string) => ActionResult;
  opsReviewRequest: (requestId: string, decision: 'APPROVE' | 'REQUEST_CHANGES' | 'REJECT', notes: string) => ActionResult;

  // Company actions
  addCompany: (comp: Omit<Company, 'id' | 'totalCompletedAsA' | 'totalCompletedAsB'>) => ActionResult;
  submitCompanyRegistration: (comp: Omit<Company, 'id' | 'totalCompletedAsA' | 'totalCompletedAsB'>) => ActionResult;
  updateCompany: (id: string, updates: Partial<Company>) => ActionResult;
  deleteCompany: (id: string) => ActionResult;

  // Reservation & Transaction
  holdAtomicReservation: (candidate: MatchCandidate, request: ContainerRequest) => ActionResult;
  acceptMatch: (matchId: string) => ActionResult;
  rejectMatch: (matchId: string, reason: string) => ActionResult;
  acceptAgreement: (transactionId: string) => ActionResult;
  requestAgreementChange: (transactionId: string, reason: string) => ActionResult;
  
  // Carrier
  opsApproveCarrier: (transactionId: string, refNumber: string, evidenceFileName: string, validUntil: string) => ActionResult;
  opsRejectCarrier: (transactionId: string, reason: string) => ActionResult;

  // Payment
  submitPayment: (transactionId: string, party: 'A' | 'B', bankRef: string, amount: number) => ActionResult;
  settlePayment: (transactionId: string, party: 'A' | 'B', bankRef: string, amount: number) => ActionResult;
  opsConfirmPayments: (transactionId: string, note?: string) => ActionResult;

  // Handover
  generateDispatchPermit: (transactionId: string, driverName: string, truckPlate: string) => ActionResult;
  activateInspection: (transactionId: string) => ActionResult;
  submitInspection: (transactionId: string, data: {
    inspectorName: string;
    checklistFloor: boolean;
    checklistWalls: boolean;
    checklistRoof: boolean;
    checklistDoors: boolean;
    checklistGaskets: boolean;
    checklistUndercarriage: boolean;
    isDiscrepancyFound: boolean;
    discrepancyNotes?: string;
    discrepancySeverity?: 'MINOR' | 'MAJOR';
  }) => ActionResult;
  confirmHandoverA: (transactionId: string) => ActionResult;
  confirmHandoverB: (transactionId: string) => ActionResult;

  // Hold & Case
  toggleHold: (transactionId: string, isOnHold: boolean, reason?: string, caseId?: string) => ActionResult;
  addCase: (c: Omit<CaseIssue, 'id' | 'createdAt' | 'updatedAt'>) => ActionResult;
  updateCase: (caseId: string, updates: Partial<CaseIssue>) => ActionResult;
  deleteCase: (caseId: string) => ActionResult;
  resolveCase: (caseId: string, resolution: NonNullable<CaseIssue['resolution']>) => ActionResult;
  closeCase: (caseId: string) => ActionResult;

  // Cancel
  cancelTransaction: (transactionId: string, reason: string) => ActionResult;

  // Chat
  startChatThread: (thread: Omit<ChatThread, 'id' | 'createdAt' | 'updatedAt'>) => string | null;
  sendChatMessage: (threadId: string, body: string) => ActionResult;
  markChatThreadRead: (threadId: string) => void;

  // Notifications
  myNotifications: Notification[];
  markNotificationRead: (notifId: string) => void;
  markAllNotificationsRead: () => void;
  deleteNotification: (notifId: string) => void;
  unreadNotificationCount: number;

  // Demo utilities
  resetToDemoData: () => void;

  // Online Database & Sync
  onlineConfig: OnlineDbConfig;
  isSyncing: boolean;
  lastSyncMessage: string;
  syncAllToOnlineDb: () => Promise<void>;
  updateOnlineConfig: (config: Partial<OnlineDbConfig>) => void;
}

const DatabaseContext = createContext<DatabaseContextType | undefined>(undefined);

// ==================== HELPERS ====================

let idCounter = 1000;
const genId = (prefix: string) => `${prefix}-${++idCounter}`;
const DEMO_DATA_VERSION_STORAGE_KEY = 'econt_demo_dataset_version';

// ==================== PROVIDER ====================

export const DatabaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentRole, currentCompany, currentUserEmail, currentUserId } = useAuth();

  // State
  const [companies, setCompanies] = useState<Company[]>(() => {
    try { return JSON.parse(localStorage.getItem('econt_v2_companies') || '') || INITIAL_COMPANIES; }
    catch { return INITIAL_COMPANIES; }
  });
  const persistCompanies = useCallback((data: Company[]) => {
    setCompanies(data);
    try { localStorage.setItem('econt_v2_companies', JSON.stringify(data)); } catch { /* ok */ }
  }, []);
  const [assets, setAssets] = useState<ContainerAsset[]>(() => {
    try { return JSON.parse(localStorage.getItem('econt_v2_assets') || '') || INITIAL_ASSETS; }
    catch { return INITIAL_ASSETS; }
  });
  const [offers, setOffers] = useState<Offer[]>(() => {
    try { return JSON.parse(localStorage.getItem('econt_v2_offers') || '') || INITIAL_OFFERS; }
    catch { return INITIAL_OFFERS; }
  });
  const [requests, setRequests] = useState<ContainerRequest[]>(() => {
    try { return JSON.parse(localStorage.getItem('econt_v2_requests') || '') || INITIAL_REQUESTS; }
    catch { return INITIAL_REQUESTS; }
  });
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    try { return JSON.parse(localStorage.getItem('econt_v2_transactions') || '') || INITIAL_TRANSACTIONS; }
    catch { return INITIAL_TRANSACTIONS; }
  });
  const [cases, setCases] = useState<CaseIssue[]>(INITIAL_CASES);
  const [auditLogs, setAuditLogs] = useState<AuditEvent[]>(INITIAL_AUDIT_LOGS);
  const [notifications, setNotifications] = useState<Notification[]>(() => {
    try {
      const stored = localStorage.getItem('econt_notifications_v2');
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.error(e);
    }
    return INITIAL_NOTIFICATIONS;
  });
  const [chatThreads, setChatThreads] = useState<ChatThread[]>(INITIAL_CHAT_THREADS);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(INITIAL_CHAT_MESSAGES);
  const [matches, setMatches] = useState<Match[]>(() => {
    try { return JSON.parse(localStorage.getItem('econt_v2_matches') || '[]') || []; }
    catch { return []; }
  });
  const [onlineConfig, setOnlineConfig] = useState<OnlineDbConfig>(() => onlineDb.getConfig());
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncMessage, setLastSyncMessage] = useState<string>('Sẵn sàng đồng bộ trực tuyến');

  // Đồng bộ notification giữa các tab/role đang mở trên cùng trình duyệt.
  useEffect(() => {
    const handleNotificationStorage = (event: StorageEvent) => {
      if (event.key !== 'econt_notifications_v2' || !event.newValue) return;
      try {
        const next = JSON.parse(event.newValue);
        if (Array.isArray(next)) setNotifications(next);
      } catch {
        // Bỏ qua dữ liệu notification hỏng; tab hiện tại vẫn giữ state an toàn.
      }
    };
    window.addEventListener('storage', handleNotificationStorage);
    return () => window.removeEventListener('storage', handleNotificationStorage);
  }, []);

  const updateOnlineConfig = useCallback((cfg: Partial<OnlineDbConfig>) => {
    onlineDb.saveConfig(cfg);
    setOnlineConfig(onlineDb.getConfig());
  }, []);

  const syncAllToOnlineDb = useCallback(async () => {
    setIsSyncing(true);
    setLastSyncMessage('Đang đồng bộ dữ liệu...');
    try {
      await onlineDb.syncTable('companies', companies);
      await onlineDb.syncTable('container_assets', assets);
      await onlineDb.syncTable('offers', offers);
      await onlineDb.syncTable('container_requests', requests);
      await onlineDb.syncTable('transactions', transactions);
      await onlineDb.syncTable('matches', matches);
      await onlineDb.syncTable('cases', cases);
      await onlineDb.syncTable('audit_events', auditLogs);
      setLastSyncMessage('Đồng bộ thành công lên Supabase Cloud');
    } catch (e: unknown) {
      const err = e as Error;
      setLastSyncMessage('Lỗi đồng bộ: ' + (err?.message || 'Không xác định'));
    } finally {
      setIsSyncing(false);
    }
  }, [companies, assets, offers, requests, transactions, matches, cases, auditLogs]);

  // Persist key data
  const persistAssets = useCallback((data: ContainerAsset[]) => {
    setAssets(data);
    try { localStorage.setItem('econt_v2_assets', JSON.stringify(data)); } catch { /* ok */ }
  }, []);
  const persistOffers = useCallback((data: Offer[]) => {
    setOffers(data);
    try { localStorage.setItem('econt_v2_offers', JSON.stringify(data)); } catch { /* ok */ }
  }, []);
  const persistRequests = useCallback((data: ContainerRequest[]) => {
    setRequests(data);
    try { localStorage.setItem('econt_v2_requests', JSON.stringify(data)); } catch { /* ok */ }
  }, []);
  const persistTransactions = useCallback((data: Transaction[]) => {
    setTransactions(data);
    try { localStorage.setItem('econt_v2_transactions', JSON.stringify(data)); } catch { /* ok */ }
  }, []);
  const persistMatches = useCallback((data: Match[]) => {
    setMatches(data);
    try { localStorage.setItem('econt_v2_matches', JSON.stringify(data)); } catch { /* demo storage may be unavailable */ }
  }, []);

  // Worker demo: các deadline QA phải tự chuyển trạng thái ngay cả khi user
  // không reload trang. Production sẽ chuyển logic này sang worker/DB job.
  useEffect(() => {
    const expire = () => {
      const now = Date.now();
      const nextOffers = offers.map(offer =>
        offer.status === 'AVAILABLE' && now > new Date(offer.availableTo).getTime()
          ? { ...offer, status: 'EXPIRED' as const, updatedAt: new Date().toISOString() }
          : offer,
      );
      if (nextOffers.some((offer, index) => offer.status !== offers[index].status)) persistOffers(nextOffers);

      const nextRequests = requests.map(request =>
        request.status === 'OPEN' && now > new Date(request.pickupWindowEnd).getTime()
          ? { ...request, status: 'EXPIRED' as const, updatedAt: new Date().toISOString() }
          : request,
      );
      if (nextRequests.some((request, index) => request.status !== requests[index].status)) persistRequests(nextRequests);

      const nextMatches = matches.map(match =>
        ['MATCH_REQUESTED', 'POTENTIAL_MATCH'].includes(match.status) && now > new Date(match.expiresAt).getTime()
          ? { ...match, status: 'MATCH_EXPIRED' as const }
          : match,
      );
      if (nextMatches.some((match, index) => match.status !== matches[index].status)) persistMatches(nextMatches);

      const nextTransactions = transactions.map(txn => {
        if (['COMPLETED', 'CANCELLED', 'REJECTED', 'EXPIRED', 'DISPUTED'].includes(txn.status)) return txn;
        if (now <= new Date(txn.dueAt).getTime()) return txn;
        const expiredStatus = txn.status === 'AWAITING_PAYMENT' ? 'PAYMENT_EXPIRED' : 'EXPIRED';
        return { ...txn, status: expiredStatus as TransactionStatus, nextAction: 'Deadline đã hết; giao dịch bị đóng theo rule QA.', updatedAt: new Date().toISOString() };
      });
      if (nextTransactions.some((txn, index) => txn.status !== transactions[index].status)) persistTransactions(nextTransactions);
    };
    expire();
    const timer = window.setInterval(expire, 60_000);
    return () => window.clearInterval(timer);
  }, [offers, requests, matches, transactions, persistOffers, persistRequests, persistMatches, persistTransactions]);

  // Audit log helper
  const addAudit = useCallback((action: string, entityType: string, entityId: string, details: string) => {
    const event: AuditEvent = {
      id: genId('AUD'),
      correlationId: genId('corr'),
      timestamp: new Date().toISOString(),
      actorEmail: currentUserEmail,
      actorCompanyId: currentCompany.id,
      actorRole: currentRole,
      action,
      entityType,
      entityId,
      details,
      requestId: genId('req'),
    };
    setAuditLogs(prev => [event, ...prev]);
  }, [currentRole, currentCompany.id, currentUserEmail]);

  // Notification helper
  const persistNotifications = useCallback((newNotifs: Notification[]) => {
    setNotifications(newNotifs);
    try {
      localStorage.setItem('econt_notifications_v2', JSON.stringify(newNotifs));
    } catch (e) {
      console.error(e);
    }
  }, []);

  const addNotification = useCallback((
    recipientCompanyId: string,
    type: Notification['type'],
    title: string,
    body: string,
    relatedEntityId?: string
  ) => {
    const notif: Notification = {
      id: genId('NOTIF'),
      recipientCompanyId,
      type,
      title,
      body,
      relatedEntityId,
      relatedEntityType: inferNotificationEntityType(relatedEntityId),
      isRead: false,
      createdAt: new Date().toISOString(),
    };
    setNotifications(prev => {
      const updated = [notif, ...prev];
      try {
        localStorage.setItem('econt_notifications_v2', JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return updated;
    });
  }, []);

  const myNotifications = useMemo(() => {
    const allowedRecipients = currentRole === 'ENTERPRISE_BOTH'
      ? new Set([currentCompany.id, 'COMP-A01', 'COMP-B01', 'ALL'])
      : currentRole === 'OPS'
        ? new Set([currentCompany.id, 'COMP-OPS', 'OPS', 'ALL'])
        : new Set([currentCompany.id, 'ALL']);

    return notifications
      .filter(n => allowedRecipients.has(n.recipientCompanyId))
      .sort((a, b) => {
        const createdAtA = new Date(a.createdAt || 0).getTime() || 0;
        const createdAtB = new Date(b.createdAt || 0).getTime() || 0;
        return createdAtB - createdAtA;
      });
  }, [notifications, currentRole, currentCompany.id]);

  const unreadNotificationCount = useMemo(() => {
    return myNotifications.filter(n => !n.isRead).length;
  }, [myNotifications]);

  // ==================== ASSET ACTIONS ====================

  const addAsset = useCallback((form: CreateAssetForm): ActionResult => {
    if (currentRole !== 'ENTERPRISE_A' && currentRole !== 'ENTERPRISE_BOTH') {
      return { success: false, message: 'Chỉ Nhà cung cấp Container mới có thể đăng ký tài sản container.' };
    }
    // Kiểm tra trùng số cont
    const containerValidation = validateContainerNumber(form.containerNumber);
    if (!form.currentLocationName?.trim()) return { success: false, message: 'Vị trí hiện tại của container là bắt buộc.' };
    if (!containerValidation.isValid) return { success: false, message: containerValidation.message || 'Sá»‘ container khÃ´ng há»£p lá»‡ ISO 6346.' };
    if (!form.photos || form.photos.length < QA_RULES.offer.minPhotoCount) {
      return { success: false, message: `Pháº£i táº£i Ä‘á»§ ${QA_RULES.offer.minPhotoCount} áº£nh container trÆ°á»›c khi Ä‘Äƒng kÃ½.` };
    }
    if (!form.hasEdoDocument || !form.edoEvidenceName) {
      return { success: false, message: 'Pháº£i Ä‘Ã­nh kÃ¨m e-DO/há»“ sÆ¡ tÆ°Æ¡ng Ä‘Æ°Æ¡ng trÆ°á»›c khi Ä‘Äƒng kÃ½.' };
    }
    if (!form.aiInspection || form.aiInspection.status === 'ERROR') {
      return { success: false, message: 'Pháº£i hoÃ n táº¥t kiá»ƒm tra AI áº£nh container trÆ°á»›c khi lÆ°u.' };
    }
    const exists = assets.find(a => a.containerNumber === form.containerNumber.toUpperCase());
    if (exists) {
      return { success: false, message: `Số container ${form.containerNumber} đã tồn tại trong hệ thống.` };
    }
    const carrier = INITIAL_CARRIERS.find(c => c.id === form.carrierId);
    const newAsset: ContainerAsset = {
      ...form,
      id: genId('ASSET'),
      containerNumber: form.containerNumber.toUpperCase(),
      carrierCode: carrier?.code || (form.carrierId ? form.carrierId.replace('CARR-', '') : 'UNKNOWN'),
      currentCustodianId: currentCompany.id,
      currentCustodianName: currentCompany.shortName,
      reviewedCondition: undefined,
      photos: form.photos || [],
      aiInspection: form.aiInspection,
      hasEdoDocument: Boolean(form.hasEdoDocument),
      edoVerificationStatus: form.edoVerificationStatus || 'UNVERIFIED',
      isLocked: false,
      locationObservedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    persistAssets([...assets, newAsset]);
    addAudit('ASSET_CREATED', 'ContainerAsset', newAsset.id, `Đăng ký container ${newAsset.containerNumber}`);
    return { success: true, message: `Đã đăng ký container ${newAsset.containerNumber} thành công.`, data: newAsset };
  }, [assets, currentRole, currentCompany, persistAssets, addAudit]);

  const opsReviewAsset = useCallback((assetId: string, decision: 'APPROVE' | 'REJECT', notes: string): ActionResult => {
    if (currentRole !== 'OPS') {
      return { success: false, message: 'Chỉ Ops mới có thể kết luận kiểm tra ảnh.' };
    }
    if (!notes.trim()) return { success: false, message: 'Cần ghi chú kết luận kiểm tra ảnh.' };
    const asset = assets.find(a => a.id === assetId);
    if (!asset) return { success: false, message: 'Không tìm thấy container.' };
    if (!asset.aiInspection?.requiresOpsReview && !(asset.hasEdoDocument && asset.edoVerificationStatus !== 'VERIFIED')) {
      return { success: false, message: 'Container này không có yêu cầu Ops kiểm tra thủ công.' };
    }
    const now = new Date().toISOString();
    const updatedAsset: ContainerAsset = {
      ...asset,
      aiInspection: {
        ...asset.aiInspection,
        summary: asset.aiInspection?.summary || 'Ops kiểm tra thủ công hồ sơ e-DO/container.',
        details: asset.aiInspection?.details || [],
        requiresOpsReview: true,
        inspectedAt: asset.aiInspection?.inspectedAt || now,
        status: decision === 'APPROVE' ? 'OPS_VERIFIED' : 'OPS_REJECTED',
        reviewedBy: currentUserEmail,
        reviewedAt: now,
        opsDecisionNotes: notes.trim(),
      },
       reviewedCondition: decision === 'APPROVE' ? (asset.aiInspection?.condition || asset.declaredCondition) : undefined,
       edoVerificationStatus: asset.hasEdoDocument
         ? (decision === 'APPROVE' ? 'VERIFIED' : 'REJECTED')
         : asset.edoVerificationStatus,
      updatedAt: now,
    };
    persistAssets(assets.map(a => a.id === assetId ? updatedAsset : a));
    addAudit('ASSET_AI_OPS_REVIEWED', 'ContainerAsset', assetId, `Ops ${decision === 'APPROVE' ? 'xác nhận' : 'từ chối'} kết quả kiểm tra ảnh: ${notes}`);
    addNotification(asset.currentCustodianId, 'OPS_ALERT', `Kết quả kiểm tra ảnh ${asset.containerNumber}`, decision === 'APPROVE' ? 'Ops đã xác nhận container đủ điều kiện tiếp tục.' : 'Ops từ chối kết quả; vui lòng bổ sung ảnh hoặc xử lý tình trạng container.', assetId);
    return { success: true, message: decision === 'APPROVE' ? 'Ops đã xác nhận kết quả kiểm tra ảnh.' : 'Ops đã từ chối kết quả kiểm tra ảnh.' };
  }, [assets, currentRole, currentUserEmail, persistAssets, addAudit, addNotification]);

  const updateAsset = useCallback((assetId: string, updates: Partial<ContainerAsset>): ActionResult => {
    const asset = assets.find(a => a.id === assetId);
    if (!asset) return { success: false, message: 'Không tìm thấy container.' };
    if (asset.isLocked) return { success: false, message: 'Container đang trong giao dịch, không thể chỉnh sửa.' };
    if (asset.currentCustodianId !== currentCompany.id && currentRole !== 'OPS') {
      return { success: false, message: 'Bạn không có quyền chỉnh sửa container này.' };
    }
    const updated = { ...asset, ...updates, updatedAt: new Date().toISOString() };
    persistAssets(assets.map(a => a.id === assetId ? updated : a));
    addAudit('ASSET_UPDATED', 'ContainerAsset', assetId, `Cập nhật thông tin container ${asset.containerNumber}`);
    return { success: true, message: 'Đã cập nhật thông tin container.' };
  }, [assets, currentRole, currentCompany, persistAssets, addAudit]);

  const deleteAsset = useCallback((assetId: string): ActionResult => {
    const asset = assets.find(a => a.id === assetId);
    if (!asset) return { success: false, message: 'Không tìm thấy container.' };
    if (asset.isLocked) return { success: false, message: 'Container đang trong giao dịch, không thể xóa.' };
    if (asset.currentCustodianId !== currentCompany.id) {
      return { success: false, message: 'Bạn không có quyền xóa container này.' };
    }
    const hasOffer = offers.some(o => o.assetId === assetId && ['UNDER_REVIEW', 'AVAILABLE', 'HELD', 'ALLOCATED'].includes(o.status));
    if (hasOffer) {
      return { success: false, message: 'Container đang có Offer hoạt động. Hãy rút tin trước khi xóa.' };
    }
    persistAssets(assets.filter(a => a.id !== assetId));
    addAudit('ASSET_DELETED', 'ContainerAsset', assetId, `Xóa container ${asset.containerNumber} (nháp)`);
    return { success: true, message: `Đã xóa container ${asset.containerNumber}.` };
  }, [assets, offers, currentCompany, persistAssets, addAudit]);

  // ==================== OFFER ACTIONS ====================

  const addOffer = useCallback((form: CreateOfferForm): ActionResult => {
    if (currentRole !== 'ENTERPRISE_A' && currentRole !== 'ENTERPRISE_BOTH') {
      return { success: false, message: 'Chỉ Nhà cung cấp Container mới có thể tạo Offer nguồn vỏ.' };
    }
    const ownerCompany = companies.find(c => c.id === currentCompany.id) || currentCompany;
    if (ownerCompany.verificationStatus !== 'VERIFIED') {
      return { success: false, message: 'Doanh nghiệp chưa được Ops xác minh. Chưa thể tạo Offer.' };
    }
    if (!form.pickupLocationName?.trim()) {
      return { success: false, message: 'Địa điểm lấy cont là bắt buộc.' };
    }
    if (!form.containerNumber?.trim()) {
      return { success: false, message: 'Số container là bắt buộc để tạo đúng 1 Offer = 1 Cont.' };
    }
    if (!form.containerType || !form.carrierId || !form.declaredCondition) {
      return { success: false, message: 'Offer phải có loại container, hãng tàu và tình trạng khai báo.' };
    }
    if (!form.conditionNotes?.trim()) {
      return { success: false, message: 'Mô tả chi tiết tình trạng vỏ là bắt buộc.' };
    }
    if (!form.availableFrom || !form.availableTo || new Date(form.availableTo).getTime() <= new Date(form.availableFrom).getTime()) {
      return { success: false, message: 'Khung thời gian sẵn sàng không hợp lệ.' };
    }
    const baselineDepotCostVnd = Number(form.baselineDepotCostVnd ?? DEFAULT_BASELINE_DEPOT_COST_VND);
    if (!Number.isFinite(baselineDepotCostVnd) || baselineDepotCostVnd <= 0) {
      return { success: false, message: 'Chi phí nội bộ cấu hình cho Offer không hợp lệ.' };
    }
    const photos = form.photos || [];
    if (photos.length < 6) {
      return { success: false, message: 'Offer phải có tối thiểu 6 ảnh container.' };
    }
    if (!form.edoFileName?.trim()) {
      return { success: false, message: 'Mỗi Offer phải gắn đúng một file eDO/Booking để Ops xác minh.' };
    }
    // AI chỉ là tín hiệu hỗ trợ. Nếu AI chưa có kết quả, lỗi hoặc phát hiện
    // bất thường thì vẫn gửi hồ sơ để Ops kiểm tra và quyết định thủ công.
    const needsOpsManualReview = !form.aiCheck
      || !form.aiCheck.edoChecked
      || !form.aiCheck.photoChecked
      || !form.aiCheck.passed
      || form.aiCheck.verificationStatus !== 'VERIFIED';
    // Khi eDO và toàn bộ ảnh đều đã được AI xác minh hợp lệ, không tạo thêm
    // hàng đợi Ops. Bất kỳ thiếu kết quả, lỗi kết nối hoặc dấu hiệu lệch nào
    // đều phải chuyển sang UNDER_REVIEW để Ops xem ảnh và kết luận thủ công.
    const shouldAutoApprove = !needsOpsManualReview && form.requiresOpsManualReview !== true;

    let targetAsset = form.assetId ? assets.find(a => a.id === form.assetId) : undefined;

    // Nếu không có assetId nhưng có containerNumber -> tìm hoặc tạo mới ContainerAsset
    if (!targetAsset && form.containerNumber?.trim()) {
      const cleanContNum = form.containerNumber.trim().toUpperCase();
      targetAsset = assets.find(a => a.containerNumber === cleanContNum);
      if (!targetAsset) {
        const carrier = INITIAL_CARRIERS.find(c => c.id === form.carrierId);
        targetAsset = {
          id: genId('ASSET'),
          containerNumber: cleanContNum,
          containerType: form.containerType || '40HC',
          carrierId: form.carrierId || 'CARR-MSK',
          carrierCode: carrier?.code || (form.carrierId ? form.carrierId.replace('CARR-', '') : 'MAERSK'),
          currentCustodianId: currentCompany.id,
          currentCustodianName: currentCompany.shortName,
          physicalStatus: 'EMPTY_AT_YARD',
          declaredCondition: form.declaredCondition || 'GOOD',
          conditionNotes: form.conditionNotes || '',
          currentLocationName: form.pickupLocationName.trim(),
          currentLatitude: form.pickupLatitude || 10.78,
          currentLongitude: form.pickupLongitude || 106.78,
          locationObservedAt: new Date().toISOString(),
          photos,
          hasEdoDocument: true,
          edoEvidenceName: form.edoFileName.trim(),
          edoVerificationStatus: 'UNVERIFIED',
          isLocked: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        persistAssets([...assets, targetAsset]);
      }
    }

    if (!targetAsset) {
      return { success: false, message: 'Vui lòng nhập số Container hoặc chọn container có sẵn.' };
    }

    if (targetAsset.currentCustodianId !== currentCompany.id) {
      return { success: false, message: 'Container này không thuộc quyền quản lý của bạn.' };
    }

    const existingOffer = offers.find(
      o => o.assetId === targetAsset!.id && ['DRAFT', 'UNDER_REVIEW', 'AVAILABLE', 'HELD', 'ALLOCATED'].includes(o.status)
    );
    if (existingOffer) {
      return { success: false, message: `Container ${targetAsset.containerNumber} đã có Offer (${existingOffer.id}) đang hoạt động.` };
    }

    const offerPhotos = photos.length > 0 ? photos : targetAsset.photos;
    if (offerPhotos.length < 6) {
      return { success: false, message: 'Offer phải có tối thiểu 6 ảnh container.' };
    }

    const newOffer: Offer = {
      id: genId('OFR'),
      assetId: targetAsset.id,
      asset: {
        ...targetAsset,
        photos: offerPhotos,
        declaredCondition: form.declaredCondition || targetAsset.declaredCondition,
      },
      companyId: currentCompany.id,
      companyName: ownerCompany.shortName,
      status: shouldAutoApprove ? 'AVAILABLE' : 'UNDER_REVIEW',
      version: 1,
      ...(shouldAutoApprove ? {
        reviewerNotes: 'Tự động duyệt: eDO hợp lệ và bộ ảnh container khớp thông tin đăng ký.',
        reviewedBy: 'AI/QA tự động',
        reviewedAt: new Date().toISOString(),
      } : {}),
      pickupLocationName: form.pickupLocationName.trim(),
      pickupLatitude: form.pickupLatitude,
      pickupLongitude: form.pickupLongitude,
      availableFrom: form.availableFrom,
      availableTo: form.availableTo,
      expectedDepotId: form.expectedDepotId,
      expectedDepotName: undefined,
      baselineDepotCostVnd,
      vehicleRequirements: form.vehicleRequirements,
      photoUrls: offerPhotos,
      photoChecklistComplete: offerPhotos.length >= 6,
      edoDocumentIds: [form.edoFileName.trim()],
      edoFileName: form.edoFileName.trim(),
      edoNumber: form.edoNumber?.trim() || undefined,
      conditionNotes: form.conditionNotes?.trim() || targetAsset.conditionNotes || '',
      aiCheck: form.aiCheck,
      requiresOpsManualReview: Boolean(form.requiresOpsManualReview || needsOpsManualReview),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    persistOffers([...offers, newOffer]);
    addAudit('OFFER_CREATED', 'Offer', newOffer.id, `Tạo Offer nguồn vỏ container ${targetAsset.containerNumber} kèm file eDO ${newOffer.edoFileName}`);
    
    if (!shouldAutoApprove) {
      // Chỉ gửi Ops những hồ sơ có thiếu kết quả AI hoặc có dấu hiệu bất thường.
      addNotification(
        'COMP-OPS',
        'OPS_ALERT',
        `Offer mới cần thẩm định: ${newOffer.id}`,
        `Nhà cung cấp Container (${ownerCompany.shortName}) đã đăng nguồn vỏ ${targetAsset.containerNumber} (${targetAsset.carrierCode} ${targetAsset.containerType}) kèm e-DO. Vui lòng kiểm tra ảnh và kết luận thủ công.`,
        newOffer.id
      );
    } else {
      addNotification(
        newOffer.companyId,
        'TRANSACTION_UPDATE',
        `Offer ${newOffer.id} đã được tự động duyệt`,
        'eDO và bộ ảnh container đạt yêu cầu. Offer đã sẵn sàng để ghép lệnh.',
        newOffer.id
      );
    }

    return { 
      success: true, 
      message: shouldAutoApprove
        ? 'Đã tạo Offer thành công! eDO và bộ ảnh đều đạt, Offer đã được tự động duyệt và sẵn sàng matching.'
        : 'Đã tạo Offer thành công! Hồ sơ có cảnh báo hoặc chưa đủ kết quả AI, đã chuyển Ops kiểm tra thủ công.',
      data: newOffer 
    };
  }, [assets, offers, companies, currentRole, currentCompany, persistAssets, persistOffers, addAudit, addNotification]);

  const updateOffer = useCallback((offerId: string, updates: Partial<Offer>): ActionResult => {
    const offer = offers.find(o => o.id === offerId);
    if (!offer) return { success: false, message: 'Không tìm thấy Offer.' };
    if (offer.companyId !== currentCompany.id) {
      return { success: false, message: 'Bạn không có quyền chỉnh sửa Offer này.' };
    }
    if (['HELD', 'ALLOCATED', 'FULFILLED'].includes(offer.status)) {
      return { success: false, message: `Offer đang ở trạng thái ${offer.status}, không thể chỉnh sửa trực tiếp.` };
    }
    // Sửa trường trọng yếu → UNDER_REVIEW
    const majorChanges = ['pickupLatitude', 'pickupLongitude', 'baselineDepotCostVnd', 'availableFrom', 'availableTo', 'photoUrls', 'conditionNotes'];
    const finalPickupLocation = String(updates.pickupLocationName ?? offer.pickupLocationName).trim();
    const finalAvailableFrom = updates.availableFrom ?? offer.availableFrom;
    const finalAvailableTo = updates.availableTo ?? offer.availableTo;
    const finalBaseline = Number(updates.baselineDepotCostVnd ?? offer.baselineDepotCostVnd);
    if (!finalPickupLocation) return { success: false, message: 'Địa điểm lấy cont là bắt buộc.' };
    if (!finalAvailableFrom || !finalAvailableTo || new Date(finalAvailableTo).getTime() <= new Date(finalAvailableFrom).getTime()) {
      return { success: false, message: 'Khung thời gian Offer không hợp lệ.' };
    }
    if (!Number.isFinite(finalBaseline) || finalBaseline <= 0) {
      return { success: false, message: 'Chi phí đưa về depot phải lớn hơn 0.' };
    }
    const finalPhotos = updates.photoUrls ?? offer.photoUrls;
    if (finalPhotos.length < 6) {
      return { success: false, message: 'Offer phải giữ tối thiểu 6 ảnh container.' };
    }
    const photosChanged = Object.prototype.hasOwnProperty.call(updates, 'photoUrls');
    const hasMajorChange = Object.keys(updates).some(k => majorChanges.includes(k));
    const newStatus = (offer.status === 'AVAILABLE' && hasMajorChange) ? 'UNDER_REVIEW' : offer.status;
    const updated = {
      ...offer, ...updates,
      asset: {
        ...offer.asset,
        photos: finalPhotos,
        ...(updates.conditionNotes !== undefined ? { conditionNotes: updates.conditionNotes } : {}),
        ...(updates.asset?.declaredCondition !== undefined ? { declaredCondition: updates.asset.declaredCondition } : {}),
      },
      photoUrls: finalPhotos,
      photoChecklistComplete: finalPhotos.length >= 6,
      // Ảnh mới vẫn được lưu khi AI chưa phản hồi; trường hợp này phải quay
      // lại hàng đợi Ops để kiểm tra thủ công trước khi công khai.
      requiresOpsManualReview: photosChanged
        ? Boolean(updates.requiresOpsManualReview || !updates.aiCheck?.photoChecked || updates.aiCheck.verificationStatus !== 'VERIFIED')
        : (updates.requiresOpsManualReview ?? offer.requiresOpsManualReview),
      status: newStatus,
      version: offer.version + (hasMajorChange ? 1 : 0),
      updatedAt: new Date().toISOString()
    };
    persistOffers(offers.map(o => o.id === offerId ? updated : o));
    addAudit('OFFER_UPDATED', 'Offer', offerId, hasMajorChange ? 'Sửa trường trọng yếu → UNDER_REVIEW' : 'Cập nhật thông tin Offer');
    return { success: true, message: hasMajorChange ? 'Offer đã được gửi lại để review.' : 'Đã cập nhật Offer.' };
  }, [offers, currentCompany, persistOffers, addAudit]);

  const submitOfferForReview = useCallback((offerId: string): ActionResult => {
    const offer = offers.find(o => o.id === offerId);
    if (!offer) return { success: false, message: 'Không tìm thấy Offer.' };
    if (offer.status !== 'DRAFT' && offer.status !== 'CHANGES_REQUIRED') {
      return { success: false, message: `Chỉ có thể gửi review từ DRAFT hoặc CHANGES_REQUIRED (hiện: ${offer.status}).` };
    }
    const aiPassed = Boolean(
      offer.aiCheck?.passed
      && offer.aiCheck.edoChecked
      && offer.aiCheck.photoChecked
      && offer.aiCheck.verificationStatus === 'VERIFIED'
      && !offer.requiresOpsManualReview
    );
    const now = new Date().toISOString();
    persistOffers(offers.map(o => o.id === offerId ? {
      ...o,
      status: aiPassed ? 'AVAILABLE' : 'UNDER_REVIEW',
      ...(aiPassed ? {
        reviewerNotes: 'Tự động duyệt: eDO hợp lệ và bộ ảnh container khớp thông tin đăng ký.',
        reviewedBy: 'AI/QA tự động',
        reviewedAt: now,
      } : {}),
      updatedAt: now,
    } : o));
    addAudit('OFFER_SUBMITTED_FOR_REVIEW', 'Offer', offerId, aiPassed ? 'AI/QA tự động duyệt Offer đạt điều kiện' : 'Gửi Offer để Ops thẩm định');
    return { success: true, message: aiPassed
      ? 'Offer đã được tự động duyệt vì toàn bộ kết quả AI đều đạt.'
      : 'Đã gửi Offer để Ops kiểm tra thủ công.' };
  }, [offers, persistOffers, addAudit]);

  const withdrawOffer = useCallback((offerId: string, reason: string): ActionResult => {
    const offer = offers.find(o => o.id === offerId);
    if (!offer) return { success: false, message: 'Không tìm thấy Offer.' };
    if (!reason.trim()) return { success: false, message: 'Lý do rút Offer không được để trống.' };
    if (['HELD', 'ALLOCATED', 'FULFILLED', 'WITHDRAWN', 'EXPIRED'].includes(offer.status)) {
      return { success: false, message: `Không thể rút Offer ở trạng thái ${offer.status}.` };
    }
    persistOffers(offers.map(o =>
      o.id === offerId ? { ...o, status: 'WITHDRAWN', withdrawReason: reason, updatedAt: new Date().toISOString() } : o
    ));
    addAudit('OFFER_WITHDRAWN', 'Offer', offerId, `Rút Offer: ${reason}`);
    return { success: true, message: 'Đã rút Offer thành công.' };
  }, [offers, persistOffers, addAudit]);

  const deleteOffer = useCallback((offerId: string): ActionResult => {
    const offer = offers.find(o => o.id === offerId);
    if (!offer) return { success: false, message: 'Không tìm thấy Offer.' };
    if (['HELD', 'ALLOCATED', 'FULFILLED'].includes(offer.status)) {
      return { success: false, message: `Offer đang ở trạng thái ${offer.status}, không thể xóa.` };
    }
    if (offer.companyId !== currentCompany.id && currentRole !== 'OPS') {
      return { success: false, message: 'Bạn không có quyền xóa Offer này.' };
    }
    persistOffers(offers.filter(o => o.id !== offerId));
    addAudit('OFFER_DELETED', 'Offer', offerId, `Xóa Offer ${offerId} của cont ${offer.asset.containerNumber}`);
    return { success: true, message: `Đã xóa Offer ${offerId} thành công.` };
  }, [offers, currentCompany, currentRole, persistOffers, addAudit]);

  const opsReviewOffer = useCallback((offerId: string, decision: 'APPROVE' | 'REQUEST_CHANGES' | 'REJECT', notes: string): ActionResult => {
    if (currentRole !== 'OPS') {
      return { success: false, message: 'Chỉ Ops mới có thể thẩm định Offer.' };
    }
    const offer = offers.find(o => o.id === offerId);
    if (!offer) return { success: false, message: 'Không tìm thấy Offer.' };
    if (!notes.trim()) return { success: false, message: 'Ghi chú thẩm định Offer không được để trống.' };
    if (offer.status !== 'UNDER_REVIEW') {
      return { success: false, message: `Offer không ở trạng thái UNDER_REVIEW (hiện: ${offer.status}).` };
    }
    if (decision === 'APPROVE') {
      if (offer.photoUrls.length < 6 || !offer.photoChecklistComplete) {
        return { success: false, message: 'Chưa thể duyệt: Offer phải có đủ tối thiểu 6 ảnh container.' };
      }
      if (offer.edoDocumentIds.length !== 1 || !offer.edoFileName?.trim()) {
        return { success: false, message: 'Chưa thể duyệt: Offer phải gắn đúng một file eDO/Booking.' };
      }
      // AI is an assistive signal. Ops can complete the review manually when
      // the provider is unavailable or has not returned a result yet.
    }
    const newStatus = decision === 'APPROVE' ? 'AVAILABLE' : decision === 'REQUEST_CHANGES' ? 'CHANGES_REQUIRED' : 'REJECTED';
    
    const updatedOffer: Offer = {
      ...offer,
      status: newStatus,
      reviewerNotes: notes,
      reviewedBy: currentUserEmail,
      reviewedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      asset: {
        ...offer.asset,
        hasEdoDocument: true,
        edoVerificationStatus: decision === 'APPROVE' ? 'VERIFIED' : 'REJECTED',
        reviewedCondition: decision === 'APPROVE' ? offer.asset.declaredCondition : undefined,
      },
    };

    persistOffers(offers.map(o => o.id === offerId ? updatedOffer : o));
    
    if (decision === 'APPROVE') {
      persistAssets(assets.map(a => a.id === offer.assetId ? {
        ...a,
        hasEdoDocument: true,
        edoVerificationStatus: 'VERIFIED',
        reviewedCondition: offer.asset.declaredCondition,
      } : a));
    }

    addAudit(`OFFER_${decision}`, 'Offer', offerId, `Ops quyết định ${decision}: ${notes}`);
    // Notify nhà cung cấp
    addNotification(offer.companyId, 'TRANSACTION_UPDATE',
      `Offer ${offerId} — ${newStatus === 'AVAILABLE' ? 'Đã được duyệt ✓' : newStatus === 'CHANGES_REQUIRED' ? 'Cần bổ sung tài liệu' : 'Bị từ chối'}`,
      notes, offerId);
    return { success: true, message: `Đã ${decision === 'APPROVE' ? 'duyệt và công khai' : decision === 'REQUEST_CHANGES' ? 'yêu cầu bổ sung' : 'từ chối'} Offer.` };
  }, [offers, assets, currentRole, currentUserEmail, persistOffers, persistAssets, addAudit, addNotification]);

  // ==================== REQUEST ACTIONS ====================

  const addRequest = useCallback((form: CreateRequestForm): ActionResult => {
    if (currentRole !== 'ENTERPRISE_B' && currentRole !== 'ENTERPRISE_BOTH') {
      return { success: false, message: 'Chỉ đơn vị Cần vỏ Container mới có thể tạo nhu cầu.' };
    }
    const bookingNumber = form.bookingNumber.trim().toUpperCase();
    if (!bookingNumber) return { success: false, message: 'Booking Note/Booking Number là bắt buộc.' };
    const bookingFileName = String(form.bookingFileName || '').trim();
    if (!bookingFileName) return { success: false, message: 'File Booking ảnh/PDF là bắt buộc để Ops xác minh.' };
    if (!/^[A-Z0-9][A-Z0-9-]{4,}$/.test(bookingNumber)) {
      return { success: false, message: 'Số Booking phải có ít nhất 5 ký tự, chỉ gồm chữ, số và dấu gạch ngang.' };
    }
    if (!form.containerType) return { success: false, message: 'Loại container là bắt buộc.' };
    if (!form.pickupWindowStart || !form.pickupWindowEnd || new Date(form.pickupWindowStart).getTime() <= Date.now() || new Date(form.pickupWindowEnd).getTime() <= new Date(form.pickupWindowStart).getTime()) {
      return { success: false, message: 'Request phải có required_from/required_until hợp lệ.' };
    }
    if (!form.carrierId || !form.deliveryLocationName?.trim()) return { success: false, message: 'HÃ£ng tÃ u vÃ  Ä‘á»‹a Ä‘iá»ƒm giao lÃ  báº¯t buá»™c.' };
    if (!form.cutOffTime || new Date(form.cutOffTime).getTime() <= Date.now()) return { success: false, message: 'Cut-off booking pháº£i lÃ  thá»i Ä‘iá»ƒm trong tÆ°Æ¡ng lai.' };
    if (!Number.isFinite(form.maxDistanceKm) || form.maxDistanceKm < 5 || form.maxDistanceKm > 100) return { success: false, message: 'Dmax pháº£i náº±m trong khoáº£ng 5-100 km.' };
    const baselinePickupCostVnd = Number(form.baselinePickupCostVnd ?? DEFAULT_BASELINE_PICKUP_COST_VND);
    if (!Number.isFinite(baselinePickupCostVnd) || baselinePickupCostVnd <= 0) return { success: false, message: 'Chi phí nội bộ cấu hình cho Booking không hợp lệ.' };
    const requesterCompany = companies.find(c => c.id === currentCompany.id) || currentCompany;
    if (requesterCompany.verificationStatus !== 'VERIFIED') {
      return { success: false, message: 'Doanh nghiệp chưa được Ops xác minh. Chưa thể tạo Request.' };
    }
    const newReq: ContainerRequest = {
      id: genId('REQ'),
      companyId: currentCompany.id,
      companyName: requesterCompany.shortName,
      carrierId: form.carrierId,
      carrierCode: form.carrierId.replace('CARR-', ''),
      containerType: form.containerType,
      bookingNumber,
      status: 'DRAFT',
      version: 1,
      deliveryLocationName: form.deliveryLocationName,
      deliveryLatitude: form.deliveryLatitude,
      deliveryLongitude: form.deliveryLongitude,
      pickupWindowStart: form.pickupWindowStart,
      pickupWindowEnd: form.pickupWindowEnd,
      cutOffTime: form.cutOffTime,
      maxDistanceKm: form.maxDistanceKm || 40,
      cargoType: form.cargoType || 'Hàng tổng hợp',
      cargoRequirements: form.cargoRequirements,
      baselinePickupCostVnd,
      bookingFileName,
      bookingFileMimeType: form.bookingFileMimeType,
      bookingAiCheck: form.bookingAiCheck,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    persistRequests([...requests, newReq]);
    addAudit('REQUEST_CREATED', 'ContainerRequest', newReq.id, `Tạo nhu cầu booking ${form.bookingNumber}`);
    return { success: true, message: 'Đã tạo nhu cầu thành công. Hãy gửi Ops xác minh; sau khi được OPEN, hệ thống sẽ tự động tìm Offer phù hợp.', data: newReq };
  }, [requests, companies, currentRole, currentCompany, persistRequests, addAudit]);

  const updateRequest = useCallback((requestId: string, updates: Partial<ContainerRequest>): ActionResult => {
    if (currentRole !== 'ENTERPRISE_B' && currentRole !== 'ENTERPRISE_BOTH') {
      return { success: false, message: 'Chỉ đơn vị Cần vỏ Container mới có thể chỉnh sửa nhu cầu.' };
    }
    const req = requests.find(r => r.id === requestId);
    if (!req) return { success: false, message: 'Không tìm thấy nhu cầu.' };
    if (req.companyId !== currentCompany.id) {
      return { success: false, message: 'Bạn không có quyền chỉnh sửa nhu cầu này.' };
    }
    if (['HELD', 'ALLOCATED', 'FULFILLED'].includes(req.status)) {
      return { success: false, message: `Nhu cầu đang ở trạng thái ${req.status}, không thể chỉnh sửa trực tiếp.` };
    }
    const finalBooking = String(updates.bookingNumber ?? req.bookingNumber).trim().toUpperCase();
    const finalCarrierId = String(updates.carrierId ?? req.carrierId).trim();
    const finalContainerType = updates.containerType ?? req.containerType;
    const finalDelivery = String(updates.deliveryLocationName ?? req.deliveryLocationName).trim();
    const finalPickupWindowStart = String(updates.pickupWindowStart ?? req.pickupWindowStart);
    const finalPickupWindowEnd = String(updates.pickupWindowEnd ?? req.pickupWindowEnd);
    const finalCutOffTime = String(updates.cutOffTime ?? req.cutOffTime);
    const finalDistance = Number(updates.maxDistanceKm ?? req.maxDistanceKm);
    const finalBaseline = Number(updates.baselinePickupCostVnd ?? req.baselinePickupCostVnd);
    const finalBookingFileName = String(updates.bookingFileName ?? req.bookingFileName ?? '').trim();
    if (!finalBooking || !/^[A-Z0-9][A-Z0-9-]{4,}$/.test(finalBooking)) {
      return { success: false, message: 'Số Booking phải có ít nhất 5 ký tự, chỉ gồm chữ, số và dấu gạch ngang.' };
    }
    if (!finalCarrierId) return { success: false, message: 'Hãng tàu cấp vỏ là bắt buộc.' };
    if (!finalContainerType) return { success: false, message: 'Loại container là bắt buộc.' };
    if (!finalDelivery) return { success: false, message: 'Địa điểm giao hàng là bắt buộc.' };
    if (!finalPickupWindowStart || !finalPickupWindowEnd || new Date(finalPickupWindowStart).getTime() <= Date.now() || new Date(finalPickupWindowEnd).getTime() <= new Date(finalPickupWindowStart).getTime()) {
      return { success: false, message: 'Khung thời gian lấy cont không hợp lệ.' };
    }
    if (!finalCutOffTime || new Date(finalCutOffTime).getTime() <= Date.now()) {
      return { success: false, message: 'Cut-off booking phải là thời điểm trong tương lai.' };
    }
    if (!Number.isFinite(finalDistance) || finalDistance < 5 || finalDistance > 100) return { success: false, message: 'Dmax phải nằm trong khoảng 5-100 km.' };
    if (!finalBookingFileName) return { success: false, message: 'File Booking ảnh/PDF là bắt buộc để Ops xác minh.' };
    if (!Number.isFinite(finalBaseline) || finalBaseline <= 0) return { success: false, message: 'Chi phí nội bộ cấu hình cho Booking không hợp lệ.' };

    const carrierCode = INITIAL_CARRIERS.find(carrier => carrier.id === finalCarrierId)?.code || finalCarrierId.replace(/^CARR-/, '');
    const matchingFieldsChanged = finalBooking !== req.bookingNumber
      || finalCarrierId !== req.carrierId
      || finalContainerType !== req.containerType
      || finalDelivery !== req.deliveryLocationName
      || finalPickupWindowStart !== req.pickupWindowStart
      || finalPickupWindowEnd !== req.pickupWindowEnd
      || finalCutOffTime !== req.cutOffTime
      || finalDistance !== req.maxDistanceKm;
    const newStatus = req.status === 'OPEN' && matchingFieldsChanged ? 'UNDER_REVIEW' : req.status;
    const updated = {
      ...req,
      ...updates,
      status: newStatus,
      carrierId: finalCarrierId,
      carrierCode,
      containerType: finalContainerType,
      bookingNumber: finalBooking,
      deliveryLocationName: finalDelivery,
      pickupWindowStart: finalPickupWindowStart,
      pickupWindowEnd: finalPickupWindowEnd,
      cutOffTime: finalCutOffTime,
      maxDistanceKm: finalDistance,
      baselinePickupCostVnd: finalBaseline,
      bookingFileName: finalBookingFileName,
      bookingFileMimeType: updates.bookingFileMimeType ?? req.bookingFileMimeType,
      bookingAiCheck: updates.bookingAiCheck ?? req.bookingAiCheck,
      version: req.version + 1,
      updatedAt: new Date().toISOString(),
    };
    persistRequests(requests.map(r => r.id === requestId ? updated : r));
    addAudit('REQUEST_UPDATED', 'ContainerRequest', requestId, 'Cập nhật nhu cầu');
    return { success: true, message: newStatus === 'UNDER_REVIEW' ? 'Đã cập nhật. Request được gửi lại Ops xác minh do thay đổi điều kiện matching.' : 'Đã cập nhật nhu cầu.' };
  }, [requests, currentCompany, currentRole, persistRequests, addAudit]);

  const submitRequestForReview = useCallback((requestId: string): ActionResult => {
    if (currentRole !== 'ENTERPRISE_B' && currentRole !== 'ENTERPRISE_BOTH') {
      return { success: false, message: 'Chỉ đơn vị Cần vỏ Container mới có thể gửi nhu cầu để Ops xác minh.' };
    }
    const req = requests.find(r => r.id === requestId);
    if (!req) return { success: false, message: 'Không tìm thấy nhu cầu.' };
    if (req.companyId !== currentCompany.id) {
      return { success: false, message: 'Bạn không có quyền gửi nhu cầu này.' };
    }
    if (req.status !== 'DRAFT' && req.status !== 'CHANGES_REQUIRED') {
      return { success: false, message: `Chỉ gửi review từ DRAFT/CHANGES_REQUIRED (hiện: ${req.status}).` };
    }
    if (!req.bookingFileName?.trim()) {
      return { success: false, message: 'Cần tải file Booking ảnh/PDF trước khi gửi Ops xác minh.' };
    }
    persistRequests(requests.map(r => r.id === requestId ? { ...r, status: 'UNDER_REVIEW', updatedAt: new Date().toISOString() } : r));
    addAudit('REQUEST_SUBMITTED_FOR_REVIEW', 'ContainerRequest', requestId, 'Gửi nhu cầu để Ops xác minh');
    addNotification(
      'COMP-OPS',
      'OPS_ALERT',
      `Booking mới cần thẩm định: ${requestId}`,
      `Đơn vị cần vỏ đã gửi Booking để Ops xác minh trước khi matching.`,
      requestId
    );
    return { success: true, message: 'Đã gửi nhu cầu để Ops xác minh booking.' };
  }, [requests, currentRole, currentCompany, persistRequests, addAudit, addNotification]);

  const withdrawRequest = useCallback((requestId: string, reason: string): ActionResult => {
    const req = requests.find(r => r.id === requestId);
    if (!req) return { success: false, message: 'Không tìm thấy nhu cầu.' };
    if (!reason.trim()) return { success: false, message: 'Lý do rút nhu cầu không được để trống.' };
    if (['HELD', 'ALLOCATED', 'FULFILLED', 'WITHDRAWN', 'EXPIRED'].includes(req.status)) {
      return { success: false, message: `Không thể rút nhu cầu ở trạng thái ${req.status}.` };
    }
    persistRequests(requests.map(r =>
      r.id === requestId ? { ...r, status: 'WITHDRAWN', withdrawReason: reason, updatedAt: new Date().toISOString() } : r
    ));
    addAudit('REQUEST_WITHDRAWN', 'ContainerRequest', requestId, `Rút nhu cầu: ${reason}`);
    return { success: true, message: 'Đã rút nhu cầu thành công.' };
  }, [requests, persistRequests, addAudit]);

  const deleteRequest = useCallback((requestId: string): ActionResult => {
    const req = requests.find(r => r.id === requestId);
    if (!req) return { success: false, message: 'Không tìm thấy nhu cầu.' };
    if (['HELD', 'ALLOCATED', 'FULFILLED'].includes(req.status)) {
      return { success: false, message: `Nhu cầu đang ở trạng thái ${req.status}, không thể xóa.` };
    }
    if (req.companyId !== currentCompany.id && currentRole !== 'OPS') {
      return { success: false, message: 'Bạn không có quyền xóa nhu cầu này.' };
    }
    persistRequests(requests.filter(r => r.id !== requestId));
    addAudit('REQUEST_DELETED', 'ContainerRequest', requestId, `Xóa nhu cầu booking ${req.bookingNumber}`);
    return { success: true, message: `Đã xóa nhu cầu ${req.bookingNumber} thành công.` };
  }, [requests, currentCompany, currentRole, persistRequests, addAudit]);

  const opsReviewRequest = useCallback((requestId: string, decision: 'APPROVE' | 'REQUEST_CHANGES' | 'REJECT', notes: string): ActionResult => {
    if (currentRole !== 'OPS') {
      return { success: false, message: 'Chỉ Ops mới có thể xác minh nhu cầu.' };
    }
    const req = requests.find(r => r.id === requestId);
    if (!req) return { success: false, message: 'Không tìm thấy nhu cầu.' };
    if (req.status !== 'UNDER_REVIEW') {
      return { success: false, message: `Nhu cầu không ở trạng thái UNDER_REVIEW (hiện: ${req.status}).` };
    }
    if (!notes.trim()) return { success: false, message: 'Ghi chú xác minh nhu cầu không được để trống.' };
    if (decision === 'APPROVE') {
      const bookingNumber = req.bookingNumber.trim().toUpperCase();
      const pickupStart = new Date(req.pickupWindowStart).getTime();
      const pickupEnd = new Date(req.pickupWindowEnd).getTime();
      const cutOff = new Date(req.cutOffTime).getTime();
      if (!/^[A-Z0-9][A-Z0-9-]{4,}$/.test(bookingNumber) || !req.carrierCode || !req.containerType || !req.deliveryLocationName.trim()) {
        return { success: false, message: 'Request thiếu Booking Number, hãng tàu, loại cont hoặc địa điểm giao.' };
      }
      if (!req.bookingFileName?.trim()) {
        return { success: false, message: 'Request thiếu file Booking ảnh/PDF để Ops xác minh.' };
      }
      if (!Number.isFinite(pickupStart) || !Number.isFinite(pickupEnd) || pickupStart <= Date.now() || pickupEnd <= pickupStart) {
        return { success: false, message: 'Khung thời gian lấy cont chưa hợp lệ.' };
      }
      if (!Number.isFinite(cutOff) || cutOff <= Date.now()) {
        return { success: false, message: 'Cut-off booking phải ở trong tương lai.' };
      }
      if (!Number.isFinite(req.maxDistanceKm) || req.maxDistanceKm < 5 || req.maxDistanceKm > 100 || !Number.isFinite(req.baselinePickupCostVnd) || req.baselinePickupCostVnd <= 0) {
        return { success: false, message: 'Dmax phải từ 5-100 km và chi phí baseline lấy cont phải lớn hơn 0.' };
      }
    }
    const newStatus = decision === 'APPROVE' ? 'OPEN' : decision === 'REQUEST_CHANGES' ? 'CHANGES_REQUIRED' : 'REJECTED';
    persistRequests(requests.map(r =>
      r.id === requestId ? {
        ...r, status: newStatus, reviewerNotes: notes,
        reviewedBy: currentUserEmail, reviewedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      } : r
    ));
    addAudit(`REQUEST_${decision}`, 'ContainerRequest', requestId, `Ops xác minh ${decision}: ${notes}`);
    addNotification(
      req.companyId,
      'TRANSACTION_UPDATE',
      `Booking ${requestId} — ${decision === 'APPROVE' ? 'đã được duyệt' : decision === 'REQUEST_CHANGES' ? 'cần bổ sung' : 'bị từ chối'}`,
      notes,
      requestId
    );
    return { success: true, message: `Đã xử lý nhu cầu.` };
  }, [requests, currentRole, currentUserEmail, persistRequests, addAudit, addNotification]);

  // ==================== RESERVATION ====================

  const holdAtomicReservation = useCallback((candidate: MatchCandidate, request: ContainerRequest): ActionResult => {
    if (currentRole !== 'ENTERPRISE_B' && currentRole !== 'ENTERPRISE_BOTH') {
      return { success: false, message: 'Chỉ đơn vị Cần vỏ Container mới có thể giữ chỗ container.' };
    }
    if (request.companyId !== currentCompany.id) {
      return { success: false, message: 'Nhu cầu không thuộc công ty của bạn.' };
    }
    // Check: offer vẫn AVAILABLE
    const latestOffer = offers.find(o => o.id === candidate.offer.id);
    if (!latestOffer || latestOffer.status !== 'AVAILABLE') {
      return { success: false, message: 'Offer không còn khả dụng. Vui lòng tải lại danh sách.' };
    }
    // Check: request vẫn OPEN
    const latestRequest = requests.find(r => r.id === request.id);
    if (!latestRequest || latestRequest.status !== 'OPEN') {
      return { success: false, message: 'Nhu cầu không còn ở trạng thái OPEN.' };
    }
    // Check: không có active allocation cho asset này
    const existingTxn = transactions.find(
      t => t.assetId === candidate.offer.assetId && ['NEGOTIATING', 'PENDING_CARRIER', 'AWAITING_PAYMENT', 'READY_FOR_PICKUP', 'INSPECTION', 'HANDOVER_PENDING'].includes(t.status)
    );
    if (existingTxn) {
      return { success: false, message: 'Container đã đang trong giao dịch khác. (409 Conflict)' };
    }
    // Check: location không quá cũ
    if (candidate.requiresLocationRefresh) {
      return { success: false, message: `Vị trí container đã ${Math.round(candidate.locationAgeHours)}h — Nhà cung cấp Container cần xác nhận lại trước khi giữ chỗ.` };
    }

    // Tạo Agreement v1
    const activeMatchExists = matches.some(m =>
      m.offerId === latestOffer.id && m.requestId === latestRequest.id &&
      ['MATCH_REQUESTED', 'MATCH_ACCEPTED'].includes(m.status)
    );
    if (activeMatchExists) {
      return { success: false, message: 'Match cho Offer/Request này đã tồn tại.' };
    }
    const matchNow = new Date().toISOString();
    const pendingMatch: Match = {
      id: genId('MATCH'),
      offerId: latestOffer.id,
      requestId: latestRequest.id,
      assetId: latestOffer.assetId,
      companyAId: latestOffer.companyId,
      companyBId: currentCompany.id,
      scoreM: candidate.scoreM,
      scoreD: candidate.scoreD,
      scoreT: candidate.scoreT,
      scoreC: candidate.scoreC,
      quote: candidate.quote,
      status: 'MATCH_REQUESTED',
      requestedAt: matchNow,
      expiresAt: new Date(Date.now() + MATCH_EXPIRY_MS).toISOString(),
    };
    // Đơn vị cần vỏ mới chỉ gửi yêu cầu ghép. Chưa reserve cont và chưa tạo Transaction.
    persistMatches([...matches, pendingMatch]);
    const chatExists = chatThreads.some(thread =>
      thread.offerId === latestOffer.id && thread.requestId === latestRequest.id &&
      thread.companyAId === latestOffer.companyId && thread.companyBId === latestRequest.companyId
    );
    if (!chatExists) {
      const chatNow = new Date().toISOString();
      setChatThreads(prev => [{
        id: genId('CHAT'),
        companyAId: latestOffer.companyId,
        companyAName: latestOffer.companyName,
        companyBId: latestRequest.companyId,
        companyBName: latestRequest.companyName,
        offerId: latestOffer.id,
        requestId: latestRequest.id,
        contextLabel: `Trao đổi trước đặt cont · ${latestOffer.asset.carrierCode} · ${latestOffer.asset.containerType}`,
        contextType: 'PRE_BOOKING',
        carrierCode: latestOffer.asset.carrierCode,
        containerType: latestOffer.asset.containerType,
        pickupLocationName: latestOffer.pickupLocationName,
        createdAt: chatNow,
        updatedAt: chatNow,
        lastMessageAt: chatNow,
      }, ...prev]);
    }
    addAudit('MATCH_REQUESTED', 'Match', pendingMatch.id, `Đơn vị Cần vỏ Container chọn Offer ${latestOffer.id}; chờ nhà cung cấp xác nhận trong 2 giờ.`);
    addNotification(latestOffer.companyId, 'TRANSACTION_UPDATE', 'Có yêu cầu ghép mới từ đơn vị cần vỏ', `${currentCompany.shortName} đã chọn Offer ${latestOffer.id}. Hãy Accept/Reject Match trước khi hết hạn.`, pendingMatch.id);
    return { success: true, message: `Đã gửi yêu cầu ghép ${pendingMatch.id} cho Nhà cung cấp Container. Chưa tạo Transaction và chưa giữ cont.`, data: { matchId: pendingMatch.id } };

  }, [offers, requests, transactions, matches, chatThreads, currentRole, currentCompany, persistOffers, persistRequests, persistTransactions, persistMatches, addAudit, addNotification]);

  const acceptMatch = useCallback((matchId: string): ActionResult => {
    const match = matches.find(item => item.id === matchId);
    if (!match) return { success: false, message: 'Không tìm thấy Match.' };
    if ((currentRole !== 'ENTERPRISE_A' && currentRole !== 'ENTERPRISE_BOTH') || currentCompany.id !== match.companyAId) {
      return { success: false, message: 'Chỉ Nhà cung cấp Container của Match mới được Accept.' };
    }
    if (match.status !== 'MATCH_REQUESTED') return { success: false, message: 'Match không còn chờ nhà cung cấp xử lý.' };
    if (Date.now() > new Date(match.expiresAt).getTime()) {
      persistMatches(matches.map(item => item.id === matchId ? { ...item, status: 'MATCH_EXPIRED' } : item));
      return { success: false, message: 'Match đã hết hạn sau 2 giờ.' };
    }
    const offer = offers.find(item => item.id === match.offerId);
    const request = requests.find(item => item.id === match.requestId);
    if (!offer || offer.status !== 'AVAILABLE' || !request || request.status !== 'OPEN') {
      return { success: false, message: 'Offer hoặc Request không còn khả dụng; Match bị từ chối.' };
    }
    if (transactions.some(t => t.assetId === match.assetId && !['COMPLETED', 'CANCELLED', 'REJECTED', 'EXPIRED'].includes(t.status))) {
      return { success: false, message: 'Container đã được phân bổ cho giao dịch khác.' };
    }
    const now = new Date().toISOString();
    const transactionId = genId('TXN');
    const agreement: Agreement = {
      id: genId('AGR'),
      transactionId,
      version: 1,
      contentHash: `sha256-${Math.random().toString(36).substring(2)}`,
      createdAt: now,
    };
    const newTxn: Transaction = {
      id: transactionId,
      offerId: offer.id,
      requestId: request.id,
      assetId: offer.assetId,
      companyAId: offer.companyId,
      companyAName: offer.companyName,
      companyBId: request.companyId,
      companyBName: request.companyName,
      asset: offer.asset,
      status: 'NEGOTIATING',
      rowVersion: 1,
      isOnHold: false,
      dueAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      nextAction: 'Nhà cung cấp Container và đơn vị Cần vỏ Container ký thỏa thuận độc lập. Chỉ khi cả hai cùng ký một phiên bản, hệ thống mới xin Carrier Approval.',
      allowedActions: [],
      blockingReasons: [],
      currentAgreementVersion: 1,
      agreements: [agreement],
      quote: match.quote,
      createdAt: now,
      updatedAt: now,
    };
    persistMatches(matches.map(item => item.id === matchId ? { ...item, status: 'MATCH_ACCEPTED', respondedAt: now, respondedBy: currentUserEmail, transactionId } : item));
    persistAssets(assets.map(item => item.id === offer.assetId
      ? { ...item, isLocked: true, activeAllocationId: transactionId, updatedAt: now }
      : item));
    persistOffers(offers.map(item => item.id === offer.id ? { ...item, status: 'HELD', updatedAt: now } : item));
    persistRequests(requests.map(item => item.id === request.id ? { ...item, status: 'HELD', updatedAt: now } : item));
    persistTransactions([...transactions, newTxn]);
    addAudit('MATCH_ACCEPTED_TRANSACTION_CREATED', 'Match', matchId, `Nhà cung cấp Accept Match; tạo Transaction ${transactionId}; hai đối tác cần ký độc lập.`);
    addNotification(request.companyId, 'TRANSACTION_UPDATE', 'Nhà cung cấp đã Accept Match', `Giao dịch ${transactionId} đã được tạo. Hai đối tác ký thỏa thuận độc lập.`, transactionId);
    return { success: true, message: `Đã Accept Match. Tạo giao dịch ${transactionId}.`, data: { transactionId } };
  }, [matches, offers, requests, transactions, assets, currentRole, currentCompany, currentUserEmail, persistMatches, persistAssets, persistOffers, persistRequests, persistTransactions, addAudit, addNotification]);

  const rejectMatch = useCallback((matchId: string, reason: string): ActionResult => {
    const match = matches.find(item => item.id === matchId);
    if (!match) return { success: false, message: 'Không tìm thấy Match.' };
    if ((currentRole !== 'ENTERPRISE_A' && currentRole !== 'ENTERPRISE_BOTH') || currentCompany.id !== match.companyAId) {
      return { success: false, message: 'Chỉ Nhà cung cấp Container của Match mới được Reject.' };
    }
    if (match.status !== 'MATCH_REQUESTED') return { success: false, message: 'Match không còn chờ xử lý.' };
    const now = new Date().toISOString();
    persistMatches(matches.map(item => item.id === matchId ? { ...item, status: 'MATCH_REJECTED', respondedAt: now, respondedBy: currentUserEmail, responseReason: reason.trim() || 'Nhà cung cấp từ chối Match' } : item));
    addAudit('MATCH_REJECTED', 'Match', matchId, reason.trim() || 'Nhà cung cấp từ chối Match');
    addNotification(match.companyBId, 'TRANSACTION_UPDATE', 'Match bị từ chối', reason.trim() || 'Nhà cung cấp chưa thể tiếp nhận yêu cầu ghép.', matchId);
    return { success: true, message: 'Đã Reject Match; Offer vẫn AVAILABLE.' };
  }, [matches, currentRole, currentCompany, currentUserEmail, persistMatches, addAudit, addNotification]);

  // ==================== AGREEMENT ====================

  const acceptAgreement = useCallback((transactionId: string): ActionResult => {
    const txn = transactions.find(t => t.id === transactionId);
    if (!txn) return { success: false, message: 'Không tìm thấy giao dịch.' };
    if (txn.status !== 'NEGOTIATING') {
      return { success: false, message: `Giao dịch không ở trạng thái NEGOTIATING (hiện: ${txn.status}).` };
    }
    if (txn.isOnHold) return { success: false, message: 'Giao dịch đang tạm dừng.' };

    const currentAgreement = txn.agreements.find(a => a.version === txn.currentAgreementVersion);
    if (!currentAgreement) return { success: false, message: 'Không tìm thấy phiên bản Thỏa thuận hiện tại.' };

    const isPartyA = txn.companyAId === currentCompany.id && (currentRole === 'ENTERPRISE_A' || currentRole === 'ENTERPRISE_BOTH');
    const isPartyB = txn.companyBId === currentCompany.id && (currentRole === 'ENTERPRISE_B' || currentRole === 'ENTERPRISE_BOTH');

    if (!isPartyA && !isPartyB) {
      return { success: false, message: 'Bạn không phải là bên tham gia giao dịch này.' };
    }

    // Kiểm tra không tự ký cho cả hai bên
    if (isPartyA && currentAgreement.companyAAcceptedAt) {
      return { success: false, message: 'Nhà cung cấp Container đã ký rồi.' };
    }
    if (isPartyB && currentAgreement.companyBAcceptedAt) {
      return { success: false, message: 'Đơn vị Cần vỏ Container đã ký rồi.' };
    }

    const now = new Date().toISOString();
    const updatedAgreement: Agreement = {
      ...currentAgreement,
      ...(isPartyA ? {
        companyAAcceptedAt: now,
        companyAAcceptedBy: currentUserEmail,
        companyACompanyId: currentCompany.id,
      } : {
        companyBAcceptedAt: now,
        companyBAcceptedBy: currentUserEmail,
        companyBCompanyId: currentCompany.id,
      }),
    };

    const updatedAgreements = txn.agreements.map(a =>
      a.version === txn.currentAgreementVersion ? updatedAgreement : a
    );

    // Kiểm tra cả hai đã ký chưa
    const bothAccepted = !!updatedAgreement.companyAAcceptedAt && !!updatedAgreement.companyBAcceptedAt;
    
    let updatedTxn: Transaction = {
      ...txn,
      agreements: updatedAgreements,
      rowVersion: txn.rowVersion + 1,
      updatedAt: now,
    };

    if (bothAccepted) {
      // Kiểm tra không cùng actor
      if (updatedAgreement.companyAAcceptedBy === updatedAgreement.companyBAcceptedBy) {
        return { success: false, message: 'SAME_ACTOR_BOTH_PARTIES: Cùng một người không được ký cả hai bên.' };
      }
      // Chuyển PENDING_CARRIER
      updatedTxn = {
        ...updatedTxn,
        status: 'PENDING_CARRIER',
        dueAt: new Date(Date.now() + CARRIER_TIMEOUT_MS).toISOString(),
        nextAction: 'Bộ phận Vận hành (Ops) đang liên hệ hãng tàu xin duyệt RU. Dự kiến 4 giờ.',
      };
      addAudit('TRANSACTION_STATUS_CHANGED', 'Transaction', transactionId,
        `NEGOTIATING → PENDING_CARRIER. Hai bên đã ký Thỏa thuận v${txn.currentAgreementVersion}.`);
    }

    persistTransactions(transactions.map(t => t.id === transactionId ? updatedTxn : t));
    addAudit(isPartyA ? 'AGREEMENT_ACCEPTED_BY_A' : 'AGREEMENT_ACCEPTED_BY_B',
      'Agreement', currentAgreement.id,
      `${isPartyA ? 'Nhà cung cấp Container' : 'Đơn vị Cần vỏ Container'} ký chấp thuận Thỏa thuận v${txn.currentAgreementVersion}. Hash: ${currentAgreement.contentHash}`);

    const otherPartyId = isPartyA ? txn.companyBId : txn.companyAId;
    addNotification(otherPartyId, 'TRANSACTION_UPDATE',
      bothAccepted ? `Giao dịch ${transactionId} — Hai đối tác đã ký` : `${isPartyA ? 'Nhà cung cấp Container' : 'Đơn vị Cần vỏ Container'} đã ký Thỏa thuận`,
      bothAccepted ? 'Chờ Ops xử lý RU với hãng tàu.' : `${isPartyA ? 'Nhà cung cấp Container' : 'Đơn vị Cần vỏ Container'} đã ký, đang chờ đối tác còn lại.`,
      transactionId);

    return { success: true, message: bothAccepted ? 'Cả hai bên đã ký. Chuyển sang chờ hãng tàu.' : `Đã ký chấp thuận thành công.` };
  }, [transactions, currentRole, currentCompany, currentUserEmail, persistTransactions, addAudit, addNotification]);

  const requestAgreementChange = useCallback((transactionId: string, reason: string): ActionResult => {
    const txn = transactions.find(t => t.id === transactionId);
    if (!txn) return { success: false, message: 'Không tìm thấy giao dịch.' };
    if (txn.status !== 'NEGOTIATING') return { success: false, message: 'Chỉ có thể yêu cầu thay đổi ở trạng thái NEGOTIATING.' };

    const currentAgreement = txn.agreements.find(a => a.version === txn.currentAgreementVersion);
    if (!currentAgreement) return { success: false, message: 'Không tìm thấy Thỏa thuận hiện tại.' };

    // Tạo version mới, vô hiệu hóa acceptance cũ
    const newVersion = txn.currentAgreementVersion + 1;
    const newAgreement: Agreement = {
      id: genId('AGR'),
      transactionId,
      version: newVersion,
      contentHash: `sha256-${Math.random().toString(36).substring(2)}`,
      createdAt: new Date().toISOString(),
    };
    const updatedOldAgreement: Agreement = {
      ...currentAgreement,
      supersededAt: new Date().toISOString(),
      supersededReason: reason,
    };

    const updatedTxn: Transaction = {
      ...txn,
      agreements: [...txn.agreements.map(a => a.version === txn.currentAgreementVersion ? updatedOldAgreement : a), newAgreement],
      currentAgreementVersion: newVersion,
      rowVersion: txn.rowVersion + 1,
      nextAction: `Thỏa thuận đã được cập nhật lên v${newVersion}. Cả hai bên cần ký lại.`,
      updatedAt: new Date().toISOString(),
    };
    persistTransactions(transactions.map(t => t.id === transactionId ? updatedTxn : t));
    addAudit('AGREEMENT_CHANGE_REQUESTED', 'Agreement', currentAgreement.id, `Yêu cầu thay đổi → v${newVersion}: ${reason}`);
    return { success: true, message: `Đã tạo Thỏa thuận v${newVersion}. Cả hai bên cần ký lại.` };
  }, [transactions, persistTransactions, addAudit]);

  // ==================== CARRIER APPROVAL ====================

  const opsApproveCarrier = useCallback((
    transactionId: string, refNumber: string, evidenceFileName: string, validUntil: string
  ): ActionResult => {
    if (currentRole !== 'OPS') {
      return { success: false, message: 'Chỉ Ops mới có thể ghi nhận kết quả RU.' };
    }
    const txn = transactions.find(t => t.id === transactionId);
    if (!txn) return { success: false, message: 'Không tìm thấy giao dịch.' };
    if (txn.status !== 'PENDING_CARRIER') {
      return { success: false, message: `Giao dịch không ở trạng thái PENDING_CARRIER (hiện: ${txn.status}).` };
    }
    if (!refNumber.trim()) {
      return { success: false, message: 'Số tham chiếu RU của hãng tàu không được để trống.' };
    }
    if (!evidenceFileName.trim()) {
      return { success: false, message: 'Phải có tên file bằng chứng RU.' };
    }

    const carrierRequest = requests.find(r => r.id === txn.requestId);
    if (!carrierRequest?.bookingNumber || !carrierRequest.carrierCode || new Date(validUntil).getTime() <= Date.now()) {
      return { success: false, message: 'Carrier Approval thiáº¿u Booking scope hoáº·c háº¡n hiá»‡u lá»±c khÃ´ng há»£p lá»‡.' };
    }
    const approval: CarrierApproval = {
      id: genId('CARAPPR'),
      transactionId,
      carrierCode: txn.asset.carrierCode,
      approvalReference: refNumber,
      status: 'APPROVED',
      scope: {
        containerNumber: txn.asset.containerNumber,
        bookingNumber: requests.find(r => r.id === txn.requestId)?.bookingNumber || '',
        companyAId: txn.companyAId,
        companyBId: txn.companyBId,
        pickupPoint: txn.asset.currentLocationName,
        deliveryPoint: requests.find(r => r.id === txn.requestId)?.deliveryLocationName || '',
        validFrom: new Date().toISOString(),
        validUntil,
      },
      opsReviewerName: currentUserEmail.split('@')[0],
      opsReviewerEmail: currentUserEmail,
      evidenceFileIds: [evidenceFileName],
      approvedAt: new Date().toISOString(),
      expiresAt: validUntil,
    };

    // Tạo payment orders
    const paymentOrderA: PaymentOrder = {
      id: genId('PAY'),
      transactionId,
      companyId: txn.companyAId,
      companyName: txn.companyAName,
      payerRole: 'PARTY_A',
      amountVnd: txn.quote.econtCollectedFromA,
      status: 'OPEN',
        expiresAt: new Date(Date.now() + PAYMENT_DEADLINE_MS).toISOString(),
    };
    const paymentOrderB: PaymentOrder = {
      id: genId('PAY'),
      transactionId,
      companyId: txn.companyBId,
      companyName: txn.companyBName,
      payerRole: 'PARTY_B',
      amountVnd: txn.quote.econtCollectedFromB,
      status: 'OPEN',
        expiresAt: new Date(Date.now() + PAYMENT_DEADLINE_MS).toISOString(),
    };

    const updatedTxn: Transaction = {
      ...txn,
      status: 'AWAITING_PAYMENT',
      carrierApproval: approval,
      paymentOrderA,
      paymentOrderB,
      rowVersion: txn.rowVersion + 1,
      dueAt: new Date(Date.now() + PAYMENT_DEADLINE_MS).toISOString(),
      nextAction: 'Hai đối tác cần hoàn tất thanh toán trong vòng 2 giờ.',
      updatedAt: new Date().toISOString(),
    };
    persistTransactions(transactions.map(t => t.id === transactionId ? updatedTxn : t));
    addAudit('CARRIER_APPROVAL_RECORDED', 'CarrierApproval', approval.id,
      `Ops ghi nhận RU APPROVED. Ref: ${refNumber}. Evidence: ${evidenceFileName}`);
    addNotification(txn.companyAId, 'PAYMENT_REQUIRED', `Cần thanh toán ${txn.quote.econtCollectedFromA.toLocaleString('vi-VN')} ₫`, 'Hãng tàu đã duyệt RU. Vui lòng hoàn tất thanh toán trong 2 giờ.', transactionId);
    addNotification(txn.companyBId, 'PAYMENT_REQUIRED', `Cần thanh toán ${txn.quote.econtCollectedFromB.toLocaleString('vi-VN')} ₫`, 'Hãng tàu đã duyệt RU. Vui lòng hoàn tất thanh toán trong 2 giờ.', transactionId);
    return { success: true, message: 'Đã ghi nhận Carrier Approval. Chuyển sang chờ thanh toán.' };
  }, [transactions, requests, currentRole, currentUserEmail, persistTransactions, addAudit, addNotification]);

  const opsRejectCarrier = useCallback((transactionId: string, reason: string): ActionResult => {
    if (currentRole !== 'OPS') {
      return { success: false, message: 'Chỉ Ops mới có quyền này.' };
    }
    const txn = transactions.find(t => t.id === transactionId);
    if (!txn) return { success: false, message: 'Không tìm thấy giao dịch.' };
    if (txn.status !== 'PENDING_CARRIER') {
      return { success: false, message: 'Giao dịch không ở PENDING_CARRIER.' };
    }
    const updatedTxn: Transaction = {
      ...txn, status: 'CARRIER_REJECTED', rowVersion: txn.rowVersion + 1,
      nextAction: `Hãng tàu từ chối RU: ${reason}. Xử lý giải phóng và hoàn tiền.`,
      updatedAt: new Date().toISOString(),
    };
    persistOffers(offers.map(o => o.id === txn.offerId ? { ...o, status: 'AVAILABLE', updatedAt: new Date().toISOString() } : o));
    persistRequests(requests.map(r => r.id === txn.requestId ? { ...r, status: 'OPEN', updatedAt: new Date().toISOString() } : r));
    persistAssets(assets.map(a => a.id === txn.assetId ? { ...a, isLocked: false, activeAllocationId: undefined, updatedAt: new Date().toISOString() } : a));
    persistTransactions(transactions.map(t => t.id === transactionId ? updatedTxn : t));
    addAudit('CARRIER_REJECTION_RECORDED', 'Transaction', transactionId, `Carrier từ chối RU: ${reason}`);
    return { success: true, message: 'Đã ghi nhận carrier từ chối. Offer và Request được giải phóng.' };
  }, [transactions, offers, requests, assets, currentRole, persistOffers, persistRequests, persistAssets, persistTransactions, addAudit]);

  // ==================== PAYMENT ====================

  const submitPayment = useCallback((transactionId: string, party: 'A' | 'B', bankRef: string, amount: number): ActionResult => {
    const txn = transactions.find(t => t.id === transactionId);
    if (!txn) return { success: false, message: 'Không tìm thấy giao dịch.' };
    if (txn.status !== 'AWAITING_PAYMENT') {
      return { success: false, message: `Giao dịch không ở trạng thái AWAITING_PAYMENT (hiện: ${txn.status}).` };
    }

    const isPartyA = party === 'A' && (currentRole === 'ENTERPRISE_A' || currentRole === 'ENTERPRISE_BOTH') && currentCompany.id === txn.companyAId;
    const isPartyB = party === 'B' && (currentRole === 'ENTERPRISE_B' || currentRole === 'ENTERPRISE_BOTH') && currentCompany.id === txn.companyBId;
    if (!isPartyA && !isPartyB) {
      return { success: false, message: `Chỉ đại diện ${party === 'A' ? 'Nhà cung cấp Container' : 'Đơn vị Cần vỏ Container'} mới được gửi xác nhận đã chuyển khoản.` };
    }

    const orderKey = party === 'A' ? 'paymentOrderA' : 'paymentOrderB';
    const existingOrder = txn[orderKey];
    if (!existingOrder) return { success: false, message: 'Không tìm thấy lệnh thanh toán.' };
    if (existingOrder.status === 'PAID') return { success: false, message: `Lệnh thanh toán của ${party === 'A' ? 'Nhà cung cấp Container' : 'Đơn vị Cần vỏ Container'} đã được Ops đối soát.` };
    if (!bankRef.trim()) return { success: false, message: 'Bắt buộc nhập mã tham chiếu chuyển khoản.' };
    if (!Number.isFinite(amount) || amount !== existingOrder.amountVnd) {
      return { success: false, message: `Số tiền phải khớp chính xác lệnh thanh toán: ${existingOrder.amountVnd.toLocaleString('vi-VN')} VND.` };
    }
    if (Date.now() > new Date(existingOrder.expiresAt).getTime()) {
      return { success: false, message: 'Payment deadline đã hết; giao dịch cần được xử lý theo rule quá hạn.' };
    }

    const now = new Date().toISOString();
    const updatedOrder: PaymentOrder = {
      ...existingOrder,
      payerSubmittedAmountVnd: amount,
      payerBankReference: bankRef.trim(),
      payerSubmittedAt: now,
      payerSubmittedBy: currentUserEmail,
    };
    persistTransactions(transactions.map(item => item.id === transactionId
      ? { ...item, [orderKey]: updatedOrder, rowVersion: item.rowVersion + 1, updatedAt: now }
      : item));
    const payerLabel = party === 'A' ? 'Nhà cung cấp Container' : 'Đơn vị Cần vỏ Container';
    addAudit('PAYMENT_SUBMITTED_BY_PARTY', 'PaymentOrder', existingOrder.id,
      `${payerLabel} báo đã chuyển ${amount.toLocaleString('vi-VN')} VND. Ref: ${bankRef.trim()}`);
    addNotification('COMP-OPS', 'PAYMENT_REQUIRED', `${payerLabel} đã chuyển khoản`,
      `Giao dịch ${transactionId} cần Ops đối soát và xác nhận đủ tiền trước khi phát phiếu điều phối.`, transactionId);
    return { success: true, message: `Đã ghi nhận khoản chuyển của ${party === 'A' ? 'Nhà cung cấp Container' : 'Đơn vị Cần vỏ Container'}. Chờ Ops đối soát và xác nhận.` };
  }, [transactions, currentRole, currentCompany.id, currentUserEmail, persistTransactions, addAudit, addNotification]);

  const settlePayment = useCallback((transactionId: string, party: 'A' | 'B', bankRef: string, amount: number): ActionResult => {
    if (currentRole !== 'OPS') {
      return { success: false, message: 'Chỉ Ops mới có thể xác nhận thanh toán.' };
    }
    const txn = transactions.find(t => t.id === transactionId);
    if (!txn) return { success: false, message: 'Không tìm thấy giao dịch.' };
    if (txn.status !== 'AWAITING_PAYMENT') {
      return { success: false, message: `Giao dịch không ở trạng thái AWAITING_PAYMENT (hiện: ${txn.status}).` };
    }

    const now = new Date().toISOString();
    const orderKey = party === 'A' ? 'paymentOrderA' : 'paymentOrderB';
    const existingOrder = txn[orderKey];
    if (existingOrder && (!Number.isFinite(amount) || amount !== existingOrder.amountVnd)) {
      return { success: false, message: `Sá»‘ tiá»n pháº£i khÃ›p chÃ­nh xÃ¡c lá»‡nh thanh toÃ¡n: ${existingOrder?.amountVnd.toLocaleString('vi-VN')} VND.` };
    }
    if (!bankRef.trim()) {
      return { success: false, message: 'Báº¯t buá»™c nháº­p mÃ£ tham chiáº¿u chuyá»ƒn khoáº£n.' };
    }
    if (existingOrder && Date.now() > new Date(existingOrder.expiresAt).getTime()) {
      return { success: false, message: 'Payment deadline Ä‘Ã£ háº¿t; giao dá»‹ch cáº§n auto-cancel theo rule QA.' };
    }
    if (!existingOrder) return { success: false, message: 'Không tìm thấy lệnh thanh toán.' };

    const updatedOrder: PaymentOrder = {
      ...existingOrder,
      status: 'PAID',
      paidAmountVnd: amount,
      bankReference: bankRef,
      settledAt: now,
      settledBy: currentUserEmail,
    };

    let updatedTxn: Transaction = {
      ...txn,
      [orderKey]: updatedOrder,
      rowVersion: txn.rowVersion + 1,
      updatedAt: now,
    };

    persistTransactions(transactions.map(t => t.id === transactionId ? updatedTxn : t));
    addAudit('PAYMENT_SETTLED', 'PaymentOrder', existingOrder.id,
      `Ops xác nhận thanh toán của ${party === 'A' ? 'Nhà cung cấp Container' : 'Đơn vị Cần vỏ Container'}: ${amount.toLocaleString('vi-VN')} ₫. Ref: ${bankRef}`);
    const paidA = party === 'A' ? true : txn.paymentOrderA?.status === 'PAID';
    const paidB = party === 'B' ? true : txn.paymentOrderB?.status === 'PAID';
    if (paidA && paidB) {
      addNotification('COMP-OPS', 'PAYMENT_REQUIRED', 'Đã đủ tiền hai bên — chờ Ops xác nhận',
        `Giao dịch ${transactionId} đã được Ops đối soát đủ hai lệnh. Ops cần xác nhận trước khi phát phiếu điều phối.`, transactionId);
    }
    return { success: true, message: paidA && paidB
      ? 'Đã đối soát đủ tiền của hai đối tác. Chờ Ops xác nhận để phát phiếu điều phối.'
      : `Đã xác nhận thanh toán của ${party === 'A' ? 'Nhà cung cấp Container' : 'Đơn vị Cần vỏ Container'}. Chờ đối tác còn lại thanh toán.` };
  }, [transactions, currentRole, currentUserEmail, persistTransactions, addAudit, addNotification]);

  const opsConfirmPayments = useCallback((transactionId: string, note = ''): ActionResult => {
    if (currentRole !== 'OPS') {
      return { success: false, message: 'Chỉ Ops mới có thể xác nhận đủ tiền và phát phiếu điều phối.' };
    }
    const txn = transactions.find(t => t.id === transactionId);
    if (!txn) return { success: false, message: 'Không tìm thấy giao dịch.' };
    if (txn.status !== 'AWAITING_PAYMENT') {
      return { success: false, message: `Giao dịch không ở trạng thái AWAITING_PAYMENT (hiện: ${txn.status}).` };
    }
    if (txn.paymentOrderA?.status !== 'PAID' || txn.paymentOrderB?.status !== 'PAID') {
      return { success: false, message: 'Chưa thể xác nhận: Ops chưa đối soát đủ tiền của cả hai đối tác.' };
    }
    if (txn.paymentConfirmedAt) {
      return { success: false, message: 'Khoản thanh toán của giao dịch đã được Ops xác nhận.' };
    }

    const now = new Date().toISOString();
    const transitionTxn: Transaction = { ...txn, paymentConfirmedAt: now, paymentConfirmedBy: currentUserEmail };
    const check = canTransitionTo(transitionTxn, 'READY_FOR_PICKUP');
    if (!check.allowed) return { success: false, message: check.reason || 'Chưa đủ điều kiện phát phiếu điều phối.' };

    const permit: DispatchPermit = {
      id: genId('PERMIT'),
      transactionId,
      permitNumber: `ECONT-DP-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}-${transactionId.split('-').pop()}`,
      verificationToken: Math.random().toString(36).substring(2, 12).toUpperCase(),
      driverName: 'Chưa khai báo',
      truckPlate: 'Chưa khai báo',
      validFrom: now,
      validUntil: new Date(Date.now() + 48 * 3600000).toISOString(),
      status: 'ACTIVE',
      generatedAt: now,
    };
    const updatedTxn: Transaction = {
      ...transitionTxn,
      status: 'READY_FOR_PICKUP',
      paymentConfirmationNote: note.trim() || undefined,
      dispatchPermit: permit,
      dueAt: new Date(Date.now() + 48 * 3600000).toISOString(),
      nextAction: 'Ops đã xác nhận đủ tiền và phát Phiếu điều phối. Tài xế chuẩn bị phương tiện đến kho nhà cung cấp.',
      rowVersion: txn.rowVersion + 1,
      updatedAt: now,
    };
    persistTransactions(transactions.map(t => t.id === transactionId ? updatedTxn : t));
    addAudit('PAYMENT_RELEASE_CONFIRMED_BY_OPS', 'Transaction', transactionId,
      `Ops xác nhận đủ tiền của hai đối tác và phát phiếu ${permit.permitNumber}${note.trim() ? `: ${note.trim()}` : ''}`);
    addNotification(txn.companyAId, 'TRANSACTION_UPDATE', 'Ops đã xác nhận đủ tiền', 'Phiếu điều phối đã được phát. Đơn vị cần vỏ sẽ đến nhận cont.', transactionId);
    addNotification(txn.companyBId, 'TRANSACTION_UPDATE', 'Ops đã xác nhận đủ tiền', 'Phiếu điều phối đã được phát. Vui lòng chuẩn bị xe và người nhận đến điểm giao.', transactionId);
    return { success: true, message: 'Đã xác nhận đủ tiền của hai đối tác. Phiếu điều phối đã được phát; giao dịch sẵn sàng lấy cont.' };
  }, [transactions, currentRole, currentUserEmail, persistTransactions, addAudit, addNotification]);

  // ==================== HANDOVER ====================

  const generateDispatchPermit = useCallback((transactionId: string, driverName: string, truckPlate: string): ActionResult => {
    const txn = transactions.find(t => t.id === transactionId);
    if (!txn) return { success: false, message: 'Không tìm thấy giao dịch.' };
    if (!txn.dispatchPermit) return { success: false, message: 'Chưa có phiếu điều phối.' };
    const updated = { ...txn.dispatchPermit, driverName, truckPlate };
    persistTransactions(transactions.map(t => t.id === transactionId ? { ...t, dispatchPermit: updated, updatedAt: new Date().toISOString() } : t));
    addAudit('DISPATCH_PERMIT_UPDATED', 'DispatchPermit', txn.dispatchPermit.id, `Cập nhật tài xế: ${driverName}, xe: ${truckPlate}`);
    return { success: true, message: 'Đã cập nhật thông tin tài xế vào phiếu điều phối.' };
  }, [transactions, persistTransactions, addAudit]);

  const activateInspection = useCallback((transactionId: string): ActionResult => {
    const txn = transactions.find(t => t.id === transactionId);
    if (!txn) return { success: false, message: 'Không tìm thấy giao dịch.' };
    const check = canTransitionTo(txn, 'INSPECTION');
    if (!check.allowed) return { success: false, message: check.reason || 'Không thể chuyển sang INSPECTION.' };
    const updatedTxn: Transaction = {
      ...txn, status: 'INSPECTION', rowVersion: txn.rowVersion + 1,
      nextAction: 'Đại diện đơn vị Cần vỏ Container tiến hành kiểm tra thực tế 6 mặt container.',
      updatedAt: new Date().toISOString(),
    };
    persistTransactions(transactions.map(t => t.id === transactionId ? updatedTxn : t));
    addAudit('TRANSACTION_STATUS_CHANGED', 'Transaction', transactionId, 'READY_FOR_PICKUP → INSPECTION.');
    return { success: true, message: 'Đã kích hoạt bước kiểm tra.' };
  }, [transactions, persistTransactions, addAudit]);

  const submitInspection = useCallback((transactionId: string, data: {
    inspectorName: string;
    checklistFloor: boolean; checklistWalls: boolean; checklistRoof: boolean;
    checklistDoors: boolean; checklistGaskets: boolean; checklistUndercarriage: boolean;
    isDiscrepancyFound: boolean; discrepancyNotes?: string; discrepancySeverity?: 'MINOR' | 'MAJOR';
  }): ActionResult => {
    const txn = transactions.find(t => t.id === transactionId);
    if (!txn) return { success: false, message: 'Không tìm thấy giao dịch.' };
    if (txn.status !== 'INSPECTION') {
      return { success: false, message: 'Giao dịch không ở trạng thái INSPECTION.' };
    }
    if (txn.isOnHold) {
      return { success: false, message: 'Giao dịch đang ON_HOLD. Ops cần xử lý Case trước khi kiểm tra lại.' };
    }
    if (txn.companyBId !== currentCompany.id && currentRole !== 'OPS') {
      return { success: false, message: 'Chỉ đại diện đơn vị Cần vỏ Container mới có thể nộp biên bản kiểm tra.' };
    }

    const inspection: Inspection = {
      id: genId('INSP'),
      transactionId,
      inspectorName: data.inspectorName,
      inspectorCompanyId: currentCompany.id,
      checklistFloor: data.checklistFloor,
      checklistWalls: data.checklistWalls,
      checklistRoof: data.checklistRoof,
      checklistDoors: data.checklistDoors,
      checklistGaskets: data.checklistGaskets,
      checklistUndercarriage: data.checklistUndercarriage,
      isDiscrepancyFound: data.isDiscrepancyFound,
      discrepancyNotes: data.discrepancyNotes,
      discrepancySeverity: data.discrepancySeverity,
      photoIds: [],
      inspectedAt: new Date().toISOString(),
      version: 1,
      contentHash: `sha256-insp-${Math.random().toString(36).substring(2)}`,
    };

    let nextAction = 'Kiểm tra hoàn tất. Chờ hai bên xác nhận bàn giao.';
    let newStatus: TransactionStatus = 'HANDOVER_PENDING';
    let createdCase: CaseIssue | undefined;

    // Any physical discrepancy must stop the handover first and create a Case.
    if (data.isDiscrepancyFound) {
      if (!data.discrepancyNotes?.trim()) {
        return { success: false, message: 'Phải mô tả sai lệch trước khi tạo Case.' };
      }
      const existingOpenCase = cases.find(item =>
        item.transactionId === transactionId &&
        item.caseType === 'CONDITION_MISMATCH' &&
        !['RESOLVED', 'CLOSED'].includes(item.status)
      );
      if (existingOpenCase) {
        return { success: false, message: `Giao dịch đã có Case đang xử lý (${existingOpenCase.id}).` };
      }
      const caseNow = new Date().toISOString();
      createdCase = {
        id: genId('CASE'),
        transactionId,
        assetId: txn.assetId,
        openedByCompanyId: currentCompany.id,
        openedByCompanyName: currentCompany.shortName,
        assignedToOpsEmail: 'ops.lead@econt.vn',
        caseType: 'CONDITION_MISMATCH',
        title: `Sai lệch tình trạng container ${txn.asset.containerNumber}`,
        description: data.discrepancyNotes.trim(),
        status: 'OPEN',
        priority: data.discrepancySeverity === 'MAJOR' ? 'CRITICAL' : 'HIGH',
        holdTransactionId: transactionId,
        createdAt: caseNow,
        updatedAt: caseNow,
      };
      setCases(previous => [createdCase!, ...previous]);
      newStatus = 'INSPECTION';
      nextAction = `ON_HOLD vì sai lệch thực tế. Ops xử lý Case ${createdCase.id} trước khi tiếp tục bàn giao.`;
    }

    // Tạo HandoverRecord
    const handoverRecord: HandoverRecord = {
      id: genId('HOR'),
      transactionId,
      version: 1,
      contentHash: `sha256-ho-${Math.random().toString(36).substring(2)}`,
      status: 'PENDING_CONFIRMATION',
    };

    const updatedTxn: Transaction = {
      ...txn,
      status: newStatus,
      isOnHold: Boolean(createdCase),
      holdReason: createdCase ? `Case ${createdCase.id}: ${createdCase.title}` : undefined,
      holdSetAt: createdCase?.createdAt,
      holdSetBy: createdCase ? currentUserEmail : undefined,
      holdCaseId: createdCase?.id,
      inspection,
      handoverRecord: createdCase ? undefined : handoverRecord,
      rowVersion: txn.rowVersion + 1,
      nextAction,
      updatedAt: new Date().toISOString(),
    };
    persistTransactions(transactions.map(t => t.id === transactionId ? updatedTxn : t));
    addAudit('INSPECTION_SUBMITTED', 'Inspection', inspection.id,
      `Biên bản kiểm tra: ${data.isDiscrepancyFound ? `Sai lệch ${data.discrepancySeverity}: ${data.discrepancyNotes}` : 'Đạt yêu cầu'}`);
    if (createdCase) {
      addAudit('CASE_CREATED', 'CaseIssue', createdCase.id, `Tự động tạo Case từ biên bản kiểm tra: ${createdCase.description}`);
      addNotification('COMP-OPS', 'OPS_ALERT', `Cần xử lý Case ${createdCase.id}`, `Giao dịch ${transactionId} đã ON_HOLD vì sai lệch container.`, createdCase.id);
    }
    return { success: true, message: createdCase
      ? `Đã ghi nhận sai lệch và tạo Case ${createdCase.id}. Giao dịch đang ON_HOLD.`
      : 'Kiểm tra hoàn tất. Chuyển sang bàn giao.' };
  }, [transactions, cases, currentRole, currentCompany, currentUserEmail, persistTransactions, addAudit, addNotification]);

  const confirmHandoverA = useCallback((transactionId: string): ActionResult => {
    const txn = transactions.find(t => t.id === transactionId);
    if (!txn) return { success: false, message: 'Không tìm thấy giao dịch.' };
    if (txn.status !== 'HANDOVER_PENDING') return { success: false, message: 'Giao dịch không ở HANDOVER_PENDING.' };
    if (txn.companyAId !== currentCompany.id || (currentRole !== 'ENTERPRISE_A' && currentRole !== 'ENTERPRISE_BOTH')) {
      return { success: false, message: 'Chỉ đại diện Nhà cung cấp Container mới có thể xác nhận đã giao.' };
    }
    if (txn.handoverRecord?.confirmationA) {
      return { success: false, message: 'Nhà cung cấp Container đã xác nhận rồi.' };
    }

    const record = txn.handoverRecord!;
    const confirmation = {
      confirmedAt: new Date().toISOString(),
      confirmedBy: currentUserEmail,
      companyId: currentCompany.id,
      recordVersion: record.version,
      recordHash: record.contentHash,
    };
    const updatedRecord: HandoverRecord = { ...record, confirmationA: confirmation };
    let updatedTxn: Transaction = {
      ...txn,
      handoverRecord: updatedRecord,
      rowVersion: txn.rowVersion + 1,
      updatedAt: new Date().toISOString(),
    };

    // Kiểm tra cả hai đã xác nhận chưa
    if (updatedRecord.confirmationB) {
      const check = canTransitionTo(updatedTxn, 'COMPLETED');
      if (check.allowed) {
        updatedTxn = {
          ...updatedTxn,
          status: 'COMPLETED',
          nextAction: 'Giao nhận hoàn tất. Quyền quản lý cont đã chuyển sang đơn vị Cần vỏ Container.',
          handoverRecord: {
            ...updatedRecord,
            status: 'COMPLETED',
            completedAt: new Date().toISOString(),
          },
        };
        // Cập nhật custody
        const updatedAssets = assets.map(a =>
          a.id === txn.assetId ? {
            ...a,
            currentCustodianId: txn.companyBId,
            currentCustodianName: txn.companyBName,
            isLocked: false,
            activeAllocationId: undefined,
            physicalStatus: 'AT_CUSTOMER' as const,
            updatedAt: new Date().toISOString(),
          } : a
        );
        persistAssets(updatedAssets);
        persistOffers(offers.map(o => o.id === txn.offerId ? { ...o, status: 'FULFILLED', updatedAt: new Date().toISOString() } : o));
        persistRequests(requests.map(r => r.id === txn.requestId ? { ...r, status: 'FULFILLED', updatedAt: new Date().toISOString() } : r));
        addAudit('TRANSACTION_COMPLETED', 'Transaction', transactionId,
          `Giao nhận HOÀN TẤT. Custody chuyển từ ${txn.companyAName} → ${txn.companyBName}`);
        addNotification(txn.companyAId, 'TRANSACTION_UPDATE', `Giao dịch ${transactionId} HOÀN TẤT ✓`, 'Cont đã được bàn giao thành công.', transactionId);
        addNotification(txn.companyBId, 'TRANSACTION_UPDATE', `Giao dịch ${transactionId} HOÀN TẤT ✓`, 'Đã nhận cont. Vui lòng đánh giá Nhà cung cấp Container.', transactionId);
      }
    }

    persistTransactions(transactions.map(t => t.id === transactionId ? updatedTxn : t));
    addAudit('HANDOVER_CONFIRMED_BY_A', 'HandoverRecord', record.id, `Nhà cung cấp Container xác nhận đã giao. Hash: ${record.contentHash}`);
    return { success: true, message: updatedTxn.status === 'COMPLETED' ? 'Hoàn tất! Quyền quản lý cont đã chuyển sang đơn vị Cần vỏ Container.' : 'Nhà cung cấp Container đã xác nhận đã giao. Chờ đơn vị cần vỏ.' };
  }, [transactions, assets, offers, requests, currentRole, currentCompany, currentUserEmail, persistAssets, persistOffers, persistRequests, persistTransactions, addAudit, addNotification]);

  const confirmHandoverB = useCallback((transactionId: string): ActionResult => {
    const txn = transactions.find(t => t.id === transactionId);
    if (!txn) return { success: false, message: 'Không tìm thấy giao dịch.' };
    if (txn.status !== 'HANDOVER_PENDING') return { success: false, message: 'Giao dịch không ở HANDOVER_PENDING.' };
    if (txn.companyBId !== currentCompany.id || (currentRole !== 'ENTERPRISE_B' && currentRole !== 'ENTERPRISE_BOTH')) {
      return { success: false, message: 'Chỉ đại diện đơn vị Cần vỏ Container mới có thể xác nhận đã nhận.' };
    }
    if (txn.handoverRecord?.confirmationB) {
      return { success: false, message: 'Đơn vị Cần vỏ Container đã xác nhận rồi.' };
    }

    const record = txn.handoverRecord!;
    const confirmation = {
      confirmedAt: new Date().toISOString(),
      confirmedBy: currentUserEmail,
      companyId: currentCompany.id,
      recordVersion: record.version,
      recordHash: record.contentHash,
    };
    const updatedRecord: HandoverRecord = { ...record, confirmationB: confirmation };
    let updatedTxn: Transaction = {
      ...txn,
      handoverRecord: updatedRecord,
      rowVersion: txn.rowVersion + 1,
      updatedAt: new Date().toISOString(),
    };

    if (updatedRecord.confirmationA) {
      const check = canTransitionTo(updatedTxn, 'COMPLETED');
      if (check.allowed) {
        updatedTxn = {
          ...updatedTxn,
          status: 'COMPLETED',
          nextAction: 'Giao nhận hoàn tất. Quyền quản lý cont đã chuyển sang đơn vị Cần vỏ Container.',
          handoverRecord: { ...updatedRecord, status: 'COMPLETED', completedAt: new Date().toISOString() },
        };
        const updatedAssets = assets.map(a =>
          a.id === txn.assetId ? {
            ...a,
            currentCustodianId: txn.companyBId,
            currentCustodianName: txn.companyBName,
            isLocked: false,
            activeAllocationId: undefined,
            physicalStatus: 'AT_CUSTOMER' as const,
            updatedAt: new Date().toISOString(),
          } : a
        );
        persistAssets(updatedAssets);
        persistOffers(offers.map(o => o.id === txn.offerId ? { ...o, status: 'FULFILLED', updatedAt: new Date().toISOString() } : o));
        persistRequests(requests.map(r => r.id === txn.requestId ? { ...r, status: 'FULFILLED', updatedAt: new Date().toISOString() } : r));
        addAudit('TRANSACTION_COMPLETED', 'Transaction', transactionId, `Giao nhận HOÀN TẤT. Custody → ${txn.companyBName}`);
      }
    }

    persistTransactions(transactions.map(t => t.id === transactionId ? updatedTxn : t));
    addAudit('HANDOVER_CONFIRMED_BY_B', 'HandoverRecord', record.id, `Đơn vị Cần vỏ Container xác nhận đã nhận. Hash: ${record.contentHash}`);
    return { success: true, message: updatedTxn.status === 'COMPLETED' ? 'Hoàn tất giao nhận!' : 'Đơn vị Cần vỏ Container đã xác nhận nhận. Chờ Nhà cung cấp Container.' };
  }, [transactions, assets, offers, requests, currentRole, currentCompany, currentUserEmail, persistAssets, persistOffers, persistRequests, persistTransactions, addAudit, addNotification]);

  // ==================== HOLD & CASE ====================

  const toggleHold = useCallback((transactionId: string, isOnHold: boolean, reason?: string, caseId?: string): ActionResult => {
    if (currentRole !== 'OPS') {
      return { success: false, message: 'Chỉ Ops mới có thể đặt/gỡ trạng thái tạm dừng.' };
    }
    const txn = transactions.find(t => t.id === transactionId);
    if (!txn) return { success: false, message: 'Không tìm thấy giao dịch.' };
    if (isOnHold && !reason?.trim()) return { success: false, message: 'Lý do tạm dừng giao dịch không được để trống.' };
    if (!isOnHold && txn.holdCaseId) {
      const holdCase = cases.find(item => item.id === txn.holdCaseId);
      if (holdCase && !['RESOLVED', 'CLOSED'].includes(holdCase.status)) {
        return { success: false, message: `Chưa thể gỡ ON_HOLD: cần Ops kết luận Case ${holdCase.id} trước.` };
      }
    }
    const updatedTxn: Transaction = {
      ...txn,
      isOnHold,
      holdReason: isOnHold ? (reason || 'Đang xử lý sự cố') : undefined,
      holdSetAt: isOnHold ? new Date().toISOString() : undefined,
      holdSetBy: isOnHold ? currentUserEmail : undefined,
      holdCaseId: isOnHold ? caseId : undefined,
      rowVersion: txn.rowVersion + 1,
      updatedAt: new Date().toISOString(),
    };
    persistTransactions(transactions.map(t => t.id === transactionId ? updatedTxn : t));
    addAudit(isOnHold ? 'TRANSACTION_PUT_ON_HOLD' : 'TRANSACTION_HOLD_RELEASED', 'Transaction', transactionId,
      isOnHold ? `Tạm dừng: ${reason}` : 'Gỡ tạm dừng');
    return { success: true, message: isOnHold ? 'Đã tạm dừng giao dịch.' : 'Đã gỡ tạm dừng giao dịch.' };
  }, [transactions, cases, currentRole, currentUserEmail, persistTransactions, addAudit]);

  const addCase = useCallback((c: Omit<CaseIssue, 'id' | 'createdAt' | 'updatedAt'>): ActionResult => {
    const isOpsUser = currentRole === 'OPS';
    if (!isOpsUser && currentRole !== 'ENTERPRISE_A' && currentRole !== 'ENTERPRISE_B' && currentRole !== 'ENTERPRISE_BOTH') {
      return { success: false, message: 'Chỉ nhà cung cấp, đơn vị cần vỏ hoặc Ops được mở Case.' };
    }
    if (!c.title?.trim() || !c.description?.trim()) return { success: false, message: 'TiÃªu Ä‘á» vÃ  mÃ´ táº£ Case lÃ  báº¯t buá»™c.' };
    if (c.transactionId) {
      const txn = transactions.find(item => item.id === c.transactionId);
      if (!txn) return { success: false, message: 'Giao dá»‹ch trong Case khÃ´ng tá»“n táº¡i.' };
      if (txn.status === 'COMPLETED') return { success: false, message: 'Giao dá»‹ch COMPLETED khÃ´ng Ä‘Æ°á»£c má»Ÿ Dispute má»›i.' };
      if (!isOpsUser && txn.companyAId !== currentCompany.id && txn.companyBId !== currentCompany.id) {
        return { success: false, message: 'Báº¡n khÃ´ng pháº£i bÃªn tham gia giao dá»‹ch.' };
      }
      if (!isWithinDisputeWindow(txn.createdAt)) {
        return { success: false, message: 'Case Ä‘Ã£ quÃ¡ thá»i háº¡n 7 ngÃ y.' };
      }
    }
    const newCase: CaseIssue = {
      ...c,
      id: genId('CASE'),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setCases(prev => [newCase, ...prev]);
    if (c.transactionId && !isOpsUser) {
      persistTransactions(transactions.map(txn => txn.id === c.transactionId
        ? { ...txn, status: 'DISPUTED', isOnHold: true, holdReason: `Case ${newCase.id}: ${newCase.title}`, holdCaseId: newCase.id, rowVersion: txn.rowVersion + 1, updatedAt: newCase.createdAt }
        : txn));
    }
    addAudit('CASE_CREATED', 'CaseIssue', newCase.id, `Tạo Case: ${newCase.title}`);
    return { success: true, message: 'Đã tạo Case thành công.', data: newCase };
  }, [addAudit, currentRole, currentCompany.id, transactions, persistTransactions]);

  const updateCase = useCallback((caseId: string, updates: Partial<CaseIssue>): ActionResult => {
    const c = cases.find(item => item.id === caseId);
    if (currentRole !== 'OPS' && c && c.openedByCompanyId !== currentCompany.id) {
      return { success: false, message: 'Chỉ người đăng Case mới được chỉnh sửa Case này.' };
    }
    if (!c) return { success: false, message: 'Không tìm thấy Case.' };
    if (c.status === 'CLOSED') return { success: false, message: 'Case đã đóng không thể chỉnh sửa.' };
    if (updates.title !== undefined && !updates.title.trim()) return { success: false, message: 'TiÃªu Ä‘á» Case khÃ´ng Ä‘Æ°á»£c Ä‘á»ƒ trá»‘ng.' };
    if (updates.description !== undefined && !updates.description.trim()) return { success: false, message: 'MÃ´ táº£ Case khÃ´ng Ä‘Æ°á»£c Ä‘á»ƒ trá»‘ng.' };
    setCases(prev => prev.map(item => item.id === caseId ? { ...item, ...updates, updatedAt: new Date().toISOString() } : item));
    addAudit('CASE_UPDATED', 'CaseIssue', caseId, `Cập nhật thông tin Case ${caseId}`);
    return { success: true, message: 'Đã cập nhật Case thành công.' };
  }, [cases, currentRole, currentCompany.id, addAudit]);

  const deleteCase = useCallback((caseId: string): ActionResult => {
    const c = cases.find(item => item.id === caseId);
    if (currentRole !== 'OPS' && c && c.openedByCompanyId !== currentCompany.id) {
      return { success: false, message: 'Chỉ người đăng Case mới được xóa Case này.' };
    }
    if (!c) return { success: false, message: 'Không tìm thấy Case.' };
    if (c.status !== 'OPEN' && currentRole !== 'OPS') {
      return { success: false, message: 'Chỉ có thể xóa Case khi đang ở trạng thái OPEN.' };
    }
    setCases(prev => prev.filter(item => item.id !== caseId));
    addAudit('CASE_DELETED', 'CaseIssue', caseId, `Xóa Case ${caseId}`);
    return { success: true, message: 'Đã xóa Case thành công.' };
  }, [cases, currentRole, currentCompany.id, addAudit]);

  const resolveCase = useCallback((caseId: string, resolution: NonNullable<CaseIssue['resolution']>): ActionResult => {
    if (currentRole !== 'OPS') {
      return { success: false, message: 'Chỉ Ops mới có thể kết luận Case.' };
    }
    if (!resolution.summary?.trim()) return { success: false, message: 'Tóm tắt kết luận Case không được để trống.' };
    const existingCase = cases.find(c => c.id === caseId);
    if (!existingCase) return { success: false, message: 'KhÃ´ng tÃ¬m tháº¥y Case.' };
    if (!['OPEN', 'IN_REVIEW', 'NEEDS_INFO'].includes(existingCase.status)) {
      return { success: false, message: 'Case khÃ´ng cÃ²n á»Ÿ tráº¡ng thÃ¡i cÃ³ thá»ƒ káº¿t luáº­n.' };
    }
    setCases(prev => prev.map(c =>
      c.id === caseId ? {
        ...c, status: 'RESOLVED', resolution,
        updatedAt: new Date().toISOString(),
      } : c
    ));
    addAudit('CASE_RESOLVED', 'CaseIssue', caseId, `Kết luận Case: ${resolution.summary}`);
    return { success: true, message: 'Đã kết luận Case.' };
  }, [currentRole, cases, addAudit]);

  const closeCase = useCallback((caseId: string): ActionResult => {
    if (currentRole !== 'OPS') {
      return { success: false, message: 'Chá»‰ Ops má»›i cÃ³ thá»ƒ Ä‘Ã³ng Case.' };
    }
    setCases(prev => prev.map(c =>
      c.id === caseId ? { ...c, status: 'CLOSED', closedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } : c
    ));
    addAudit('CASE_CLOSED', 'CaseIssue', caseId, 'Đóng Case');
    return { success: true, message: 'Đã đóng Case.' };
  }, [currentRole, addAudit]);

  // ==================== COMPANY ACTIONS ====================

  const addCompany = useCallback((comp: Omit<Company, 'id' | 'totalCompletedAsA' | 'totalCompletedAsB'>): ActionResult => {
    if (currentRole !== 'OPS') {
      return { success: false, message: 'Chỉ Ops hoặc Quản trị viên mới có quyền thêm doanh nghiệp.' };
    }
    if (!comp.companyName?.trim() || !comp.shortName?.trim() || !comp.taxCode?.trim() || !comp.address?.trim() || !comp.representativeName?.trim() || !comp.representativePhone?.trim() || !comp.representativeEmail?.trim()) {
      return { success: false, message: 'Thông tin doanh nghiệp bắt buộc chưa đầy đủ.' };
    }
    if (!/^\d{8,14}$/.test(comp.taxCode.trim())) return { success: false, message: 'Mã số thuế phải gồm 8–14 chữ số.' };
    if (!/^\S+@\S+\.\S+$/.test(comp.representativeEmail.trim())) return { success: false, message: 'Email doanh nghiệp không hợp lệ.' };
    if (companies.some(company => company.taxCode === comp.taxCode.trim())) {
      return { success: false, message: 'Mã số thuế đã tồn tại trong hệ thống.' };
    }
    const newComp: Company = {
      ...comp,
      taxCode: comp.taxCode.trim(),
      id: genId('COMP'),
      totalCompletedAsA: 0,
      totalCompletedAsB: 0,
    };
    persistCompanies([...companies, newComp]);
    addAudit('COMPANY_CREATED', 'Company', newComp.id, `Tạo mới DN ${newComp.companyName} (${newComp.taxCode})`);
    return { success: true, message: `Đã thêm doanh nghiệp ${newComp.shortName} thành công.`, data: newComp };
  }, [companies, currentRole, persistCompanies, addAudit]);

  const submitCompanyRegistration = useCallback((comp: Omit<Company, 'id' | 'totalCompletedAsA' | 'totalCompletedAsB'>): ActionResult => {
    if (!comp.companyName?.trim() || !comp.shortName?.trim() || !comp.taxCode?.trim() || !comp.address?.trim() || !comp.representativeName?.trim() || !comp.representativePhone?.trim() || !comp.representativeEmail?.trim()) {
      return { success: false, message: 'Thông tin doanh nghiệp bắt buộc chưa đầy đủ.' };
    }
    if (!/^\S+@\S+\.\S+$/.test(comp.representativeEmail.trim())) return { success: false, message: 'Email doanh nghiệp không hợp lệ.' };
    const normalizedTaxCode = comp.taxCode.trim();
    if (companies.some(company => company.taxCode === normalizedTaxCode)) {
      return { success: false, message: 'Mã số thuế đã tồn tại trong hệ thống.' };
    }
    const newComp: Company = {
      ...comp,
      taxCode: normalizedTaxCode,
      id: genId('COMP'),
      verificationStatus: 'PENDING_VERIFICATION',
      verificationNotes: 'Hồ sơ mới đăng ký, chờ Ops đối chiếu thông tin doanh nghiệp.',
      totalCompletedAsA: 0,
      totalCompletedAsB: 0,
    };
    persistCompanies([...companies, newComp]);
    addAudit('COMPANY_REGISTRATION_SUBMITTED', 'Company', newComp.id, `Đăng ký DN ${newComp.companyName}; chờ Ops xác minh`);
    return { success: true, message: 'Đã tiếp nhận hồ sơ doanh nghiệp, chờ Ops xác minh.', data: newComp };
  }, [companies, persistCompanies, addAudit]);

  const updateCompany = useCallback((id: string, updates: Partial<Company>): ActionResult => {
    if (currentRole !== 'OPS') {
      return { success: false, message: 'Chỉ Ops hoặc Quản trị viên mới có quyền sửa doanh nghiệp.' };
    }
    const comp = companies.find(c => c.id === id);
    if (!comp) return { success: false, message: 'Không tìm thấy doanh nghiệp.' };
    const updated = { ...comp, ...updates };
    if (!updated.companyName?.trim() || !updated.shortName?.trim() || !updated.taxCode?.trim() || !updated.address?.trim() || !updated.representativeName?.trim() || !updated.representativePhone?.trim() || !updated.representativeEmail?.trim()) {
      return { success: false, message: 'Thông tin doanh nghiệp bắt buộc chưa đầy đủ.' };
    }
    if (!/^\d{8,14}$/.test(updated.taxCode.trim())) return { success: false, message: 'Mã số thuế phải gồm 8–14 chữ số.' };
    if (!/^\S+@\S+\.\S+$/.test(updated.representativeEmail.trim())) return { success: false, message: 'Email doanh nghiệp không hợp lệ.' };
    if (companies.some(company => company.id !== id && company.taxCode === updated.taxCode.trim())) {
      return { success: false, message: 'Mã số thuế đã tồn tại trong hệ thống.' };
    }
    updated.taxCode = updated.taxCode.trim();
    persistCompanies(companies.map(c => c.id === id ? updated : c));
    addAudit('COMPANY_UPDATED', 'Company', id, `Cập nhật thông tin DN ${comp.shortName}`);
    return { success: true, message: `Đã cập nhật doanh nghiệp ${comp.shortName} thành công.` };
  }, [companies, currentRole, persistCompanies, addAudit]);

  const deleteCompany = useCallback((id: string): ActionResult => {
    if (currentRole !== 'OPS') {
      return { success: false, message: 'Chỉ Super Admin mới có quyền xóa doanh nghiệp.' };
    }
    const comp = companies.find(c => c.id === id);
    if (!comp) return { success: false, message: 'Không tìm thấy doanh nghiệp.' };
    persistCompanies(companies.filter(c => c.id !== id));
    addAudit('COMPANY_DELETED', 'Company', id, `Xóa DN ${comp.shortName}`);
    return { success: true, message: `Đã xóa doanh nghiệp ${comp.shortName}.` };
  }, [companies, currentRole, persistCompanies, addAudit]);

  // ==================== CANCEL ====================

  const cancelTransaction = useCallback((transactionId: string, reason: string): ActionResult => {
    const txn = transactions.find(t => t.id === transactionId);
    if (!txn) return { success: false, message: 'Không tìm thấy giao dịch.' };
    if (!reason.trim()) return { success: false, message: 'Lý do hủy giao dịch không được để trống.' };
    const check = canTransitionTo(txn, 'CANCELLED');
    if (!check.allowed) return { success: false, message: check.reason || 'Không thể hủy.' };

    const updatedTxn: Transaction = {
      ...txn, status: 'CANCELLED', rowVersion: txn.rowVersion + 1,
      nextAction: `Giao dịch bị hủy: ${reason}`,
      updatedAt: new Date().toISOString(),
    };
    persistOffers(offers.map(o => o.id === txn.offerId ? { ...o, status: 'AVAILABLE', updatedAt: new Date().toISOString() } : o));
    persistRequests(requests.map(r => r.id === txn.requestId ? { ...r, status: 'OPEN', updatedAt: new Date().toISOString() } : r));
    const updatedAssets = assets.map(a =>
      a.id === txn.assetId ? { ...a, isLocked: false, activeAllocationId: undefined, updatedAt: new Date().toISOString() } : a
    );
    persistAssets(updatedAssets);
    persistTransactions(transactions.map(t => t.id === transactionId ? updatedTxn : t));
    addAudit('TRANSACTION_CANCELLED', 'Transaction', transactionId, `Hủy giao dịch: ${reason}`);
    return { success: true, message: 'Đã hủy giao dịch. Offer và Request được giải phóng.' };
  }, [transactions, assets, offers, requests, persistAssets, persistOffers, persistRequests, persistTransactions, addAudit]);

  // ==================== CHAT ====================

  const startChatThread = useCallback((thread: Omit<ChatThread, 'id' | 'createdAt' | 'updatedAt'>): string | null => {
    if (thread.companyAId === thread.companyBId || !thread.requestId) return null;
    const offer = thread.offerId ? offers.find(item => item.id === thread.offerId) : undefined;
    const request = requests.find(item => item.id === thread.requestId);
    if (!request || request.companyId !== thread.companyBId) return null;
    if (offer && offer.companyId !== thread.companyAId) return null;
    if (currentRole !== 'OPS' && currentCompany.id !== thread.companyAId && currentCompany.id !== thread.companyBId) return null;
    const existing = chatThreads.find(t =>
      t.companyAId === thread.companyAId && t.companyBId === thread.companyBId &&
      t.offerId === thread.offerId && t.requestId === thread.requestId
    );
    if (existing) return existing.id;
    const companyAName = thread.companyAName?.trim()
      || offer?.companyName
      || companies.find(company => company.id === thread.companyAId)?.shortName
      || thread.companyAId;
    const companyBName = thread.companyBName?.trim()
      || request.companyName
      || companies.find(company => company.id === thread.companyBId)?.shortName
      || thread.companyBId;
    const newThread: ChatThread = {
      ...thread,
      companyAName,
      companyBName,
      id: genId('CHAT'),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setChatThreads(prev => [newThread, ...prev]);
    return newThread.id;
  }, [chatThreads, offers, requests, companies, currentRole, currentCompany.id]);

  const sendChatMessage = useCallback((threadId: string, body: string): ActionResult => {
    const thread = chatThreads.find(t => t.id === threadId);
    if (!thread) return { success: false, message: 'Không tìm thấy cuộc hội thoại.' };
    if (!body.trim()) return { success: false, message: 'Tin nhắn không được để trống.' };

    const isA = thread.companyAId === currentCompany.id;
    const isB = thread.companyBId === currentCompany.id;
    const isOps = currentRole === 'OPS';
    if (!isA && !isB && !isOps) {
      return { success: false, message: 'Bạn không có quyền gửi tin nhắn vào cuộc hội thoại này.' };
    }

    if (/(\+?\d[\d .-]{7,}\d)|([\w.+-]+@[\w.-]+\.[A-Za-z]{2,})|(https?:\/\/|www\.|zalo|telegram|whatsapp)/i.test(body)) {
      addAudit('CHAT_MESSAGE_BLOCKED', 'ChatThread', threadId, 'Tin nhắn chứa thông tin liên hệ ngoài nền tảng.');
      return { success: false, message: 'Tin nhắn bị chặn vì chứa số điện thoại, email hoặc URL liên hệ ngoài nền tảng.' };
    }
    const newMsg: ChatMessage = {
      id: genId('MSG'),
      clientId: `cli-${Date.now()}`,
      threadId,
      senderCompanyId: currentCompany.id,
      senderCompanyName: currentCompany.shortName,
      senderRole: isA ? 'A' : isB ? 'B' : 'OPS',
      senderName: '',
      body: body.trim(),
      createdAt: new Date().toISOString(),
    };
    setChatMessages(prev => [...prev, newMsg]);
    setChatThreads(prev => prev.map(t =>
      t.id === threadId ? {
        ...t,
        updatedAt: newMsg.createdAt,
        lastMessageAt: newMsg.createdAt,
        unreadCountA: isA || isB ? (isB ? (t.unreadCountA ?? 0) + 1 : t.unreadCountA ?? 0) : (t.unreadCountA ?? 0) + 1,
        unreadCountB: isA || isB ? (isA ? (t.unreadCountB ?? 0) + 1 : t.unreadCountB ?? 0) : (t.unreadCountB ?? 0) + 1,
      } : t
    ));
    return { success: true, message: 'Đã gửi tin nhắn.' };
  }, [chatThreads, currentRole, currentCompany, addAudit]);

  const markChatThreadRead = useCallback((threadId: string) => {
    setChatThreads(previous => previous.map(thread => {
      if (thread.id !== threadId) return thread;
      const isA = thread.companyAId === currentCompany.id;
      const isB = thread.companyBId === currentCompany.id;
      return {
        ...thread,
        unreadCountA: currentRole === 'OPS' || isA ? 0 : thread.unreadCountA,
        unreadCountB: currentRole === 'OPS' || isB ? 0 : thread.unreadCountB,
      };
    }));
  }, [currentRole, currentCompany.id]);

  // ==================== NOTIFICATIONS ====================

  const markNotificationRead = useCallback((notifId: string) => {
    const updated = notifications.map(n => n.id === notifId ? { ...n, isRead: true } : n);
    persistNotifications(updated);
  }, [notifications, persistNotifications]);

  const markAllNotificationsRead = useCallback(() => {
    const idsToMark = new Set(myNotifications.map(n => n.id));
    const updated = notifications.map(n => idsToMark.has(n.id) ? { ...n, isRead: true } : n);
    persistNotifications(updated);
  }, [notifications, myNotifications, persistNotifications]);

  const deleteNotification = useCallback((notifId: string) => {
    const updated = notifications.filter(n => n.id !== notifId);
    persistNotifications(updated);
  }, [notifications, persistNotifications]);

  // ==================== DEMO RESET ====================

  const resetToDemoData = useCallback(() => {
    persistAssets(INITIAL_ASSETS);
    persistOffers(INITIAL_OFFERS);
    persistRequests(INITIAL_REQUESTS);
    persistTransactions(INITIAL_TRANSACTIONS);
    setCases(INITIAL_CASES);
    setAuditLogs(INITIAL_AUDIT_LOGS);
    persistNotifications(INITIAL_NOTIFICATIONS);
    setChatThreads(INITIAL_CHAT_THREADS);
    setChatMessages(INITIAL_CHAT_MESSAGES);
    persistMatches([]);
    try {
      localStorage.setItem(DEMO_DATA_VERSION_STORAGE_KEY, DEMO_DATASET_VERSION);
    } catch {
      // Không chặn thao tác reset nếu trình duyệt không cho phép ghi localStorage.
    }
  }, [persistAssets, persistOffers, persistRequests, persistTransactions, persistNotifications, persistMatches]);

  // Chỉ khôi phục một lần khi mã seed thay đổi. Điều này sửa các session cũ mà
  // vẫn giữ nguyên dữ liệu sau khi người dùng đã thao tác trên seed hiện tại.
  useEffect(() => {
    try {
      if (localStorage.getItem(DEMO_DATA_VERSION_STORAGE_KEY) === DEMO_DATASET_VERSION) return;
    } catch {
      // Vẫn nạp seed vào state nếu không đọc được mã phiên bản.
    }
    resetToDemoData();
  }, [resetToDemoData]);

  // ==================== CONTEXT VALUE ====================

  const value: DatabaseContextType = {
    companies, assets, offers, requests, transactions, cases, auditLogs,
    notifications, myNotifications, chatThreads, chatMessages, matches,
    addAsset, updateAsset, deleteAsset, opsReviewAsset,
    addOffer, updateOffer, submitOfferForReview, withdrawOffer, deleteOffer, opsReviewOffer,
    addRequest, updateRequest, submitRequestForReview, withdrawRequest, deleteRequest, opsReviewRequest,
    addCompany, submitCompanyRegistration, updateCompany, deleteCompany,
    holdAtomicReservation, acceptMatch, rejectMatch, acceptAgreement, requestAgreementChange,
    opsApproveCarrier, opsRejectCarrier,
    submitPayment, settlePayment, opsConfirmPayments,
    generateDispatchPermit, activateInspection, submitInspection,
    confirmHandoverA, confirmHandoverB,
    toggleHold, addCase, updateCase, deleteCase, resolveCase, closeCase,
    cancelTransaction,
    startChatThread, sendChatMessage, markChatThreadRead,
    markNotificationRead, markAllNotificationsRead, deleteNotification, unreadNotificationCount,
    resetToDemoData,
    onlineConfig, isSyncing, lastSyncMessage, syncAllToOnlineDb, updateOnlineConfig,
  };

  return <DatabaseContext.Provider value={value}>{children}</DatabaseContext.Provider>;
};

export const useDatabase = (): DatabaseContextType => {
  const ctx = useContext(DatabaseContext);
  if (!ctx) throw new Error('useDatabase must be used within a DatabaseProvider');
  return ctx;
};
