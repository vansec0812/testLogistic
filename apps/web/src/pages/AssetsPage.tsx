// ==============================================================================
// ECont AssetsPage - Version 2.0 (Full CRUD & Photo Management)
// Quản lý Container Assets với Create, Read, Update, Delete & Photo Checklist
// ==============================================================================

import React, { useState, useMemo } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { useAuth } from '../context/AuthContext';
import { ContainerAsset, CreateAssetForm, PhysicalStatus, PhysicalCondition } from '../types';
import { ConditionBadge, PhysicalStatusBadge } from '../components/StatusBadge';
import { formatDateTime, formatRelativeTime, formatVnd } from '../lib/utils';
import {
  Boxes, Plus, Search, AlertTriangle, Clock, CheckCircle2, X, Edit2, Trash2,
  Lock, Unlock, Image, Package, MapPin, Calendar, Building, Info, Eye, Camera, Upload
} from 'lucide-react';
import { INITIAL_CARRIERS, INITIAL_DEPOTS } from '../data/mockData';

export const AssetsPage: React.FC = () => {
  const { assets, addAsset, updateAsset, deleteAsset, offers } = useDatabase();
  const { currentRole, currentCompany, canCreateOffers } = useAuth();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<ContainerAsset | null>(null);
  const [editingAsset, setEditingAsset] = useState<ContainerAsset | null>(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Add form state
  const [form, setForm] = useState<Partial<CreateAssetForm>>({
    containerType: '40HC',
    physicalStatus: 'EMPTY_AT_YARD',
    declaredCondition: 'GOOD',
    carrierId: 'CARR-MSK',
    currentLatitude: 10.78,
    currentLongitude: 106.78,
  });

  // Edit form state
  const [editForm, setEditForm] = useState<Partial<ContainerAsset>>({});

  const showMsg = (msg: string, isError = false) => {
    if (isError) setErrorMsg(msg);
    else setSuccessMsg(msg);
    setTimeout(() => { setErrorMsg(''); setSuccessMsg(''); }, 4000);
  };

  const filtered = useMemo(() => {
    let list = assets;
    if (currentRole === 'ENTERPRISE_A') {
      list = list.filter(a => a.currentCustodianId === currentCompany.id);
    } else if (currentRole === 'ENTERPRISE_B') {
      list = [];
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(a =>
        a.containerNumber.toLowerCase().includes(q) ||
        a.currentLocationName.toLowerCase().includes(q) ||
        a.carrierCode.toLowerCase().includes(q)
      );
    }
    if (filterStatus !== 'all') {
      list = list.filter(a => a.physicalStatus === filterStatus);
    }
    return list;
  }, [assets, currentRole, currentCompany.id, search, filterStatus]);

  const handleAdd = () => {
    if (!form.containerNumber?.trim()) { showMsg('Số container không được trống.', true); return; }
    if (!form.currentLocationName?.trim()) { showMsg('Tên vị trí hiện tại không được trống.', true); return; }

    const result = addAsset({
      containerNumber: form.containerNumber!,
      containerType: form.containerType || '40HC',
      carrierId: form.carrierId || 'CARR-MSK',
      physicalStatus: form.physicalStatus || 'EMPTY_AT_YARD',
      declaredCondition: form.declaredCondition || 'GOOD',
      conditionNotes: form.conditionNotes,
      currentLocationName: form.currentLocationName!,
      currentLatitude: form.currentLatitude || 10.78,
      currentLongitude: form.currentLongitude || 106.78,
      currentDepotReturnId: form.currentDepotReturnId,
      freeTimeDetentionEnd: form.freeTimeDetentionEnd,
      freeTimeSource: form.freeTimeSource,
    });
    if (result.success) {
      showMsg(result.message);
      setShowAddForm(false);
      setForm({ containerType: '40HC', physicalStatus: 'EMPTY_AT_YARD', declaredCondition: 'GOOD', carrierId: 'CARR-MSK', currentLatitude: 10.78, currentLongitude: 106.78 });
    } else {
      showMsg(result.message, true);
    }
  };

  const handleStartEdit = (asset: ContainerAsset) => {
    if (asset.isLocked) {
      showMsg('Container đang trong giao dịch giữ chỗ, không thể chỉnh sửa.', true);
      return;
    }
    setEditingAsset(asset);
    setEditForm({
      declaredCondition: asset.declaredCondition,
      physicalStatus: asset.physicalStatus,
      currentLocationName: asset.currentLocationName,
      conditionNotes: asset.conditionNotes || '',
      freeTimeDetentionEnd: asset.freeTimeDetentionEnd,
    });
  };

  const handleSaveEdit = () => {
    if (!editingAsset) return;
    const result = updateAsset(editingAsset.id, {
      ...editForm,
      locationObservedAt: new Date().toISOString()
    });
    showMsg(result.message, !result.success);
    if (result.success) {
      setEditingAsset(null);
      if (selectedAsset?.id === editingAsset.id) {
        setSelectedAsset(null);
      }
    }
  };

  const handleDelete = (assetId: string) => {
    if (!confirm('Bạn có chắc muốn xóa container này khỏi danh mục quản lý?')) return;
    const result = deleteAsset(assetId);
    showMsg(result.message, !result.success);
    if (result.success) {
      setSelectedAsset(null);
      if (editingAsset?.id === assetId) setEditingAsset(null);
    }
  };

  // Upload simulation to reach 6 photos for IICL checklist
  const handleAddSamplePhotos = (assetId: string) => {
    const asset = assets.find(a => a.id === assetId);
    if (!asset) return;
    const sampleAngles = [
      'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800',
      'https://images.unsplash.com/photo-1578575437130-527eed3abbec?w=800',
      'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800',
      'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800',
      'https://images.unsplash.com/photo-1494412574643-ff11b0a5c1c3?w=800',
      'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800'
    ];
    updateAsset(assetId, { photos: sampleAngles });
    showMsg('Đã cập nhật đủ 6 ảnh 6 góc container (sẵn sàng tạo Offer đạt chuẩn IICL)!');
  };

  if (currentRole === 'ENTERPRISE_B') {
    return (
      <div className="text-center py-16 space-y-3 bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
        <Boxes className="w-12 h-12 text-slate-300 mx-auto" />
        <h3 className="text-lg font-bold text-slate-800">Chỉ dành cho Bên A</h3>
        <p className="text-sm text-slate-500">Bên B không quản lý vỏ container trực tiếp. Chuyển sang tab "Nhu cầu" để tìm kiếm.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Boxes className="w-6 h-6 text-brand-600" />
            <span>Quản lý Container (Assets CRUD)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {currentRole === 'ENTERPRISE_A' ? `${filtered.length} container thuộc quyền quản lý của ${currentCompany.shortName}` : `${filtered.length} container trong toàn hệ thống`}
          </p>
        </div>
        {canCreateOffers && (
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold flex items-center gap-2 shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Đăng ký Container mới</span>
          </button>
        )}
      </div>

      {/* Alerts */}
      {successMsg && (
        <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-700">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-700">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {errorMsg}
        </div>
      )}

      {/* Add Form Modal/Section */}
      {showAddForm && (
        <div className="bg-white border border-brand-200 rounded-2xl p-6 space-y-4 shadow-md">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-bold text-slate-900 flex items-center gap-2 text-sm">
              <Plus className="w-4 h-4 text-brand-600" />
              <span>ĐĂNG KÝ VỎ CONTAINER MỚI (CREATE)</span>
            </h3>
            <button onClick={() => setShowAddForm(false)} className="text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Số Container ISO 6346 *</label>
              <input
                value={form.containerNumber || ''}
                onChange={e => setForm(p => ({ ...p, containerNumber: e.target.value.toUpperCase() }))}
                placeholder="MSKU1234567"
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-mono uppercase focus:ring-2 focus:ring-brand-500 outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Loại Container</label>
              <select value={form.containerType} onChange={e => setForm(p => ({ ...p, containerType: e.target.value as '20GP' | '40HC' }))}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs outline-none focus:ring-2 focus:ring-brand-500">
                <option value="40HC">40HC (40 foot cao)</option>
                <option value="20GP">20GP (20 foot tiêu chuẩn)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Hãng tàu</label>
              <select value={form.carrierId} onChange={e => setForm(p => ({ ...p, carrierId: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs outline-none focus:ring-2 focus:ring-brand-500">
                {INITIAL_CARRIERS.filter(c => c.isActive).map(c => (
                  <option key={c.id} value={c.id}>{c.code} · {c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Tình trạng vật lý</label>
              <select value={form.physicalStatus} onChange={e => setForm(p => ({ ...p, physicalStatus: e.target.value as PhysicalStatus }))}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs outline-none focus:ring-2 focus:ring-brand-500">
                <option value="EMPTY_AT_YARD">Rỗng tại kho (EMPTY_AT_YARD)</option>
                <option value="EMPTY_AT_DEPOT">Rỗng tại depot (EMPTY_AT_DEPOT)</option>
                <option value="AT_CUSTOMER">Đang tại khách hàng (AT_CUSTOMER)</option>
                <option value="IN_TRANSIT">Đang vận chuyển (IN_TRANSIT)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Chất lượng vỏ khai báo</label>
              <select value={form.declaredCondition} onChange={e => setForm(p => ({ ...p, declaredCondition: e.target.value as PhysicalCondition }))}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs outline-none focus:ring-2 focus:ring-brand-500">
                <option value="GOOD">Đạt chuẩn đóng hàng (GOOD)</option>
                <option value="MINOR_DAMAGE">Hư hỏng nhẹ (MINOR_DAMAGE)</option>
                <option value="MAJOR_DAMAGE">Hư hỏng nặng (MAJOR_DAMAGE)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Vị trí hiện tại *</label>
              <input
                value={form.currentLocationName || ''}
                onChange={e => setForm(p => ({ ...p, currentLocationName: e.target.value }))}
                placeholder="Kho CFS Cát Lái, Kho KCN Tân Tạo..."
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs focus:ring-2 focus:ring-brand-500 outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Hạn Detention (Hạn lưu vỏ)</label>
              <input
                type="datetime-local"
                value={form.freeTimeDetentionEnd ? form.freeTimeDetentionEnd.slice(0, 16) : ''}
                onChange={e => setForm(p => ({ ...p, freeTimeDetentionEnd: new Date(e.target.value).toISOString() }))}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-slate-700 block mb-1">Ghi chú tình trạng vỏ</label>
              <input
                value={form.conditionNotes || ''}
                onChange={e => setForm(p => ({ ...p, conditionNotes: e.target.value }))}
                placeholder="Sàn khô sạch, không thủng vách, gioăng cửa nguyên vẹn..."
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs focus:ring-2 focus:ring-brand-500 outline-none"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button onClick={() => setShowAddForm(false)} className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl">
              Hủy
            </button>
            <button onClick={handleAdd} className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold rounded-xl shadow-sm">
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
                <span>CHỈNH SỬA CONTAINER: {editingAsset.containerNumber} (UPDATE)</span>
              </h3>
              <button onClick={() => setEditingAsset(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-700 font-semibold block mb-1">Vị trí hiện tại *</label>
                <input
                  type="text"
                  value={editForm.currentLocationName || ''}
                  onChange={e => setEditForm(p => ({ ...p, currentLocationName: e.target.value }))}
                  className="w-full p-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 font-semibold block mb-1">Trạng thái vật lý</label>
                  <select
                    value={editForm.physicalStatus}
                    onChange={e => setEditForm(p => ({ ...p, physicalStatus: e.target.value as PhysicalStatus }))}
                    className="w-full p-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="EMPTY_AT_YARD">Rỗng tại kho</option>
                    <option value="EMPTY_AT_DEPOT">Rỗng tại depot</option>
                    <option value="AT_CUSTOMER">Tại khách hàng</option>
                    <option value="IN_TRANSIT">Đang vận chuyển</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-700 font-semibold block mb-1">Chất lượng khai báo</label>
                  <select
                    value={editForm.declaredCondition}
                    onChange={e => setEditForm(p => ({ ...p, declaredCondition: e.target.value as PhysicalCondition }))}
                    className="w-full p-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="GOOD">Đạt chuẩn (GOOD)</option>
                    <option value="MINOR_DAMAGE">Hư hỏng nhẹ</option>
                    <option value="MAJOR_DAMAGE">Hư hỏng nặng</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-700 font-semibold block mb-1">Hạn Detention</label>
                <input
                  type="datetime-local"
                  value={editForm.freeTimeDetentionEnd ? editForm.freeTimeDetentionEnd.slice(0, 16) : ''}
                  onChange={e => setEditForm(p => ({ ...p, freeTimeDetentionEnd: new Date(e.target.value).toISOString() }))}
                  className="w-full p-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="text-slate-700 font-semibold block mb-1">Ghi chú tình trạng</label>
                <textarea
                  value={editForm.conditionNotes || ''}
                  onChange={e => setEditForm(p => ({ ...p, conditionNotes: e.target.value }))}
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
                <span className="font-mono font-bold text-slate-900 text-base">{selectedAsset.containerNumber}</span>
                <PhysicalStatusBadge status={selectedAsset.physicalStatus} size="xs" />
                <ConditionBadge condition={selectedAsset.declaredCondition} size="xs" />
              </div>
              <button onClick={() => setSelectedAsset(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-700">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl">
                <div>Hãng tàu: <strong className="text-slate-900">{selectedAsset.carrierCode}</strong></div>
                <div>Loại: <strong className="text-slate-900">{selectedAsset.containerType}</strong></div>
                <div>Đơn vị quản lý: <strong>{selectedAsset.currentCustodianName}</strong></div>
                <div>Khóa giữ chỗ: <strong>{selectedAsset.isLocked ? 'Đang khóa (Locked)' : 'Tự do (Free)'}</strong></div>
                <div className="col-span-2">Vị trí: <strong>{selectedAsset.currentLocationName}</strong></div>
                {selectedAsset.freeTimeDetentionEnd && (
                  <div className="col-span-2">Hạn Detention: <strong>{formatDateTime(selectedAsset.freeTimeDetentionEnd)}</strong></div>
                )}
              </div>

              {/* Photo section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-slate-800">Bộ ảnh tình trạng ({selectedAsset.photos.length}/6 ảnh)</span>
                  {selectedAsset.photos.length < 6 && (
                    <button
                      onClick={() => handleAddSamplePhotos(selectedAsset.id)}
                      className="text-brand-600 hover:underline flex items-center gap-1 font-semibold text-[11px]"
                    >
                      <Upload className="w-3 h-3" />
                      <span>Thêm bộ 6 ảnh đạt chuẩn IICL</span>
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {selectedAsset.photos.map((url, idx) => (
                    <div key={idx} className="h-24 rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
                      <img src={url} alt={`Ảnh ${idx + 1}`} className="w-full h-full object-cover" />
                    </div>
                  ))}
                  {selectedAsset.photos.length === 0 && (
                    <div className="col-span-3 py-6 text-center text-slate-400 border border-dashed rounded-xl">
                      Chưa có ảnh chụp container
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
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Tìm theo số container, hãng tàu, vị trí..."
            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 outline-none bg-white"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {['all', 'EMPTY_AT_YARD', 'EMPTY_AT_DEPOT', 'AT_CUSTOMER', 'IN_TRANSIT'].map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                filterStatus === s 
                  ? 'bg-slate-900 text-white border-slate-900' 
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {s === 'all' ? 'Tất cả' :
               s === 'EMPTY_AT_YARD' ? 'Rỗng tại kho' :
               s === 'EMPTY_AT_DEPOT' ? 'Rỗng tại depot' :
               s === 'AT_CUSTOMER' ? 'Tại KH' : 'Đang chuyển'}
            </button>
          ))}
        </div>
      </div>

      {/* Assets Grid Cards */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 space-y-3 bg-white border border-slate-200 rounded-2xl p-8">
          <Boxes className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-700">Không có container nào</h3>
          <p className="text-xs text-slate-500">{search ? 'Không tìm thấy kết quả phù hợp.' : 'Hãy đăng ký container đầu tiên.'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map(asset => {
            const myOffer = offers.find(o => o.assetId === asset.id && ['DRAFT', 'UNDER_REVIEW', 'AVAILABLE', 'HELD', 'ALLOCATED'].includes(o.status));
            const detentionEnd = asset.freeTimeDetentionEnd ? new Date(asset.freeTimeDetentionEnd).getTime() : null;
            const detentionUrgent = detentionEnd ? (detentionEnd - Date.now()) < 48 * 3600000 : false;
            const detentionExpired = detentionEnd ? detentionEnd < Date.now() : false;

            return (
              <div
                key={asset.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm transition-all hover:shadow-md overflow-hidden flex flex-col justify-between"
              >
                <div>
                  {/* Photo Header */}
                  <div className="relative h-36 bg-slate-100 overflow-hidden">
                    {asset.photos.length > 0 ? (
                      <img src={asset.photos[0]} alt={asset.containerNumber} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-300">
                        <Camera className="w-8 h-8" />
                      </div>
                    )}
                    <div className="absolute top-2.5 left-2.5 flex gap-1.5 flex-wrap">
                      <ConditionBadge condition={asset.declaredCondition} size="xs" />
                      {asset.isLocked && (
                        <span className="inline-flex items-center gap-1 rounded-full text-[10px] font-bold px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200">
                          <Lock className="w-2.5 h-2.5" /> Đang giữ chỗ
                        </span>
                      )}
                    </div>
                    <span className="absolute bottom-2 right-2 text-[10px] font-bold bg-black/60 text-white rounded-md px-2 py-0.5">
                      {asset.photos.length}/6 ảnh
                    </span>
                  </div>

                  {/* Content */}
                  <div className="p-4 space-y-2.5 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-bold text-slate-900 font-mono text-sm">{asset.containerNumber}</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-slate-500 font-semibold">{asset.carrierCode} · {asset.containerType}</span>
                          <PhysicalStatusBadge status={asset.physicalStatus} size="xs" />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-1.5 text-slate-600">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                      <span className="leading-snug">{asset.currentLocationName}</span>
                    </div>

                    {asset.freeTimeDetentionEnd && (
                      <div className={`flex items-center gap-1.5 ${
                        detentionExpired ? 'text-red-600 font-semibold' : detentionUrgent ? 'text-amber-600 font-semibold' : 'text-slate-500'
                      }`}>
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          {detentionExpired ? '⛔ Hết hạn lưu vỏ' :
                           detentionUrgent ? `⚠️ Hạn còn: ${formatRelativeTime(asset.freeTimeDetentionEnd)}` :
                           `Hạn: ${formatRelativeTime(asset.freeTimeDetentionEnd)}`}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Actions (Full CRUD) */}
                <div className="p-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-2">
                  <button
                    onClick={() => setSelectedAsset(asset)}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-[11px] font-semibold flex items-center gap-1"
                  >
                    <Eye className="w-3 h-3 text-slate-500" />
                    <span>Chi tiết</span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    {!asset.isLocked && canCreateOffers && (
                      <>
                        <button
                          onClick={() => handleStartEdit(asset)}
                          className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600"
                          title="Sửa thông tin"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(asset.id)}
                          className="p-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-600"
                          title="Xóa container"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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
