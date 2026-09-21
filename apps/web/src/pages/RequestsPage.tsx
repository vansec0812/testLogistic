// ==============================================================================
// ECont RequestsPage - Version 2.0 (Full CRUD & Real-Time Auto-Matching)
// Quản lý Nhu cầu với Create, Read, Update, Delete & Tự Động Match Container
// ==============================================================================

import React, { useState, useMemo, useEffect } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { useAuth } from '../context/AuthContext';
import { BookingAiCheckResult, ContainerRequest, CreateRequestForm, MatchCandidate } from '../types';
import { RequestStatusBadge, ConditionBadge } from '../components/StatusBadge';
import { PricingBreakdownCard } from '../components/PricingBreakdownCard';
import { formatVnd, formatDistance, formatDate, formatRelativeTime } from '../lib/utils';
import {
  Search, Plus, AlertTriangle, CheckCircle2, X, Clock, MapPin,
  Sparkles, Send, TrendingDown, ChevronDown, ChevronUp, AlertCircle,
  Ship, Target, BarChart3, Star, Edit2, Trash2, Lock, ArrowRight, Check, Shield, MessageCircle, UploadCloud, FileText
} from 'lucide-react';
import { findMatchesForRequest } from '../services/matchingEngine';
import { INITIAL_CARRIERS } from '../data/mockData';
import {
  BookingRegistrationData,
  BookingVerificationResult,
  reconcileBookingAiResult,
  verifyBookingWithAI,
} from '../services/aiService';
import { getBookingAiEvidence, getBookingAiReviewTitle, sortRequestsForOps } from '../services/bookingReview';
import { DEFAULT_BASELINE_PICKUP_COST_VND } from '../services/qaRules';
import { FieldErrors, FieldError, FormErrorSummary, RequiredMark, getFieldErrorClass, scrollToFirstFieldError } from '../components/FormValidation';
import { required, validDateRange, validFutureDate, setError } from '../lib/formValidation';
import { DateInput } from '../components/DateInput';

interface RequestsPageProps {
  setCurrentTab?: (tab: string) => void;
  setSelectedTxnId?: (id: string) => void;
}

function formatDateInputDdMmYyyy(value?: string): string {
  if (!value) return '';
  const isoDate = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDate) return `${isoDate[1]}-${isoDate[2]}-${isoDate[3]}`;
  const displayDate = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (displayDate) return `${displayDate[3]}-${displayDate[2]}-${displayDate[1]}`;
  return value;
}

function parseDateInputDdMmYyyy(value: string, endOfDay = false): string {
  const normalized = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return `${normalized}T${endOfDay ? '23:59:59' : '00:00:00'}`;
  const date = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!date) return normalized;
  return `${date[3]}-${date[2]}-${date[1]}T${endOfDay ? '23:59:59' : '00:00:00'}`;
}

function toBookingRegistrationData(values: {
  bookingNumber?: string;
  carrierId?: string;
  containerType?: string;
  cutOffTime?: string;
}): BookingRegistrationData {
  const carrierId = String(values.carrierId || '').trim();
  const carrierCode = INITIAL_CARRIERS.find(carrier => carrier.id === carrierId)?.code
    || carrierId.replace(/^CARR-/, '')
    || undefined;
  const containerType = values.containerType === '20GP' || values.containerType === '40HC'
    ? values.containerType
    : undefined;
  return {
    bookingNumber: String(values.bookingNumber || '').trim().toUpperCase() || undefined,
    carrierCode,
    containerType,
    cutOffTime: values.cutOffTime,
  };
}

function mapBookingAiResult(result: BookingVerificationResult): BookingAiCheckResult {
  return {
    status: result.status,
    isValid: result.status === 'VALID' && result.isLegal && result.matchesRegistration && result.comparisonStatus === 'MATCHED',
    hasAnomaly: result.hasAnomaly || result.status === 'ANOMALY',
    score: result.score,
    summary: result.summary,
    details: result.details,
    requiresOpsReview: result.requiresOpsReview || result.status !== 'VALID' || result.comparisonStatus !== 'MATCHED',
    matchesRegistration: result.matchesRegistration,
    comparisonStatus: result.comparisonStatus,
    actualBookingNumber: result.actualBookingNumber,
    actualCarrierCode: result.actualCarrierCode,
    actualContainerType: result.actualContainerType,
    actualCutOffDate: result.actualCutOffDate,
    mismatchDetails: result.mismatchDetails,
    mismatchedFields: result.mismatchedFields,
    anomalyReason: result.anomalyReason,
    error: result.error,
  };
}

function bookingAiPanelTone(check: BookingAiCheckResult): string {
  if (check.comparisonStatus === 'MATCHED' && check.status === 'VALID') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (check.comparisonStatus === 'MISMATCH' || check.status === 'INVALID' || check.status === 'ANOMALY' || check.status === 'ERROR') return 'border-red-200 bg-red-50 text-red-800';
  return 'border-amber-200 bg-amber-50 text-amber-900';
}

const BookingAiResultPanel: React.FC<{ check: BookingAiCheckResult; showObservedValues?: boolean }> = ({
  check,
  showObservedValues = true,
}) => {
  const evidence = getBookingAiEvidence(check);
  const hasObservedValues = Boolean(check.actualBookingNumber || check.actualCarrierCode || check.actualContainerType || check.actualCutOffDate);
  const reviewTitle = getBookingAiReviewTitle(check);
  const isMatchValid = check.comparisonStatus === 'MATCHED' && check.status === 'VALID';
  const isMismatch = check.comparisonStatus === 'MISMATCH';
  const isManualReview = check.status === 'MANUAL_REVIEW';

  const badgeText = isMatchValid
    ? 'AI: File Booking hợp lệ'
    : isMismatch
      ? 'AI: File Booking có sai lệch'
      : isManualReview
        ? 'AI: Booking chờ Ops thẩm định'
        : 'AI: Booking có cảnh báo';

  return (
    <div className={`rounded-xl border p-3 text-xs ${bookingAiPanelTone(check)}`}>
      <div className="flex flex-wrap items-center gap-1.5 font-bold">
        <span>{badgeText}</span>
        {reviewTitle && !reviewTitle.toLowerCase().includes(badgeText.toLowerCase().replace('ai: ', '')) && (
          <span className="font-medium text-slate-700">· {reviewTitle}</span>
        )}
      </div>
      {check.summary && <p className="mt-1 leading-relaxed text-slate-700">{check.summary}</p>}
      {showObservedValues && hasObservedValues && (
        <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px]">
          <span className="rounded-lg bg-white/80 px-2 py-1 border border-slate-100">AI đọc số Booking: <strong>{check.actualBookingNumber || 'Không đọc được'}</strong></span>
          <span className="rounded-lg bg-white/80 px-2 py-1 border border-slate-100">AI đọc hãng tàu: <strong>{check.actualCarrierCode || 'Không đọc được'}</strong></span>
          <span className="rounded-lg bg-white/80 px-2 py-1 border border-slate-100">AI đọc loại cont: <strong>{check.actualContainerType || 'Không đọc được'}</strong></span>
          <span className="rounded-lg bg-white/80 px-2 py-1 border border-slate-100">AI đọc cut-off: <strong>{check.actualCutOffDate || 'Không thấy trên file'}</strong></span>
        </div>
      )}
      {evidence.length > 0 && <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-slate-600">{evidence.map((detail, index) => <li key={`${detail}-${index}`}>{detail}</li>)}</ul>}
    </div>
  );
};

function getBookingAiMismatchErrors(check: BookingAiCheckResult, target: 'create' | 'edit'): FieldErrors {
  if (check.comparisonStatus !== 'MISMATCH') return {};
  const prefix = target === 'edit' ? 'edit-' : '';
  const details = check.mismatchDetails?.join(' ') || check.summary;
  const errors: FieldErrors = { [`${prefix}bookingEvidence`]: `File Booking có sai lệch: ${details}` };
  if (check.mismatchedFields?.includes('BOOKING_NUMBER')) errors[`${prefix}bookingNumber`] = 'Số Booking không khớp file Booking đã tải.';
  if (check.mismatchedFields?.includes('CARRIER_CODE')) errors[`${prefix}carrierId`] = 'Hãng tàu không khớp file Booking đã tải.';
  if (check.mismatchedFields?.includes('CONTAINER_TYPE')) errors[`${prefix}containerType`] = 'Loại container không khớp file Booking đã tải.';
  if (check.mismatchedFields?.includes('CUT_OFF_TIME')) errors[`${prefix}cutOffTime`] = 'Ngày cut-off không khớp file Booking đã tải.';
  return errors;
}

function clearResolvedBookingAiErrors(errors: FieldErrors, target: 'create' | 'edit'): FieldErrors {
  const prefix = target === 'edit' ? 'edit-' : '';
  const fields = [`${prefix}bookingEvidence`, `${prefix}bookingNumber`, `${prefix}carrierId`, `${prefix}containerType`, `${prefix}cutOffTime`];
  const next = { ...errors };
  fields.forEach(field => {
    if (/khớp file Booking đã tải|File Booking có sai lệch/.test(next[field] || '')) delete next[field];
  });
  return next;
}

function MatchCandidateCard({
  candidate,
  onHold,
  onChat,
}: {
  candidate: MatchCandidate;
  onHold: () => void;
  onChat?: () => void;
}) {
  const [showPricing, setShowPricing] = useState(false);
  const { 
    offer, 
    distanceKm, 
    scoreM, 
    scoreD, 
    scoreT, 
    scoreC, 
    requiresLocationRefresh, 
    locationAgeHours, 
    quote,
    estimatedShippingMinutes = Math.round(distanceKm * 2 + 25),
    trustScoreA = 94
  } = candidate;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all p-4 space-y-3.5">
      {/* Top Header: Masked Container Number & Badges */}
      <div className="flex items-start justify-between gap-3 pb-2.5 border-b border-slate-100">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200">
              {offer.asset.carrierCode} · {offer.asset.containerType}
            </span>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-1 font-mono">
              Cont #•••••••
            </span>
            {requiresLocationRefresh && (
              <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-0.5 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                Vị trí {Math.round(locationAgeHours)}h
              </span>
            )}
          </div>
        </div>

        {/* 4. Điểm tương thích (Matching Score) */}
        <div className="text-right shrink-0">
          <div className={`inline-flex items-center justify-center px-2.5 py-1 rounded-xl font-bold font-mono text-base ${
            scoreM >= 80 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm' :
            scoreM >= 60 ? 'bg-amber-50 text-amber-700 border border-amber-200 shadow-sm' :
            'bg-slate-50 text-slate-600 border border-slate-200'
          }`}>
            🎯 {scoreM}<span className="text-xs font-normal text-slate-400">/100</span>
          </div>
          <p className="text-[11px] text-slate-500 font-medium mt-0.5">Điểm tương thích</p>
        </div>
      </div>

      {/* 7 thông tin chuẩn mực hiển thị cho đơn vị cần vỏ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
        {/* 1. Khoảng cách (Distance) */}
        <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
          <span className="text-slate-500 block">Khoảng cách</span>
          <strong className="text-slate-900 text-sm font-mono mt-0.5 block">
            📍 {formatDistance(distanceKm)}
          </strong>
        </div>

        {/* 3. Tình trạng vỏ khai báo (Declared condition) */}
        <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
          <span className="text-slate-500 block">Tình trạng vỏ</span>
          <strong className="text-emerald-700 text-xs font-bold mt-0.5 block">
            ✅ {offer.asset.declaredCondition === 'GOOD' ? 'Đạt chuẩn đóng hàng' : 'Hư hỏng nhẹ'}
          </strong>
        </div>

        {/* 5. Điểm uy tín (Trust Score) */}
        <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
          <span className="text-slate-500 block">Điểm uy tín nhà cung cấp</span>
          <strong className="text-amber-700 text-xs font-bold mt-0.5 block">
            ⭐ {trustScoreA}/100 (5★)
          </strong>
        </div>

        {/* 6. Thời gian vận chuyển ước tính (Estimated shipping time) */}
        <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
          <span className="text-slate-500 block">TG vận chuyển ước tính</span>
          <strong className="text-slate-800 text-xs font-bold mt-0.5 block">
            🚚 ~{estimatedShippingMinutes} phút
          </strong>
        </div>

        {/* 2. Thời gian có thể bàn giao (Available time) */}
        <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100 col-span-2">
          <span className="text-slate-500 block">Thời gian có thể bàn giao</span>
          <strong className="text-slate-800 text-xs mt-0.5 block leading-tight">
            ⏱️ {formatDate(offer.availableFrom)} → {formatDate(offer.availableTo)}
          </strong>
        </div>
      </div>

      {/* 7. Mức tiết kiệm ước tính (Estimated saving) & Báo giá */}
      <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-100">
        <div>
          <span className="text-slate-600">Tiết kiệm ước tính cho đơn vị cần vỏ: </span>
          <span className={`font-bold font-mono text-sm ${quote.negativeSavingB ? 'text-red-500' : 'text-emerald-700'}`}>
            💰 +{formatVnd(Math.abs(quote.sBVnd))}
          </span>
        </div>
        <button
          onClick={() => setShowPricing(!showPricing)}
          className="text-cyan-700 hover:underline text-xs font-bold flex items-center gap-1"
        >
          {showPricing ? 'Ẩn báo giá' : 'Chi tiết báo giá'}
          {showPricing ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {showPricing && (
        <PricingBreakdownCard quote={quote} showDetails={false} context="match_preview" />
      )}

      {/* Action */}
      <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
        <span className="text-xs text-slate-500 font-medium truncate flex items-center gap-1">
          <MapPin className="w-3.5 h-3.5 text-slate-400" />
          Khu vực: {offer.pickupLocationName}
        </span>
        <div className="flex items-center gap-1.5">
          {onChat && (
            <button
              type="button"
              onClick={onChat}
              className="px-3 py-2 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>Chat với đối tác</span>
            </button>
          )}
          <button
            onClick={onHold}
            disabled={requiresLocationRefresh}
            className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Chọn vỏ này · Giữ chỗ</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export const RequestsPage: React.FC<RequestsPageProps> = ({ setCurrentTab, setSelectedTxnId }) => {
  const { 
    requests, 
    offers, 
    addRequest, 
    updateRequest, 
    deleteRequest, 
    submitRequestForReview, 
    withdrawRequest, 
    opsReviewRequest, 
    holdAtomicReservation,
    startChatThread,
  } = useDatabase();
  const { currentRole, currentCompany, canOpsReview, canCreateRequests } = useAuth();
  const isSupplierRole = currentRole === 'ENTERPRISE_A' || currentRole === 'ENTERPRISE_BOTH';
  const isRequesterRole = currentRole === 'ENTERPRISE_B' || currentRole === 'ENTERPRISE_BOTH';
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ContainerRequest | null>(null);
  const [editingRequest, setEditingRequest] = useState<ContainerRequest | null>(null);
  const [editForm, setEditForm] = useState<Partial<ContainerRequest>>({});
  const [matchingForId, setMatchingForId] = useState<string | null>(null);
  const [opsNotes, setOpsNotes] = useState('');
  const [withdrawId, setWithdrawId] = useState<string | null>(null);
  const [withdrawReason, setWithdrawReason] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [holdingId, setHoldingId] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<FieldErrors>({});
  const [editErrors, setEditErrors] = useState<FieldErrors>({});
  const [withdrawErrors, setWithdrawErrors] = useState<FieldErrors>({});
  const [opsErrors, setOpsErrors] = useState<FieldErrors>({});
  const [bookingFile, setBookingFile] = useState<File | null>(null);
  const [bookingAiResult, setBookingAiResult] = useState<BookingAiCheckResult | null>(null);
  const [bookingAiSource, setBookingAiSource] = useState<BookingVerificationResult | null>(null);
  const [isBookingAiChecking, setIsBookingAiChecking] = useState(false);
  const [editBookingFile, setEditBookingFile] = useState<File | null>(null);
  const [editBookingAiResult, setEditBookingAiResult] = useState<BookingAiCheckResult | null>(null);
  const [editBookingAiSource, setEditBookingAiSource] = useState<BookingVerificationResult | null>(null);
  const [isEditBookingAiChecking, setIsEditBookingAiChecking] = useState(false);

  useEffect(() => {
    if (currentRole === 'ENTERPRISE_A') {
      setShowAddForm(false);
      setEditingRequest(null);
      setMatchingForId(null);
    }
  }, [currentRole]);

  const [form, setForm] = useState<Partial<CreateRequestForm>>({
    containerType: undefined,
    maxDistanceKm: undefined,
    carrierId: '',
  });

  const createBookingRegistration = useMemo(() => toBookingRegistrationData(form), [
    form.bookingNumber,
    form.carrierId,
    form.containerType,
    form.cutOffTime,
  ]);
  const editBookingRegistration = useMemo(() => toBookingRegistrationData(editForm), [
    editForm.bookingNumber,
    editForm.carrierId,
    editForm.containerType,
    editForm.cutOffTime,
  ]);

  // Người dùng có thể upload file trước khi hoàn tất các trường tay. Khi họ
  // nhập/sửa Booking, hãng tàu, loại cont hoặc cut-off, dùng dữ liệu AI đã đọc
  // để đối chiếu lại ngay mà không phải tải file lần nữa.
  useEffect(() => {
    if (!bookingAiSource) return;
    const next = mapBookingAiResult(reconcileBookingAiResult(bookingAiSource, createBookingRegistration));
    setBookingAiResult(next);
    setForm(previous => ({ ...previous, bookingAiCheck: next }));
    setFormErrors(previous => next.comparisonStatus === 'MISMATCH'
      ? { ...previous, ...getBookingAiMismatchErrors(next, 'create') }
      : clearResolvedBookingAiErrors(previous, 'create'));
  }, [bookingAiSource, createBookingRegistration]);

  useEffect(() => {
    if (!editBookingAiSource) return;
    const next = mapBookingAiResult(reconcileBookingAiResult(editBookingAiSource, editBookingRegistration));
    setEditBookingAiResult(next);
    setEditForm(previous => ({ ...previous, bookingAiCheck: next }));
    setEditErrors(previous => next.comparisonStatus === 'MISMATCH'
      ? { ...previous, ...getBookingAiMismatchErrors(next, 'edit') }
      : clearResolvedBookingAiErrors(previous, 'edit'));
  }, [editBookingAiSource, editBookingRegistration]);

  const showMsg = (msg: string, isError = false) => {
    if (isError) setErrorMsg(msg);
    else setSuccessMsg(msg);
    setTimeout(() => { setErrorMsg(''); setSuccessMsg(''); }, 5000);
  };

  const applyBookingAiMismatchErrors = (check: BookingAiCheckResult, target: 'create' | 'edit') => {
    if (check.comparisonStatus !== 'MISMATCH') return;
    const errors = getBookingAiMismatchErrors(check, target);
    if (target === 'create') setFormErrors(previous => ({ ...previous, ...errors }));
    else setEditErrors(previous => ({ ...previous, ...errors }));
    scrollToFirstFieldError(errors);
  };

  const handleBookingFileSelection = async (file: File, target: 'create' | 'edit') => {
    const isPdfOrImage = file.type === 'application/pdf'
      || file.type.startsWith('image/')
      || file.name.toLowerCase().endsWith('.pdf');
    if (!isPdfOrImage || file.size > 20 * 1024 * 1024) {
      showMsg('Chỉ chấp nhận file Booking ảnh/PDF hợp lệ, tối đa 20MB.', true);
      return;
    }

    const setChecking = target === 'create' ? setIsBookingAiChecking : setIsEditBookingAiChecking;
    setChecking(true);
    if (target === 'create') {
      setBookingFile(file);
      setBookingAiResult(null);
      setBookingAiSource(null);
      clearRequestError('bookingEvidence');
      setForm(previous => ({
        ...previous,
        bookingFileName: file.name,
        bookingFileMimeType: file.type || 'application/octet-stream',
        bookingAiCheck: undefined,
      }));
    } else {
      setEditBookingFile(file);
      setEditBookingAiResult(null);
      setEditBookingAiSource(null);
      setEditErrors(previous => {
        const next = { ...previous };
        delete next['edit-bookingEvidence'];
        return next;
      });
      setEditForm(previous => ({
        ...previous,
        bookingFileName: file.name,
        bookingFileMimeType: file.type || 'application/octet-stream',
        bookingAiCheck: undefined,
      }));
    }

    try {
      const expected = target === 'create' ? createBookingRegistration : editBookingRegistration;
      const result = await verifyBookingWithAI(file, expected);
      const aiCheck = mapBookingAiResult(result);
      if (target === 'create') {
        setBookingAiSource(result);
        setBookingAiResult(aiCheck);
        setForm(previous => ({ ...previous, bookingAiCheck: aiCheck }));
      } else {
        setEditBookingAiSource(result);
        setEditBookingAiResult(aiCheck);
        setEditForm(previous => ({ ...previous, bookingAiCheck: aiCheck }));
      }
      if (aiCheck.comparisonStatus === 'MATCHED' && result.status === 'VALID') {
        showMsg('AI xác minh file Booking hợp lệ và khớp thông tin đã nhập. Hồ sơ vẫn chờ Ops duyệt.');
      } else if (aiCheck.comparisonStatus === 'MISMATCH') {
        applyBookingAiMismatchErrors(aiCheck, target);
        showMsg(`Booking có sai lệch: ${getBookingAiReviewTitle(aiCheck)}. Nếu vẫn đăng ký, hồ sơ sẽ được chuyển ngay Ops kiểm tra.`, true);
      } else if (result.status === 'MANUAL_REVIEW') {
        showMsg(`AI chưa thể kết luận Booking: ${result.error || result.summary} Hồ sơ sẽ chuyển Ops kiểm tra.`);
      } else {
        showMsg(`Booking có cảnh báo: ${result.anomalyReason || result.summary} Ops sẽ quyết định.`, true);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể quét AI file Booking.';
      const fallback: BookingAiCheckResult = {
        status: 'ERROR',
        isValid: false,
        hasAnomaly: true,
        summary: 'AI chưa thể kiểm tra file Booking; cần Ops kiểm tra thủ công.',
        details: [message],
        requiresOpsReview: true,
        matchesRegistration: false,
        comparisonStatus: 'PENDING',
        mismatchDetails: [],
        mismatchedFields: [],
        error: message,
      };
      if (target === 'create') {
        setBookingAiSource(null);
        setBookingAiResult(fallback);
        setForm(previous => ({ ...previous, bookingAiCheck: fallback }));
      } else {
        setEditBookingAiSource(null);
        setEditBookingAiResult(fallback);
        setEditForm(previous => ({ ...previous, bookingAiCheck: fallback }));
      }
      showMsg(fallback.summary, true);
      setChecking(false);
    }
  };

  const availableOffers = useMemo(() => offers.filter(o => o.status === 'AVAILABLE'), [offers]);

  const filtered = useMemo(() => {
    let list = requests;
    if (currentRole === 'ENTERPRISE_B') list = list.filter(r => r.companyId === currentCompany.id);
    if (currentRole === 'ENTERPRISE_BOTH') list = list.filter(r => r.companyId === currentCompany.id || r.status === 'OPEN');
    // Nhà cung cấp được xem nhu cầu đã OPEN để theo dõi nhu cầu thị trường/matching,
    // nhưng không được xem nháp/chờ duyệt và không có quyền tạo, sửa, giữ chỗ.
    if (currentRole === 'ENTERPRISE_A') list = list.filter(r => r.status === 'OPEN');
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(r => 
        r.id.toLowerCase().includes(q) || 
        r.bookingNumber.toLowerCase().includes(q) || 
        r.carrierCode.toLowerCase().includes(q) ||
        r.deliveryLocationName.toLowerCase().includes(q)
      );
    }
    if (filterStatus !== 'all') list = list.filter(r => r.status === filterStatus);
    if (currentRole === 'OPS') return sortRequestsForOps(list);
    return [...list].sort((a, b) => {
      const createdAtA = new Date(a.createdAt || 0).getTime() || 0;
      const createdAtB = new Date(b.createdAt || 0).getTime() || 0;
      return createdAtB - createdAtA;
    });
  }, [requests, currentRole, currentCompany.id, search, filterStatus]);

  // Pre-calculate auto-matches for all OPEN requests
  const autoMatchMap = useMemo(() => {
    const map: Record<string, ReturnType<typeof findMatchesForRequest>> = {};
    requests.forEach(req => {
      if (req.status === 'OPEN') {
        map[req.id] = findMatchesForRequest(req, availableOffers);
      }
    });
    return map;
  }, [requests, availableOffers]);

  // Matching candidates for manually opened request
  const activeMatchResults = useMemo(() => {
    if (!matchingForId) return null;
    const req = requests.find(r => r.id === matchingForId);
    if (!req) return null;
    return findMatchesForRequest(req, availableOffers);
  }, [matchingForId, requests, availableOffers]);

  const clearRequestError = (field: string) => {
    setFormErrors(previous => {
      if (!previous[field]) return previous;
      const next = { ...previous };
      delete next[field];
      return next;
    });
  };

  const validateRequestForm = (): FieldErrors => {
    const errors: FieldErrors = {};
    setError(errors, 'bookingNumber', required(form.bookingNumber, 'Vui lòng nhập số Booking.'));
    setError(errors, 'bookingEvidence', required(form.bookingFileName, 'Vui lòng tải file Booking ảnh/PDF.'));
    if (form.bookingNumber && !/^[A-Z0-9][A-Z0-9-]{4,}$/.test(form.bookingNumber.trim().toUpperCase())) {
      errors.bookingNumber = 'Số Booking phải có ít nhất 5 ký tự, chỉ gồm chữ, số và dấu gạch ngang.';
    }
    setError(errors, 'containerType', required(form.containerType, 'Vui lòng chọn loại container.'));
    setError(errors, 'carrierId', required(form.carrierId, 'Vui lòng chọn hãng tàu cấp vỏ.'));
    setError(errors, 'deliveryLocationName', required(form.deliveryLocationName, 'Vui lòng nhập địa điểm nhận cont/đóng hàng.'));
    setError(errors, 'pickupWindowStart', validFutureDate(form.pickupWindowStart, 'thời điểm lấy cont sớm nhất'));
    setError(errors, 'pickupWindowEnd', validDateRange(form.pickupWindowStart, form.pickupWindowEnd, 'khung thời gian lấy cont'));
    setError(errors, 'cutOffTime', validFutureDate(form.cutOffTime, 'thời hạn cut-off booking'));
    if (!Number.isFinite(Number(form.maxDistanceKm)) || Number(form.maxDistanceKm) < 5 || Number(form.maxDistanceKm) > 100) {
      errors.maxDistanceKm = 'Bán kính Dmax phải từ 5 đến 100 km.';
    }
    return errors;
  };

  const handleAddRequest = () => {
    const errors = validateRequestForm();
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      showMsg(Object.values(errors)[0], true);
      scrollToFirstFieldError(errors);
      return;
    }
    const result = addRequest({
      carrierId: form.carrierId!,
      containerType: form.containerType!,
      bookingNumber: form.bookingNumber!.trim().toUpperCase(),
      deliveryLocationName: form.deliveryLocationName!.trim(),
      deliveryLatitude: form.deliveryLatitude || 10.74,
      deliveryLongitude: form.deliveryLongitude || 106.70,
      pickupWindowStart: form.pickupWindowStart!,
      pickupWindowEnd: form.pickupWindowEnd!,
      cutOffTime: form.cutOffTime!,
      maxDistanceKm: Number(form.maxDistanceKm),
      cargoType: form.cargoType?.trim() || 'Hàng tổng hợp',
      cargoRequirements: form.cargoRequirements?.trim(),
      baselinePickupCostVnd: DEFAULT_BASELINE_PICKUP_COST_VND,
      bookingFileName: form.bookingFileName,
      bookingFileMimeType: form.bookingFileMimeType,
      bookingAiCheck: form.bookingAiCheck,
    });
    if (result.success) {
      showMsg(result.message);
      setShowAddForm(false);
      setForm({ containerType: undefined, maxDistanceKm: undefined, carrierId: '' });
      setBookingFile(null);
      setBookingAiResult(null);
      setBookingAiSource(null);
      setFormErrors({});
    } else {
      showMsg(result.message, true);
    }
  };

  const handleStartEdit = (req: ContainerRequest) => {
    if (['HELD', 'ALLOCATED', 'FULFILLED'].includes(req.status)) {
      showMsg(`Không thể chỉnh sửa nhu cầu đang ở trạng thái ${req.status}.`, true);
      return;
    }
    setEditingRequest(req);
    setEditErrors({});
    setEditForm({
      bookingNumber: req.bookingNumber,
      carrierId: req.carrierId,
      containerType: req.containerType,
      deliveryLocationName: req.deliveryLocationName,
      pickupWindowStart: req.pickupWindowStart,
      pickupWindowEnd: req.pickupWindowEnd,
      cutOffTime: req.cutOffTime,
      maxDistanceKm: req.maxDistanceKm,
      bookingFileName: req.bookingFileName,
      bookingFileMimeType: req.bookingFileMimeType,
      bookingAiCheck: req.bookingAiCheck,
      cargoType: req.cargoType,
      cargoRequirements: req.cargoRequirements || '',
    });
    setEditBookingFile(null);
    setEditBookingAiResult(req.bookingAiCheck || null);
    setEditBookingAiSource(null);
  };

  const handleSaveEdit = () => {
    if (!editingRequest) return;
    const errors: FieldErrors = {};
    setError(errors, 'edit-bookingNumber', required(editForm.bookingNumber, 'Vui lòng nhập số Booking.'));
    setError(errors, 'edit-bookingEvidence', required(editForm.bookingFileName, 'Vui lòng tải file Booking ảnh/PDF.'));
    if (editForm.bookingNumber && !/^[A-Z0-9][A-Z0-9-]{4,}$/.test(String(editForm.bookingNumber).trim().toUpperCase())) {
      errors['edit-bookingNumber'] = 'Số Booking phải có ít nhất 5 ký tự, chỉ gồm chữ, số và dấu gạch ngang.';
    }
    setError(errors, 'edit-carrierId', required(editForm.carrierId, 'Vui lòng chọn hãng tàu cấp vỏ.'));
    setError(errors, 'edit-containerType', required(editForm.containerType, 'Vui lòng chọn loại container.'));
    setError(errors, 'edit-deliveryLocationName', required(editForm.deliveryLocationName, 'Vui lòng nhập địa điểm giao hàng.'));
    setError(errors, 'edit-pickupWindowStart', validFutureDate(editForm.pickupWindowStart, 'thời điểm lấy cont sớm nhất'));
    setError(errors, 'edit-pickupWindowEnd', validDateRange(editForm.pickupWindowStart, editForm.pickupWindowEnd, 'khung thời gian lấy cont'));
    setError(errors, 'edit-cutOffTime', validFutureDate(editForm.cutOffTime, 'thời hạn cut-off booking'));
    if (!Number.isFinite(Number(editForm.maxDistanceKm)) || Number(editForm.maxDistanceKm) < 5 || Number(editForm.maxDistanceKm) > 100) {
      errors['edit-maxDistanceKm'] = 'Bán kính Dmax phải từ 5 đến 100 km.';
    }
    setEditErrors(errors);
    if (Object.keys(errors).length > 0) {
      showMsg(Object.values(errors)[0], true);
      scrollToFirstFieldError(errors);
      return;
    }
    const result = updateRequest(editingRequest.id, {
      ...editForm,
      bookingNumber: editForm.bookingNumber!.trim().toUpperCase(),
      carrierId: editForm.carrierId!,
      carrierCode: INITIAL_CARRIERS.find(carrier => carrier.id === editForm.carrierId)?.code || String(editForm.carrierId).replace(/^CARR-/, ''),
      containerType: editForm.containerType as '20GP' | '40HC',
      deliveryLocationName: editForm.deliveryLocationName!.trim(),
      pickupWindowStart: editForm.pickupWindowStart!,
      pickupWindowEnd: editForm.pickupWindowEnd!,
      cutOffTime: editForm.cutOffTime!,
      maxDistanceKm: Number(editForm.maxDistanceKm),
      bookingFileName: editForm.bookingFileName,
      bookingFileMimeType: editForm.bookingFileMimeType,
      bookingAiCheck: editForm.bookingAiCheck,
      cargoType: editForm.cargoType?.trim(),
    });
    showMsg(result.message, !result.success);
    if (result.success) {
      setEditingRequest(null);
      setEditErrors({});
    }
  };

  const handleDeleteRequest = (requestId: string) => {
    if (!confirm('Bạn có chắc muốn xóa nhu cầu này hoàn toàn?')) return;
    const result = deleteRequest(requestId);
    showMsg(result.message, !result.success);
    if (result.success && selectedRequest?.id === requestId) {
      setSelectedRequest(null);
    }
  };

  const handleOpsDecision = (requestId: string, decision: 'APPROVE' | 'REQUEST_CHANGES' | 'REJECT') => {
    const field = `opsNotes-${requestId}`;
    const errors: FieldErrors = {};
    setError(errors, field, required(opsNotes, 'Vui lòng nhập ghi chú xác minh Booking.'));
    setOpsErrors(errors);
    if (Object.keys(errors).length > 0) {
      showMsg(Object.values(errors)[0], true);
      scrollToFirstFieldError(errors);
      return;
    }
    const result = opsReviewRequest(requestId, decision, opsNotes.trim());
    showMsg(result.message, !result.success);
    if (result.success) { setOpsNotes(''); setOpsErrors({}); }
    else {
      setOpsErrors({ [field]: result.message });
      scrollToFirstFieldError({ [field]: result.message });
    }
  };

  const handleWithdraw = () => {
    if (!withdrawId) return;
    const errors: FieldErrors = {};
    setError(errors, 'withdrawReason', required(withdrawReason, 'Vui lòng nhập lý do rút nhu cầu.'));
    setWithdrawErrors(errors);
    if (Object.keys(errors).length > 0) {
      showMsg(Object.values(errors)[0], true);
      scrollToFirstFieldError(errors);
      return;
    }
    const result = withdrawRequest(withdrawId, withdrawReason.trim());
    showMsg(result.message, !result.success);
    if (result.success) {
      setWithdrawId(null);
      setWithdrawReason('');
      setWithdrawErrors({});
    }
  };

  const handleHoldReservation = (candidate: MatchCandidate, req: ContainerRequest) => {
    setHoldingId(candidate.offer.id);
    const result = holdAtomicReservation(candidate, req);
    setHoldingId(null);
    if (result.success) {
      const matchData = result.data as { matchId: string } | undefined;
      showMsg(`✓ Đã gửi yêu cầu ghép ${matchData?.matchId || ''}. Chưa reserve cont; chờ nhà cung cấp Accept.`);
      setMatchingForId(null);
    } else {
      showMsg(result.message, true);
    }
  };

  const handleStartChat = (req: ContainerRequest, candidate?: MatchCandidate) => {
    const offer = candidate?.offer;
    const threadId = startChatThread({
      companyAId: offer?.companyId || currentCompany.id,
      companyAName: offer?.companyName || currentCompany.shortName,
      companyBId: req.companyId,
      companyBName: req.companyName,
      offerId: offer?.id,
      requestId: req.id,
      contextLabel: `Booking ${req.bookingNumber}`,
      contextType: 'PRE_BOOKING',
      containerNumber: 'Cont •••••••',
      carrierCode: offer?.asset.carrierCode || req.carrierCode,
      containerType: offer?.asset.containerType || req.containerType,
      pickupLocationName: offer?.pickupLocationName,
    });
    if (!threadId) {
      showMsg('Không thể mở cuộc chat: hai đối tác chưa thuộc đúng nhu cầu/Offer.', true);
      return;
    }
    showMsg('Đã mở cuộc chat với đối tác.');
    setCurrentTab?.('chat');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Search className="w-6 h-6 text-cyan-600" />
            <span>{isRequesterRole ? 'Quản lý Nhu cầu & Tự động Ghép đôi' : currentRole === 'OPS' ? 'Thẩm định Nhu cầu cần vỏ' : 'Danh sách Nhu cầu tìm vỏ'}</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {isRequesterRole
              ? 'Tự động dò tìm và ghép đôi vỏ container rỗng theo Hãng tàu, Loại cont và Bán kính Dmax'
              : currentRole === 'OPS'
                ? `${filtered.length} nhu cầu trong hàng đợi thẩm định Booking`
                : `${filtered.length} nhu cầu đang hiển thị`}
          </p>
        </div>
        {canCreateRequests && (
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-2 shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Đăng nhu cầu mới</span>
          </button>
        )}
      </div>

      {/* Alerts */}
      {successMsg && (
        <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-700">
          <CheckCircle2 className="w-4 h-4 shrink-0" />{successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-700">
          <AlertTriangle className="w-4 h-4 shrink-0" />{errorMsg}
        </div>
      )}
      {isRequesterRole && currentCompany.verificationStatus !== 'VERIFIED' && (
        <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-xs font-semibold text-amber-800">
          <Shield className="w-4 h-4 shrink-0" /> Hồ sơ doanh nghiệp đang chờ Ops xác minh. Chưa thể tạo hoặc gửi Request.
        </div>
      )}
      {/* Add Form Modal/Section */}
      {showAddForm && canCreateRequests && (
        <div className="bg-white border border-cyan-200 rounded-2xl p-6 space-y-4 shadow-md">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Plus className="w-4 h-4 text-cyan-600" />
              <span>ĐĂNG NHU CẦU TÌM VỎ CONTAINER</span>
            </h3>
            <button onClick={() => setShowAddForm(false)} className="text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          <FormErrorSummary errors={formErrors} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="text-slate-700 font-semibold text-xs sm:text-sm block mb-1">Số Booking (từ hãng tàu) <RequiredMark /></label>
              <input
                id="request-bookingNumber"
                data-field="bookingNumber"
                value={form.bookingNumber || ''}
                onChange={e => { clearRequestError('bookingNumber'); setForm(p => ({ ...p, bookingNumber: e.target.value.toUpperCase() })); }}
                placeholder="MSKBKG2026-981..."
                aria-invalid={Boolean(formErrors.bookingNumber)}
                className={getFieldErrorClass(Boolean(formErrors.bookingNumber), 'w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-mono uppercase outline-none focus:ring-2 focus:ring-cyan-500 bg-white')}
              />
              <FieldError message={formErrors.bookingNumber} />
            </div>
            <div
              data-field="bookingEvidence"
              className={getFieldErrorClass(Boolean(formErrors.bookingEvidence), 'md:col-span-2 rounded-xl border border-blue-200 bg-blue-50/50 p-3 space-y-2')}
            >
              <label className="text-slate-700 font-semibold text-xs sm:text-sm block">File Booking (ảnh hoặc PDF) <RequiredMark /></label>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex min-w-[240px] flex-1 items-center gap-2 border border-slate-200 bg-white rounded-lg px-3 py-2 cursor-pointer hover:bg-slate-50">
                  <UploadCloud className="w-4 h-4 text-blue-600 shrink-0" />
                  <span className="truncate text-xs font-medium text-slate-700">{form.bookingFileName || 'Chọn file Booking ảnh/PDF'}</span>
                  <input
                    type="file"
                    accept=".pdf,application/pdf,image/png,image/jpeg,image/jpg,image/webp"
                    className="hidden"
                    onChange={event => {
                      const file = event.target.files?.[0];
                      event.target.value = '';
                      if (file) void handleBookingFileSelection(file, 'create');
                    }}
                  />
                </label>
                <button
                  type="button"
                  disabled={!bookingFile || isBookingAiChecking}
                  onClick={() => bookingFile && void handleBookingFileSelection(bookingFile, 'create')}
                  className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold disabled:opacity-50"
                >
                  {isBookingAiChecking ? 'Đang quét AI...' : 'Quét lại Booking bằng AI'}
                </button>
              </div>
              <FieldError message={formErrors.bookingEvidence} />
              {bookingAiResult && (
                <BookingAiResultPanel check={bookingAiResult} />
              )}
            </div>
            <div>
              <label htmlFor="request-carrierId" className="text-slate-700 font-semibold text-xs sm:text-sm block mb-1">Hãng tàu cấp vỏ <RequiredMark /></label>
              <select 
                id="request-carrierId"
                data-field="carrierId"
                value={form.carrierId || ''}
                onChange={e => { clearRequestError('carrierId'); setForm(p => ({ ...p, carrierId: e.target.value })); }}
                aria-invalid={Boolean(formErrors.carrierId)}
                className={getFieldErrorClass(Boolean(formErrors.carrierId), 'w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-500 bg-white')}
              >
                <option value="">-- Chọn hãng tàu --</option>
                {INITIAL_CARRIERS.filter(c => c.isActive).map(c => (
                  <option key={c.id} value={c.id}>{c.code} · {c.name}</option>
                ))}
                </select>
                <FieldError message={formErrors.carrierId} />
            </div>
            <div>
              <label htmlFor="request-containerType" className="text-slate-700 font-semibold text-xs sm:text-sm block mb-1">Loại container <RequiredMark /></label>
              <select 
                id="request-containerType"
                data-field="containerType"
                value={form.containerType || ''}
                onChange={e => { clearRequestError('containerType'); setForm(p => ({ ...p, containerType: e.target.value ? e.target.value as '20GP' | '40HC' : undefined })); }}
                aria-invalid={Boolean(formErrors.containerType)}
                className={getFieldErrorClass(Boolean(formErrors.containerType), 'w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-500 bg-white')}
              >
                <option value="">-- Chọn loại container --</option>
                <option value="40HC">40HC (40 foot cao)</option>
                <option value="20GP">20GP (20 foot tiêu chuẩn)</option>
              </select>
              <FieldError message={formErrors.containerType} />
            </div>
            <div>
              <label className="text-slate-700 font-semibold text-xs sm:text-sm block mb-1">Địa điểm nhận cont / đóng hàng <RequiredMark /></label>
              <input
                id="request-deliveryLocationName"
                data-field="deliveryLocationName"
                value={form.deliveryLocationName || ''}
                onChange={e => { clearRequestError('deliveryLocationName'); setForm(p => ({ ...p, deliveryLocationName: e.target.value })); }}
                placeholder="Kho KCN VSIP 1, Bình Dương..."
                aria-invalid={Boolean(formErrors.deliveryLocationName)}
                className={getFieldErrorClass(Boolean(formErrors.deliveryLocationName), 'w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-500 bg-white')}
              />
              <FieldError message={formErrors.deliveryLocationName} />
            </div>
            <div>
              <label className="text-slate-700 font-semibold text-xs sm:text-sm block mb-1">Lấy cont sớm nhất <RequiredMark /></label>
              <DateInput
                id="request-pickupWindowStart"
                data-field="pickupWindowStart"
                value={form.pickupWindowStart}
                onChange={v => { clearRequestError('pickupWindowStart'); clearRequestError('pickupWindowEnd'); setForm(p => ({ ...p, pickupWindowStart: v || undefined })); }}
                aria-invalid={Boolean(formErrors.pickupWindowStart)}
                className={getFieldErrorClass(Boolean(formErrors.pickupWindowStart), 'w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-500 bg-white')}
              />
              <FieldError message={formErrors.pickupWindowStart} />
            </div>
            <div>
              <label className="text-slate-700 font-semibold text-xs sm:text-sm block mb-1">Lấy cont muộn nhất <RequiredMark /></label>
              <DateInput
                id="request-pickupWindowEnd"
                data-field="pickupWindowEnd"
                value={form.pickupWindowEnd}
                endOfDay
                onChange={v => { clearRequestError('pickupWindowStart'); clearRequestError('pickupWindowEnd'); setForm(p => ({ ...p, pickupWindowEnd: v || undefined })); }}
                aria-invalid={Boolean(formErrors.pickupWindowEnd)}
                className={getFieldErrorClass(Boolean(formErrors.pickupWindowEnd), 'w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-500 bg-white')}
              />
              <FieldError message={formErrors.pickupWindowEnd} />
            </div>
            <div>
              <label className="text-slate-700 font-semibold text-xs sm:text-sm block mb-1">Thời hạn Cut-off booking <RequiredMark /></label>
              <DateInput
                id="request-cutOffTime"
                data-field="cutOffTime"
                value={form.cutOffTime}
                endOfDay
                onChange={v => { clearRequestError('cutOffTime'); setForm(p => ({ ...p, cutOffTime: v || undefined })); }}
                aria-invalid={Boolean(formErrors.cutOffTime)}
                className={getFieldErrorClass(Boolean(formErrors.cutOffTime), 'w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-500 bg-white')}
              />
              <FieldError message={formErrors.cutOffTime} />
            </div>
            <div>
              <label className="text-slate-700 font-semibold text-xs sm:text-sm block mb-1">Bán kính quét ghép đôi tối đa (Dmax: km) <RequiredMark /></label>
              <input 
                type="number" 
                min="5" 
                max="100" 
                id="request-maxDistanceKm"
                data-field="maxDistanceKm"
                value={form.maxDistanceKm ?? ''}
                onChange={e => { clearRequestError('maxDistanceKm'); setForm(p => ({ ...p, maxDistanceKm: e.target.value === '' ? undefined : parseInt(e.target.value, 10) })); }}
                placeholder="VD: 40"
                aria-invalid={Boolean(formErrors.maxDistanceKm)}
                className={getFieldErrorClass(Boolean(formErrors.maxDistanceKm), 'w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-500 bg-white')}
              />
              <FieldError message={formErrors.maxDistanceKm} />
            </div>
            <div>
              <label className="text-slate-700 font-semibold text-xs sm:text-sm block mb-1">Loại hàng xuất khẩu</label>
              <input 
                value={form.cargoType || ''}
                onChange={e => setForm(p => ({ ...p, cargoType: e.target.value }))}
                placeholder="Hàng dệt may, nông sản, linh kiện điện tử..."
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-500 bg-white" 
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
            <button onClick={() => setShowAddForm(false)} className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl">
              Hủy
            </button>
            <button onClick={handleAddRequest} className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-sm transition-all">
              Tạo Nhu Cầu & Tự Động Quét Ghép Đôi
            </button>
          </div>
        </div>
      )}

      {/* Edit Request Modal */}
      {editingRequest && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-cyan-600" />
                <span>CHỈNH SỬA NHU CẦU: {editingRequest.bookingNumber} (UPDATE)</span>
              </h3>
              <button onClick={() => setEditingRequest(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <FormErrorSummary errors={editErrors} />
            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-700 font-semibold block mb-1">Số Booking <RequiredMark /></label>
                <input
                  id="edit-bookingNumber"
                  data-field="edit-bookingNumber"
                  value={editForm.bookingNumber || ''}
                  onChange={e => { setEditErrors(previous => { const next = { ...previous }; delete next['edit-bookingNumber']; return next; }); setEditForm(p => ({ ...p, bookingNumber: e.target.value.toUpperCase() })); }}
                  placeholder="MSKBKG2026-981..."
                  aria-invalid={Boolean(editErrors['edit-bookingNumber'])}
                  className={getFieldErrorClass(Boolean(editErrors['edit-bookingNumber']), 'w-full p-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-cyan-500')}
                />
                <FieldError message={editErrors['edit-bookingNumber']} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="edit-carrierId" className="text-slate-700 font-semibold block mb-1">Hãng tàu cấp vỏ <RequiredMark /></label>
                  <select
                    id="edit-carrierId"
                    data-field="edit-carrierId"
                    value={editForm.carrierId || ''}
                    onChange={e => { setEditErrors(previous => { const next = { ...previous }; delete next['edit-carrierId']; return next; }); setEditForm(p => ({ ...p, carrierId: e.target.value })); }}
                    aria-invalid={Boolean(editErrors['edit-carrierId'])}
                    className={getFieldErrorClass(Boolean(editErrors['edit-carrierId']), 'w-full p-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-cyan-500 bg-white')}
                  >
                    <option value="">-- Chọn hãng tàu --</option>
                    {INITIAL_CARRIERS.filter(carrier => carrier.isActive).map(carrier => (
                      <option key={carrier.id} value={carrier.id}>{carrier.code} · {carrier.name}</option>
                    ))}
                  </select>
                  <FieldError message={editErrors['edit-carrierId']} />
                </div>
                <div>
                  <label htmlFor="edit-containerType" className="text-slate-700 font-semibold block mb-1">Loại container <RequiredMark /></label>
                  <select
                    id="edit-containerType"
                    data-field="edit-containerType"
                    value={editForm.containerType || ''}
                    onChange={e => { setEditErrors(previous => { const next = { ...previous }; delete next['edit-containerType']; return next; }); setEditForm(p => ({ ...p, containerType: e.target.value as '20GP' | '40HC' })); }}
                    aria-invalid={Boolean(editErrors['edit-containerType'])}
                    className={getFieldErrorClass(Boolean(editErrors['edit-containerType']), 'w-full p-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-cyan-500 bg-white')}
                  >
                    <option value="">-- Chọn loại container --</option>
                    <option value="40HC">40HC (40 foot cao)</option>
                    <option value="20GP">20GP (20 foot tiêu chuẩn)</option>
                  </select>
                  <FieldError message={editErrors['edit-containerType']} />
                </div>
              </div>
              <div>
                <label className="text-slate-700 font-semibold block mb-1">Địa điểm giao hàng <RequiredMark /></label>
                <input
                  type="text"
                  id="edit-deliveryLocationName"
                  data-field="edit-deliveryLocationName"
                  value={editForm.deliveryLocationName || ''}
                  onChange={e => { setEditErrors(previous => { const next = { ...previous }; delete next['edit-deliveryLocationName']; return next; }); setEditForm(p => ({ ...p, deliveryLocationName: e.target.value })); }}
                  placeholder="Kho, cảng hoặc địa điểm đóng hàng..."
                  aria-invalid={Boolean(editErrors['edit-deliveryLocationName'])}
                  className={getFieldErrorClass(Boolean(editErrors['edit-deliveryLocationName']), 'w-full p-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-cyan-500')}
                />
                <FieldError message={editErrors['edit-deliveryLocationName']} />
              </div>

              <div
                data-field="edit-bookingEvidence"
                className={getFieldErrorClass(Boolean(editErrors['edit-bookingEvidence']), 'rounded-xl border border-blue-200 bg-blue-50/50 p-3 space-y-2')}
              >
                <label className="text-slate-700 font-semibold block mb-1">File Booking (ảnh hoặc PDF) <RequiredMark /></label>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex min-w-[220px] flex-1 items-center gap-2 border border-slate-200 bg-white rounded-lg px-3 py-2 cursor-pointer hover:bg-slate-50">
                    <UploadCloud className="w-4 h-4 text-blue-600 shrink-0" />
                    <span className="truncate text-xs font-medium text-slate-700">{editForm.bookingFileName || 'Chọn file Booking ảnh/PDF'}</span>
                    <input
                      type="file"
                      accept=".pdf,application/pdf,image/png,image/jpeg,image/jpg,image/webp"
                      className="hidden"
                      onChange={event => {
                        const file = event.target.files?.[0];
                        event.target.value = '';
                        if (file) void handleBookingFileSelection(file, 'edit');
                      }}
                    />
                  </label>
                  <button
                      type="button"
                      disabled={!editBookingFile || isEditBookingAiChecking}
                      onClick={() => editBookingFile && void handleBookingFileSelection(editBookingFile, 'edit')}
                      className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold disabled:opacity-50"
                    >
                      {isEditBookingAiChecking ? 'Đang quét AI...' : 'Quét lại Booking bằng AI'}
                    </button>
                  </div>
                  <FieldError message={editErrors['edit-bookingEvidence']} />
                  {editBookingAiResult && (
                    <BookingAiResultPanel check={editBookingAiResult} />
                  )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="edit-pickupWindowStart" className="text-slate-700 font-semibold block mb-1">Lấy cont sớm nhất <RequiredMark /></label>
                  <DateInput
                    id="edit-pickupWindowStart"
                    data-field="edit-pickupWindowStart"
                    value={editForm.pickupWindowStart}
                    onChange={v => { setEditErrors(previous => { const next = { ...previous }; delete next['edit-pickupWindowStart']; delete next['edit-pickupWindowEnd']; return next; }); setEditForm(p => ({ ...p, pickupWindowStart: v || undefined })); }}
                    aria-invalid={Boolean(editErrors['edit-pickupWindowStart'])}
                    className={getFieldErrorClass(Boolean(editErrors['edit-pickupWindowStart']), 'w-full p-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-cyan-500')}
                  />
                  <FieldError message={editErrors['edit-pickupWindowStart']} />
                </div>
                <div>
                  <label htmlFor="edit-pickupWindowEnd" className="text-slate-700 font-semibold block mb-1">Lấy cont muộn nhất <RequiredMark /></label>
                  <DateInput
                    id="edit-pickupWindowEnd"
                    data-field="edit-pickupWindowEnd"
                    value={editForm.pickupWindowEnd}
                    endOfDay
                    onChange={v => { setEditErrors(previous => { const next = { ...previous }; delete next['edit-pickupWindowStart']; delete next['edit-pickupWindowEnd']; return next; }); setEditForm(p => ({ ...p, pickupWindowEnd: v || undefined })); }}
                    aria-invalid={Boolean(editErrors['edit-pickupWindowEnd'])}
                    className={getFieldErrorClass(Boolean(editErrors['edit-pickupWindowEnd']), 'w-full p-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-cyan-500')}
                  />
                  <FieldError message={editErrors['edit-pickupWindowEnd']} />
                </div>
              </div>
              <div>
                <label htmlFor="edit-cutOffTime" className="text-slate-700 font-semibold block mb-1">Thời hạn Cut-off booking <RequiredMark /></label>
                <DateInput
                  id="edit-cutOffTime"
                  data-field="edit-cutOffTime"
                  value={editForm.cutOffTime}
                  endOfDay
                  onChange={v => { setEditErrors(previous => { const next = { ...previous }; delete next['edit-cutOffTime']; return next; }); setEditForm(p => ({ ...p, cutOffTime: v || undefined })); }}
                  aria-invalid={Boolean(editErrors['edit-cutOffTime'])}
                  className={getFieldErrorClass(Boolean(editErrors['edit-cutOffTime']), 'w-full p-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-cyan-500')}
                />
                <FieldError message={editErrors['edit-cutOffTime']} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 font-semibold block mb-1">Bán kính quét Dmax (km) <RequiredMark /></label>
                  <input
                    type="number"
                    id="edit-maxDistanceKm"
                    data-field="edit-maxDistanceKm"
                    value={editForm.maxDistanceKm ?? ''}
                    onChange={e => { setEditErrors(previous => { const next = { ...previous }; delete next['edit-maxDistanceKm']; return next; }); setEditForm(p => ({ ...p, maxDistanceKm: e.target.value === '' ? undefined : parseInt(e.target.value, 10) })); }}
                    placeholder="VD: 40"
                    aria-invalid={Boolean(editErrors['edit-maxDistanceKm'])}
                    className={getFieldErrorClass(Boolean(editErrors['edit-maxDistanceKm']), 'w-full p-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-cyan-500')}
                  />
                  <FieldError message={editErrors['edit-maxDistanceKm']} />
                </div>

              </div>

              <div>
                <label className="text-slate-700 font-semibold block mb-1">Loại hàng</label>
                <input
                  type="text"
                  value={editForm.cargoType || ''}
                  onChange={e => setEditForm(p => ({ ...p, cargoType: e.target.value }))}
                  placeholder="Hàng dệt may, nông sản, linh kiện điện tử..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setEditingRequest(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Hủy
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-4 py-2 text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl shadow-sm"
              >
                Lưu Thay Đổi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Tìm theo số booking, hãng tàu, địa điểm..."
            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-cyan-500 outline-none bg-white"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {['all', 'DRAFT', 'UNDER_REVIEW', 'OPEN', 'HELD'].map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                filterStatus === s 
                  ? 'bg-cyan-600 text-white border-cyan-600 shadow-sm' 
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {s === 'all' ? 'Tất cả' :
               s === 'DRAFT' ? 'Nháp' :
               s === 'UNDER_REVIEW' ? 'Đang xác minh' :
               s === 'OPEN' ? 'Đang tìm vỏ' : 'Đã giữ chỗ'}
            </button>
          ))}
        </div>
      </div>

      {/* Requests List Cards */}
      <div className="space-y-4">
        {filtered.length === 0 && (
          <div className="text-center py-16 space-y-3 bg-white border border-slate-200 rounded-2xl p-8">
            <Target className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="text-base font-bold text-slate-700">Không có nhu cầu nào phù hợp</h3>
            <p className="text-xs text-slate-500">{search ? 'Không tìm thấy kết quả.' : 'Hãy tạo nhu cầu tìm vỏ đầu tiên.'}</p>
          </div>
        )}

        {filtered.map(req => {
          const requestMatchResult = autoMatchMap[req.id];
          const isOwnRequest = req.companyId === currentCompany.id;
          const canManageMatching = isRequesterRole && isOwnRequest;
          const autoMatchResult = canManageMatching ? requestMatchResult : undefined;
          const bestMatch = autoMatchResult?.candidates[0];
          const isMatching = matchingForId === req.id;

          return (
            <div 
              key={req.id} 
              className={`bg-white rounded-2xl border shadow-sm transition-all hover:shadow-md p-5 space-y-4 ${
                bestMatch ? 'border-emerald-200 ring-1 ring-emerald-100' : 'border-slate-200'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-slate-900 text-base">{req.bookingNumber}</span>
                    <span className="text-xs font-semibold text-slate-600">{req.carrierCode} · {req.containerType}</span>
                    <RequestStatusBadge status={req.status} size="xs" />
                  </div>
                  <div className="text-xs text-slate-600 mt-1.5 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>{req.deliveryLocationName}</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1.5 flex items-center gap-3 flex-wrap">
                    <span>Lấy: {formatDate(req.pickupWindowStart)} → {formatDate(req.pickupWindowEnd)}</span>
                    <span>Cut-off: {formatDate(req.cutOffTime)}</span>
                    <span>Dmax: {req.maxDistanceKm}km</span>
                  </div>
                </div>

                {/* Auto-Match Live Badge */}
                {req.status === 'OPEN' && autoMatchResult && (
                  <div className="text-right">
                    {autoMatchResult.candidates.length > 0 ? (
                      <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5 shadow-sm">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                        <span>Tự động khớp {autoMatchResult.candidates.length} vỏ</span>
                      </span>
                    ) : (
                      <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-slate-50 text-slate-500 border border-slate-200">
                        Chưa có Offer phù hợp
                      </span>
                    )}
                  </div>
                )}
                {isRequesterRole && req.companyId === currentCompany.id && req.status !== 'OPEN' && ['DRAFT', 'UNDER_REVIEW', 'CHANGES_REQUIRED'].includes(req.status) && (
                  <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                    {req.status === 'DRAFT' ? 'Gửi Ops xác minh để bật auto-match' : 'Đang chờ Ops duyệt để bật auto-match'}
                  </span>
                )}
              </div>

              {req.bookingFileName && (!isSupplierRole || (isRequesterRole && req.companyId === currentCompany.id)) && (
                <div className={`space-y-2 rounded-xl border ${currentRole === 'OPS' ? 'border-blue-200 bg-blue-50/50' : 'border-slate-200 bg-slate-50/70'} px-3 py-2 text-xs`}>
                  <div className="flex flex-wrap items-center gap-2 text-slate-700">
                    <FileText className="w-3.5 h-3.5 shrink-0 text-blue-600" />
                    <span className="font-semibold">File Booking: {req.bookingFileName}</span>
                    {currentRole === 'OPS' && (
                      <span>· AI: {req.bookingAiCheck?.comparisonStatus === 'MATCHED' && req.bookingAiCheck.status === 'VALID' ? 'hợp lệ, khớp thông tin' : req.bookingAiCheck?.comparisonStatus === 'MISMATCH' || req.bookingAiCheck?.status === 'INVALID' || req.bookingAiCheck?.status === 'ANOMALY' ? 'có sai lệch/cảnh báo' : 'chờ Ops kiểm tra'}</span>
                    )}
                  </div>
                  {currentRole === 'OPS' && req.bookingAiCheck && <BookingAiResultPanel check={req.bookingAiCheck} />}
                  {currentRole === 'OPS' && req.bookingAiCheck && (
                    <div className="rounded-lg border border-violet-200 bg-violet-50/70 p-2.5 text-violet-950">
                      <strong>Kết quả AI đối chiếu với thông tin đăng ký:</strong>
                      <div className="mt-1.5 grid grid-cols-2 gap-1.5 text-[11px]">
                        <span className="rounded bg-white px-2 py-1">Đăng ký số Booking: <strong>{req.bookingNumber}</strong></span>
                        <span className="rounded bg-white px-2 py-1">Đăng ký hãng tàu: <strong>{req.carrierCode}</strong></span>
                        <span className="rounded bg-white px-2 py-1">Đăng ký loại cont: <strong>{req.containerType}</strong></span>
                        <span className="rounded bg-white px-2 py-1">Đăng ký cut-off: <strong>{formatDate(req.cutOffTime)}</strong></span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Real-time Top Auto-Match Highlight Card */}
              {req.status === 'OPEN' && bestMatch && !isMatching && (
                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-mono font-bold text-sm shadow-sm">
                      {bestMatch.scoreM}
                    </div>
                    <div className="text-xs">
                      <div className="flex items-center gap-2">
                        <strong className="text-slate-900 font-mono text-sm">{bestMatch.offer.asset.containerNumber}</strong>
                        <span className="text-emerald-800 font-bold">Top Ghép Đôi Tối Ưu</span>
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Cách {bestMatch.distanceKm}km ({bestMatch.offer.pickupLocationName}) · Tiết kiệm: <strong className="font-mono text-emerald-700 font-bold">{formatVnd(Math.abs(bestMatch.quote.sBVnd))}</strong>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleHoldReservation(bestMatch, req)}
                      disabled={bestMatch.requiresLocationRefresh}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Chọn Offer · Gửi Match</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Review notes */}
              {req.reviewerNotes && (
                <p className="p-3 bg-slate-50 rounded-xl text-xs text-slate-600 border border-slate-100">
                  Ghi chú xác minh: {req.reviewerNotes}
                </p>
              )}

              {/* Card Actions (CRUD) */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  {/* Send review */}
                  {(req.status === 'DRAFT' || req.status === 'CHANGES_REQUIRED') && isRequesterRole && req.companyId === currentCompany.id && (
                    <button
                      onClick={() => { const result = submitRequestForReview(req.id); showMsg(result.message, !result.success); }}
                      className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Gửi xác minh Booking</span>
                    </button>
                  )}

                  {/* Toggle match results view */}
                  {canManageMatching && req.status === 'OPEN' && (
                    <button
                      onClick={() => setMatchingForId(isMatching ? null : req.id)}
                      className="px-3.5 py-2 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{isMatching ? 'Ẩn kết quả auto-match' : autoMatchResult?.candidates.length ? `Xem tất cả ${autoMatchResult.candidates.length} ứng viên` : 'Xem lý do chưa khớp'}</span>
                    </button>
                  )}

                  {isSupplierRole && req.status === 'OPEN' && req.companyId !== currentCompany.id && (
                    <button
                      type="button"
                      onClick={() => handleStartChat(req)}
                      className="px-3.5 py-2 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold flex items-center gap-1.5 shadow-sm"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>Chat với đối tác</span>
                    </button>
                  )}

                  {/* Ops quick review */}
                  {canOpsReview && req.status === 'UNDER_REVIEW' && (
                    <div className="flex flex-wrap items-end gap-1.5">
                      <div>
                        <label htmlFor={`opsNotes-${req.id}`} className="block text-[11px] font-semibold text-slate-600 mb-1">Ghi chú xác minh <RequiredMark /></label>
                        <input
                          id={`opsNotes-${req.id}`}
                          data-field={`opsNotes-${req.id}`}
                          value={opsNotes}
                          onChange={e => { setOpsNotes(e.target.value); setOpsErrors(previous => ({ ...previous, [`opsNotes-${req.id}`]: '' })); }}
                          aria-invalid={Boolean(opsErrors[`opsNotes-${req.id}`])}
                          className={getFieldErrorClass(Boolean(opsErrors[`opsNotes-${req.id}`]), 'w-56 px-3 py-2 rounded-xl border border-slate-200 text-xs outline-none focus:ring-2 focus:ring-cyan-500')}
                          placeholder="Kết luận Ops..."
                        />
                        <FieldError message={opsErrors[`opsNotes-${req.id}`]} />
                      </div>
                      <button
                        onClick={() => handleOpsDecision(req.id, 'APPROVE')}
                        className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm"
                      >
                        Xác nhận Booking (OPEN)
                      </button>
                      <button
                        onClick={() => handleOpsDecision(req.id, 'REJECT')}
                        className="px-3.5 py-2 rounded-xl border border-red-200 bg-red-50 text-red-700 text-xs font-semibold"
                      >
                        Từ chối
                      </button>
                    </div>
                  )}
                </div>

                {/* Edit, Delete, Withdraw */}
                <div className="flex items-center gap-1.5">
                  {isRequesterRole && req.companyId === currentCompany.id && !['HELD', 'ALLOCATED', 'FULFILLED'].includes(req.status) && (
                    <button
                      onClick={() => handleStartEdit(req)}
                      className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 text-xs shadow-sm transition-colors"
                      title="Chỉnh sửa Nhu cầu"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  )}

                  {isRequesterRole && req.companyId === currentCompany.id && ['DRAFT', 'WITHDRAWN', 'CHANGES_REQUIRED'].includes(req.status) && (
                    <button
                      onClick={() => handleDeleteRequest(req.id)}
                      className="p-2 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 text-xs shadow-sm transition-colors"
                      title="Xóa Nhu cầu"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}

                  {!['HELD', 'ALLOCATED', 'FULFILLED', 'WITHDRAWN', 'EXPIRED'].includes(req.status) && isRequesterRole && req.companyId === currentCompany.id && (
                    <button
                      onClick={() => setWithdrawId(req.id)}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 text-xs font-semibold shadow-sm transition-colors"
                    >
                      Rút nhu cầu
                    </button>
                  )}
                </div>
              </div>

              {/* Full Matching candidates view */}
              {isMatching && activeMatchResults && (
                <div className="pt-3 border-t border-blue-100 space-y-3 bg-slate-50/70 p-4 rounded-xl">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">
                      Tìm thấy {activeMatchResults.candidates.length} vỏ container phù hợp ({activeMatchResults.eliminatedCount} bị loại do khoảng cách / hãng)
                    </span>
                    {activeMatchResults.dataWarnings.length > 0 && (
                      <span className="text-xs text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        ⚠️ {activeMatchResults.dataWarnings[0]}
                      </span>
                    )}
                  </div>

                  {activeMatchResults.candidates.length === 0 && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 space-y-1">
                      <strong>Chưa có Offer của nhà cung cấp đủ điều kiện để ghép.</strong>
                      <p>Hệ thống đã kiểm tra trạng thái Offer, hãng tàu, loại cont, khoảng cách, thời gian và mức tiết kiệm.</p>
                      {activeMatchResults.eliminationReasons.slice(0, 3).map((item, index) => (
                        <p key={`${item.offerId}-${index}`}>• {item.reasons.join('; ')}</p>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {activeMatchResults.candidates.map(cand => (
                      <MatchCandidateCard
                        key={cand.offer.id}
                        candidate={cand}
                        onHold={() => handleHoldReservation(cand, req)}
                        onChat={() => handleStartChat(req, cand)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Withdraw Modal */}
      {withdrawId && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Rút Nhu cầu: {withdrawId}</h3>
              <button onClick={() => setWithdrawId(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <FormErrorSummary errors={withdrawErrors} />
            <div>
              <label className="text-slate-700 font-semibold text-xs block mb-1">Lý do rút <RequiredMark /></label>
              <textarea
                id="request-withdrawReason"
                data-field="withdrawReason"
                value={withdrawReason}
                onChange={e => { setWithdrawErrors({}); setWithdrawReason(e.target.value); }}
                placeholder="Đã tìm được vỏ khác hoặc thay đổi kế hoạch xuất hàng..."
                rows={3}
                aria-invalid={Boolean(withdrawErrors.withdrawReason)}
                className={getFieldErrorClass(Boolean(withdrawErrors.withdrawReason), 'w-full p-3 rounded-xl border border-slate-200 text-xs outline-none focus:ring-2 focus:ring-cyan-500')}
              />
              <FieldError message={withdrawErrors.withdrawReason} />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setWithdrawId(null)} className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl">Hủy</button>
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
