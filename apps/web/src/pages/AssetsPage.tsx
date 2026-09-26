// ==============================================================================
// ECont AssetsPage - Version 2.0 (Full CRUD & Photo Management)
// Quản lý Container Assets với Create, Read, Update, Delete & Photo Checklist
// ==============================================================================

import React, { useState, useMemo } from "react";
import { useDatabase } from "../context/DatabaseContext";
import { useAuth } from "../context/AuthContext";
import {
  ContainerAsset,
  CreateAssetForm,
  PhysicalStatus,
  PhysicalCondition,
} from "../types";
import { ConditionBadge, PhysicalStatusBadge } from "../components/StatusBadge";
import { formatDateTime, formatRelativeTime, formatVnd } from "../lib/utils";
import {
  Boxes,
  Plus,
  Search,
  AlertTriangle,
  Clock,
  CheckCircle2,
  X,
  Edit2,
  Trash2,
  Lock,
  Unlock,
  Image,
  Package,
  MapPin,
  Calendar,
  Building,
  Info,
  Eye,
  Camera,
  Sparkles,
  UploadCloud,
  RefreshCw,
} from "lucide-react";
import { INITIAL_CARRIERS, INITIAL_DEPOTS } from "../data/mockData";
import { QA_RULES } from "../services/qaRules";
import {
  FieldErrors,
  FieldError,
  FormErrorSummary,
  RequiredMark,
  getFieldErrorClass,
  scrollToFirstFieldError,
} from "../components/FormValidation";
import {
  required,
  validateIsoContainer,
  setError,
} from "../lib/formValidation";
import {
  verifyContainerPhotosWithAI,
  inspectContainerWithAI,
  imageFileToDataUrl,
  ContainerPhotoVerificationResult,
} from "../services/aiService";
import { DateTimeInput } from "../components/DateInput";

export const AssetsPage: React.FC = () => {
  const { assets, addAsset, updateAsset, deleteAsset, offers } = useDatabase();
  const { currentRole, currentCompany, canCreateOffers } = useAuth();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showAddForm, setShowAddForm] = useState(false);
  const [isAiInspecting, setIsAiInspecting] = useState(false);
  const [isAiVerifying, setIsAiVerifying] = useState(false);
  const [inspectionResult, setInspectionResult] = useState<{
    score?: number;
    text: string;
    status: string;
    requiresOpsReview: boolean;
  } | null>(null);
  const [photoVerification, setPhotoVerification] =
    useState<ContainerPhotoVerificationResult | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<ContainerAsset | null>(
    null,
  );
  const [editingAsset, setEditingAsset] = useState<ContainerAsset | null>(null);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [formErrors, setFormErrors] = useState<FieldErrors>({});
  const [editErrors, setEditErrors] = useState<FieldErrors>({});

  // Legacy asset draft state is retained for existing local data migrations.
  const [form, setForm] = useState<Partial<CreateAssetForm>>({
    containerType: "40HC",
    physicalStatus: "EMPTY_AT_YARD",
    declaredCondition: "GOOD",
    carrierId: "CARR-MSK",
    currentLatitude: 10.78,
    currentLongitude: 106.78,
  });
  const [formPhotos, setFormPhotos] = useState<string[]>([]);

  // Edit form state
  const [editForm, setEditForm] = useState<Partial<ContainerAsset>>({});

  const showMsg = (msg: string, isError = false) => {
    if (isError) setErrorMsg(msg);
    else setSuccessMsg(msg);
    setTimeout(() => {
      setErrorMsg("");
      setSuccessMsg("");
    }, 4000);
  };

  const filtered = useMemo(() => {
    let list = assets;
    if (currentRole === "ENTERPRISE_A") {
      list = list.filter((a) => a.currentCustodianId === currentCompany.id);
    } else if (currentRole === "ENTERPRISE_B") {
      list = [];
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (a) =>
          a.containerNumber.toLowerCase().includes(q) ||
          a.currentLocationName.toLowerCase().includes(q) ||
          a.carrierCode.toLowerCase().includes(q),
      );
    }
    if (filterStatus !== "all") {
      list = list.filter((a) => a.physicalStatus === filterStatus);
    }
    return list;
  }, [assets, currentRole, currentCompany.id, search, filterStatus]);

  const clearFormError = (field: string) => {
    setFormErrors((previous) => {
      if (!previous[field]) return previous;
      const next = { ...previous };
      delete next[field];
      return next;
    });
  };

  const clearEditError = (field: string) => {
    setEditErrors((previous) => {
      if (!previous[field]) return previous;
      const next = { ...previous };
      delete next[field];
      return next;
    });
  };

  const validateAssetForm = (): FieldErrors => {
    const errors: FieldErrors = {};
    setError(
      errors,
      "containerNumber",
      validateIsoContainer(form.containerNumber),
    );
    setError(
      errors,
      "currentLocationName",
      required(
        form.currentLocationName,
        "Vui lòng nhập vị trí hiện tại của container.",
      ),
    );
    setError(
      errors,
      "photos",
      formPhotos.length >= QA_RULES.offer.minPhotoCount
        ? undefined
        : `INSPECTION_INCOMPLETE: Vui lòng tải đủ tối thiểu ${QA_RULES.offer.minPhotoCount} ảnh container theo 7 góc bắt buộc (Mặt trước container, Cửa sau container, Vách trái, Vách phải, Bên trong container, Sàn container, Tem số container/CSC plate).`,
    );
    setError(
      errors,
      "edoEvidence",
      required(form.edoEvidenceName, "Vui lòng tải e-DO/hồ sơ tương đương."),
    );
    return errors;
  };

  const runFormPhotoAiCheck = async (
    photos: string[],
    snapshot = form,
  ): Promise<ContainerPhotoVerificationResult | null> => {
    if (photos.length < QA_RULES.offer.minPhotoCount) return null;
    if (
      !snapshot.containerNumber ||
      !snapshot.containerType ||
      !snapshot.declaredCondition
    ) {
      showMsg(
        `Đã đủ ${QA_RULES.offer.minPhotoCount} ảnh. Nhập số container, loại và tình trạng khai báo để AI đối chiếu.`,
        true,
      );
      return null;
    }
    const carrierCode =
      INITIAL_CARRIERS.find((c) => c.id === snapshot.carrierId)?.code ||
      snapshot.carrierId ||
      "";
    setIsAiVerifying(true);
    setPhotoVerification(null);
    const verification = await verifyContainerPhotosWithAI(photos, {
      containerNumber: snapshot.containerNumber.trim().toUpperCase(),
      containerType: snapshot.containerType,
      carrierCode,
      declaredCondition: snapshot.declaredCondition,
    });
    setIsAiVerifying(false);
    setPhotoVerification(verification);
    if (verification.actualConditionNotes) {
      setForm((previous) => ({
        ...previous,
        conditionNotes: verification.actualConditionNotes,
      }));
    }
    if (verification.status === "MISMATCH") {
      const message =
        verification.mismatchDetails.join(" ") || verification.summary;
      const nextErrors = {
        photos: `Ảnh không khớp thông tin đăng ký: ${message}`,
      };
      setFormErrors((previous) => ({ ...previous, ...nextErrors }));
      showMsg(nextErrors.photos, true);
      scrollToFirstFieldError(nextErrors);
    } else if (verification.status === "MANUAL_REVIEW") {
      showMsg(
        `Ảnh đã đủ ${QA_RULES.offer.minPhotoCount} góc; AI chưa kết luận tự động và đã chuyển Ops kiểm tra thủ công.`,
      );
    } else if (verification.status === "MATCHED") {
      showMsg(
        `AI đã đối chiếu đủ ${QA_RULES.offer.minPhotoCount} ảnh và khớp thông tin đăng ký (${verification.score ?? "—"}/100).`,
      );
    }
    return verification;
  };

  const handleAdd = async () => {
    const errors = validateAssetForm();
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      showMsg(Object.values(errors)[0], true);
      scrollToFirstFieldError(errors);
      return;
    }

    const verification = await runFormPhotoAiCheck(formPhotos);
    if (!verification) return;

    if (!verification.success || verification.status === "ERROR") {
      const nextErrors = {
        photos:
          verification.error ||
          verification.summary ||
          "Không thể hoàn tất kiểm tra AI ảnh container.",
      };
      setFormErrors((previous) => ({ ...previous, ...nextErrors }));
      showMsg(nextErrors.photos, true);
      scrollToFirstFieldError(nextErrors);
      return;
    }

    if (verification.status === "MISMATCH") {
      const mismatchMessage =
        verification.mismatchDetails.length > 0
          ? verification.mismatchDetails.join(" ")
          : verification.summary;
      const nextErrors = {
        photos: `Ảnh không khớp thông tin đăng ký: ${mismatchMessage}`,
      };
      setFormErrors((previous) => ({ ...previous, ...nextErrors }));
      showMsg(nextErrors.photos, true);
      scrollToFirstFieldError(nextErrors);
      return;
    }

    const now = new Date().toISOString();
    const result = addAsset({
      containerNumber: form.containerNumber!.trim().toUpperCase(),
      containerType: form.containerType || "40HC",
      carrierId: form.carrierId || "CARR-MSK",
      physicalStatus: form.physicalStatus || "EMPTY_AT_YARD",
      declaredCondition: form.declaredCondition || "GOOD",
      conditionNotes: form.conditionNotes,
      currentLocationName: form.currentLocationName!.trim(),
      currentLatitude: form.currentLatitude || 10.78,
      currentLongitude: form.currentLongitude || 106.78,
      currentDepotReturnId: form.currentDepotReturnId,
      freeTimeDetentionEnd: form.freeTimeDetentionEnd,
      freeTimeSource: form.freeTimeSource,
      photos: formPhotos,
      hasEdoDocument: true,
      edoVerificationStatus: "UNVERIFIED",
      edoEvidenceName: form.edoEvidenceName,
      aiInspection: {
        status: verification.status === "MATCHED" ? "CLEAN" : "ANOMALY",
        score: verification.score,
        condition:
          verification.actualCondition || form.declaredCondition || "GOOD",
        summary: verification.summary,
        details: verification.mismatchDetails,
        requiresOpsReview: verification.requiresOpsReview,
        inspectedAt: now,
      },
    });
    if (result.success) {
      showMsg(
        verification.requiresOpsReview
          ? `${result.message} Ảnh đã nhận đủ nhưng đang chờ Ops kiểm tra thủ công.`
          : result.message,
      );
      setShowAddForm(false);
      setForm({
        containerType: "40HC",
        physicalStatus: "EMPTY_AT_YARD",
        declaredCondition: "GOOD",
        carrierId: "CARR-MSK",
        currentLatitude: 10.78,
        currentLongitude: 106.78,
      });
      setFormPhotos([]);
      setFormErrors({});
      setPhotoVerification(null);
    } else {
      showMsg(result.message, true);
    }
  };

  const handleStartEdit = (asset: ContainerAsset) => {
    if (asset.isLocked) {
      showMsg(
        "Container đang trong giao dịch giữ chỗ, không thể chỉnh sửa.",
        true,
      );
      return;
    }
    setEditingAsset(asset);
    setEditErrors({});
    setEditForm({
      declaredCondition: asset.declaredCondition,
      physicalStatus: asset.physicalStatus,
      currentLocationName: asset.currentLocationName,
      conditionNotes: asset.conditionNotes || "",
      freeTimeDetentionEnd: asset.freeTimeDetentionEnd,
    });
  };

  const handleSaveEdit = () => {
    if (!editingAsset) return;
    const errors: FieldErrors = {};
    setError(
      errors,
      "edit-currentLocationName",
      required(
        editForm.currentLocationName,
        "Vui lòng nhập vị trí hiện tại của container.",
      ),
    );
    if (
      editForm.freeTimeDetentionEnd &&
      new Date(editForm.freeTimeDetentionEnd).getTime() <= Date.now()
    ) {
      errors["edit-freeTimeDetentionEnd"] =
        "Hạn detention phải là thời điểm trong tương lai.";
    }
    setEditErrors(errors);
    if (Object.keys(errors).length > 0) {
      showMsg(Object.values(errors)[0], true);
      scrollToFirstFieldError(errors);
      return;
    }
    const result = updateAsset(editingAsset.id, {
      ...editForm,
      currentLocationName: editForm.currentLocationName!.trim(),
      locationObservedAt: new Date().toISOString(),
    });
    showMsg(result.message, !result.success);
    if (result.success) {
      setEditingAsset(null);
      setEditErrors({});
      if (selectedAsset?.id === editingAsset.id) setSelectedAsset(null);
    }
  };

  const handleDelete = (assetId: string) => {
    if (!confirm("Bạn có chắc muốn xóa container này khỏi danh mục quản lý?"))
      return;
    const result = deleteAsset(assetId);
    showMsg(result.message, !result.success);
    if (result.success) {
      setSelectedAsset(null);
      if (editingAsset?.id === assetId) setEditingAsset(null);
    }
  };

  const handleRealUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    assetId: string,
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const currentPhotos = assets.find((a) => a.id === assetId)?.photos || [];
    if (currentPhotos.length >= 12) {
      e.target.value = "";
      showMsg("Có thể tải tối đa 12 ảnh cho một container.", true);
      return;
    }
    if (currentPhotos.length < QA_RULES.offer.minPhotoCount && files.length > 1) {
      e.target.value = "";
      showMsg(
        `Mỗi bước chỉ được tải 1 ảnh. Hãy hoàn tất ${QA_RULES.offer.minPhotoCount} góc theo đúng thứ tự.`,
        true,
      );
      return;
    }
    const acceptedFiles = Array.from(files)
      .filter(
        (file) =>
          (file.type.startsWith("image/") ||
            /\.(png|jpe?g|webp)$/i.test(file.name)) &&
          file.size <= 10 * 1024 * 1024,
      )
      .slice(0, 12 - currentPhotos.length);
    e.target.value = "";
    if (acceptedFiles.length === 0) {
      showMsg(
        "Chỉ chấp nhận ảnh PNG, JPG hoặc WebP, tối đa 10MB mỗi ảnh.",
        true,
      );
      return;
    }
    Promise.all(acceptedFiles.map((file) => imageFileToDataUrl(file)))
      .then((updatedUrls) => {
        const updated = [...currentPhotos, ...updatedUrls];
        updateAsset(assetId, { photos: updated, aiInspection: undefined });
        if (selectedAsset && selectedAsset.id === assetId) {
          setSelectedAsset({
            ...selectedAsset,
            photos: updated,
            aiInspection: undefined,
          });
        }
        showMsg(`Đã tải lên ${updatedUrls.length} ảnh thực tế thành công.`);
        if (updated.length >= QA_RULES.offer.minPhotoCount)
          void handleAiInspection(assetId, updated);
      })
      .catch(() =>
        showMsg("Không đọc được một hoặc nhiều ảnh container.", true),
      );
  };

  const handleRemoveRealPhoto = (assetId: string, photoIndex: number) => {
    const asset = assets.find((a) => a.id === assetId);
    if (!asset) return;
    if (asset.isLocked) {
      showMsg("Container đang trong giao dịch, không thể xóa ảnh.", true);
      return;
    }
    if (photoIndex !== asset.photos.length - 1) {
      showMsg(
        `Để giữ đúng thứ tự ${QA_RULES.offer.minPhotoCount} góc, chỉ được xóa ảnh vừa tải gần nhất.`,
        true,
      );
      return;
    }
    const updated = asset.photos.filter((_, index) => index !== photoIndex);
    const result = updateAsset(assetId, {
      photos: updated,
      aiInspection: undefined,
    });
    if (result.success) {
      setSelectedAsset(
        selectedAsset?.id === assetId
          ? { ...asset, photos: updated, aiInspection: undefined }
          : selectedAsset,
      );
      setInspectionResult(null);
      showMsg(
        updated.length < QA_RULES.offer.minPhotoCount
          ? `Đã xóa ảnh. Cần bổ sung lại đủ ${QA_RULES.offer.minPhotoCount} góc trước khi AI kiểm tra.`
          : "Đã xóa ảnh cũ. Vui lòng chạy lại AI để cập nhật kết quả.",
      );
    } else showMsg(result.message, true);
  };

  const handleFormPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    if (formPhotos.length >= 12) {
      e.target.value = "";
      showMsg("Có thể tải tối đa 12 ảnh cho một container.", true);
      return;
    }
    if (formPhotos.length < QA_RULES.offer.minPhotoCount && files.length > 1) {
      e.target.value = "";
      showMsg(
        `Mỗi bước chỉ được tải 1 ảnh. Hãy hoàn tất ${QA_RULES.offer.minPhotoCount} góc theo đúng thứ tự.`,
        true,
      );
      return;
    }
    clearFormError("photos");
    setPhotoVerification(null);
    const acceptedFiles = Array.from(files).filter(
      (file) =>
        (file.type.startsWith("image/") ||
          /\.(png|jpe?g|webp)$/i.test(file.name)) &&
        file.size <= 10 * 1024 * 1024,
    );
    if (acceptedFiles.length !== files.length) {
      showMsg("Một số tệp không hợp lệ hoặc vượt quá 10MB đã bị bỏ qua.", true);
    }
    const filesToRead = acceptedFiles.slice(
      0,
      Math.max(0, 12 - formPhotos.length),
    );
    e.target.value = "";
    Promise.all(filesToRead.map((file) => imageFileToDataUrl(file)))
      .then(async (urls) => {
        const nextPhotos = [...formPhotos, ...urls].slice(0, 12);
        setFormPhotos(nextPhotos);
        if (nextPhotos.length >= QA_RULES.offer.minPhotoCount)
          await runFormPhotoAiCheck(nextPhotos);
        else
          showMsg(
            `Đã thêm ảnh. Còn thiếu ${QA_RULES.offer.minPhotoCount - nextPhotos.length} ảnh để AI tự quét.`,
          );
      })
      .catch(() =>
        showMsg("Không đọc được một hoặc nhiều ảnh container.", true),
      );
  };

  const handleRemoveFormPhoto = (index: number) => {
    if (index !== formPhotos.length - 1) {
      showMsg(
        `Để giữ đúng thứ tự ${QA_RULES.offer.minPhotoCount} góc, chỉ được xóa ảnh vừa tải gần nhất.`,
        true,
      );
      return;
    }
    setFormPhotos((previous) =>
      previous.filter((_, photoIndex) => photoIndex !== index),
    );
    setPhotoVerification(null);
  };

  const handleEdoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    clearFormError("edoEvidence");
    const validType =
      file.type === "application/pdf" || file.type.startsWith("image/");
    if (!validType || file.size > 20 * 1024 * 1024) {
      showMsg("e-DO chỉ nhận PDF/ảnh, tối đa 20MB.", true);
      return;
    }
    setForm((p) => ({
      ...p,
      hasEdoDocument: true,
      edoEvidenceName: file.name,
      edoVerificationStatus: "UNVERIFIED",
    }));
    showMsg(`Đã tải e-DO ${file.name}.`);
  };

  const handleAiInspection = async (
    assetId: string,
    photosOverride?: string[],
  ) => {
    const asset = assets.find((a) => a.id === assetId);
    const photos = photosOverride || asset?.photos || [];
    if (!asset || photos.length < QA_RULES.offer.minPhotoCount) {
      showMsg(
        `Cần đủ tối thiểu ${QA_RULES.offer.minPhotoCount} ảnh trước khi chạy AI.`,
        true,
      );
      return;
    }
    setIsAiInspecting(true);
    setInspectionResult(null);

    try {
      const result = await inspectContainerWithAI(photos);

      if (result.success) {
        setInspectionResult({
          score: result.score,
          text: result.summary || "Đã hoàn tất phân tích ảnh",
          status: result.status,
          requiresOpsReview: result.requiresOpsReview,
        });
        const aiInspection = {
          status: result.status,
          score: result.score,
          condition: result.condition,
          summary: result.summary || "Đã hoàn tất phân tích ảnh",
          details: result.details || [],
          requiresOpsReview: result.requiresOpsReview,
          inspectedAt: new Date().toISOString(),
        } as const;
        updateAsset(assetId, { aiInspection });
        setSelectedAsset({ ...asset, photos, aiInspection });

        if (result.requiresOpsReview) {
          showMsg(
            "AI phát hiện dấu hiệu cần xác minh. Đã chuyển hàng đợi Ops kiểm tra thủ công.",
            true,
          );
        } else {
          showMsg(
            `AI không phát hiện bất thường (${result.score ?? "—"}/100). Offer vẫn chờ Ops duyệt.`,
          );
        }
      } else {
        const message = result.error || "Chưa có kết quả giám định tự động.";
        const aiInspection = {
          status: "ERROR" as const,
          score: result.score,
          condition: result.condition,
          summary: message,
          details: result.details || [],
          requiresOpsReview: true,
          inspectedAt: new Date().toISOString(),
        };
        updateAsset(assetId, { aiInspection });
        setInspectionResult({
          score: result.score,
          text: "Chưa có kết quả tự động; đã chuyển Ops kiểm tra",
          status: "ANOMALY",
          requiresOpsReview: true,
        });
        setSelectedAsset({ ...asset, photos, aiInspection });
        showMsg(
          "AI chưa trả kết quả tự động. Container đã được chuyển Ops kiểm tra thủ công.",
        );
      }
    } catch {
      showMsg(
        "AI chưa trả kết quả tự động. Container đã được chuyển Ops kiểm tra thủ công.",
      );
    } finally {
      setIsAiInspecting(false);
    }
  };

  if (currentRole === "ENTERPRISE_B") {
    return (
      <div className="text-center py-16 space-y-3 bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
        <Boxes className="w-12 h-12 text-slate-300 mx-auto" />
        <h3 className="text-lg font-bold text-slate-800">
          Chỉ dành cho Nhà cung cấp Container
        </h3>
        <p className="text-sm text-slate-500">
          Đơn vị Cần vỏ Container không quản lý vỏ trực tiếp. Chuyển sang tab
          "Nhu cầu" để tìm kiếm.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Boxes className="w-6 h-6 text-blue-600" />
            <span>
              {currentRole === "ENTERPRISE_A"
                ? "Danh mục vỏ container"
                : "Quản lý Vỏ Container"}
            </span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {currentRole === "ENTERPRISE_A"
              ? `${filtered.length} container được tạo từ Offer của ${currentCompany.shortName}`
              : `${filtered.length} container trong toàn hệ thống · Ops quản lý hồ sơ tài sản và trạng thái xác minh`}
          </p>
        </div>
      </div>

      {/* Alerts */}
      {successMsg && (
        <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs sm:text-sm font-semibold text-emerald-800">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-xs sm:text-sm font-semibold text-red-800">
          <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
          {errorMsg}
        </div>
      )}

      {/* Add Form Modal/Section */}
      {false && showAddForm && (
        <div className="bg-white border border-blue-200 rounded-2xl p-6 space-y-4 shadow-md">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-bold text-slate-900 flex items-center gap-2 text-sm sm:text-base">
              <Plus className="w-4 h-4 text-blue-600" />
              <span>ĐĂNG KÝ VỎ CONTAINER MỚI</span>
            </h3>
            <button
              onClick={() => setShowAddForm(false)}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <FormErrorSummary errors={formErrors} />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="text-xs sm:text-sm font-semibold text-slate-700 block mb-1">
                Số Container ISO 6346 <RequiredMark />
              </label>
              <input
                id="asset-containerNumber"
                data-field="containerNumber"
                value={form.containerNumber || ""}
                onChange={(e) => {
                  clearFormError("containerNumber");
                  setForm((p) => ({
                    ...p,
                    containerNumber: e.target.value.toUpperCase(),
                  }));
                }}
                placeholder="MSKU1234567"
                aria-invalid={Boolean(formErrors.containerNumber)}
                className={getFieldErrorClass(
                  Boolean(formErrors.containerNumber),
                  "w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-mono uppercase focus:ring-2 focus:ring-blue-500 outline-none",
                )}
              />
              <FieldError message={formErrors.containerNumber} />
            </div>
            <div>
              <label className="text-xs sm:text-sm font-semibold text-slate-700 block mb-1">
                Loại Container
              </label>
              <select
                value={form.containerType}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    containerType: e.target.value as "20GP" | "40HC",
                  }))
                }
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="40HC">40HC (40 foot cao)</option>
                <option value="20GP">20GP (20 foot tiêu chuẩn)</option>
              </select>
            </div>
            <div>
              <label className="text-xs sm:text-sm font-semibold text-slate-700 block mb-1">
                Hãng tàu
              </label>
              <select
                value={form.carrierId}
                onChange={(e) =>
                  setForm((p) => ({ ...p, carrierId: e.target.value }))
                }
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              >
                {INITIAL_CARRIERS.filter((c) => c.isActive).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} · {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs sm:text-sm font-semibold text-slate-700 block mb-1">
                Tình trạng vật lý
              </label>
              <select
                value={form.physicalStatus}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    physicalStatus: e.target.value as PhysicalStatus,
                  }))
                }
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="EMPTY_AT_YARD">
                  Rỗng tại kho (EMPTY_AT_YARD)
                </option>
                <option value="EMPTY_AT_DEPOT">
                  Rỗng tại depot (EMPTY_AT_DEPOT)
                </option>
                <option value="AT_CUSTOMER">
                  Đang tại khách hàng (AT_CUSTOMER)
                </option>
                <option value="IN_TRANSIT">Đang vận chuyển (IN_TRANSIT)</option>
              </select>
            </div>
            <div>
              <label className="text-xs sm:text-sm font-semibold text-slate-700 block mb-1">
                Chất lượng vỏ khai báo
              </label>
              <select
                value={form.declaredCondition}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    declaredCondition: e.target.value as PhysicalCondition,
                  }))
                }
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="GOOD">Đạt chuẩn đóng hàng</option>
                <option value="MINOR_DAMAGE">Hư hỏng nhẹ</option>
                <option value="MAJOR_DAMAGE">Hư hỏng nặng</option>
              </select>
            </div>
            <div>
              <label className="text-xs sm:text-sm font-semibold text-slate-700 block mb-1">
                Vị trí hiện tại <RequiredMark />
              </label>
              <input
                id="asset-currentLocationName"
                data-field="currentLocationName"
                value={form.currentLocationName || ""}
                onChange={(e) => {
                  clearFormError("currentLocationName");
                  setForm((p) => ({
                    ...p,
                    currentLocationName: e.target.value,
                  }));
                }}
                placeholder="Kho CFS Cát Lái, Kho KCN Tân Tạo..."
                aria-invalid={Boolean(formErrors.currentLocationName)}
                className={getFieldErrorClass(
                  Boolean(formErrors.currentLocationName),
                  "w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs focus:ring-2 focus:ring-brand-500 outline-none",
                )}
              />
              <FieldError message={formErrors.currentLocationName} />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Hạn Detention (Hạn lưu vỏ)
              </label>
              <DateTimeInput
                value={form.freeTimeDetentionEnd}
                onChange={(v) =>
                  setForm((p) => ({
                    ...p,
                    freeTimeDetentionEnd: v ? new Date(v).toISOString() : "",
                  }))
                }
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Ghi chú tình trạng vỏ
              </label>
              <input
                value={form.conditionNotes || ""}
                onChange={(e) =>
                  setForm((p) => ({ ...p, conditionNotes: e.target.value }))
                }
                placeholder="Sàn khô sạch, không thủng vách, gioăng cửa nguyên vẹn..."
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs focus:ring-2 focus:ring-brand-500 outline-none"
              />
            </div>
          </div>
          {/* Photo Upload Section */}
          <div
            id="asset-photos"
            data-field="photos"
            className={getFieldErrorClass(
              Boolean(formErrors.photos),
              "col-span-full border-t border-slate-100 pt-4 mt-2",
            )}
          >
            <label className="text-xs sm:text-sm font-semibold text-slate-700 block mb-2 flex items-center gap-2">
              <Camera className="w-4 h-4 text-blue-600" />
              Ảnh tình trạng container ({formPhotos.length}/
              {QA_RULES.offer.minPhotoCount})
            </label>
            <p className="text-xs font-semibold text-red-600 mb-2">
              <RequiredMark /> Bắt buộc tối thiểu {QA_RULES.offer.minPhotoCount} ảnh:
              1. Mặt trước container, 2. Cửa sau container, 3. Vách trái, 4. Vách
              phải, 5. Bên trong container, 6. Sàn container, 7. Tem số
              container/CSC plate.
            </p>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-3">
              {formPhotos.map((url, idx) => (
                <div
                  key={idx}
                  className="relative h-20 rounded-lg overflow-hidden bg-slate-100 border border-slate-200"
                >
                  <img
                    src={url}
                    alt={`Ảnh ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveFormPhoto(idx)}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center text-xs hover:bg-red-600"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            {formPhotos.length < 12 && (
              <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-dashed border-blue-300 bg-blue-50/50 text-blue-700 text-xs sm:text-sm font-semibold cursor-pointer hover:bg-blue-100 transition-colors">
                <UploadCloud className="w-4 h-4" />
                <span>
                  {formPhotos.length < QA_RULES.offer.minPhotoCount
                    ? "Tải ảnh tiếp theo"
                    : "Thêm ảnh container"}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleFormPhotoUpload}
                />
              </label>
            )}
            {formPhotos.length < QA_RULES.offer.minPhotoCount && (
              <p className="text-xs text-emerald-700 mt-1.5 font-semibold">
                Ảnh tiếp theo:{" "}
                {
                  [
                    "Mặt trước container",
                    "Cửa sau container",
                    "Vách trái",
                    "Vách phải",
                    "Bên trong container",
                    "Sàn container",
                    "Tem số container/CSC plate",
                  ][formPhotos.length]
                }
              </p>
            )}
          </div>
          <FieldError message={formErrors.photos} />
          {photoVerification && (
            <div
              className={`mt-2 rounded-xl border px-3 py-2 text-xs ${
                photoVerification!.status === "INSPECTION_INCOMPLETE"
                  ? "border-amber-300 bg-amber-50 text-amber-900"
                  : photoVerification!.status === "MISMATCH" ||
                      photoVerification!.status === "ERROR"
                    ? "border-red-300 bg-red-50 text-red-800"
                    : photoVerification!.status === "MANUAL_REVIEW"
                      ? "border-amber-300 bg-amber-50 text-amber-800"
                      : "border-emerald-300 bg-emerald-50 text-emerald-800"
              }`}
              role="status"
            >
              <p className="font-bold">{photoVerification!.summary}</p>
              {photoVerification!.mismatchDetails.length > 0 && (
                <ul className="mt-1 list-disc pl-4 space-y-0.5">
                  {photoVerification!.mismatchDetails.map((detail, index) => (
                    <li key={index}>{detail}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <div
            id="asset-edoEvidence"
            data-field="edoEvidence"
            className={getFieldErrorClass(
              Boolean(formErrors.edoEvidence),
              "border-t border-slate-100 pt-4",
            )}
          >
            <label className="text-xs sm:text-sm font-semibold text-slate-700 block mb-2">
              e-DO / hồ sơ tương đương <RequiredMark />
            </label>
            <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-dashed border-teal-300 bg-teal-50 text-teal-700 text-xs font-semibold cursor-pointer hover:bg-teal-100">
              <UploadCloud className="w-4 h-4" />
              <span>
                {form.edoEvidenceName || "Tải e-DO lên (PDF/ảnh, tối đa 20MB)"}
              </span>
              <input
                type="file"
                accept="application/pdf,image/*"
                className="hidden"
                onChange={handleEdoUpload}
              />
            </label>
            {form.edoEvidenceName && (
              <p className="text-xs text-amber-700 mt-1">
                Đã nhận file nhưng chưa VERIFIED: Ops phải đối chiếu cont,
                carrier, depot, validity và return deadline.
              </p>
            )}
          </div>
          <p className="text-xs font-semibold text-red-600 mt-1">
            <RequiredMark /> Bắt buộc có e-DO/hồ sơ tương đương
          </p>
          <FieldError message={formErrors.edoEvidence} />
          <div className="flex gap-2 justify-end pt-2">
            <button
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Hủy
            </button>
            <button
              onClick={handleAdd}
              disabled={isAiVerifying}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-60 text-white text-xs font-bold rounded-xl shadow-sm"
            >
              Lưu Container
            </button>
          </div>
        </div>
      )}

      {/* Edit Form Modal */}
      {editingAsset && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-brand-600" />
                <span>
                  CHỈNH SỬA CONTAINER: {editingAsset.containerNumber} (UPDATE)
                </span>
              </h3>
              <button
                onClick={() => setEditingAsset(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-700 font-semibold block mb-1">
                  Vị trí hiện tại <RequiredMark />
                </label>
                <input
                  type="text"
                  id="edit-currentLocationName"
                  data-field="edit-currentLocationName"
                  value={editForm.currentLocationName || ""}
                  onChange={(e) => {
                    clearEditError("edit-currentLocationName");
                    setEditForm((p) => ({
                      ...p,
                      currentLocationName: e.target.value,
                    }));
                  }}
                  aria-invalid={Boolean(editErrors["edit-currentLocationName"])}
                  className={getFieldErrorClass(
                    Boolean(editErrors["edit-currentLocationName"]),
                    "w-full p-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-500",
                  )}
                />
                <FieldError message={editErrors["edit-currentLocationName"]} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 font-semibold block mb-1">
                    Trạng thái vật lý
                  </label>
                  <select
                    value={editForm.physicalStatus}
                    onChange={(e) =>
                      setEditForm((p) => ({
                        ...p,
                        physicalStatus: e.target.value as PhysicalStatus,
                      }))
                    }
                    className="w-full p-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="EMPTY_AT_YARD">Rỗng tại kho</option>
                    <option value="EMPTY_AT_DEPOT">Rỗng tại depot</option>
                    <option value="AT_CUSTOMER">Tại khách hàng</option>
                    <option value="IN_TRANSIT">Đang vận chuyển</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-700 font-semibold block mb-1">
                    Chất lượng khai báo
                  </label>
                  <select
                    value={editForm.declaredCondition}
                    onChange={(e) =>
                      setEditForm((p) => ({
                        ...p,
                        declaredCondition: e.target.value as PhysicalCondition,
                      }))
                    }
                    className="w-full p-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="GOOD">Đạt chuẩn đóng hàng</option>
                    <option value="MINOR_DAMAGE">Hư hỏng nhẹ</option>
                    <option value="MAJOR_DAMAGE">Hư hỏng nặng</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-700 font-semibold block mb-1">
                  Hạn Detention
                </label>
                <DateTimeInput
                  id="edit-freeTimeDetentionEnd"
                  data-field="edit-freeTimeDetentionEnd"
                  value={editForm.freeTimeDetentionEnd}
                  onChange={(v) =>
                    setEditForm((p) => ({
                      ...p,
                      freeTimeDetentionEnd: v ? new Date(v).toISOString() : "",
                    }))
                  }
                  aria-invalid={Boolean(
                    editErrors["edit-freeTimeDetentionEnd"],
                  )}
                  className={getFieldErrorClass(
                    Boolean(editErrors["edit-freeTimeDetentionEnd"]),
                    "w-full p-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-500",
                  )}
                />
                <FieldError message={editErrors["edit-freeTimeDetentionEnd"]} />
              </div>

              <div>
                <label className="text-slate-700 font-semibold block mb-1">
                  Ghi chú tình trạng
                </label>
                <textarea
                  value={editForm.conditionNotes || ""}
                  onChange={(e) =>
                    setEditForm((p) => ({
                      ...p,
                      conditionNotes: e.target.value,
                    }))
                  }
                  rows={2}
                  className="w-full p-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setEditingAsset(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Hủy
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-4 py-2 text-xs font-bold bg-brand-600 hover:bg-brand-500 text-white rounded-xl shadow-sm"
              >
                Cập nhật thông tin
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedAsset && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-slate-900 text-base">
                  {selectedAsset.containerNumber}
                </span>
                <PhysicalStatusBadge
                  status={selectedAsset.physicalStatus}
                  size="xs"
                />
                <ConditionBadge
                  condition={selectedAsset.declaredCondition}
                  size="xs"
                />
              </div>
              <button
                onClick={() => setSelectedAsset(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-700">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl">
                <div>
                  Hãng tàu:{" "}
                  <strong className="text-slate-900">
                    {selectedAsset.carrierCode}
                  </strong>
                </div>
                <div>
                  Loại:{" "}
                  <strong className="text-slate-900">
                    {selectedAsset.containerType}
                  </strong>
                </div>
                <div>
                  Đơn vị quản lý:{" "}
                  <strong>{selectedAsset.currentCustodianName}</strong>
                </div>
                <div>
                  Khóa giữ chỗ:{" "}
                  <strong>
                    {selectedAsset.isLocked
                      ? "Đang khóa (Locked)"
                      : "Tự do (Free)"}
                  </strong>
                </div>
                <div className="col-span-2">
                  Vị trí: <strong>{selectedAsset.currentLocationName}</strong>
                </div>
                {selectedAsset.freeTimeDetentionEnd && (
                  <div className="col-span-2">
                    Hạn Detention:{" "}
                    <strong>
                      {formatDateTime(selectedAsset.freeTimeDetentionEnd)}
                    </strong>
                  </div>
                )}
              </div>

              {/* Photo section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-slate-800">
                    Bộ ảnh tình trạng ({selectedAsset.photos.length}/
                    {QA_RULES.offer.minPhotoCount} tối thiểu)
                  </span>
                  <div className="flex items-center gap-2">
                    <label className="cursor-pointer text-blue-600 hover:underline flex items-center gap-1 font-semibold text-xs">
                      <UploadCloud className="w-3.5 h-3.5" />
                      <span>Tải ảnh từ máy</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleRealUpload(e, selectedAsset.id)}
                      />
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-3">
                  {selectedAsset.photos.map((url, idx) => (
                    <div
                      key={idx}
                      className="relative h-24 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 group"
                    >
                      <img
                        src={url}
                        alt={`Ảnh ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          handleRemoveRealPhoto(selectedAsset.id, idx)
                        }
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-600 text-white text-xs opacity-80 group-hover:opacity-100"
                        title="Xóa ảnh này"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {selectedAsset.photos.length === 0 && (
                    <div className="col-span-3 py-6 text-center text-slate-400 border border-dashed rounded-xl">
                      Chưa có ảnh chụp container
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-slate-500">
                  Tối thiểu {QA_RULES.offer.minPhotoCount} góc: 1. Mặt trước, 2.
                  Cửa sau, 3. Vách trái, 4. Vách phải, 5. Bên trong container, 6.
                  Sàn container, 7. Tem số/CSC plate. Thiếu góc sẽ báo
                  INSPECTION_INCOMPLETE.
                </p>

                {/* AI Inspection Card */}
                <div className="p-3.5 rounded-xl border border-teal-200 bg-teal-50/50 space-y-2 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-teal-900 flex items-center gap-1.5 text-xs sm:text-sm">
                      <Sparkles className="w-4 h-4 text-teal-600" />
                      AI Giám Định Chất Lượng Vỏ Cont (IICL-5)
                    </span>
                    <button
                      type="button"
                      disabled={
                        isAiInspecting ||
                        selectedAsset.photos.length < QA_RULES.offer.minPhotoCount
                      }
                      onClick={() => handleAiInspection(selectedAsset.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold text-white transition-all ${
                        isAiInspecting
                          ? "bg-teal-400 cursor-not-allowed"
                          : selectedAsset.photos.length <
                              QA_RULES.offer.minPhotoCount
                            ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                            : "bg-teal-600 hover:bg-teal-500 shadow-sm"
                      }`}
                    >
                      {isAiInspecting
                        ? "Đang quét AI..."
                        : selectedAsset.photos.length <
                            QA_RULES.offer.minPhotoCount
                          ? `Cần đủ ${QA_RULES.offer.minPhotoCount} ảnh`
                          : "Bắt đầu quét AI"}
                    </button>
                  </div>
                  {inspectionResult && (
                    <div
                      className={`text-xs bg-white/90 p-2.5 rounded-xl border ${inspectionResult.requiresOpsReview ? "border-amber-300 text-amber-900" : "border-teal-200 text-teal-900"}`}
                    >
                      <div className="flex items-center justify-between font-bold">
                        <span>Kết quả: {inspectionResult.text}</span>
                        <span
                          className={`${inspectionResult.requiresOpsReview ? "text-amber-700 bg-amber-100" : "text-emerald-700 bg-emerald-100"} px-2 py-0.5 rounded-md font-mono whitespace-nowrap`}
                        >
                          {inspectionResult.score == null
                            ? "Chờ Ops"
                            : `${inspectionResult.score}/100`}
                        </span>
                      </div>
                    </div>
                  )}
                  {selectedAsset.aiInspection?.condition && (
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-700">
                      <strong>Tình trạng thực tế AI phân loại:</strong>
                      <ConditionBadge
                        condition={selectedAsset.aiInspection.condition}
                        size="xs"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setSelectedAsset(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Đóng
              </button>
              {!selectedAsset.isLocked && (
                <button
                  onClick={() => {
                    const a = selectedAsset;
                    setSelectedAsset(null);
                    handleStartEdit(a);
                  }}
                  className="px-4 py-2 text-xs font-bold bg-brand-600 hover:bg-brand-500 text-white rounded-xl shadow-sm"
                >
                  Sửa Container
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo số container, hãng tàu, vị trí..."
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {[
            "all",
            "EMPTY_AT_YARD",
            "EMPTY_AT_DEPOT",
            "AT_CUSTOMER",
            "IN_TRANSIT",
          ].map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold border transition-colors ${
                filterStatus === s
                  ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {s === "all"
                ? "Tất cả"
                : s === "EMPTY_AT_YARD"
                  ? "Rỗng tại kho"
                  : s === "EMPTY_AT_DEPOT"
                    ? "Rỗng tại depot"
                    : s === "AT_CUSTOMER"
                      ? "Tại KH"
                      : "Đang chuyển"}
            </button>
          ))}
        </div>
      </div>

      {/* Assets Grid Cards */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 space-y-3 bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
          <Boxes className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">
            Không có container nào
          </h3>
          <p className="text-xs sm:text-sm text-slate-500">
            {search
              ? "Không tìm thấy kết quả phù hợp."
              : "Tạo Offer để thêm container vào danh mục quản lý."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((asset) => {
            const myOffer = offers.find(
              (o) =>
                o.assetId === asset.id &&
                [
                  "DRAFT",
                  "UNDER_REVIEW",
                  "AVAILABLE",
                  "HELD",
                  "ALLOCATED",
                ].includes(o.status),
            );
            const detentionEnd = asset.freeTimeDetentionEnd
              ? new Date(asset.freeTimeDetentionEnd).getTime()
              : null;
            const detentionUrgent = detentionEnd
              ? detentionEnd - Date.now() < 48 * 3600000
              : false;
            const detentionExpired = detentionEnd
              ? detentionEnd < Date.now()
              : false;

            return (
              <div
                key={asset.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm transition-all hover:shadow-md overflow-hidden flex flex-col justify-between"
              >
                <div>
                  {/* Photo Header */}
                  <div className="relative h-40 bg-slate-100 overflow-hidden">
                    {asset.photos.length > 0 ? (
                      <img
                        src={asset.photos[0]}
                        alt={asset.containerNumber}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-300">
                        <Camera className="w-8 h-8" />
                      </div>
                    )}
                    <div className="absolute top-2.5 left-2.5 flex gap-1.5 flex-wrap">
                      <ConditionBadge
                        condition={asset.declaredCondition}
                        size="sm"
                      />
                      {asset.isLocked && (
                        <span className="inline-flex items-center gap-1 rounded-full text-xs font-bold px-2.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 shadow-sm">
                          <Lock className="w-3 h-3" /> Đang giữ chỗ
                        </span>
                      )}
                    </div>
                    <span className="absolute bottom-2 right-2 text-xs font-bold bg-slate-900/80 text-white rounded-lg px-2.5 py-1 backdrop-blur-sm">
                      {asset.photos.length}/{QA_RULES.offer.minPhotoCount} tối thiểu
                    </span>
                  </div>

                  {/* Content */}
                  <div className="p-4 space-y-2.5 text-xs sm:text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-bold text-slate-900 font-mono text-base">
                          {asset.containerNumber}
                        </span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-slate-600 font-semibold">
                            {asset.carrierCode} · {asset.containerType}
                          </span>
                          <PhysicalStatusBadge
                            status={asset.physicalStatus}
                            size="sm"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-1.5 text-slate-600">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                      <span className="leading-snug">
                        {asset.currentLocationName}
                      </span>
                    </div>

                    {asset.freeTimeDetentionEnd && (
                      <div
                        className={`flex items-center gap-1.5 ${
                          detentionExpired
                            ? "text-red-600 font-semibold"
                            : detentionUrgent
                              ? "text-amber-600 font-semibold"
                              : "text-slate-500"
                        }`}
                      >
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          {detentionExpired
                            ? "⛔ Hết hạn lưu vỏ"
                            : detentionUrgent
                              ? `⚠️ Hạn còn: ${formatRelativeTime(asset.freeTimeDetentionEnd)}`
                              : `Hạn: ${formatRelativeTime(asset.freeTimeDetentionEnd)}`}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Actions (Full CRUD) */}
                <div className="p-3.5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-2">
                  <button
                    onClick={() => setSelectedAsset(asset)}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs sm:text-sm font-semibold flex items-center gap-1.5 shadow-sm"
                  >
                    <Eye className="w-3.5 h-3.5 text-slate-500" />
                    <span>Chi tiết</span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    {!asset.isLocked && canCreateOffers && (
                      <>
                        <button
                          onClick={() => handleStartEdit(asset)}
                          className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 shadow-sm"
                          title="Sửa thông tin"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(asset.id)}
                          className="p-2 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 shadow-sm"
                          title="Xóa container"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
