// ==============================================================================
// ECont Demand Requests Page (Doanh nghiệp B - Nhu cầu mượn vỏ xuất khẩu)
// ==============================================================================

import React, { useState } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { useAuth } from '../context/AuthContext';
import { ContainerRequest, ContainerType } from '../types';
import { formatVnd, formatDateTime } from '../lib/utils';
import { MatchingModal } from '../components/MatchingModal';
import { 
  FileText, 
  Plus, 
  MapPin, 
  Calendar, 
  Clock, 
  DollarSign, 
  Sparkles, 
  Navigation,
  X
} from 'lucide-react';

interface RequestsPageProps {
  setCurrentTab: (tab: string) => void;
  setSelectedTxnId: (id: string) => void;
}

export const RequestsPage: React.FC<RequestsPageProps> = ({ setCurrentTab, setSelectedTxnId }) => {
  const { requests, addRequest } = useDatabase();
  const { currentCompany } = useAuth();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [matchingRequest, setMatchingRequest] = useState<ContainerRequest | null>(null);

  // Form states
  const [bookingNumber, setBookingNumber] = useState('MSK-VN-' + Math.floor(100000 + Math.random() * 900000));
  const [carrierCode, setCarrierCode] = useState('MSK');
  const [containerType, setContainerType] = useState<ContainerType>('40HC');
  const [deliveryLocation, setDeliveryLocation] = useState('Nhà máy May Toàn Cầu, KCN Sóng Thần 1, Dĩ An, Bình Dương');
  const [cargoType, setCargoType] = useState('Hàng may mặc xuất khẩu đi Mỹ');
  const [maxDistance, setMaxDistance] = useState(40);
  const [baselinePickupCost, setBaselinePickupCost] = useState(3400000);

  const handleCreateRequest = (e: React.FormEvent) => {
    e.preventDefault();
    const newReq = addRequest({
      companyId: currentCompany.id,
      companyName: currentCompany.companyName,
      carrierId: 'CARR-' + carrierCode,
      carrierCode,
      containerType,
      bookingNumber,
      status: 'OPEN',
      deliveryLocationName: deliveryLocation,
      deliveryLatitude: 10.8924,
      deliveryLongitude: 106.7451,
      pickupWindowStart: new Date(Date.now() + 3600000).toISOString(),
      pickupWindowEnd: new Date(Date.now() + 48 * 3600000).toISOString(),
      cutOffTime: new Date(Date.now() + 72 * 3600000).toISOString(),
      maxDistanceKm: maxDistance,
      cargoType,
      baselinePickupCostVnd: baselinePickupCost
    });

    setIsModalOpen(false);
    // Tự động mở matching modal cho request vừa tạo
    setMatchingRequest(newReq);
  };

  const handleGoToTransaction = (txnId: string) => {
    setSelectedTxnId(txnId);
    setCurrentTab('transactions');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-400" />
            <span>NHU CẦU VỎ CONTAINER THEO BOOKING (REQUESTS)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Chủ hàng xuất khẩu đăng ký nhu cầu theo số Booking hãng tàu để thuật toán tìm vỏ ghép đôi tối ưu
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold flex items-center gap-2 shadow-lg shadow-blue-900/40 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Tạo Nhu cầu Booking mới</span>
        </button>
      </div>

      {/* Danh sách Requests */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {requests.map((req) => (
          <div
            key={req.id}
            className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm hover:border-slate-700 transition-all space-y-4"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-base text-white">
                    {req.bookingNumber}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-brand-950 text-brand-400 border border-brand-800">
                    {req.containerType}
                  </span>
                  <span className="text-xs text-slate-400">· Hãng {req.carrierCode}</span>
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  Chủ hàng: <strong className="text-slate-200">{req.companyName}</strong>
                </div>
              </div>

              <span className={`px-2.5 py-0.5 rounded text-xs font-bold border ${
                req.status === 'OPEN'
                  ? 'bg-blue-950 text-blue-400 border-blue-700'
                  : 'bg-amber-950 text-amber-400 border-amber-700'
              }`}>
                {req.status}
              </span>
            </div>

            <div className="space-y-2 text-xs text-slate-400 py-3 border-y border-slate-800/80">
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span>Nơi giao hàng: <strong className="text-slate-300">{req.deliveryLocationName}</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Hạn Closing (Cut-off): <strong className="text-amber-300 font-mono">{formatDateTime(req.cutOffTime)}</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <Navigation className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span>Bán kính tìm kiếm (Dmax): <strong className="text-slate-300">{req.maxDistanceKm} km</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span>Cước lấy cont depot cũ (T_B): <strong className="text-slate-200 font-mono">{formatVnd(req.baselinePickupCostVnd)}</strong></span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-slate-400">Loại hàng: {req.cargoType}</span>
              <button
                onClick={() => setMatchingRequest(req)}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-950 transition-all"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Khớp lệnh & Báo giá (Matching)</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Matching */}
      {matchingRequest && (
        <MatchingModal
          request={matchingRequest}
          onClose={() => setMatchingRequest(null)}
          onGoToTransaction={handleGoToTransaction}
        />
      )}

      {/* Modal tạo Request */}
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
              <Plus className="w-5 h-5 text-blue-400" />
              <span>ĐĂNG KÝ NHU CẦU VỎ THEO BOOKING HÃNG TÀU</span>
            </h3>

            <form onSubmit={handleCreateRequest} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">
                    Số Booking hãng tàu:
                  </label>
                  <input
                    type="text"
                    value={bookingNumber}
                    onChange={(e) => setBookingNumber(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono outline-none uppercase"
                    required
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Hãng tàu:</label>
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
                  <label className="text-slate-300 font-semibold block mb-1">Bán kính tìm vỏ (Dmax - km):</label>
                  <input
                    type="number"
                    value={maxDistance}
                    onChange={(e) => setMaxDistance(parseInt(e.target.value, 10))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  Địa điểm nhận vỏ & đóng hàng (Kho bên B):
                </label>
                <input
                  type="text"
                  value={deliveryLocation}
                  onChange={(e) => setDeliveryLocation(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Loại hàng hóa đóng xuất khẩu:</label>
                  <input
                    type="text"
                    value={cargoType}
                    onChange={(e) => setCargoType(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">
                    Cước lấy depot cũ (T_B - VND):
                  </label>
                  <input
                    type="number"
                    step={100000}
                    value={baselinePickupCost}
                    onChange={(e) => setBaselinePickupCost(parseInt(e.target.value, 10))}
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
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-md"
                >
                  Đăng ký & Tìm vỏ ngay
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

