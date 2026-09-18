// ==============================================================================
// ECont CasesPage - Trang Quản lý Sự cố & Khiếu nại
// ==============================================================================

import React, { useState } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { useAuth } from '../context/AuthContext';
import { CaseIssue } from '../types';
import { CaseStatusBadge, TransactionStatusBadge } from '../components/StatusBadge';
import { formatDateTime, formatRelativeTime } from '../lib/utils';
import {
  AlertCircle, AlertTriangle, Plus, MessageCircle, CheckCircle,
  X, ChevronDown, ChevronUp, Shield, Clock, FileText, Edit3, Trash2
} from 'lucide-react';

interface CasesPageProps {
  setCurrentTab: (tab: string) => void;
  setSelectedTxnId?: (id: string) => void;
}

const CASE_TYPE_LABELS: Record<CaseIssue['caseType'], string> = {
  CONDITION_MISMATCH: 'Sai khác tình trạng cont',
  NO_SHOW: 'No-show',
  WRONG_CONTAINER: 'Sai số container',
  DAMAGE_DISPUTE: 'Tranh chấp hư hại',
  LATE_HANDOVER: 'Bàn giao trễ hẹn',
  CARRIER_REJECTION: 'Hãng tàu từ chối',
  PAYMENT_ISSUE: 'Vấn đề thanh toán',
  DOCUMENT_FRAUD: 'Tài liệu không hợp lệ',
  RU_SCOPE_MISMATCH: 'RU không đúng phạm vi',
  OTHER: 'Khác',
};

const PRIORITY_MAP: Record<CaseIssue['priority'], { label: string; color: string }> = {
  LOW: { label: 'Thấp', color: 'text-slate-500 bg-slate-50 border-slate-200' },
  MEDIUM: { label: 'Trung bình', color: 'text-amber-600 bg-amber-50 border-amber-200' },
  HIGH: { label: 'Cao', color: 'text-orange-600 bg-orange-50 border-orange-200' },
  CRITICAL: { label: 'Khẩn cấp', color: 'text-red-700 bg-red-50 border-red-200' },
};

export const CasesPage: React.FC<CasesPageProps> = ({ setCurrentTab, setSelectedTxnId }) => {
  const { cases, addCase, updateCase, deleteCase, resolveCase, closeCase, transactions } = useDatabase();
  const { currentRole, currentCompany, currentUserEmail } = useAuth();
  const [selectedCase, setSelectedCase] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [resolveModalId, setResolveModalId] = useState<string | null>(null);
  const [resolveText, setResolveText] = useState('');
  const [faultParty, setFaultParty] = useState<'PARTY_A' | 'PARTY_B' | 'PLATFORM' | 'CARRIER' | 'NONE'>('NONE');

  // Edit form state
  const [editingCase, setEditingCase] = useState<CaseIssue | null>(null);
  const [editForm, setEditForm] = useState<{
    caseType: CaseIssue['caseType'];
    priority: CaseIssue['priority'];
    title: string;
    description: string;
    status: CaseIssue['status'];
  }>({
    caseType: 'OTHER',
    priority: 'MEDIUM',
    title: '',
    description: '',
    status: 'OPEN',
  });

  const handleOpenEdit = (c: CaseIssue) => {
    setEditingCase(c);
    setEditForm({
      caseType: c.caseType,
      priority: c.priority,
      title: c.title,
      description: c.description,
      status: c.status,
    });
  };

  const handleSaveEdit = () => {
    if (!editingCase) return;
    if (!editForm.title.trim() || !editForm.description.trim()) {
      alert('Tiêu đề và mô tả là bắt buộc.');
      return;
    }
    const result = updateCase(editingCase.id, {
      caseType: editForm.caseType,
      priority: editForm.priority,
      title: editForm.title.trim(),
      description: editForm.description.trim(),
      status: editForm.status,
    });
    if (result.success) {
      setEditingCase(null);
    } else {
      alert(result.message);
    }
  };

  const handleDeleteCase = (c: CaseIssue) => {
    if (window.confirm(`Bạn có chắc muốn xóa Case "${c.title}"?`)) {
      const result = deleteCase(c.id);
      if (!result.success) {
        alert(result.message);
      } else {
        if (selectedCase === c.id) {
          setSelectedCase(null);
        }
      }
    }
  };

  // Create form state
  const [newCase, setNewCase] = useState({
    transactionId: '',
    caseType: 'OTHER' as CaseIssue['caseType'],
    priority: 'MEDIUM' as CaseIssue['priority'],
    title: '',
    description: '',
  });

  const filtered = cases.filter(c => {
    if (filterStatus !== 'all' && c.status !== filterStatus) return false;
    // Enterprises only see their own cases
    if (currentRole === 'ENTERPRISE_A' && c.openedByCompanyId !== currentCompany.id) {
      // Also show if they are party to the transaction
      if (c.transactionId) {
        const txn = transactions.find(t => t.id === c.transactionId);
        if (txn && txn.companyAId !== currentCompany.id && txn.companyBId !== currentCompany.id) return false;
      } else {
        return false;
      }
    }
    if (currentRole === 'ENTERPRISE_B' && c.openedByCompanyId !== currentCompany.id) {
      if (c.transactionId) {
        const txn = transactions.find(t => t.id === c.transactionId);
        if (txn && txn.companyBId !== currentCompany.id && txn.companyAId !== currentCompany.id) return false;
      } else {
        return false;
      }
    }
    return true;
  });

  const handleCreateCase = () => {
    if (!newCase.title.trim() || !newCase.description.trim()) {
      alert('Tiêu đề và mô tả là bắt buộc.');
      return;
    }
    const result = addCase({
      openedByCompanyId: currentCompany.id,
      openedByCompanyName: currentCompany.shortName,
      caseType: newCase.caseType,
      priority: newCase.priority,
      title: newCase.title,
      description: newCase.description,
      transactionId: newCase.transactionId || undefined,
      status: 'OPEN',
    });
    if (result.success) {
      setShowCreateForm(false);
      setNewCase({ transactionId: '', caseType: 'OTHER', priority: 'MEDIUM', title: '', description: '' });
    } else {
      alert(result.message);
    }
  };

  const handleResolve = (caseId: string) => {
    if (!resolveText.trim()) {
      alert('Vui lòng nhập tóm tắt giải quyết.');
      return;
    }
    resolveCase(caseId, {
      summary: resolveText,
      faultParty,
      resolvedBy: currentUserEmail,
      resolvedAt: new Date().toISOString(),
    });
    setResolveModalId(null);
    setResolveText('');
  };

  const activeCaseId = selectedCase;
  const activeCase = cases.find(c => c.id === activeCaseId);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            Quản lý Sự cố & Khiếu nại
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Xem và xử lý các Case tranh chấp, sự cố trong giao dịch
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-semibold flex items-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Tạo Case mới
        </button>
      </div>

      {/* Create form */}
      {showCreateForm && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-red-800">Tạo Case Sự cố mới</h3>
            <button onClick={() => setShowCreateForm(false)} className="text-red-400 hover:text-red-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Giao dịch liên quan (tùy chọn)</label>
              <select
                value={newCase.transactionId}
                onChange={e => setNewCase(p => ({ ...p, transactionId: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-brand-400 focus:ring-2 focus:ring-brand-100 outline-none"
              >
                <option value="">— Không liên kết giao dịch —</option>
                {transactions.map(t => (
                  <option key={t.id} value={t.id}>{t.id} · {t.asset.containerNumber}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Loại sự cố</label>
              <select
                value={newCase.caseType}
                onChange={e => setNewCase(p => ({ ...p, caseType: e.target.value as CaseIssue['caseType'] }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-brand-400 focus:ring-2 focus:ring-brand-100 outline-none"
              >
                {Object.entries(CASE_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Mức độ ưu tiên</label>
              <select
                value={newCase.priority}
                onChange={e => setNewCase(p => ({ ...p, priority: e.target.value as CaseIssue['priority'] }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-brand-400 focus:ring-2 focus:ring-brand-100 outline-none"
              >
                {Object.entries(PRIORITY_MAP).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Tiêu đề *</label>
              <input
                value={newCase.title}
                onChange={e => setNewCase(p => ({ ...p, title: e.target.value }))}
                placeholder="Mô tả ngắn gọn vấn đề"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-brand-400 focus:ring-2 focus:ring-brand-100 outline-none"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-slate-600 block mb-1">Mô tả chi tiết *</label>
              <textarea
                value={newCase.description}
                onChange={e => setNewCase(p => ({ ...p, description: e.target.value }))}
                placeholder="Mô tả đầy đủ sự cố, bằng chứng, yêu cầu giải quyết..."
                rows={3}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-brand-400 focus:ring-2 focus:ring-brand-100 outline-none resize-none"
              />
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setShowCreateForm(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Hủy</button>
            <button
              onClick={handleCreateCase}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold rounded-lg"
            >
              Tạo Case
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {['all', 'OPEN', 'IN_REVIEW', 'NEEDS_INFO', 'RESOLVED', 'CLOSED'].map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              filterStatus === s ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {s === 'all' ? `Tất cả (${cases.length})` :
             s === 'OPEN' ? `Đang mở (${cases.filter(c => c.status === 'OPEN').length})` :
             s === 'IN_REVIEW' ? `Đang xem (${cases.filter(c => c.status === 'IN_REVIEW').length})` :
             s === 'RESOLVED' ? `Đã giải quyết (${cases.filter(c => c.status === 'RESOLVED').length})` :
             s === 'CLOSED' ? `Đã đóng (${cases.filter(c => c.status === 'CLOSED').length})` : s}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Cases list */}
        <div className="space-y-3">
          {filtered.length === 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
              <AlertCircle className="w-10 h-10 text-slate-200 mx-auto" />
              <p className="text-sm text-slate-400 mt-3">Không có Case nào</p>
            </div>
          )}
          {filtered.map(c => {
            const txn = c.transactionId ? transactions.find(t => t.id === c.transactionId) : undefined;
            const priority = PRIORITY_MAP[c.priority];
            const isSelected = selectedCase === c.id;

            return (
              <button
                key={c.id}
                onClick={() => setSelectedCase(isSelected ? null : c.id)}
                className={`w-full text-left bg-white rounded-xl border transition-all shadow-sm ${
                  isSelected ? 'border-brand-300 shadow-md' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="p-4 space-y-2">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${
                      c.priority === 'CRITICAL' ? 'text-red-500' :
                      c.priority === 'HIGH' ? 'text-orange-500' : 'text-amber-400'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-slate-800 truncate">{c.title}</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-md border ${priority.color}`}>
                          {priority.label}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{CASE_TYPE_LABELS[c.caseType]}</p>
                    </div>
                    <CaseStatusBadge status={c.status} size="xs" />
                  </div>

                  <p className="text-xs text-slate-600 pl-7 line-clamp-2">{c.description}</p>

                  <div className="pl-7 flex items-center gap-3 flex-wrap">
                    <span className="text-xs text-slate-500">
                      Bởi {c.openedByCompanyName}
                    </span>
                    {c.transactionId && (
                      <span className="text-xs font-mono font-semibold text-blue-600">{c.transactionId}</span>
                    )}
                    <span className="text-xs text-slate-500">{formatRelativeTime(c.createdAt)}</span>
                  </div>
                </div>

                {/* Expanded detail */}
                {isSelected && (
                  <div className="border-t border-slate-100 p-4 space-y-4 bg-slate-50 rounded-b-xl">
                    {/* Resolution */}
                    {c.resolution && (
                      <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3">
                        <p className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5 mb-1">
                          <CheckCircle className="w-3.5 h-3.5" /> Kết luận giải quyết
                        </p>
                        <p className="text-xs text-emerald-700">{c.resolution.summary}</p>
                        <p className="text-xs text-emerald-600 mt-1">
                          Lỗi thuộc: {c.resolution.faultParty} · Bởi: {c.resolution.resolvedBy} · {formatDateTime(c.resolution.resolvedAt)}
                        </p>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2">
                      {c.transactionId && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTxnId?.(c.transactionId!);
                            setCurrentTab('transactions');
                          }}
                          className="px-3 py-1.5 rounded-lg border border-brand-200 text-brand-700 text-xs font-semibold hover:bg-brand-50 flex items-center gap-1.5"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          Xem Giao dịch
                        </button>
                      )}
                      {c.status !== 'CLOSED' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEdit(c);
                          }}
                          className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-100 flex items-center gap-1.5"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                          Chỉnh sửa
                        </button>
                      )}
                      {(c.status === 'OPEN' || currentRole === 'SUPER_ADMIN') && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCase(c);
                          }}
                          className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-50 flex items-center gap-1.5"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Xóa Case
                        </button>
                      )}
                      {(currentRole === 'OPS' || currentRole === 'SUPER_ADMIN') && c.status !== 'CLOSED' && c.status !== 'RESOLVED' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setResolveModalId(c.id); }}
                          className="px-3 py-1.5 rounded-lg border border-emerald-200 text-emerald-700 text-xs font-semibold hover:bg-emerald-50 flex items-center gap-1.5"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          Kết luận giải quyết
                        </button>
                      )}
                      {(currentRole === 'OPS' || currentRole === 'SUPER_ADMIN') && c.status === 'RESOLVED' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); closeCase(c.id); }}
                          className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-100 flex items-center gap-1.5"
                        >
                          <X className="w-3.5 h-3.5" />
                          Đóng Case
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Case statistics */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Thống kê Case</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Đang mở', value: cases.filter(c => c.status === 'OPEN').length, color: 'text-red-600' },
                { label: 'Đang xem xét', value: cases.filter(c => c.status === 'IN_REVIEW').length, color: 'text-amber-600' },
                { label: 'Đã giải quyết', value: cases.filter(c => c.status === 'RESOLVED').length, color: 'text-emerald-600' },
                { label: 'Đã đóng', value: cases.filter(c => c.status === 'CLOSED').length, color: 'text-slate-400' },
              ].map(s => (
                <div key={s.label} className="bg-slate-50 rounded-lg p-3">
                  <p className={`text-2xl font-bold font-mono ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Case by type */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Theo loại sự cố</h3>
            <div className="space-y-2">
              {Object.entries(CASE_TYPE_LABELS).map(([type, label]) => {
                const count = cases.filter(c => c.caseType === type).length;
                if (count === 0) return null;
                return (
                  <div key={type} className="flex items-center justify-between">
                    <span className="text-xs text-slate-600">{label}</span>
                    <span className="text-xs font-bold text-slate-800 font-mono">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SRS rules reminder */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-start gap-2">
              <Shield className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-amber-700">Quy tắc xử lý Case (SRS)</p>
                <ul className="text-xs text-amber-700 mt-1.5 space-y-1 list-disc list-inside">
                  <li>Case DAMAGE_DISPUTE → xem xét ảnh + biên bản kiểm tra</li>
                  <li>Case PAYMENT_ISSUE → đối chiếu với ngân hàng trước khi kết luận</li>
                  <li>Nếu CRITICAL → tạm dừng (ON_HOLD) giao dịch liên quan</li>
                  <li>Bằng chứng gốc được lưu trữ, không được xóa</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Resolve modal */}
      {resolveModalId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-800">Kết luận giải quyết Case</h3>
              <button onClick={() => setResolveModalId(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Lỗi thuộc về bên nào?</label>
              <select
                value={faultParty}
                onChange={e => setFaultParty(e.target.value as typeof faultParty)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none"
              >
                <option value="NONE">Không có lỗi từ bên nào</option>
                <option value="PARTY_A">Bên A</option>
                <option value="PARTY_B">Bên B</option>
                <option value="PLATFORM">Nền tảng ECont</option>
                <option value="CARRIER">Hãng tàu</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Tóm tắt kết luận *</label>
              <textarea
                value={resolveText}
                onChange={e => setResolveText(e.target.value)}
                placeholder="Mô tả cách xử lý, kết quả điều tra, quyết định..."
                rows={4}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none resize-none focus:border-brand-400"
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setResolveModalId(null)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Hủy</button>
              <button
                onClick={() => handleResolve(resolveModalId)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg"
              >
                Xác nhận Kết luận
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingCase && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-brand-600" />
                Chỉnh sửa Case {editingCase.id}
              </h3>
              <button onClick={() => setEditingCase(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Loại sự cố</label>
                <select
                  value={editForm.caseType}
                  onChange={e => setEditForm(p => ({ ...p, caseType: e.target.value as CaseIssue['caseType'] }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-brand-400"
                >
                  {Object.entries(CASE_TYPE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Mức độ ưu tiên</label>
                  <select
                    value={editForm.priority}
                    onChange={e => setEditForm(p => ({ ...p, priority: e.target.value as CaseIssue['priority'] }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-brand-400"
                  >
                    {Object.entries(PRIORITY_MAP).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Trạng thái Case</label>
                  <select
                    value={editForm.status}
                    onChange={e => setEditForm(p => ({ ...p, status: e.target.value as CaseIssue['status'] }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-brand-400"
                  >
                    <option value="OPEN">Đang mở (OPEN)</option>
                    <option value="IN_REVIEW">Đang xem xét (IN_REVIEW)</option>
                    <option value="NEEDS_INFO">Cần bổ sung tin (NEEDS_INFO)</option>
                    <option value="RESOLVED">Đã giải quyết (RESOLVED)</option>
                    <option value="CLOSED">Đã đóng (CLOSED)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Tiêu đề *</label>
                <input
                  value={editForm.title}
                  onChange={e => setEditForm(p => ({ ...p, title: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-brand-400"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Mô tả chi tiết *</label>
                <textarea
                  value={editForm.description}
                  onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))}
                  rows={4}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none resize-none focus:border-brand-400"
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button
                onClick={() => setEditingCase(null)}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Hủy
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold rounded-lg shadow"
              >
                Lưu thay đổi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
