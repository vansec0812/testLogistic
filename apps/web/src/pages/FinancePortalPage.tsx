// ==============================================================================
// ECont Finance & Settlement Portal (Cổng Tài chính - Đối soát & Hoàn tiền)
// ==============================================================================

import React, { useState } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { formatVnd, formatDateTime } from '../lib/utils';
import { 
  CreditCard, 
  DollarSign, 
  CheckCircle2, 
  Clock, 
  ArrowDownRight, 
  RefreshCw, 
  FileSpreadsheet,
  AlertCircle
} from 'lucide-react';

export const FinancePortalPage: React.FC = () => {
  const { transactions } = useDatabase();

  const allPaymentOrders = transactions.flatMap(t => {
    const list = [];
    if (t.paymentOrderA) list.push({ ...t.paymentOrderA, txn: t });
    if (t.paymentOrderB) list.push({ ...t.paymentOrderB, txn: t });
    return list;
  });

  const totalCollected = allPaymentOrders
    .filter(p => p.status === 'SETTLED')
    .reduce((sum, p) => sum + p.amountVnd, 0);

  const totalPending = allPaymentOrders
    .filter(p => p.status === 'PENDING')
    .reduce((sum, p) => sum + p.amountVnd, 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-purple-400" />
          <span>CỔNG TÀI CHÍNH & ĐỐI SOÁT (FINANCE & SETTLEMENT)</span>
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Theo dõi nghĩa vụ nộp tiền, đối soát chuyển khoản ngân hàng, tài khoản tạm giữ (Suspense) và hoàn tiền Maker-Checker
        </p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div className="text-xs text-slate-400">TỔNG THU HỘ ĐÃ ĐỐI SOÁT</div>
          <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
            {formatVnd(totalCollected)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Đã vào tài khoản thanh toán ECont</p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div className="text-xs text-slate-400">NGHĨA VỤ ĐANG CHỜ NỘP</div>
          <div className="text-2xl font-bold font-mono text-amber-400 mt-1">
            {formatVnd(totalPending)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Chờ A/B chuyển khoản</p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div className="text-xs text-slate-400">TÀI KHOẢN TẠM GIỮ (SUSPENSE)</div>
          <div className="text-2xl font-bold font-mono text-blue-400 mt-1">
            0 ₫
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Không có khoản tiền lệch hoặc đến muộn</p>
        </div>
      </div>

      {/* Danh sách Lệnh Thu Tiền */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            DANH SÁCH LỆNH THANH TOÁN (PAYMENT ORDERS)
          </h3>
          <span className="text-xs text-slate-400 font-mono">Tổng cộng: {allPaymentOrders.length} lệnh</span>
        </div>

        {allPaymentOrders.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-xs">
            Chưa phát sinh lệnh thanh toán nào. Khi Hãng tàu duyệt RU, lệnh thanh toán sẽ tự động khởi tạo.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase font-mono text-[10px]">
                <tr>
                  <th className="p-3">Mã Lệnh</th>
                  <th className="p-3">Giao Dịch / Cont</th>
                  <th className="p-3">Đơn Vị Nộp</th>
                  <th className="p-3">Vai Trò</th>
                  <th className="p-3">Số Tiền (VND)</th>
                  <th className="p-3">Mã Tham Chiếu NH</th>
                  <th className="p-3">Trạng Thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {allPaymentOrders.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-850">
                    <td className="p-3 font-mono font-bold text-white">{p.id}</td>
                    <td className="p-3">
                      <div className="font-mono text-brand-300">{p.txn.asset.containerNumber}</div>
                      <div className="text-[10px] text-slate-500">{p.transactionId}</div>
                    </td>
                    <td className="p-3 font-medium text-slate-200">{p.companyName}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        p.payerRole === 'PARTY_A' ? 'bg-emerald-950 text-emerald-400' : 'bg-blue-950 text-blue-400'
                      }`}>
                        {p.payerRole === 'PARTY_A' ? 'BÊN A' : 'BÊN B'}
                      </span>
                    </td>
                    <td className="p-3 font-mono font-bold text-white">{formatVnd(p.amountVnd)}</td>
                    <td className="p-3 font-mono text-slate-400">{p.bankReference || 'Chờ chuyển khoản'}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        p.status === 'SETTLED'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : 'bg-amber-950 text-amber-400 border border-amber-800'
                      }`}>
                        {p.status === 'SETTLED' ? 'ĐÃ ĐỐI SOÁT' : 'CHỜ THU'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

