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
  const { offer, distanceKm, scoreM, scoreD, scoreT, scoreC, requiresLocationRefresh, locationAgeHours, quote } = candidate;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-slate-900 font-mono">{offer.asset.containerNumber}</span>
            <span className="text-xs text-slate-600 font-medium">{offer.asset.carrierCode} · {offer.asset.containerType}</span>
            <ConditionBadge condition={offer.asset.declaredCondition} size="xs" />
            {requiresLocationRefresh && (
              <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-0.5 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                Vị trí {Math.round(locationAgeHours)}h · Cần A xác nhận
              </span>
            )}
          </div>
          <p className="text-xs text-slate-600 mt-1.5 flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
            <span>{offer.pickupLocationName} · <strong className="text-cyan-700">{formatDistance(distanceKm)}</strong></span>
          </p>
        </div>

        {/* Match Score */}
        <div className="text-right shrink-0">
          <div className={`inline-flex items-center justify-center w-11 h-11 rounded-xl font-bold font-mono text-base ${
            scoreM >= 80 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm' :
            scoreM >= 60 ? 'bg-amber-50 text-amber-700 border border-amber-200 shadow-sm' :
            'bg-slate-50 text-slate-600 border border-slate-200'
          }`}>
            {scoreM}
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1">Điểm ghép M</p>
        </div>
      </div>

      {/* Score breakdown */}
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
          <p className="font-bold font-mono text-slate-800 text-sm">{scoreD}</p>
          <p className="text-xs text-slate-500 mt-0.5">📍 Cự ly ({distanceKm}km)</p>
        </div>
        <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
          <p className="font-bold font-mono text-slate-800 text-sm">{scoreT}</p>
          <p className="text-xs text-slate-500 mt-0.5">⏱️ Thời gian</p>
        </div>
        <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
          <p className="font-bold font-mono text-slate-800 text-sm">{scoreC}</p>
          <p className="text-xs text-slate-500 mt-0.5">✅ Chất lượng</p>
        </div>
      </div>

      {/* Savings preview */}
      <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-100">
        <div>
          <span className="text-slate-600">Bên B tiết kiệm: </span>
          <span className={`font-bold font-mono text-sm ${quote.negativeSavingB ? 'text-red-500' : 'text-emerald-700'}`}>
            {formatVnd(Math.abs(quote.sBVnd))}
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
        <span className="text-xs text-slate-500 font-medium truncate">
          Chủ vỏ: {offer.companyName}
        </span>
        <button
          onClick={onHold}
          disabled={requiresLocationRefresh}
          className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
        >
          <Sparkles className="w-3.5 h-3.5" />
           <span>Chọn Offer · Gửi Match</span>
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

  const handleAddRequest = () => {
    if (!form.bookingNumber?.trim()) { showMsg('Số Booking không được trống.', true); return; }
    if (!form.deliveryLocationName?.trim()) { showMsg('Địa điểm giao hàng không được trống.', true); return; }
    if (!form.carrierId) { showMsg('Vui lòng chọn hãng tàu.', true); return; }

    const result = addRequest({
      carrierId: form.carrierId!,
      containerType: form.containerType as '20GP' | '40HC' || '40HC',
      bookingNumber: form.bookingNumber!,
      deliveryLocationName: form.deliveryLocationName!,
      deliveryLatitude: form.deliveryLatitude || 10.74,
      deliveryLongitude: form.deliveryLongitude || 106.70,
      pickupWindowStart: form.pickupWindowStart || new Date(Date.now() + 2 * 3600000).toISOString(),
      pickupWindowEnd: form.pickupWindowEnd || new Date(Date.now() + 24 * 3600000).toISOString(),
      cutOffTime: form.cutOffTime || new Date(Date.now() + 48 * 3600000).toISOString(),
      maxDistanceKm: form.maxDistanceKm || 40,
      cargoType: form.cargoType,
      cargoRequirements: form.cargoRequirements,
      baselinePickupCostVnd: form.baselinePickupCostVnd || 3400000,
    });

    if (result.success) {
      showMsg(result.message);
      setShowAddForm(false);
      const createdReq = result.data as ContainerRequest;
      setForm({ containerType: '40HC', maxDistanceKm: 40, baselinePickupCostVnd: 3400000, carrierId: 'CARR-MSK' });

      // Auto-match check immediately!
      if (createdReq) {
        const instantMatches = findMatchesForRequest(createdReq, availableOffers);
        if (instantMatches.candidates.length > 0) {
          setAutoMatchModalReq(createdReq);
        }
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
    const result = updateRequest(editingRequest.id, editForm);
    showMsg(result.message, !result.success);
    if (result.success) {
      setEditingRequest(null);
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
            <span>{currentRole === 'ENTERPRISE_B' ? 'Quản lý Nhu cầu & Tự động Ghép đôi' : 'Danh sách Nhu cầu (Requests)'}</span>
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
              <span>ĐĂNG NHU CẦU TÌM VỎ CONTAINER (CREATE REQUEST)</span>
            </h3>
            <button onClick={() => setShowAddForm(false)} className="text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="text-slate-700 font-semibold text-xs sm:text-sm block mb-1">Số Booking (từ hãng tàu) *</label>
              <input
                value={form.bookingNumber || ''}
                onChange={e => setForm(p => ({ ...p, bookingNumber: e.target.value.toUpperCase() }))}
                placeholder="MSKBKG2026-981..."
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-mono uppercase outline-none focus:ring-2 focus:ring-cyan-500 bg-white"
              />
            </div>
            <div>
              <label className="text-slate-700 font-semibold text-xs sm:text-sm block mb-1">Hãng tàu cấp vỏ *</label>
              <select 
                value={form.carrierId} 
                onChange={e => setForm(p => ({ ...p, carrierId: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-500 bg-white"
              >
                {INITIAL_CARRIERS.filter(c => c.isActive).map(c => (
                  <option key={c.id} value={c.id}>{c.code} · {c.name}</option>
                ))}
              </select>
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
              <label className="text-slate-700 font-semibold text-xs sm:text-sm block mb-1">Địa điểm nhận cont / đóng hàng *</label>
              <input
                value={form.deliveryLocationName || ''}
                onChange={e => setForm(p => ({ ...p, deliveryLocationName: e.target.value }))}
                placeholder="Kho KCN VSIP 1, Bình Dương..."
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-500 bg-white"
              />
            </div>
            <div>
              <label className="text-slate-700 font-semibold text-xs sm:text-sm block mb-1">Lấy cont sớm nhất</label>
              <input 
                type="datetime-local"
                onChange={e => setForm(p => ({ ...p, pickupWindowStart: new Date(e.target.value).toISOString() }))}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-500 bg-white" 
              />
            </div>
            <div>
              <label className="text-slate-700 font-semibold text-xs sm:text-sm block mb-1">Lấy cont muộn nhất</label>
              <input 
                type="datetime-local"
                onChange={e => setForm(p => ({ ...p, pickupWindowEnd: new Date(e.target.value).toISOString() }))}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-500 bg-white" 
              />
            </div>
            <div>
              <label className="text-slate-700 font-semibold text-xs sm:text-sm block mb-1">Thời hạn Cut-off booking</label>
              <input 
                type="datetime-local"
                onChange={e => setForm(p => ({ ...p, cutOffTime: new Date(e.target.value).toISOString() }))}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-500 bg-white" 
              />
            </div>
            <div>
              <label className="text-slate-700 font-semibold text-xs sm:text-sm block mb-1">Bán kính quét ghép đôi tối đa (Dmax: km)</label>
              <input 
                type="number" 
                min="5" 
                max="100" 
                value={form.maxDistanceKm || 40}
                onChange={e => setForm(p => ({ ...p, maxDistanceKm: parseInt(e.target.value) || 40 }))}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-500 bg-white" 
              />
            </div>
            <div>
              <label className="text-slate-700 font-semibold text-xs sm:text-sm block mb-1">Chi phí lấy baseline T_B (VND)</label>
              <input 
                type="number" 
                value={form.baselinePickupCostVnd || 3400000}
                onChange={e => setForm(p => ({ ...p, baselinePickupCostVnd: parseInt(e.target.value) || 3400000 }))}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-500 bg-white" 
              />
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

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-700 font-semibold block mb-1">Địa điểm giao hàng *</label>
                <input
                  type="text"
                  value={editForm.deliveryLocationName || ''}
                  onChange={e => setEditForm(p => ({ ...p, deliveryLocationName: e.target.value }))}
                  className="w-full p-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 font-semibold block mb-1">Bán kính quét Dmax (km)</label>
                  <input
                    type="number"
                    value={editForm.maxDistanceKm || 40}
                    onChange={e => setEditForm(p => ({ ...p, maxDistanceKm: parseInt(e.target.value) || 40 }))}
                    className="w-full p-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>

                <div>
                  <label className="text-slate-700 font-semibold block mb-1">Chi phí baseline T_B (VND)</label>
                  <input
                    type="number"
                    value={editForm.baselinePickupCostVnd || 0}
                    onChange={e => setEditForm(p => ({ ...p, baselinePickupCostVnd: parseInt(e.target.value) || 0 }))}
                    className="w-full p-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-cyan-500"
                  />
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
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => opsReviewRequest(req.id, 'APPROVE', 'Booking hợp lệ từ hãng tàu')}
                        className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm"
                      >
                        Xác nhận Booking (OPEN)
                      </button>
                      <button
                        onClick={() => opsReviewRequest(req.id, 'REJECT', 'Số booking không hợp lệ')}
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
            <div>
              <label className="text-slate-700 font-semibold text-xs block mb-1">Lý do rút *</label>
              <textarea
                value={withdrawReason}
                onChange={e => setWithdrawReason(e.target.value)}
                placeholder="Đã tìm được vỏ khác hoặc thay đổi kế hoạch xuất hàng..."
                rows={3}
                className="w-full p-3 rounded-xl border border-slate-200 text-xs outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setWithdrawId(null)} className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl">Hủy</button>
              <button 
                onClick={() => {
                  const r = withdrawRequest(withdrawId, withdrawReason);
                  showMsg(r.message, !r.success);
                  if (r.success) setWithdrawId(null);
                }}
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
