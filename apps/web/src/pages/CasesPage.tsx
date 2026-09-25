// ==============================================================================
// ECont CasesPage - Trang Quản lý Sự cố & Khiếu nại
// ==============================================================================

import React, { useState } from "react";
import { useDatabase } from "../context/DatabaseContext";
import { useAuth } from "../context/AuthContext";
import {
  CaseAppeal,
  CaseAttachment,
  CaseIssue,
  PenaltyLevel,
  ViolationType,
} from "../types";
import {
  CaseStatusBadge,
  TransactionStatusBadge,
} from "../components/StatusBadge";
import { formatDateTime, formatRelativeTime } from "../lib/utils";
import {
  AlertCircle,
  AlertTriangle,
  Plus,
  MessageCircle,
  CheckCircle,
  X,
  ChevronDown,
  ChevronUp,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Clock,
  FileText,
  Edit3,
  Trash2,
  Upload,
  Image,
  Video,
  Scale,
} from "lucide-react";
import {
  FieldErrors,
  FieldError,
  FormErrorSummary,
  RequiredMark,
  getFieldErrorClass,
  scrollToFirstFieldError,
} from "../components/FormValidation";
import { required, setError } from "../lib/formValidation";
import {
  isWithinDisputeWindow,
  isWithinAppealWindow,
  getAppealWindowRemainingMs,
  formatAppealCountdown,
  PENALTY_MATRIX,
} from "../services/qaRules";

interface CasesPageProps {
  setCurrentTab: (tab: string) => void;
  setSelectedTxnId?: (id: string) => void;
}

const CASE_TYPE_LABELS: Record<CaseIssue["caseType"], string> = {
  CONDITION_MISMATCH: "Sai khác tình trạng cont",
  NO_SHOW: "No-show",
  WRONG_CONTAINER: "Sai số container",
  DAMAGE_DISPUTE: "Tranh chấp hư hại",
  LATE_HANDOVER: "Bàn giao trễ hẹn",
  CARRIER_REJECTION: "Hãng tàu từ chối",
  PAYMENT_ISSUE: "Vấn đề thanh toán",
  DOCUMENT_FRAUD: "Tài liệu không hợp lệ",
  RU_SCOPE_MISMATCH: "RU không đúng phạm vi",
  OTHER: "Khác",
};

const PRIORITY_MAP: Record<
  CaseIssue["priority"],
  { label: string; color: string }
> = {
  LOW: { label: "Thấp", color: "text-slate-500 bg-slate-50 border-slate-200" },
  MEDIUM: {
    label: "Trung bình",
    color: "text-amber-600 bg-amber-50 border-amber-200",
  },
  HIGH: {
    label: "Cao",
    color: "text-orange-600 bg-orange-50 border-orange-200",
  },
  CRITICAL: {
    label: "Khẩn cấp",
    color: "text-red-700 bg-red-50 border-red-200",
  },
};

export const CasesPage: React.FC<CasesPageProps> = ({
  setCurrentTab,
  setSelectedTxnId,
}) => {
  const {
    cases,
    addCase,
    updateCase,
    deleteCase,
    resolveCase,
    closeCase,
    submitCaseAppeal,
    reviewCaseAppeal,
    transactions,
    companies,
  } = useDatabase();
  const { currentRole, currentCompany, currentUserEmail } = useAuth();
  const [selectedCase, setSelectedCase] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [resolveModalId, setResolveModalId] = useState<string | null>(null);
  const [resolveText, setResolveText] = useState("");
  const [faultParty, setFaultParty] = useState<
    "PARTY_A" | "PARTY_B" | "PLATFORM" | "CARRIER" | "NONE"
  >("NONE");
  const [casePenaltyLevel, setCasePenaltyLevel] = useState<
    PenaltyLevel | "NONE"
  >("NONE");
  const [caseViolationType, setCaseViolationType] =
    useState<ViolationType>("OTHER");
  const [casePenaltyDeduction, setCasePenaltyDeduction] = useState<number>(0);
  const [caseMatchingDeprioritizedDays, setCaseMatchingDeprioritizedDays] =
    useState<number>(0);
  const [createErrors, setCreateErrors] = useState<FieldErrors>({});
  const [editErrors, setEditErrors] = useState<FieldErrors>({});
  const [resolveErrors, setResolveErrors] = useState<FieldErrors>({});
  const [newAttachments, setNewAttachments] = useState<CaseAttachment[]>([]);
  const [editAttachments, setEditAttachments] = useState<CaseAttachment[]>([]);

  // Dispute Appeal states (Câu 47)
  const [appealModalCaseId, setAppealModalCaseId] = useState<string | null>(
    null,
  );
  const [appealParty, setAppealParty] = useState<"PARTY_A" | "PARTY_B">(
    "PARTY_B",
  );
  const [appealName, setAppealName] = useState("");
  const [appealReason, setAppealReason] = useState("");
  const [appealNotes, setAppealNotes] = useState("");
  const [appealAttachments, setAppealAttachments] = useState<CaseAttachment[]>(
    [],
  );
  const [appealErrors, setAppealErrors] = useState<FieldErrors>({});

  // Senior Ops Review states (Câu 47)
  const [seniorReviewModalCaseId, setSeniorReviewModalCaseId] = useState<
    string | null
  >(null);
  const [seniorVerdict, setSeniorVerdict] = useState<
    "UPHELD" | "OVERTURNED" | "MODIFIED"
  >("UPHELD");
  const [seniorReviewerName, setSeniorReviewerName] = useState(
    "Võ Minh Tâm (Senior Ops Lead)",
  );
  const [seniorNotes, setSeniorNotes] = useState("");
  const [waiveOriginalPenalty, setWaiveOriginalPenalty] = useState(true);
  const [seniorErrors, setSeniorErrors] = useState<FieldErrors>({});

  // Edit form state
  const [editingCase, setEditingCase] = useState<CaseIssue | null>(null);
  const [editForm, setEditForm] = useState<{
    caseType: CaseIssue["caseType"];
    priority: CaseIssue["priority"];
    title: string;
    description: string;
    status: CaseIssue["status"];
  }>({
    caseType: "OTHER",
    priority: "MEDIUM",
    title: "",
    description: "",
    status: "OPEN",
  });

  const handleOpenEdit = (c: CaseIssue) => {
    setEditingCase(c);
    setEditErrors({});
    setEditAttachments(c.attachments || []);
    setEditForm({
      caseType: c.caseType,
      priority: c.priority,
      title: c.title,
      description: c.description,
      status: c.status,
    });
  };

  const readCaseAttachments = (
    fileList: FileList | null,
  ): Promise<CaseAttachment[]> => {
    const files = Array.from(fileList || []);
    const invalid = files.find(
      (file) =>
        !file.type.startsWith("image/") && !file.type.startsWith("video/"),
    );
    if (invalid) {
      return Promise.reject(
        new Error("Chỉ được tải ảnh hoặc video làm bằng chứng Case."),
      );
    }
    const tooLarge = files.find((file) => file.size > 20 * 1024 * 1024);
    if (tooLarge) {
      return Promise.reject(
        new Error("Mỗi ảnh/video không được vượt quá 20 MB."),
      );
    }
    return Promise.all(
      files.map(
        (file, index) =>
          new Promise<CaseAttachment>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () =>
              resolve({
                id: `CASE-FILE-${Date.now()}-${index}`,
                name: file.name,
                mimeType: file.type,
                kind: file.type.startsWith("video/") ? "VIDEO" : "IMAGE",
                size: file.size,
                dataUrl: reader.result as string,
                createdAt: new Date().toISOString(),
              });
            reader.onerror = () =>
              reject(new Error("Không đọc được file bằng chứng."));
            reader.readAsDataURL(file);
          }),
      ),
    );
  };

  const handleNewAttachmentUpload = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    readCaseAttachments(event.target.files)
      .then((files) => setNewAttachments((previous) => [...previous, ...files]))
      .catch((error) =>
        window.alert(
          error instanceof Error
            ? error.message
            : "Không thể đọc file bằng chứng.",
        ),
      )
      .finally(() => {
        event.target.value = "";
      });
  };

  const handleEditAttachmentUpload = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    readCaseAttachments(event.target.files)
      .then((files) =>
        setEditAttachments((previous) => [...previous, ...files]),
      )
      .catch((error) =>
        window.alert(
          error instanceof Error
            ? error.message
            : "Không thể đọc file bằng chứng.",
        ),
      )
      .finally(() => {
        event.target.value = "";
      });
  };

  const handleSaveEdit = () => {
    if (!editingCase) return;
    const errors: FieldErrors = {};
    setError(
      errors,
      "edit-title",
      required(editForm.title, "Vui lòng nhập tiêu đề Case."),
    );
    setError(
      errors,
      "edit-description",
      required(editForm.description, "Vui lòng nhập mô tả chi tiết Case."),
    );
    setEditErrors(errors);
    if (Object.keys(errors).length > 0) {
      scrollToFirstFieldError(errors);
      return;
    }
    const result = updateCase(editingCase.id, {
      caseType: editForm.caseType,
      priority: editForm.priority,
      title: editForm.title.trim(),
      description: editForm.description.trim(),
      status: editForm.status,
      attachments: editAttachments,
    });
    if (result.success) {
      setEditingCase(null);
      setEditErrors({});
    } else {
      window.alert(result.message);
    }
  };

  const handleDeleteCase = (c: CaseIssue) => {
    if (window.confirm(`Bạn có chắc muốn xóa Case "${c.title}"?`)) {
      const result = deleteCase(c.id);
      if (!result.success) {
        alert(result.message);
      } else {
        if (selectedCase === c.id) {
          setSelectedCase(null);
        }
      }
    }
  };

  // Create form state
  const [newCase, setNewCase] = useState({
    transactionId: "",
    caseType: "OTHER" as CaseIssue["caseType"],
    priority: "MEDIUM" as CaseIssue["priority"],
    title: "",
    description: "",
  });

  const visibleCases =
    currentRole === "OPS"
      ? cases
      : cases.filter((c) => c.openedByCompanyId === currentCompany.id);
  const filtered = visibleCases.filter((c) => {
    if (filterStatus !== "all" && c.status !== filterStatus) return false;
    return true;
  });
  const caseTransactions = transactions.filter((transaction) => {
    if (transaction.status === "COMPLETED") return false;
    if (currentRole === "OPS") return true;
    const isParticipant =
      transaction.companyAId === currentCompany.id ||
      transaction.companyBId === currentCompany.id;
    return isParticipant && isWithinDisputeWindow(transaction.createdAt);
  });

  const handleCreateCase = () => {
    const errors: FieldErrors = {};
    setError(
      errors,
      "title",
      required(newCase.title, "Vui lòng nhập tiêu đề Case."),
    );
    setError(
      errors,
      "description",
      required(newCase.description, "Vui lòng nhập mô tả chi tiết Case."),
    );
    if (newCase.transactionId) {
      const txn = transactions.find(
        (item) => item.id === newCase.transactionId,
      );
      if (!txn) errors.transactionId = "Giao dịch liên quan không tồn tại.";
    }
    setCreateErrors(errors);
    if (Object.keys(errors).length > 0) {
      scrollToFirstFieldError(errors);
      return;
    }
    const result = addCase({
      openedByCompanyId: currentCompany.id,
      openedByCompanyName: currentCompany.shortName,
      caseType: newCase.caseType,
      priority: newCase.priority,
      title: newCase.title.trim(),
      description: newCase.description.trim(),
      transactionId: newCase.transactionId || undefined,
      status: "OPEN",
      attachments: newAttachments,
    });
    if (result.success) {
      setShowCreateForm(false);
      setNewCase({
        transactionId: "",
        caseType: "OTHER",
        priority: "MEDIUM",
        title: "",
        description: "",
      });
      setNewAttachments([]);
      setCreateErrors({});
    } else {
      window.alert(result.message);
    }
  };

  const handleResolve = (caseId: string) => {
    const errors: FieldErrors = {};
    setError(
      errors,
      "resolveText",
      required(resolveText, "Vui lòng nhập tóm tắt kết luận giải quyết."),
    );
    setResolveErrors(errors);
    if (Object.keys(errors).length > 0) {
      scrollToFirstFieldError(errors);
      return;
    }
    const result = resolveCase(caseId, {
      summary: resolveText.trim(),
      faultParty,
      resolvedBy: currentUserEmail,
      resolvedAt: new Date().toISOString(),
      penaltyLevel: casePenaltyLevel !== "NONE" ? casePenaltyLevel : undefined,
      violationType:
        casePenaltyLevel !== "NONE" ? caseViolationType : undefined,
      penaltyScoreDeduction:
        casePenaltyLevel !== "NONE" ? casePenaltyDeduction : undefined,
      matchingDeprioritizedDays:
        casePenaltyLevel === "LEVEL_2"
          ? caseMatchingDeprioritizedDays
          : undefined,
    });
    if (result.success) {
      setResolveModalId(null);
      setResolveText("");
      setResolveErrors({});
      setCasePenaltyLevel("NONE");
      setCaseViolationType("OTHER");
      setCasePenaltyDeduction(0);
      setCaseMatchingDeprioritizedDays(0);
    } else {
      window.alert(result.message);
    }
  };

  const handleAppealAttachmentUpload = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    readCaseAttachments(event.target.files)
      .then((files) =>
        setAppealAttachments((previous) => [...previous, ...files]),
      )
      .catch((error) =>
        window.alert(
          error instanceof Error
            ? error.message
            : "Không thể đọc file bằng chứng.",
        ),
      )
      .finally(() => {
        event.target.value = "";
      });
  };

  const handleSubmitAppeal = (caseId: string) => {
    const targetCase = cases.find((c) => c.id === caseId);
    if (!targetCase) return;
    const errors: FieldErrors = {};
    setError(
      errors,
      "appealReason",
      required(appealReason, "Vui lòng nhập lý do kháng nghị chi tiết."),
    );
    setAppealErrors(errors);
    if (Object.keys(errors).length > 0) {
      scrollToFirstFieldError(errors);
      return;
    }

    const txn = transactions.find((t) => t.id === targetCase.transactionId);
    const companyId =
      appealParty === "PARTY_A"
        ? txn?.companyAId || targetCase.openedByCompanyId
        : txn?.companyBId || currentCompany.id;
    const compObj = companies.find((c) => c.id === companyId);
    const companyName =
      compObj?.companyName ||
      (appealParty === "PARTY_A"
        ? "Nhà cung cấp Container (Bên A)"
        : "Đơn vị Cần vỏ Container (Bên B)");

    const result = submitCaseAppeal(caseId, {
      appellantParty: appealParty,
      appellantCompanyId: companyId,
      appellantCompanyName: companyName,
      appellantName:
        appealName.trim() ||
        currentCompany.representativeName ||
        "Đại diện doanh nghiệp",
      appellantEmail: currentUserEmail,
      reason: appealReason.trim(),
      evidenceFiles: appealAttachments,
      notes: appealNotes.trim(),
    });

    if (result.success) {
      setAppealModalCaseId(null);
      setAppealReason("");
      setAppealNotes("");
      setAppealName("");
      setAppealAttachments([]);
      setAppealErrors({});
    } else {
      window.alert(result.message);
    }
  };

  const handleSeniorReview = (caseId: string) => {
    const errors: FieldErrors = {};
    setError(
      errors,
      "seniorNotes",
      required(
        seniorNotes,
        "Vui lòng nhập lý luận và biên bản thẩm định độc lập.",
      ),
    );
    setSeniorErrors(errors);
    if (Object.keys(errors).length > 0) {
      scrollToFirstFieldError(errors);
      return;
    }

    const result = reviewCaseAppeal(caseId, {
      verdict: seniorVerdict,
      reviewerEmail: currentUserEmail,
      reviewerName: seniorReviewerName.trim() || "Senior Ops Lead",
      notes: seniorNotes.trim(),
      waiveOriginalPenalty:
        seniorVerdict === "OVERTURNED" ? true : waiveOriginalPenalty,
    });

    if (result.success) {
      setSeniorReviewModalCaseId(null);
      setSeniorNotes("");
      setSeniorVerdict("UPHELD");
      setSeniorErrors({});
    } else {
      window.alert(result.message);
    }
  };

  const activeCaseId = selectedCase;
  const activeCase = cases.find((c) => c.id === activeCaseId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <AlertCircle className="w-6 h-6 text-rose-600" />
            <span>Quản lý Sự cố & Khiếu nại</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Ghi nhận hiện trường, giám định sai khác và kết luận giải quyết
            tranh chấp giao dịch
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Báo cáo sự cố mới</span>
        </button>
      </div>

      {/* Create form */}
      {showCreateForm && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-red-800">
              Báo cáo Sự cố & Khiếu nại mới
            </h3>
            <button
              onClick={() => setShowCreateForm(false)}
              className="text-red-400 hover:text-red-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <FormErrorSummary errors={createErrors} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">
                Giao dịch liên quan (tùy chọn)
              </label>
              <select
                id="case-transactionId"
                data-field="transactionId"
                value={newCase.transactionId}
                onChange={(e) => {
                  setCreateErrors((previous) => {
                    const next = { ...previous };
                    delete next.transactionId;
                    return next;
                  });
                  setNewCase((p) => ({ ...p, transactionId: e.target.value }));
                }}
                aria-invalid={Boolean(createErrors.transactionId)}
                className={getFieldErrorClass(
                  Boolean(createErrors.transactionId),
                  "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-brand-400 focus:ring-2 focus:ring-brand-100 outline-none",
                )}
              >
                <option value="">— Không liên kết giao dịch —</option>
                {caseTransactions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.id} · {t.asset.containerNumber}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">
                Loại sự cố
              </label>
              <select
                value={newCase.caseType}
                onChange={(e) =>
                  setNewCase((p) => ({
                    ...p,
                    caseType: e.target.value as CaseIssue["caseType"],
                  }))
                }
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-brand-400 focus:ring-2 focus:ring-brand-100 outline-none"
              >
                {Object.entries(CASE_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">
                Mức độ ưu tiên
              </label>
              <select
                value={newCase.priority}
                onChange={(e) =>
                  setNewCase((p) => ({
                    ...p,
                    priority: e.target.value as CaseIssue["priority"],
                  }))
                }
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-brand-400 focus:ring-2 focus:ring-brand-100 outline-none"
              >
                {Object.entries(PRIORITY_MAP).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">
                Tiêu đề <RequiredMark />
              </label>
              <input
                id="case-title"
                data-field="title"
                value={newCase.title}
                onChange={(e) => {
                  setCreateErrors((previous) => {
                    const next = { ...previous };
                    delete next.title;
                    return next;
                  });
                  setNewCase((p) => ({ ...p, title: e.target.value }));
                }}
                placeholder="Mô tả ngắn gọn vấn đề"
                aria-invalid={Boolean(createErrors.title)}
                className={getFieldErrorClass(
                  Boolean(createErrors.title),
                  "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-brand-400 focus:ring-2 focus:ring-brand-100 outline-none",
                )}
              />
              <FieldError message={createErrors.title} />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-slate-600 block mb-1">
                Mô tả chi tiết <RequiredMark />
              </label>
              <textarea
                id="case-description"
                data-field="description"
                value={newCase.description}
                onChange={(e) => {
                  setCreateErrors((previous) => {
                    const next = { ...previous };
                    delete next.description;
                    return next;
                  });
                  setNewCase((p) => ({ ...p, description: e.target.value }));
                }}
                placeholder="Mô tả đầy đủ sự cố, bằng chứng, yêu cầu giải quyết..."
                rows={3}
                aria-invalid={Boolean(createErrors.description)}
                className={getFieldErrorClass(
                  Boolean(createErrors.description),
                  "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-brand-400 focus:ring-2 focus:ring-brand-100 outline-none resize-none",
                )}
              />
              <FieldError message={createErrors.description} />
            </div>
            <div className="md:col-span-2 rounded-lg border border-dashed border-red-200 bg-white p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-slate-700">
                    Ảnh/video bằng chứng{" "}
                    <span className="font-normal text-slate-500">
                      (tùy chọn)
                    </span>
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Có thể tải nhiều ảnh hoặc video, tối đa 20 MB mỗi file.
                  </p>
                </div>
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100">
                  <Upload className="h-3.5 w-3.5" /> Thêm ảnh/video
                  <input
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    className="hidden"
                    onChange={handleNewAttachmentUpload}
                  />
                </label>
              </div>
              {newAttachments.length > 0 && (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {newAttachments.map((attachment, index) => (
                    <div
                      key={attachment.id}
                      className="relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
                    >
                      {attachment.kind === "IMAGE" ? (
                        <img
                          src={attachment.dataUrl}
                          alt={attachment.name}
                          className="h-24 w-full object-cover"
                        />
                      ) : (
                        <video
                          src={attachment.dataUrl}
                          controls
                          className="h-24 w-full object-cover"
                        />
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          setNewAttachments((previous) =>
                            previous.filter(
                              (_, itemIndex) => itemIndex !== index,
                            ),
                          )
                        }
                        className="absolute right-1 top-1 rounded-full bg-red-600 px-1.5 text-xs text-white"
                      >
                        ×
                      </button>
                      <p className="truncate px-1.5 py-1 text-[10px] text-slate-500">
                        {attachment.name}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setShowCreateForm(false)}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Hủy
            </button>
            <button
              onClick={handleCreateCase}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold rounded-lg"
            >
              Tạo Case
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {[
          { key: "all", label: "Tất cả" },
          { key: "OPEN", label: "Đang mở" },
          { key: "IN_REVIEW", label: "Đang xử lý" },
          { key: "NEEDS_INFO", label: "Cần bổ sung TT" },
          {
            key: "APPEAL_PENDING",
            label: "Chờ tái thẩm tra (Senior Ops)",
          },
          { key: "RESOLVED", label: "Đã giải quyết" },
          { key: "CLOSED", label: "Đã đóng" },
        ].map((tab) => {
          const count =
            tab.key === "all"
              ? visibleCases.length
              : visibleCases.filter((c) => c.status === tab.key).length;
          return (
            <button
              key={tab.key}
              onClick={() => setFilterStatus(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors flex items-center gap-1.5 ${
                filterStatus === tab.key
                  ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                  filterStatus === tab.key
                    ? "bg-slate-700 text-white"
                    : tab.key === "APPEAL_PENDING" && count > 0
                      ? "bg-purple-100 text-purple-800 font-bold"
                      : "bg-slate-100 text-slate-500"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Cases list */}
        <div className="space-y-3">
          {filtered.length === 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
              <AlertCircle className="w-10 h-10 text-slate-200 mx-auto" />
              <p className="text-sm text-slate-400 mt-3">Không có Case nào</p>
            </div>
          )}
          {filtered.map((c) => {
            const txn = c.transactionId
              ? transactions.find((t) => t.id === c.transactionId)
              : undefined;
            const priority = PRIORITY_MAP[c.priority];
            const isSelected = selectedCase === c.id;
            const isReporter = c.openedByCompanyId === currentCompany.id;

            return (
              <button
                key={c.id}
                onClick={() => setSelectedCase(isSelected ? null : c.id)}
                className={`w-full text-left bg-white rounded-xl border transition-all shadow-sm ${
                  isSelected
                    ? "border-brand-300 shadow-md"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="p-4 space-y-2">
                  <div className="flex items-start gap-3">
                    <AlertTriangle
                      className={`w-4 h-4 shrink-0 mt-0.5 ${
                        c.priority === "CRITICAL"
                          ? "text-red-500"
                          : c.priority === "HIGH"
                            ? "text-orange-500"
                            : "text-amber-400"
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-slate-800 truncate">
                          {c.title}
                        </span>
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded-md border ${priority.color}`}
                        >
                          {priority.label}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {CASE_TYPE_LABELS[c.caseType]}
                      </p>
                    </div>
                    <CaseStatusBadge status={c.status} size="xs" />
                  </div>

                  <p className="text-xs text-slate-600 pl-7 line-clamp-2">
                    {c.description}
                  </p>
                  {c.attachments && c.attachments.length > 0 && (
                    <div className="pl-7 flex items-center gap-2 text-[11px] font-semibold text-slate-500">
                      <Image className="h-3.5 w-3.5" /> {c.attachments.length}{" "}
                      file bằng chứng
                    </div>
                  )}

                  <div className="pl-7 flex items-center gap-3 flex-wrap">
                    <span className="text-xs text-slate-500">
                      Bởi {c.openedByCompanyName}
                    </span>
                    {c.transactionId && (
                      <span className="text-xs font-mono font-semibold text-blue-600">
                        {c.transactionId}
                      </span>
                    )}
                    <span className="text-xs text-slate-500">
                      {formatRelativeTime(c.createdAt)}
                    </span>
                  </div>
                </div>

                {/* Expanded detail */}
                {isSelected && (
                  <div className="border-t border-slate-100 p-4 space-y-4 bg-slate-50 rounded-b-xl">
                    {/* Resolution */}
                    {c.attachments && c.attachments.length > 0 && (
                      <div className="rounded-lg border border-slate-200 bg-white p-3">
                        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                          <Image className="h-3.5 w-3.5" /> Bằng chứng đính kèm
                        </p>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          {c.attachments.map((attachment) => (
                            <div
                              key={attachment.id}
                              className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
                            >
                              {attachment.kind === "IMAGE" ? (
                                <img
                                  src={attachment.dataUrl}
                                  alt={attachment.name}
                                  className="h-24 w-full object-cover"
                                />
                              ) : (
                                <video
                                  src={attachment.dataUrl}
                                  controls
                                  className="h-24 w-full object-cover"
                                />
                              )}
                              <p className="truncate px-1.5 py-1 text-[10px] text-slate-500">
                                {attachment.name}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {c.resolution && (
                      <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3 space-y-1">
                        <p className="text-xs font-semibold text-emerald-800 flex items-center gap-1.5">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />{" "}
                          Kết luận giải quyết
                        </p>
                        <p className="text-xs text-emerald-700">
                          {c.resolution.summary}
                        </p>
                        <p className="text-[11px] text-emerald-600">
                          Lỗi thuộc: <strong>{c.resolution.faultParty}</strong>{" "}
                          · Bởi: {c.resolution.resolvedBy} ·{" "}
                          {formatDateTime(c.resolution.resolvedAt)}
                        </p>
                        {c.resolution.penaltyLevel && (
                          <p className="text-[11px] text-amber-700 bg-amber-50/80 px-2 py-0.5 rounded border border-amber-200 inline-block font-medium">
                            Chế tài: {c.resolution.penaltyLevel} (Trừ{" "}
                            {c.resolution.penaltyScoreDeduction || 0} điểm Trust
                            Score)
                            {c.resolution.matchingDeprioritizedDays
                              ? ` · Hạ ưu tiên ghép đôi ${c.resolution.matchingDeprioritizedDays} ngày`
                              : ""}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Cửa sổ Kháng nghị 48 giờ (Câu 47) */}
                    {c.status === "RESOLVED" && (
                      <div
                        className={`rounded-xl border p-3.5 text-xs space-y-2 ${
                          isWithinAppealWindow(c)
                            ? "bg-purple-50/70 border-purple-200 text-purple-900"
                            : "bg-slate-50 border-slate-200 text-slate-600"
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Clock
                              className={`w-4 h-4 ${
                                isWithinAppealWindow(c)
                                  ? "text-purple-600 animate-pulse"
                                  : "text-slate-400"
                              }`}
                            />
                            <span className="font-bold">
                              Cửa sổ Kháng nghị (Appeal Window):
                            </span>
                            <span
                              className={`font-mono px-2 py-0.5 rounded text-[11px] font-semibold ${
                                isWithinAppealWindow(c)
                                  ? "bg-purple-200/80 text-purple-900"
                                  : "bg-slate-200 text-slate-600"
                              }`}
                            >
                              {formatAppealCountdown(
                                getAppealWindowRemainingMs(c),
                              )}
                            </span>
                          </div>
                          {isWithinAppealWindow(c) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setAppealModalCaseId(c.id);
                                const txn = transactions.find(
                                  (t) => t.id === c.transactionId,
                                );
                                if (c.resolution?.faultParty === "PARTY_A") {
                                  setAppealParty("PARTY_A");
                                } else if (
                                  c.resolution?.faultParty === "PARTY_B"
                                ) {
                                  setAppealParty("PARTY_B");
                                } else {
                                  setAppealParty(
                                    currentCompany.businessType === "FACTORY"
                                      ? "PARTY_B"
                                      : "PARTY_A",
                                  );
                                }
                                setAppealReason("");
                                setAppealNotes("");
                                setAppealName("");
                                setAppealAttachments([]);
                                setAppealErrors({});
                              }}
                              className="px-3 py-1 rounded-lg bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition-all"
                            >
                              <Scale className="w-3.5 h-3.5" />
                              Gửi đơn Kháng nghị (Appeal)
                            </button>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-600 leading-relaxed">
                          {isWithinAppealWindow(c)
                            ? "Sau khi Ops ra quyết định RESOLVED, Bên A hoặc Bên B có 48 giờ để gửi đơn Kháng nghị kèm bằng chứng mới nếu không đồng ý với kết luận phân bổ trách nhiệm."
                            : "Cửa sổ Kháng nghị 48 giờ đã kết thúc. Quyết định giải quyết đã có hiệu lực vĩnh viễn."}
                        </p>
                      </div>
                    )}

                    {/* Hàng đợi Tái thẩm tra độc lập - Senior Ops Review (Câu 47) */}
                    {c.status === "APPEAL_PENDING" && (
                      <div className="p-4 rounded-xl border border-purple-300 bg-purple-50/80 text-xs space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Scale className="w-5 h-5 text-purple-700" />
                            <div>
                              <p className="font-bold text-purple-950 text-sm">
                                Hàng đợi Tái thẩm tra (Senior Ops Review Queue)
                              </p>
                              <p className="text-[11px] text-purple-700">
                                Đơn vị nộp đơn:{" "}
                                <strong className="font-semibold text-purple-900">
                                  {c.appeal?.appellantCompanyName ||
                                    c.openedByCompanyName}{" "}
                                  (
                                  {c.appeal?.appellantParty === "PARTY_A"
                                    ? "Bên A - Cung cấp"
                                    : "Bên B - Cần vỏ"}
                                  )
                                </strong>{" "}
                                · Gửi lúc:{" "}
                                {c.appeal?.submittedAt
                                  ? formatDateTime(c.appeal.submittedAt)
                                  : formatDateTime(c.updatedAt)}
                              </p>
                            </div>
                          </div>
                          {currentRole === "OPS" && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSeniorReviewModalCaseId(c.id);
                                setSeniorVerdict("UPHELD");
                                setSeniorReviewerName(
                                  currentUserEmail
                                    ? `Senior Ops (${currentUserEmail})`
                                    : "Võ Minh Tâm (Senior Ops Lead)",
                                );
                                setSeniorNotes("");
                                setWaiveOriginalPenalty(true);
                                setSeniorErrors({});
                              }}
                              className="px-3.5 py-1.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs shadow flex items-center gap-1.5 transition-all"
                            >
                              <ShieldCheck className="w-4 h-4" />
                              Tái thẩm tra & Quyết định (Senior Ops)
                            </button>
                          )}
                        </div>

                        <div className="bg-white p-3 rounded-lg border border-purple-200 space-y-1">
                          <p className="font-semibold text-purple-900 text-xs">
                            Lý do & Giải trình Kháng nghị:
                          </p>
                          <p className="text-slate-700 text-xs leading-relaxed whitespace-pre-line">
                            {c.appeal?.reason ||
                              c.appealReason ||
                              "Chưa có thông tin ghi chú."}
                          </p>
                        </div>

                        {c.appeal?.evidenceFiles &&
                          c.appeal.evidenceFiles.length > 0 && (
                            <div className="space-y-1.5">
                              <p className="font-semibold text-purple-900 text-xs">
                                Bằng chứng mới đính kèm (
                                {c.appeal.evidenceFiles.length} file):
                              </p>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {c.appeal.evidenceFiles.map((att) => (
                                  <div
                                    key={att.id}
                                    className="relative overflow-hidden rounded-lg border border-purple-200 bg-white"
                                  >
                                    {att.kind === "IMAGE" ? (
                                      <img
                                        src={att.dataUrl}
                                        alt={att.name}
                                        className="h-20 w-full object-cover"
                                      />
                                    ) : (
                                      <video
                                        src={att.dataUrl}
                                        controls
                                        className="h-20 w-full object-cover"
                                      />
                                    )}
                                    <p className="truncate px-1.5 py-0.5 text-[10px] text-slate-500">
                                      {att.name}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                      </div>
                    )}

                    {/* Biên bản Tái thẩm định Độc lập của Senior Ops (nếu có) */}
                    {c.appeal?.seniorVerdict && (
                      <div className="p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/50 text-xs space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 font-bold text-indigo-950">
                            <ShieldCheck className="w-4 h-4 text-indigo-600" />
                            <span>Phán quyết Tái thẩm định của Senior Ops</span>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              c.appeal.seniorVerdict === "OVERTURNED"
                                ? "bg-emerald-100 text-emerald-800"
                                : c.appeal.seniorVerdict === "MODIFIED"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-slate-200 text-slate-700"
                            }`}
                          >
                            {c.appeal.seniorVerdict === "OVERTURNED"
                              ? "CHẤP THUẬN KHÁNG NGHỊ (HỦY PHÁN QUYẾT CŨ)"
                              : c.appeal.seniorVerdict === "MODIFIED"
                                ? "ĐIỀU CHỈNH PHÁN QUYẾT"
                                : "BÁC ĐƠN KHÁNG NGHỊ (GIỮ NGUYÊN)"}
                          </span>
                        </div>
                        <p className="text-slate-700 leading-relaxed bg-white p-2.5 rounded-lg border border-indigo-100 whitespace-pre-line">
                          {c.appeal.seniorVerdictReason}
                        </p>
                        <div className="flex justify-between text-[11px] text-indigo-700 pt-0.5">
                          <span>
                            Thẩm định độc lập bởi:{" "}
                            <strong>{c.appeal.seniorReviewerName}</strong>
                          </span>
                          <span>
                            {c.appeal.reviewedAt
                              ? formatDateTime(c.appeal.reviewedAt)
                              : ""}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2">
                      {c.transactionId && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTxnId?.(c.transactionId!);
                            setCurrentTab("transactions");
                          }}
                          className="px-3 py-1.5 rounded-lg border border-brand-200 text-brand-700 text-xs font-semibold hover:bg-brand-50 flex items-center gap-1.5"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          Xem Giao dịch
                        </button>
                      )}
                      {isReporter &&
                        c.status !== "CLOSED" &&
                        c.status !== "APPEAL_PENDING" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEdit(c);
                            }}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-100 flex items-center gap-1.5"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                            Chỉnh sửa
                          </button>
                        )}
                      {isReporter && c.status === "OPEN" && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCase(c);
                          }}
                          className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-50 flex items-center gap-1.5"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Xóa Case
                        </button>
                      )}
                      {currentRole === "OPS" &&
                        c.status !== "CLOSED" &&
                        c.status !== "RESOLVED" &&
                        c.status !== "APPEAL_PENDING" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setResolveModalId(c.id);
                            }}
                            className="px-3 py-1.5 rounded-lg border border-emerald-200 text-emerald-700 text-xs font-semibold hover:bg-emerald-50 flex items-center gap-1.5"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            Kết luận giải quyết
                          </button>
                        )}
                      {currentRole === "OPS" &&
                        c.status === "APPEAL_PENDING" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSeniorReviewModalCaseId(c.id);
                              setSeniorVerdict("UPHELD");
                              setSeniorReviewerName(
                                currentUserEmail
                                  ? `Senior Ops (${currentUserEmail})`
                                  : "Võ Minh Tâm (Senior Ops Lead)",
                              );
                              setSeniorNotes("");
                              setWaiveOriginalPenalty(true);
                              setSeniorErrors({});
                            }}
                            className="px-3 py-1.5 rounded-lg border border-purple-300 text-purple-700 text-xs font-semibold hover:bg-purple-50 flex items-center gap-1.5 shadow-sm"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            Tái thẩm tra (Senior Ops)
                          </button>
                        )}
                      {c.status === "RESOLVED" && isWithinAppealWindow(c) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setAppealModalCaseId(c.id);
                            const txn = transactions.find(
                              (t) => t.id === c.transactionId,
                            );
                            if (c.resolution?.faultParty === "PARTY_A") {
                              setAppealParty("PARTY_A");
                            } else if (c.resolution?.faultParty === "PARTY_B") {
                              setAppealParty("PARTY_B");
                            } else {
                              setAppealParty(
                                currentCompany.businessType === "FACTORY"
                                  ? "PARTY_B"
                                  : "PARTY_A",
                              );
                            }
                            setAppealReason("");
                            setAppealNotes("");
                            setAppealName("");
                            setAppealAttachments([]);
                            setAppealErrors({});
                          }}
                          className="px-3 py-1.5 rounded-lg border border-purple-200 text-purple-700 text-xs font-semibold hover:bg-purple-50 flex items-center gap-1.5"
                        >
                          <Scale className="w-3.5 h-3.5" />
                          Kháng nghị kết quả
                        </button>
                      )}
                      {currentRole === "OPS" && c.status === "RESOLVED" && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            closeCase(c.id);
                          }}
                          className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-100 flex items-center gap-1.5"
                        >
                          <X className="w-3.5 h-3.5" />
                          Đóng Case
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Case statistics */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-slate-800 mb-3.5">
              Thống kê Case
            </h3>
            <div className="grid grid-cols-2 gap-3 gap-y-3">
              {[
                {
                  label: "Đang mở",
                  value: visibleCases.filter((c) => c.status === "OPEN").length,
                  color: "text-red-600",
                },
                {
                  label: "Đang xử lý",
                  value: visibleCases.filter((c) => c.status === "IN_REVIEW")
                    .length,
                  color: "text-amber-600",
                },
                {
                  label: "Chờ tái thẩm tra",
                  value: visibleCases.filter(
                    (c) => c.status === "APPEAL_PENDING",
                  ).length,
                  color: "text-purple-600",
                },
                {
                  label: "Đã giải quyết",
                  value: visibleCases.filter((c) => c.status === "RESOLVED")
                    .length,
                  color: "text-emerald-600",
                },
                {
                  label: "Đã đóng",
                  value: visibleCases.filter((c) => c.status === "CLOSED")
                    .length,
                  color: "text-slate-400",
                },
              ].map((s) => (
                <div
                  key={s.label}
                  className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-100"
                >
                  <p className={`text-2xl font-bold font-mono ${s.color}`}>
                    {s.value}
                  </p>
                  <p className="text-xs font-medium text-slate-600 mt-1">
                    {s.label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Case by type */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">
              Theo loại sự cố
            </h3>
            <div className="space-y-2">
              {Object.entries(CASE_TYPE_LABELS).map(([type, label]) => {
                const count = visibleCases.filter(
                  (c) => c.caseType === type,
                ).length;
                if (count === 0) return null;
                return (
                  <div key={type} className="flex items-center justify-between">
                    <span className="text-xs text-slate-600">{label}</span>
                    <span className="text-xs font-bold text-slate-800 font-mono">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Case rules reminder */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-start gap-2">
              <Shield className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-amber-700">
                  Quy định xử lý Sự cố & Khiếu nại
                </p>
                <ul className="text-xs text-amber-700 mt-1.5 space-y-1 list-disc list-inside">
                  <li>
                    Tranh chấp hư hại vỏ cont: đối chiếu ảnh chụp IICL-5 và biên
                    bản bàn giao
                  </li>
                  <li>
                    Vấn đề đối soát thanh toán: đối chiếu mã giao dịch ngân hàng
                    trước khi kết luận
                  </li>
                  <li>
                    Sự cố mức độ Khẩn cấp: hệ thống tạm dừng giao dịch liên quan
                    để bảo vệ các bên
                  </li>
                  <li>
                    Toàn bộ bằng chứng và hồ sơ được lưu trữ minh bạch, bảo mật
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Resolve modal */}
      {resolveModalId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-800">
                Kết luận giải quyết Case
              </h3>
              <button
                onClick={() => setResolveModalId(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <FormErrorSummary errors={resolveErrors} />
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">
                Lỗi thuộc về bên nào?
              </label>
              <select
                value={faultParty}
                onChange={(e) =>
                  setFaultParty(e.target.value as typeof faultParty)
                }
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none"
              >
                <option value="NONE">Không có lỗi từ bên nào</option>
                <option value="PARTY_A">Nhà cung cấp Container</option>
                <option value="PARTY_B">Đơn vị Cần vỏ Container</option>
                <option value="PLATFORM">Nền tảng ECont</option>
                <option value="CARRIER">Hãng tàu</option>
              </select>
            </div>

            {(faultParty === "PARTY_A" || faultParty === "PARTY_B") && (
              <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200 space-y-2 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-amber-900">
                  <ShieldAlert className="w-4 h-4 text-amber-600" />
                  <span>Áp dụng Chế tài & Trừ điểm Trust Score (Câu 46)</span>
                </div>
                <div>
                  <label className="text-slate-700 font-semibold block mb-1">
                    Mức độ chế tài
                  </label>
                  <select
                    value={casePenaltyLevel}
                    onChange={(e) => {
                      const lvl = e.target.value as PenaltyLevel | "NONE";
                      setCasePenaltyLevel(lvl);
                      if (lvl === "LEVEL_1") {
                        setCaseViolationType("LATE_APPOINTMENT_15M");
                        setCasePenaltyDeduction(2);
                        setCaseMatchingDeprioritizedDays(0);
                      } else if (lvl === "LEVEL_2") {
                        setCaseViolationType("NO_SHOW");
                        setCasePenaltyDeduction(10);
                        setCaseMatchingDeprioritizedDays(7);
                      } else if (lvl === "LEVEL_3") {
                        setCaseViolationType("PAYMENT_OVERDUE_2H");
                        setCasePenaltyDeduction(15);
                        setCaseMatchingDeprioritizedDays(0);
                      } else if (lvl === "LEVEL_4") {
                        setCaseViolationType("AI_INSPECTION_FRAUD");
                        setCasePenaltyDeduction(100);
                        setCaseMatchingDeprioritizedDays(0);
                      } else {
                        setCaseViolationType("OTHER");
                        setCasePenaltyDeduction(0);
                        setCaseMatchingDeprioritizedDays(0);
                      }
                    }}
                    className="w-full p-2 rounded-lg border border-slate-200 outline-none text-xs"
                  >
                    <option value="NONE">Không áp dụng chế tài</option>
                    <option value="LEVEL_1">
                      Level 1 (Nhẹ): Trừ 1–2 điểm Trust Score
                    </option>
                    <option value="LEVEL_2">
                      Level 2 (Vận hành): Trừ 5–10 điểm + Khóa ưu tiên ghép đôi
                    </option>
                    <option value="LEVEL_3">
                      Level 3 (Tài chính): Khóa giao dịch mới, cảnh báo đình chỉ
                    </option>
                    <option value="LEVEL_4">
                      Level 4 (Gian lận): Blacklist, đình chỉ vĩnh viễn
                      (BLOCKED)
                    </option>
                  </select>
                </div>

                {casePenaltyLevel !== "NONE" && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <label className="text-slate-700 font-semibold block mb-1">
                        Hành vi vi phạm
                      </label>
                      <select
                        value={caseViolationType}
                        onChange={(e) => {
                          const vt = e.target.value as ViolationType;
                          setCaseViolationType(vt);
                          const cfg = PENALTY_MATRIX[vt];
                          if (cfg) {
                            setCasePenaltyDeduction(cfg.defaultDeduction);
                            setCaseMatchingDeprioritizedDays(
                              cfg.matchingDeprioritizedDays || 0,
                            );
                          }
                        }}
                        className="w-full p-2 rounded-lg border border-slate-200 outline-none text-xs"
                      >
                        {casePenaltyLevel === "LEVEL_1" && (
                          <>
                            <option value="LATE_APPOINTMENT_15M">
                              Trễ hẹn giao nhận &gt;15 phút
                            </option>
                            <option value="SLOW_CHAT_RESPONSE_24H">
                              Phản hồi chat chậm &gt;24 giờ
                            </option>
                            <option value="OTHER">Vi phạm nhẹ khác</option>
                          </>
                        )}
                        {casePenaltyLevel === "LEVEL_2" && (
                          <>
                            <option value="NO_SHOW">
                              No-show không nhận/giao cont
                            </option>
                            <option value="LATE_CANCELLATION">
                              Hủy giao dịch cận giờ
                            </option>
                            <option value="WRONG_SPECIFICATION">
                              Khai sai quy cách cont
                            </option>
                            <option value="OTHER">Vi phạm vận hành khác</option>
                          </>
                        )}
                        {casePenaltyLevel === "LEVEL_3" && (
                          <>
                            <option value="PAYMENT_OVERDUE_2H">
                              Không thanh toán đúng hạn 2 giờ
                            </option>
                            <option value="RU_FEE_OVERDUE">
                              Chậm nộp phí RU hãng tàu
                            </option>
                          </>
                        )}
                        {casePenaltyLevel === "LEVEL_4" && (
                          <>
                            <option value="AI_INSPECTION_FRAUD">
                              Làm giả ảnh giám định
                            </option>
                            <option value="FAKE_CONTAINER_NUMBER">
                              Giả mạo số container
                            </option>
                            <option value="SWAP_DAMAGED_CONTAINER">
                              Tráo vỏ container mục nát
                            </option>
                          </>
                        )}
                      </select>
                    </div>
                    <div>
                      <label className="text-slate-700 font-semibold block mb-1">
                        Điểm trừ Trust Score
                      </label>
                      <input
                        type="number"
                        value={casePenaltyDeduction}
                        onChange={(e) =>
                          setCasePenaltyDeduction(Number(e.target.value))
                        }
                        className="w-full p-2 rounded-lg border border-slate-200 outline-none text-xs font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">
                Tóm tắt kết luận <RequiredMark />
              </label>
              <textarea
                id="case-resolveText"
                data-field="resolveText"
                value={resolveText}
                onChange={(e) => {
                  setResolveErrors({});
                  setResolveText(e.target.value);
                }}
                placeholder="Mô tả cách xử lý, kết quả điều tra, quyết định..."
                rows={4}
                aria-invalid={Boolean(resolveErrors.resolveText)}
                className={getFieldErrorClass(
                  Boolean(resolveErrors.resolveText),
                  "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none resize-none focus:border-brand-400",
                )}
              />
              <FieldError message={resolveErrors.resolveText} />
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setResolveModalId(null)}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Hủy
              </button>
              <button
                onClick={() => handleResolve(resolveModalId)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg"
              >
                Xác nhận Kết luận
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingCase && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-brand-600" />
                Chỉnh sửa Case {editingCase.id}
              </h3>
              <button
                onClick={() => setEditingCase(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <FormErrorSummary errors={editErrors} />
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  Loại sự cố
                </label>
                <select
                  value={editForm.caseType}
                  onChange={(e) =>
                    setEditForm((p) => ({
                      ...p,
                      caseType: e.target.value as CaseIssue["caseType"],
                    }))
                  }
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-brand-400"
                >
                  {Object.entries(CASE_TYPE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    Mức độ ưu tiên
                  </label>
                  <select
                    value={editForm.priority}
                    onChange={(e) =>
                      setEditForm((p) => ({
                        ...p,
                        priority: e.target.value as CaseIssue["priority"],
                      }))
                    }
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-brand-400"
                  >
                    {Object.entries(PRIORITY_MAP).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    Trạng thái Case
                  </label>
                  <select
                    value={editForm.status}
                    onChange={(e) =>
                      setEditForm((p) => ({
                        ...p,
                        status: e.target.value as CaseIssue["status"],
                      }))
                    }
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-brand-400"
                  >
                    <option value="OPEN">Đang mở (OPEN)</option>
                    <option value="IN_REVIEW">Đang xem xét (IN_REVIEW)</option>
                    <option value="NEEDS_INFO">
                      Cần bổ sung tin (NEEDS_INFO)
                    </option>
                    <option value="RESOLVED">Đã giải quyết (RESOLVED)</option>
                    <option value="CLOSED">Đã đóng (CLOSED)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  Tiêu đề <RequiredMark />
                </label>
                <input
                  id="case-edit-title"
                  data-field="edit-title"
                  value={editForm.title}
                  onChange={(e) => {
                    setEditErrors((previous) => {
                      const next = { ...previous };
                      delete next["edit-title"];
                      return next;
                    });
                    setEditForm((p) => ({ ...p, title: e.target.value }));
                  }}
                  aria-invalid={Boolean(editErrors["edit-title"])}
                  className={getFieldErrorClass(
                    Boolean(editErrors["edit-title"]),
                    "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-brand-400",
                  )}
                />
                <FieldError message={editErrors["edit-title"]} />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  Mô tả chi tiết <RequiredMark />
                </label>
                <textarea
                  id="case-edit-description"
                  data-field="edit-description"
                  value={editForm.description}
                  onChange={(e) => {
                    setEditErrors((previous) => {
                      const next = { ...previous };
                      delete next["edit-description"];
                      return next;
                    });
                    setEditForm((p) => ({ ...p, description: e.target.value }));
                  }}
                  rows={4}
                  aria-invalid={Boolean(editErrors["edit-description"])}
                  className={getFieldErrorClass(
                    Boolean(editErrors["edit-description"]),
                    "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none resize-none focus:border-brand-400",
                  )}
                />
                <FieldError message={editErrors["edit-description"]} />
              </div>

              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-slate-700">
                    Ảnh/video bằng chứng
                  </p>
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100">
                    <Upload className="h-3.5 w-3.5" /> Thêm file
                    <input
                      type="file"
                      accept="image/*,video/*"
                      multiple
                      className="hidden"
                      onChange={handleEditAttachmentUpload}
                    />
                  </label>
                </div>
                {editAttachments.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {editAttachments.map((attachment, index) => (
                      <div
                        key={attachment.id}
                        className="relative overflow-hidden rounded-lg border border-slate-200 bg-white"
                      >
                        {attachment.kind === "IMAGE" ? (
                          <img
                            src={attachment.dataUrl}
                            alt={attachment.name}
                            className="h-24 w-full object-cover"
                          />
                        ) : (
                          <video
                            src={attachment.dataUrl}
                            controls
                            className="h-24 w-full object-cover"
                          />
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            setEditAttachments((previous) =>
                              previous.filter(
                                (_, itemIndex) => itemIndex !== index,
                              ),
                            )
                          }
                          className="absolute right-1 top-1 rounded-full bg-red-600 px-1.5 text-xs text-white"
                        >
                          ×
                        </button>
                        <p className="truncate px-1.5 py-1 text-[10px] text-slate-500">
                          {attachment.name}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button
                onClick={() => setEditingCase(null)}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Hủy
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold rounded-lg shadow"
              >
                Lưu thay đổi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Appeal Submission Modal (Cửa sổ Kháng nghị 48 giờ - Câu 47) */}
      {appealModalCaseId &&
        (() => {
          const c = cases.find((item) => item.id === appealModalCaseId);
          if (!c) return null;
          const txn = transactions.find((t) => t.id === c.transactionId);
          const compA = companies.find(
            (comp) => comp.id === (txn?.companyAId || c.openedByCompanyId),
          );
          const compB = companies.find(
            (comp) => comp.id === (txn?.companyBId || currentCompany.id),
          );

          return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2 text-purple-900 font-bold">
                    <Scale className="w-5 h-5 text-purple-600" />
                    <span>Đơn Kháng Nghị Kết Quả Dispute ({c.id})</span>
                  </div>
                  <button
                    onClick={() => setAppealModalCaseId(null)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Information box */}
                <div className="p-3.5 bg-purple-50/70 rounded-xl border border-purple-200 text-xs space-y-1.5 text-purple-900">
                  <div className="flex items-center justify-between font-semibold">
                    <span>Cửa sổ Kháng nghị 48 giờ</span>
                    <span className="font-mono bg-purple-200 px-2 py-0.5 rounded text-[11px]">
                      {formatAppealCountdown(getAppealWindowRemainingMs(c))}
                    </span>
                  </div>
                  <p className="text-[11px] text-purple-800 leading-relaxed">
                    Nếu không đồng thuận với kết luận của Ops (Lỗi:{" "}
                    <strong>{c.resolution?.faultParty}</strong>), bạn có thể nộp
                    đơn kháng nghị kèm bằng chứng mới để yêu cầu Quản trị viên
                    cấp cao (Senior Ops) thẩm định lại độc lập.
                  </p>
                </div>

                <FormErrorSummary errors={appealErrors} />

                <div className="space-y-3.5 text-xs">
                  <div>
                    <label className="text-slate-700 font-semibold block mb-1">
                      Bên đứng đơn kháng nghị <RequiredMark />
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setAppealParty("PARTY_A")}
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          appealParty === "PARTY_A"
                            ? "border-purple-600 bg-purple-50 font-bold text-purple-900 ring-1 ring-purple-500"
                            : "border-slate-200 text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <p className="text-xs font-semibold">
                          Nhà cung cấp (Bên A)
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">
                          {compA?.shortName || "Bên A"}
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => setAppealParty("PARTY_B")}
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          appealParty === "PARTY_B"
                            ? "border-purple-600 bg-purple-50 font-bold text-purple-900 ring-1 ring-purple-500"
                            : "border-slate-200 text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <p className="text-xs font-semibold">
                          Đơn vị cần vỏ (Bên B)
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">
                          {compB?.shortName || "Bên B"}
                        </p>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-700 font-semibold block mb-1">
                      Họ tên người gửi / Người đại diện
                    </label>
                    <input
                      type="text"
                      value={appealName}
                      onChange={(e) => setAppealName(e.target.value)}
                      placeholder="VD: Nguyễn Văn A (Phụ trách Logistics)"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none text-xs focus:border-purple-500 focus:ring-1 focus:ring-purple-200"
                    />
                  </div>

                  <div>
                    <label className="text-slate-700 font-semibold block mb-1">
                      Lý do & Căn cứ Kháng nghị <RequiredMark />
                    </label>
                    <textarea
                      rows={4}
                      value={appealReason}
                      onChange={(e) => {
                        setAppealErrors({});
                        setAppealReason(e.target.value);
                      }}
                      placeholder="Nêu rõ lý do không đồng ý với kết luận phân bổ trách nhiệm của Ops, diễn giải tình tiết mới, sai lệch biên bản..."
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none text-xs resize-none focus:border-purple-500 focus:ring-1 focus:ring-purple-200"
                    />
                    <FieldError message={appealErrors.appealReason} />
                  </div>

                  {/* Upload bằng chứng mới */}
                  <div className="rounded-xl border border-dashed border-purple-300 bg-purple-50/30 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-slate-700">
                          Bằng chứng mới bổ sung
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Hình ảnh/video hiện trường mới, biên bản giao nhận bổ
                          sung...
                        </p>
                      </div>
                      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-purple-300 bg-purple-100/70 px-3 py-1.5 text-xs font-semibold text-purple-800 hover:bg-purple-200">
                        <Upload className="h-3.5 w-3.5" /> Thêm file
                        <input
                          type="file"
                          accept="image/*,video/*"
                          multiple
                          className="hidden"
                          onChange={handleAppealAttachmentUpload}
                        />
                      </label>
                    </div>

                    {appealAttachments.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                        {appealAttachments.map((att, idx) => (
                          <div
                            key={att.id}
                            className="relative overflow-hidden rounded-lg border border-slate-200 bg-white"
                          >
                            {att.kind === "IMAGE" ? (
                              <img
                                src={att.dataUrl}
                                alt={att.name}
                                className="h-20 w-full object-cover"
                              />
                            ) : (
                              <video
                                src={att.dataUrl}
                                controls
                                className="h-20 w-full object-cover"
                              />
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                setAppealAttachments((prev) =>
                                  prev.filter((_, i) => i !== idx),
                                )
                              }
                              className="absolute right-1 top-1 rounded-full bg-red-600 px-1.5 text-xs text-white"
                            >
                              ×
                            </button>
                            <p className="truncate px-1.5 py-0.5 text-[10px] text-slate-500">
                              {att.name}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-slate-700 font-semibold block mb-1">
                      Ghi chú thêm (tùy chọn)
                    </label>
                    <input
                      type="text"
                      value={appealNotes}
                      onChange={(e) => setAppealNotes(e.target.value)}
                      placeholder="VD: Yêu cầu đối soát lại camera tại trạm lúc 14:30..."
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none text-xs focus:border-purple-500 focus:ring-1 focus:ring-purple-200"
                    />
                  </div>
                </div>

                <div className="flex gap-3 justify-end pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setAppealModalCaseId(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSubmitAppeal(c.id)}
                    className="px-4 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold shadow flex items-center gap-1.5 transition-all"
                  >
                    <Scale className="w-4 h-4" />
                    Gửi Đơn Kháng Nghị lên Senior Ops
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      {/* Senior Ops Review Modal (Hàng đợi tái thẩm tra độc lập - Câu 47) */}
      {seniorReviewModalCaseId &&
        (() => {
          const c = cases.find((item) => item.id === seniorReviewModalCaseId);
          if (!c) return null;

          return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-xl space-y-4 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2 text-purple-950 font-bold">
                    <ShieldCheck className="w-5 h-5 text-purple-700" />
                    <span>Hội Đồng Tái Thẩm Tra Độc Lập — Case {c.id}</span>
                  </div>
                  <button
                    onClick={() => setSeniorReviewModalCaseId(null)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Case Summary Review */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                    <p className="font-semibold text-slate-800">
                      Kết luận ban đầu của Ops:
                    </p>
                    <p className="text-slate-600 leading-relaxed">
                      {c.resolution?.summary}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Bên chịu lỗi: <strong>{c.resolution?.faultParty}</strong>
                      {c.resolution?.penaltyLevel &&
                        ` · Chế tài: ${c.resolution.penaltyLevel}`}
                    </p>
                  </div>
                  <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 space-y-1">
                    <p className="font-semibold text-purple-900">
                      Nội dung Đơn Kháng Nghị (
                      {c.appeal?.appellantParty === "PARTY_A"
                        ? "Bên A"
                        : "Bên B"}
                      ):
                    </p>
                    <p className="text-purple-800 leading-relaxed whitespace-pre-line">
                      {c.appeal?.reason || c.appealReason}
                    </p>
                    <p className="text-[11px] text-purple-600">
                      Người nộp: {c.appeal?.appellantName} (
                      {c.appeal?.appellantCompanyName})
                    </p>
                  </div>
                </div>

                {/* Reviewer Evidence if any */}
                {c.appeal?.evidenceFiles &&
                  c.appeal.evidenceFiles.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-slate-700">
                        Bằng chứng mới từ bên kháng nghị:
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {c.appeal.evidenceFiles.map((att) => (
                          <div
                            key={att.id}
                            className="relative overflow-hidden rounded-lg border border-purple-200 bg-white"
                          >
                            {att.kind === "IMAGE" ? (
                              <img
                                src={att.dataUrl}
                                alt={att.name}
                                className="h-20 w-full object-cover"
                              />
                            ) : (
                              <video
                                src={att.dataUrl}
                                controls
                                className="h-20 w-full object-cover"
                              />
                            )}
                            <p className="truncate px-1.5 py-0.5 text-[10px] text-slate-500">
                              {att.name}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                <FormErrorSummary errors={seniorErrors} />

                <div className="space-y-3 text-xs pt-1">
                  <div>
                    <label className="text-slate-800 font-bold block mb-1">
                      Phán quyết của Quản trị viên cấp cao <RequiredMark />
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSeniorVerdict("UPHELD");
                          setWaiveOriginalPenalty(false);
                        }}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          seniorVerdict === "UPHELD"
                            ? "border-slate-800 bg-slate-900 text-white font-bold shadow-sm"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <p className="text-xs font-bold">
                          1. Bác đơn kháng nghị (UPHELD)
                        </p>
                        <p
                          className={`text-[11px] mt-1 ${
                            seniorVerdict === "UPHELD"
                              ? "text-slate-300"
                              : "text-slate-500"
                          }`}
                        >
                          Giữ nguyên quyết định ban đầu và mức phạt.
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSeniorVerdict("OVERTURNED");
                          setWaiveOriginalPenalty(true);
                        }}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          seniorVerdict === "OVERTURNED"
                            ? "border-emerald-600 bg-emerald-600 text-white font-bold shadow-sm"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <p className="text-xs font-bold">
                          2. Chấp thuận kháng nghị (OVERTURNED)
                        </p>
                        <p
                          className={`text-[11px] mt-1 ${
                            seniorVerdict === "OVERTURNED"
                              ? "text-emerald-100"
                              : "text-slate-500"
                          }`}
                        >
                          Hủy phán quyết cũ, gỡ bỏ chế tài và hoàn trả điểm uy
                          tín.
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSeniorVerdict("MODIFIED");
                          setWaiveOriginalPenalty(false);
                        }}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          seniorVerdict === "MODIFIED"
                            ? "border-blue-600 bg-blue-600 text-white font-bold shadow-sm"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <p className="text-xs font-bold">
                          3. Điều chỉnh phán quyết (MODIFIED)
                        </p>
                        <p
                          className={`text-[11px] mt-1 ${
                            seniorVerdict === "MODIFIED"
                              ? "text-blue-100"
                              : "text-slate-500"
                          }`}
                        >
                          Phân bổ lại trách nhiệm, điều chỉnh tỷ lệ lỗi.
                        </p>
                      </button>
                    </div>
                  </div>

                  {seniorVerdict === "OVERTURNED" && (
                    <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-900 space-y-1">
                      <label className="flex items-center gap-2 cursor-pointer font-semibold">
                        <input
                          type="checkbox"
                          checked={waiveOriginalPenalty}
                          onChange={(e) =>
                            setWaiveOriginalPenalty(e.target.checked)
                          }
                          className="rounded text-emerald-600"
                        />
                        <span>
                          Tự động gỡ bỏ chế tài & hoàn trả điểm Trust Score cho
                          bên bị phạt trước đó
                        </span>
                      </label>
                      <p className="text-[11px] text-emerald-700 pl-5">
                        Hệ thống sẽ cộng lại điểm Trust Score bị trừ, gỡ cấm
                        giao dịch và mở lại ưu tiên ghép đôi.
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="text-slate-700 font-semibold block mb-1">
                      Họ tên Quản trị viên cấp cao thẩm định <RequiredMark />
                    </label>
                    <input
                      type="text"
                      value={seniorReviewerName}
                      onChange={(e) => setSeniorReviewerName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none text-xs focus:ring-1 focus:ring-purple-300"
                    />
                  </div>

                  <div>
                    <label className="text-slate-700 font-semibold block mb-1">
                      Lý luận & Biên bản Tái thẩm định Độc lập <RequiredMark />
                    </label>
                    <textarea
                      rows={4}
                      value={seniorNotes}
                      onChange={(e) => {
                        setSeniorErrors({});
                        setSeniorNotes(e.target.value);
                      }}
                      placeholder="Ghi rõ phân tích độc lập các bằng chứng, cơ sở pháp lý/quy tắc hệ thống, lý do chấp thuận hoặc bác đơn kháng nghị..."
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none text-xs resize-none focus:ring-1 focus:ring-purple-300"
                    />
                    <FieldError message={seniorErrors.seniorNotes} />
                  </div>
                </div>

                <div className="flex gap-3 justify-end pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setSeniorReviewModalCaseId(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSeniorReview(c.id)}
                    className="px-4 py-2 rounded-xl bg-purple-900 hover:bg-purple-950 text-white text-xs font-bold shadow flex items-center gap-1.5 transition-all"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    Ban Hành Phán Quyết Cuối Cùng & Đóng Case (CLOSED)
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
    </div>
  );
};
