// ==============================================================================
// ECont TransactionsPage - Version 2.0
// Vòng đời giao dịch 7 bước hoàn chỉnh theo SRS v1.0 & plan.md §6
// ==============================================================================

import React, { useState } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { useAuth } from '../context/AuthContext';
import { TransactionStepper } from '../components/TransactionStepper';
import { PricingBreakdownCard } from '../components/PricingBreakdownCard';
import { TransactionStatusBadge, ConditionBadge } from '../components/StatusBadge';
import { formatVnd, formatDateTime, formatDateTimeLocal, formatRelativeTime } from '../lib/utils';
import {
  FileText, 
  Ship, 
  CreditCard, 
  QrCode, 
  Eye, 
  PenTool, 
  CheckCircle, 
  AlertTriangle, 
  CheckCircle2, 
  Camera,
  Truck,
  Building,
  Lock,
  Unlock,
  MessageCircle,
  AlertCircle,
  Clock,
  ArrowRight,
  ShieldAlert,
  Send,
  X
} from 'lucide-react';
import { FieldErrors, FieldError, FormErrorSummary, RequiredMark, getFieldErrorClass, scrollToFirstFieldError } from '../components/FormValidation';
import { required, validFutureDate, setError } from '../lib/formValidation';

interface TransactionsPageProps {
  selectedTxnId?: string;
  setSelectedTxnId: (id: string) => void;
  setCurrentTab?: (tab: string) => void;
}

export const TransactionsPage: React.FC<TransactionsPageProps> = ({
  selectedTxnId,
  setSelectedTxnId,
  setCurrentTab
}) => {
  const { 
    transactions, 
    acceptAgreement,
    requestAgreementChange,
    opsApproveCarrier,
    opsRejectCarrier,
    settlePayment,
    generateDispatchPermit,
    activateInspection,
    submitInspection, 
    confirmHandoverA,
    confirmHandoverB,
    toggleHold,
    cancelTransaction,
    startChatThread
  } = useDatabase();
  const { currentRole, currentCompany } = useAuth();

  // Active transaction
  const activeTxn = transactions.find(t => t.id === selectedTxnId) || transactions[0];

  // Permissions
  const canSignAsA = currentRole === 'ENTERPRISE_A' && currentCompany.id === activeTxn?.companyAId;
  const canSignAsB = currentRole === 'ENTERPRISE_B' && currentCompany.id === activeTxn?.companyBId;
  const canOperate = currentRole === 'OPS' || currentRole === 'SUPER_ADMIN';
  const canReconcile = currentRole === 'FINANCE' || currentRole === 'SUPER_ADMIN';

  // Step 2: Carrier approval state
  const [carrierRef, setCarrierRef] = useState('RU-2026-9812-MSK');
  const [evidenceName, setEvidenceName] = useState('CV_Chap_Thuan_Cap_Lai_Vo_MSK.pdf');
  const [carrierExpiry, setCarrierExpiry] = useState(
    new Date(Date.now() + 48 * 3600000).toISOString().slice(0, 16)
  );

  // Step 4: Dispatch permit edit
  const [driverName, setDriverName] = useState('Nguyễn Văn Tài');
  const [truckPlate, setTruckPlate] = useState('51D-894.22');

  // Step 5: Checklist 6 faces
  const [chkFloor, setChkFloor] = useState(true);
  const [chkWalls, setChkWalls] = useState(true);
  const [chkRoof, setChkRoof] = useState(true);
  const [chkDoors, setChkDoors] = useState(true);
  const [chkGaskets, setChkGaskets] = useState(true);
  const [chkUndercarriage, setChkUndercarriage] = useState(true);
  const [isDiscrepancy, setIsDiscrepancy] = useState(false);
  const [discrepancyNote, setDiscrepancyNote] = useState('');
  const [discrepancySeverity, setDiscrepancySeverity] = useState<'MINOR' | 'MAJOR'>('MINOR');
  const [inspectionPhotos, setInspectionPhotos] = useState<string[]>([
    'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800',
    'https://images.unsplash.com/photo-1578575437130-527eed3abbec?w=800',
  ]);

  const handleUploadInspectionPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        setInspectionPhotos(p => [...p, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  // Hold / Cancel Modals
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [showHoldModal, setShowHoldModal] = useState(false);
  const [holdReason, setHoldReason] = useState('');
  const [carrierErrors, setCarrierErrors] = useState<FieldErrors>({});
  const [inspectionErrors, setInspectionErrors] = useState<FieldErrors>({});
  const [cancelErrors, setCancelErrors] = useState<FieldErrors>({});
  const [holdErrors, setHoldErrors] = useState<FieldErrors>({});

  const handleCarrierApproval = () => {
    if (!activeTxn) return;
    const errors: FieldErrors = {};
    setError(errors, 'carrierRef', required(carrierRef, 'Vui lòng nhập số văn bản RU của hãng tàu.'));
    setError(errors, 'evidenceName', required(evidenceName, 'Vui lòng nhập tên file bằng chứng RU.'));
    setError(errors, 'carrierExpiry', validFutureDate(carrierExpiry, 'hạn hiệu lực RU'));
    setCarrierErrors(errors);
    if (Object.keys(errors).length > 0) {
      scrollToFirstFieldError(errors);
      return;
    }
    const result = opsApproveCarrier(activeTxn.id, carrierRef.trim(), evidenceName.trim(), new Date(carrierExpiry).toISOString());
    if (!result.success) {
      setCarrierErrors({ carrierRef: result.message });
      scrollToFirstFieldError({ carrierRef: result.message });
      return;
    }
    setCarrierErrors({});
  };

  const handleInspectionSubmit = () => {
    if (!activeTxn) return;
    const errors: FieldErrors = {};
    if (![chkFloor, chkWalls, chkRoof, chkDoors, chkGaskets, chkUndercarriage].every(Boolean)) {
      errors.inspectionChecklist = 'Vui lòng xác nhận đủ 6 hạng mục kiểm tra IICL.';
    }
    if (isDiscrepancy && !discrepancyNote.trim()) {
      errors.discrepancyNote = 'Vui lòng mô tả chi tiết sai lệch/hư hỏng thực tế.';
    }
    setInspectionErrors(errors);
    if (Object.keys(errors).length > 0) {
      scrollToFirstFieldError(errors);
      return;
    }
    const result = submitInspection(activeTxn.id, {
      inspectorName: 'Nguyễn Văn Tài (Tài xế/Đại diện bên B)',
      checklistFloor: chkFloor,
      checklistWalls: chkWalls,
      checklistRoof: chkRoof,
      checklistDoors: chkDoors,
      checklistGaskets: chkGaskets,
      checklistUndercarriage: chkUndercarriage,
      isDiscrepancyFound: isDiscrepancy,
      discrepancyNotes: discrepancyNote.trim(),
      discrepancySeverity: isDiscrepancy ? discrepancySeverity : undefined,
    });
    if (!result.success) {
      setInspectionErrors({ inspectionChecklist: result.message });
      scrollToFirstFieldError({ inspectionChecklist: result.message });
    } else {
      setInspectionErrors({});
    }
  };

  const handleCancelTransaction = () => {
    if (!activeTxn) return;
    const errors: FieldErrors = {};
    setError(errors, 'cancelReason', required(cancelReason, 'Vui lòng nhập lý do hủy giao dịch.'));
    setCancelErrors(errors);
    if (Object.keys(errors).length > 0) {
      scrollToFirstFieldError(errors);
      return;
    }
    const result = cancelTransaction(activeTxn.id, cancelReason.trim());
    if (!result.success) {
      setCancelErrors({ cancelReason: result.message });
      scrollToFirstFieldError({ cancelReason: result.message });
      return;
    }
    setShowCancelModal(false);
    setCancelReason('');
    setCancelErrors({});
  };

  const handleHoldTransaction = () => {
    if (!activeTxn) return;
    const errors: FieldErrors = {};
    setError(errors, 'holdReason', required(holdReason, 'Vui lòng nhập lý do tạm dừng giao dịch.'));
    setHoldErrors(errors);
    if (Object.keys(errors).length > 0) {
      scrollToFirstFieldError(errors);
      return;
    }
    const result = toggleHold(activeTxn.id, true, holdReason.trim());
    if (!result.success) {
      setHoldErrors({ holdReason: result.message });
      scrollToFirstFieldError({ holdReason: result.message });
      return;
    }
    setShowHoldModal(false);
    setHoldReason('');
    setHoldErrors({});
  };

  if (!activeTxn) {
    return (
      <div className="py-16 text-center space-y-3 bg-white border border-slate-200 rounded-2xl p-8">
        <FileText className="w-12 h-12 text-slate-300 mx-auto" />
        <h3 className="text-lg font-bold text-slate-700">Chưa có giao dịch nào</h3>
        <p className="text-xs text-slate-500">Hãy vào mục Nhu cầu để ghép đôi và giữ chỗ container.</p>
      </div>
    );
  }

  // Agreement version
  const currentAgreement = activeTxn.agreements.find(a => a.version === activeTxn.currentAgreementVersion) || activeTxn.agreements[0];

  // Chat launcher
  const handleOpenChat = () => {
    startChatThread({
      offerId: activeTxn.offerId,
      requestId: activeTxn.requestId,
      transactionId: activeTxn.id,
      companyAId: activeTxn.companyAId,
      companyAName: activeTxn.companyAName,
      companyBId: activeTxn.companyBId,
      companyBName: activeTxn.companyBName,
      contextLabel: `Giao dịch ${activeTxn.id} · ${activeTxn.asset.containerNumber}`,
      contextType: 'TRANSACTION',
      containerNumber: activeTxn.asset.containerNumber,
      carrierCode: activeTxn.asset.carrierCode,
      containerType: activeTxn.asset.containerType,
      pickupLocationName: activeTxn.asset.currentLocationName,
    });
    if (setCurrentTab) {
      setCurrentTab('chat');
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Selector */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <FileText className="w-5 h-5 text-brand-600" />
              <span>Giao dịch {activeTxn.id}</span>
            </h2>
            <TransactionStatusBadge status={activeTxn.status} size="sm" />
            {activeTxn.isOnHold && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                <Lock className="w-3 h-3" /> TẠM DỪNG (HOLD)
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Container: <strong className="font-mono text-slate-800">{activeTxn.asset.containerNumber}</strong> ({activeTxn.asset.containerType} · {activeTxn.asset.carrierCode}) · 
            Tuyến: <strong className="text-slate-700">{activeTxn.companyAName}</strong> → <strong className="text-slate-700">{activeTxn.companyBName}</strong>
          </p>
        </div>

        <div className="flex items-center gap-3">
          {transactions.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Chọn GD:</span>
              <select
                value={activeTxn.id}
                onChange={(e) => setSelectedTxnId(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 font-mono outline-none focus:ring-2 focus:ring-brand-500"
              >
                {transactions.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.id} - {t.asset.containerNumber} ({t.status})
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={handleOpenChat}
            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <MessageCircle className="w-4 h-4 text-brand-600" />
            <span>Nhắn tin</span>
          </button>
        </div>
      </div>

      {/* 2. Stepper Component */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <TransactionStepper transaction={activeTxn} />
      </div>

      {/* 3. Action Panel based on Current Step */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Flow Control (Left 2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* BƯỚC 1: NEGOTIATING */}
          {activeTxn.status === 'NEGOTIATING' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center font-bold text-sm">
                    1
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 uppercase">
                      BƯỚC 1: XEM XÉT & KÝ CHẤP THUẬN THỎA THUẬN TÁI SỬ DỤNG VỎ
                    </h4>
                    <p className="text-xs text-slate-500">Phiên bản Thỏa thuận: v{activeTxn.currentAgreementVersion} · Mã băm: <span className="font-mono text-slate-600">{currentAgreement.contentHash}</span></p>
                  </div>
                </div>
              </div>

              {/* Tóm tắt điều khoản thỏa thuận */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm space-y-2 text-slate-700">
                <div className="font-semibold text-slate-900 mb-1">Nội dung Thỏa thuận Tái sử dụng Container (ECont Agreement v{activeTxn.currentAgreementVersion}):</div>
                <p>1. <strong>Bên A ({activeTxn.companyAName})</strong> cam kết container {activeTxn.asset.containerNumber} đạt chuẩn đóng hàng xuất khẩu, còn hạn detention tối thiểu đến ngày quy định.</p>
                <p>2. <strong>Bên B ({activeTxn.companyBName})</strong> chịu trách nhiệm điều xe kéo cont từ kho A đến kho B và nhận bàn giao đúng hạn cut-off.</p>
                <p>3. Phí tái sử dụng của Hãng tàu được chia sẻ tỷ lệ α = {activeTxn.quote.shareAlpha}. Phí dịch vụ ECont chỉ thu trên mức tiết kiệm thực tế.</p>
                <p className="text-xs text-slate-500 pt-1">
                  * Khi cả hai bên ký chấp nhận cùng phiên bản v{activeTxn.currentAgreementVersion}, giao dịch sẽ tự động chuyển sang Bước 2 (Chờ Hãng tàu RU).
                </p>
              </div>

              {/* Trạng thái ký của A và B */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <div>
                    <div className="text-xs sm:text-sm font-bold text-emerald-700">BÊN A (Chủ vỏ)</div>
                    <div className="text-xs text-slate-500 mt-1">
                      {currentAgreement.companyAAcceptedAt 
                        ? `Đã ký: ${formatDateTime(currentAgreement.companyAAcceptedAt)}` 
                        : 'Chưa ký xác nhận'}
                    </div>
                  </div>
                  {currentAgreement.companyAAcceptedAt ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  ) : canSignAsA ? (
                    <button
                      onClick={() => {
                        const res = acceptAgreement(activeTxn.id);
                        if (!res.success) alert(res.message);
                      }}
                      className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm transition-colors"
                    >
                      Bên A Ký Thỏa Thuận
                    </button>
                  ) : (
                    <span className="text-xs text-slate-500 font-medium">Chờ đại diện A ký</span>
                  )}
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <div>
                    <div className="text-xs sm:text-sm font-bold text-blue-700">BÊN B (Chủ hàng)</div>
                    <div className="text-xs text-slate-500 mt-1">
                      {currentAgreement.companyBAcceptedAt 
                        ? `Đã ký: ${formatDateTime(currentAgreement.companyBAcceptedAt)}` 
                        : 'Chưa ký xác nhận'}
                    </div>
                  </div>
                  {currentAgreement.companyBAcceptedAt ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  ) : canSignAsB ? (
                    <button
                      onClick={() => {
                        const res = acceptAgreement(activeTxn.id);
                        if (!res.success) alert(res.message);
                      }}
                      className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-sm transition-colors"
                    >
                      Bên B Ký Thỏa Thuận
                    </button>
                  ) : (
                    <span className="text-xs text-slate-500 font-medium">Chờ đại diện B ký</span>
                  )}
                </div>
              </div>

              {/* Action buttons: Sửa điều khoản / Hủy */}
              {(canSignAsA || canSignAsB) && (
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <button
                    onClick={() => {
                      const reason = prompt('Nhập lý do yêu cầu thay đổi điều khoản:');
                      if (reason) requestAgreementChange(activeTxn.id, reason);
                    }}
                    className="text-xs text-brand-600 hover:text-brand-700 font-semibold"
                  >
                    Yêu cầu điều chỉnh Thỏa thuận (Tạo v{activeTxn.currentAgreementVersion + 1})
                  </button>
                  <button
                    onClick={() => setShowCancelModal(true)}
                    className="text-xs text-red-600 hover:text-red-700 font-semibold"
                  >
                    Hủy giữ chỗ
                  </button>
                </div>
              )}
            </div>
          )}

          {/* BƯỚC 2: PENDING_CARRIER */}
          {activeTxn.status === 'PENDING_CARRIER' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center font-bold text-sm">
                    2
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 uppercase">
                      BƯỚC 2: TIẾP NHẬN PHÊ DUYỆT CẤP LẠI VỎ (RU APPROVAL) TỪ HÃNG TÀU
                    </h4>
                    <p className="text-xs text-slate-500">Bộ phận Ops ghi nhận bằng chứng văn bản phê duyệt của Hãng {activeTxn.asset.carrierCode}</p>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4 text-xs text-slate-700">
                <FormErrorSummary errors={carrierErrors} />
                <p>
                  Hãng tàu ({activeTxn.asset.carrierCode}) cấp văn bản chấp thuận cho phép container {activeTxn.asset.containerNumber} được tái sử dụng cho Booking của Bên B. 
                  Bộ phận Điều phối (Ops) xác thực số công văn và đính kèm bằng chứng PDF để chuyển giao dịch sang bước Thanh toán.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-slate-700 font-semibold block mb-1">Số văn bản RU của Hãng tàu <RequiredMark /></label>
                    <input
                      id="carrierRef"
                      data-field="carrierRef"
                      type="text"
                      value={carrierRef}
                      onChange={(e) => { setCarrierErrors({}); setCarrierRef(e.target.value); }}
                      aria-invalid={Boolean(carrierErrors.carrierRef)}
                      className={getFieldErrorClass(Boolean(carrierErrors.carrierRef), 'w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm font-mono outline-none uppercase focus:ring-2 focus:ring-brand-500')}
                      required
                    />
                    <FieldError message={carrierErrors.carrierRef} />
                  </div>
                  <div>
                    <label className="text-slate-700 font-semibold block mb-1">Tên file công văn đính kèm <RequiredMark /></label>
                    <input
                      id="evidenceName"
                      data-field="evidenceName"
                      type="text"
                      value={evidenceName}
                      onChange={(e) => { setCarrierErrors({}); setEvidenceName(e.target.value); }}
                      aria-invalid={Boolean(carrierErrors.evidenceName)}
                      className={getFieldErrorClass(Boolean(carrierErrors.evidenceName), 'w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm outline-none focus:ring-2 focus:ring-brand-500')}
                      required
                    />
                    <FieldError message={carrierErrors.evidenceName} />
                  </div>
                  <div>
                    <label className="text-slate-700 font-semibold block mb-1">Hiệu lực đến <RequiredMark /></label>
                    <input
                      id="carrierExpiry"
                      data-field="carrierExpiry"
                      type="datetime-local"
                      value={carrierExpiry}
                      onChange={(e) => { setCarrierErrors({}); setCarrierExpiry(e.target.value); }}
                      aria-invalid={Boolean(carrierErrors.carrierExpiry)}
                      className={getFieldErrorClass(Boolean(carrierErrors.carrierExpiry), 'w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm outline-none focus:ring-2 focus:ring-brand-500')}
                      required
                    />
                    <p className="text-[11px] text-slate-500" aria-live="polite">Hiển thị: {formatDateTimeLocal(carrierExpiry)}</p>
                    <FieldError message={carrierErrors.carrierExpiry} />
                  </div>
                </div>

                <div className="pt-2 flex flex-wrap justify-between items-center gap-3">
                  <span className="text-xs text-slate-500">
                    Quyền thao tác: <strong className="text-slate-700">Điều phối viên (Ops)</strong>
                  </span>
                  {canOperate ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const reason = prompt('Nhập lý do hãng tàu từ chối:');
                          if (reason) opsRejectCarrier(activeTxn.id, reason);
                        }}
                        className="px-3.5 py-2 rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 font-semibold text-xs"
                      >
                        Hãng tàu Từ chối
                      </button>
                      <button
                        onClick={() => {
                          handleCarrierApproval();
                        }}
                        className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold flex items-center gap-2 shadow-sm text-xs"
                      >
                        <Ship className="w-4 h-4" />
                        <span>Xác nhận Hãng Tàu Đã Duyệt RU</span>
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-amber-600 font-medium">Chờ Ops xác thực công văn từ Hãng tàu</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* BƯỚC 3: AWAITING_PAYMENT */}
          {activeTxn.status === 'AWAITING_PAYMENT' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 border border-purple-200 flex items-center justify-center font-bold text-sm">
                    3
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 uppercase">
                      BƯỚC 3: ĐỐI SOÁT & THANH TOÁN NGHĨA VỤ PHÍ QUA ECONT
                    </h4>
                    <p className="text-xs text-slate-500">Tài chính đối soát tiền thu hộ RU và phí dịch vụ nền tảng</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Lệnh thu bên A */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-700 uppercase text-xs">NGHĨA VỤ BÊN A</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                      activeTxn.paymentOrderA?.status === 'PAID' 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      {activeTxn.paymentOrderA?.status === 'PAID' ? 'ĐÃ ĐỐI SOÁT' : 'CHỜ THU'}
                    </span>
                  </div>
                  <div className="text-xl font-bold font-mono text-slate-900">
                    {formatVnd(activeTxn.quote.econtCollectedFromA)}
                  </div>
                  <div className="text-xs text-slate-500">
                    Bao gồm: Thu hộ RU ({formatVnd(activeTxn.quote.shareAlpha * activeTxn.quote.fRuVnd)}) + Phí ECont ({formatVnd(activeTxn.quote.fAVnd)})
                  </div>
                  {canReconcile && activeTxn.paymentOrderA?.status !== 'PAID' && (
                    <button
                      onClick={() => {
                        settlePayment(activeTxn.id, 'A', 'MB-TRAN-A9842', activeTxn.quote.econtCollectedFromA);
                      }}
                      className="w-full mt-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm"
                    >
                      Xác nhận đã nhận tiền Bên A
                    </button>
                  )}
                </div>

                {/* Lệnh thu bên B */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-blue-700 uppercase text-xs">NGHĨA VỤ BÊN B</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                      activeTxn.paymentOrderB?.status === 'PAID' 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      {activeTxn.paymentOrderB?.status === 'PAID' ? 'ĐÃ ĐỐI SOÁT' : 'CHỜ THU'}
                    </span>
                  </div>
                  <div className="text-xl font-bold font-mono text-slate-900">
                    {formatVnd(activeTxn.quote.econtCollectedFromB)}
                  </div>
                  <div className="text-xs text-slate-500">
                    Bao gồm: Thu hộ RU ({formatVnd((1 - activeTxn.quote.shareAlpha) * activeTxn.quote.fRuVnd)}) + Phí ECont ({formatVnd(activeTxn.quote.fBVnd)})
                  </div>
                  {canReconcile && activeTxn.paymentOrderB?.status !== 'PAID' && (
                    <button
                      onClick={() => {
                        settlePayment(activeTxn.id, 'B', 'VCB-TRAN-B1290', activeTxn.quote.econtCollectedFromB);
                      }}
                      className="w-full mt-2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-sm"
                    >
                      Xác nhận đã nhận tiền Bên B
                    </button>
                  )}
                </div>
              </div>

              {!canReconcile && (
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-xs text-purple-700 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 shrink-0" />
                  <span>Hai bên vui lòng chuyển khoản theo thông tin lệnh nộp. Bộ phận Tài chính sẽ đối soát sau khi nhận tiền.</span>
                </div>
              )}
            </div>
          )}

          {/* BƯỚC 4: READY_FOR_PICKUP */}
          {activeTxn.status === 'READY_FOR_PICKUP' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center font-bold text-sm">
                    4
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 uppercase">
                      BƯỚC 4: PHIẾU ĐIỀU PHỐI ĐÃ KÍCH HOẠT (DISPATCH PERMIT)
                    </h4>
                    <p className="text-xs text-slate-500">Mã phiếu hợp lệ · Tài xế dùng mã QR để check-in tại cổng kho A</p>
                  </div>
                </div>
              </div>

              {/* Thông tin phiếu Dispatch Permit */}
              <div className="p-5 rounded-xl bg-slate-50 border border-emerald-300 flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1.5 text-xs sm:text-sm text-slate-700">
                  <div className="text-emerald-700 font-mono font-bold text-base flex items-center gap-2">
                    <span>{activeTxn.dispatchPermit?.permitNumber || 'ECONT-DP-2026-98421'}</span>
                    <span className="text-xs bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full font-bold">ACTIVE</span>
                  </div>
                  <div>
                    Tài xế nhận cont: <strong className="text-slate-900">{activeTxn.dispatchPermit?.driverName || driverName}</strong> · Biển số xe: <strong className="font-mono text-brand-700">{activeTxn.dispatchPermit?.truckPlate || truckPlate}</strong>
                  </div>
                  <div className="text-slate-500">
                    Địa điểm lấy: {activeTxn.asset.currentLocationName}
                  </div>
                  <div className="text-xs text-slate-500">
                    Token bảo mật: <span className="font-mono text-slate-700 font-semibold">{activeTxn.dispatchPermit?.verificationToken || 'DP-SEC-8921'}</span> · Hiệu lực đến: {formatDateTime(activeTxn.dispatchPermit?.validUntil)}
                  </div>
                </div>

                <div className="flex flex-col items-center p-3 rounded-xl bg-white border border-slate-200 text-slate-900 text-center shadow-sm">
                  <QrCode className="w-16 h-16 text-slate-800" />
                  <span className="text-xs font-mono font-bold mt-1 text-slate-600">QUÉT QR CHECK-IN</span>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                {(canSignAsB || canOperate) && (
                  <button
                    onClick={() => activateInspection(activeTxn.id)}
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-2 shadow-sm text-xs transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                    <span>Tài xế Đã Tới Kho A & Tiến Hành Kiểm Tra (Chuyển Bước 5)</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* BƯỚC 5: INSPECTION */}
          {activeTxn.status === 'INSPECTION' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center justify-center font-bold text-sm">
                    5
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 uppercase">
                      BƯỚC 5: BIÊN BẢN KIỂM TRA THỰC ĐỊA 6 MẶT CONTAINER (IICL)
                    </h4>
                    <p className="text-xs text-slate-500">Tài xế/Đại diện Bên B kiểm tra thực tế trước khi bấm nhận cont</p>
                  </div>
                </div>
              </div>

              {/* 6 hạng mục kiểm tra theo tiêu chuẩn IICL */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4 text-xs text-slate-700">
                <div className="font-semibold text-slate-900">Checklist tình trạng vỏ container (IICL Standard) <RequiredMark />:</div>
                <FormErrorSummary errors={inspectionErrors} />
                <div id="inspectionChecklist" data-field="inspectionChecklist" className={getFieldErrorClass(Boolean(inspectionErrors.inspectionChecklist), 'grid grid-cols-2 sm:grid-cols-3 gap-3')}>
                  <label className="flex items-center gap-2 p-2.5 rounded-lg bg-white border border-slate-200 cursor-pointer shadow-sm">
                    <input type="checkbox" checked={chkFloor} onChange={e => { setChkFloor(e.target.checked); setInspectionErrors(p => ({ ...p, inspectionChecklist: '' })); }} className="rounded text-brand-600" />
                    <span>1. Sàn gỗ khô, sạch</span>
                  </label>
                  <label className="flex items-center gap-2 p-2.5 rounded-lg bg-white border border-slate-200 cursor-pointer shadow-sm">
                    <input type="checkbox" checked={chkWalls} onChange={e => { setChkWalls(e.target.checked); setInspectionErrors(p => ({ ...p, inspectionChecklist: '' })); }} className="rounded text-brand-600" />
                    <span>2. Vách không thủng</span>
                  </label>
                  <label className="flex items-center gap-2 p-2.5 rounded-lg bg-white border border-slate-200 cursor-pointer shadow-sm">
                    <input type="checkbox" checked={chkRoof} onChange={e => { setChkRoof(e.target.checked); setInspectionErrors(p => ({ ...p, inspectionChecklist: '' })); }} className="rounded text-brand-600" />
                    <span>3. Nóc kín nước 100%</span>
                  </label>
                  <label className="flex items-center gap-2 p-2.5 rounded-lg bg-white border border-slate-200 cursor-pointer shadow-sm">
                    <input type="checkbox" checked={chkDoors} onChange={e => { setChkDoors(e.target.checked); setInspectionErrors(p => ({ ...p, inspectionChecklist: '' })); }} className="rounded text-brand-600" />
                    <span>4. Cửa đóng mở nhẹ</span>
                  </label>
                  <label className="flex items-center gap-2 p-2.5 rounded-lg bg-white border border-slate-200 cursor-pointer shadow-sm">
                    <input type="checkbox" checked={chkGaskets} onChange={e => { setChkGaskets(e.target.checked); setInspectionErrors(p => ({ ...p, inspectionChecklist: '' })); }} className="rounded text-brand-600" />
                    <span>5. Gioăng cao su kín</span>
                  </label>
                  <label className="flex items-center gap-2 p-2.5 rounded-lg bg-white border border-slate-200 cursor-pointer shadow-sm">
                    <input type="checkbox" checked={chkUndercarriage} onChange={e => { setChkUndercarriage(e.target.checked); setInspectionErrors(p => ({ ...p, inspectionChecklist: '' })); }} className="rounded text-brand-600" />
                    <span>6. Đà đáy vững chắc</span>
                  </label>
                </div>
                <FieldError message={inspectionErrors.inspectionChecklist} />

                {/* Photo upload at inspection */}
                <div className="pt-2 border-t border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-800">
                      Ảnh chụp hiện trường giám định ({inspectionPhotos.length} ảnh)
                    </span>
                    <label className="cursor-pointer text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1">
                      <Camera className="w-3.5 h-3.5" />
                      <span>Tải ảnh hiện trường</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={handleUploadInspectionPhoto}
                      />
                    </label>
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                    {inspectionPhotos.map((url, idx) => (
                      <div key={idx} className="h-16 rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
                        <img src={url} alt={`Ảnh kiểm tra ${idx + 1}`} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tùy chọn báo hư hỏng */}
                <div className="pt-2 border-t border-slate-200">
                  <label className="flex items-center gap-2 text-rose-600 font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isDiscrepancy}
                      onChange={e => setIsDiscrepancy(e.target.checked)}
                      className="rounded text-rose-600"
                    />
                    <span>Phát hiện sai lệch/hư hỏng thực tế (Báo cáo sự cố)</span>
                  </label>
                  {isDiscrepancy && (
                    <div className="mt-3 space-y-2 p-3 bg-rose-50 border border-rose-200 rounded-xl">
                      <div className="flex gap-4">
                        <label className="flex items-center gap-1.5 text-xs text-slate-700">
                          <input
                            type="radio"
                            name="sev"
                            checked={discrepancySeverity === 'MINOR'}
                            onChange={() => setDiscrepancySeverity('MINOR')}
                          />
                          <span>Hư nhẹ (Tiếp tục được nếu thỏa thuận)</span>
                        </label>
                        <label className="flex items-center gap-1.5 text-xs text-rose-700 font-semibold">
                          <input
                            type="radio"
                            name="sev"
                            checked={discrepancySeverity === 'MAJOR'}
                            onChange={() => setDiscrepancySeverity('MAJOR')}
                          />
                          <span>Hư nặng (Không nhận cont - Kích hoạt ON_HOLD)</span>
                        </label>
                      </div>
                      <label htmlFor="inspection-discrepancyNote" className="block text-xs font-semibold text-rose-700">Mô tả sai lệch/hư hỏng <RequiredMark /></label>
                      <textarea
                        id="inspection-discrepancyNote"
                        data-field="discrepancyNote"
                        value={discrepancyNote}
                        onChange={e => { setInspectionErrors({}); setDiscrepancyNote(e.target.value); }}
                        placeholder="Mô tả chi tiết sai lệch (vd: thủng nóc 10cm, rách đà đáy)..."
                        aria-invalid={Boolean(inspectionErrors.discrepancyNote)}
                        className={getFieldErrorClass(Boolean(inspectionErrors.discrepancyNote), 'w-full px-3 py-2 rounded-lg bg-white border border-rose-300 text-slate-900 outline-none focus:ring-2 focus:ring-rose-400')}
                        rows={2}
                        required
                      />
                      <FieldError message={inspectionErrors.discrepancyNote} />
                    </div>
                  )}
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  {(canSignAsB || canOperate) && (
                    <button
                      onClick={() => {
                        handleInspectionSubmit();
                      }}
                      className={`px-4 py-2 rounded-lg text-white font-bold text-xs shadow-sm transition-colors ${
                        isDiscrepancy && discrepancySeverity === 'MAJOR'
                          ? 'bg-rose-600 hover:bg-rose-500'
                          : 'bg-emerald-600 hover:bg-emerald-500'
                      }`}
                    >
                      {isDiscrepancy && discrepancySeverity === 'MAJOR'
                        ? 'Báo cáo Hư Nặng & Kích Hoạt Case'
                        : 'Xác Nhận Đạt Chuẩn & Chuyển Bước 6'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* BƯỚC 6: HANDOVER_PENDING */}
          {activeTxn.status === 'HANDOVER_PENDING' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-violet-50 text-violet-700 border border-violet-200 flex items-center justify-center font-bold text-sm">
                    6
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 uppercase">
                      BƯỚC 6: KÝ BIÊN BẢN BÀN GIAO ĐỒNG THỜI (DUAL CONFIRMATION)
                    </h4>
                    <p className="text-xs text-slate-500">Hai bên xác nhận cùng một mã băm biên bản (Handover Hash) để hoàn tất giao nhận</p>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-3 text-slate-700">
                <p>
                  Biên bản kiểm tra 6 mặt đã hoàn tất đạt chuẩn. Bên A (Kho giao) và Bên B (Tài xế/Kho nhận) xác nhận độc lập để hệ thống chốt giao dịch và chuyển giao quyền quản lý cont (Custody).
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
                    <div>
                      <div className="text-xs sm:text-sm font-bold text-emerald-700">BÊN A - ĐÃ GIAO</div>
                      <div className="text-xs text-slate-500 mt-1">
                        {activeTxn.handoverRecord?.confirmationA
                          ? `Đã xác nhận: ${formatDateTime(activeTxn.handoverRecord.confirmationA.confirmedAt)}`
                          : 'Chưa xác nhận'}
                      </div>
                    </div>
                    {!activeTxn.handoverRecord?.confirmationA && canSignAsA && (
                      <button
                        onClick={() => {
                          const res = confirmHandoverA(activeTxn.id);
                          if (!res.success) alert(res.message);
                        }}
                        className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm transition-colors"
                      >
                        Bên A xác nhận Giao
                      </button>
                    )}
                    {activeTxn.handoverRecord?.confirmationA && (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    )}
                  </div>

                  <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
                    <div>
                      <div className="text-xs sm:text-sm font-bold text-blue-700">BÊN B - ĐÃ NHẬN</div>
                      <div className="text-xs text-slate-500 mt-1">
                        {activeTxn.handoverRecord?.confirmationB
                          ? `Đã xác nhận: ${formatDateTime(activeTxn.handoverRecord.confirmationB.confirmedAt)}`
                          : 'Chưa xác nhận'}
                      </div>
                    </div>
                    {!activeTxn.handoverRecord?.confirmationB && canSignAsB && (
                      <button
                        onClick={() => {
                          const res = confirmHandoverB(activeTxn.id);
                          if (!res.success) alert(res.message);
                        }}
                        className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-sm transition-colors"
                      >
                        Bên B xác nhận Nhận
                      </button>
                    )}
                    {activeTxn.handoverRecord?.confirmationB && (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* BƯỚC 7: COMPLETED */}
          {activeTxn.status === 'COMPLETED' && (
            <div className="bg-white border border-emerald-200 rounded-2xl p-8 shadow-sm space-y-4 text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 uppercase">
                GIAO DỊCH ĐÃ HOÀN TẤT THÀNH CÔNG (COMPLETED)
              </h3>
              <p className="text-xs text-slate-600 max-w-lg mx-auto">
                Quyền quản lý (Custody) của container <strong className="font-mono text-brand-700">{activeTxn.asset.containerNumber}</strong> đã được chuyển giao thành công cho <strong className="text-slate-900">{activeTxn.companyBName}</strong>.
              </p>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs max-w-md mx-auto text-slate-600">
                Mã xác thực bàn giao SHA-256: <span className="font-mono text-emerald-700 font-semibold">{activeTxn.handoverRecord?.contentHash || 'SHA256:ECONT-984210'}</span>
              </div>
            </div>
          )}

          {/* Bảng bóc tách chi phí & tiết kiệm */}
          {activeTxn.quote && (
            <PricingBreakdownCard quote={activeTxn.quote} context="transaction_detail" showDetails={true} />
          )}
        </div>

        {/* Right 1 col: Quick Info & Dispute Controls */}
        <div className="space-y-6">
          {/* Thông tin Container & Đối tác */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm text-xs space-y-3">
            <h4 className="font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2.5 flex items-center gap-1.5">
              <Building className="w-4 h-4 text-brand-600" />
              <span>THÔNG TIN ĐỐI TÁC GIAO DỊCH</span>
            </h4>

            <div>
              <span className="text-slate-500 font-medium block text-xs">BÊN A (Chủ nguồn vỏ):</span>
              <strong className="text-slate-900 text-sm">{activeTxn.companyAName}</strong>
            </div>

            <div>
              <span className="text-slate-500 font-medium block text-xs">BÊN B (Chủ hàng xuất khẩu):</span>
              <strong className="text-slate-900 text-sm">{activeTxn.companyBName}</strong>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <span className="text-slate-500 font-medium block text-xs">Container:</span>
              <div className="font-mono font-bold text-slate-900 text-base">
                {activeTxn.asset.containerNumber} ({activeTxn.asset.containerType})
              </div>
              <div className="text-slate-500 text-xs mt-1">
                Hãng tàu: <strong className="text-slate-700">{activeTxn.asset.carrierCode}</strong> · Vị trí: {activeTxn.asset.currentLocationName}
              </div>
            </div>
          </div>

          {/* Công cụ can thiệp Ops (Hold / Dispute) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm text-xs space-y-3">
            <h4 className="font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2.5 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span>KIỂM SOÁT SỰ CỐ & TẠM DỪNG (HOLD)</span>
            </h4>
            <p className="text-xs text-slate-600">
              Khi phát hiện sai lệch hiện trạng, tiền đến muộn hoặc từ chối carrier, Ops có thể kích hoạt Tạm dừng (ON_HOLD).
            </p>

            {canOperate && (
              activeTxn.isOnHold ? (
                <button
                  onClick={() => toggleHold(activeTxn.id, false)}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-colors shadow-sm"
                >
                  Gỡ bỏ Tạm dừng (Release Hold)
                </button>
              ) : (
                <button
                  onClick={() => setShowHoldModal(true)}
                  className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold transition-colors shadow-sm"
                >
                  Kích hoạt Tạm dừng (ON_HOLD)
                </button>
              )
            )}

            {setCurrentTab && (
              <button
                onClick={() => setCurrentTab('cases')}
                className="w-full py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold transition-colors"
              >
                Mở Case Khiếu nại / Sự cố
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Hủy giao dịch {activeTxn.id}</h3>
              <button onClick={() => setShowCancelModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-600">
              Việc hủy giao dịch sẽ giải phóng Offer và Request để tham gia ghép đôi mới.
            </p>
            <FormErrorSummary errors={cancelErrors} />
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Lý do hủy <RequiredMark /></label>
              <textarea
                id="cancelReason"
                data-field="cancelReason"
                value={cancelReason}
                onChange={e => { setCancelErrors({}); setCancelReason(e.target.value); }}
                placeholder="Nhập lý do hủy giao dịch..."
                aria-invalid={Boolean(cancelErrors.cancelReason)}
                className={getFieldErrorClass(Boolean(cancelErrors.cancelReason), 'w-full p-3 rounded-xl border border-slate-200 text-xs outline-none focus:ring-2 focus:ring-brand-500')}
                rows={3}
              />
              <FieldError message={cancelErrors.cancelReason} />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowCancelModal(false)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Đóng
              </button>
              <button
                onClick={handleCancelTransaction}
                className="px-4 py-2 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-500 text-white"
              >
                Xác nhận Hủy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hold Modal */}
      {showHoldModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Tạm dừng giao dịch</h3>
              <button onClick={() => setShowHoldModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-600">
              Trạng thái ON_HOLD chặn toàn bộ các bước chuyển trạng thái cho đến khi được Ops gỡ bỏ.
            </p>
            <FormErrorSummary errors={holdErrors} />
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Lý do tạm dừng <RequiredMark /></label>
              <textarea
                id="holdReason"
                data-field="holdReason"
                value={holdReason}
                onChange={e => { setHoldErrors({}); setHoldReason(e.target.value); }}
                placeholder="Nhập lý do tạm dừng..."
                aria-invalid={Boolean(holdErrors.holdReason)}
                className={getFieldErrorClass(Boolean(holdErrors.holdReason), 'w-full p-3 rounded-xl border border-slate-200 text-xs outline-none focus:ring-2 focus:ring-brand-500')}
                rows={3}
              />
              <FieldError message={holdErrors.holdReason} />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowHoldModal(false)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Đóng
              </button>
              <button
                onClick={handleHoldTransaction}
                className="px-4 py-2 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white"
              >
                Xác nhận Tạm dừng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
