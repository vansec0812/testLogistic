// ==============================================================================
// ECont OffersPage - Version 2.0 (Chuẩn hóa quy trình tạo Offer & Bảo mật đối tác)
// ==============================================================================

import React, { useState, useMemo } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { useAuth } from '../context/AuthContext';
import { Offer, CreateOfferForm, PhysicalCondition, OfferAiCheckResult } from '../types';
import { OfferStatusBadge, ConditionBadge } from '../components/StatusBadge';
import { DateInput } from '../components/DateInput';
import { formatVnd, formatRelativeTime } from '../lib/utils';
import {
  PackageOpen, Plus, Search, AlertTriangle, CheckCircle2, X,
  Edit2, Trash2, Send, Clock, MapPin, Camera, Building,
  ChevronDown, ChevronUp, AlertCircle, Shield, Sparkles,
  UploadCloud, FileText, Check, ArrowRight
} from 'lucide-react';
import { INITIAL_CARRIERS, INITIAL_DEPOTS } from '../data/mockData';
import {
  verifyContainerPhotosWithAI,
  verifyEdoWithAI,
  imageFileToDataUrl,
  ContainerPhotoVerificationResult,
  EdoVerificationResult,
} from '../services/aiService';
import {
  FieldErrors, FieldError, FormErrorSummary, RequiredMark,
  getFieldErrorClass, scrollToFirstFieldError
} from '../components/FormValidation';
import {
  required, validDateRange, validFutureDate,
  setError, validateIsoContainer
} from '../lib/formValidation';
import { DEFAULT_BASELINE_DEPOT_COST_VND, OFFER_PHOTO_ANGLE_LABELS } from '../services/qaRules';

interface OffersPageProps {
  setCurrentTab?: (tab: string) => void;
  setSelectedTxnId?: (id: string) => void;
}

const POPULAR_LOCATIONS = [
  { name: 'Cảng Tân Cảng Cát Lái (TP.HCM)', lat: 10.7584, lon: 106.7932 },
  { name: 'ICD Transimex Thủ Đức (TP.HCM)', lat: 10.8285, lon: 106.7725 },
  { name: 'Depot Tân Cảng Suối Tiên (TP.HCM)', lat: 10.8654, lon: 106.8041 },
  { name: 'KCN Sóng Thần 1 (Dĩ An, Bình Dương)', lat: 10.9015, lon: 106.7582 },
  { name: 'KCN Tân Tạo (Bình Tân, TP.HCM)', lat: 10.7421, lon: 106.5812 },
  { name: 'Cảng Đình Vũ (Hải Phòng)', lat: 20.8521, lon: 106.7412 },
];

const REQUIRED_OFFER_PHOTO_COUNT = OFFER_PHOTO_ANGLE_LABELS.length;
const MAX_OFFER_PHOTO_COUNT = 12;

function formatDateTimeDdMmYyyy(value: string): string {
  if (!value) return '—';
  const isoDate = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
  if (isoDate) {
    const dateLabel = `${isoDate[3]}/${isoDate[2]}/${isoDate[1]}`;
    return dateLabel;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Thời gian không hợp lệ';
  const pad = (number: number) => String(number).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

function formatDateInput(value?: string): string {
  if (!value) return '';
  const isoDate = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDate) return `${isoDate[1]}-${isoDate[2]}-${isoDate[3]}`;
  const displayDate = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (displayDate) return `${displayDate[3]}-${displayDate[2]}-${displayDate[1]}`;
  return value;
}

function parseDateInput(value: string, endOfDay = false): string {
  const normalized = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return `${normalized}T${endOfDay ? '23:59:59' : '00:00:00'}`;
  const date = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return date ? `${date[3]}-${date[2]}-${date[1]}T${endOfDay ? '23:59:59' : '00:00:00'}` : normalized;
}

function toDateTimeLocal(value?: string): string {
  return formatDateInput(value);
}

function conditionLabel(condition?: PhysicalCondition): string {
  if (condition === 'GOOD') return 'Mới/đạt chuẩn đóng hàng';
  if (condition === 'MINOR_DAMAGE') return 'Đã qua sử dụng hoặc xước/hư hỏng nhẹ';
  if (condition === 'MAJOR_DAMAGE') return 'Hư hỏng nặng, cần xử lý';
  return 'Chưa có kết luận';
}

export const OffersPage: React.FC<OffersPageProps> = ({ setCurrentTab, setSelectedTxnId }) => {
  const { 
    companies, offers, assets, requests, matches, 
    addOffer, updateOffer, deleteOffer, submitOfferForReview, 
    withdrawOffer, opsReviewOffer, acceptMatch, rejectMatch 
  } = useDatabase();
  const { currentRole, currentCompany, canOpsReview } = useAuth();
  const isSupplierRole = currentRole === 'ENTERPRISE_A' || currentRole === 'ENTERPRISE_BOTH';
  const isCompanyVerified = (companies.find(c => c.id === currentCompany.id)?.verificationStatus || currentCompany.verificationStatus) === 'VERIFIED';
  
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [editingOffer, setEditingOffer] = useState<Offer | null>(null);
  const [editForm, setEditForm] = useState<Partial<Offer>>({});
  const [editOfferErrors, setEditOfferErrors] = useState<FieldErrors>({});
  const [editPhotoAiChecking, setEditPhotoAiChecking] = useState(false);
  const [editPhotoAiResult, setEditPhotoAiResult] = useState<ContainerPhotoVerificationResult | null>(null);
  const [opsNotes, setOpsNotes] = useState('');
  const [opsErrors, setOpsErrors] = useState<FieldErrors>({});
  const [withdrawReason, setWithdrawReason] = useState('');
  const [withdrawId, setWithdrawId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [formErrors, setFormErrors] = useState<FieldErrors>({});
  const [withdrawErrors, setWithdrawErrors] = useState<FieldErrors>({});
  const [edoFile, setEdoFile] = useState<File | null>(null);
  const [edoVerification, setEdoVerification] = useState<EdoVerificationResult | null>(null);
  const [isEdoAiChecking, setIsEdoAiChecking] = useState(false);

  const clearFormError = (field: string) => {
    setFormErrors(prev => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const invalidateAiCheck = () => {
    setAiCheckResult(null);
    setPhotoAiResult(null);
  };

  // AI Inspection state in Add Form
  const [isAiChecking, setIsAiChecking] = useState(false);
  const [aiCheckResult, setAiCheckResult] = useState<{
    score: number;
    summary: string;
    hasAnomaly: boolean;
    details?: string[];
    edoValid: boolean;
    edoAnomaly: boolean;
    photoChecked: boolean;
    photoStatus: ContainerPhotoVerificationResult['status'];
    photoCondition?: PhysicalCondition;
    photoConditionNotes?: string;
    verificationStatus: EdoVerificationResult['status'] | 'ERROR';
  } | null>(null);
  const [photoAiResult, setPhotoAiResult] = useState<ContainerPhotoVerificationResult | null>(null);

  // Form đăng Offer của nhà cung cấp Container
  const [form, setForm] = useState<{
    assetId?: string;
    containerNumber: string;
    containerType: '20GP' | '40HC' | '';
    carrierId: string;
    declaredCondition: PhysicalCondition | '';
    conditionNotes: string;
    photos: string[];
    edoFileName: string;
    edoNumber: string;
    edoReturnDepot: string;
    edoExpiryDate: string;
    pickupLocationName: string;
    pickupLatitude: number;
    pickupLongitude: number;
    availableFrom: string;
    availableTo: string;
    expectedDepotId?: string;
    baselineDepotCostVnd?: number;
    vehicleRequirements?: string;
  }>({
    containerNumber: '',
    containerType: '',
    carrierId: '',
    declaredCondition: '',
    conditionNotes: '',
    photos: [],
    edoFileName: '',
    edoNumber: '',
    edoReturnDepot: '',
    edoExpiryDate: '',
    pickupLocationName: '',
    pickupLatitude: 0,
    pickupLongitude: 0,
    availableFrom: '',
    availableTo: '',
    baselineDepotCostVnd: undefined,
    vehicleRequirements: '',
  });

  const showMsg = (msg: string, isError = false) => {
    if (isError) setErrorMsg(msg);
    else setSuccessMsg(msg);
    setTimeout(() => { setErrorMsg(''); setSuccessMsg(''); }, 5000);
  };

  // Lọc danh sách Offer
  const filtered = useMemo(() => {
    let list = offers;
    if (currentRole === 'ENTERPRISE_A' || currentRole === 'ENTERPRISE_BOTH') {
      list = list.filter(o => o.companyId === currentCompany.id);
    }
    if (currentRole === 'ENTERPRISE_B') {
      list = list.filter(o => o.status === 'AVAILABLE');
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(o =>
        o.id.toLowerCase().includes(q) ||
        ((currentRole === 'ENTERPRISE_A' || currentRole === 'ENTERPRISE_BOTH') && o.asset.containerNumber.toLowerCase().includes(q)) ||
        o.asset.carrierCode.toLowerCase().includes(q) ||
        o.pickupLocationName.toLowerCase().includes(q)
      );
    }
    if (filterStatus !== 'all') {
      list = list.filter(o => o.status === filterStatus);
    }
    return list;
  }, [offers, currentRole, currentCompany.id, search, filterStatus]);

  const handleEdoFileSelection = async (file: File) => {
    setAiCheckResult(null);
    setEdoFile(file);
    setEdoVerification(null);
    setForm(previous => ({ ...previous, edoFileName: file.name }));
    clearFormError('edoEvidence');
    setIsEdoAiChecking(true);
    const verification = await verifyEdoWithAI(file);
    setEdoVerification(verification);
    setIsEdoAiChecking(false);
    if (verification.status === 'VALID') {
      showMsg('✓ AI xác minh file eDO hợp lệ.');
    } else if (verification.status === 'MANUAL_REVIEW') {
      showMsg(`AI chưa thể kết luận eDO: ${verification.error || verification.summary}`);
    } else {
      showMsg(`⚠️ eDO có kết quả ${verification.status === 'INVALID' ? 'không hợp lệ' : 'bất thường'}: ${verification.anomalyReason || verification.summary}`, true);
    }
  };

  // Xử lý tải ảnh từ máy tính (Chỉ nhận tệp hình ảnh)
  const runOfferPhotoAiCheck = async (photos: string[], snapshot = form): Promise<ContainerPhotoVerificationResult | null> => {
    if (photos.length < 6) return null;
    if (!snapshot.containerNumber.trim() || !snapshot.containerType || !snapshot.carrierId || !snapshot.declaredCondition) {
      showMsg('Đã đủ 6 ảnh. Nhập đủ số cont, loại, hãng tàu và tình trạng khai báo để AI đối chiếu.', true);
      return null;
    }
    setIsAiChecking(true);
    const result = await verifyContainerPhotosWithAI(photos, {
      containerNumber: snapshot.containerNumber.trim().toUpperCase(),
      containerType: snapshot.containerType as '20GP' | '40HC',
      carrierCode: INITIAL_CARRIERS.find(c => c.id === snapshot.carrierId)?.code || snapshot.carrierId,
      declaredCondition: snapshot.declaredCondition as PhysicalCondition,
    });
    setIsAiChecking(false);
    setPhotoAiResult(result);
    if (result.actualConditionNotes) {
      setForm(previous => ({ ...previous, conditionNotes: result.actualConditionNotes || previous.conditionNotes }));
      clearFormError('conditionNotes');
    }
    if (result.status === 'MISMATCH') {
      const nextErrors = { photos: `Ảnh không khớp thông tin đăng ký: ${result.mismatchDetails.join(' ') || result.summary}` };
      setFormErrors(previous => ({ ...previous, ...nextErrors }));
      showMsg(nextErrors.photos, true);
      scrollToFirstFieldError(nextErrors);
    } else if (result.status === 'MANUAL_REVIEW') {
      showMsg('AI đã nhận đủ 6 ảnh nhưng chưa kết luận tự động; ảnh được chuyển Ops kiểm tra thủ công.');
    } else if (result.status === 'MATCHED') {
      showMsg(`AI đã đối chiếu ảnh khớp thông tin đăng ký (${result.score ?? '—'}/100).`);
    } else if (result.status === 'ERROR') {
      showMsg(result.error || result.summary, true);
    }
    return result;
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    if (form.photos.length >= MAX_OFFER_PHOTO_COUNT) {
      e.target.value = '';
      showMsg(`Có thể tải tối đa ${MAX_OFFER_PHOTO_COUNT} ảnh cho một Offer.`, true);
      return;
    }
    if (form.photos.length < REQUIRED_OFFER_PHOTO_COUNT && files.length > 1) {
      e.target.value = '';
      showMsg('Mỗi bước chỉ được tải 1 ảnh. Hãy hoàn tất ảnh theo đúng thứ tự trước khi sang bước tiếp theo.', true);
      return;
    }
    clearFormError('photos');
    invalidateAiCheck();

    const imageFiles = Array.from(files).filter(file =>
      (file.type.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(file.name))
      && file.size <= 10 * 1024 * 1024,
    );
    if (imageFiles.length === 0) {
      showMsg('Chỉ chấp nhận ảnh PNG, JPG hoặc WebP, tối đa 10MB mỗi ảnh.', true);
      return;
    }
    if (imageFiles.length < files.length) {
      showMsg('Một số tệp không hợp lệ hoặc vượt quá 10MB đã bị bỏ qua.', true);
    }
    e.target.value = '';
    const filesToRead = imageFiles.slice(0, MAX_OFFER_PHOTO_COUNT - form.photos.length);
    if (filesToRead.length < imageFiles.length) showMsg(`Chỉ nhận tối đa ${MAX_OFFER_PHOTO_COUNT} ảnh cho một Offer.`, true);
    Promise.all(filesToRead.map(file => imageFileToDataUrl(file))).then(async urls => {
      const nextPhotos = [...form.photos, ...urls];
      const nextForm = { ...form, photos: nextPhotos };
      setForm(nextForm);
      if (nextPhotos.length >= 6) await runOfferPhotoAiCheck(nextPhotos, nextForm);
      else showMsg(`Đã thêm ảnh. Còn thiếu ${6 - nextPhotos.length} ảnh để AI tự quét.`);
    }).catch(() => showMsg('Không đọc được một hoặc nhiều ảnh container.', true));
  };

  const handleRemoveOfferPhoto = (index: number) => {
    if (index !== form.photos.length - 1) {
      showMsg('Để giữ đúng thứ tự ảnh, chỉ được xóa ảnh vừa tải gần nhất.', true);
      return;
    }
    invalidateAiCheck();
    setForm(previous => ({ ...previous, photos: previous.photos.filter((_, photoIndex) => photoIndex !== index) }));
  };

  // AI kiểm tra eDO hợp pháp/bất thường và đối chiếu tình trạng thực tế của 6 ảnh
  const handleRunAiPreCheck = async () => {
    const precheckErrors: FieldErrors = {};
    if (form.photos.length < 6) {
      precheckErrors.photos = 'Vui lòng tải đủ tối thiểu 6 ảnh container trước khi chạy AI.';
    }
    if (!edoFile) {
      precheckErrors.edoEvidence = 'Vui lòng tải file eDO gốc để AI xác minh tính hợp pháp.';
    }
    if (!form.containerNumber.trim()) precheckErrors.containerNumber = 'Cần có số container trước khi đối chiếu ảnh.';
    if (!form.containerType) precheckErrors.containerType = 'Cần chọn loại container trước khi đối chiếu ảnh.';
    if (!form.carrierId) precheckErrors.carrierId = 'Cần chọn hãng tàu trước khi đối chiếu ảnh.';
    if (!form.declaredCondition) precheckErrors.declaredCondition = 'Cần chọn tình trạng khai báo trước khi đối chiếu ảnh.';
    if (Object.keys(precheckErrors).length > 0) {
      setFormErrors(previous => ({ ...previous, ...precheckErrors }));
      showMsg(Object.values(precheckErrors)[0], true);
      scrollToFirstFieldError(precheckErrors);
      return;
    }
    setIsAiChecking(true);
    setAiCheckResult(null);
    clearFormError('aiCheck');

    try {
      const [edoResult, photoResult] = await Promise.all([
        edoVerification && !edoVerification.error ? edoVerification : verifyEdoWithAI(edoFile!),
        verifyContainerPhotosWithAI(form.photos, {
          containerNumber: form.containerNumber.trim().toUpperCase(),
          containerType: form.containerType as '20GP' | '40HC',
          carrierCode: INITIAL_CARRIERS.find(c => c.id === form.carrierId)?.code || form.carrierId,
          declaredCondition: form.declaredCondition as PhysicalCondition,
        }),
      ]);
      const hasAnomaly = edoResult.hasAnomaly || edoResult.status !== 'VALID' || photoResult.status !== 'MATCHED';
      const details = [
        ...edoResult.details,
        ...photoResult.mismatchDetails,
        ...(photoResult.actualConditionNotes ? [photoResult.actualConditionNotes] : []),
      ].filter(Boolean);
      const generatedConditionNotes = [
        photoResult.actualCondition ? `Tình trạng thực tế qua ảnh: ${conditionLabel(photoResult.actualCondition)}.` : '',
        photoResult.actualConditionNotes || photoResult.summary,
        photoResult.mismatchDetails.length > 0 ? `Chênh lệch cần lưu ý: ${photoResult.mismatchDetails.join(' ')}` : '',
      ].filter(Boolean).join(' ');
      if (generatedConditionNotes) {
        setForm(previous => ({ ...previous, conditionNotes: generatedConditionNotes }));
        clearFormError('conditionNotes');
      }
      setAiCheckResult({
        score: Math.round(edoResult.score || photoResult.score || 0),
        summary: `eDO: ${edoResult.summary} Ảnh: ${photoResult.summary}`,
        hasAnomaly,
        details,
        edoValid: edoResult.isLegal,
        edoAnomaly: edoResult.hasAnomaly,
        photoChecked: photoResult.status !== 'ERROR',
        photoStatus: photoResult.status,
        photoCondition: photoResult.actualCondition,
        photoConditionNotes: photoResult.actualConditionNotes,
        verificationStatus: edoResult.status,
      });

      if (photoResult.status === 'MISMATCH') {
        const nextErrors = { photos: `Ảnh không khớp thông tin đăng ký: ${photoResult.mismatchDetails.join(' ') || photoResult.summary}` };
        setFormErrors(previous => ({ ...previous, ...nextErrors }));
        showMsg(nextErrors.photos, true);
        scrollToFirstFieldError(nextErrors);
      } else if (edoResult.status === 'INVALID') {
        showMsg(`⚠️ eDO có kết quả không hợp pháp/bất thường: ${edoResult.anomalyReason || edoResult.summary} Offer vẫn được chuyển Ops cảnh báo, chưa thể publish.`, true);
      } else if (hasAnomaly) {
        showMsg('⚠️ AI phát hiện điểm cần Ops kiểm tra. Offer chỉ được publish sau khi Ops duyệt.');
      } else {
        showMsg('✓ eDO hợp lệ và ảnh container khớp thông tin đăng ký. Hồ sơ sẵn sàng gửi Ops.');
      }
    } catch (error: any) {
      const message = error?.message || 'Không thể hoàn tất kiểm tra AI.';
      setFormErrors(previous => ({ ...previous, aiCheck: message }));
      showMsg(message, true);
      scrollToFirstFieldError({ aiCheck: message });
    } finally {
      setIsAiChecking(false);
    }
  };

  // Validate form tạo Offer đầy đủ
  const validateOfferForm = (): FieldErrors => {
    const errors: FieldErrors = {};
    setError(errors, 'containerNumber', validateIsoContainer(form.containerNumber));
    setError(errors, 'containerType', required(form.containerType, 'Vui lòng chọn loại container.'));
    setError(errors, 'carrierId', required(form.carrierId, 'Vui lòng chọn hãng tàu quản lý.'));
    setError(errors, 'pickupLocationName', required(form.pickupLocationName, 'Vui lòng nhập vị trí lấy vỏ container.'));
    setError(errors, 'availableFrom', validFutureDate(form.availableFrom, 'thời gian bắt đầu bàn giao'));
    setError(errors, 'availableTo', validDateRange(form.availableFrom, form.availableTo, 'thời gian bàn giao'));
    setError(errors, 'declaredCondition', required(form.declaredCondition, 'Vui lòng chọn tình trạng vỏ container.'));
    setError(errors, 'conditionNotes', required(form.conditionNotes, 'Vui lòng nhập mô tả chi tiết tình trạng vỏ cont.'));
    if (form.photos.length < 6) errors.photos = 'Vui lòng tải đủ tối thiểu 6 ảnh container (6 góc IICL-5).';
    setError(errors, 'edoEvidence', required(edoFile, 'Vui lòng tải file eDO gốc để Ops và AI xác minh.'));
    // AI là lớp hỗ trợ cho Ops, không phải điều kiện chặn việc gửi hồ sơ.
    // Khi AI chưa có kết quả, lỗi hoặc phát hiện bất thường, Offer vẫn được
    // chuyển sang Ops để kiểm tra thủ công và quyết định.
    return errors;
  };

  // Xử lý tạo Offer
  const handleCreateOfferSubmit = () => {
    const errors = validateOfferForm();
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      showMsg(Object.values(errors)[0], true);
      scrollToFirstFieldError(errors);
      return;
    }

    // Lưu cả kết quả AI chạy tự động sau khi đủ 6 ảnh, kể cả khi người dùng
    // chưa bấm lại nút kiểm tra tổng hợp eDO + ảnh.
    const persistedAiResult = aiCheckResult || ((edoVerification || photoAiResult) ? {
      score: Math.round(edoVerification?.score || photoAiResult?.score || 0),
      summary: [
        edoVerification ? `eDO: ${edoVerification.summary}` : '',
        photoAiResult ? `Ảnh: ${photoAiResult.summary}` : '',
      ].filter(Boolean).join(' '),
      hasAnomaly: Boolean(edoVerification?.hasAnomaly || (photoAiResult && photoAiResult.status !== 'MATCHED')),
      details: [
        ...(edoVerification?.details || []),
        ...(photoAiResult?.mismatchDetails || []),
        ...(photoAiResult?.actualConditionNotes ? [photoAiResult.actualConditionNotes] : []),
      ],
      edoValid: Boolean(edoVerification?.status === 'VALID' && edoVerification.isLegal),
      edoAnomaly: Boolean(edoVerification?.hasAnomaly),
      photoChecked: Boolean(photoAiResult && photoAiResult.status !== 'ERROR'),
      photoStatus: photoAiResult?.status || 'MANUAL_REVIEW' as const,
      photoCondition: photoAiResult?.actualCondition,
      photoConditionNotes: photoAiResult?.actualConditionNotes,
      verificationStatus: edoVerification?.status || 'MANUAL_REVIEW' as const,
    } : null);

    const result = addOffer({
      containerNumber: form.containerNumber.trim().toUpperCase(),
      containerType: form.containerType as '20GP' | '40HC',
      carrierId: form.carrierId,
      declaredCondition: form.declaredCondition as PhysicalCondition,
      conditionNotes: form.conditionNotes.trim(),
      photos: form.photos,
      edoFileName: form.edoFileName,
      edoNumber: form.edoNumber,
      edoReturnDepot: form.edoReturnDepot,
      edoExpiryDate: form.edoExpiryDate,
      pickupLocationName: form.pickupLocationName.trim(),
      pickupLatitude: form.pickupLatitude,
      pickupLongitude: form.pickupLongitude,
      availableFrom: new Date(form.availableFrom).toISOString(),
      availableTo: new Date(form.availableTo).toISOString(),
      expectedDepotId: form.expectedDepotId,
      baselineDepotCostVnd: DEFAULT_BASELINE_DEPOT_COST_VND,
      vehicleRequirements: form.vehicleRequirements?.trim(),
      aiCheck: persistedAiResult ? {
        passed: !persistedAiResult.hasAnomaly && persistedAiResult.edoValid && persistedAiResult.photoStatus === 'MATCHED',
        score: persistedAiResult.score,
        summary: persistedAiResult.summary,
        hasAnomaly: persistedAiResult.hasAnomaly,
        anomalyReason: persistedAiResult.verificationStatus === 'ANOMALY' ? persistedAiResult.summary : undefined,
        edoChecked: Boolean(edoVerification),
        edoValid: persistedAiResult.edoValid,
        edoAnomaly: persistedAiResult.edoAnomaly,
        photoChecked: persistedAiResult.photoChecked,
        photoCondition: persistedAiResult.photoCondition,
        photoConditionNotes: persistedAiResult.photoConditionNotes,
        verificationStatus: persistedAiResult.verificationStatus === 'VALID' && persistedAiResult.photoStatus === 'MATCHED' ? 'VERIFIED' : persistedAiResult.verificationStatus === 'INVALID' ? 'INVALID' : 'MANUAL_REVIEW',
        details: persistedAiResult.details,
      } : undefined,
      requiresOpsManualReview: !persistedAiResult
        || persistedAiResult.hasAnomaly
        || persistedAiResult.photoStatus !== 'MATCHED'
        || persistedAiResult.verificationStatus !== 'VALID',
    });

    if (result.success) {
      showMsg(result.message);
      setShowAddForm(false);
      setAiCheckResult(null);
      setFormErrors({});
      setForm(p => ({
        ...p,
        containerNumber: '',
        containerType: '',
        carrierId: '',
        declaredCondition: '',
        conditionNotes: '',
        edoNumber: '',
        edoFileName: '',
        edoReturnDepot: '',
        edoExpiryDate: '',
        photos: [],
        pickupLocationName: '',
        pickupLatitude: 0,
        pickupLongitude: 0,
        availableFrom: '',
        availableTo: '',
        baselineDepotCostVnd: undefined,
        vehicleRequirements: '',
      }));
      setEdoFile(null);
      setEdoVerification(null);
      setIsEdoAiChecking(false);
    } else {
      showMsg(result.message, true);
    }
  };

  const handleStartEditOffer = (offer: Offer) => {
    if (!isSupplierRole) return;
    if (['HELD', 'ALLOCATED', 'FULFILLED'].includes(offer.status)) {
      showMsg(`Offer đang ở trạng thái ${offer.status}, không thể chỉnh sửa.`, true);
      return;
    }
    setEditingOffer(offer);
    setEditForm({
      photoUrls: [...offer.photoUrls],
      conditionNotes: offer.conditionNotes || offer.asset.conditionNotes || '',
      pickupLocationName: offer.pickupLocationName,
      pickupLatitude: offer.pickupLatitude,
      pickupLongitude: offer.pickupLongitude,
      availableFrom: toDateTimeLocal(offer.availableFrom),
      availableTo: toDateTimeLocal(offer.availableTo),
      baselineDepotCostVnd: offer.baselineDepotCostVnd,
      vehicleRequirements: offer.vehicleRequirements || '',
    });
    setEditOfferErrors({});
    setEditPhotoAiResult(null);
  };

  const runEditPhotoAiCheck = async (
    photos: string[],
  ): Promise<ContainerPhotoVerificationResult | null> => {
    if (!editingOffer || photos.length < 6) return null;
    setEditPhotoAiChecking(true);
    setEditPhotoAiResult(null);
    try {
      const result = await verifyContainerPhotosWithAI(photos, {
        containerNumber: editingOffer.asset.containerNumber,
        containerType: editingOffer.asset.containerType,
        carrierCode: editingOffer.asset.carrierCode,
        declaredCondition: editingOffer.asset.declaredCondition,
      });
      setEditPhotoAiResult(result);
      if (result.actualConditionNotes) {
        setEditForm(previous => ({
          ...previous,
          conditionNotes: result.actualConditionNotes || previous.conditionNotes,
        }));
        setEditOfferErrors(previous => {
          const next = { ...previous };
          delete next.editConditionNotes;
          return next;
        });
      }
      if (result.status === 'MISMATCH') {
        const message = `Ảnh mới không khớp thông tin đăng ký: ${result.mismatchDetails.join(' ') || result.summary}`;
        const nextErrors = { editPhotoUrls: message };
        setEditOfferErrors(previous => ({ ...previous, ...nextErrors }));
        showMsg(message, true);
        scrollToFirstFieldError(nextErrors);
      } else if (result.status === 'MANUAL_REVIEW') {
        showMsg('AI đã nhận đủ ảnh mới nhưng chưa kết luận tự động; bộ ảnh sẽ được Ops kiểm tra thủ công.');
      } else if (result.status === 'MATCHED') {
        showMsg(`AI đã đối chiếu bộ ảnh mới khớp thông tin (${result.score ?? '—'}/100).`);
        setEditOfferErrors(previous => {
          const next = { ...previous };
          delete next.editPhotoUrls;
          return next;
        });
      } else {
        const message = result.error || result.summary || 'AI chưa kiểm tra được bộ ảnh mới.';
        const nextErrors = { editPhotoUrls: message };
        setEditOfferErrors(previous => ({ ...previous, ...nextErrors }));
        showMsg(message, true);
        scrollToFirstFieldError(nextErrors);
      }
      return result;
    } catch (error: any) {
      const message = error?.message || 'Không thể kiểm tra AI bộ ảnh mới.';
      const nextErrors = { editPhotoUrls: message };
      setEditOfferErrors(previous => ({ ...previous, ...nextErrors }));
      showMsg(message, true);
      scrollToFirstFieldError(nextErrors);
      return null;
    } finally {
      setEditPhotoAiChecking(false);
    }
  };

  const handleEditPhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    const currentPhotos = editForm.photoUrls || [];
    if (currentPhotos.length >= MAX_OFFER_PHOTO_COUNT) {
      event.target.value = '';
      showMsg(`Có thể tải tối đa ${MAX_OFFER_PHOTO_COUNT} ảnh cho một Offer.`, true);
      return;
    }
    if (currentPhotos.length < REQUIRED_OFFER_PHOTO_COUNT && files.length > 1) {
      event.target.value = '';
      showMsg('Mỗi bước chỉ được tải 1 ảnh. Hãy bổ sung ảnh theo đúng thứ tự.', true);
      return;
    }
    const imageFiles = Array.from(files).filter(file =>
      (file.type.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(file.name))
      && file.size <= 10 * 1024 * 1024,
    );
    event.target.value = '';
    if (imageFiles.length === 0) {
      showMsg('Chỉ chấp nhận ảnh PNG, JPG hoặc WebP, tối đa 10MB mỗi ảnh.', true);
      return;
    }
    if (imageFiles.length < files.length) {
      showMsg('Một số tệp không hợp lệ hoặc vượt quá 10MB đã bị bỏ qua.', true);
    }
    const filesToRead = imageFiles.slice(0, MAX_OFFER_PHOTO_COUNT - currentPhotos.length);
    if (filesToRead.length < imageFiles.length) showMsg(`Chỉ nhận tối đa ${MAX_OFFER_PHOTO_COUNT} ảnh cho một Offer.`, true);
    setEditOfferErrors(previous => {
      const next = { ...previous };
      delete next.editPhotoUrls;
      return next;
    });
    Promise.all(filesToRead.map(file => imageFileToDataUrl(file))).then(async urls => {
      const nextPhotos = [...currentPhotos, ...urls];
      const nextForm = { ...editForm, photoUrls: nextPhotos };
      setEditForm(nextForm);
      if (nextPhotos.length >= 6) {
        await runEditPhotoAiCheck(nextPhotos);
      } else {
        showMsg(`Đã thêm ảnh. Còn thiếu ${6 - nextPhotos.length} ảnh để AI tự quét.`);
      }
    }).catch(() => showMsg('Không đọc được một hoặc nhiều ảnh container.', true));
  };

  const handleRemoveEditPhoto = (index: number) => {
    const nextPhotos = (editForm.photoUrls || []).filter((_, photoIndex) => photoIndex !== index);
    if (index !== (editForm.photoUrls || []).length - 1) {
      showMsg('Để giữ đúng thứ tự ảnh, chỉ được xóa ảnh vừa tải gần nhất.', true);
      return;
    }
    setEditForm(previous => ({ ...previous, photoUrls: nextPhotos }));
    setEditPhotoAiResult(null);
    if (nextPhotos.length < 6) {
      setEditOfferErrors(previous => ({
        ...previous,
        editPhotoUrls: 'Offer phải giữ tối thiểu 6 ảnh container.',
      }));
    }
  };

  const handleSaveOfferEdit = () => {
    if (!editingOffer) return;
    const photos = editForm.photoUrls || [];
    const errors: FieldErrors = {};
    if (photos.length < 6) errors.editPhotoUrls = 'Offer phải giữ tối thiểu 6 ảnh: mặt trước, mặt sau, mặt trái, mặt phải, trên nóc và dưới gầm.';
    setError(errors, 'editConditionNotes', required(editForm.conditionNotes, 'Vui lòng nhập mô tả chi tiết tình trạng vỏ cont.'));
    setError(errors, 'editPickupLocationName', required(editForm.pickupLocationName, 'Vui lòng nhập vị trí lấy vỏ container.'));
    setError(errors, 'editAvailableFrom', required(editForm.availableFrom, 'Vui lòng chọn thời gian bắt đầu bàn giao.'));
    setError(errors, 'editAvailableTo', validDateRange(editForm.availableFrom, editForm.availableTo, 'thời gian bàn giao'));

    const photosChanged = photos.length !== editingOffer.photoUrls.length
      || photos.some((photo, index) => photo !== editingOffer.photoUrls[index]);
    setEditOfferErrors(errors);
    if (Object.keys(errors).length > 0) {
      showMsg(Object.values(errors)[0], true);
      scrollToFirstFieldError(errors);
      return;
    }

    const updates: Partial<Offer> = {
      conditionNotes: String(editForm.conditionNotes || '').trim(),
      pickupLocationName: String(editForm.pickupLocationName || '').trim(),
      pickupLatitude: Number(editForm.pickupLatitude ?? editingOffer.pickupLatitude),
      pickupLongitude: Number(editForm.pickupLongitude ?? editingOffer.pickupLongitude),
      availableFrom: new Date(String(editForm.availableFrom)).toISOString(),
      availableTo: new Date(String(editForm.availableTo)).toISOString(),
      baselineDepotCostVnd: editingOffer.baselineDepotCostVnd,
      vehicleRequirements: String(editForm.vehicleRequirements || '').trim() || undefined,
    };

    if (photosChanged) {
      updates.photoUrls = photos;
    }

    if (photosChanged && editPhotoAiResult) {
      const previousAi = editingOffer.aiCheck;
      const aiStatus = editPhotoAiResult.status;
      const mergedDetails = Array.from(new Set([
        ...(previousAi?.details || []),
        ...editPhotoAiResult.mismatchDetails,
        ...(editPhotoAiResult.actualConditionNotes ? [editPhotoAiResult.actualConditionNotes] : []),
      ]));
      updates.aiCheck = {
        passed: Boolean(previousAi?.passed && aiStatus === 'MATCHED'),
        score: editPhotoAiResult.score ?? previousAi?.score ?? 0,
        summary: `${previousAi?.summary || 'Đã kiểm tra eDO'} Ảnh cập nhật: ${editPhotoAiResult.summary}`,
        hasAnomaly: Boolean(previousAi?.hasAnomaly || aiStatus !== 'MATCHED'),
        anomalyReason: aiStatus === 'MATCHED' ? previousAi?.anomalyReason : editPhotoAiResult.summary,
        edoChecked: previousAi?.edoChecked,
        edoValid: previousAi?.edoValid,
        edoAnomaly: previousAi?.edoAnomaly,
        photoChecked: aiStatus !== 'ERROR',
        photoCondition: editPhotoAiResult.actualCondition ?? previousAi?.photoCondition,
        photoConditionNotes: editPhotoAiResult.actualConditionNotes ?? previousAi?.photoConditionNotes,
        verificationStatus: previousAi?.verificationStatus === 'INVALID' || previousAi?.verificationStatus === 'ERROR'
          ? previousAi.verificationStatus
          : aiStatus === 'MATCHED' && previousAi?.verificationStatus === 'VERIFIED' ? 'VERIFIED' : 'MANUAL_REVIEW',
        details: mergedDetails,
      };
      updates.requiresOpsManualReview = Boolean(editingOffer.requiresOpsManualReview || aiStatus !== 'MATCHED');
    } else if (photosChanged) {
      const previousAi = editingOffer.aiCheck;
      updates.aiCheck = previousAi
        ? {
            ...previousAi,
            passed: false,
            hasAnomaly: true,
            photoChecked: false,
            verificationStatus: 'MANUAL_REVIEW',
            summary: `${previousAi.summary} Ảnh đã cập nhật nhưng chưa có kết quả AI đối chiếu.`,
            details: [...(previousAi.details || []), 'Ảnh mới chờ Ops kiểm tra thủ công.'],
          }
        : {
            passed: false,
            score: 0,
            summary: 'Ảnh đã cập nhật nhưng chưa có kết quả AI đối chiếu.',
            hasAnomaly: true,
            photoChecked: false,
            verificationStatus: 'MANUAL_REVIEW',
            details: ['Ảnh mới chờ Ops kiểm tra thủ công.'],
          };
      updates.requiresOpsManualReview = true;
    }

    const result = updateOffer(editingOffer.id, updates);
    showMsg(result.message, !result.success);
    if (result.success) {
      setEditingOffer(null);
      setEditForm({});
      setEditOfferErrors({});
      setEditPhotoAiResult(null);
    } else {
      const nextErrors = { editPhotoAi: result.message };
      setEditOfferErrors(nextErrors);
      scrollToFirstFieldError(nextErrors);
    }
  };

  // Ops phê duyệt / từ chối Offer
  const handleOpsDecision = (offerId: string, decision: 'APPROVE' | 'REQUEST_CHANGES' | 'REJECT') => {
    const field = `opsNotes-${offerId}`;
    const errors: FieldErrors = {};
    setError(errors, field, required(opsNotes, 'Vui lòng nhập ghi chú kết luận thẩm định của Ops.'));
    setOpsErrors(errors);
    if (Object.keys(errors).length > 0) {
      showMsg(Object.values(errors)[0], true);
      scrollToFirstFieldError(errors);
      return;
    }
    const result = opsReviewOffer(offerId, decision, opsNotes.trim());
    showMsg(result.message, !result.success);
    if (result.success) {
      setOpsNotes('');
      setOpsErrors({});
    } else {
      const nextErrors = { [field]: result.message };
      setOpsErrors(nextErrors);
      scrollToFirstFieldError(nextErrors);
    }
  };

  // Rút tin
  const handleWithdraw = () => {
    if (!withdrawId) return;
    const errors: FieldErrors = {};
    setError(errors, 'withdrawReason', required(withdrawReason, 'Vui lòng nhập lý do rút Offer.'));
    setWithdrawErrors(errors);
    if (Object.keys(errors).length > 0) {
      showMsg(Object.values(errors)[0], true);
      scrollToFirstFieldError(errors);
      return;
    }
    const result = withdrawOffer(withdrawId, withdrawReason.trim());
    showMsg(result.message, !result.success);
    if (result.success) {
      setWithdrawId(null);
      setWithdrawReason('');
      setWithdrawErrors({});
    }
  };

  const pendingMatchesForSupplier = matches.filter(match =>
    isSupplierRole && match.companyAId === currentCompany.id && match.status === 'MATCH_REQUESTED'
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <PackageOpen className="w-6 h-6 text-emerald-600" />
            <span>
              {currentRole === 'ENTERPRISE_B' 
                ? 'Nguồn vỏ container khả dụng' 
                : currentRole === 'ENTERPRISE_A' ? 'Offer nguồn vỏ của tôi' : 'Quản lý Nguồn cung vỏ Container'}
            </span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {currentRole === 'ENTERPRISE_B'
              ? `${filtered.length} nguồn vỏ phù hợp với nhu cầu hiện tại`
              : `${filtered.length} Offer nguồn vỏ đang hiển thị`}
          </p>
        </div>
        
        {/* Nút hành động cho nhà cung cấp Container */}
              {isSupplierRole && (
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Đăng nguồn cung mới</span>
            </button>
          </div>
        )}
      </div>

      {/* Thông báo Alert */}
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

      {pendingMatchesForSupplier.length > 0 && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-5 shadow-sm space-y-3">
          <div>
            <h3 className="text-sm font-bold text-blue-900">Đề xuất matching đang chờ xử lý</h3>
            <p className="mt-1 text-xs text-blue-800">Bên Cần vỏ đã chọn Offer của bạn. Hãy Accept để tạo giao dịch hoặc Reject để giải phóng đề xuất.</p>
          </div>
          <div className="space-y-2">
            {pendingMatchesForSupplier.map(match => {
              const matchedOffer = offers.find(offer => offer.id === match.offerId);
              const matchedRequest = requests.find(request => request.id === match.requestId);
              return (
                <div key={match.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-white p-3">
                  <div className="text-xs text-slate-700">
                    <p className="font-bold text-slate-900">{match.id} · {matchedOffer?.asset.carrierCode || '—'} {matchedOffer?.asset.containerType || ''}</p>
                    <p className="mt-1">Request {matchedRequest?.id || match.requestId} · Điểm matching <strong className="font-mono text-emerald-700">{match.scoreM}/100</strong></p>
                    <p className="mt-1 text-slate-500">Đề xuất từ đơn vị Cần vỏ Container · hết hạn {formatRelativeTime(match.expiresAt)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const reason = window.prompt('Lý do từ chối đề xuất (không bắt buộc):') || '';
                        const result = rejectMatch(match.id, reason);
                        showMsg(result.message, !result.success);
                      }}
                      className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-100"
                    >
                      Từ chối
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const result = acceptMatch(match.id);
                        showMsg(result.message, !result.success);
                        if (result.success) {
                          const transactionId = (result.data as { transactionId?: string } | undefined)?.transactionId;
                          if (transactionId) setSelectedTxnId?.(transactionId);
                          setCurrentTab?.('transactions');
                        }
                      }}
                      className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700"
                    >
                      Accept & tạo giao dịch
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Form Tạo Offer Đầy Đủ Cho nhà cung cấp Container */}
      {showAddForm && isSupplierRole && (
        <div className="bg-white border border-emerald-200 rounded-2xl p-6 space-y-5 shadow-lg animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-slate-900 text-base sm:text-lg flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-600" />
                <span>ĐĂNG NGUỒN CUNG VỎ CONTAINER MỚI</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Nhập thông tin container, chứng từ và bộ ảnh để gửi thẩm định.
              </p>
            </div>
            <button onClick={() => setShowAddForm(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>

          <FormErrorSummary errors={formErrors} />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs sm:text-sm">
            {/* 1. Số Container */}
            <div className="space-y-1">
              <label htmlFor="offer-containerNumber" className="text-slate-700 font-semibold flex items-center justify-between">
                <span>Số Container (ISO 6346) <RequiredMark /></span>
              </label>
              <input
                id="offer-containerNumber"
                data-field="containerNumber"
                value={form.containerNumber}
                onChange={e => {
                  clearFormError('containerNumber');
                  invalidateAiCheck();
                  setForm(p => ({ ...p, containerNumber: e.target.value.toUpperCase() }));
                }}
                placeholder="VD: MSKU8421093"
                aria-invalid={Boolean(formErrors.containerNumber)}
                className={getFieldErrorClass(Boolean(formErrors.containerNumber), 'w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-mono uppercase outline-none focus:ring-2 focus:ring-emerald-500 bg-white')}
              />
              <FieldError message={formErrors.containerNumber} />
            </div>

            {/* 2. Loại Container */}
            <div className="space-y-1">
              <label htmlFor="offer-containerType" className="text-slate-700 font-semibold block">Loại Container <RequiredMark /></label>
              <select
                id="offer-containerType"
                data-field="containerType"
                value={form.containerType}
                onChange={e => {
                  clearFormError('containerType');
                  invalidateAiCheck();
                  setForm(p => ({ ...p, containerType: e.target.value as '20GP' | '40HC' }));
                }}
                aria-invalid={Boolean(formErrors.containerType)}
                className={getFieldErrorClass(Boolean(formErrors.containerType), 'w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500 bg-white')}
              >
                <option value="">-- Chọn loại container --</option>
                <option value="40HC">40HC (40 foot High Cube)</option>
                <option value="20GP">20GP (20 foot Tiêu chuẩn)</option>
              </select>
              <FieldError message={formErrors.containerType} />
            </div>

            {/* 3. Hãng tàu */}
            <div className="space-y-1">
              <label htmlFor="offer-carrierId" className="text-slate-700 font-semibold block">Hãng tàu quản lý <RequiredMark /></label>
              <select
                id="offer-carrierId"
                data-field="carrierId"
                value={form.carrierId}
                onChange={e => {
                  clearFormError('carrierId');
                  invalidateAiCheck();
                  setForm(p => ({ ...p, carrierId: e.target.value }));
                }}
                aria-invalid={Boolean(formErrors.carrierId)}
                className={getFieldErrorClass(Boolean(formErrors.carrierId), 'w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500 bg-white')}
              >
                <option value="">-- Chọn hãng tàu --</option>
                {INITIAL_CARRIERS.filter(c => c.isActive).map(c => (
                  <option key={c.id} value={c.id}>{c.code} · {c.name}</option>
                ))}
              </select>
              <FieldError message={formErrors.carrierId} />
            </div>

            {/* 4. Chứng từ e-DO */}
            <div data-field="edoEvidence" className={getFieldErrorClass(Boolean(formErrors.edoEvidence), 'md:col-span-2 lg:col-span-3 p-3.5 rounded-xl border border-blue-200 bg-blue-50/50 space-y-3')}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-blue-900 flex items-center gap-1.5 text-xs sm:text-sm">
                  <FileText className="w-4 h-4 text-blue-600" />
                  Hồ sơ e-DO / Booking
                </span>
              </div>

               <div className="space-y-2 text-xs">
                 <div className="flex flex-wrap items-center gap-2">
                   <label className="text-slate-700 font-medium">Tệp e-DO / Booking (ảnh hoặc PDF) <RequiredMark /></label>
                 </div>
                 <div className="flex flex-wrap items-center gap-2">
                   <label className="flex min-w-[260px] flex-1 items-center gap-2 border border-slate-200 bg-white rounded-lg px-3 py-2 cursor-pointer hover:bg-slate-50 transition-colors">
                     <UploadCloud className="w-4 h-4 text-blue-600 shrink-0" />
                     <span className="truncate text-xs font-medium text-slate-700">
                       {form.edoFileName || 'Chọn tệp e-DO / Booking PDF hoặc ảnh'}
                     </span>
                     <input
                       type="file"
                       accept=".pdf,image/png,image/jpeg,image/jpg,image/webp"
                       className="hidden"
                       onChange={e => {
                         const f = e.target.files?.[0];
                         e.target.value = '';
                         if (!f) return;
                         const isPdfOrImg = f.type === 'application/pdf' || f.type.startsWith('image/') || f.name.toLowerCase().endsWith('.pdf');
                         if (!isPdfOrImg || f.size > 20 * 1024 * 1024) {
                           showMsg('Chỉ chấp nhận tệp ảnh/PDF hợp lệ, tối đa 20MB.', true);
                           return;
                         }
                         invalidateAiCheck();
                         void handleEdoFileSelection(f);
                       }}
                     />
                   </label>
                   <button
                     type="button"
                     disabled={!edoFile || isEdoAiChecking}
                     onClick={() => edoFile && void handleEdoFileSelection(edoFile)}
                     className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold disabled:opacity-50"
                   >
                     {isEdoAiChecking ? 'Đang xác minh...' : 'Xác minh eDO bằng AI'}
                   </button>
                 </div>
                 <FieldError message={formErrors.edoEvidence} />
                 {edoVerification && (
                   <div className={`rounded-lg border px-3 py-2 text-xs ${edoVerification.status === 'VALID' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : edoVerification.status === 'MANUAL_REVIEW' ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-red-200 bg-red-50 text-red-800'}`}>
                     <strong>{edoVerification.status === 'VALID' ? '✓ eDO hợp lệ theo AI' : edoVerification.status === 'MANUAL_REVIEW' ? '⚠ eDO chờ Ops xác minh' : '✕ eDO không hợp lệ/bất thường'}</strong>
                     <span className="ml-1">{edoVerification.summary}</span>
                     {edoVerification.details.length > 0 && <ul className="mt-1 list-disc pl-4">{edoVerification.details.map((detail, index) => <li key={index}>{detail}</li>)}</ul>}
                   </div>
                 )}
               </div>
            </div>

            {/* 5. Vị trí lấy vỏ */}
            <div className="md:col-span-2 lg:col-span-3 space-y-2">
              <label htmlFor="offer-pickupLocationName" className="text-slate-700 font-semibold block">
                <span>Vị trí lấy vỏ container <RequiredMark /></span>
              </label>

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="offer-pickupLocationName"
                    data-field="pickupLocationName"
                    value={form.pickupLocationName}
                    onChange={e => {
                      clearFormError('pickupLocationName');
                      setForm(p => ({ ...p, pickupLocationName: e.target.value }));
                    }}
                    placeholder="Nhập tên kho, bãi, cảng hoặc ICD..."
                    aria-invalid={Boolean(formErrors.pickupLocationName)}
                    className={getFieldErrorClass(Boolean(formErrors.pickupLocationName), 'w-full pl-9 pr-3.5 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 bg-white')}
                  />
                </div>
              </div>
              <FieldError message={formErrors.pickupLocationName} />
              {form.pickupLocationName && form.pickupLatitude !== 0 && form.pickupLongitude !== 0 && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${form.pickupLatitude},${form.pickupLongitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex text-[11px] font-semibold text-blue-700 hover:text-blue-900 underline"
                >
                  Mở vị trí trên Google Maps
                </a>
              )}

              {/* Quick location selector pills */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[11px] font-semibold text-slate-500">Chọn nhanh bãi phổ biến:</span>
                {POPULAR_LOCATIONS.map(loc => (
                  <button
                    key={loc.name}
                    type="button"
                    onClick={() => {
                      clearFormError('pickupLocationName');
                      setForm(p => ({
                        ...p,
                        pickupLocationName: loc.name,
                        pickupLatitude: loc.lat,
                        pickupLongitude: loc.lon
                      }));
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                      form.pickupLocationName === loc.name
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300 font-semibold'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {loc.name.split(' (')[0]}
                  </button>
                ))}
              </div>
            </div>

            {/* 6. Thời gian có thể bàn giao */}
            <div className="space-y-1">
              <label htmlFor="offer-availableFrom" className="text-slate-700 font-semibold block">Sẵn sàng bàn giao từ <RequiredMark /></label>
              <DateInput
                id="offer-availableFrom"
                data-field="availableFrom"
                value={form.availableFrom}
                onChange={v => {
                  clearFormError('availableFrom');
                  setForm(p => ({ ...p, availableFrom: v }));
                }}
                aria-invalid={Boolean(formErrors.availableFrom)}
                className={getFieldErrorClass(Boolean(formErrors.availableFrom), 'w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500 bg-white')}
              />
              <FieldError message={formErrors.availableFrom} />
            </div>

            <div className="space-y-1">
              <label htmlFor="offer-availableTo" className="text-slate-700 font-semibold block">Hạn chót bàn giao đến <RequiredMark /></label>
              <DateInput
                id="offer-availableTo"
                data-field="availableTo"
                value={form.availableTo}
                endOfDay
                onChange={v => {
                  clearFormError('availableTo');
                  setForm(p => ({ ...p, availableTo: v }));
                }}
                aria-invalid={Boolean(formErrors.availableTo)}
                className={getFieldErrorClass(Boolean(formErrors.availableTo), 'w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500 bg-white')}
              />
              <FieldError message={formErrors.availableTo} />
            </div>

            {/* 7. Tình trạng container */}
            <div className="space-y-1">
              <label htmlFor="offer-declaredCondition" className="text-slate-700 font-semibold block">Tình trạng vỏ khai báo <RequiredMark /></label>
              <select
                id="offer-declaredCondition"
                data-field="declaredCondition"
                value={form.declaredCondition}
                onChange={e => {
                  clearFormError('declaredCondition');
                  invalidateAiCheck();
                  setForm(p => ({ ...p, declaredCondition: e.target.value as PhysicalCondition }));
                }}
                aria-invalid={Boolean(formErrors.declaredCondition)}
                className={getFieldErrorClass(Boolean(formErrors.declaredCondition), 'w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500 bg-white')}
              >
                <option value="">-- Chọn tình trạng thực tế khai báo --</option>
                <option value="GOOD">Đạt chuẩn đóng hàng xuất khẩu</option>
                <option value="MINOR_DAMAGE">Hư hỏng nhẹ</option>
                <option value="MAJOR_DAMAGE">Hư hỏng nặng</option>
              </select>
              <FieldError message={formErrors.declaredCondition} />
            </div>

            {/* 8. Mô tả chi tiết tình trạng container */}
            <div className="md:col-span-2 space-y-1">
              <label htmlFor="offer-conditionNotes" className="text-slate-700 font-semibold block">Mô tả thông tin chi tiết tình trạng vỏ <RequiredMark /></label>
              <textarea
                id="offer-conditionNotes"
                data-field="conditionNotes"
                rows={2}
                value={form.conditionNotes}
                onChange={e => {
                  clearFormError('conditionNotes');
                  setForm(p => ({ ...p, conditionNotes: e.target.value }));
                }}
                placeholder="Mô tả sàn, vách, trần, gioăng cửa, độ sạch, mùi hôi..."
                aria-invalid={Boolean(formErrors.conditionNotes)}
                className={getFieldErrorClass(Boolean(formErrors.conditionNotes), 'w-full border border-slate-200 rounded-xl p-3 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-emerald-500 bg-white')}
              />
              <FieldError message={formErrors.conditionNotes} />
            </div>

            {/* 10. Ảnh container (Tối thiểu 6 ảnh, có thể bổ sung ảnh chi tiết) */}
            <div
              id="offer-photos"
              data-field="photos"
              className={getFieldErrorClass(Boolean(formErrors.photos), 'md:col-span-2 lg:col-span-3 p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3')}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-bold text-slate-800 flex items-center gap-2 text-xs sm:text-sm">
                    <Camera className="w-4 h-4 text-emerald-600" />
                    Bộ ảnh container ({form.photos.length}/6 tối thiểu) <RequiredMark />
                  </span>
                   <p className="text-[11px] text-slate-500 mt-0.5">
                     Bắt buộc tối thiểu 6 ảnh theo thứ tự: {OFFER_PHOTO_ANGLE_LABELS.join(', ')}. Có thể thêm ảnh chi tiết để Ops đối chiếu.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                   <label className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-sm">
                     <UploadCloud className="w-3.5 h-3.5" />
                     <span>{form.photos.length < 6 ? 'Tải ảnh để đủ 6 góc' : 'Thêm ảnh chi tiết'}</span>
                     <input
                       type="file"
                       accept="image/*"
                       className="hidden"
                       capture="environment"
                       onChange={handlePhotoUpload}
                     />
                   </label>
                </div>
              </div>

              <FieldError message={formErrors.photos} />

              {form.photos.length < REQUIRED_OFFER_PHOTO_COUNT && (
                <div className="rounded-xl border border-dashed border-emerald-300 bg-emerald-50/60 p-3 text-xs text-slate-700">
                  <p className="text-sm font-bold text-emerald-800">Ảnh tiếp theo: {OFFER_PHOTO_ANGLE_LABELS[form.photos.length]}</p>
                  <p className="mt-1">Tải đúng thứ tự từng mặt; hoàn tất ảnh hiện tại mới chuyển sang mặt tiếp theo.</p>
                </div>
              )}

              {/* Thumbnails */}
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {form.photos.map((url, idx) => (
                  <div key={idx} className="relative h-20 rounded-xl overflow-hidden bg-white border border-slate-200 group">
                    <img src={url} alt={`Ảnh ${idx + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => {
                        invalidateAiCheck();
                        handleRemoveOfferPhoto(idx);
                      }}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center text-xs opacity-80 hover:opacity-100"
                    >
                      ×
                    </button>
                    <span className="absolute bottom-1 left-1 text-[10px] bg-slate-900/70 text-white px-1.5 py-0.2 rounded">
                      {OFFER_PHOTO_ANGLE_LABELS[idx] || `Ảnh bổ sung ${idx - 5}`}
                    </span>
                  </div>
                ))}
                {form.photos.length === 0 && (
                  <div className="col-span-full py-6 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl text-xs">
                    Chưa tải ảnh container.
                  </div>
                )}
              </div>

              {photoAiResult && (
                <div className={`rounded-xl border p-3 space-y-1.5 text-xs ${
                  photoAiResult.status === 'MATCHED'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                    : photoAiResult.status === 'ERROR'
                      ? 'border-red-200 bg-red-50 text-red-900'
                      : 'border-amber-200 bg-amber-50 text-amber-900'
                }`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      AI ảnh sau khi tải lên: {photoAiResult.status === 'MATCHED' ? 'Khớp thông tin đăng ký' : photoAiResult.status === 'MANUAL_REVIEW' ? 'Chờ Ops kiểm tra' : photoAiResult.status === 'MISMATCH' ? 'Không khớp' : 'Lỗi kiểm tra'}
                    </strong>
                    {photoAiResult.score !== undefined && <span className="font-mono font-bold">{photoAiResult.score}/100</span>}
                  </div>
                  <p>{photoAiResult.summary}</p>
                  {photoAiResult.actualConditionNotes && (
                    <p><strong>Tình trạng thực tế tự nhận diện:</strong> {photoAiResult.actualConditionNotes}</p>
                  )}
                  {photoAiResult.mismatchDetails.length > 0 && (
                    <ul className="list-disc pl-4 space-y-0.5">
                      {photoAiResult.mismatchDetails.map((detail, index) => <li key={index}>{detail}</li>)}
                    </ul>
                  )}
                </div>
              )}

              {/* Khối AI xác minh eDO và tình trạng thực tế */}
              <div data-field="aiCheck" className={getFieldErrorClass(Boolean(formErrors.aiCheck), 'p-3 rounded-xl bg-white border border-teal-200 space-y-2')}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-teal-600" />
                  <span className="text-xs font-bold text-teal-900">
                    AI xác minh eDO & đối chiếu tình trạng 6 ảnh:
                  </span>
                  {aiCheckResult ? (
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      aiCheckResult.hasAnomaly 
                        ? 'bg-amber-100 text-amber-800 border border-amber-300' 
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    }`}>
                      {aiCheckResult.hasAnomaly ? '⚠️ Có điểm nghi vấn' : `✓ Đạt chuẩn ${aiCheckResult.score}/100`}
                    </span>
                  ) : (
                    <span className="text-xs text-amber-700">Chưa có kết quả — Offer sẽ được Ops kiểm tra thủ công</span>
                  )}
                </div>

                <button
                  type="button"
                  disabled={isAiChecking}
                  onClick={handleRunAiPreCheck}
                  className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold flex items-center gap-1 shadow-sm transition-all disabled:opacity-50"
                >
                  {isAiChecking ? 'Đang phân tích AI...' : 'Chạy AI kiểm tra trước'}
                </button>
                </div>
                {aiCheckResult && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-slate-600">
                    <span className="rounded-lg bg-slate-50 border border-slate-100 px-2 py-1">
                      eDO: <strong className={aiCheckResult.edoValid ? 'text-emerald-700' : 'text-amber-700'}>{aiCheckResult.edoValid ? 'Hợp lệ' : aiCheckResult.verificationStatus === 'MANUAL_REVIEW' ? 'Chờ Ops xác minh' : 'Không hợp lệ'}</strong>
                    </span>
                    <span className="rounded-lg bg-slate-50 border border-slate-100 px-2 py-1">
                      Ảnh: <strong className={aiCheckResult.photoStatus === 'MATCHED' ? 'text-emerald-700' : 'text-amber-700'}>{aiCheckResult.photoStatus === 'MATCHED' ? 'Khớp đăng ký' : aiCheckResult.photoStatus === 'MANUAL_REVIEW' ? 'Chờ Ops kiểm tra' : 'Không khớp'}</strong>
                    </span>
                    <span className="rounded-lg bg-slate-50 border border-slate-100 px-2 py-1">
                      Thực tế: <strong>{conditionLabel(aiCheckResult.photoCondition)}</strong>
                    </span>
                  </div>
                )}
                {aiCheckResult?.summary && <p className="text-[11px] text-slate-600 leading-relaxed">{aiCheckResult.summary}</p>}
                <FieldError message={formErrors.aiCheck} />
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            <span />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleCreateOfferSubmit}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5"
              >
                <Send className="w-4 h-4" />
                <span>Gửi Thẩm Định Offer</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lọc & Tìm kiếm */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={currentRole === 'ENTERPRISE_B' ? 'Tìm theo hãng tàu, loại vỏ, vị trí bãi...' : 'Tìm theo số container, hãng tàu, vị trí...'}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
          />
        </div>
        {isSupplierRole && (
          <div className="flex gap-2 flex-wrap">
            {['all', 'UNDER_REVIEW', 'AVAILABLE', 'HELD', 'ALLOCATED'].map(st => (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                  filterStatus === st 
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' 
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {st === 'all' ? 'Tất cả' :
                 st === 'UNDER_REVIEW' ? 'Chờ Ops duyệt' :
                 st === 'AVAILABLE' ? 'Đã duyệt (Công khai)' :
                 st === 'HELD' ? 'Đang giữ chỗ' : 'Đã phân bổ'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* DANH SÁCH OFFER */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 space-y-3 bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
          <PackageOpen className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">Không có nguồn vỏ nào</h3>
          <p className="text-xs sm:text-sm text-slate-500">
            {search ? 'Không tìm thấy kết quả phù hợp.' : 'Chưa có Offer nào phù hợp bộ lọc.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((offer, idx) => {
            // Giả lập khoảng cách & thời gian ước tính cho đơn vị cần vỏ
            const distanceKm = 12.5 + (idx * 3.7);
            const shippingMinutes = Math.round(distanceKm * 2 + 25);
            const trustScoreA = 94;
            const estimatedSaving = 1450000;

            // ==========================================
            // GIAO DIỆN HIỂN THỊ DÀNH CHO ĐƠN VỊ CẦN VỎ (BẢO MẬT TUYỆT ĐỐI)
            // ==========================================
            if (currentRole === 'ENTERPRISE_B') {
              return (
                <div
                  key={offer.id}
                  className="bg-white rounded-2xl border border-slate-200 hover:border-emerald-300 shadow-sm hover:shadow-md transition-all p-5 space-y-4"
                >
                  {/* Top Bar: Container Type, Carrier, and Masked ID */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2.5">
                      <span className="px-3 py-1 rounded-xl bg-blue-50 text-blue-800 font-bold text-sm border border-blue-200">
                        {offer.asset.carrierCode} · {offer.asset.containerType}
                      </span>
                      <span className="font-mono text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg flex items-center gap-1 border border-slate-200">
                        Cont #•••••••
                      </span>
                    </div>

                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> Sẵn sàng ghép đôi
                    </span>
                  </div>

                  {/* 7 THÔNG TIN CHUẨN MỰC ĐƠN VỊ CẦN VỎ ĐƯỢC PHÉP XEM */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 text-xs">
                    {/* 1. Khoảng cách */}
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-slate-500 font-medium block">Khoảng cách</span>
                      <strong className="text-slate-900 text-sm font-mono mt-0.5 block">
                        📍 {distanceKm.toFixed(1)} km
                      </strong>
                    </div>

                    {/* 2. Thời gian có thể bàn giao */}
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 col-span-2 sm:col-span-2">
                      <span className="text-slate-500 font-medium block">Thời gian có thể bàn giao</span>
                      <strong className="text-slate-900 text-xs mt-0.5 block leading-tight">
                        ⏱️ {formatDateTimeDdMmYyyy(offer.availableFrom)} → {formatDateTimeDdMmYyyy(offer.availableTo)}
                      </strong>
                    </div>

                    {/* 3. Tình trạng vỏ khai báo */}
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-slate-500 font-medium block">Tình trạng vỏ</span>
                      <strong className="text-emerald-700 text-xs font-bold mt-0.5 block">
                        ✅ {offer.asset.declaredCondition === 'GOOD' ? 'Đạt chuẩn xuất khẩu' : 'Hư hỏng nhẹ'}
                      </strong>
                    </div>

                    {/* 4. Điểm tương thích */}
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-slate-500 font-medium block">Điểm tương thích</span>
                      <strong className="text-emerald-700 text-sm font-mono font-bold mt-0.5 block">
                        🎯 95/100
                      </strong>
                    </div>

                    {/* 5. Điểm uy tín nhà cung cấp */}
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-slate-500 font-medium block">Điểm uy tín nhà cung cấp</span>
                      <strong className="text-amber-700 text-xs font-bold mt-0.5 block">
                        ⭐ {trustScoreA}/100 (5★)
                      </strong>
                    </div>

                    {/* 6. Thời gian vận chuyển ước tính */}
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-slate-500 font-medium block">TG vận chuyển ước tính</span>
                      <strong className="text-slate-800 text-xs font-bold mt-0.5 block">
                        🚚 ~{shippingMinutes} phút
                      </strong>
                    </div>
                  </div>

                  {/* Vị trí chung & Tiết kiệm ước tính (Field 7) */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <div className="flex items-center gap-4 text-xs text-slate-600">
                      <span className="flex items-center gap-1 font-medium">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        Khu vực lấy vỏ: <strong className="text-slate-800">{offer.pickupLocationName}</strong>
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* 7. Mức tiết kiệm ước tính */}
                      <div className="text-right">
                        <span className="text-[11px] text-slate-500 block">Tiết kiệm ước tính cho đơn vị cần vỏ</span>
                        <span className="font-mono font-bold text-sm text-emerald-700">
                          💰 +{formatVnd(estimatedSaving)}
                        </span>
                      </div>

                      {setCurrentTab && (
                        <button
                          onClick={() => setCurrentTab('requests')}
                          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1 shadow-sm transition-all"
                        >
                          <span>Tạo nhu cầu ghép với vỏ này</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            }

            // ==========================================
            // GIAO DIỆN HIỂN THỊ DÀNH CHO NHÀ CUNG CẤP & OPS
            // ==========================================
            return (
              <div
                key={offer.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all p-5 space-y-3.5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-4">
                    <div className="w-18 h-18 rounded-2xl bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                      {offer.photoUrls.length > 0 ? (
                        <img src={offer.photoUrls[0]} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300">
                          <Camera className="w-6 h-6" />
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-slate-900 text-base">{offer.asset.containerNumber}</span>
                        <OfferStatusBadge status={offer.status} size="sm" />
                        <span className="text-slate-600 font-semibold text-xs sm:text-sm">
                          {offer.asset.carrierCode} · {offer.asset.containerType}
                        </span>
                        <ConditionBadge condition={offer.asset.declaredCondition} size="sm" />
                      </div>

                      <div className="text-xs sm:text-sm text-slate-600 mt-1 flex items-center gap-1.5 font-medium">
                        <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                        <span>{offer.pickupLocationName}</span>
                      </div>

                      <div className="text-xs text-slate-500 mt-1.5 flex items-center gap-3 flex-wrap">
                        <span>Thời gian: {formatDateTimeDdMmYyyy(offer.availableFrom)} → {formatDateTimeDdMmYyyy(offer.availableTo)}</span>
                        <span className="font-medium bg-slate-100 px-2 py-0.5 rounded-md text-slate-700">{offer.photoUrls.length}/6 tối thiểu</span>
                        {offer.edoNumber && (
                          <span className="text-blue-700 font-mono bg-blue-50 px-2 py-0.5 rounded-md font-semibold">
                            e-DO / Booking: {offer.edoNumber}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Trạng thái duyệt của Ops / Cảnh báo bất thường */}
                  <div className="text-right">
                    {offer.requiresOpsManualReview && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        Cần Ops kiểm tra thủ công
                      </span>
                    )}
                    {offer.status === 'UNDER_REVIEW' && !offer.requiresOpsManualReview && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        <Clock className="w-3.5 h-3.5" />
                        Đang chờ Ops duyệt
                      </span>
                    )}
                  </div>
                </div>

                {/* Ghi chú thẩm định nếu có */}
                {currentRole === 'OPS' && (
                  <div className="space-y-3 rounded-xl border border-violet-200 bg-violet-50/50 p-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <strong className="text-violet-950">Kết quả tình trạng thực tế do AI báo về:</strong>
                      {offer.aiCheck?.photoCondition && <ConditionBadge condition={offer.aiCheck.photoCondition} size="xs" />}
                      {!offer.aiCheck?.photoCondition && <span className="text-amber-800">Chưa có phân loại tự động</span>}
                    </div>
                    {offer.aiCheck?.photoConditionNotes && <p className="text-xs leading-relaxed text-violet-950">{offer.aiCheck.photoConditionNotes}</p>}
                    {offer.conditionNotes && <p className="text-xs leading-relaxed text-slate-700"><strong>Mô tả đang lưu:</strong> {offer.conditionNotes}</p>}
                    <div>
                      <span className="text-xs font-bold text-slate-700 block mb-2">Toàn bộ ảnh nhà cung cấp đã đăng ký ({offer.photoUrls.length} ảnh):</span>
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                        {offer.photoUrls.map((url, photoIndex) => (
                          <div key={`${offer.id}-ops-photo-${photoIndex}`} className="h-20 rounded-lg overflow-hidden border border-slate-200 bg-white">
                            <img src={url} alt={`Ảnh container ${photoIndex + 1}`} className="w-full h-full object-cover" />
                          </div>
                        ))}
                        {offer.photoUrls.length === 0 && <div className="col-span-full text-xs text-slate-400">Chưa có ảnh container.</div>}
                      </div>
                    </div>
                  </div>
                )}

                {offer.reviewerNotes && (
                  <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-600 border border-slate-100 flex items-center gap-2">
                    <Shield className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>Ghi chú Ops: {offer.reviewerNotes}</span>
                  </div>
                )}

                {/* Các nút hành động */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    {/* Nút gửi thẩm định nếu đang DRAFT */}
                    {offer.status === 'DRAFT' && isSupplierRole && (
                      <button
                        onClick={() => {
                          const result = submitOfferForReview(offer.id);
                          showMsg(result.message, !result.success);
                        }}
                        className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-sm"
                      >
                        <Send className="w-4 h-4" />
                        <span>Gửi thẩm định</span>
                      </button>
                    )}

                    {/* Ops duyệt nhanh nếu role là Ops */}
                    {offer.status === 'UNDER_REVIEW' && canOpsReview && (
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          id={`offers-opsNotes-${offer.id}`}
                          data-field={`opsNotes-${offer.id}`}
                          value={opsNotes}
                          onChange={e => {
                            setOpsNotes(e.target.value);
                            if (opsErrors[`opsNotes-${offer.id}`]) setOpsErrors({});
                          }}
                          placeholder="Nhập ghi chú thẩm định của Ops..."
                          aria-invalid={Boolean(opsErrors[`opsNotes-${offer.id}`])}
                          className={getFieldErrorClass(Boolean(opsErrors[`opsNotes-${offer.id}`]), 'px-3 py-1.5 rounded-xl border border-slate-200 text-xs w-56 outline-none focus:ring-2 focus:ring-emerald-500')}
                        />
                        <FieldError message={opsErrors[`opsNotes-${offer.id}`]} />
                        <button
                          onClick={() => handleOpsDecision(offer.id, 'APPROVE')}
                          className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm"
                        >
                          Duyệt Offer (Công khai)
                        </button>
                        <button
                          onClick={() => handleOpsDecision(offer.id, 'REJECT')}
                          className="px-3.5 py-2 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold shadow-sm"
                        >
                          Từ chối
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Nút Sửa, Xóa, Rút tin */}
                  <div className="flex items-center gap-2">
                    {isSupplierRole && !['HELD', 'ALLOCATED', 'FULFILLED', 'WITHDRAWN', 'EXPIRED'].includes(offer.status) && (
                      <button
                        onClick={() => handleStartEditOffer(offer)}
                        className="p-2 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 shadow-sm"
                        title="Sửa Offer, thay ảnh hoặc bổ sung ảnh"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}

                    {['DRAFT', 'CHANGES_REQUIRED', 'UNDER_REVIEW'].includes(offer.status) && (
                      <button
                        onClick={() => deleteOffer(offer.id)}
                        className="p-2 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 shadow-sm"
                        title="Xóa Offer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}

                    {offer.status === 'AVAILABLE' && isSupplierRole && (
                      <button
                        onClick={() => setWithdrawId(offer.id)}
                        className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 text-xs font-semibold shadow-sm"
                      >
                        Rút tin
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal chỉnh sửa Offer: cho phép thay, xóa và thêm ảnh nhưng vẫn giữ checklist tối thiểu 6 góc */}
      {editingOffer && isSupplierRole && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[92vh] overflow-y-auto p-6 space-y-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Edit2 className="w-5 h-5 text-blue-600" />
                  Chỉnh sửa Offer {editingOffer.id}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Cont {editingOffer.asset.containerNumber} · {editingOffer.asset.carrierCode} · {editingOffer.asset.containerType}. Sửa ảnh/tình trạng/thời gian sẽ gửi lại Ops thẩm định.
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setEditingOffer(null); setEditForm({}); setEditOfferErrors({}); setEditPhotoAiResult(null); }}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
                aria-label="Đóng chỉnh sửa Offer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <FormErrorSummary errors={editOfferErrors} />

            <div className="rounded-xl border border-blue-200 bg-blue-50/60 px-3 py-2 text-xs text-blue-900">
              <strong>eDO không chỉnh sửa tại màn này:</strong> eDO hiện tại vẫn được giữ nguyên, chỉ Ops được xem. Nếu thay eDO, hãy tạo hồ sơ mới để bảo đảm quy tắc 1 Offer = 1 Cont = 1 eDO.
            </div>

            <div
              data-field="editPhotoUrls"
              className={getFieldErrorClass(Boolean(editOfferErrors.editPhotoUrls), 'rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3')}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <Camera className="w-4 h-4 text-emerald-600" />
                    Ảnh container ({(editForm.photoUrls || []).length}/6 tối thiểu)
                    <RequiredMark />
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Bắt buộc tối thiểu 6 ảnh theo thứ tự: {OFFER_PHOTO_ANGLE_LABELS.join(', ')}. Có thể thêm ảnh chi tiết.
                  </p>
                </div>
                <label className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer shadow-sm">
                  <UploadCloud className="w-3.5 h-3.5" />
                  {(editForm.photoUrls || []).length < 6 ? 'Thêm ảnh để đủ 6 góc' : 'Thêm ảnh mới'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleEditPhotoUpload}
                  />
                </label>
              </div>

              {(editForm.photoUrls || []).length < REQUIRED_OFFER_PHOTO_COUNT && (
                <div className="rounded-xl border border-dashed border-emerald-300 bg-emerald-50/60 p-3 text-xs text-slate-700">
                  <p className="font-bold text-emerald-800">Ảnh tiếp theo: {OFFER_PHOTO_ANGLE_LABELS[(editForm.photoUrls || []).length]}</p>
                  <p className="mt-1">Tải đúng thứ tự từng mặt; hoàn tất ảnh hiện tại mới chuyển sang mặt tiếp theo.</p>
                </div>
              )}

              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {(editForm.photoUrls || []).map((url, index) => (
                  <div key={`${url}-${index}`} className="relative h-24 rounded-xl overflow-hidden bg-white border border-slate-200 group">
                    <img src={url} alt={`Ảnh container ${index + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => handleRemoveEditPhoto(index)}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-600 text-white flex items-center justify-center text-sm opacity-90 hover:opacity-100 shadow"
                      title="Xóa ảnh này"
                    >
                      ×
                    </button>
                    <span className="absolute bottom-1 left-1 text-[10px] bg-slate-900/70 text-white px-1.5 py-0.5 rounded">
                      {OFFER_PHOTO_ANGLE_LABELS[index] || `Ảnh bổ sung ${index - 5}`}
                    </span>
                  </div>
                ))}
                {(editForm.photoUrls || []).length === 0 && (
                  <div className="col-span-full py-6 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl text-xs">
                    Chưa có ảnh. Hãy tải tối thiểu 6 ảnh theo checklist.
                  </div>
                )}
              </div>
              <FieldError message={editOfferErrors.editPhotoUrls} />

              {editPhotoAiResult && (
                <div
                  data-field="editPhotoAi"
                  className={`rounded-xl border p-3 space-y-1.5 text-xs ${
                    editPhotoAiResult.status === 'MATCHED'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                      : editPhotoAiResult.status === 'ERROR'
                        ? 'border-red-200 bg-red-50 text-red-900'
                        : 'border-amber-200 bg-amber-50 text-amber-900'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      AI bộ ảnh: {editPhotoAiResult.status === 'MATCHED' ? 'Khớp đăng ký' : editPhotoAiResult.status === 'MANUAL_REVIEW' ? 'Chờ Ops kiểm tra' : editPhotoAiResult.status === 'MISMATCH' ? 'Không khớp' : 'Lỗi'}
                    </strong>
                    {editPhotoAiResult.score !== undefined && <span className="font-mono font-bold">{editPhotoAiResult.score}/100</span>}
                  </div>
                  <p>{editPhotoAiResult.summary}</p>
                  {editPhotoAiResult.actualConditionNotes && <p><strong>Tình trạng thực tế:</strong> {editPhotoAiResult.actualConditionNotes}</p>}
                  {editPhotoAiResult.mismatchDetails.length > 0 && (
                    <ul className="list-disc pl-4 space-y-0.5">
                      {editPhotoAiResult.mismatchDetails.map((detail, index) => <li key={index}>{detail}</li>)}
                    </ul>
                  )}
                  {(editForm.photoUrls || []).length >= 6 && (
                    <button
                      type="button"
                      disabled={editPhotoAiChecking}
                      onClick={() => void runEditPhotoAiCheck(editForm.photoUrls || [])}
                      className="mt-1 px-2.5 py-1 rounded-lg border border-current/30 bg-white/70 font-semibold disabled:opacity-50"
                    >
                      {editPhotoAiChecking ? 'Đang quét lại...' : 'Quét lại AI'}
                    </button>
                  )}
                </div>
              )}
              {editPhotoAiChecking && (
                <p className="text-xs font-semibold text-teal-700 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 animate-pulse" /> AI đang đối chiếu bộ ảnh mới với thông tin container...
                </p>
              )}
              <FieldError message={editOfferErrors.editPhotoAi} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs sm:text-sm">
              <div className="md:col-span-2 space-y-1">
                <label htmlFor="edit-offer-conditionNotes" className="text-slate-700 font-semibold block">Mô tả chi tiết tình trạng vỏ <RequiredMark /></label>
                <textarea
                  id="edit-offer-conditionNotes"
                  data-field="editConditionNotes"
                  rows={3}
                  value={editForm.conditionNotes || ''}
                  onChange={event => {
                    setEditForm(previous => ({ ...previous, conditionNotes: event.target.value }));
                    setEditOfferErrors(previous => {
                      const next = { ...previous };
                      delete next.editConditionNotes;
                      return next;
                    });
                  }}
                  placeholder="AI sẽ tự điền mô tả thực tế: sàn, vách, trần, gioăng cửa, xước, móp, rỉ..."
                  aria-invalid={Boolean(editOfferErrors.editConditionNotes)}
                  className={getFieldErrorClass(Boolean(editOfferErrors.editConditionNotes), 'w-full border border-slate-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-emerald-500 bg-white')}
                />
                <FieldError message={editOfferErrors.editConditionNotes} />
              </div>

              <div className="md:col-span-2 space-y-1">
                <label htmlFor="edit-offer-pickupLocationName" className="text-slate-700 font-semibold block">Vị trí lấy vỏ container <RequiredMark /></label>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    id="edit-offer-pickupLocationName"
                    data-field="editPickupLocationName"
                    value={editForm.pickupLocationName || ''}
                    onChange={event => {
                      setEditForm(previous => ({ ...previous, pickupLocationName: event.target.value }));
                      setEditOfferErrors(previous => {
                        const next = { ...previous };
                        delete next.editPickupLocationName;
                        return next;
                      });
                    }}
                    placeholder="Nhập tên kho, bãi, cảng hoặc ICD..."
                    aria-invalid={Boolean(editOfferErrors.editPickupLocationName)}
                    className={getFieldErrorClass(Boolean(editOfferErrors.editPickupLocationName), 'w-full border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500 bg-white')}
                  />
                </div>
                <FieldError message={editOfferErrors.editPickupLocationName} />
              </div>

              <div className="space-y-1">
                <label htmlFor="edit-offer-availableFrom" className="text-slate-700 font-semibold block">Sẵn sàng bàn giao từ <RequiredMark /></label>
                <DateInput
                  id="edit-offer-availableFrom"
                  data-field="editAvailableFrom"
                  value={String(editForm.availableFrom || '')}
                  onChange={v => setEditForm(previous => ({ ...previous, availableFrom: v }))}
                  aria-invalid={Boolean(editOfferErrors.editAvailableFrom)}
                  className={getFieldErrorClass(Boolean(editOfferErrors.editAvailableFrom), 'w-full border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500 bg-white')}
                />
                <FieldError message={editOfferErrors.editAvailableFrom} />
              </div>

              <div className="space-y-1">
                <label htmlFor="edit-offer-availableTo" className="text-slate-700 font-semibold block">Hạn chót bàn giao đến <RequiredMark /></label>
                <DateInput
                  id="edit-offer-availableTo"
                  data-field="editAvailableTo"
                  value={String(editForm.availableTo || '')}
                  endOfDay
                  onChange={v => setEditForm(previous => ({ ...previous, availableTo: v }))}
                  aria-invalid={Boolean(editOfferErrors.editAvailableTo)}
                  className={getFieldErrorClass(Boolean(editOfferErrors.editAvailableTo), 'w-full border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500 bg-white')}
                />
                <FieldError message={editOfferErrors.editAvailableTo} />
              </div>

            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => { setEditingOffer(null); setEditForm({}); setEditOfferErrors({}); setEditPhotoAiResult(null); }}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={editPhotoAiChecking}
                onClick={handleSaveOfferEdit}
                className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl disabled:opacity-50"
              >
                {editPhotoAiChecking ? 'Đang kiểm tra AI...' : 'Lưu thay đổi & gửi Ops kiểm tra'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Rút tin */}
      {withdrawId && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Rút tin Offer: {withdrawId}</h3>
              <button onClick={() => { setWithdrawId(null); setWithdrawErrors({}); }} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div>
              <label htmlFor="withdrawReason" className="text-slate-700 font-semibold text-xs block mb-1">
                Lý do rút tin <RequiredMark />
              </label>
              <textarea
                id="withdrawReason"
                data-field="withdrawReason"
                value={withdrawReason}
                onChange={e => {
                  setWithdrawErrors(prev => {
                    const next = { ...prev };
                    delete next.withdrawReason;
                    return next;
                  });
                  setWithdrawReason(e.target.value);
                }}
                placeholder="Container đã được điều phối khác hoặc thay đổi kế hoạch đóng hàng..."
                rows={3}
                aria-invalid={Boolean(withdrawErrors.withdrawReason)}
                className={getFieldErrorClass(Boolean(withdrawErrors.withdrawReason), 'w-full p-3 rounded-xl border border-slate-200 text-xs outline-none focus:ring-2 focus:ring-emerald-500 bg-white')}
              />
              <FieldError message={withdrawErrors.withdrawReason} />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setWithdrawId(null); setWithdrawErrors({}); }}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Hủy
              </button>
              <button
                onClick={handleWithdraw}
                className="px-4 py-2 text-xs font-bold bg-red-600 hover:bg-red-500 text-white rounded-xl"
              >
                Xác nhận Rút
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
