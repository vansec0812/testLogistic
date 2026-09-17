// ==============================================================================
// ECont Database Context & Business Logic - Version 2.0
// State management với đầy đủ actions, guards và audit trail
// ==============================================================================

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import {
  Company, ContainerAsset, Offer, ContainerRequest, Transaction, Agreement,
  CarrierApproval, PaymentOrder, DispatchPermit, Inspection, HandoverRecord,
  CaseIssue, AuditEvent, Notification, ChatThread, ChatMessage, MatchCandidate,
  Quote, CreateAssetForm, CreateOfferForm, CreateRequestForm, TransactionStatus
} from '../types';
import {
  INITIAL_COMPANIES, INITIAL_ASSETS, INITIAL_OFFERS, INITIAL_REQUESTS,
  INITIAL_TRANSACTIONS, INITIAL_CASES, INITIAL_AUDIT_LOGS,
  INITIAL_NOTIFICATIONS, INITIAL_CHAT_THREADS, INITIAL_CHAT_MESSAGES,
  INITIAL_CARRIERS,
} from '../data/mockData';
import { canTransitionTo, getAllowedActions } from '../services/stateMachine';
import { calculateQuote } from '../services/pricingEngine';
import { onlineDb, OnlineDbConfig } from '../services/onlineDbClient';
import { useAuth } from './AuthContext';

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

  // Asset actions
  addAsset: (form: CreateAssetForm) => ActionResult;
  updateAsset: (assetId: string, updates: Partial<ContainerAsset>) => ActionResult;
  deleteAsset: (assetId: string) => ActionResult;

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
  updateCompany: (id: string, updates: Partial<Company>) => ActionResult;
  deleteCompany: (id: string) => ActionResult;

  // Reservation & Transaction
  holdAtomicReservation: (candidate: MatchCandidate, request: ContainerRequest) => ActionResult;
  acceptAgreement: (transactionId: string) => ActionResult;
  requestAgreementChange: (transactionId: string, reason: string) => ActionResult;
  
  // Carrier
  opsApproveCarrier: (transactionId: string, refNumber: string, evidenceFileName: string, validUntil: string) => ActionResult;
  opsRejectCarrier: (transactionId: string, reason: string) => ActionResult;

  // Payment
  settlePayment: (transactionId: string, party: 'A' | 'B', bankRef: string, amount: number) => ActionResult;

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
  const [onlineConfig, setOnlineConfig] = useState<OnlineDbConfig>(() => onlineDb.getConfig());
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncMessage, setLastSyncMessage] = useState<string>('Sẵn sàng đồng bộ trực tuyến');

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
      await onlineDb.syncTable('cases', cases);
      await onlineDb.syncTable('audit_events', auditLogs);
      setLastSyncMessage('Đồng bộ thành công lên Supabase Cloud');
    } catch (e: unknown) {
      const err = e as Error;
      setLastSyncMessage('Lỗi đồng bộ: ' + (err?.message || 'Không xác định'));
    } finally {
      setIsSyncing(false);
    }
  }, [companies, assets, offers, requests, transactions, cases, auditLogs]);

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
      relatedEntityType: relatedEntityId ? 'Transaction' : undefined,
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
    if (currentRole === 'ENTERPRISE_A') {
      return notifications.filter(n => n.recipientCompanyId === currentCompany.id || n.recipientCompanyId === 'COMP-A01' || n.recipientCompanyId === 'ALL');
    }
    if (currentRole === 'ENTERPRISE_B') {
      return notifications.filter(n => n.recipientCompanyId === currentCompany.id || n.recipientCompanyId === 'COMP-B01' || n.recipientCompanyId === 'ALL');
    }
    // OPS sees Ops-targeted notifications or all system alerts
    return notifications.filter(n => n.recipientCompanyId === 'COMP-OPS' || n.recipientCompanyId === 'OPS' || n.recipientCompanyId === 'ALL' || n.type === 'OPS_ALERT' || !n.recipientCompanyId.startsWith('COMP-'));
  }, [notifications, currentRole, currentCompany.id]);

  const unreadNotificationCount = useMemo(() => {
    return myNotifications.filter(n => !n.isRead).length;
  }, [myNotifications]);

  // ==================== ASSET ACTIONS ====================

  const addAsset = useCallback((form: CreateAssetForm): ActionResult => {
    if (currentRole !== 'ENTERPRISE_A' && currentRole !== 'SUPER_ADMIN') {
      return { success: false, message: 'Chỉ Bên A mới có thể đăng ký tài sản container.' };
    }
    // Kiểm tra trùng số cont
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
      photos: [],
      hasEdoDocument: false,
      edoVerificationStatus: 'UNVERIFIED',
      isLocked: false,
      locationObservedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    persistAssets([...assets, newAsset]);
    addAudit('ASSET_CREATED', 'ContainerAsset', newAsset.id, `Đăng ký container ${newAsset.containerNumber}`);
    return { success: true, message: `Đã đăng ký container ${newAsset.containerNumber} thành công.`, data: newAsset };
  }, [assets, currentRole, currentCompany, persistAssets, addAudit]);

  const updateAsset = useCallback((assetId: string, updates: Partial<ContainerAsset>): ActionResult => {
    const asset = assets.find(a => a.id === assetId);
    if (!asset) return { success: false, message: 'Không tìm thấy container.' };
    if (asset.isLocked) return { success: false, message: 'Container đang trong giao dịch, không thể chỉnh sửa.' };
    if (asset.currentCustodianId !== currentCompany.id && currentRole !== 'OPS' && currentRole !== 'SUPER_ADMIN') {
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
    if (currentRole !== 'ENTERPRISE_A' && currentRole !== 'SUPER_ADMIN') {
      return { success: false, message: 'Chỉ Bên A mới có thể tạo Offer nguồn vỏ.' };
    }
    const asset = assets.find(a => a.id === form.assetId);
    if (!asset) return { success: false, message: 'Không tìm thấy container.' };
    if (asset.currentCustodianId !== currentCompany.id) {
      return { success: false, message: 'Container này không thuộc custody của bạn.' };
    }
    if (asset.physicalStatus !== 'EMPTY_AT_YARD' && asset.physicalStatus !== 'EMPTY_AT_DEPOT') {
      return { success: false, message: 'Chỉ có thể tạo Offer cho container rỗng (EMPTY_AT_YARD/DEPOT).' };
    }
    const existingOffer = offers.find(
      o => o.assetId === form.assetId && ['DRAFT', 'UNDER_REVIEW', 'AVAILABLE', 'HELD', 'ALLOCATED'].includes(o.status)
    );
    if (existingOffer) {
      return { success: false, message: `Container đã có Offer đang hoạt động (${existingOffer.id}).` };
    }
    const newOffer: Offer = {
      id: genId('OFR'),
      assetId: form.assetId,
      asset,
      companyId: currentCompany.id,
      companyName: currentCompany.shortName,
      status: 'DRAFT',
      version: 1,
      pickupLocationName: form.pickupLocationName,
      pickupLatitude: form.pickupLatitude,
      pickupLongitude: form.pickupLongitude,
      availableFrom: form.availableFrom,
      availableTo: form.availableTo,
      expectedDepotId: form.expectedDepotId,
      expectedDepotName: undefined,
      baselineDepotCostVnd: form.baselineDepotCostVnd,
      vehicleRequirements: form.vehicleRequirements,
      photoUrls: asset.photos,
      photoChecklistComplete: asset.photos.length >= 6,
      edoDocumentIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    persistOffers([...offers, newOffer]);
    addAudit('OFFER_CREATED', 'Offer', newOffer.id, `Tạo nháp Offer cho container ${asset.containerNumber}`);
    return { success: true, message: 'Đã tạo nháp Offer thành công.', data: newOffer };
  }, [assets, offers, currentRole, currentCompany, persistOffers, addAudit]);

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
    const majorChanges = ['pickupLatitude', 'pickupLongitude', 'baselineDepotCostVnd', 'availableFrom', 'availableTo'];
    const hasMajorChange = Object.keys(updates).some(k => majorChanges.includes(k));
    const newStatus = (offer.status === 'AVAILABLE' && hasMajorChange) ? 'UNDER_REVIEW' : offer.status;
    const updated = {
      ...offer, ...updates,
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
    if (!offer.photoChecklistComplete) {
      return { success: false, message: 'Cần tối thiểu 6 ảnh (6 góc) trước khi gửi review.' };
    }
    persistOffers(offers.map(o => o.id === offerId ? { ...o, status: 'UNDER_REVIEW', updatedAt: new Date().toISOString() } : o));
    addAudit('OFFER_SUBMITTED_FOR_REVIEW', 'Offer', offerId, 'Gửi Offer để Ops thẩm định');
    return { success: true, message: 'Đã gửi Offer để Ops thẩm định.' };
  }, [offers, persistOffers, addAudit]);

  const withdrawOffer = useCallback((offerId: string, reason: string): ActionResult => {
    const offer = offers.find(o => o.id === offerId);
    if (!offer) return { success: false, message: 'Không tìm thấy Offer.' };
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
    if (offer.companyId !== currentCompany.id && currentRole !== 'OPS' && currentRole !== 'SUPER_ADMIN') {
      return { success: false, message: 'Bạn không có quyền xóa Offer này.' };
    }
    persistOffers(offers.filter(o => o.id !== offerId));
    addAudit('OFFER_DELETED', 'Offer', offerId, `Xóa Offer ${offerId} của cont ${offer.asset.containerNumber}`);
    return { success: true, message: `Đã xóa Offer ${offerId} thành công.` };
  }, [offers, currentCompany, currentRole, persistOffers, addAudit]);

  const opsReviewOffer = useCallback((offerId: string, decision: 'APPROVE' | 'REQUEST_CHANGES' | 'REJECT', notes: string): ActionResult => {
    if (currentRole !== 'OPS' && currentRole !== 'SUPER_ADMIN') {
      return { success: false, message: 'Chỉ Ops mới có thể thẩm định Offer.' };
    }
    const offer = offers.find(o => o.id === offerId);
    if (!offer) return { success: false, message: 'Không tìm thấy Offer.' };
    if (offer.status !== 'UNDER_REVIEW') {
      return { success: false, message: `Offer không ở trạng thái UNDER_REVIEW (hiện: ${offer.status}).` };
    }
    const newStatus = decision === 'APPROVE' ? 'AVAILABLE' : decision === 'REQUEST_CHANGES' ? 'CHANGES_REQUIRED' : 'REJECTED';
    persistOffers(offers.map(o =>
      o.id === offerId ? {
        ...o, status: newStatus, reviewerNotes: notes,
        reviewedBy: currentUserEmail, reviewedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      } : o
    ));
    addAudit(`OFFER_${decision}`, 'Offer', offerId, `Ops quyết định ${decision}: ${notes}`);
    // Notify A
    addNotification(offer.companyId, 'TRANSACTION_UPDATE',
      `Offer ${offerId} — ${newStatus === 'AVAILABLE' ? 'Đã được duyệt ✓' : newStatus === 'CHANGES_REQUIRED' ? 'Cần bổ sung tài liệu' : 'Bị từ chối'}`,
      notes, offerId);
    return { success: true, message: `Đã ${decision === 'APPROVE' ? 'duyệt' : decision === 'REQUEST_CHANGES' ? 'yêu cầu bổ sung' : 'từ chối'} Offer.` };
  }, [offers, currentRole, currentUserEmail, persistOffers, addAudit, addNotification]);

  // ==================== REQUEST ACTIONS ====================

  const addRequest = useCallback((form: CreateRequestForm): ActionResult => {
    if (currentRole !== 'ENTERPRISE_B' && currentRole !== 'SUPER_ADMIN') {
      return { success: false, message: 'Chỉ Bên B mới có thể tạo nhu cầu.' };
    }
    const newReq: ContainerRequest = {
      id: genId('REQ'),
      companyId: currentCompany.id,
      companyName: currentCompany.shortName,
      carrierId: form.carrierId,
      carrierCode: form.carrierId.replace('CARR-', ''),
      containerType: form.containerType,
      bookingNumber: form.bookingNumber,
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
      baselinePickupCostVnd: form.baselinePickupCostVnd,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    persistRequests([...requests, newReq]);
    addAudit('REQUEST_CREATED', 'ContainerRequest', newReq.id, `Tạo nhu cầu booking ${form.bookingNumber}`);
    return { success: true, message: 'Đã tạo nhu cầu thành công.', data: newReq };
  }, [requests, currentRole, currentCompany, persistRequests, addAudit]);

  const updateRequest = useCallback((requestId: string, updates: Partial<ContainerRequest>): ActionResult => {
    const req = requests.find(r => r.id === requestId);
    if (!req) return { success: false, message: 'Không tìm thấy nhu cầu.' };
    if (req.companyId !== currentCompany.id) {
      return { success: false, message: 'Bạn không có quyền chỉnh sửa nhu cầu này.' };
    }
    if (['HELD', 'ALLOCATED', 'FULFILLED'].includes(req.status)) {
      return { success: false, message: `Nhu cầu đang ở trạng thái ${req.status}, không thể chỉnh sửa trực tiếp.` };
    }
    const updated = { ...req, ...updates, version: req.version + 1, updatedAt: new Date().toISOString() };
    persistRequests(requests.map(r => r.id === requestId ? updated : r));
    addAudit('REQUEST_UPDATED', 'ContainerRequest', requestId, 'Cập nhật nhu cầu');
    return { success: true, message: 'Đã cập nhật nhu cầu.' };
  }, [requests, currentCompany, persistRequests, addAudit]);

  const submitRequestForReview = useCallback((requestId: string): ActionResult => {
    const req = requests.find(r => r.id === requestId);
    if (!req) return { success: false, message: 'Không tìm thấy nhu cầu.' };
    if (req.status !== 'DRAFT' && req.status !== 'CHANGES_REQUIRED') {
      return { success: false, message: `Chỉ gửi review từ DRAFT/CHANGES_REQUIRED (hiện: ${req.status}).` };
    }
    persistRequests(requests.map(r => r.id === requestId ? { ...r, status: 'UNDER_REVIEW', updatedAt: new Date().toISOString() } : r));
    addAudit('REQUEST_SUBMITTED_FOR_REVIEW', 'ContainerRequest', requestId, 'Gửi nhu cầu để Ops xác minh');
    return { success: true, message: 'Đã gửi nhu cầu để Ops xác minh booking.' };
  }, [requests, persistRequests, addAudit]);

  const withdrawRequest = useCallback((requestId: string, reason: string): ActionResult => {
    const req = requests.find(r => r.id === requestId);
    if (!req) return { success: false, message: 'Không tìm thấy nhu cầu.' };
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
    if (req.companyId !== currentCompany.id && currentRole !== 'OPS' && currentRole !== 'SUPER_ADMIN') {
      return { success: false, message: 'Bạn không có quyền xóa nhu cầu này.' };
    }
    persistRequests(requests.filter(r => r.id !== requestId));
    addAudit('REQUEST_DELETED', 'ContainerRequest', requestId, `Xóa nhu cầu booking ${req.bookingNumber}`);
    return { success: true, message: `Đã xóa nhu cầu ${req.bookingNumber} thành công.` };
  }, [requests, currentCompany, currentRole, persistRequests, addAudit]);

  const opsReviewRequest = useCallback((requestId: string, decision: 'APPROVE' | 'REQUEST_CHANGES' | 'REJECT', notes: string): ActionResult => {
    if (currentRole !== 'OPS' && currentRole !== 'SUPER_ADMIN') {
      return { success: false, message: 'Chỉ Ops mới có thể xác minh nhu cầu.' };
    }
    const req = requests.find(r => r.id === requestId);
    if (!req) return { success: false, message: 'Không tìm thấy nhu cầu.' };
    if (req.status !== 'UNDER_REVIEW') {
      return { success: false, message: `Nhu cầu không ở trạng thái UNDER_REVIEW (hiện: ${req.status}).` };
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
    return { success: true, message: `Đã xử lý nhu cầu.` };
  }, [requests, currentRole, currentUserEmail, persistRequests, addAudit]);

  // ==================== RESERVATION ====================

  const holdAtomicReservation = useCallback((candidate: MatchCandidate, request: ContainerRequest): ActionResult => {
    if (currentRole !== 'ENTERPRISE_B' && currentRole !== 'SUPER_ADMIN') {
      return { success: false, message: 'Chỉ Bên B mới có thể giữ chỗ container.' };
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
      return { success: false, message: `Vị trí container đã ${Math.round(candidate.locationAgeHours)}h — Bên A cần xác nhận lại trước khi giữ chỗ.` };
    }

    // Tạo Agreement v1
    const agreementId = genId('AGR');
    const agreement: Agreement = {
      id: agreementId,
      transactionId: '',
      version: 1,
      contentHash: `sha256-${Math.random().toString(36).substring(2)}`,
      createdAt: new Date().toISOString(),
    };

    // Tạo Transaction
    const txnId = genId('TXN');
    agreement.transactionId = txnId;

    const newTxn: Transaction = {
      id: txnId,
      offerId: latestOffer.id,
      requestId: latestRequest.id,
      assetId: latestOffer.assetId,
      companyAId: latestOffer.companyId,
      companyAName: latestOffer.companyName,
      companyBId: currentCompany.id,
      companyBName: currentCompany.shortName,
      asset: latestOffer.asset,
      status: 'NEGOTIATING',
      rowVersion: 1,
      isOnHold: false,
      dueAt: new Date(Date.now() + 30 * 60000).toISOString(), // 30 phút
      nextAction: 'Hai bên A và B xem xét nội dung Thỏa thuận và bấm Ký chấp thuận.',
      allowedActions: [],
      blockingReasons: [],
      currentAgreementVersion: 1,
      agreements: [agreement],
      quote: candidate.quote,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Cập nhật trạng thái
    persistOffers(offers.map(o => o.id === latestOffer.id ? { ...o, status: 'HELD', updatedAt: new Date().toISOString() } : o));
    persistRequests(requests.map(r => r.id === latestRequest.id ? { ...r, status: 'HELD', updatedAt: new Date().toISOString() } : r));
    persistTransactions([...transactions, newTxn]);

    addAudit('HOLD_RESERVATION_CREATED', 'Transaction', txnId,
      `Giữ chỗ Container ${latestOffer.asset.containerNumber} cho Request ${latestRequest.id}. Deadline: 30 phút.`);
    addNotification(latestOffer.companyId, 'TRANSACTION_UPDATE',
      `Bên B quan tâm đến ${latestOffer.asset.containerNumber}`,
      `${currentCompany.shortName} đã giữ chỗ container của bạn. Vui lòng xem xét Thỏa thuận.`,
      txnId);

    return { success: true, message: `Đã giữ chỗ thành công! Giao dịch ${txnId} được tạo.`, data: { transactionId: txnId } };
  }, [offers, requests, transactions, currentRole, currentCompany, persistOffers, persistRequests, persistTransactions, addAudit, addNotification]);

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

    const isPartyA = txn.companyAId === currentCompany.id && currentRole === 'ENTERPRISE_A';
    const isPartyB = txn.companyBId === currentCompany.id && currentRole === 'ENTERPRISE_B';

    if (!isPartyA && !isPartyB) {
      return { success: false, message: 'Bạn không phải là bên tham gia giao dịch này.' };
    }

    // Kiểm tra không tự ký cho cả hai bên
    if (isPartyA && currentAgreement.companyAAcceptedAt) {
      return { success: false, message: 'Bên A đã ký rồi.' };
    }
    if (isPartyB && currentAgreement.companyBAcceptedAt) {
      return { success: false, message: 'Bên B đã ký rồi.' };
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
        dueAt: new Date(Date.now() + 4 * 3600000).toISOString(), // 4 giờ
        nextAction: 'Bộ phận Vận hành (Ops) đang liên hệ hãng tàu xin duyệt RU. Dự kiến 4 giờ.',
      };
      addAudit('TRANSACTION_STATUS_CHANGED', 'Transaction', transactionId,
        `NEGOTIATING → PENDING_CARRIER. Hai bên đã ký Thỏa thuận v${txn.currentAgreementVersion}.`);
    }

    persistTransactions(transactions.map(t => t.id === transactionId ? updatedTxn : t));
    addAudit(isPartyA ? 'AGREEMENT_ACCEPTED_BY_A' : 'AGREEMENT_ACCEPTED_BY_B',
      'Agreement', currentAgreement.id,
      `${isPartyA ? 'Bên A' : 'Bên B'} ký chấp thuận Thỏa thuận v${txn.currentAgreementVersion}. Hash: ${currentAgreement.contentHash}`);

    const otherPartyId = isPartyA ? txn.companyBId : txn.companyAId;
    addNotification(otherPartyId, 'TRANSACTION_UPDATE',
      bothAccepted ? `Giao dịch ${transactionId} — Cả hai bên đã ký` : `${isPartyA ? 'Bên A' : 'Bên B'} đã ký Thỏa thuận`,
      bothAccepted ? 'Chờ Ops xử lý RU với hãng tàu.' : `${isPartyA ? 'Bên A' : 'Bên B'} đã ký, đang chờ bên còn lại.`,
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
    if (currentRole !== 'OPS' && currentRole !== 'SUPER_ADMIN') {
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

    const approval: CarrierApproval = {
      id: genId('CARAPPR'),
      transactionId,
      carrierCode: txn.asset.carrierCode,
      approvalReference: refNumber,
      status: 'APPROVED',
      scope: {
        containerNumber: txn.asset.containerNumber,
        bookingNumber: '',
        companyAId: txn.companyAId,
        companyBId: txn.companyBId,
        pickupPoint: txn.asset.currentLocationName,
        deliveryPoint: '',
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
      expiresAt: new Date(Date.now() + 2 * 3600000).toISOString(),
    };
    const paymentOrderB: PaymentOrder = {
      id: genId('PAY'),
      transactionId,
      companyId: txn.companyBId,
      companyName: txn.companyBName,
      payerRole: 'PARTY_B',
      amountVnd: txn.quote.econtCollectedFromB,
      status: 'OPEN',
      expiresAt: new Date(Date.now() + 2 * 3600000).toISOString(),
    };

    const updatedTxn: Transaction = {
      ...txn,
      status: 'AWAITING_PAYMENT',
      carrierApproval: approval,
      paymentOrderA,
      paymentOrderB,
      rowVersion: txn.rowVersion + 1,
      dueAt: new Date(Date.now() + 2 * 3600000).toISOString(),
      nextAction: 'Bên A và Bên B cần hoàn tất thanh toán trong vòng 2 giờ.',
      updatedAt: new Date().toISOString(),
    };
    persistTransactions(transactions.map(t => t.id === transactionId ? updatedTxn : t));
    addAudit('CARRIER_APPROVAL_RECORDED', 'CarrierApproval', approval.id,
      `Ops ghi nhận RU APPROVED. Ref: ${refNumber}. Evidence: ${evidenceFileName}`);
    addNotification(txn.companyAId, 'PAYMENT_REQUIRED', `Cần thanh toán ${txn.quote.econtCollectedFromA.toLocaleString('vi-VN')} ₫`, 'Hãng tàu đã duyệt RU. Vui lòng hoàn tất thanh toán trong 2 giờ.', transactionId);
    addNotification(txn.companyBId, 'PAYMENT_REQUIRED', `Cần thanh toán ${txn.quote.econtCollectedFromB.toLocaleString('vi-VN')} ₫`, 'Hãng tàu đã duyệt RU. Vui lòng hoàn tất thanh toán trong 2 giờ.', transactionId);
    return { success: true, message: 'Đã ghi nhận Carrier Approval. Chuyển sang chờ thanh toán.' };
  }, [transactions, currentRole, currentUserEmail, persistTransactions, addAudit, addNotification]);

  const opsRejectCarrier = useCallback((transactionId: string, reason: string): ActionResult => {
    if (currentRole !== 'OPS' && currentRole !== 'SUPER_ADMIN') {
      return { success: false, message: 'Chỉ Ops mới có quyền này.' };
    }
    const txn = transactions.find(t => t.id === transactionId);
    if (!txn) return { success: false, message: 'Không tìm thấy giao dịch.' };
    if (txn.status !== 'PENDING_CARRIER') {
      return { success: false, message: 'Giao dịch không ở PENDING_CARRIER.' };
    }
    const updatedTxn: Transaction = {
      ...txn, status: 'REJECTED', rowVersion: txn.rowVersion + 1,
      nextAction: `Hãng tàu từ chối RU: ${reason}. Xử lý giải phóng và hoàn tiền.`,
      updatedAt: new Date().toISOString(),
    };
    persistOffers(offers.map(o => o.id === txn.offerId ? { ...o, status: 'AVAILABLE', updatedAt: new Date().toISOString() } : o));
    persistRequests(requests.map(r => r.id === txn.requestId ? { ...r, status: 'OPEN', updatedAt: new Date().toISOString() } : r));
    persistTransactions(transactions.map(t => t.id === transactionId ? updatedTxn : t));
    addAudit('CARRIER_REJECTION_RECORDED', 'Transaction', transactionId, `Carrier từ chối RU: ${reason}`);
    return { success: true, message: 'Đã ghi nhận carrier từ chối. Offer và Request được giải phóng.' };
  }, [transactions, offers, requests, currentRole, persistOffers, persistRequests, persistTransactions, addAudit]);

  // ==================== PAYMENT ====================

  const settlePayment = useCallback((transactionId: string, party: 'A' | 'B', bankRef: string, amount: number): ActionResult => {
    if (currentRole !== 'FINANCE' && currentRole !== 'SUPER_ADMIN') {
      return { success: false, message: 'Chỉ Tài chính mới có thể xác nhận thanh toán.' };
    }
    const txn = transactions.find(t => t.id === transactionId);
    if (!txn) return { success: false, message: 'Không tìm thấy giao dịch.' };
    if (txn.status !== 'AWAITING_PAYMENT') {
      return { success: false, message: `Giao dịch không ở trạng thái AWAITING_PAYMENT (hiện: ${txn.status}).` };
    }

    const now = new Date().toISOString();
    const orderKey = party === 'A' ? 'paymentOrderA' : 'paymentOrderB';
    const existingOrder = txn[orderKey];
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

    // Kiểm tra cả hai đã trả chưa
    const paidA = party === 'A' ? true : txn.paymentOrderA?.status === 'PAID';
    const paidB = party === 'B' ? true : txn.paymentOrderB?.status === 'PAID';

    if (paidA && paidB) {
      // Tạo dispatch permit
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
      updatedTxn = {
        ...updatedTxn,
        status: 'READY_FOR_PICKUP',
        dispatchPermit: permit,
        dueAt: new Date(Date.now() + 48 * 3600000).toISOString(),
        nextAction: 'Phiếu điều phối đã phát hành. Tài xế chuẩn bị phương tiện đến kho A.',
      };
      addAudit('TRANSACTION_STATUS_CHANGED', 'Transaction', transactionId, 'AWAITING_PAYMENT → READY_FOR_PICKUP. Phiếu DP phát hành.');
      addNotification(txn.companyAId, 'TRANSACTION_UPDATE', 'Phiếu điều phối đã được phát hành', 'Bên B sẽ đến nhận cont theo phiếu DP.', transactionId);
      addNotification(txn.companyBId, 'TRANSACTION_UPDATE', 'Phiếu điều phối đã được phát hành', 'Vui lòng chuẩn bị xe và người nhận đến kho A.', transactionId);
    }

    persistTransactions(transactions.map(t => t.id === transactionId ? updatedTxn : t));
    addAudit('PAYMENT_SETTLED', 'PaymentOrder', existingOrder.id,
      `Tài chính xác nhận thanh toán Bên ${party}: ${amount.toLocaleString('vi-VN')} ₫. Ref: ${bankRef}`);
    return { success: true, message: paidA && paidB ? 'Đủ tiền hai bên. Phiếu điều phối đã phát.' : `Đã xác nhận thanh toán Bên ${party}.` };
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
      nextAction: 'Đại diện Bên B tiến hành kiểm tra thực tế 6 mặt container.',
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
    if (txn.companyBId !== currentCompany.id && currentRole !== 'OPS' && currentRole !== 'SUPER_ADMIN') {
      return { success: false, message: 'Chỉ đại diện Bên B mới có thể nộp biên bản kiểm tra.' };
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

    if (data.isDiscrepancyFound && data.discrepancySeverity === 'MAJOR') {
      nextAction = 'Phát hiện sai lệch NGHIÊM TRỌNG. Lập Case và tạm dừng giao dịch.';
      newStatus = 'INSPECTION'; // Giữ ở INSPECTION
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
      inspection,
      handoverRecord: newStatus === 'HANDOVER_PENDING' ? handoverRecord : undefined,
      rowVersion: txn.rowVersion + 1,
      nextAction,
      updatedAt: new Date().toISOString(),
    };
    persistTransactions(transactions.map(t => t.id === transactionId ? updatedTxn : t));
    addAudit('INSPECTION_SUBMITTED', 'Inspection', inspection.id,
      `Biên bản kiểm tra: ${data.isDiscrepancyFound ? `Sai lệch ${data.discrepancySeverity}: ${data.discrepancyNotes}` : 'Đạt yêu cầu'}`);
    return { success: true, message: data.isDiscrepancyFound ? 'Đã ghi nhận sai lệch. Cần xử lý trước khi bàn giao.' : 'Kiểm tra hoàn tất. Chuyển sang bàn giao.' };
  }, [transactions, currentRole, currentCompany, persistTransactions, addAudit]);

  const confirmHandoverA = useCallback((transactionId: string): ActionResult => {
    const txn = transactions.find(t => t.id === transactionId);
    if (!txn) return { success: false, message: 'Không tìm thấy giao dịch.' };
    if (txn.status !== 'HANDOVER_PENDING') return { success: false, message: 'Giao dịch không ở HANDOVER_PENDING.' };
    if (txn.companyAId !== currentCompany.id || currentRole !== 'ENTERPRISE_A') {
      return { success: false, message: 'Chỉ đại diện Bên A mới có thể xác nhận đã giao.' };
    }
    if (txn.handoverRecord?.confirmationA) {
      return { success: false, message: 'Bên A đã xác nhận rồi.' };
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
          nextAction: 'Giao nhận hoàn tất. Quyền quản lý cont đã chuyển sang Bên B.',
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
        addNotification(txn.companyBId, 'TRANSACTION_UPDATE', `Giao dịch ${transactionId} HOÀN TẤT ✓`, 'Đã nhận cont. Vui lòng đánh giá Bên A.', transactionId);
      }
    }

    persistTransactions(transactions.map(t => t.id === transactionId ? updatedTxn : t));
    addAudit('HANDOVER_CONFIRMED_BY_A', 'HandoverRecord', record.id, `Bên A xác nhận đã giao. Hash: ${record.contentHash}`);
    return { success: true, message: updatedTxn.status === 'COMPLETED' ? 'Hoàn tất! Quyền quản lý cont đã chuyển sang Bên B.' : 'Bên A đã xác nhận đã giao. Chờ Bên B.' };
  }, [transactions, assets, offers, requests, currentRole, currentCompany, currentUserEmail, persistAssets, persistOffers, persistRequests, persistTransactions, addAudit, addNotification]);

  const confirmHandoverB = useCallback((transactionId: string): ActionResult => {
    const txn = transactions.find(t => t.id === transactionId);
    if (!txn) return { success: false, message: 'Không tìm thấy giao dịch.' };
    if (txn.status !== 'HANDOVER_PENDING') return { success: false, message: 'Giao dịch không ở HANDOVER_PENDING.' };
    if (txn.companyBId !== currentCompany.id || currentRole !== 'ENTERPRISE_B') {
      return { success: false, message: 'Chỉ đại diện Bên B mới có thể xác nhận đã nhận.' };
    }
    if (txn.handoverRecord?.confirmationB) {
      return { success: false, message: 'Bên B đã xác nhận rồi.' };
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
          nextAction: 'Giao nhận hoàn tất. Quyền quản lý cont đã chuyển sang Bên B.',
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
    addAudit('HANDOVER_CONFIRMED_BY_B', 'HandoverRecord', record.id, `Bên B xác nhận đã nhận. Hash: ${record.contentHash}`);
    return { success: true, message: updatedTxn.status === 'COMPLETED' ? 'Hoàn tất giao nhận!' : 'Bên B đã xác nhận nhận. Chờ Bên A.' };
  }, [transactions, assets, offers, requests, currentRole, currentCompany, currentUserEmail, persistAssets, persistOffers, persistRequests, persistTransactions, addAudit, addNotification]);

  // ==================== HOLD & CASE ====================

  const toggleHold = useCallback((transactionId: string, isOnHold: boolean, reason?: string, caseId?: string): ActionResult => {
    if (currentRole !== 'OPS' && currentRole !== 'SUPER_ADMIN') {
      return { success: false, message: 'Chỉ Ops mới có thể đặt/gỡ trạng thái tạm dừng.' };
    }
    const txn = transactions.find(t => t.id === transactionId);
    if (!txn) return { success: false, message: 'Không tìm thấy giao dịch.' };
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
  }, [transactions, currentRole, currentUserEmail, persistTransactions, addAudit]);

  const addCase = useCallback((c: Omit<CaseIssue, 'id' | 'createdAt' | 'updatedAt'>): ActionResult => {
    const newCase: CaseIssue = {
      ...c,
      id: genId('CASE'),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setCases(prev => [newCase, ...prev]);
    addAudit('CASE_CREATED', 'CaseIssue', newCase.id, `Tạo Case: ${newCase.title}`);
    return { success: true, message: 'Đã tạo Case thành công.', data: newCase };
  }, [addAudit]);

  const updateCase = useCallback((caseId: string, updates: Partial<CaseIssue>): ActionResult => {
    const c = cases.find(item => item.id === caseId);
    if (!c) return { success: false, message: 'Không tìm thấy Case.' };
    if (c.status === 'CLOSED') return { success: false, message: 'Case đã đóng không thể chỉnh sửa.' };
    setCases(prev => prev.map(item => item.id === caseId ? { ...item, ...updates, updatedAt: new Date().toISOString() } : item));
    addAudit('CASE_UPDATED', 'CaseIssue', caseId, `Cập nhật thông tin Case ${caseId}`);
    return { success: true, message: 'Đã cập nhật Case thành công.' };
  }, [cases, addAudit]);

  const deleteCase = useCallback((caseId: string): ActionResult => {
    const c = cases.find(item => item.id === caseId);
    if (!c) return { success: false, message: 'Không tìm thấy Case.' };
    if (c.status !== 'OPEN' && currentRole !== 'SUPER_ADMIN') {
      return { success: false, message: 'Chỉ có thể xóa Case khi đang ở trạng thái OPEN.' };
    }
    setCases(prev => prev.filter(item => item.id !== caseId));
    addAudit('CASE_DELETED', 'CaseIssue', caseId, `Xóa Case ${caseId}`);
    return { success: true, message: 'Đã xóa Case thành công.' };
  }, [cases, currentRole, addAudit]);

  const resolveCase = useCallback((caseId: string, resolution: NonNullable<CaseIssue['resolution']>): ActionResult => {
    if (currentRole !== 'OPS' && currentRole !== 'SUPER_ADMIN') {
      return { success: false, message: 'Chỉ Ops mới có thể kết luận Case.' };
    }
    setCases(prev => prev.map(c =>
      c.id === caseId ? {
        ...c, status: 'RESOLVED', resolution,
        updatedAt: new Date().toISOString(),
      } : c
    ));
    addAudit('CASE_RESOLVED', 'CaseIssue', caseId, `Kết luận Case: ${resolution.summary}`);
    return { success: true, message: 'Đã kết luận Case.' };
  }, [currentRole, addAudit]);

  const closeCase = useCallback((caseId: string): ActionResult => {
    setCases(prev => prev.map(c =>
      c.id === caseId ? { ...c, status: 'CLOSED', closedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } : c
    ));
    addAudit('CASE_CLOSED', 'CaseIssue', caseId, 'Đóng Case');
    return { success: true, message: 'Đã đóng Case.' };
  }, [addAudit]);

  // ==================== COMPANY ACTIONS ====================

  const addCompany = useCallback((comp: Omit<Company, 'id' | 'totalCompletedAsA' | 'totalCompletedAsB'>): ActionResult => {
    if (currentRole !== 'OPS' && currentRole !== 'SUPER_ADMIN') {
      return { success: false, message: 'Chỉ Ops hoặc Quản trị viên mới có quyền thêm doanh nghiệp.' };
    }
    const newComp: Company = {
      ...comp,
      id: genId('COMP'),
      totalCompletedAsA: 0,
      totalCompletedAsB: 0,
    };
    persistCompanies([...companies, newComp]);
    addAudit('COMPANY_CREATED', 'Company', newComp.id, `Tạo mới DN ${newComp.companyName} (${newComp.taxCode})`);
    return { success: true, message: `Đã thêm doanh nghiệp ${newComp.shortName} thành công.`, data: newComp };
  }, [companies, currentRole, persistCompanies, addAudit]);

  const updateCompany = useCallback((id: string, updates: Partial<Company>): ActionResult => {
    if (currentRole !== 'OPS' && currentRole !== 'SUPER_ADMIN') {
      return { success: false, message: 'Chỉ Ops hoặc Quản trị viên mới có quyền sửa doanh nghiệp.' };
    }
    const comp = companies.find(c => c.id === id);
    if (!comp) return { success: false, message: 'Không tìm thấy doanh nghiệp.' };
    const updated = { ...comp, ...updates };
    persistCompanies(companies.map(c => c.id === id ? updated : c));
    addAudit('COMPANY_UPDATED', 'Company', id, `Cập nhật thông tin DN ${comp.shortName}`);
    return { success: true, message: `Đã cập nhật doanh nghiệp ${comp.shortName} thành công.` };
  }, [companies, currentRole, persistCompanies, addAudit]);

  const deleteCompany = useCallback((id: string): ActionResult => {
    if (currentRole !== 'SUPER_ADMIN') {
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
    const existing = chatThreads.find(t =>
      t.companyAId === thread.companyAId && t.companyBId === thread.companyBId &&
      t.offerId === thread.offerId && t.requestId === thread.requestId
    );
    if (existing) return existing.id;
    const newThread: ChatThread = {
      ...thread,
      id: genId('CHAT'),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setChatThreads(prev => [newThread, ...prev]);
    return newThread.id;
  }, [chatThreads]);

  const sendChatMessage = useCallback((threadId: string, body: string): ActionResult => {
    const thread = chatThreads.find(t => t.id === threadId);
    if (!thread) return { success: false, message: 'Không tìm thấy cuộc hội thoại.' };
    if (!body.trim()) return { success: false, message: 'Tin nhắn không được để trống.' };

    const isA = thread.companyAId === currentCompany.id;
    const isB = thread.companyBId === currentCompany.id;
    const isOps = currentRole === 'OPS' || currentRole === 'SUPER_ADMIN';
    if (!isA && !isB && !isOps) {
      return { success: false, message: 'Bạn không có quyền gửi tin nhắn vào cuộc hội thoại này.' };
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
      t.id === threadId ? { ...t, updatedAt: newMsg.createdAt, lastMessageAt: newMsg.createdAt } : t
    ));
    return { success: true, message: 'Đã gửi tin nhắn.' };
  }, [chatThreads, currentRole, currentCompany]);

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
  }, [persistAssets, persistOffers, persistRequests, persistTransactions, persistNotifications]);

  // ==================== CONTEXT VALUE ====================

  const value: DatabaseContextType = {
    companies, assets, offers, requests, transactions, cases, auditLogs,
    notifications, myNotifications, chatThreads, chatMessages,
    addAsset, updateAsset, deleteAsset,
    addOffer, updateOffer, submitOfferForReview, withdrawOffer, deleteOffer, opsReviewOffer,
    addRequest, updateRequest, submitRequestForReview, withdrawRequest, deleteRequest, opsReviewRequest,
    addCompany, updateCompany, deleteCompany,
    holdAtomicReservation, acceptAgreement, requestAgreementChange,
    opsApproveCarrier, opsRejectCarrier,
    settlePayment,
    generateDispatchPermit, activateInspection, submitInspection,
    confirmHandoverA, confirmHandoverB,
    toggleHold, addCase, updateCase, deleteCase, resolveCase, closeCase,
    cancelTransaction,
    startChatThread, sendChatMessage,
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
