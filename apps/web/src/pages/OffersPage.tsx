// ==============================================================================
// ECont OffersPage - Version 2.0 (Full CRUD & Auto-Match Insight)
// Quản lý Offer nguồn vỏ container với Create, Read, Update, Delete & Auto-Match
// ==============================================================================

import React, { useState, useMemo } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { useAuth } from '../context/AuthContext';
import { Offer, CreateOfferForm } from '../types';
import { OfferStatusBadge, ConditionBadge } from '../components/StatusBadge';
import { formatVnd, formatDateTime, formatRelativeTime } from '../lib/utils';
import {
  PackageOpen, Plus, Search, Filter, AlertTriangle, CheckCircle2, X,
  Eye, Edit2, Trash2, Send, Clock, MapPin, Camera, Building, TrendingDown,
  ChevronDown, ChevronUp, AlertCircle, Shield, Sparkles, ArrowRight
} from 'lucide-react';
import { INITIAL_DEPOTS } from '../data/mockData';
import { AiEdoScannerModal, ExtractedEdoData } from '../components/AiEdoScannerModal';

interface OffersPageProps {
  setCurrentTab?: (tab: string) => void;
  setSelectedTxnId?: (id: string) => void;
}

export const OffersPage: React.FC<OffersPageProps> = ({ setCurrentTab, setSelectedTxnId }) => {
  const { offers, assets, requests, addOffer, updateOffer, deleteOffer, submitOfferForReview, withdrawOffer, opsReviewOffer } = useDatabase();
  const { currentRole, currentCompany, canOpsReview } = useAuth();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showAiEdoModal, setShowAiEdoModal] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [editingOffer, setEditingOffer] = useState<Offer | null>(null);
  const [editForm, setEditForm] = useState<Partial<Offer>>({});
  const [opsNotes, setOpsNotes] = useState('');
  const [withdrawReason, setWithdrawReason] = useState('');
  const [withdrawId, setWithdrawId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const [form, setForm] = useState<Partial<CreateOfferForm>>({
    baselineDepotCostVnd: 3000000,
  });

  const handleApplyEdo = (data: ExtractedEdoData) => {
    const matchingAsset = assets.find(a => a.containerNumber === data.containerNumber);
    setForm(p => ({
      ...p,
      assetId: matchingAsset?.id || p.assetId,
      pickupLocationName: data.returnDepot,
      availableUntil: data.expiryDate,
      freeTimeDaysA: 3,
    }));
    setShowAddForm(true);
    showMsg(`AI đã đọc e-DO ${data.edoNumber}! Đã điền thông tin Offer.`);
  };

  const showMsg = (msg: string, isError = false) => {
    if (isError) setErrorMsg(msg);
    else setSuccessMsg(msg);
    setTimeout(() => { setErrorMsg(''); setSuccessMsg(''); }, 4000);
  };

  const filtered = useMemo(() => {
    let list = offers;
    if (currentRole === 'ENTERPRISE_A') {
      list = list.filter(o => o.companyId === currentCompany.id);
    }
    if (currentRole === 'ENTERPRISE_B') {
      list = list.filter(o => o.status === 'AVAILABLE');
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(o =>
        o.id.toLowerCase().includes(q) ||
        o.asset.containerNumber.toLowerCase().includes(q) ||
        o.asset.carrierCode.toLowerCase().includes(q) ||
        o.pickupLocationName.toLowerCase().includes(q)
      );
    }
    if (filterStatus !== 'all') {
      list = list.filter(o => o.status === filterStatus);
    }
    return list;
  }, [offers, currentRole, currentCompany.id, search, filterStatus]);

  // Available assets for offer creation (A only, EMPTY, no active offer)
  const eligibleAssets = useMemo(() => {
    return assets.filter(a =>
      a.currentCustodianId === currentCompany.id &&
      (a.physicalStatus === 'EMPTY_AT_YARD' || a.physicalStatus === 'EMPTY_AT_DEPOT') &&
      !a.isLocked &&
      !offers.some(o => o.assetId === a.id && ['DRAFT', 'UNDER_REVIEW', 'AVAILABLE', 'HELD', 'ALLOCATED'].includes(o.status))
    );
  }, [assets, offers, currentCompany.id]);

  const handleAddOffer = () => {
    if (!form.assetId) { showMsg('Vui lòng chọn container.', true); return; }
    if (!form.pickupLocationName?.trim()) { showMsg('Vui lòng nhập địa điểm lấy cont.', true); return; }
    if (!form.availableFrom || !form.availableTo) { showMsg('Vui lòng nhập khung thời gian sẵn sàng.', true); return; }

    const result = addOffer({
      assetId: form.assetId!,
      pickupLocationName: form.pickupLocationName!,
      pickupLatitude: form.pickupLatitude || 10.78,
      pickupLongitude: form.pickupLongitude || 106.78,
      availableFrom: form.availableFrom!,
      availableTo: form.availableTo!,
      expectedDepotId: form.expectedDepotId,
      baselineDepotCostVnd: form.baselineDepotCostVnd || 3000000,
      vehicleRequirements: form.vehicleRequirements,
    });
    if (result.success) {
      showMsg(result.message);
      setShowAddForm(false);
      setForm({ baselineDepotCostVnd: 3000000 });
    } else {
      showMsg(result.message, true);
    }
  };

  const handleStartEdit = (offer: Offer) => {
    if (['HELD', 'ALLOCATED', 'FULFILLED'].includes(offer.status)) {
      showMsg(`Không thể chỉnh sửa Offer đang ở trạng thái ${offer.status}.`, true);
      return;
    }
    setEditingOffer(offer);
    setEditForm({
      pickupLocationName: offer.pickupLocationName,
      availableFrom: offer.availableFrom,
      availableTo: offer.availableTo,
      baselineDepotCostVnd: offer.baselineDepotCostVnd,
      vehicleRequirements: offer.vehicleRequirements || '',
    });
  };

  const handleSaveEdit = () => {
    if (!editingOffer) return;
    const result = updateOffer(editingOffer.id, editForm);
    showMsg(result.message, !result.success);
    if (result.success) {
      setEditingOffer(null);
    }
  };

  const handleDeleteOffer = (offerId: string) => {
    if (!confirm('Bạn có chắc muốn xóa Offer này hoàn toàn?')) return;
    const result = deleteOffer(offerId);
    showMsg(result.message, !result.success);
    if (result.success && selectedOffer?.id === offerId) {
      setSelectedOffer(null);
    }
  };

  const handleSubmitReview = (offerId: string) => {
    const result = submitOfferForReview(offerId);
    showMsg(result.message, !result.success);
  };

  const handleOpsDecision = (offerId: string, decision: 'APPROVE' | 'REQUEST_CHANGES' | 'REJECT') => {
    if (!opsNotes.trim()) { showMsg('Vui lòng nhập ghi chú thẩm định.', true); return; }
    const result = opsReviewOffer(offerId, decision, opsNotes);
    showMsg(result.message, !result.success);
    if (result.success) { setOpsNotes(''); }
  };

  const handleWithdraw = () => {
    if (!withdrawId) return;
    if (!withdrawReason.trim()) { showMsg('Vui lòng nhập lý do rút tin.', true); return; }
    const result = withdrawOffer(withdrawId, withdrawReason);
    showMsg(result.message, !result.success);
    if (result.success) { setWithdrawId(null); setWithdrawReason(''); }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <PackageOpen className="w-6 h-6 text-emerald-600" />
            <span>{currentRole === 'ENTERPRISE_B' ? 'Nguồn vỏ container sẵn sàng' : 'Quản lý Nguồn cung (Offers CRUD)'}</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {currentRole === 'ENTERPRISE_B'
              ? 'Xem danh sách container rỗng đang sẵn sàng ghép đôi'
              : `${filtered.length} offer đang được quản lý bởi ${currentCompany.shortName}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {currentRole === 'ENTERPRISE_A' && (
            <button
              onClick={() => setShowAiEdoModal(true)}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white text-xs font-bold flex items-center gap-2 shadow-sm transition-all"
            >
              <Sparkles className="w-4 h-4 text-teal-200" />
              <span>Quét e-DO Tạo Offer</span>
            </button>
          )}
          {currentRole === 'ENTERPRISE_A' && (
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Đăng Offer mới</span>
            </button>
          )}
        </div>
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
      {currentRole === 'ENTERPRISE_A' && currentCompany.verificationStatus !== 'VERIFIED' && (
        <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-xs font-semibold text-amber-800">
          <Shield className="w-4 h-4 shrink-0" /> Hồ sơ doanh nghiệp đang chờ Ops xác minh. Chưa thể tạo hoặc gửi Offer.
        </div>
      )}

      {/* Add Form */}
      {showAddForm && currentRole === 'ENTERPRISE_A' && (
        <div className="bg-white border border-emerald-200 rounded-2xl p-6 space-y-4 shadow-md">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Plus className="w-4 h-4 text-emerald-600" />
              <span>ĐĂNG NGUỒN CUNG VỎ CONTAINER MỚI (CREATE OFFER)</span>
            </h3>
            <button onClick={() => setShowAddForm(false)} className="text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          {eligibleAssets.length === 0 ? (
            <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
              <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
              <div>
                <strong>Không có container đủ điều kiện tạo Offer:</strong> Container cần ở trạng thái Rỗng (EMPTY_AT_YARD / DEPOT), không bị khóa và chưa có Offer hoạt động.
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs sm:text-sm">
              <div>
                <label className="text-slate-700 font-semibold block mb-1">Chọn Container quản lý *</label>
                <select
                  value={form.assetId || ''}
                  onChange={e => setForm(p => ({ ...p, assetId: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">— Chọn container —</option>
                  {eligibleAssets.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.containerNumber} · {a.carrierCode} · {a.containerType} · {a.currentLocationName} ({a.photos.length}/6 ảnh)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-slate-700 font-semibold block mb-1">Địa điểm lấy cont *</label>
                <input
                  value={form.pickupLocationName || ''}
                  onChange={e => setForm(p => ({ ...p, pickupLocationName: e.target.value }))}
                  placeholder="Kho CFS Cát Lái, Cảng Tân Cảng..."
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="text-slate-700 font-semibold block mb-1">Sẵn sàng từ *</label>
                <input
                  type="datetime-local"
                  onChange={e => setForm(p => ({ ...p, availableFrom: new Date(e.target.value).toISOString() }))}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="text-slate-700 font-semibold block mb-1">Sẵn sàng đến *</label>
                <input
                  type="datetime-local"
                  onChange={e => setForm(p => ({ ...p, availableTo: new Date(e.target.value).toISOString() }))}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="text-slate-700 font-semibold block mb-1">Chi phí hạ baseline T_A (VND) *</label>
                <input
                  type="number"
                  value={form.baselineDepotCostVnd || 3000000}
                  onChange={e => setForm(p => ({ ...p, baselineDepotCostVnd: parseInt(e.target.value) }))}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-xs text-slate-500 mt-1">Cước vận chuyển + nâng hạ nếu đưa về depot thông thường</p>
              </div>
              <div>
                <label className="text-slate-700 font-semibold block mb-1">Depot chỉ định trả về</label>
                <select
                  value={form.expectedDepotId || ''}
                  onChange={e => setForm(p => ({ ...p, expectedDepotId: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">— Chọn depot —</option>
                  {INITIAL_DEPOTS.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="text-slate-700 font-semibold block mb-1">Yêu cầu về phương tiện nhận cont</label>
                <input
                  value={form.vehicleRequirements || ''}
                  onChange={e => setForm(p => ({ ...p, vehicleRequirements: e.target.value }))}
                  placeholder="Xe đầu kéo 40 feet, tải trọng tối thiểu 30 tấn..."
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          )}

          <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
            <button onClick={() => setShowAddForm(false)} className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl">
              Hủy
            </button>
            {eligibleAssets.length > 0 && (
              <button onClick={handleAddOffer} className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-sm">
                Tạo Offer Nháp
              </button>
            )}
          </div>
        </div>
      )}

      {/* Edit Form Modal */}
      {editingOffer && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-emerald-600" />
                <span>CHỈNH SỬA OFFER: {editingOffer.id} (UPDATE)</span>
              </h3>
              <button onClick={() => setEditingOffer(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-700 font-semibold block mb-1">Địa điểm lấy cont *</label>
                <input
                  type="text"
                  value={editForm.pickupLocationName || ''}
                  onChange={e => setEditForm(p => ({ ...p, pickupLocationName: e.target.value }))}
                  className="w-full p-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="text-slate-700 font-semibold block mb-1">Chi phí hạ baseline T_A (VND) *</label>
                <input
                  type="number"
                  value={editForm.baselineDepotCostVnd || 0}
                  onChange={e => setEditForm(p => ({ ...p, baselineDepotCostVnd: parseInt(e.target.value) || 0 }))}
                  className="w-full p-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="text-slate-700 font-semibold block mb-1">Yêu cầu phương tiện</label>
                <input
                  type="text"
                  value={editForm.vehicleRequirements || ''}
                  onChange={e => setEditForm(p => ({ ...p, vehicleRequirements: e.target.value }))}
                  className="w-full p-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setEditingOffer(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Hủy
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-sm"
              >
                Cập nhật Offer
              </button>
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
            onChange={e => setSearch(e.target.value)}
            placeholder="Tìm theo số cont, hãng tàu, địa điểm lấy..."
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['all', 'DRAFT', 'UNDER_REVIEW', 'AVAILABLE', 'HELD'].map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold border transition-colors ${
                filterStatus === s 
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' 
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {s === 'all' ? 'Tất cả' :
               s === 'DRAFT' ? 'Nháp' :
               s === 'UNDER_REVIEW' ? 'Thẩm định' :
               s === 'AVAILABLE' ? 'Sẵn sàng' : 'Đang giữ'}
            </button>
          ))}
        </div>
      </div>

      {/* Offers Cards */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 space-y-3 bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
          <PackageOpen className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">Không có Offer nào</h3>
          <p className="text-xs sm:text-sm text-slate-500">{search ? 'Không tìm thấy kết quả.' : 'Chưa có nguồn cung phù hợp bộ lọc.'}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(offer => {
            // Auto-matching insight for Bên A: Check how many requests match this offer!
            const potentialMatches = requests.filter(r => 
              r.status === 'OPEN' && 
              r.carrierId === offer.asset.carrierId && 
              r.containerType === offer.asset.containerType
            );

            return (
              <div
                key={offer.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm transition-all hover:shadow-md p-5 space-y-3.5"
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
                        <span className="text-slate-600 font-semibold text-xs sm:text-sm">{offer.asset.carrierCode} · {offer.asset.containerType}</span>
                        <ConditionBadge condition={offer.asset.declaredCondition} size="sm" />
                      </div>

                      <div className="text-xs sm:text-sm text-slate-600 mt-1 flex items-center gap-1.5 font-medium">
                        <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                        <span>{offer.pickupLocationName}</span>
                      </div>

                      <div className="text-xs text-slate-500 mt-1.5 flex items-center gap-3 flex-wrap">
                        <span>Thời gian: {formatDateTime(offer.availableFrom)} → {formatDateTime(offer.availableTo)}</span>
                        <span className="text-emerald-700 font-bold font-mono text-sm">T_A: {formatVnd(offer.baselineDepotCostVnd)}</span>
                        <span className="font-medium bg-slate-100 px-2 py-0.5 rounded-md text-slate-700">{offer.photoUrls.length}/6 ảnh</span>
                      </div>
                    </div>
                  </div>

                  {/* Auto-matching radar pill for Bên A */}
                  {potentialMatches.length > 0 && (
                    <span className="px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-bold bg-cyan-50 text-cyan-800 border border-cyan-200 flex items-center gap-1.5 shadow-sm">
                      <Sparkles className="w-4 h-4 text-cyan-600 animate-pulse" />
                      <span>{potentialMatches.length} Bên B đang tìm loại vỏ này</span>
                    </span>
                  )}
                </div>

                {/* Review note if any */}
                {offer.reviewerNotes && (
                  <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-600 border border-slate-100 flex items-center gap-2">
                    <Shield className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>Ghi chú Ops: {offer.reviewerNotes}</span>
                  </div>
                )}

                {/* Card Actions (CRUD) */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    {/* Send review */}
                    {(offer.status === 'DRAFT' || offer.status === 'CHANGES_REQUIRED') && currentRole === 'ENTERPRISE_A' && (
                      <button
                        onClick={() => handleSubmitReview(offer.id)}
                        disabled={!offer.photoChecklistComplete}
                        className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-sm"
                      >
                        <Send className="w-4 h-4" />
                        <span>Gửi thẩm định</span>
                      </button>
                    )}

                    {/* Ops quick review */}
                    {offer.status === 'UNDER_REVIEW' && canOpsReview && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleOpsDecision(offer.id, 'APPROVE')}
                          className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold shadow-sm"
                        >
                          Duyệt (AVAILABLE)
                        </button>
                        <button
                          onClick={() => handleOpsDecision(offer.id, 'REJECT')}
                          className="px-3.5 py-2 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs sm:text-sm font-semibold shadow-sm"
                        >
                          Từ chối
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Edit, Withdraw, Delete */}
                  <div className="flex items-center gap-2">
                    {!['HELD', 'ALLOCATED', 'FULFILLED'].includes(offer.status) && (
                      <button
                        onClick={() => handleStartEdit(offer)}
                        className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 shadow-sm"
                        title="Chỉnh sửa Offer"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}

                    {['DRAFT', 'WITHDRAWN', 'CHANGES_REQUIRED'].includes(offer.status) && (
                      <button
                        onClick={() => handleDeleteOffer(offer.id)}
                        className="p-2 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 shadow-sm"
                        title="Xóa Offer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}

                    {!['HELD', 'ALLOCATED', 'FULFILLED', 'WITHDRAWN', 'EXPIRED'].includes(offer.status) && currentRole === 'ENTERPRISE_A' && (
                      <button
                        onClick={() => setWithdrawId(offer.id)}
                        className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 text-xs sm:text-sm font-semibold shadow-sm"
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

      {/* Withdraw Modal */}
      {withdrawId && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Rút tin Offer: {withdrawId}</h3>
              <button onClick={() => setWithdrawId(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div>
              <label className="text-slate-700 font-semibold text-xs block mb-1">Lý do rút tin *</label>
              <textarea
                value={withdrawReason}
                onChange={e => setWithdrawReason(e.target.value)}
                placeholder="Container đã được điều phối khác hoặc thay đổi kế hoạch..."
                rows={3}
                className="w-full p-3 rounded-xl border border-slate-200 text-xs outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setWithdrawId(null)} className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl">Hủy</button>
              <button onClick={handleWithdraw} className="px-4 py-2 text-xs font-bold bg-red-600 hover:bg-red-500 text-white rounded-xl">Xác nhận Rút</button>
            </div>
          </div>
        </div>
      )}
      {/* AI eDO Scanner Modal */}
      <AiEdoScannerModal
        isOpen={showAiEdoModal}
        onClose={() => setShowAiEdoModal(false)}
        onApplyData={handleApplyEdo}
      />
    </div>
  );
};
