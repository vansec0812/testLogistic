// ==============================================================================
// ECont Operations Portal (Cổng Vận hành Ops - Thẩm định, Carrier & Khiếu nại)
// ==============================================================================

import React, { useState } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { formatDateTime } from '../lib/utils';
import { 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  FileText, 
  Ship, 
  Building, 
  MessageSquare
} from 'lucide-react';

export const OpsPortalPage: React.FC = () => {
  const { companies, offers, transactions, cases, resolveCase } = useDatabase();
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');

  const pendingOffers = offers.filter(o => o.status === 'UNDER_REVIEW' || o.status === 'AVAILABLE');
  const carrierPendingTxns = transactions.filter(t => t.status === 'PENDING_CARRIER');
  const openCases = cases.filter(c => c.status === 'OPEN');

  const handleResolve = (caseId: string) => {
    if (!resolutionNote.trim()) {
      alert('Vui lòng nhập tóm tắt kết luận giải quyết của Ops.');
      return;
    }
    resolveCase(caseId, resolutionNote);
    setSelectedCaseId(null);
    setResolutionNote('');
    alert('Đã giải quyết khiếu nại thành công!');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-amber-400" />
          <span>CỔNG ĐIỀU PHỐI VẬN HÀNH (OPERATIONS PORTAL - OPS)</span>
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Hàng đợi xử lý: Thẩm định Doanh nghiệp, Phê duyệt RU Hãng tàu và Xử lý Tranh chấp/Khiếu nại (SRS UI07)
        </p>
      </div>

      {/* 3 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div className="text-xs text-slate-400">DOANH NGHIỆP ĐÃ XÁC MINH</div>
          <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
            {companies.filter(c => c.verificationStatus === 'VERIFIED').length} / {companies.length}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Mã số thuế & GPKD hợp lệ</p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div className="text-xs text-slate-400">CHỜ DUYỆT RU HÃNG TÀU</div>
          <div className="text-2xl font-bold font-mono text-amber-400 mt-1">
            {carrierPendingTxns.length}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Đang chờ Ops nhập số công văn</p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div className="text-xs text-slate-400">CASE KHIẾU NẠI ĐANG MỞ</div>
          <div className="text-2xl font-bold font-mono text-rose-400 mt-1">
            {openCases.length}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Tranh chấp hư hỏng hoặc sai lệch</p>
        </div>
      </div>

      {/* Danh sách Case Tranh chấp cần xử lý */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-3">
          <AlertTriangle className="w-4 h-4 text-rose-400" />
          <span>HÀNG ĐỢI XỬ LÝ KHIẾU NẠI & TRANH CHẤP (CASES DISPUTE)</span>
        </h3>

        {cases.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-xs">
            Không có khiếu nại nào cần giải quyết.
          </div>
        ) : (
          <div className="space-y-3">
            {cases.map((c) => (
              <div
                key={c.id}
                className="p-4 rounded-lg bg-slate-950 border border-slate-800 text-xs space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-white">{c.id}</span>
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-950 text-rose-400 border border-rose-800">
                      {c.caseType}
                    </span>
                    <span className="text-slate-400">· Đơn vị mở: <strong className="text-slate-200">{c.openedByCompanyName}</strong></span>
                  </div>

                  <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                    c.status === 'RESOLVED' ? 'bg-emerald-950 text-emerald-400' : 'bg-amber-950 text-amber-400'
                  }`}>
                    {c.status === 'RESOLVED' ? 'ĐÃ GIẢI QUYẾT' : 'ĐANG MỞ (OPEN)'}
                  </span>
                </div>

                <div className="text-slate-200 font-semibold">{c.title}</div>
                <p className="text-slate-400">{c.description}</p>

                {c.resolutionSummary && (
                  <div className="p-2.5 rounded bg-emerald-950/40 border border-emerald-800/60 text-emerald-300">
                    <strong>Kết luận xử lý của Ops:</strong> {c.resolutionSummary} (Lúc {formatDateTime(c.resolvedAt || '')})
                  </div>
                )}

                {c.status === 'OPEN' && (
                  <div className="pt-2">
                    {selectedCaseId === c.id ? (
                      <div className="space-y-2">
                        <textarea
                          value={resolutionNote}
                          onChange={e => setResolutionNote(e.target.value)}
                          placeholder="Nhập kết luận thẩm định và hướng giải quyết của Ops..."
                          className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 text-white outline-none"
                          rows={2}
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleResolve(c.id)}
                            className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                          >
                            Xác nhận Kết luận & Đóng Case
                          </button>
                          <button
                            onClick={() => setSelectedCaseId(null)}
                            className="px-3 py-1 rounded bg-slate-800 text-slate-300"
                          >
                            Đóng
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setSelectedCaseId(c.id)}
                        className="px-3 py-1.5 rounded bg-brand-600 hover:bg-brand-500 text-white font-bold"
                      >
                        Tiếp nhận & Xử lý Khiếu nại
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

