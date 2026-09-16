// ==============================================================================
// ECont Assets Management Page: Quản lý vỏ Container & Kiểm tra Check Digit ISO 6346
// ==============================================================================

import React, { useState } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { useAuth } from '../context/AuthContext';
import { ContainerType, PhysicalCondition } from '../types';
import { validateContainerNumber, calculateCheckDigit } from '../services/iso6346';
import { formatDateOnly } from '../lib/utils';
import { 
  Box, 
  Plus, 
  CheckCircle2, 
  AlertCircle, 
  Calendar, 
  MapPin, 
  ShieldCheck, 
  Building,
  Camera,
  Pencil,
  Trash2,
  X
} from 'lucide-react';

export const AssetsPage: React.FC = () => {
  const { assets, addAsset, updateAsset, deleteAsset } = useDatabase();
  const { currentRole, currentCompany } = useAuth();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [containerInput, setContainerInput] = useState('');
  const [containerType, setContainerType] = useState<ContainerType>('40HC');
  const [carrierCode, setCarrierCode] = useState('MSK');
  const [condition, setCondition] = useState<PhysicalCondition>('GOOD');
  const [locationName, setLocationName] = useState('Kho Ngoại quan Tân Cảng, TP. Thủ Đức');
  const [depotName, setDepotName] = useState('Depot Tân Cảng Cát Lái');
  const [detentionDays, setDetentionDays] = useState(4);
  const [notes, setNotes] = useState('');
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);

  // Validate check digit trực tiếp khi gõ
  const validation = validateContainerNumber(containerInput);

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentRole !== 'ENTERPRISE_A') {
      alert('Chỉ Bên A mới được đăng ký vỏ container.');
      return;
    }

    if (!validation.isValid) {
      alert(validation.message || 'Mã container không hợp lệ.');
      return;
    }

    const assetData = {
      containerNumber: containerInput.toUpperCase().trim(),
      containerType,
      carrierId: 'CARR-' + carrierCode,
      carrierCode,
      currentCustodianId: currentCompany.id,
      currentCustodianName: currentCompany.shortName,
      physicalCondition: condition,
      conditionNotes: notes || 'Đạt chuẩn đóng hàng xuất khẩu.',
      currentDepotReturnId: 'DEPOT-01',
      currentDepotName: depotName,
      currentLocationName: locationName,
      currentLatitude: 10.7812,
      currentLongitude: 106.7845,
      freeTimeDetentionEnd: new Date(Date.now() + detentionDays * 86400000).toISOString(),
      photos: [
        'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=600&auto=format&fit=crop&q=80'
      ]
    };

    const result = editingAssetId
      ? updateAsset(editingAssetId, assetData)
      : (addAsset(assetData) ? { success: true, message: 'Đăng ký container thành công.' } : { success: false, message: 'Không có quyền đăng ký container.' });

    if (!result.success) {
      alert(result.message);
      return;
    }

    setIsModalOpen(false);
    setContainerInput('');
    setEditingAssetId(null);
    alert(editingAssetId ? 'Cập nhật container thành công!' : 'Đăng ký container thành công!');
  };

  const handleOpenCreate = () => {
    setEditingAssetId(null);
    setContainerInput('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (asset: typeof assets[number]) => {
    setEditingAssetId(asset.id);
    setContainerInput(asset.containerNumber);
    setContainerType(asset.containerType);
    setCarrierCode(asset.carrierCode);
    setCondition(asset.physicalCondition);
    setLocationName(asset.currentLocationName);
    setDepotName(asset.currentDepotName);
    setDetentionDays(Math.max(1, Math.ceil((Date.parse(asset.freeTimeDetentionEnd) - Date.now()) / 86400000)));
    setNotes(asset.conditionNotes || '');
    setIsModalOpen(true);
  };

  const handleDelete = (assetId: string) => {
    if (!window.confirm('Xóa container này? Chỉ container chưa có Offer/giao dịch mới được xóa.')) return;
    const result = deleteAsset(assetId);
    alert(result.message);
  };

  const autoGenerateValidCont = () => {
    const prefixes = ['MSKU', 'CMAU', 'ONEU', 'EMCU', 'TEMU'];
    const p = prefixes[Math.floor(Math.random() * prefixes.length)];
    const serial6 = Math.floor(100000 + Math.random() * 900000).toString();
    const cd = calculateCheckDigit(p + serial6);
    setContainerInput(p + serial6 + cd);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Box className="w-5 h-5 text-brand-400" />
            <span>KHO VỎ CONTAINER (CONTAINER ASSETS)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Quản lý định danh vỏ cont toàn hệ thống theo chuẩn ISO 6346 & hạn lưu bãi/vỏ (Detention Free-time)
          </p>
        </div>

        {currentRole === 'ENTERPRISE_A' && <button
          onClick={handleOpenCreate}
          className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold flex items-center gap-2 shadow-lg shadow-brand-900/40 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Đăng ký Vỏ cont mới</span>
        </button>}
      </div>

      {/* Danh sách Container */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {assets.map((asset) => {
          const check = validateContainerNumber(asset.containerNumber);
          return (
            <div
              key={asset.id}
              className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm hover:border-slate-700 transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-base text-white">
                      {asset.containerNumber}
                    </span>
                    {check.isValid ? (
                      <span className="p-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800" title="Check Digit chuẩn ISO 6346">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </span>
                    ) : (
                      <span className="p-0.5 rounded-full bg-rose-950 text-rose-400 border border-rose-800" title="Sai số kiểm tra">
                        <AlertCircle className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-brand-950 text-brand-400 border border-brand-800">
                      {asset.containerType}
                    </span>
                    <span className="text-xs text-slate-400">
                      Hãng tàu: <strong className="text-slate-200">{asset.carrierCode}</strong>
                    </span>
                  </div>
                </div>

                <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                  asset.physicalCondition === 'GOOD'
                    ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800'
                    : 'bg-amber-950/60 text-amber-400 border-amber-800'
                }`}>
                  {asset.physicalCondition === 'GOOD' ? 'TỐT (GOOD)' : 'XƯỚC NHẸ (MINOR)'}
                </span>
              </div>

              <div className="space-y-2 text-xs text-slate-400 pt-2 border-t border-slate-800/80">
                <div className="flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span className="truncate">Chủ quản lý hiện tại: <strong className="text-slate-300">{asset.currentCustodianName}</strong></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span className="truncate">Vị trí: {asset.currentLocationName}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Hạn Free detention: <strong className="text-amber-300 font-mono">{formatDateOnly(asset.freeTimeDetentionEnd)}</strong></span>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                <span className="text-slate-500">Depot trả dự kiến: {asset.currentDepotName}</span>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400 font-semibold">Khả dụng</span>
                  {currentRole === 'ENTERPRISE_A' && asset.currentCustodianId === currentCompany.id && (
                    <>
                      <button type="button" onClick={() => handleOpenEdit(asset)} className="p-1 text-brand-400 hover:text-brand-300" title="Sửa container">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button type="button" onClick={() => handleDelete(asset.id)} className="p-1 text-rose-400 hover:text-rose-300" title="Xóa container">
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

      {/* Modal đăng ký container */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <Box className="w-5 h-5 text-brand-400" />
              <h3 className="text-lg font-bold text-white">{editingAssetId ? 'CHỈNH SỬA CONTAINER' : 'ĐĂNG KÝ VỎ CONTAINER MỚI'}</h3>
            </div>

            <form onSubmit={handleRegister} className="space-y-4 text-xs">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-300 font-semibold">
                    Mã Container (ISO 6346 - 11 ký tự):
                  </label>
                  <button
                    type="button"
                    onClick={autoGenerateValidCont}
                    className="text-brand-400 hover:underline text-[11px]"
                  >
                    + Tạo ngẫu nhiên mã hợp lệ
                  </button>
                </div>
                <input
                  type="text"
                  value={containerInput}
                  onChange={(e) => setContainerInput(e.target.value.toUpperCase())}
                  placeholder="VD: MSKU8421090"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono text-sm focus:border-brand-500 outline-none uppercase"
                  maxLength={11}
                  required
                />
                {containerInput.length > 0 && (
                  <div className={`mt-1 text-[11px] flex items-center gap-1 ${
                    validation.isValid ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                    {validation.isValid ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5" />
                    )}
                    <span>{validation.message}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Loại Container:</label>
                  <select
                    value={containerType}
                    onChange={(e) => setContainerType(e.target.value as ContainerType)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white outline-none"
                  >
                    <option value="40HC">40HC (High Cube)</option>
                    <option value="20GP">20GP (General Purpose)</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Hãng tàu cấp vỏ:</label>
                  <select
                    value={carrierCode}
                    onChange={(e) => setCarrierCode(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white outline-none"
                  >
                    <option value="MSK">Maersk Line (MSK)</option>
                    <option value="CMA">CMA CGM (CMA)</option>
                    <option value="ONE">Ocean Network Express (ONE)</option>
                    <option value="EMC">Evergreen (EMC)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Hiện trạng vỏ:</label>
                  <select
                    value={condition}
                    onChange={(e) => setCondition(e.target.value as PhysicalCondition)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white outline-none"
                  >
                    <option value="GOOD">Tốt (GOOD - Không móp méo)</option>
                    <option value="MINOR_DAMAGE">Xước nhẹ (MINOR_DAMAGE)</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Hạn Free Detention (ngày):</label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={detentionDays}
                    onChange={(e) => setDetentionDays(parseInt(e.target.value, 10))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Vị trí bãi/kho hiện tại:</label>
                <input
                  type="text"
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Ghi chú tình trạng:</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Sàn khô ráo, không mùi hóa chất, vách kín nước..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white outline-none"
                />
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
                  className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-semibold shadow-md"
                >
                  {editingAssetId ? 'Lưu thay đổi' : 'Xác nhận Đăng ký'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
