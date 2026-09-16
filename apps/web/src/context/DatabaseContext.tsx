// ==============================================================================
// ECont Database Context & State Management
// Quản lý kho dữ liệu nghiệp vụ, vòng đời giao dịch 7 bước và đồng bộ CSDL Online
// ==============================================================================

import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  Company,
  ContainerAsset,
  Offer,
  ContainerRequest,
  Transaction,
  CaseIssue,
  AuditEvent,
  MatchCandidate
} from '../types';
import {
  INITIAL_COMPANIES,
  INITIAL_ASSETS,
  INITIAL_OFFERS,
  INITIAL_REQUESTS,
  INITIAL_TRANSACTIONS,
  INITIAL_CASES,
  INITIAL_AUDIT_LOGS
} from '../data/mockData';
import { canTransitionTo } from '../services/stateMachine';
import { onlineDb, OnlineDbConfig } from '../services/onlineDbClient';

interface DatabaseContextType {
  companies: Company[];
  assets: ContainerAsset[];
  offers: Offer[];
  requests: ContainerRequest[];
  transactions: Transaction[];
  cases: CaseIssue[];
  auditLogs: AuditEvent[];
  onlineConfig: OnlineDbConfig;
  isSyncing: boolean;
  lastSyncMessage: string;
  
  // Actions nghiệp vụ
  addAsset: (asset: Omit<ContainerAsset, 'id' | 'isLocked'>) => ContainerAsset;
  addOffer: (offer: Omit<Offer, 'id' | 'createdAt'>) => Offer;
  addRequest: (req: Omit<ContainerRequest, 'id' | 'createdAt'>) => ContainerRequest;
  holdAtomicReservation: (candidate: MatchCandidate, request: ContainerRequest) => { success: boolean; transactionId?: string; message?: string };
  acceptAgreement: (transactionId: string, party: 'A' | 'B') => { success: boolean; message: string };
  opsApproveCarrier: (transactionId: string, refNumber: string, evidenceFileName: string) => { success: boolean; message: string };
  settlePayment: (transactionId: string, party: 'A' | 'B', bankRef: string) => { success: boolean; message: string };
  submitInspection: (transactionId: string, inspectionData: {
    inspectorName: string;
    checklistFloor: boolean;
    checklistWalls: boolean;
    checklistRoof: boolean;
    checklistDoors: boolean;
    checklistGaskets: boolean;
    checklistUndercarriage: boolean;
    isDiscrepancyFound: boolean;
    discrepancyNotes?: string;
  }) => { success: boolean; message: string };
  confirmHandover: (transactionId: string, party: 'A' | 'B') => { success: boolean; message: string };
  toggleHold: (transactionId: string, isOnHold: boolean, reason?: string) => void;
  resolveCase: (caseId: string, resolutionSummary: string) => void;
  resetToDemoData: () => void;
  syncAllToOnlineDb: () => Promise<void>;
  updateOnlineConfig: (config: Partial<OnlineDbConfig>) => void;
}

const DatabaseContext = createContext<DatabaseContextType | undefined>(undefined);

export const DatabaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [companies, setCompanies] = useState<Company[]>(() => {
    const saved = localStorage.getItem('econt_db_companies');
    return saved ? JSON.parse(saved) : INITIAL_COMPANIES;
  });

  const [assets, setAssets] = useState<ContainerAsset[]>(() => {
    const saved = localStorage.getItem('econt_db_assets');
    return saved ? JSON.parse(saved) : INITIAL_ASSETS;
  });

  const [offers, setOffers] = useState<Offer[]>(() => {
    const saved = localStorage.getItem('econt_db_offers');
    return saved ? JSON.parse(saved) : INITIAL_OFFERS;
  });

  const [requests, setRequests] = useState<ContainerRequest[]>(() => {
    const saved = localStorage.getItem('econt_db_requests');
    return saved ? JSON.parse(saved) : INITIAL_REQUESTS;
  });

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('econt_db_transactions');
    return saved ? JSON.parse(saved) : INITIAL_TRANSACTIONS;
  });

  const [cases, setCases] = useState<CaseIssue[]>(() => {
    const saved = localStorage.getItem('econt_db_cases');
    return saved ? JSON.parse(saved) : INITIAL_CASES;
  });

  const [auditLogs, setAuditLogs] = useState<AuditEvent[]>(() => {
    const saved = localStorage.getItem('econt_db_audit');
    return saved ? JSON.parse(saved) : INITIAL_AUDIT_LOGS;
  });

  const [onlineConfig, setOnlineConfig] = useState<OnlineDbConfig>(onlineDb.getConfig());
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncMessage, setLastSyncMessage] = useState<string>('Đã kết nối CSDL Online');

  // Lưu trữ persistent cache
  useEffect(() => {
    localStorage.setItem('econt_db_companies', JSON.stringify(companies));
    localStorage.setItem('econt_db_assets', JSON.stringify(assets));
    localStorage.setItem('econt_db_offers', JSON.stringify(offers));
    localStorage.setItem('econt_db_requests', JSON.stringify(requests));
    localStorage.setItem('econt_db_transactions', JSON.stringify(transactions));
    localStorage.setItem('econt_db_cases', JSON.stringify(cases));
    localStorage.setItem('econt_db_audit', JSON.stringify(auditLogs));
  }, [companies, assets, offers, requests, transactions, cases, auditLogs]);

  const addAudit = (action: string, entityName: string, entityId: string, details: string) => {
    const newLog: AuditEvent = {
      id: 'AUD-' + Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString(),
      actorEmail: 'system@econt.vn',
      action,
      entityName,
      entityId,
      details
    };
    setAuditLogs(prev => [newLog, ...prev]);
  };

  const updateOnlineConfig = (newCfg: Partial<OnlineDbConfig>) => {
    onlineDb.saveConfig(newCfg);
    setOnlineConfig(onlineDb.getConfig());
  };

  const syncAllToOnlineDb = async () => {
    setIsSyncing(true);
    setLastSyncMessage('Đang đồng bộ dữ liệu lên CSDL Online...');
    try {
      await onlineDb.syncTable('companies', companies);
      await onlineDb.syncTable('container_assets', assets);
      await onlineDb.syncTable('offers', offers);
      await onlineDb.syncTable('container_requests', requests);
      await onlineDb.syncTable('transactions', transactions);
      setLastSyncMessage('Đồng bộ CSDL Online thành công lúc ' + new Date().toLocaleTimeString('vi-VN'));
    } catch {
      setLastSyncMessage('Đã lưu dữ liệu vào bộ nhớ đệm');
    } finally {
      setIsSyncing(false);
    }
  };

  const addAsset = (assetData: Omit<ContainerAsset, 'id' | 'isLocked'>): ContainerAsset => {
    const newAsset: ContainerAsset = {
      ...assetData,
      id: 'ASSET-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
      isLocked: false
    };
    setAssets(prev => [newAsset, ...prev]);
    addAudit('ASSET_CREATED', 'ContainerAsset', newAsset.id, `Đăng ký container mới ${newAsset.containerNumber}`);
    return newAsset;
  };

  const addOffer = (offerData: Omit<Offer, 'id' | 'createdAt'>): Offer => {
    const newOffer: Offer = {
      ...offerData,
      id: 'OFR-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
      createdAt: new Date().toISOString()
    };
    setOffers(prev => [newOffer, ...prev]);
    addAudit('OFFER_CREATED', 'Offer', newOffer.id, `Khởi tạo Offer nguồn cung cho cont ${newOffer.asset.containerNumber}`);
    return newOffer;
  };

  const addRequest = (reqData: Omit<ContainerRequest, 'id' | 'createdAt'>): ContainerRequest => {
    const newReq: ContainerRequest = {
      ...reqData,
      id: 'REQ-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
      createdAt: new Date().toISOString()
    };
    setRequests(prev => [newReq, ...prev]);
    addAudit('REQUEST_CREATED', 'ContainerRequest', newReq.id, `Tạo nhu cầu vỏ cont Booking ${newReq.bookingNumber}`);
    return newReq;
  };

  // 1. GIỮ CHỖ NGUYÊN TỬ (Atomic Reservation)
  const holdAtomicReservation = (candidate: MatchCandidate, request: ContainerRequest) => {
    const offer = offers.find(o => o.id === candidate.offer.id);
    if (!offer || offer.status !== 'AVAILABLE') {
      return { success: false, message: 'Lỗi xung đột (409): Container này vừa được người khác giữ chỗ.' };
    }

    const txnId = 'TXN-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    const newTxn: Transaction = {
      id: txnId,
      offerId: offer.id,
      requestId: request.id,
      assetId: offer.assetId,
      companyAId: offer.companyId,
      companyAName: offer.companyName,
      companyBId: request.companyId,
      companyBName: request.companyName,
      asset: offer.asset,
      status: 'NEGOTIATING',
      isOnHold: false,
      dueAt: new Date(Date.now() + 30 * 60000).toISOString(), // Khóa 30 phút
      nextAction: 'Hai bên A và B xem xét Thỏa thuận v1.0 và bấm Ký chấp thuận.',
      agreementVersion: 1,
      quote: candidate.quote,
      createdAt: new Date().toISOString()
    };

    // Khóa Offer và Request
    setOffers(prev => prev.map(o => o.id === offer.id ? { ...o, status: 'HELD' } : o));
    setRequests(prev => prev.map(r => r.id === request.id ? { ...r, status: 'HELD' } : r));
    setTransactions(prev => [newTxn, ...prev]);

    addAudit('ATOMIC_HOLD_RESERVED', 'Transaction', txnId, `Bên B giữ chỗ cont ${offer.asset.containerNumber} thành công trong 30 phút.`);
    return { success: true, transactionId: txnId, message: 'Đã giữ chỗ container thành công trong 30 phút!' };
  };

  // 2. KÝ THỎA THUẬN TÁI SỬ DỤNG
  const acceptAgreement = (transactionId: string, party: 'A' | 'B') => {
    const txn = transactions.find(t => t.id === transactionId);
    if (!txn) return { success: false, message: 'Không tìm thấy giao dịch.' };

    const nowIso = new Date().toISOString();
    const updated = { ...txn };

    if (party === 'A') {
      updated.companyAAcceptedAt = nowIso;
    } else {
      updated.companyBAcceptedAt = nowIso;
    }

    let msg = `Bên ${party} đã ký chấp nhận thỏa thuận.`;
    // Kiểm tra nếu cả 2 bên cùng ký
    if (updated.companyAAcceptedAt && updated.companyBAcceptedAt) {
      const guard = canTransitionTo(updated, 'PENDING_CARRIER');
      if (guard.allowed) {
        updated.status = 'PENDING_CARRIER';
        updated.nextAction = guard.nextAction || 'Chờ Hãng tàu phê duyệt RU.';
        updated.dueAt = new Date(Date.now() + 4 * 3600000).toISOString(); // 4 giờ chờ hãng tàu
        msg = 'Cả hai bên đã ký thỏa thuận! Giao dịch đã chuyển sang bước 2: Chờ Hãng tàu duyệt RU.';
      }
    }

    setTransactions(prev => prev.map(t => t.id === transactionId ? updated : t));
    addAudit('AGREEMENT_ACCEPTED', 'Transaction', transactionId, `Bên ${party} ký thỏa thuận v${updated.agreementVersion}`);
    return { success: true, message: msg };
  };

  // 3. OPS PHÊ DUYỆT RU HÃNG TÀU
  const opsApproveCarrier = (transactionId: string, refNumber: string, evidenceFileName: string) => {
    const txn = transactions.find(t => t.id === transactionId);
    if (!txn) return { success: false, message: 'Không tìm thấy giao dịch.' };

    const carrierApproval = {
      id: 'CA-' + Math.random().toString(36).substring(2, 7).toUpperCase(),
      transactionId,
      carrierCode: txn.asset.carrierCode,
      approvalReference: refNumber,
      status: 'APPROVED' as const,
      opsReviewerName: 'Vũ Minh Trí (Ops Lead)',
      evidenceFileName,
      approvedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 3600000).toISOString()
    };

    const updated: Transaction = {
      ...txn,
      carrierApproval,
      paymentOrderA: {
        id: 'PAY-A-' + Math.random().toString(36).substring(2, 7),
        transactionId,
        companyId: txn.companyAId,
        companyName: txn.companyAName,
        payerRole: 'PARTY_A',
        amountVnd: txn.quote.econtCollectedFromA,
        status: 'PENDING'
      },
      paymentOrderB: {
        id: 'PAY-B-' + Math.random().toString(36).substring(2, 7),
        transactionId,
        companyId: txn.companyBId,
        companyName: txn.companyBName,
        payerRole: 'PARTY_B',
        amountVnd: txn.quote.econtCollectedFromB,
        status: 'PENDING'
      }
    };

    const guard = canTransitionTo(updated, 'AWAITING_PAYMENT');
    if (guard.allowed) {
      updated.status = 'AWAITING_PAYMENT';
      updated.nextAction = guard.nextAction || 'Chờ hai bên thanh toán nghĩa vụ phí.';
      updated.dueAt = new Date(Date.now() + 2 * 3600000).toISOString(); // 2 giờ chờ nộp tiền
    }

    setTransactions(prev => prev.map(t => t.id === transactionId ? updated : t));
    addAudit('CARRIER_RU_APPROVED', 'Transaction', transactionId, `Ops phê duyệt số RU ${refNumber} từ hãng tàu ${txn.asset.carrierCode}`);
    return { success: true, message: 'Đã lưu văn bản phê duyệt RU của Hãng tàu! Chuyển sang Bước 3: Thanh toán.' };
  };

  // 4. XÁC NHẬN THANH TOÁN (Tài chính)
  const settlePayment = (transactionId: string, party: 'A' | 'B', bankRef: string) => {
    const txn = transactions.find(t => t.id === transactionId);
    if (!txn) return { success: false, message: 'Không tìm thấy giao dịch.' };

    const updated = { ...txn };
    const nowIso = new Date().toISOString();

    if (party === 'A' && updated.paymentOrderA) {
      updated.paymentOrderA = { ...updated.paymentOrderA, status: 'SETTLED', bankReference: bankRef, settledAt: nowIso };
    } else if (party === 'B' && updated.paymentOrderB) {
      updated.paymentOrderB = { ...updated.paymentOrderB, status: 'SETTLED', bankReference: bankRef, settledAt: nowIso };
    }

    let msg = `Đã xác nhận thanh toán thành công cho Bên ${party}.`;

    // Nếu cả 2 bên đã thanh toán đủ -> Tự động phát hành Dispatch Permit
    if (updated.paymentOrderA?.status === 'SETTLED' && updated.paymentOrderB?.status === 'SETTLED') {
      const permitToken = 'DP-' + Math.random().toString(36).substring(2, 10).toUpperCase();
      updated.dispatchPermit = {
        id: 'PERMIT-' + Math.random().toString(36).substring(2, 7),
        transactionId,
        permitNumber: 'ECONT-DP-' + Math.floor(100000 + Math.random() * 900000),
        verificationToken: permitToken,
        driverName: 'Nguyễn Văn Tài (Tài xế nhận cont)',
        truckPlate: '51D-894.22',
        validFrom: new Date().toISOString(),
        validUntil: new Date(Date.now() + 12 * 3600000).toISOString(),
        status: 'ACTIVE',
        issuedAt: nowIso
      };

      const guard = canTransitionTo(updated, 'READY_FOR_PICKUP');
      if (guard.allowed) {
        updated.status = 'READY_FOR_PICKUP';
        updated.nextAction = guard.nextAction || 'Phiếu điều phối đã kích hoạt. Sẵn sàng nhận cont tại kho A.';
        msg = 'Cả hai bên đã thanh toán đủ! Đã tự động phát hành Phiếu điều phối (Dispatch Permit).';
      }
    }

    setTransactions(prev => prev.map(t => t.id === transactionId ? updated : t));
    addAudit('PAYMENT_SETTLED', 'PaymentOrder', transactionId, `Thanh toán bên ${party} đã đối soát thành công (${bankRef})`);
    return { success: true, message: msg };
  };

  // 5. NỘP BIÊN BẢN KIỂM TRA THỰC ĐỊA 6 MẶT (Inspection)
  const submitInspection = (transactionId: string, inspectionData: {
    inspectorName: string;
    checklistFloor: boolean;
    checklistWalls: boolean;
    checklistRoof: boolean;
    checklistDoors: boolean;
    checklistGaskets: boolean;
    checklistUndercarriage: boolean;
    isDiscrepancyFound: boolean;
    discrepancyNotes?: string;
  }) => {
    const txn = transactions.find(t => t.id === transactionId);
    if (!txn) return { success: false, message: 'Không tìm thấy giao dịch.' };

    const inspection = {
      id: 'INSP-' + Math.random().toString(36).substring(2, 7),
      transactionId,
      ...inspectionData,
      photos: [
        'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=600&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1578575437130-527eed3abbec?w=600&auto=format&fit=crop&q=80'
      ],
      inspectedAt: new Date().toISOString()
    };

    const updated: Transaction = { ...txn, inspection };

    if (inspectionData.isDiscrepancyFound) {
      // Có hư hỏng bất thường -> ON_HOLD và tự động tạo Case khiếu nại
      updated.isOnHold = true;
      updated.holdReason = 'Phát hiện hư hỏng ngoài biên bản: ' + (inspectionData.discrepancyNotes || 'Sai lệch tình trạng vỏ');
      
      const newCase: CaseIssue = {
        id: 'CASE-' + Math.random().toString(36).substring(2, 7).toUpperCase(),
        transactionId,
        openedByCompanyId: txn.companyBId,
        openedByCompanyName: txn.companyBName,
        caseType: 'DAMAGE_DISPUTE',
        title: 'Phát hiện sai lệch tình trạng cont khi kiểm tra tại bãi',
        description: inspectionData.discrepancyNotes || 'Hư hỏng không khớp với khai báo ban đầu của Bên A.',
        status: 'OPEN',
        createdAt: new Date().toISOString()
      };
      setCases(prev => [newCase, ...prev]);
      setTransactions(prev => prev.map(t => t.id === transactionId ? updated : t));
      addAudit('INSPECTION_FAILED_HOLD', 'Transaction', transactionId, 'Kiểm tra cont phát hiện sai lệch. Giao dịch kích hoạt ON_HOLD.');
      return { success: true, message: 'Đã ghi nhận sai lệch! Giao dịch đang TẠM DỪNG (ON_HOLD) để Ops xử lý Case.' };
    }

    // Không có sai lệch -> Cho phép chuyển sang Bước 6: HANDOVER_PENDING
    updated.status = 'HANDOVER_PENDING';
    updated.nextAction = 'Hai bên A và B đối chiếu biên bản kiểm tra và ký xác nhận bàn giao.';
    setTransactions(prev => prev.map(t => t.id === transactionId ? updated : t));
    addAudit('INSPECTION_PASSED', 'Transaction', transactionId, 'Kiểm tra cont 6 mặt đạt tiêu chuẩn. Chuyển sang chờ ký bàn giao.');
    return { success: true, message: 'Kiểm tra cont hoàn tất đạt chuẩn! Chuyển sang Bước 6: Chờ ký bàn giao.' };
  };

  // 6. XÁC NHẬN BÀN GIAO 2 BÊN (DUAL CONFIRMATION) -> COMPLETED
  const confirmHandover = (transactionId: string, party: 'A' | 'B') => {
    const txn = transactions.find(t => t.id === transactionId);
    if (!txn) return { success: false, message: 'Không tìm thấy giao dịch.' };

    const updated = { ...txn };
    const hash = 'SHA256:ECONT-' + Math.random().toString(36).substring(2, 12).toUpperCase();
    updated.handoverHash = hash;

    const guard = canTransitionTo(updated, 'COMPLETED');
    if (guard.allowed) {
      updated.status = 'COMPLETED';
      updated.nextAction = 'Giao dịch hoàn tất thành công. Quyền quản lý cont đã thuộc về Bên B.';

      // Chuyển Custody của Asset từ A sang B
      setAssets(prev => prev.map(a => a.id === updated.assetId ? {
        ...a,
        currentCustodianId: updated.companyBId,
        currentCustodianName: updated.companyBName,
        currentLocationName: 'Kho Bên B (Đã bàn giao)',
        isLocked: false
      } : a));

      // Đánh dấu Offer & Request là COMPLETED
      setOffers(prev => prev.map(o => o.id === updated.offerId ? { ...o, status: 'COMPLETED' } : o));
      setRequests(prev => prev.map(r => r.id === updated.requestId ? { ...r, status: 'COMPLETED' } : r));
    }

    setTransactions(prev => prev.map(t => t.id === transactionId ? updated : t));
    addAudit('HANDOVER_COMPLETED', 'Transaction', transactionId, `Hoàn tất giao nhận cont ${txn.asset.containerNumber}. Mã xác thực: ${hash}`);
    return { success: true, message: 'Chúc mừng! Hai bên đã ký bàn giao thành công. Giao dịch đạt trạng thái COMPLETED!' };
  };

  // Bật / tắt Hold thủ công (Dành cho Ops)
  const toggleHold = (transactionId: string, isOnHold: boolean, reason?: string) => {
    setTransactions(prev => prev.map(t => {
      if (t.id === transactionId) {
        return {
          ...t,
          isOnHold,
          holdReason: isOnHold ? (reason || 'Ops tạm giữ để làm rõ') : undefined
        };
      }
      return t;
    }));
    addAudit('TRANSACTION_HOLD_TOGGLED', 'Transaction', transactionId, `Trạng thái Hold thay đổi: ${isOnHold} (Lý do: ${reason || 'Không'})`);
  };

  // Giải quyết khiếu nại (Ops)
  const resolveCase = (caseId: string, resolutionSummary: string) => {
    setCases(prev => prev.map(c => {
      if (c.id === caseId) {
        return {
          ...c,
          status: 'RESOLVED',
          resolutionSummary,
          resolvedAt: new Date().toISOString()
        };
      }
      return c;
    }));
    addAudit('CASE_RESOLVED', 'Case', caseId, `Ops giải quyết khiếu nại: ${resolutionSummary}`);
  };

  // Reset về dữ liệu gốc
  const resetToDemoData = () => {
    setCompanies(INITIAL_COMPANIES);
    setAssets(INITIAL_ASSETS);
    setOffers(INITIAL_OFFERS);
    setRequests(INITIAL_REQUESTS);
    setTransactions(INITIAL_TRANSACTIONS);
    setCases(INITIAL_CASES);
    setAuditLogs(INITIAL_AUDIT_LOGS);
    localStorage.clear();
    addAudit('DATABASE_RESET', 'System', 'ALL', 'Khôi phục dữ liệu mẫu ban đầu theo chuẩn SRS.');
  };

  return (
    <DatabaseContext.Provider
      value={{
        companies,
        assets,
        offers,
        requests,
        transactions,
        cases,
        auditLogs,
        onlineConfig,
        isSyncing,
        lastSyncMessage,
        addAsset,
        addOffer,
        addRequest,
        holdAtomicReservation,
        acceptAgreement,
        opsApproveCarrier,
        settlePayment,
        submitInspection,
        confirmHandover,
        toggleHold,
        resolveCase,
        resetToDemoData,
        syncAllToOnlineDb,
        updateOnlineConfig
      }}
    >
      {children}
    </DatabaseContext.Provider>
  );
};

export const useDatabase = (): DatabaseContextType => {
  const ctx = useContext(DatabaseContext);
  if (!ctx) {
    throw new Error('useDatabase must be used within a DatabaseProvider');
  }
  return ctx;
};

