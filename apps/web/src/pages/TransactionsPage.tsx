// ==============================================================================
// ECont TransactionsPage - Version 2.0
// Vòng đời giao dịch 7 bước hoàn chỉnh theo SRS v1.0 & plan.md §6
// ==============================================================================

import React, { useEffect, useState } from "react";
import { useDatabase } from "../context/DatabaseContext";
import { useAuth } from "../context/AuthContext";
import { TransactionStepper } from "../components/TransactionStepper";
import { PricingBreakdownCard } from "../components/PricingBreakdownCard";
import {
  TransactionStatusBadge,
  ConditionBadge,
} from "../components/StatusBadge";
import { formatVnd, formatDateTime, formatRelativeTime } from "../lib/utils";
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
  X,
  Loader2,
} from "lucide-react";
import {
  FieldErrors,
  FieldError,
  FormErrorSummary,
  RequiredMark,
  getFieldErrorClass,
  scrollToFirstFieldError,
} from "../components/FormValidation";
import { required, validFutureDate, setError } from "../lib/formValidation";
import { Transaction } from "../types";
import { DateTimeInput } from "../components/DateInput";

const TRANSACTION_STEP_BY_STATUS: Partial<
  Record<Transaction["status"], number>
> = {
  NEGOTIATING: 1,
  PENDING_CARRIER: 2,
  AWAITING_PAYMENT: 3,
  READY_FOR_PICKUP: 4,
  INSPECTION: 5,
  HANDOVER_PENDING: 6,
  COMPLETED: 7,
};

const ReadOnlyStepPanel: React.FC<{
  transaction: Transaction;
  step: number;
  onClose: () => void;
}> = ({ transaction, step, onClose }) => {
  const agreement =
    transaction.agreements.find(
      (item) => item.version === transaction.currentAgreementVersion,
    ) || transaction.agreements[0];
  const items: Array<[string, string]> =
    step === 1
      ? [
          [
            "Phiên bản thỏa thuận",
            `v${agreement?.version || transaction.currentAgreementVersion}`,
          ],
          ["Mã băm", agreement?.contentHash || "Chưa có"],
          [
            "Nhà cung cấp Container",
            agreement?.companyAAcceptedAt
              ? `Đã ký lúc ${formatDateTime(agreement.companyAAcceptedAt)}`
              : "Chưa ký",
          ],
          [
            "Cần vỏ Container",
            agreement?.companyBAcceptedAt
              ? `Đã ký lúc ${formatDateTime(agreement.companyBAcceptedAt)}`
              : "Chưa ký",
          ],
        ]
      : step === 2
        ? [
            [
              "Trạng thái RU",
              transaction.carrierApproval?.status || "Chưa có kết quả",
            ],
            [
              "Mã tham chiếu RU",
              transaction.carrierApproval?.approvalReference || "Chưa có",
            ],
            [
              "Hãng tàu",
              transaction.carrierApproval?.carrierCode ||
                transaction.asset.carrierCode,
            ],
            [
              "Hiệu lực đến",
              transaction.carrierApproval?.scope?.validUntil
                ? formatDateTime(transaction.carrierApproval.scope.validUntil)
                : "Chưa có",
            ],
          ]
        : step === 3
          ? [
              [
                "Thanh toán nhà cung cấp",
                transaction.paymentOrderA
                  ? `${transaction.paymentOrderA.status} · ${formatVnd(transaction.paymentOrderA.amountVnd)}`
                  : "Chưa tạo",
              ],
              [
                "Thanh toán bên cần vỏ",
                transaction.paymentOrderB
                  ? `${transaction.paymentOrderB.status} · ${formatVnd(transaction.paymentOrderB.amountVnd)}`
                  : "Chưa tạo",
              ],
              [
                "Ops xác nhận",
                transaction.paymentConfirmedAt
                  ? formatDateTime(transaction.paymentConfirmedAt)
                  : "Chưa xác nhận",
              ],
            ]
          : step === 4
            ? [
                [
                  "Số phiếu điều phối",
                  transaction.dispatchPermit?.permitNumber || "Chưa phát hành",
                ],
                [
                  "Tài xế",
                  transaction.dispatchPermit?.driverName || "Chưa khai báo",
                ],
                [
                  "Biển số xe",
                  transaction.dispatchPermit?.truckPlate || "Chưa khai báo",
                ],
                [
                  "Hiệu lực đến",
                  transaction.dispatchPermit?.validUntil
                    ? formatDateTime(transaction.dispatchPermit.validUntil)
                    : "Chưa có",
                ],
              ]
            : step === 5
              ? [
                  [
                    "Người kiểm tra",
                    transaction.inspection?.inspectorName || "Chưa có",
                  ],
                  [
                    "Checklist 6 mặt",
                    transaction.inspection ? "Đã gửi biên bản" : "Chưa gửi",
                  ],
                  [
                    "Kết quả",
                    transaction.inspection?.isDiscrepancyFound
                      ? "Có sai lệch — đã lập Case"
                      : "Đạt chuẩn",
                  ],
                  [
                    "Thời điểm",
                    transaction.inspection?.inspectedAt
                      ? formatDateTime(transaction.inspection.inspectedAt)
                      : "Chưa có",
                  ],
                ]
              : [
                  [
                    "Nhà cung cấp xác nhận giao",
                    transaction.handoverRecord?.confirmationA
                      ? formatDateTime(
                          transaction.handoverRecord.confirmationA.confirmedAt,
                        )
                      : "Chưa xác nhận",
                  ],
                  [
                    "Bên cần vỏ xác nhận nhận",
                    transaction.handoverRecord?.confirmationB
                      ? formatDateTime(
                          transaction.handoverRecord.confirmationB.confirmedAt,
                        )
                      : "Chưa xác nhận",
                  ],
                  [
                    "Mã băm biên bản",
                    transaction.handoverRecord?.contentHash || "Chưa có",
                  ],
                ];

  return (
    <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50/60 p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-blue-700">
            Xem lại Bước {step} · Chỉ xem
          </p>
          <p className="mt-1 text-xs text-slate-600">
            Thông tin đã submit được giữ nguyên; không thể chỉnh sửa hoặc thực
            hiện lại hành động ở bước này.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
        >
          Quay lại bước hiện tại
        </button>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {items.map(([label, value]) => (
          <div
            key={label}
            className="rounded-lg border border-blue-100 bg-white px-3 py-2"
          >
            <p className="text-[11px] font-semibold text-slate-500">{label}</p>
            <p className="mt-0.5 text-xs font-semibold text-slate-800">
              {value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

const PaymentQrCard: React.FC<{
  transactionId: string;
  partyLabel: string;
  amount: number;
}> = ({ transactionId, partyLabel, amount }) => {
  const [hasQrError, setHasQrError] = useState(false);
  const staticQrUrl = "/payment/qr.jpg";

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3">
      <div className="flex flex-wrap items-center gap-3">
        {hasQrError ? (
          <div className="flex h-[112px] w-[112px] shrink-0 flex-col items-center justify-center rounded-lg border border-dashed border-blue-300 bg-white text-center text-[10px] text-blue-700">
            <QrCode className="mb-1 h-8 w-8" />
            Mã QR thanh toán
          </div>
        ) : (
          <img
            src={staticQrUrl}
            alt={`Mã QR thanh toán ${partyLabel}`}
            onError={() => setHasQrError(true)}
            className="h-28 w-28 shrink-0 rounded-lg border border-white bg-white p-1 shadow-sm"
          />
        )}
        <div className="min-w-[180px] flex-1 text-xs text-blue-900">
          <p className="font-bold">
            Quét mã QR trước khi xác nhận chuyển khoản
          </p>
          <p className="mt-1">
            Số tiền: <strong>{formatVnd(amount)}</strong>
          </p>
          <p className="mt-0.5">
            Nội dung:{" "}
            <span className="font-mono font-semibold">
              {transactionId} · {partyLabel}
            </span>
          </p>
          <p className="mt-1 text-[11px] text-blue-700">
            Sau khi chuyển khoản thành công, nhập mã tham chiếu rồi bấm nút xác
            nhận bên dưới.
          </p>
        </div>
      </div>
    </div>
  );
};

interface TransactionsPageProps {
  selectedTxnId?: string;
  setSelectedTxnId: (id: string) => void;
  setCurrentTab?: (tab: string) => void;
}

export const TransactionsPage: React.FC<TransactionsPageProps> = ({
  selectedTxnId,
  setSelectedTxnId,
  setCurrentTab,
}) => {
  const {
    transactions,
    acceptAgreement,
    requestAgreementChange,
    opsApproveCarrier,
    opsRejectCarrier,
    submitPayment,
    settlePayment,
    opsConfirmPayments,
    generateDispatchPermit,
    activateInspection,
    submitInspection,
    confirmHandoverA,
    confirmHandoverB,
    toggleHold,
    cancelTransaction,
    startChatThread,
  } = useDatabase();
  const { currentRole, currentCompany } = useAuth();

  // Active transaction
  const activeTxn =
    transactions.find((t) => t.id === selectedTxnId) || transactions[0];
  const [reviewStep, setReviewStep] = useState<number | null>(null);
  const currentStepNumber = activeTxn
    ? TRANSACTION_STEP_BY_STATUS[activeTxn.status] || 0
    : 0;

  useEffect(() => {
    setReviewStep(null);
  }, [activeTxn?.id]);

  // Permissions
  const canSignAsA =
    (currentRole === "ENTERPRISE_A" || currentRole === "ENTERPRISE_BOTH") &&
    currentCompany.id === activeTxn?.companyAId;
  const canSignAsB =
    (currentRole === "ENTERPRISE_B" || currentRole === "ENTERPRISE_BOTH") &&
    currentCompany.id === activeTxn?.companyBId;
  const canOperate = currentRole === "OPS";
  const canReconcile = currentRole === "OPS";
  const canPayAsA =
    (currentRole === "ENTERPRISE_A" || currentRole === "ENTERPRISE_BOTH") &&
    currentCompany.id === activeTxn?.companyAId;
  const canPayAsB =
    (currentRole === "ENTERPRISE_B" || currentRole === "ENTERPRISE_BOTH") &&
    currentCompany.id === activeTxn?.companyBId;

  // Step 2: Carrier approval state
  const [carrierRef, setCarrierRef] = useState("RU-2026-9812-MSK");
  const [evidenceName, setEvidenceName] = useState(
    "CV_Chap_Thuan_Cap_Lai_Vo_MSK.pdf",
  );
  const [carrierExpiry, setCarrierExpiry] = useState(
    new Date(Date.now() + 48 * 3600000).toISOString().slice(0, 16),
  );

  // Step 4: Dispatch permit edit
  const [driverName, setDriverName] = useState("Nguyễn Văn Tài");
  const [truckPlate, setTruckPlate] = useState("51D-894.22");
  const [paymentRefA, setPaymentRefA] = useState("");
  const [paymentRefB, setPaymentRefB] = useState("");

  // Step 5: Checklist 6 faces
  const [chkFloor, setChkFloor] = useState(true);
  const [chkWalls, setChkWalls] = useState(true);
  const [chkRoof, setChkRoof] = useState(true);
  const [chkDoors, setChkDoors] = useState(true);
  const [chkGaskets, setChkGaskets] = useState(true);
  const [chkUndercarriage, setChkUndercarriage] = useState(true);
  const [isDiscrepancy, setIsDiscrepancy] = useState(false);
  const [discrepancyNote, setDiscrepancyNote] = useState("");
  const [discrepancySeverity, setDiscrepancySeverity] = useState<
    "MINOR" | "MAJOR"
  >("MINOR");
  const [inspectionPhotos, setInspectionPhotos] = useState<string[]>([
    "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800",
    "https://images.unsplash.com/photo-1578575437130-527eed3abbec?w=800",
  ]);

  const handleUploadInspectionPhoto = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        setInspectionPhotos((p) => [...p, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  // Hold / Cancel Modals
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [showHoldModal, setShowHoldModal] = useState(false);
  const [holdReason, setHoldReason] = useState("");
  const [carrierErrors, setCarrierErrors] = useState<FieldErrors>({});
  const [inspectionErrors, setInspectionErrors] = useState<FieldErrors>({});
  const [cancelErrors, setCancelErrors] = useState<FieldErrors>({});
  const [holdErrors, setHoldErrors] = useState<FieldErrors>({});

  const handleCarrierApproval = () => {
    if (!activeTxn) return;
    const errors: FieldErrors = {};
    setError(
      errors,
      "carrierRef",
      required(carrierRef, "Vui lòng nhập số văn bản RU của hãng tàu."),
    );
    setError(
      errors,
      "evidenceName",
      required(evidenceName, "Vui lòng nhập tên file bằng chứng RU."),
    );
    setError(
      errors,
      "carrierExpiry",
      validFutureDate(carrierExpiry, "hạn hiệu lực RU"),
    );
    setCarrierErrors(errors);
    if (Object.keys(errors).length > 0) {
      scrollToFirstFieldError(errors);
      return;
    }
    const result = opsApproveCarrier(
      activeTxn.id,
      carrierRef.trim(),
      evidenceName.trim(),
      new Date(carrierExpiry).toISOString(),
    );
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
    if (
      ![
        chkFloor,
        chkWalls,
        chkRoof,
        chkDoors,
        chkGaskets,
        chkUndercarriage,
      ].every(Boolean)
    ) {
      errors.inspectionChecklist =
        "Vui lòng xác nhận đủ 6 hạng mục kiểm tra IICL.";
    }
    if (isDiscrepancy && !discrepancyNote.trim()) {
      errors.discrepancyNote =
        "Vui lòng mô tả chi tiết sai lệch/hư hỏng thực tế.";
    }
    setInspectionErrors(errors);
    if (Object.keys(errors).length > 0) {
      scrollToFirstFieldError(errors);
      return;
    }
    const result = submitInspection(activeTxn.id, {
      inspectorName: "Nguyễn Văn Tài (Tài xế/Đại diện đơn vị cần vỏ)",
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
    setError(
      errors,
      "cancelReason",
      required(cancelReason, "Vui lòng nhập lý do hủy giao dịch."),
    );
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
    setCancelReason("");
    setCancelErrors({});
  };

  const handleHoldTransaction = () => {
    if (!activeTxn) return;
    const errors: FieldErrors = {};
    setError(
      errors,
      "holdReason",
      required(holdReason, "Vui lòng nhập lý do tạm dừng giao dịch."),
    );
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
    setHoldReason("");
    setHoldErrors({});
  };

  if (!activeTxn) {
    return (
      <div className="py-16 text-center space-y-3 bg-white border border-slate-200 rounded-2xl p-8">
        <FileText className="w-12 h-12 text-slate-300 mx-auto" />
        <h3 className="text-lg font-bold text-slate-700">
          Chưa có giao dịch nào
        </h3>
        <p className="text-xs text-slate-500">
          Hãy vào mục Nhu cầu để ghép đôi và giữ chỗ container.
        </p>
      </div>
    );
  }

  // Agreement version
  const currentAgreement =
    activeTxn.agreements.find(
      (a) => a.version === activeTxn.currentAgreementVersion,
    ) || activeTxn.agreements[0];
  const paymentA = activeTxn.paymentOrderA;
  const paymentB = activeTxn.paymentOrderB;
  const bothPaymentsReconciled =
    paymentA?.status === "PAID" && paymentB?.status === "PAID";
  const displayCompanyAName =
    currentRole === "OPS" ? activeTxn.companyAName : "Nhà cung cấp Container";
  const displayCompanyBName =
    currentRole === "OPS" ? activeTxn.companyBName : "Cần vỏ Container";

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
      contextType: "TRANSACTION",
      containerNumber: activeTxn.asset.containerNumber,
      carrierCode: activeTxn.asset.carrierCode,
      containerType: activeTxn.asset.containerType,
      pickupLocationName: activeTxn.asset.currentLocationName,
    });
    if (setCurrentTab) {
      setCurrentTab("chat");
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Selector */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <FileText className="w-6 h-6 text-blue-600" />
              <span>Giao dịch {activeTxn.id}</span>
            </h2>
            <TransactionStatusBadge status={activeTxn.status} size="sm" />
            {activeTxn.isOnHold && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                <Lock className="w-3.5 h-3.5" /> TẠM DỪNG (HOLD)
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Container:{" "}
            <strong className="font-mono text-slate-800">
              {activeTxn.asset.containerNumber}
            </strong>{" "}
            ({activeTxn.asset.containerType} · {activeTxn.asset.carrierCode}) ·
            Tuyến:{" "}
            <strong className="text-slate-700">{displayCompanyAName}</strong> →{" "}
            <strong className="text-slate-700">{displayCompanyBName}</strong>
          </p>
        </div>

        <div className="flex items-center gap-3">
          {transactions.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-semibold">
                Chọn GD:
              </span>
              <select
                value={activeTxn.id}
                onChange={(e) => setSelectedTxnId(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 font-mono outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                {transactions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.id} - {t.asset.containerNumber} ({t.status})
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={handleOpenChat}
            className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all shadow-xs"
          >
            <MessageCircle className="w-4 h-4 text-blue-600" />
            <span>Chat với đối tác</span>
          </button>
        </div>
      </div>

      {/* 2. Stepper Component */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <TransactionStepper
          transaction={activeTxn}
          selectedStep={reviewStep}
          onStepClick={(step) => setReviewStep(step)}
        />
      </div>

      {reviewStep !== null && reviewStep < currentStepNumber && (
        <ReadOnlyStepPanel
          transaction={activeTxn}
          step={reviewStep}
          onClose={() => setReviewStep(null)}
        />
      )}

      {/* 3. Action Panel based on Current Step */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Flow Control (Left 2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* BƯỚC 1: NEGOTIATING */}
          {activeTxn.status === "NEGOTIATING" && (
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
                    <p className="text-xs text-slate-500">
                      Phiên bản Thỏa thuận: v{activeTxn.currentAgreementVersion}{" "}
                      · Mã băm:{" "}
                      <span className="font-mono text-slate-600">
                        {currentAgreement.contentHash}
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Tóm tắt điều khoản thỏa thuận */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm space-y-2 text-slate-700">
                <div className="font-semibold text-slate-900 mb-1">
                  Nội dung Thỏa thuận Tái sử dụng Container (ECont Agreement v
                  {activeTxn.currentAgreementVersion}):
                </div>
                <p>
                  1.{" "}
                  <strong>
                    Nhà cung cấp Container ({displayCompanyAName})
                  </strong>{" "}
                  cam kết container {activeTxn.asset.containerNumber} đạt chuẩn
                  đóng hàng xuất khẩu, còn hạn detention tối thiểu đến ngày quy
                  định.
                </p>
                <p>
                  2.{" "}
                  <strong>
                    Đơn vị Cần vỏ Container ({displayCompanyBName})
                  </strong>{" "}
                  chịu trách nhiệm điều xe kéo cont từ điểm giao đến điểm nhận
                  và nhận bàn giao đúng hạn cut-off.
                </p>
                <p>
                  3. Phí tái sử dụng của Hãng tàu được chia sẻ tỷ lệ α ={" "}
                  {activeTxn.quote.shareAlpha}. Phí dịch vụ ECont chỉ thu trên
                  mức tiết kiệm thực tế.
                </p>
                <p className="text-xs text-slate-500 pt-1">
                  * Khi cả hai bên ký chấp nhận cùng phiên bản v
                  {activeTxn.currentAgreementVersion}, giao dịch sẽ tự động
                  chuyển sang Bước 2 (Chờ Hãng tàu RU).
                </p>
              </div>

              {/* Trạng thái ký của hai đối tác */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <div>
                    <div className="text-xs sm:text-sm font-bold text-emerald-700">
                      NHÀ CUNG CẤP CONTAINER
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {currentAgreement.companyAAcceptedAt
                        ? `Đã ký: ${formatDateTime(currentAgreement.companyAAcceptedAt)}`
                        : "Chưa ký xác nhận"}
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
                      Nhà cung cấp Ký Thỏa Thuận
                    </button>
                  ) : (
                    <span className="text-xs text-slate-500 font-medium">
                      Chờ đại diện nhà cung cấp ký
                    </span>
                  )}
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <div>
                    <div className="text-xs sm:text-sm font-bold text-blue-700">
                      CẦN VỎ CONTAINER
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {currentAgreement.companyBAcceptedAt
                        ? `Đã ký: ${formatDateTime(currentAgreement.companyBAcceptedAt)}`
                        : "Chưa ký xác nhận"}
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
                      Đơn vị Cần vỏ Ký Thỏa Thuận
                    </button>
                  ) : (
                    <span className="text-xs text-slate-500 font-medium">
                      Chờ đại diện đơn vị cần vỏ ký
                    </span>
                  )}
                </div>
              </div>

              {/* Action buttons: Sửa điều khoản / Hủy */}
              {(canSignAsA || canSignAsB) && (
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <button
                    onClick={() => {
                      const reason = prompt(
                        "Nhập lý do yêu cầu thay đổi điều khoản:",
                      );
                      if (reason) requestAgreementChange(activeTxn.id, reason);
                    }}
                    className="text-xs text-brand-600 hover:text-brand-700 font-semibold"
                  >
                    Yêu cầu điều chỉnh Thỏa thuận (Tạo v
                    {activeTxn.currentAgreementVersion + 1})
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
          {activeTxn.status === "PENDING_CARRIER" && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center font-bold text-sm">
                    2
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 uppercase">
                      BƯỚC 2: TIẾP NHẬN PHÊ DUYỆT CẤP LẠI VỎ (RU APPROVAL) TỪ
                      HÃNG TÀU
                    </h4>
                    <p className="text-xs text-slate-500">
                      Bộ phận Ops ghi nhận bằng chứng văn bản phê duyệt của Hãng{" "}
                      {activeTxn.asset.carrierCode}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4 text-xs text-slate-700">
                <FormErrorSummary errors={carrierErrors} />
                <p>
                  Hãng tàu ({activeTxn.asset.carrierCode}) cấp văn bản chấp
                  thuận cho phép container {activeTxn.asset.containerNumber}{" "}
                  được tái sử dụng cho Booking của đơn vị Cần vỏ Container. Bộ
                  phận Điều phối (Ops) xác thực số công văn và đính kèm bằng
                  chứng PDF để chuyển giao dịch sang bước Thanh toán.
                </p>

                {!canOperate ? (
                  <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/70 flex items-start sm:items-center gap-3">
                    <Loader2 className="w-5 h-5 text-blue-600 animate-spin shrink-0 mt-0.5 sm:mt-0" />
                    <div>
                      <p className="text-xs sm:text-sm font-semibold text-blue-900 leading-snug">
                        Ops đang làm việc với hãng tàu{" "}
                        {activeTxn.asset.carrierCode || "MSK"} để xin duyệt RU.
                        Vui lòng chờ thông báo mới.
                      </p>
                      <p className="text-xs text-blue-700/80 mt-1">
                        Khi hãng tàu phản hồi chấp thuận, hệ thống sẽ tự động
                        cập nhật tiến trình và chuyển sang bước tiếp theo.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-slate-700 font-semibold block mb-1">
                          Số văn bản RU của Hãng tàu <RequiredMark />
                        </label>
                        <input
                          id="carrierRef"
                          data-field="carrierRef"
                          type="text"
                          value={carrierRef}
                          onChange={(e) => {
                            setCarrierErrors({});
                            setCarrierRef(e.target.value);
                          }}
                          aria-invalid={Boolean(carrierErrors.carrierRef)}
                          className={getFieldErrorClass(
                            Boolean(carrierErrors.carrierRef),
                            "w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm font-mono outline-none uppercase focus:ring-2 focus:ring-brand-500",
                          )}
                          required
                        />
                        <FieldError message={carrierErrors.carrierRef} />
                      </div>
                      <div>
                        <label className="text-slate-700 font-semibold block mb-1">
                          Tên file công văn đính kèm <RequiredMark />
                        </label>
                        <input
                          id="evidenceName"
                          data-field="evidenceName"
                          type="text"
                          value={evidenceName}
                          onChange={(e) => {
                            setCarrierErrors({});
                            setEvidenceName(e.target.value);
                          }}
                          aria-invalid={Boolean(carrierErrors.evidenceName)}
                          className={getFieldErrorClass(
                            Boolean(carrierErrors.evidenceName),
                            "w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm outline-none focus:ring-2 focus:ring-brand-500",
                          )}
                          required
                        />
                        <FieldError message={carrierErrors.evidenceName} />
                      </div>
                      <div>
                        <label className="text-slate-700 font-semibold block mb-1">
                          Hiệu lực đến <RequiredMark />
                        </label>
                        <DateTimeInput
                          id="carrierExpiry"
                          data-field="carrierExpiry"
                          value={carrierExpiry}
                          onChange={(v) => {
                            setCarrierErrors({});
                            setCarrierExpiry(v);
                          }}
                          aria-invalid={Boolean(carrierErrors.carrierExpiry)}
                          className={getFieldErrorClass(
                            Boolean(carrierErrors.carrierExpiry),
                            "w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm outline-none focus:ring-2 focus:ring-brand-500",
                          )}
                          required
                        />
                        <FieldError message={carrierErrors.carrierExpiry} />
                      </div>
                    </div>

                    <div className="pt-2 flex flex-wrap justify-between items-center gap-3">
                      <span className="text-xs text-slate-500">
                        Quyền thao tác:{" "}
                        <strong className="text-slate-700">
                          Điều phối viên (Ops)
                        </strong>
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            const reason = prompt(
                              "Nhập lý do hãng tàu từ chối:",
                            );
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
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* BƯỚC 3: AWAITING_PAYMENT */}
          {activeTxn.status === "AWAITING_PAYMENT" && (
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
                    <p className="text-xs text-slate-500">
                      Ops đối soát tiền thu hộ RU và phí dịch vụ nền tảng
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Lệnh thu của nhà cung cấp */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-700 uppercase text-xs">
                      NGHĨA VỤ NHÀ CUNG CẤP
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                        activeTxn.paymentOrderA?.status === "PAID"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-amber-50 text-amber-700 border-amber-200"
                      }`}
                    >
                      {activeTxn.paymentOrderA?.status === "PAID"
                        ? "ĐÃ ĐỐI SOÁT"
                        : activeTxn.paymentOrderA?.payerSubmittedAt
                          ? "ĐÃ NỘP · CHỜ ĐỐI SOÁT"
                          : "CHỜ THU"}
                    </span>
                  </div>
                  <div className="text-xl font-bold font-mono text-slate-900">
                    {formatVnd(activeTxn.quote.econtCollectedFromA)}
                  </div>
                  <div className="text-xs text-slate-500">
                    Bao gồm: Thu hộ RU (
                    {formatVnd(
                      activeTxn.quote.shareAlpha * activeTxn.quote.fRuVnd,
                    )}
                    ) + Phí ECont ({formatVnd(activeTxn.quote.fAVnd)})
                  </div>
                  {canReconcile &&
                    activeTxn.paymentOrderA?.status !== "PAID" && (
                      <button
                        onClick={() => {
                          settlePayment(
                            activeTxn.id,
                            "A",
                            "MB-TRAN-A9842",
                            activeTxn.quote.econtCollectedFromA,
                          );
                        }}
                        className="w-full mt-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm"
                      >
                        Xác nhận đã nhận tiền nhà cung cấp
                      </button>
                    )}
                  {canPayAsA && activeTxn.paymentOrderA?.status !== "PAID" && (
                    <PaymentQrCard
                      transactionId={activeTxn.id}
                      partyLabel="Nhà cung cấp Container"
                      amount={activeTxn.quote.econtCollectedFromA}
                    />
                  )}
                  {canPayAsA &&
                    activeTxn.paymentOrderA?.status !== "PAID" &&
                    !activeTxn.paymentOrderA?.payerSubmittedAt && (
                      <div className="mt-2 space-y-2">
                        <input
                          value={paymentRefA}
                          onChange={(e) => setPaymentRefA(e.target.value)}
                          placeholder="Mã tham chiếu chuyển khoản của nhà cung cấp"
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        <button
                          onClick={() => {
                            const result = submitPayment(
                              activeTxn.id,
                              "A",
                              paymentRefA.trim(),
                              activeTxn.quote.econtCollectedFromA,
                            );
                            if (!result.success) alert(result.message);
                          }}
                          className="w-full py-2.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs"
                        >
                          Nhà cung cấp xác nhận đã chuyển khoản
                        </button>
                      </div>
                    )}
                  {activeTxn.paymentOrderA?.payerSubmittedAt &&
                    activeTxn.paymentOrderA.status !== "PAID" && (
                      <p className="text-[11px] text-amber-700">
                        Nhà cung cấp đã gửi mã chuyển khoản · chờ Ops đối soát.
                      </p>
                    )}
                </div>

                {/* Lệnh thu của đơn vị cần vỏ */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-blue-700 uppercase text-xs">
                      NGHĨA VỤ ĐƠN VỊ CẦN VỎ
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                        activeTxn.paymentOrderB?.status === "PAID"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-amber-50 text-amber-700 border-amber-200"
                      }`}
                    >
                      {activeTxn.paymentOrderB?.status === "PAID"
                        ? "ĐÃ ĐỐI SOÁT"
                        : activeTxn.paymentOrderB?.payerSubmittedAt
                          ? "ĐÃ NỘP · CHỜ ĐỐI SOÁT"
                          : "CHỜ THU"}
                    </span>
                  </div>
                  <div className="text-xl font-bold font-mono text-slate-900">
                    {formatVnd(activeTxn.quote.econtCollectedFromB)}
                  </div>
                  <div className="text-xs text-slate-500">
                    Bao gồm: Thu hộ RU (
                    {formatVnd(
                      (1 - activeTxn.quote.shareAlpha) * activeTxn.quote.fRuVnd,
                    )}
                    ) + Phí ECont ({formatVnd(activeTxn.quote.fBVnd)})
                  </div>
                  {canReconcile &&
                    activeTxn.paymentOrderB?.status !== "PAID" && (
                      <button
                        onClick={() => {
                          settlePayment(
                            activeTxn.id,
                            "B",
                            "VCB-TRAN-B1290",
                            activeTxn.quote.econtCollectedFromB,
                          );
                        }}
                        className="w-full mt-2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-sm"
                      >
                        Xác nhận đã nhận tiền đơn vị cần vỏ
                      </button>
                    )}
                  {canPayAsB && activeTxn.paymentOrderB?.status !== "PAID" && (
                    <PaymentQrCard
                      transactionId={activeTxn.id}
                      partyLabel="Cần vỏ Container"
                      amount={activeTxn.quote.econtCollectedFromB}
                    />
                  )}
                  {canPayAsB &&
                    activeTxn.paymentOrderB?.status !== "PAID" &&
                    !activeTxn.paymentOrderB?.payerSubmittedAt && (
                      <div className="mt-2 space-y-2">
                        <input
                          value={paymentRefB}
                          onChange={(e) => setPaymentRefB(e.target.value)}
                          placeholder="Mã tham chiếu chuyển khoản của đơn vị cần vỏ"
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                          onClick={() => {
                            const result = submitPayment(
                              activeTxn.id,
                              "B",
                              paymentRefB.trim(),
                              activeTxn.quote.econtCollectedFromB,
                            );
                            if (!result.success) alert(result.message);
                          }}
                          className="w-full py-2.5 rounded-xl border border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-800 font-bold text-xs"
                        >
                          Đơn vị cần vỏ xác nhận đã chuyển khoản
                        </button>
                      </div>
                    )}
                  {activeTxn.paymentOrderB?.payerSubmittedAt &&
                    activeTxn.paymentOrderB.status !== "PAID" && (
                      <p className="text-[11px] text-amber-700">
                        Đơn vị cần vỏ đã gửi mã chuyển khoản · chờ Ops đối soát.
                      </p>
                    )}
                </div>
              </div>

              <div
                className={`p-4 rounded-xl border ${bothPaymentsReconciled ? "border-emerald-300 bg-emerald-50" : "border-amber-200 bg-amber-50"} space-y-2`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-slate-900">
                      BƯỚC KIỂM SOÁT: OPS XÁC NHẬN ĐỦ TIỀN CỦA HAI ĐỐI TÁC
                    </p>
                    <p className="text-xs text-slate-600 mt-1">
                      {bothPaymentsReconciled
                        ? "Ops đã đối soát đủ hai khoản. Chỉ Ops mới được phát Phiếu điều phối và chuyển sang READY_FOR_PICKUP."
                        : "Chưa thể tiếp tục: cần Ops đối soát PAID cả hai lệnh thanh toán."}
                    </p>
                  </div>
                  {canOperate &&
                    bothPaymentsReconciled &&
                    !activeTxn.paymentConfirmedAt && (
                      <button
                        onClick={() => {
                          const result = opsConfirmPayments(activeTxn.id);
                          if (!result.success) alert(result.message);
                        }}
                        className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm"
                      >
                        Ops xác nhận đủ tiền & phát phiếu
                      </button>
                    )}
                </div>
                {activeTxn.paymentConfirmedAt && (
                  <p className="text-xs text-emerald-800 font-semibold">
                    Đã được Ops xác nhận lúc{" "}
                    {formatDateTime(activeTxn.paymentConfirmedAt)}.
                  </p>
                )}
              </div>

              {!canReconcile && !canOperate && (
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-xs text-purple-700 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 shrink-0" />
                  <span>
                    Hai đối tác vui lòng chuyển khoản theo thông tin lệnh nộp.
                    Ops sẽ đối soát và xác nhận trước khi phát phiếu điều phối.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* BƯỚC 4: READY_FOR_PICKUP */}
          {activeTxn.status === "READY_FOR_PICKUP" && (
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
                    <p className="text-xs text-slate-500">
                      Mã phiếu hợp lệ · Tài xế dùng mã QR để check-in tại cổng
                      kho nhà cung cấp
                    </p>
                  </div>
                </div>
              </div>

              {/* Thông tin phiếu Dispatch Permit */}
              <div className="p-5 rounded-xl bg-slate-50 border border-emerald-300 flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1.5 text-xs sm:text-sm text-slate-700">
                  <div className="text-emerald-700 font-mono font-bold text-base flex items-center gap-2">
                    <span>
                      {activeTxn.dispatchPermit?.permitNumber ||
                        "ECONT-DP-2026-98421"}
                    </span>
                    <span className="text-xs bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full font-bold">
                      ACTIVE
                    </span>
                  </div>
                  <div>
                    Tài xế nhận cont:{" "}
                    <strong className="text-slate-900">
                      {activeTxn.dispatchPermit?.driverName || driverName}
                    </strong>{" "}
                    · Biển số xe:{" "}
                    <strong className="font-mono text-brand-700">
                      {activeTxn.dispatchPermit?.truckPlate || truckPlate}
                    </strong>
                  </div>
                  <div className="text-slate-500">
                    Địa điểm lấy: {activeTxn.asset.currentLocationName}
                  </div>
                  <div className="text-xs text-slate-500">
                    Token bảo mật:{" "}
                    <span className="font-mono text-slate-700 font-semibold">
                      {activeTxn.dispatchPermit?.verificationToken ||
                        "DP-SEC-8921"}
                    </span>{" "}
                    · Hiệu lực đến:{" "}
                    {formatDateTime(activeTxn.dispatchPermit?.validUntil)}
                  </div>
                </div>

                <div className="flex flex-col items-center p-3 rounded-xl bg-white border border-slate-200 text-slate-900 text-center shadow-sm">
                  <QrCode className="w-16 h-16 text-slate-800" />
                  <span className="text-xs font-mono font-bold mt-1 text-slate-600">
                    QUÉT QR CHECK-IN
                  </span>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                {(canSignAsB || canOperate) && (
                  <button
                    onClick={() => activateInspection(activeTxn.id)}
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-2 shadow-sm text-xs transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                    <span>
                      Tài xế đã tới kho nhà cung cấp & tiến hành kiểm tra
                      (Chuyển Bước 5)
                    </span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* BƯỚC 5: INSPECTION */}
          {activeTxn.status === "INSPECTION" && (
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
                    <p className="text-xs text-slate-500">
                      Tài xế/Đại diện đơn vị cần vỏ kiểm tra thực tế trước khi
                      bấm nhận cont
                    </p>
                  </div>
                </div>
              </div>

              {/* 6 hạng mục kiểm tra theo tiêu chuẩn IICL */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4 text-xs text-slate-700">
                <div className="font-semibold text-slate-900">
                  Checklist tình trạng vỏ container (IICL Standard){" "}
                  <RequiredMark />:
                </div>
                <FormErrorSummary errors={inspectionErrors} />
                <div
                  id="inspectionChecklist"
                  data-field="inspectionChecklist"
                  className={getFieldErrorClass(
                    Boolean(inspectionErrors.inspectionChecklist),
                    "grid grid-cols-2 sm:grid-cols-3 gap-3",
                  )}
                >
                  <label className="flex items-center gap-2 p-2.5 rounded-lg bg-white border border-slate-200 cursor-pointer shadow-sm">
                    <input
                      type="checkbox"
                      checked={chkFloor}
                      onChange={(e) => {
                        setChkFloor(e.target.checked);
                        setInspectionErrors((p) => ({
                          ...p,
                          inspectionChecklist: "",
                        }));
                      }}
                      className="rounded text-brand-600"
                    />
                    <span>1. Sàn gỗ khô, sạch</span>
                  </label>
                  <label className="flex items-center gap-2 p-2.5 rounded-lg bg-white border border-slate-200 cursor-pointer shadow-sm">
                    <input
                      type="checkbox"
                      checked={chkWalls}
                      onChange={(e) => {
                        setChkWalls(e.target.checked);
                        setInspectionErrors((p) => ({
                          ...p,
                          inspectionChecklist: "",
                        }));
                      }}
                      className="rounded text-brand-600"
                    />
                    <span>2. Vách không thủng</span>
                  </label>
                  <label className="flex items-center gap-2 p-2.5 rounded-lg bg-white border border-slate-200 cursor-pointer shadow-sm">
                    <input
                      type="checkbox"
                      checked={chkRoof}
                      onChange={(e) => {
                        setChkRoof(e.target.checked);
                        setInspectionErrors((p) => ({
                          ...p,
                          inspectionChecklist: "",
                        }));
                      }}
                      className="rounded text-brand-600"
                    />
                    <span>3. Nóc kín nước 100%</span>
                  </label>
                  <label className="flex items-center gap-2 p-2.5 rounded-lg bg-white border border-slate-200 cursor-pointer shadow-sm">
                    <input
                      type="checkbox"
                      checked={chkDoors}
                      onChange={(e) => {
                        setChkDoors(e.target.checked);
                        setInspectionErrors((p) => ({
                          ...p,
                          inspectionChecklist: "",
                        }));
                      }}
                      className="rounded text-brand-600"
                    />
                    <span>4. Cửa đóng mở nhẹ</span>
                  </label>
                  <label className="flex items-center gap-2 p-2.5 rounded-lg bg-white border border-slate-200 cursor-pointer shadow-sm">
                    <input
                      type="checkbox"
                      checked={chkGaskets}
                      onChange={(e) => {
                        setChkGaskets(e.target.checked);
                        setInspectionErrors((p) => ({
                          ...p,
                          inspectionChecklist: "",
                        }));
                      }}
                      className="rounded text-brand-600"
                    />
                    <span>5. Gioăng cao su kín</span>
                  </label>
                  <label className="flex items-center gap-2 p-2.5 rounded-lg bg-white border border-slate-200 cursor-pointer shadow-sm">
                    <input
                      type="checkbox"
                      checked={chkUndercarriage}
                      onChange={(e) => {
                        setChkUndercarriage(e.target.checked);
                        setInspectionErrors((p) => ({
                          ...p,
                          inspectionChecklist: "",
                        }));
                      }}
                      className="rounded text-brand-600"
                    />
                    <span>6. Đà đáy vững chắc</span>
                  </label>
                </div>
                <FieldError message={inspectionErrors.inspectionChecklist} />

                {/* Photo upload at inspection */}
                <div className="pt-2 border-t border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-800">
                      Ảnh chụp hiện trường giám định ({inspectionPhotos.length}{" "}
                      ảnh)
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
                      <div
                        key={idx}
                        className="h-16 rounded-lg overflow-hidden border border-slate-200 bg-slate-100"
                      >
                        <img
                          src={url}
                          alt={`Ảnh kiểm tra ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
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
                      onChange={(e) => setIsDiscrepancy(e.target.checked)}
                      className="rounded text-rose-600"
                    />
                    <span>
                      Phát hiện sai lệch/hư hỏng thực tế (Báo cáo sự cố)
                    </span>
                  </label>
                  {isDiscrepancy && (
                    <div className="mt-3 space-y-2 p-3 bg-rose-50 border border-rose-200 rounded-xl">
                      <div className="flex gap-4">
                        <label className="flex items-center gap-1.5 text-xs text-slate-700">
                          <input
                            type="radio"
                            name="sev"
                            checked={discrepancySeverity === "MINOR"}
                            onChange={() => setDiscrepancySeverity("MINOR")}
                          />
                          <span>Hư nhẹ (Tiếp tục được nếu thỏa thuận)</span>
                        </label>
                        <label className="flex items-center gap-1.5 text-xs text-rose-700 font-semibold">
                          <input
                            type="radio"
                            name="sev"
                            checked={discrepancySeverity === "MAJOR"}
                            onChange={() => setDiscrepancySeverity("MAJOR")}
                          />
                          <span>
                            Hư nặng (Không nhận cont - Kích hoạt ON_HOLD)
                          </span>
                        </label>
                      </div>
                      <label
                        htmlFor="inspection-discrepancyNote"
                        className="block text-xs font-semibold text-rose-700"
                      >
                        Mô tả sai lệch/hư hỏng <RequiredMark />
                      </label>
                      <textarea
                        id="inspection-discrepancyNote"
                        data-field="discrepancyNote"
                        value={discrepancyNote}
                        onChange={(e) => {
                          setInspectionErrors({});
                          setDiscrepancyNote(e.target.value);
                        }}
                        placeholder="Mô tả chi tiết sai lệch (vd: thủng nóc 10cm, rách đà đáy)..."
                        aria-invalid={Boolean(inspectionErrors.discrepancyNote)}
                        className={getFieldErrorClass(
                          Boolean(inspectionErrors.discrepancyNote),
                          "w-full px-3 py-2 rounded-lg bg-white border border-rose-300 text-slate-900 outline-none focus:ring-2 focus:ring-rose-400",
                        )}
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
                        isDiscrepancy && discrepancySeverity === "MAJOR"
                          ? "bg-rose-600 hover:bg-rose-500"
                          : "bg-emerald-600 hover:bg-emerald-500"
                      }`}
                    >
                      {isDiscrepancy && discrepancySeverity === "MAJOR"
                        ? "Báo cáo Hư Nặng & Kích Hoạt Case"
                        : "Xác Nhận Đạt Chuẩn & Chuyển Bước 6"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* BƯỚC 6: HANDOVER_PENDING */}
          {activeTxn.status === "HANDOVER_PENDING" && (
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
                    <p className="text-xs text-slate-500">
                      Hai bên xác nhận cùng một mã băm biên bản (Handover Hash)
                      để hoàn tất giao nhận
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-3 text-slate-700">
                <p>
                  Biên bản kiểm tra 6 mặt đã hoàn tất đạt chuẩn. Nhà cung cấp
                  (kho giao) và đơn vị cần vỏ (tài xế/kho nhận) xác nhận độc lập
                  để hệ thống chốt giao dịch và chuyển giao quyền quản lý cont
                  (Custody).
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
                    <div>
                      <div className="text-xs sm:text-sm font-bold text-emerald-700">
                        NHÀ CUNG CẤP - ĐÃ GIAO
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {activeTxn.handoverRecord?.confirmationA
                          ? `Đã xác nhận: ${formatDateTime(activeTxn.handoverRecord.confirmationA.confirmedAt)}`
                          : "Chưa xác nhận"}
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
                        Nhà cung cấp xác nhận Giao
                      </button>
                    )}
                    {activeTxn.handoverRecord?.confirmationA && (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    )}
                  </div>

                  <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
                    <div>
                      <div className="text-xs sm:text-sm font-bold text-blue-700">
                        ĐƠN VỊ CẦN VỎ - ĐÃ NHẬN
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {activeTxn.handoverRecord?.confirmationB
                          ? `Đã xác nhận: ${formatDateTime(activeTxn.handoverRecord.confirmationB.confirmedAt)}`
                          : "Chưa xác nhận"}
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
                        Đơn vị cần vỏ xác nhận Nhận
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
          {activeTxn.status === "COMPLETED" && (
            <div className="bg-white border border-emerald-200 rounded-2xl p-8 shadow-sm space-y-4 text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 uppercase">
                GIAO DỊCH ĐÃ HOÀN TẤT THÀNH CÔNG (COMPLETED)
              </h3>
              <p className="text-xs text-slate-600 max-w-lg mx-auto">
                Quyền quản lý (Custody) của container{" "}
                <strong className="font-mono text-brand-700">
                  {activeTxn.asset.containerNumber}
                </strong>{" "}
                đã được chuyển giao thành công cho{" "}
                <strong className="text-slate-900">
                  {displayCompanyBName}
                </strong>
                .
              </p>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs max-w-md mx-auto text-slate-600">
                Mã xác thực bàn giao SHA-256:{" "}
                <span className="font-mono text-emerald-700 font-semibold">
                  {activeTxn.handoverRecord?.contentHash ||
                    "SHA256:ECONT-984210"}
                </span>
              </div>
            </div>
          )}

          {/* Bảng bóc tách chi phí & tiết kiệm */}
          {activeTxn.quote && (
            <PricingBreakdownCard
              quote={activeTxn.quote}
              context="transaction_detail"
              showDetails={true}
            />
          )}
        </div>

        {/* Right 1 col: Quick Info & Dispute Controls */}
        <div className="space-y-6">
          {/* Thông tin Container & Đối tác */}
          {canOperate && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm text-xs space-y-3">
              <h4 className="font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2.5 flex items-center gap-1.5">
                <Building className="w-4 h-4 text-brand-600" />
                <span>THÔNG TIN ĐỐI TÁC GIAO DỊCH</span>
              </h4>

              <div>
                <span className="text-slate-500 font-medium block text-xs">
                  NHÀ CUNG CẤP CONTAINER:
                </span>
                <strong className="text-slate-900 text-sm">
                  {activeTxn.companyAName}
                </strong>
              </div>

              <div>
                <span className="text-slate-500 font-medium block text-xs">
                  ĐƠN VỊ CẦN VỎ CONTAINER:
                </span>
                <strong className="text-slate-900 text-sm">
                  {activeTxn.companyBName}
                </strong>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <span className="text-slate-500 font-medium block text-xs">
                  Container:
                </span>
                <div className="font-mono font-bold text-slate-900 text-base">
                  {activeTxn.asset.containerNumber} (
                  {activeTxn.asset.containerType})
                </div>
                <div className="text-slate-500 text-xs mt-1">
                  Hãng tàu:{" "}
                  <strong className="text-slate-700">
                    {activeTxn.asset.carrierCode}
                  </strong>{" "}
                  · Vị trí: {activeTxn.asset.currentLocationName}
                </div>
              </div>
            </div>
          )}

          {/* Công cụ can thiệp Ops (Hold / Dispute) */}
          <div className="bg-white border-2 border-amber-300 rounded-2xl p-5 shadow-sm text-xs space-y-3">
            <h4 className="font-bold text-amber-900 uppercase tracking-wider border-b border-amber-100 pb-2.5 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span>KIỂM SOÁT SỰ CỐ & TẠM DỪNG (HOLD)</span>
            </h4>
            <p className="text-xs text-slate-600">
              Khi phát hiện sai lệch hiện trạng, tiền đến muộn hoặc từ chối
              carrier, Ops có thể kích hoạt Tạm dừng (ON_HOLD).
            </p>

            {canOperate &&
              (activeTxn.isOnHold ? (
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
              ))}

            {setCurrentTab && (
              <button
                onClick={() => setCurrentTab("cases")}
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
              <h3 className="text-base font-bold text-slate-900">
                Hủy giao dịch {activeTxn.id}
              </h3>
              <button
                onClick={() => setShowCancelModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-600">
              Việc hủy giao dịch sẽ giải phóng Offer và Request để tham gia ghép
              đôi mới.
            </p>
            <FormErrorSummary errors={cancelErrors} />
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Lý do hủy <RequiredMark />
              </label>
              <textarea
                id="cancelReason"
                data-field="cancelReason"
                value={cancelReason}
                onChange={(e) => {
                  setCancelErrors({});
                  setCancelReason(e.target.value);
                }}
                placeholder="Nhập lý do hủy giao dịch..."
                aria-invalid={Boolean(cancelErrors.cancelReason)}
                className={getFieldErrorClass(
                  Boolean(cancelErrors.cancelReason),
                  "w-full p-3 rounded-xl border border-slate-200 text-xs outline-none focus:ring-2 focus:ring-brand-500",
                )}
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
              <h3 className="text-base font-bold text-slate-900">
                Tạm dừng giao dịch
              </h3>
              <button
                onClick={() => setShowHoldModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-600">
              Trạng thái ON_HOLD chặn toàn bộ các bước chuyển trạng thái cho đến
              khi được Ops gỡ bỏ.
            </p>
            <FormErrorSummary errors={holdErrors} />
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Lý do tạm dừng <RequiredMark />
              </label>
              <textarea
                id="holdReason"
                data-field="holdReason"
                value={holdReason}
                onChange={(e) => {
                  setHoldErrors({});
                  setHoldReason(e.target.value);
                }}
                placeholder="Nhập lý do tạm dừng..."
                aria-invalid={Boolean(holdErrors.holdReason)}
                className={getFieldErrorClass(
                  Boolean(holdErrors.holdReason),
                  "w-full p-3 rounded-xl border border-slate-200 text-xs outline-none focus:ring-2 focus:ring-brand-500",
                )}
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
