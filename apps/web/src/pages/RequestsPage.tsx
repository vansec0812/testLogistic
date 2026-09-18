// ==============================================================================
// ECont RequestsPage - Version 2.0 (Full CRUD & Real-Time Auto-Matching)
// Quản lý Nhu cầu với Create, Read, Update, Delete & Tự Động Match Container
// ==============================================================================

import React, { useState, useMemo, useEffect } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { useAuth } from '../context/AuthContext';
import { ContainerRequest, CreateRequestForm, MatchCandidate } from '../types';
import { RequestStatusBadge, ConditionBadge } from '../components/StatusBadge';
import { PricingBreakdownCard } from '../components/PricingBreakdownCard';
import { formatVnd, formatDistance, formatDateTime, formatRelativeTime } from '../lib/utils';
import {
  Search, Plus, AlertTriangle, CheckCircle2, X, Clock, MapPin,
  Sparkles, Send, TrendingDown, ChevronDown, ChevronUp, AlertCircle,
  Ship, Target, BarChart3, Star, Edit2, Trash2, Eye, Lock, ArrowRight, Check, Shield
} from 'lucide-react';
import { findMatchesForRequest } from '../services/matchingEngine';
import { INITIAL_CARRIERS } from '../data/mockData';
import { FieldErrors, FieldError, FormErrorSummary, RequiredMark, getFieldErrorClass, scrollToFirstFieldError } from '../components/FormValidation';
import { required, positiveNumber, validDateRange, validFutureDate, setError } from '../lib/formValidation';

interface RequestsPageProps {
  setCurrentTab?: (tab: string) => void;
  setSelectedTxnId?: (id: string) => void;
}

function MatchCandidateCard({
  candidate,
  onHold,
}: {
  candidate: MatchCandidate;
  onHold: () => void;
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
            {/* BẢO MẬT: ẨN CONTAINER NUMBER */}
            <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-1 font-mono">
              <span className="text-[10px]">🔒</span> Cont #••••••• (Bảo mật)
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

      {/* 7 THÔNG TIN CHUẨN MỰC HIỂN THỊ CHO BÊN B */}
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
          <span className="text-slate-500 block">Điểm uy tín Bên A</span>
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
            ⏱️ {formatDateTime(offer.availableFrom)} → {formatDateTime(offer.availableTo)}
          </strong>
        </div>
      </div>

      {/* 7. Mức tiết kiệm ước tính (Estimated saving) & Báo giá */}
      <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-100">
        <div>
          <span className="text-slate-600">Tiết kiệm ước tính cho Bên B: </span>
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
    holdAtomicReservation 
  } = useDatabase();
  const { currentRole, currentCompany, canOpsReview, canCreateRequests } = useAuth();
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

  // Auto-Match Alert Modal when new request is created
  const [autoMatchModalReq, setAutoMatchModalReq] = useState<ContainerRequest | null>(null);

  const [form, setForm] = useState<Partial<CreateRequestForm>>({
    containerType: '40HC',
    maxDistanceKm: 40,
    baselinePickupCostVnd: 3400000,
    carrierId: 'CARR-MSK',
  });

  const showMsg = (msg: string, isError = false) => {
    if (isError) setErrorMsg(msg);
    else setSuccessMsg(msg);
    setTimeout(() => { setErrorMsg(''); setSuccessMsg(''); }, 5000);
  };

  const availableOffers = useMemo(() => offers.filter(o => o.status === 'AVAILABLE'), [offers]);

  const filtered = useMemo(() => {
    let list = requests;
    if (currentRole === 'ENTERPRISE_B') list = list.filter(r => r.companyId === currentCompany.id);
    if (currentRole === 'ENTERPRISE_A') list = [];
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
    return list;
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
    if (form.bookingNumber && !/^[A-Z0-9][A-Z0-9-]{4,}$/.test(form.bookingNumber.trim().toUpperCase())) {
      errors.bookingNumber = 'Số Booking phải có ít nhất 5 ký tự, chỉ gồm chữ, số và dấu gạch ngang.';
    }
    setError(errors, 'carrierId', required(form.carrierId, 'Vui lòng chọn hãng tàu cấp vỏ.'));
    setError(errors, 'deliveryLocationName', required(form.deliveryLocationName, 'Vui lòng nhập địa điểm nhận cont/đóng hàng.'));
    setError(errors, 'pickupWindowStart', validFutureDate(form.pickupWindowStart, 'thời điểm lấy cont sớm nhất'));
    setError(errors, 'pickupWindowEnd', validDateRange(form.pickupWindowStart, form.pickupWindowEnd, 'khung thời gian lấy cont'));
    setError(errors, 'cutOffTime', validFutureDate(form.cutOffTime, 'thời hạn cut-off booking'));
    if (!Number.isFinite(Number(form.maxDistanceKm)) || Number(form.maxDistanceKm) < 5 || Number(form.maxDistanceKm) > 100) {
      errors.maxDistanceKm = 'Bán kính Dmax phải từ 5 đến 100 km.';
    }
    setError(errors, 'baselinePickupCostVnd', positiveNumber(form.baselinePickupCostVnd, 'Chi phí baseline phải lớn hơn 0.'));
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
      containerType: form.containerType || '40HC',
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
      baselinePickupCostVnd: Number(form.baselinePickupCostVnd),
    });
    if (result.success) {
      showMsg(result.message);
      setShowAddForm(false);
      const createdReq = result.data as ContainerRequest;
      setForm({ containerType: '40HC', maxDistanceKm: 40, baselinePickupCostVnd: 3400000, carrierId: 'CARR-MSK' });
      setFormErrors({});
      if (createdReq) {
        const instantMatches = findMatchesForRequest(createdReq, availableOffers);
        if (instantMatches.candidates.length > 0) setAutoMatchModalReq(createdReq);
      }
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
      deliveryLocationName: req.deliveryLocationName,
      maxDistanceKm: req.maxDistanceKm,
      baselinePickupCostVnd: req.baselinePickupCostVnd,
      cargoType: req.cargoType,
      cargoRequirements: req.cargoRequirements || '',
    });
  };

  const handleSaveEdit = () => {
    if (!editingRequest) return;
    const errors: FieldErrors = {};
    setError(errors, 'edit-bookingNumber', required(editForm.bookingNumber, 'Vui lòng nhập số Booking.'));
    setError(errors, 'edit-deliveryLocationName', required(editForm.deliveryLocationName, 'Vui lòng nhập địa điểm giao hàng.'));
    if (!Number.isFinite(Number(editForm.maxDistanceKm)) || Number(editForm.maxDistanceKm) < 5 || Number(editForm.maxDistanceKm) > 100) {
      errors['edit-maxDistanceKm'] = 'Bán kính Dmax phải từ 5 đến 100 km.';
    }
    setError(errors, 'edit-baselinePickupCostVnd', positiveNumber(editForm.baselinePickupCostVnd, 'Chi phí baseline phải lớn hơn 0.'));
    setEditErrors(errors);
    if (Object.keys(errors).length > 0) {
      showMsg(Object.values(errors)[0], true);
      scrollToFirstFieldError(errors);
      return;
    }
    const result = updateRequest(editingRequest.id, {
      ...editForm,
      bookingNumber: editForm.bookingNumber!.trim().toUpperCase(),
      deliveryLocationName: editForm.deliveryLocationName!.trim(),
      maxDistanceKm: Number(editForm.maxDistanceKm),
      baselinePickupCostVnd: Number(editForm.baselinePickupCostVnd),
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
      showMsg(`✓ Đã gửi yêu cầu ghép ${matchData?.matchId || ''}. Chưa reserve cont; chờ Bên A Accept.`);
      setMatchingForId(null);
      setAutoMatchModalReq(null);
    } else {
      showMsg(result.message, true);
    }
  };

  if (currentRole === 'ENTERPRISE_A') {
    return (
      <div className="text-center py-16 space-y-3 bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
        <Search className="w-12 h-12 text-slate-300 mx-auto" />
        <h3 className="text-lg font-bold text-slate-800">Khu vực dành cho Bên B</h3>
        <p className="text-sm text-slate-500">Bên A không tạo nhu cầu lấy vỏ. Hãy chuyển sang tab "Nguồn cung" để đăng Offer.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Search className="w-6 h-6 text-cyan-600" />
            <span>{currentRole === 'ENTERPRISE_B' ? 'Quản lý Nhu cầu & Tự động Ghép đôi' : 'Danh sách Nhu cầu tìm vỏ'}</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {currentRole === 'ENTERPRISE_B'
              ? 'Tự động dò tìm và ghép đôi vỏ container rỗng theo Hãng tàu, Loại cont và Bán kính Dmax'
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
      {currentRole === 'ENTERPRISE_B' && currentCompany.verificationStatus !== 'VERIFIED' && (
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
            <div>
              <label className="text-slate-700 font-semibold text-xs sm:text-sm block mb-1">Hãng tàu cấp vỏ <RequiredMark /></label>
              <select 
                id="request-carrierId"
                data-field="carrierId"
                value={form.carrierId || ''}
                onChange={e => { clearRequestError('carrierId'); setForm(p => ({ ...p, carrierId: e.target.value })); }}
                aria-invalid={Boolean(formErrors.carrierId)}
                className={getFieldErrorClass(Boolean(formErrors.carrierId), 'w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-500 bg-white')}
              >
                {INITIAL_CARRIERS.filter(c => c.isActive).map(c => (
                  <option key={c.id} value={c.id}>{c.code} · {c.name}</option>
                ))}
                </select>
                <FieldError message={formErrors.carrierId} />
            </div>
            <div>
              <label className="text-slate-700 font-semibold text-xs sm:text-sm block mb-1">Loại container</label>
              <select 
                value={form.containerType} 
                onChange={e => setForm(p => ({ ...p, containerType: e.target.value as '20GP' | '40HC' }))}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-500 bg-white"
              >
                <option value="40HC">40HC (40 foot cao)</option>
                <option value="20GP">20GP (20 foot tiêu chuẩn)</option>
              </select>
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
              <input 
                id="request-pickupWindowStart"
                data-field="pickupWindowStart"
                type="datetime-local"
                value={form.pickupWindowStart ? form.pickupWindowStart.slice(0, 16) : ''}
                onChange={e => { clearRequestError('pickupWindowStart'); clearRequestError('pickupWindowEnd'); setForm(p => ({ ...p, pickupWindowStart: e.target.value ? new Date(e.target.value).toISOString() : undefined })); }}
                aria-invalid={Boolean(formErrors.pickupWindowStart)}
                className={getFieldErrorClass(Boolean(formErrors.pickupWindowStart), 'w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-500 bg-white')}
              />
              <FieldError message={formErrors.pickupWindowStart} />
            </div>
            <div>
              <label className="text-slate-700 font-semibold text-xs sm:text-sm block mb-1">Lấy cont muộn nhất <RequiredMark /></label>
              <input 
                id="request-pickupWindowEnd"
                data-field="pickupWindowEnd"
                type="datetime-local"
                value={form.pickupWindowEnd ? form.pickupWindowEnd.slice(0, 16) : ''}
                onChange={e => { clearRequestError('pickupWindowStart'); clearRequestError('pickupWindowEnd'); setForm(p => ({ ...p, pickupWindowEnd: e.target.value ? new Date(e.target.value).toISOString() : undefined })); }}
                aria-invalid={Boolean(formErrors.pickupWindowEnd)}
                className={getFieldErrorClass(Boolean(formErrors.pickupWindowEnd), 'w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-500 bg-white')}
              />
              <FieldError message={formErrors.pickupWindowEnd} />
            </div>
            <div>
              <label className="text-slate-700 font-semibold text-xs sm:text-sm block mb-1">Thời hạn Cut-off booking <RequiredMark /></label>
              <input 
                id="request-cutOffTime"
                data-field="cutOffTime"
                type="datetime-local"
                value={form.cutOffTime ? form.cutOffTime.slice(0, 16) : ''}
                onChange={e => { clearRequestError('cutOffTime'); setForm(p => ({ ...p, cutOffTime: e.target.value ? new Date(e.target.value).toISOString() : undefined })); }}
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
                aria-invalid={Boolean(formErrors.maxDistanceKm)}
                className={getFieldErrorClass(Boolean(formErrors.maxDistanceKm), 'w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-500 bg-white')}
              />
              <FieldError message={formErrors.maxDistanceKm} />
            </div>
            <div>
              <label className="text-slate-700 font-semibold text-xs sm:text-sm block mb-1">Chi phí lấy baseline T_B (VND) <RequiredMark /></label>
              <input 
                type="number" 
                id="request-baselinePickupCostVnd"
                data-field="baselinePickupCostVnd"
                value={form.baselinePickupCostVnd ?? ''}
                onChange={e => { clearRequestError('baselinePickupCostVnd'); setForm(p => ({ ...p, baselinePickupCostVnd: e.target.value === '' ? undefined : parseInt(e.target.value, 10) })); }}
                aria-invalid={Boolean(formErrors.baselinePickupCostVnd)}
                className={getFieldErrorClass(Boolean(formErrors.baselinePickupCostVnd), 'w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-500 bg-white')}
              />
              <FieldError message={formErrors.baselinePickupCostVnd} />
              <p className="text-xs text-slate-500 mt-1">Cước nếu xe phải chạy lên depot lấy cont thông thường</p>
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
                  aria-invalid={Boolean(editErrors['edit-bookingNumber'])}
                  className={getFieldErrorClass(Boolean(editErrors['edit-bookingNumber']), 'w-full p-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-cyan-500')}
                />
                <FieldError message={editErrors['edit-bookingNumber']} />
              </div>
              <div>
                <label className="text-slate-700 font-semibold block mb-1">Địa điểm giao hàng <RequiredMark /></label>
                <input
                  type="text"
                  id="edit-deliveryLocationName"
                  data-field="edit-deliveryLocationName"
                  value={editForm.deliveryLocationName || ''}
                  onChange={e => { setEditErrors(previous => { const next = { ...previous }; delete next['edit-deliveryLocationName']; return next; }); setEditForm(p => ({ ...p, deliveryLocationName: e.target.value })); }}
                  aria-invalid={Boolean(editErrors['edit-deliveryLocationName'])}
                  className={getFieldErrorClass(Boolean(editErrors['edit-deliveryLocationName']), 'w-full p-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-cyan-500')}
                />
                <FieldError message={editErrors['edit-deliveryLocationName']} />
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
                    aria-invalid={Boolean(editErrors['edit-maxDistanceKm'])}
                    className={getFieldErrorClass(Boolean(editErrors['edit-maxDistanceKm']), 'w-full p-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-cyan-500')}
                  />
                  <FieldError message={editErrors['edit-maxDistanceKm']} />
                </div>

                <div>
                  <label className="text-slate-700 font-semibold block mb-1">Chi phí baseline T_B (VND) <RequiredMark /></label>
                  <input
                    type="number"
                    id="edit-baselinePickupCostVnd"
                    data-field="edit-baselinePickupCostVnd"
                    value={editForm.baselinePickupCostVnd ?? ''}
                    onChange={e => { setEditErrors(previous => { const next = { ...previous }; delete next['edit-baselinePickupCostVnd']; return next; }); setEditForm(p => ({ ...p, baselinePickupCostVnd: e.target.value === '' ? undefined : parseInt(e.target.value, 10) })); }}
                    aria-invalid={Boolean(editErrors['edit-baselinePickupCostVnd'])}
                    className={getFieldErrorClass(Boolean(editErrors['edit-baselinePickupCostVnd']), 'w-full p-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-cyan-500')}
                  />
                  <FieldError message={editErrors['edit-baselinePickupCostVnd']} />
                </div>
              </div>

              <div>
                <label className="text-slate-700 font-semibold block mb-1">Loại hàng</label>
                <input
                  type="text"
                  value={editForm.cargoType || ''}
                  onChange={e => setEditForm(p => ({ ...p, cargoType: e.target.value }))}
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

      {/* Auto-Match Instant Result Pop-up (when a new request is created) */}
      {autoMatchModalReq && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">TỰ ĐỘNG TÌM THẤY CONTAINER GHÉP ĐÔI!</h3>
                  <p className="text-xs text-slate-600 font-medium">Booking: {autoMatchModalReq.bookingNumber} ({autoMatchModalReq.carrierCode})</p>
                </div>
              </div>
              <button onClick={() => setAutoMatchModalReq(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-slate-600">
                Hệ thống tự động phát hiện các nguồn vỏ cont của Bên A khớp hoàn toàn với booking của bạn:
              </p>
              <div className="max-h-[360px] overflow-y-auto space-y-3">
                {findMatchesForRequest(autoMatchModalReq, availableOffers).candidates.map(cand => (
                  <MatchCandidateCard
                    key={cand.offer.id}
                    candidate={cand}
                    onHold={() => handleHoldReservation(cand, autoMatchModalReq)}
                  />
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                onClick={() => setAutoMatchModalReq(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Để sau
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
          const autoMatchResult = autoMatchMap[req.id];
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
                    <span>Lấy: {formatDateTime(req.pickupWindowStart)} → {formatDateTime(req.pickupWindowEnd)}</span>
                    <span>Cut-off: {formatDateTime(req.cutOffTime)}</span>
                    <span className="font-mono font-semibold text-slate-700">T_B: {formatVnd(req.baselinePickupCostVnd)}</span>
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
                        Đang quét nguồn cont...
                      </span>
                    )}
                  </div>
                )}
              </div>

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

                  <button
                    onClick={() => handleHoldReservation(bestMatch, req)}
                    disabled={bestMatch.requiresLocationRefresh}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
                  >
                    <Lock className="w-3.5 h-3.5" />
                     <span>Chọn Offer · Gửi Match</span>
                  </button>
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
                  {(req.status === 'DRAFT' || req.status === 'CHANGES_REQUIRED') && currentRole === 'ENTERPRISE_B' && (
                    <button
                      onClick={() => { submitRequestForReview(req.id); showMsg('Đã gửi xác minh Booking tới Ops.'); }}
                      className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Gửi xác minh Booking</span>
                    </button>
                  )}

                  {/* Toggle match results view */}
                  {req.status === 'OPEN' && (
                    <button
                      onClick={() => setMatchingForId(isMatching ? null : req.id)}
                      className="px-3.5 py-2 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{isMatching ? 'Ẩn danh sách ứng viên' : `Xem tất cả ${autoMatchResult?.candidates.length || 0} ứng viên`}</span>
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
                  {!['HELD', 'ALLOCATED', 'FULFILLED'].includes(req.status) && (
                    <button
                      onClick={() => handleStartEdit(req)}
                      className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 text-xs shadow-sm transition-colors"
                      title="Chỉnh sửa Nhu cầu"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  )}

                  {['DRAFT', 'WITHDRAWN', 'CHANGES_REQUIRED'].includes(req.status) && (
                    <button
                      onClick={() => handleDeleteRequest(req.id)}
                      className="p-2 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 text-xs shadow-sm transition-colors"
                      title="Xóa Nhu cầu"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}

                  {!['HELD', 'ALLOCATED', 'FULFILLED', 'WITHDRAWN', 'EXPIRED'].includes(req.status) && currentRole === 'ENTERPRISE_B' && (
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

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {activeMatchResults.candidates.map(cand => (
                      <MatchCandidateCard
                        key={cand.offer.id}
                        candidate={cand}
                        onHold={() => handleHoldReservation(cand, req)}
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
