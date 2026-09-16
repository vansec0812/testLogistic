// ==============================================================================
// ECont Transactions Lifecycle Page: Vòng đời giao dịch 7 bước hoàn chỉnh
// ==============================================================================

import React, { useState } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { useAuth } from '../context/AuthContext';
import { TransactionStepper } from '../components/TransactionStepper';
import { PricingBreakdownCard } from '../components/PricingBreakdownCard';
import { formatVnd, formatDateTime } from '../lib/utils';
import { 
  FileText, 
  Ship, 
  CreditCard, 
  QrCode, 
  Eye, 
  PenTool, 
  CheckCircle, 
  AlertTriangle, 
  ShieldCheck, 
  Download, 
  CheckCircle2, 
  Camera,
  Truck,
  Building,
  UserCheck
} from 'lucide-react';

interface TransactionsPageProps {
  selectedTxnId?: string;
  setSelectedTxnId: (id: string) => void;
}

export const TransactionsPage: React.FC<TransactionsPageProps> = ({
  selectedTxnId,
  setSelectedTxnId
}) => {
  const { 
    transactions, 
    acceptAgreement, 
    opsApproveCarrier, 
    settlePayment, 
    submitInspection, 
    confirmHandover,
    toggleHold
  } = useDatabase();
  const { currentRole } = useAuth();

  // Chọn giao dịch đang xem
  const activeTxn = transactions.find(t => t.id === selectedTxnId) || transactions[0];

  // State cho các bước
  const [carrierRef, setCarrierRef] = useState('MSK-RU-2026-9812');
  const [evidenceName, setEvidenceName] = useState('CV_Chap_Thuan_Cap_Lai_Vo_MSK.pdf');
  
  // State checklist kiểm tra cont 6 mặt
  const [chkFloor, setChkFloor] = useState(true);
  const [chkWalls, setChkWalls] = useState(true);
  const [chkRoof, setChkRoof] = useState(true);
  const [chkDoors, setChkDoors] = useState(true);
  const [chkGaskets, setChkGaskets] = useState(true);
  const [chkUndercarriage, setChkUndercarriage] = useState(true);
  const [isDiscrepancy, setIsDiscrepancy] = useState(false);
  const [discrepancyNote, setDiscrepancyNote] = useState('');

  if (!activeTxn) {
    return (
      <div className="py-16 text-center space-y-3">
        <FileText className="w-12 h-12 text-slate-600 mx-auto" />
        <h3 className="text-lg font-bold text-white">Chưa có giao dịch nào</h3>
        <p className="text-xs text-slate-400">Hãy vào mục Nhu cầu (Requests) để khớp lệnh và giữ chỗ container.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Header & Selector if multiple transactions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <FileText className="w-5 h-5 text-brand-400" />
            <span>CHI TIẾT VÒNG ĐỜI GIAO DỊCH 7 BƯỚC</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Mã giao dịch: <strong className="font-mono text-slate-200">{activeTxn.id}</strong> · Cont: <strong className="font-mono text-brand-400">{activeTxn.asset.containerNumber}</strong>
          </p>
        </div>

        {transactions.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Chọn giao dịch:</span>
            <select
              value={activeTxn.id}
              onChange={(e) => setSelectedTxnId(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white font-mono outline-none"
            >
              {transactions.map(t => (
                <option key={t.id} value={t.id}>
                  {t.id} - {t.asset.containerNumber} ({t.status})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* 2. Stepper Component */}
      <TransactionStepper transaction={activeTxn} />

      {/* 3. Action Panel based on Current Step */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Flow Control (Left 2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* BƯỚC 1: NEGOTIATING */}
          {activeTxn.status === 'NEGOTIATING' && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-brand-950 text-brand-400 flex items-center justify-center font-bold text-sm">
                    1
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white uppercase">
                      BƯỚC 1: XEM XÉT & KÝ CHẤP NHẬN THỎA THUẬN TÁI SỬ DỤNG VỎ
                    </h4>
                    <p className="text-[11px] text-slate-400">Phiên bản Thỏa thuận: v1.0 (Bảo vệ pháp lý 2 bên)</p>
                  </div>
                </div>
              </div>

              {/* Tóm tắt điều khoản thỏa thuận */}
              <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 text-xs space-y-2 text-slate-300">
                <div className="font-semibold text-white mb-1">Tóm tắt Thỏa thuận Tái sử dụng Container (ECont Agreement):</div>
                <p>1. <strong>Bên A ({activeTxn.companyAName})</strong> cam kết container {activeTxn.asset.containerNumber} đạt chuẩn đóng hàng xuất khẩu, còn hạn detention tối thiểu đến ngày quy định.</p>
                <p>2. <strong>Bên B ({activeTxn.companyBName})</strong> chịu trách nhiệm điều xe kéo cont từ kho A đến kho B và nhận bàn giao đúng hạn cut-off.</p>
                <p>3. Phí tái sử dụng của Hãng tàu được chia sẻ tỷ lệ α = {activeTxn.quote.shareAlpha}. Phí dịch vụ ECont chỉ thu trên mức tiết kiệm thực tế.</p>
              </div>

              {/* Trạng thái ký của A và B */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-emerald-400">BÊN A (Chủ vỏ)</div>
                    <div className="text-[11px] text-slate-400">
                      {activeTxn.companyAAcceptedAt ? `Đã ký: ${formatDateTime(activeTxn.companyAAcceptedAt)}` : 'Chưa ký'}
                    </div>
                  </div>
                  {activeTxn.companyAAcceptedAt ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <button
                      onClick={() => acceptAgreement(activeTxn.id, 'A')}
                      className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow transition-colors"
                    >
                      Bên A Ký chấp thuận
                    </button>
                  )}
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-blue-400">BÊN B (Chủ hàng)</div>
                    <div className="text-[11px] text-slate-400">
                      {activeTxn.companyBAcceptedAt ? `Đã ký: ${formatDateTime(activeTxn.companyBAcceptedAt)}` : 'Chưa ký'}
                    </div>
                  </div>
                  {activeTxn.companyBAcceptedAt ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <button
                      onClick={() => acceptAgreement(activeTxn.id, 'B')}
                      className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow transition-colors"
                    >
                      Bên B Ký chấp thuận
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* BƯỚC 2: PENDING_CARRIER */}
          {activeTxn.status === 'PENDING_CARRIER' && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-950 text-amber-400 flex items-center justify-center font-bold text-sm">
                    2
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white uppercase">
                      BƯỚC 2: TIẾP NHẬN PHÊ DUYỆT CẤP LẠI VỎ (RU APPROVAL) TỪ HÃNG TÀU
                    </h4>
                    <p className="text-[11px] text-slate-400">Bộ phận Ops ghi nhận bằng chứng văn bản phê duyệt của Hãng {activeTxn.asset.carrierCode}</p>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-3 text-xs">
                <p className="text-slate-300">
                  Trong giai đoạn MVP, Hãng tàu ({activeTxn.asset.carrierCode}) phê duyệt ngoài hệ thống. Bộ phận Vận hành (Ops) kiểm tra tính hợp lệ của văn bản và tải minh chứng vào hệ thống.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">Số văn bản RU của Hãng tàu:</label>
                    <input
                      type="text"
                      value={carrierRef}
                      onChange={(e) => setCarrierRef(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white font-mono outline-none uppercase"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">Tên file công văn đính kèm:</label>
                    <input
                      type="text"
                      value={evidenceName}
                      onChange={(e) => setEvidenceName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white outline-none"
                      required
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => opsApproveCarrier(activeTxn.id, carrierRef, evidenceName)}
                    className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold flex items-center gap-2 shadow-md transition-colors"
                  >
                    <Ship className="w-4 h-4" />
                    <span>Xác nhận Hãng tàu Đã Duyệt RU (Chuyển Bước 3)</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* BƯỚC 3: AWAITING_PAYMENT */}
          {activeTxn.status === 'AWAITING_PAYMENT' && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-purple-950 text-purple-400 flex items-center justify-center font-bold text-sm">
                    3
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white uppercase">
                      BƯỚC 3: ĐỐI SOÁT & THANH TOÁN NGHĨA VỤ PHÍ QUA ECONT
                    </h4>
                    <p className="text-[11px] text-slate-400">Tài chính đối soát tiền thu hộ RU và phí dịch vụ nền tảng</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Lệnh thu bên A */}
                <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-400 uppercase">NGHĨA VỤ BÊN A</span>
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                      activeTxn.paymentOrderA?.status === 'SETTLED' ? 'bg-emerald-950 text-emerald-400' : 'bg-amber-950 text-amber-400'
                    }`}>
                      {activeTxn.paymentOrderA?.status === 'SETTLED' ? 'ĐÃ ĐỐI SOÁT' : 'CHỜ THU'}
                    </span>
                  </div>
                  <div className="text-base font-bold font-mono text-white">
                    {formatVnd(activeTxn.quote.econtCollectedFromA)}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Bao gồm: Phí RU gánh (600k) + Phí nền tảng A (600k)
                  </div>
                  {activeTxn.paymentOrderA?.status !== 'SETTLED' && (
                    <button
                      onClick={() => settlePayment(activeTxn.id, 'A', 'MB-TRAN-A9842')}
                      className="w-full mt-2 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow"
                    >
                      Xác nhận đã nhận tiền Bên A
                    </button>
                  )}
                </div>

                {/* Lệnh thu bên B */}
                <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-blue-400 uppercase">NGHĨA VỤ BÊN B</span>
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                      activeTxn.paymentOrderB?.status === 'SETTLED' ? 'bg-emerald-950 text-emerald-400' : 'bg-amber-950 text-amber-400'
                    }`}>
                      {activeTxn.paymentOrderB?.status === 'SETTLED' ? 'ĐÃ ĐỐI SOÁT' : 'CHỜ THU'}
                    </span>
                  </div>
                  <div className="text-base font-bold font-mono text-white">
                    {formatVnd(activeTxn.quote.econtCollectedFromB)}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Bao gồm: Phí RU gánh (600k) + Phí nền tảng B (300k)
                  </div>
                  {activeTxn.paymentOrderB?.status !== 'SETTLED' && (
                    <button
                      onClick={() => settlePayment(activeTxn.id, 'B', 'VCB-TRAN-B1290')}
                      className="w-full mt-2 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold shadow"
                    >
                      Xác nhận đã nhận tiền Bên B
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* BƯỚC 4: READY_FOR_PICKUP (Phát hành phiếu điều phối) */}
          {activeTxn.status === 'READY_FOR_PICKUP' && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-950 text-emerald-400 flex items-center justify-center font-bold text-sm">
                    4
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white uppercase">
                      BƯỚC 4: PHIẾU ĐIỀU PHỐI ĐÃ KÍCH HOẠT (DISPATCH PERMIT)
                    </h4>
                    <p className="text-[11px] text-slate-400">Mã phiếu hợp lệ · Tài xế dùng mã QR để check-in tại cổng kho A</p>
                  </div>
                </div>
              </div>

              {/* Thông tin phiếu Dispatch Permit */}
              <div className="p-4 rounded-lg bg-slate-950 border border-emerald-700/60 flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1 text-xs">
                  <div className="text-emerald-400 font-mono font-bold text-sm">
                    {activeTxn.dispatchPermit?.permitNumber || 'ECONT-DP-984210'}
                  </div>
                  <div className="text-slate-300">
                    Tài xế nhận cont: <strong className="text-white">{activeTxn.dispatchPermit?.driverName || 'Nguyễn Văn Tài'}</strong> · Biển số xe: <strong className="font-mono text-amber-300">51D-894.22</strong>
                  </div>
                  <div className="text-slate-400">
                    Địa điểm lấy: {activeTxn.asset.currentLocationName}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Token xác thực bảo mật: <span className="font-mono text-slate-400">{activeTxn.dispatchPermit?.verificationToken || 'DP-SEC-8921'}</span>
                  </div>
                </div>

                <div className="flex flex-col items-center p-3 rounded-lg bg-white text-slate-950 text-center">
                  <QrCode className="w-16 h-16" />
                  <span className="text-[9px] font-mono font-bold mt-1">QUÉT MÃ QR NHẬN VỎ</span>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => submitInspection(activeTxn.id, {
                    inspectorName: 'Nguyễn Văn Tài (Tài xế/Đại diện bên B)',
                    checklistFloor: true,
                    checklistWalls: true,
                    checklistRoof: true,
                    checklistDoors: true,
                    checklistGaskets: true,
                    checklistUndercarriage: true,
                    isDiscrepancyFound: false
                  })}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-2 shadow-md transition-colors"
                >
                  <Eye className="w-4 h-4" />
                  <span>Tài xế Đã Tới Kho A & Tiến Hành Kiểm Tra (Chuyển Bước 5)</span>
                </button>
              </div>
            </div>
          )}

          {/* BƯỚC 5: INSPECTION (Kiểm tra 6 mặt thực địa) */}
          {activeTxn.status === 'INSPECTION' && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-brand-950 text-brand-400 flex items-center justify-center font-bold text-sm">
                    5
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white uppercase">
                      BƯỚC 5: BIÊN BẢN KIỂM TRA THỰC ĐỊA 6 MẶT CONTAINER
                    </h4>
                    <p className="text-[11px] text-slate-400">Tài xế/Đại diện Bên B kiểm tra thực tế trước khi bấm nhận cont</p>
                  </div>
                </div>
              </div>

              {/* 6 hạng mục kiểm tra theo tiêu chuẩn IICL */}
              <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-3 text-xs">
                <div className="font-semibold text-slate-200">Tiêu chí kiểm tra tình trạng vỏ cont (IICL Standard):</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <label className="flex items-center gap-2 p-2 rounded bg-slate-900 border border-slate-800 cursor-pointer">
                    <input type="checkbox" checked={chkFloor} onChange={e => setChkFloor(e.target.checked)} className="rounded" />
                    <span>1. Sàn gỗ sạch / khô</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 rounded bg-slate-900 border border-slate-800 cursor-pointer">
                    <input type="checkbox" checked={chkWalls} onChange={e => setChkWalls(e.target.checked)} className="rounded" />
                    <span>2. Vách không thủng</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 rounded bg-slate-900 border border-slate-800 cursor-pointer">
                    <input type="checkbox" checked={chkRoof} onChange={e => setChkRoof(e.target.checked)} className="rounded" />
                    <span>3. Nóc kín nước 100%</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 rounded bg-slate-900 border border-slate-800 cursor-pointer">
                    <input type="checkbox" checked={chkDoors} onChange={e => setChkDoors(e.target.checked)} className="rounded" />
                    <span>4. Cửa đóng mở nhẹ</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 rounded bg-slate-900 border border-slate-800 cursor-pointer">
                    <input type="checkbox" checked={chkGaskets} onChange={e => setChkGaskets(e.target.checked)} className="rounded" />
                    <span>5. Gioăng cao su khít</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 rounded bg-slate-900 border border-slate-800 cursor-pointer">
                    <input type="checkbox" checked={chkUndercarriage} onChange={e => setChkUndercarriage(e.target.checked)} className="rounded" />
                    <span>6. Đà đáy vững chắc</span>
                  </label>
                </div>

                {/* Tùy chọn báo hư hỏng (Kiểm tra luồng ngoại lệ ON_HOLD) */}
                <div className="pt-2">
                  <label className="flex items-center gap-2 text-rose-400 font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isDiscrepancy}
                      onChange={e => setIsDiscrepancy(e.target.checked)}
                      className="rounded text-rose-600"
                    />
                    <span>Phát hiện sai lệch/hư hỏng nặng không thể nhận cont (Kích hoạt ON_HOLD)</span>
                  </label>
                  {isDiscrepancy && (
                    <div className="mt-2">
                      <textarea
                        value={discrepancyNote}
                        onChange={e => setDiscrepancyNote(e.target.value)}
                        placeholder="Mô tả chi tiết sai lệch (vd: thủng nóc 10cm, rách đà đáy)..."
                        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-rose-800 text-white outline-none"
                        rows={2}
                        required
                      />
                    </div>
                  )}
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    onClick={() => submitInspection(activeTxn.id, {
                      inspectorName: 'Nguyễn Văn Tài (Tài xế nhận cont)',
                      checklistFloor: chkFloor,
                      checklistWalls: chkWalls,
                      checklistRoof: chkRoof,
                      checklistDoors: chkDoors,
                      checklistGaskets: chkGaskets,
                      checklistUndercarriage: chkUndercarriage,
                      isDiscrepancyFound: isDiscrepancy,
                      discrepancyNotes: discrepancyNote
                    })}
                    className={`px-4 py-2 rounded-lg text-white font-bold shadow-md transition-colors ${
                      isDiscrepancy
                        ? 'bg-rose-600 hover:bg-rose-500'
                        : 'bg-emerald-600 hover:bg-emerald-500'
                    }`}
                  >
                    {isDiscrepancy ? 'Báo cáo Sai lệch & Kích hoạt ON_HOLD' : 'Xác nhận Cont Đạt Chuẩn & Chuyển Bước 6'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* BƯỚC 6: HANDOVER_PENDING (Ký xác nhận bàn giao 2 bên) */}
          {activeTxn.status === 'HANDOVER_PENDING' && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-950 text-emerald-400 flex items-center justify-center font-bold text-sm">
                    6
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white uppercase">
                      BƯỚC 6: KÝ BIÊN BẢN BÀN GIAO ĐỒNG THỜI (DUAL CONFIRMATION)
                    </h4>
                    <p className="text-[11px] text-slate-400">Hai bên xác nhận cùng một mã băm biên bản (Handover Hash) để hoàn tất giao nhận</p>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 text-xs space-y-3">
                <p className="text-slate-300">
                  Biên bản kiểm tra 6 mặt đã hoàn tất đạt chuẩn. Bên A (Kho giao) và Bên B (Tài xế/Kho nhận) cùng bấm nút ký xác nhận để hệ thống chốt giao dịch và chuyển giao quyền sở hữu quản lý cont (Custody).
                </p>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => confirmHandover(activeTxn.id, 'A')}
                    className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-bold flex items-center gap-1.5 shadow-lg transition-colors"
                  >
                    <PenTool className="w-4 h-4" />
                    <span>Cả 2 Bên Cùng Ký Hoàn Tất Bàn Giao (Chuyển COMPLETED)</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* BƯỚC 7: COMPLETED */}
          {activeTxn.status === 'COMPLETED' && (
            <div className="bg-slate-900 border border-emerald-600/60 rounded-xl p-6 shadow-xl space-y-4 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white uppercase">
                GIAO DỊCH ĐÃ HOÀN TẤT THÀNH CÔNG (COMPLETED)
              </h3>
              <p className="text-xs text-slate-300 max-w-lg mx-auto">
                Quyền quản lý (Custody) của container <strong className="font-mono text-emerald-400">{activeTxn.asset.containerNumber}</strong> đã được chuyển giao thành công cho <strong className="text-white">{activeTxn.companyBName}</strong>.
              </p>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs max-w-md mx-auto text-slate-400">
                Mã xác thực bàn giao (SHA-256): <span className="font-mono text-emerald-400">{activeTxn.handoverHash || 'SHA256:ECONT-984210'}</span>
              </div>
            </div>
          )}

          {/* Bảng bóc tách chi phí & tiết kiệm của giao dịch này */}
          {activeTxn.quote && (
            <PricingBreakdownCard quote={activeTxn.quote} />
          )}
        </div>

        {/* Right 1 col: Quick Info & Dispute Controls */}
        <div className="space-y-6">
          {/* Thông tin Container & Đối tác */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg text-xs space-y-3">
            <h4 className="font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-2 flex items-center gap-1.5">
              <Building className="w-4 h-4 text-brand-400" />
              <span>THÔNG TIN ĐỐI TÁC GIAO DỊCH</span>
            </h4>

            <div>
              <span className="text-slate-400 block text-[11px]">BÊN A (Chủ nguồn vỏ):</span>
              <strong className="text-slate-200 text-sm">{activeTxn.companyAName}</strong>
            </div>

            <div>
              <span className="text-slate-400 block text-[11px]">BÊN B (Chủ hàng xuất khẩu):</span>
              <strong className="text-slate-200 text-sm">{activeTxn.companyBName}</strong>
            </div>

            <div className="pt-2 border-t border-slate-800/80">
              <span className="text-slate-400 block text-[11px]">Container:</span>
              <div className="font-mono font-bold text-white text-sm">
                {activeTxn.asset.containerNumber} ({activeTxn.asset.containerType})
              </div>
              <div className="text-slate-400 text-[11px] mt-0.5">
                Hãng tàu: {activeTxn.asset.carrierCode}
              </div>
            </div>
          </div>

          {/* Công cụ can thiệp Ops (Hold / Dispute) */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg text-xs space-y-3">
            <h4 className="font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-2 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>KIỂM SOÁT SỰ CỐ & TẠM DỪNG (HOLD)</span>
            </h4>
            <p className="text-[11px] text-slate-400">
              Khi phát hiện sai lệch hiện trạng, tiền đến muộn hoặc từ chối carrier, Ops có thể kích hoạt Tạm dừng (ON_HOLD).
            </p>

            {activeTxn.isOnHold ? (
              <button
                onClick={() => toggleHold(activeTxn.id, false)}
                className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-colors"
              >
                Gỡ bỏ Tạm dừng (Release Hold)
              </button>
            ) : (
              <button
                onClick={() => toggleHold(activeTxn.id, true, 'Ops tạm dừng để xác minh thông tin')}
                className="w-full py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold transition-colors"
              >
                Kích hoạt Tạm dừng (ON_HOLD)
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
