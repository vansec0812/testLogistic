// ==============================================================================
// ECont Supply Offers Page (Doanh nghiệp A - Đăng tải nguồn cung vỏ cont)
// ==============================================================================

import React, { useState } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { useAuth } from '../context/AuthContext';
import { formatVnd, formatDateTime } from '../lib/utils';
import { 
  Box, 
  Plus, 
  MapPin, 
  Calendar, 
  Clock, 
  DollarSign, 
  CheckCircle2, 
  AlertTriangle,
  Pencil,
  Trash2,
  X
} from 'lucide-react';

export const OffersPage: React.FC = () => {
  const { offers, assets, addOffer, updateOffer, deleteOffer } = useDatabase();
  const { currentRole, currentCompany } = useAuth();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState(assets[0]?.id || '');
  const [pickupLocation, setPickupLocation] = useState('Kho Ngoại quan Tân Cảng, TP. Thủ Đức');
  const [baselineCost, setBaselineCost] = useState(3000000);
  const [editingOfferId, setEditingOfferId] = useState<string | null>(null);
  const ownAssets = assets.filter(asset => asset.currentCustodianId === currentCompany.id);
  const [depotName, setDepotName] = useState('Depot Tân Cảng Cát Lái');

  const handleCreateOffer = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentRole !== 'ENTERPRISE_A') {
      alert('Chỉ Bên A mới được đăng nguồn cung container.');
      return;
    }

    const asset = assets.find(a => a.id === selectedAssetId);
    if (!asset) {
      alert('Vui lòng chọn container hợp lệ.');
      return;
    }

    const offerData = {
      assetId: asset.id,
      asset,
      companyId: currentCompany.id,
      companyName: currentCompany.companyName,
      status: 'AVAILABLE' as const,
      pickupLocationName: pickupLocation,
      pickupLatitude: asset.currentLatitude,
      pickupLongitude: asset.currentLongitude,
      availableFrom: new Date().toISOString(),
      availableTo: new Date(Date.now() + 3 * 86400000).toISOString(),
      expectedDepotId: asset.currentDepotReturnId,
      expectedDepotName: depotName,
      baselineDepotCostVnd: baselineCost,
      reviewNotes: 'Đã sẵn sàng bàn giao trực tiếp tại bãi.'
    };

    const result = editingOfferId
      ? updateOffer(editingOfferId, offerData)
      : (addOffer(offerData) ? { success: true, message: 'Đã tạo Offer.' } : { success: false, message: 'Không có quyền tạo Offer.' });

    if (!result.success) {
      alert(result.message);
      return;
    }

    setIsModalOpen(false);
    setEditingOfferId(null);
    alert(editingOfferId ? 'Cập nhật Offer thành công!' : 'Đăng tải nguồn cung Offer thành công!');
  };

  const handleOpenCreate = () => {
    setEditingOfferId(null);
    setSelectedAssetId(ownAssets[0]?.id || '');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (offer: typeof offers[number]) => {
    setEditingOfferId(offer.id);
    setSelectedAssetId(offer.assetId);
    setPickupLocation(offer.pickupLocationName);
    setBaselineCost(offer.baselineDepotCostVnd);
    setDepotName(offer.expectedDepotName);
    setIsModalOpen(true);
  };

  const handleDelete = (offerId: string) => {
    if (!window.confirm('Xóa Offer này? Offer đã giữ chỗ hoặc có giao dịch sẽ không bị xóa.')) return;
    const result = deleteOffer(offerId);
    alert(result.message);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Box className="w-5 h-5 text-emerald-400" />
            <span>NGUỒN CUNG VỎ CONTAINER (OFFERS)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Danh sách container rỗng đã xả hàng, sẵn sàng kết nối tái sử dụng cho các chủ hàng xuất khẩu
          </p>
        </div>

        {currentRole === 'ENTERPRISE_A' && <button
          onClick={handleOpenCreate}
          className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold flex items-center gap-2 shadow-lg shadow-emerald-900/40 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Tạo Offer Nguồn vỏ mới</span>
        </button>}
      </div>

      {/* Grid danh sách Offers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {offers.map((offer) => (
          <div
            key={offer.id}
            className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm hover:border-slate-700 transition-all"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-base text-white">
                    {offer.asset.containerNumber}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-brand-950 text-brand-400 border border-brand-800">
                    {offer.asset.containerType}
                  </span>
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  Đơn vị đăng tải: <strong className="text-slate-200">{offer.companyName}</strong>
                </div>
              </div>

              <span className={`px-2.5 py-0.5 rounded text-xs font-bold border ${
                offer.status === 'AVAILABLE'
                  ? 'bg-emerald-950 text-emerald-400 border-emerald-700'
                  : 'bg-amber-950 text-amber-400 border-amber-700'
              }`}>
                {offer.status}
              </span>
            </div>

            <div className="space-y-2 text-xs text-slate-400 py-3 border-y border-slate-800/80">
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span>Điểm lấy vỏ: <strong className="text-slate-300">{offer.pickupLocationName}</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span>Khả dụng đến: {formatDateTime(offer.availableTo)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Cước hạ depot kế hoạch cũ (T_A): <strong className="text-slate-200 font-mono">{formatVnd(offer.baselineDepotCostVnd)}</strong></span>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between text-xs">
              <span className="text-slate-500">Hãng tàu: {offer.asset.carrierCode} · Trả depot: {offer.expectedDepotName}</span>
              <div className="flex items-center gap-2">
                <span className="text-brand-400 font-medium">Sẵn sàng ghép đôi</span>
                {currentRole === 'ENTERPRISE_A' && offer.companyId === currentCompany.id && (
                  <>
                    <button type="button" onClick={() => handleOpenEdit(offer)} className="p-1 text-brand-400 hover:text-brand-300" title="Sửa Offer">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" onClick={() => handleDelete(offer.id)} className="p-1 text-rose-400 hover:text-rose-300" title="Xóa Offer">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal tạo Offer */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-emerald-400" />
               <span>{editingOfferId ? 'CHỈNH SỬA OFFER' : 'ĐĂNG TẢI NGUỒN VỎ CONT TÁI SỬ DỤNG'}</span>
            </h3>

            <form onSubmit={handleCreateOffer} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  Chọn Container từ kho của bạn:
                </label>
                <select
                  value={selectedAssetId}
                  onChange={(e) => setSelectedAssetId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white outline-none"
                  required
                >
                  {ownAssets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.containerNumber} ({a.containerType} - Hãng {a.carrierCode}) - {a.currentLocationName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  Địa chỉ lấy vỏ (Kho / Xưởng bên A):
                </label>
                <input
                  type="text"
                  value={pickupLocation}
                  onChange={(e) => setPickupLocation(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">
                    Depot dự kiến phải trả theo lệnh cũ:
                  </label>
                  <input
                    type="text"
                    value={depotName}
                    onChange={(e) => setDepotName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">
                    Cước hạ depot kế hoạch cũ (T_A - VND):
                  </label>
                  <input
                    type="number"
                    step={100000}
                    value={baselineCost}
                    onChange={(e) => setBaselineCost(parseInt(e.target.value, 10))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono outline-none"
                    required
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-md"
                >
                  {editingOfferId ? 'Lưu thay đổi' : 'Đăng tải Offer ngay'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
