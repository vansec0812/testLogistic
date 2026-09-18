// ==============================================================================
// ECont Finance & Settlement Portal - Version 2.0
// Cổng Tài chính, Đối soát thanh toán, Tài khoản tạm giữ & Hoàn tiền (SRS UI08)
// ==============================================================================

import React, { useState } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { useAuth } from '../context/AuthContext';
import { formatVnd, formatDateTime, formatRelativeTime } from '../lib/utils';
import { 
  CreditCard, 
  DollarSign, 
  CheckCircle2, 
  Clock, 
  ArrowDownRight, 
  RefreshCw, 
  FileSpreadsheet,
  AlertCircle,
  Building,
  Check,
  X,
  ExternalLink,
  ShieldCheck,
  RotateCcw
} from 'lucide-react';
import { PaymentOrder, PaymentOrderStatus } from '../types';
import { FieldErrors, FieldError, FormErrorSummary, RequiredMark, getFieldErrorClass, scrollToFirstFieldError } from '../components/FormValidation';
import { required, positiveNumber, setError } from '../lib/formValidation';

interface FinancePortalPageProps {
  setCurrentTab?: (tab: string) => void;
  setSelectedTxnId?: (id: string) => void;
}

export const FinancePortalPage: React.FC<FinancePortalPageProps> = ({
  setCurrentTab,
  setSelectedTxnId
}) => {
  const { transactions, settlePayment } = useDatabase();
  const { currentRole } = useAuth();

  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [activeTab, setActiveTab] = useState<'orders' | 'suspense' | 'refunds'>('orders');

  // Settle modal
  const [settleModalOrder, setSettleModalOrder] = useState<{ txnId: string; party: 'A' | 'B'; order: PaymentOrder } | null>(null);
  const [bankRefInput, setBankRefInput] = useState('');
  const [paidAmountInput, setPaidAmountInput] = useState<number>(0);
  const [settleErrors, setSettleErrors] = useState<FieldErrors>({});

  // All payment orders flattened
  const allPaymentOrders = transactions.flatMap(t => {
    const list: Array<{ txnId: string; party: 'A' | 'B'; order: PaymentOrder }> = [];
    if (t.paymentOrderA) list.push({ txnId: t.id, party: 'A', order: t.paymentOrderA });
    if (t.paymentOrderB) list.push({ txnId: t.id, party: 'B', order: t.paymentOrderB });
    return list;
  });

  const totalCollected = allPaymentOrders
    .filter(p => p.order.status === 'PAID')
    .reduce((sum, p) => sum + (p.order.paidAmountVnd || p.order.amountVnd), 0);

  const totalPending = allPaymentOrders
    .filter(p => p.order.status === 'OPEN' || p.order.status === 'PARTIAL')
    .reduce((sum, p) => sum + p.order.amountVnd, 0);

  const filteredOrders = allPaymentOrders.filter(p => {
    if (filterStatus === 'ALL') return true;
    return p.order.status === filterStatus;
  });

  const handleOpenSettle = (item: { txnId: string; party: 'A' | 'B'; order: PaymentOrder }) => {
    setSettleModalOrder(item);
    setBankRefInput(`MB-${item.txnId.slice(-4)}-${Date.now().toString().slice(-4)}`);
    setPaidAmountInput(item.order.amountVnd);
  };

  const handleConfirmSettle = () => {
    if (!settleModalOrder) return;
    const errors: FieldErrors = {};
    setError(errors, 'bankRefInput', required(bankRefInput, 'Vui lòng nhập mã tham chiếu ngân hàng.'));
    setError(errors, 'paidAmountInput', positiveNumber(paidAmountInput, 'Số tiền thực tế nhận phải lớn hơn 0.'));
    if (paidAmountInput !== settleModalOrder.order.amountVnd) {
      errors.paidAmountInput = `Số tiền phải đúng bằng ${formatVnd(settleModalOrder.order.amountVnd)}.`;
    }
    setSettleErrors(errors);
    if (Object.keys(errors).length > 0) {
      scrollToFirstFieldError(errors);
      return;
    }
    const res = settlePayment(settleModalOrder.txnId, settleModalOrder.party, bankRefInput.trim(), paidAmountInput);
    if (res.success) {
      alert(res.message);
      setSettleModalOrder(null);
      setSettleErrors({});
    } else {
      setSettleErrors({ bankRefInput: res.message });
      scrollToFirstFieldError({ bankRefInput: res.message });
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Title */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-purple-600" />
            <span>CỔNG TÀI CHÍNH & ĐỐI SOÁT (FINANCE & SETTLEMENT)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Theo dõi nghĩa vụ nộp tiền, đối soát giao dịch ngân hàng, quản lý tài khoản tạm giữ (Suspense) và hoàn tiền theo cơ chế Maker-Checker
          </p>
        </div>

        <span className="px-3.5 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Tài khoản thanh toán ECont · Vietcombank</span>
        </span>
      </div>

      {/* 2. Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">TỔNG THU HỘ ĐÃ ĐỐI SOÁT</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-700 mt-2">
            {formatVnd(totalCollected)}
          </div>
          <p className="text-xs text-slate-500 mt-1">Tiền đã vào tài khoản ECont thành công</p>
        </div>

        <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">NGHĨA VỤ ĐANG CHỜ NỘP</span>
            <Clock className="w-5 h-5 text-amber-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-700 mt-2">
            {formatVnd(totalPending)}
          </div>
          <p className="text-xs text-slate-500 mt-1">Chờ A/B chuyển khoản theo lệnh</p>
        </div>

        <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">TÀI KHOẢN TẠM GIỮ (SUSPENSE)</span>
            <RotateCcw className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-800 mt-2">
            0 ₫
          </div>
          <p className="text-xs text-slate-500 mt-1">Không có khoản tiền lệch hoặc đến muộn</p>
        </div>
      </div>

      {/* 3. Main Content: Orders list */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/60">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('orders')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'orders' ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Lệnh thanh toán ({allPaymentOrders.length})
            </button>
            <button
              onClick={() => setActiveTab('suspense')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'suspense' ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sổ quỹ Tạm giữ (Suspense Ledger)
            </button>
          </div>

          {activeTab === 'orders' && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {['ALL', 'OPEN', 'PAID'].map(st => (
                <button
                  key={st}
                  onClick={() => setFilterStatus(st)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                    filterStatus === st 
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' 
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {st === 'ALL' ? 'Tất cả' : st === 'OPEN' ? 'Chờ thu' : 'Đã đối soát'}
                </button>
              ))}
            </div>
          )}
        </div>

        {activeTab === 'orders' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase text-xs">
                <tr>
                  <th className="p-4">Mã Lệnh</th>
                  <th className="p-4">Giao Dịch</th>
                  <th className="p-4">Đơn Vị Nộp</th>
                  <th className="p-4">Vai Trò</th>
                  <th className="p-4">Số Tiền</th>
                  <th className="p-4">Mã Tham Chiếu NH</th>
                  <th className="p-4">Trạng Thái</th>
                  <th className="p-4 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400">
                      Không có lệnh thanh toán nào phù hợp.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map(({ txnId, party, order }) => (
                    <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-4 font-mono font-bold text-slate-900">{order.id}</td>
                      <td className="p-4 font-mono text-brand-700">
                        <button
                          onClick={() => {
                            setSelectedTxnId?.(txnId);
                            setCurrentTab?.('transactions');
                          }}
                          className="hover:underline flex items-center gap-1 font-semibold text-blue-600"
                        >
                          {txnId}
                          <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                        </button>
                      </td>
                      <td className="p-4 font-semibold text-slate-900">{order.companyName}</td>
                      <td className="p-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                          order.payerRole === 'PARTY_A' 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}>
                          {order.payerRole === 'PARTY_A' ? 'Bên A (Chủ vỏ)' : 'Bên B (Chủ hàng)'}
                        </span>
                      </td>
                      <td className="p-4 font-mono font-bold text-slate-900 text-sm">
                        {formatVnd(order.amountVnd)}
                      </td>
                      <td className="p-4 font-mono text-slate-700">
                        {order.bankReference || '—'}
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                          order.status === 'PAID'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {order.status === 'PAID' ? 'ĐÃ ĐỐI SOÁT ✓' : 'CHỜ NỘP'}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        {order.status !== 'PAID' ? (
                          <button
                            onClick={() => handleOpenSettle({ txnId, party, order })}
                            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm transition-colors"
                          >
                            Đối Soát Ngân Hàng
                          </button>
                        ) : (
                          <span className="text-xs text-slate-500">
                            {formatDateTime(order.settledAt)}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'suspense' && (
          <div className="p-8 text-center space-y-3">
            <ShieldCheck className="w-12 h-12 text-emerald-600 mx-auto" />
            <h4 className="text-sm font-bold text-slate-900">Sổ Quỹ Tạm Giữ Suspense (Sạch)</h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Không có khoản tiền nộp thừa, nộp sai cú pháp hoặc tiền đến sau khi giao dịch hết hạn.
              Mọi khoản tiền treo sẽ được hoàn trả tự động hoặc chuyển về đơn vị nộp sau khi đối chiếu.
            </p>
          </div>
        )}
      </div>

      {/* Settle Modal */}
      {settleModalOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                Xác nhận Đối soát: {settleModalOrder.order.id}
              </h3>
              <button onClick={() => setSettleModalOrder(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <FormErrorSummary errors={settleErrors} />

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div>Đơn vị: <strong>{settleModalOrder.order.companyName}</strong></div>
                <div>Giao dịch: <strong className="font-mono">{settleModalOrder.txnId}</strong></div>
                <div>Số tiền cần thu: <strong className="font-mono text-emerald-700 text-sm">{formatVnd(settleModalOrder.order.amountVnd)}</strong></div>
              </div>

              <div>
                <label className="text-slate-700 font-semibold block mb-1">Mã tham chiếu ngân hàng (FT / Ref ID) <RequiredMark /></label>
                <input
                  id="bankRefInput"
                  data-field="bankRefInput"
                  type="text"
                  value={bankRefInput}
                  onChange={e => { setSettleErrors({}); setBankRefInput(e.target.value); }}
                  aria-invalid={Boolean(settleErrors.bankRefInput)}
                  className={getFieldErrorClass(Boolean(settleErrors.bankRefInput), 'w-full p-2.5 rounded-lg border border-slate-200 font-mono outline-none focus:ring-2 focus:ring-brand-500')}
                />
                <FieldError message={settleErrors.bankRefInput} />
              </div>

              <div>
                <label className="text-slate-700 font-semibold block mb-1">Số tiền thực tế nhận được (VND) <RequiredMark /></label>
                <input
                  id="paidAmountInput"
                  data-field="paidAmountInput"
                  type="number"
                  value={paidAmountInput}
                  onChange={e => { setSettleErrors({}); setPaidAmountInput(parseInt(e.target.value, 10) || 0); }}
                  aria-invalid={Boolean(settleErrors.paidAmountInput)}
                  className={getFieldErrorClass(Boolean(settleErrors.paidAmountInput), 'w-full p-2.5 rounded-lg border border-slate-200 font-mono outline-none focus:ring-2 focus:ring-brand-500')}
                />
                <FieldError message={settleErrors.paidAmountInput} />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setSettleModalOrder(null)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Hủy
              </button>
              <button
                onClick={handleConfirmSettle}
                className="px-4 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm"
              >
                Xác nhận Đã Nhận Tiền
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
