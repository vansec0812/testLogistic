// ==============================================================================
// ECont Operations Portal (Cổng Vận hành Ops) - Version 2.0
// Thẩm định DN, Phê duyệt RU Hãng tàu, Duyệt Offer/Request, Xử lý Tranh chấp (SRS UI07)
// ==============================================================================

import React, { useState } from 'react';
import { FieldErrors, FieldError, FormErrorSummary, RequiredMark, getFieldErrorClass, scrollToFirstFieldError } from '../components/FormValidation';
import { required, validEmail, validFutureDate, validPhone, setError } from '../lib/formValidation';
import { useDatabase } from '../context/DatabaseContext';
import { useAuth } from '../context/AuthContext';
import { 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  FileText, 
  Ship, 
  Building, 
  MessageSquare,
  Sparkles,
  PackageOpen,
  Search,
  Check,
  X,
  Eye,
  ExternalLink,
  Lock,
  ArrowRight,
  Plus,
  Edit2,
  Trash2
} from 'lucide-react';
import { formatDate, formatDateTime, formatVnd, formatRelativeTime } from '../lib/utils';
import { 
  OfferStatusBadge, 
  RequestStatusBadge, 
  CompanyStatusBadge, 
  CaseStatusBadge,
  ConditionBadge
} from '../components/StatusBadge';
import { Company, CompanyStatus, Offer } from '../types';
import { DateTimeInput } from '../components/DateInput';
import { getOfferAiConditionTitle as getSharedOfferAiConditionTitle, sortOffersForOps } from '../services/offerReview';

interface OpsPortalPageProps {
  setCurrentTab?: (tab: string) => void;
  setSelectedTxnId?: (id: string) => void;
}

function getOfferReviewErrorField(offerId: string, message = ''): string {
  const normalized = message.toLowerCase();
  if (normalized.includes('ảnh') || normalized.includes('6 ảnh') || normalized.includes('photo')) return `offerPhotos-${offerId}`;
  if (normalized.includes('edo') || normalized.includes('e-do')) return `offerEdo-${offerId}`;
  if (normalized.includes('ai')) return `offerAi-${offerId}`;
  return `offerReviewNote-${offerId}`;
}

function getOfferManualReviewReasons(offer: Offer): string[] {
  const ai = offer.aiCheck;
  if (!ai) return ['Chưa có kết quả AI xác minh eDO và đối chiếu ảnh.'];

  const reasons: string[] = [];
  if (!ai.edoChecked) reasons.push('Chưa có kết quả AI xác minh eDO.');
  if (ai.edoValid === false) reasons.push('eDO chưa được AI xác nhận hợp lệ.');
  if (ai.edoAnomaly) reasons.push(`eDO có dấu hiệu bất thường: ${ai.anomalyReason || 'cần Ops đối chiếu file gốc.'}`);
  if (!ai.photoChecked) reasons.push('Chưa có kết quả AI đối chiếu bộ ảnh container.');
  if (ai.verificationStatus === 'ERROR') reasons.push('AI trả về lỗi khi xử lý hồ sơ.');
  if (!ai.passed && !reasons.length) reasons.push('AI chưa kết luận hồ sơ đạt điều kiện tự động duyệt.');
  return reasons;
}

function getOfferAiConditionTitle(offer: Offer): string {
  const ai = offer.aiCheck;
  if (!ai) return 'Chưa nhận được kết quả AI đối chiếu ảnh container';

  const evidence = [ai.photoConditionNotes, ai.summary, ...(ai.details || [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  if (/mờ|blur|không rõ|khó đọc|unreadable/.test(evidence)) {
    return 'Ảnh container mờ hoặc chưa đủ rõ để đối chiếu';
  }
  if (/mã số|số cont|container number|container no|không khớp|không chính xác|mismatch/.test(evidence)) {
    return 'Mã số container không khớp thông tin đăng ký';
  }
  if (ai.photoCondition === 'MAJOR_DAMAGE' || /thủng|móp nặng|rỉ sét nặng|hư hỏng nặng/.test(evidence)) {
    return 'Chất lượng container có vấn đề nghiêm trọng';
  }
  if (ai.photoCondition === 'MINOR_DAMAGE' || /xước|trầy|móp nhẹ|rỉ nhẹ|hư hỏng nhẹ/.test(evidence)) {
    return 'Container có dấu hiệu xước hoặc hư hỏng nhẹ';
  }
  if (!ai.photoChecked) return 'Chưa có kết quả đối chiếu ảnh container';
  if (ai.edoValid === false || ai.edoAnomaly) return 'eDO có dấu hiệu cần Ops xác minh';
  if (ai.photoCondition === 'GOOD' && ai.photoChecked && ai.passed) {
    return 'Ảnh container khớp thông tin đăng ký, tình trạng đạt chuẩn';
  }

  const shortDescription = ai.photoConditionNotes || ai.details?.[0] || ai.summary;
  if (shortDescription) {
    return shortDescription.length > 110 ? `${shortDescription.slice(0, 107)}...` : shortDescription;
  }
  return 'AI chưa phân loại được tình trạng; Ops cần kiểm tra ảnh';
}

export const OpsPortalPage: React.FC<OpsPortalPageProps> = ({
  setCurrentTab,
  setSelectedTxnId
}) => {
  const { 
    companies, 
    assets,
    offers, 
    requests, 
    transactions, 
    cases, 
    opsApproveCarrier,
    opsRejectCarrier,
    opsReviewOffer,
    opsReviewRequest,
    resolveCase,
    toggleHold,
    addCompany,
    updateCompany,
    deleteCompany,
    opsReviewAsset
  } = useDatabase();
  const { currentRole, currentUserEmail } = useAuth();

  const [activeTab, setActiveTab] = useState<'carrier' | 'offers' | 'requests' | 'cases' | 'companies' | 'ai-inspection'>('carrier');
  const [assetReviewNotes, setAssetReviewNotes] = useState<Record<string, string>>({});

  // Carrier approval inputs
  const [carrierModalTxnId, setCarrierModalTxnId] = useState<string | null>(null);
  const [carrierRef, setCarrierRef] = useState('RU-2026-MSK-');
  const [evidenceFile, setEvidenceFile] = useState('CongVan_ChapThuan_CapLaiVo.pdf');
  const [validUntil, setValidUntil] = useState(
    new Date(Date.now() + 48 * 3600000).toISOString().slice(0, 16)
  );

  // Review notes
  const [reviewNote, setReviewNote] = useState('');

  // Case resolution
  const [caseModalId, setCaseModalId] = useState<string | null>(null);
  const [caseSummary, setCaseSummary] = useState('');
  const [faultParty, setFaultParty] = useState<'PARTY_A' | 'PARTY_B' | 'PLATFORM' | 'CARRIER' | 'NONE'>('NONE');

  // Company CRUD state
  const [showAddCompanyModal, setShowAddCompanyModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [companyForm, setCompanyForm] = useState<Partial<Company>>({
    businessType: 'FORWARDER',
    verificationStatus: 'VERIFIED'
  });
  const [companyErrors, setCompanyErrors] = useState<FieldErrors>({});
  const [carrierErrors, setCarrierErrors] = useState<FieldErrors>({});
  const [caseErrors, setCaseErrors] = useState<FieldErrors>({});
  const [assetReviewErrors, setAssetReviewErrors] = useState<Record<string, string>>({});
  const [offerReviewNotes, setOfferReviewNotes] = useState<Record<string, string>>({});
  const [offerReviewErrors, setOfferReviewErrors] = useState<Record<string, string>>({});
  const [requestReviewNotes, setRequestReviewNotes] = useState<Record<string, string>>({});
  const [requestReviewErrors, setRequestReviewErrors] = useState<Record<string, string>>({});

  // Role guard
  if (currentRole !== 'OPS') {
    return (
      <div className="text-center py-16 space-y-3 bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
        <ShieldCheck className="w-12 h-12 text-slate-300 mx-auto" />
        <h3 className="text-lg font-bold text-slate-800">Chỉ dành cho Bộ phận Vận hành ECont Ops</h3>
        <p className="text-sm text-slate-500">Doanh nghiệp đối tác không có quyền truy cập Cổng Điều phối Vận hành.</p>
      </div>
    );
  }

  // Filter queues
  const carrierPendingTxns = transactions.filter(t => t.status === 'PENDING_CARRIER');
  const pendingOffers = offers.filter(o => o.status === 'UNDER_REVIEW');
  const underReviewOffers = sortOffersForOps(
    offers.filter(o => o.status === 'UNDER_REVIEW' || o.status === 'AVAILABLE')
  );
  const underReviewRequests = requests.filter(r => r.status === 'UNDER_REVIEW');
  const openCases = cases.filter(c => c.status === 'OPEN' || c.status === 'IN_REVIEW');
  const aiReviewAssets = assets.filter(a =>
    (a.aiInspection?.requiresOpsReview && ['ANOMALY', 'ERROR'].includes(a.aiInspection.status)) ||
    (a.hasEdoDocument && a.edoVerificationStatus !== 'VERIFIED')
  );

  const validateCarrierForm = (): FieldErrors => {
    const errors: FieldErrors = {};
    setError(errors, 'carrierRef', required(carrierRef, 'Vui lòng nhập số văn bản RU của hãng tàu.'));
    setError(errors, 'evidenceFile', required(evidenceFile, 'Vui lòng nhập tên file công văn RU.'));
    setError(errors, 'validUntil', validFutureDate(validUntil, 'Thời hạn hiệu lực'));
    return errors;
  };

  const handleCarrierSubmit = (action: 'approve' | 'reject') => {
    if (!carrierModalTxnId) return;
    if (action === 'approve') {
      const errors = validateCarrierForm();
      setCarrierErrors(errors);
      if (Object.keys(errors).length > 0) {
        scrollToFirstFieldError(errors);
        return;
      }
      const res = opsApproveCarrier(carrierModalTxnId, carrierRef, evidenceFile, new Date(validUntil).toISOString());
      if (res.success) {
        alert(res.message);
        setCarrierModalTxnId(null);
        setCarrierErrors({});
      } else {
        alert(res.message);
      }
    } else {
      const reason = prompt('Nhập lý do hãng tàu từ chối:');
      if (reason) {
        opsRejectCarrier(carrierModalTxnId, reason);
        setCarrierModalTxnId(null);
      }
    }
  };

  const handleResolveCaseSubmit = () => {
    const errors: FieldErrors = {};
    setError(errors, 'caseSummary', required(caseSummary, 'Vui lòng nhập tóm tắt kết luận của Ops.'));
    setCaseErrors(errors);
    if (!caseModalId || Object.keys(errors).length > 0) {
      if (Object.keys(errors).length > 0) scrollToFirstFieldError(errors);
      return;
    }
    resolveCase(caseModalId, {
      summary: caseSummary,
      faultParty,
      resolvedBy: currentUserEmail,
      resolvedAt: new Date().toISOString()
    });
    setCaseModalId(null);
    setCaseSummary('');
    setCaseErrors({});
    alert('Đã kết luận giải quyết Case thành công.');
  };

  const validateCompanyForm = (): FieldErrors => {
    const errors: FieldErrors = {};
    setError(errors, 'companyName', required(companyForm.companyName, 'Vui lòng nhập tên đầy đủ công ty.'));
    setError(errors, 'shortName', required(companyForm.shortName, 'Vui lòng nhập tên viết tắt.'));
    setError(errors, 'taxCode', required(companyForm.taxCode, 'Vui lòng nhập mã số thuế.'));
    if (companyForm.taxCode?.trim() && !/^\d{8,14}$/.test(companyForm.taxCode.trim())) {
      errors.taxCode = 'Mã số thuế phải gồm 8–14 chữ số.';
    }
    setError(errors, 'address', required(companyForm.address, 'Vui lòng nhập địa chỉ trụ sở.'));
    setError(errors, 'representativeName', required(companyForm.representativeName, 'Vui lòng nhập người đại diện.'));
    setError(errors, 'representativePhone', required(companyForm.representativePhone, 'Vui lòng nhập số điện thoại đại diện.'));
    if (companyForm.representativePhone?.trim()) {
      setError(errors, 'representativePhone', validPhone(companyForm.representativePhone, 'Số điện thoại đại diện không hợp lệ.'));
    }
    setError(errors, 'representativeEmail', required(companyForm.representativeEmail, 'Vui lòng nhập email liên hệ.'));
    if (companyForm.representativeEmail?.trim()) {
      setError(errors, 'representativeEmail', validEmail(companyForm.representativeEmail, 'Email liên hệ không hợp lệ.'));
    }
    return errors;
  };

  const handleSaveCompany = () => {
    const errors = validateCompanyForm();
    setCompanyErrors(errors);
    if (Object.keys(errors).length > 0) {
      scrollToFirstFieldError(errors);
      return;
    }

    if (editingCompany) {
      const res = updateCompany(editingCompany.id, companyForm);
      alert(res.message);
      if (res.success) {
        setEditingCompany(null);
        setCompanyErrors({});
      }
      return;
    }

    const res = addCompany({
      companyName: companyForm.companyName!,
      shortName: companyForm.shortName!,
      taxCode: companyForm.taxCode!,
      businessType: companyForm.businessType || 'FORWARDER',
      address: companyForm.address!,
      representativeName: companyForm.representativeName!,
      representativePhone: companyForm.representativePhone!,
      representativeEmail: companyForm.representativeEmail!,
      verificationStatus: (companyForm.verificationStatus as CompanyStatus) || 'VERIFIED',
    });
    alert(res.message);
    if (res.success) {
      setShowAddCompanyModal(false);
      setCompanyForm({ businessType: 'FORWARDER', verificationStatus: 'VERIFIED' });
      setCompanyErrors({});
    }
  };

  const handleAssetReview = (assetId: string, decision: 'APPROVE' | 'REJECT') => {
    const note = (assetReviewNotes[assetId] || '').trim();
    if (!note) {
      const message = 'Vui lòng ghi kết luận kiểm tra ảnh trước khi quyết định.';
      setAssetReviewErrors(previous => ({ ...previous, [assetId]: message }));
      scrollToFirstFieldError({ [`assetReviewNote-${assetId}`]: message });
      return;
    }
    const result = opsReviewAsset(assetId, decision, note);
    alert(result.message);
    if (result.success) {
      setAssetReviewErrors(previous => ({ ...previous, [assetId]: '' }));
      setAssetReviewNotes(previous => ({ ...previous, [assetId]: '' }));
    } else {
      setAssetReviewErrors(previous => ({ ...previous, [assetId]: result.message }));
      scrollToFirstFieldError({ [`assetReviewNote-${assetId}`]: result.message });
    }
  };

  const handleOfferReview = (offerId: string, decision: 'APPROVE' | 'REQUEST_CHANGES' | 'REJECT') => {
    const field = `offerReviewNote-${offerId}`;
    const note = (offerReviewNotes[offerId] || '').trim();
    const errors: FieldErrors = {};
    setError(errors, field, required(note, 'Vui lòng nhập kết luận thẩm định Offer.'));
    if (Object.keys(errors).length > 0) {
      setOfferReviewErrors(previous => ({ ...previous, [offerId]: errors[field] }));
      scrollToFirstFieldError(errors);
      return;
    }
    const result = opsReviewOffer(offerId, decision, note);
    alert(result.message);
    if (result.success) {
      setOfferReviewErrors(previous => ({ ...previous, [offerId]: '' }));
      setOfferReviewNotes(previous => ({ ...previous, [offerId]: '' }));
    } else {
      setOfferReviewErrors(previous => ({ ...previous, [offerId]: result.message }));
      scrollToFirstFieldError({ [getOfferReviewErrorField(offerId, result.message)]: result.message });
    }
  };

  const handleRequestReview = (requestId: string, decision: 'APPROVE' | 'REJECT') => {
    const field = `requestReviewNote-${requestId}`;
    const note = (requestReviewNotes[requestId] || '').trim();
    const errors: FieldErrors = {};
    setError(errors, field, required(note, 'Vui lòng nhập kết luận xác minh Booking.'));
    if (Object.keys(errors).length > 0) {
      setRequestReviewErrors(previous => ({ ...previous, [requestId]: errors[field] }));
      scrollToFirstFieldError(errors);
      return;
    }
    const result = opsReviewRequest(requestId, decision, note);
    alert(result.message);
    if (result.success) {
      setRequestReviewErrors(previous => ({ ...previous, [requestId]: '' }));
      setRequestReviewNotes(previous => ({ ...previous, [requestId]: '' }));
    } else {
      setRequestReviewErrors(previous => ({ ...previous, [requestId]: result.message }));
      scrollToFirstFieldError({ [field]: result.message });
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Title */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-brand-600" />
            <span>CỔNG ĐIỀU PHỐI VẬN HÀNH (OPERATIONS PORTAL - OPS)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Hàng đợi thẩm định: Duyệt RU Hãng tàu, Thẩm định nguồn vỏ, Xác minh Booking và Giải quyết tranh chấp
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            <span>{carrierPendingTxns.length + pendingOffers.length + underReviewRequests.length + aiReviewAssets.length + openCases.length} tác vụ</span>
          </span>
        </div>
      </div>

      {/* 2. Top Metric Counters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <button
          onClick={() => setActiveTab('carrier')}
          className={`p-5 rounded-2xl border text-left transition-all ${
            activeTab === 'carrier'
              ? 'bg-amber-50/50 border-amber-300 shadow-sm ring-1 ring-amber-200'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">CHỜ DUYỆT RU HÃNG</span>
            <Ship className="w-5 h-5 text-amber-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-slate-900 mt-2">
            {carrierPendingTxns.length}
          </div>
          <p className="text-xs text-amber-700 font-medium mt-1">Cần nhập công văn RU</p>
        </button>

        <button
          onClick={() => setActiveTab('offers')}
          className={`p-5 rounded-2xl border text-left transition-all ${
            activeTab === 'offers'
              ? 'bg-emerald-50/50 border-emerald-300 shadow-sm ring-1 ring-emerald-200'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">OFFER CHỜ THẨM ĐỊNH</span>
            <PackageOpen className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-slate-900 mt-2">
            {pendingOffers.length}
          </div>
          <p className="text-xs text-emerald-700 font-medium mt-1">Kiểm tra ảnh & vị trí vỏ</p>
        </button>

        <button
          onClick={() => setActiveTab('requests')}
          className={`p-5 rounded-2xl border text-left transition-all ${
            activeTab === 'requests'
              ? 'bg-cyan-50/50 border-cyan-300 shadow-sm ring-1 ring-cyan-200'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">BOOKING CHỜ XÁC MINH</span>
            <Search className="w-5 h-5 text-cyan-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-slate-900 mt-2">
            {underReviewRequests.length}
          </div>
          <p className="text-xs text-cyan-700 font-medium mt-1">Kiểm tra booking của đơn vị cần vỏ</p>
        </button>

        <button
          onClick={() => setActiveTab('ai-inspection')}
          className={`p-5 rounded-2xl border text-left transition-all ${
            activeTab === 'ai-inspection'
              ? 'bg-violet-50/50 border-violet-300 shadow-sm ring-1 ring-violet-200'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">AI CHỜ OPS</span>
            <Sparkles className="w-5 h-5 text-violet-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-slate-900 mt-2">{aiReviewAssets.length}</div>
          <p className="text-xs text-violet-700 font-medium mt-1">Kiểm tra ảnh bất thường</p>
        </button>

        <button
          onClick={() => setActiveTab('cases')}
          className={`p-5 rounded-2xl border text-left transition-all ${
            activeTab === 'cases'
              ? 'bg-rose-50/50 border-rose-300 shadow-sm ring-1 ring-rose-200'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">KHIẾU NẠI TRANH CHẤP</span>
            <AlertTriangle className="w-5 h-5 text-rose-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-slate-900 mt-2">
            {openCases.length}
          </div>
          <p className="text-xs text-rose-700 font-medium mt-1">Cần điều tra & kết luận</p>
        </button>
      </div>

      {/* 3. Queue Content */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Sub-tabs header */}
        <div className="flex items-center gap-2 p-3 border-b border-slate-100 bg-slate-50/70 overflow-x-auto">
          <button
            onClick={() => setActiveTab('carrier')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
              activeTab === 'carrier'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Duyệt RU Hãng tàu ({carrierPendingTxns.length})
          </button>
          <button
            onClick={() => setActiveTab('offers')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
              activeTab === 'offers'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Thẩm định Nguồn vỏ ({pendingOffers.length})
          </button>
          <button
            onClick={() => setActiveTab('requests')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
              activeTab === 'requests'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Xác minh Booking ({underReviewRequests.length})
          </button>
          <button
            onClick={() => setActiveTab('ai-inspection')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
              activeTab === 'ai-inspection'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            AI kiểm tra ảnh ({aiReviewAssets.length})
          </button>
          <button
            onClick={() => setActiveTab('cases')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
              activeTab === 'cases'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Xử lý Sự cố & Case ({openCases.length})
          </button>
          <button
            onClick={() => setActiveTab('companies')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
              activeTab === 'companies'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Doanh nghiệp ({companies.length})
          </button>
        </div>

        {/* Tab 1: Carrier Approvals */}
        {activeTab === 'carrier' && (
          <div className="p-5 space-y-4">
            {carrierPendingTxns.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                Không có giao dịch nào đang chờ phê duyệt RU từ hãng tàu.
              </div>
            ) : (
              <div className="space-y-4">
                {carrierPendingTxns.map((txn) => (
                  <div
                    key={txn.id}
                    className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors flex flex-wrap items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-slate-900 text-sm">{txn.id}</span>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          PENDING_CARRIER
                        </span>
                        <span className="font-mono text-slate-700 font-semibold">{txn.asset.containerNumber}</span>
                        <span className="text-slate-500">· Hãng {txn.asset.carrierCode} ({txn.asset.containerType})</span>
                      </div>
                      <div className="text-slate-600">
                        Nhà cung cấp: <strong className="text-slate-800">{companies.find(company => company.id === txn.companyAId)?.companyName || txn.companyAName}</strong> → Đơn vị cần vỏ: <strong className="text-slate-800">{companies.find(company => company.id === txn.companyBId)?.companyName || txn.companyBName}</strong>
                      </div>
                      <div className="text-slate-500 text-xs mt-0.5">
                        Hạn xử lý (SLA 4 giờ): Còn {formatRelativeTime(txn.dueAt, true)}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setSelectedTxnId?.(txn.id);
                          setCurrentTab?.('transactions');
                        }}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold"
                      >
                        Chi tiết
                      </button>
                      <button
                        onClick={() => {
                          setCarrierModalTxnId(txn.id);
                          setCarrierErrors({});
                          setCarrierRef(`RU-2026-${txn.asset.carrierCode}-${txn.id.slice(-4)}`);
                        }}
                        className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-sm"
                      >
                        Nhập Công Văn RU
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Offer Reviews */}
        {activeTab === 'offers' && (
          <div className="p-5 space-y-4">
            {underReviewOffers.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                Không có Offer nào đang chờ thẩm định.
              </div>
            ) : (
              <div className="space-y-4">
                {underReviewOffers.map((o) => (
                  <div
                    key={o.id}
                    className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900 text-sm">{o.id}</span>
                        <OfferStatusBadge status={o.status} size="xs" />
                        <span className="font-mono font-bold text-slate-800 text-base">{o.asset.containerNumber}</span>
                        <span className="text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded font-bold">
                          {o.asset.carrierCode} · {o.asset.containerType}
                        </span>
                        <ConditionBadge condition={o.asset.declaredCondition} size="xs" />
                      </div>
                      <span className="text-xs font-semibold text-slate-600">Nhà cung cấp: {companies.find(company => company.id === o.companyId)?.companyName || o.companyName}</span>
                    </div>

                    {/* Cảnh báo AI nếu phát hiện bất thường */}
                    {o.requiresOpsManualReview && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center gap-2 font-medium">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>
                          <span className="block mb-1 font-semibold">Lý do cần Ops xử lý:</span>
                          <ul className="list-disc pl-4 space-y-0.5 font-normal">
                            {getOfferManualReviewReasons(o).map((reason, index) => (
                              <li key={`${o.id}-review-reason-${index}`}>{reason}</li>
                            ))}
                          </ul>
                          <strong>⚠️ CẢNH BÁO AI:</strong> Phát hiện dấu hiệu bất thường trên vỏ container! Ops cần kiểm tra kỹ ảnh chụp thủ công trước khi duyệt.
                        </span>
                      </div>
                    )}

                    {o.aiCheck && (o.aiCheck.edoValid === false || o.aiCheck.edoAnomaly || o.aiCheck.photoConditionNotes || o.aiCheck.details?.length) && (
                      <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl text-xs text-orange-900 space-y-1">
                        <strong className="block">Kết quả AI cần Ops đối chiếu:</strong>
                        {o.aiCheck.edoValid === false && <p>• eDO chưa được AI xác minh hợp pháp tự động.</p>}
                        {o.aiCheck.edoAnomaly && <p>• eDO có dấu hiệu bất thường: {o.aiCheck.anomalyReason || 'xem chi tiết chứng từ gốc.'}</p>}
                        {o.aiCheck.photoConditionNotes && <p>• Tình trạng thực tế qua ảnh: {o.aiCheck.photoConditionNotes}</p>}
                        {o.aiCheck.details?.length ? <ul className="list-disc pl-4 space-y-0.5">{o.aiCheck.details.map((detail, index) => <li key={`${o.id}-ai-detail-${index}`}>{detail}</li>)}</ul> : null}
                      </div>
                    )}

                    {(!o.aiCheck?.edoChecked || !o.aiCheck?.photoChecked || o.aiCheck?.verificationStatus === 'ERROR') && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1">
                        <strong className="block">AI chưa có đủ kết quả</strong>
                        <p>Ops có thể kiểm tra eDO và bộ ảnh thủ công, sau đó nhập kết luận để duyệt Offer.</p>
                      </div>
                    )}

                    {/* Thông tin e-DO & AI Check */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                      <div
                        data-field={`offerEdo-${o.id}`}
                        className={getFieldErrorClass(getOfferReviewErrorField(o.id, offerReviewErrors[o.id]) === `offerEdo-${o.id}`, '')}
                      >
                        <span className="text-slate-500 block font-medium">Chứng từ e-DO đính kèm</span>
                        <strong className="text-blue-800 font-mono text-xs mt-0.5 block">
                          📄 {o.edoFileName || 'Chưa có tên file eDO'}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block font-medium">Vị trí lấy vỏ</span>
                        <strong className="text-slate-800 text-xs mt-0.5 block">📍 {o.pickupLocationName}</strong>
                      </div>
                      <div
                        data-field={`offerAi-${o.id}`}
                        className={getFieldErrorClass(getOfferReviewErrorField(o.id, offerReviewErrors[o.id]) === `offerAi-${o.id}`, '')}
                      >
                        <span className="text-slate-500 block font-medium">Kết quả AI</span>
                        <strong className={`${o.aiCheck?.edoChecked && o.aiCheck?.photoChecked && o.aiCheck?.verificationStatus === 'VERIFIED' ? 'text-emerald-700' : 'text-amber-700'} text-xs mt-0.5 block`}>
                          {o.aiCheck?.edoChecked && o.aiCheck?.photoChecked && o.aiCheck?.verificationStatus === 'VERIFIED' && o.aiCheck?.summary
                            ? `✨ ${o.aiCheck.summary}${o.aiCheck.score !== undefined ? ` (${o.aiCheck.score}/100)` : ''}`
                            : o.aiCheck?.summary
                              ? `⚠️ ${o.aiCheck.summary} — Ops quyết định thủ công`
                              : 'Chưa có kết quả AI — Ops kiểm tra thủ công'}
                        </strong>
                      </div>
                    </div>

                    {/* Mô tả chi tiết nếu có */}
                    {o.conditionNotes && (
                      <div className="text-xs text-slate-600 bg-slate-50/60 p-2.5 rounded-xl border border-slate-100">
                        <span className="font-semibold text-slate-800">Mô tả chi tiết tình trạng vỏ:</span> {o.conditionNotes}
                      </div>
                    )}

                    <div className="p-3 rounded-xl border border-violet-200 bg-violet-50/60 text-xs text-violet-950 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <strong>Kết quả tình trạng thực tế do AI báo về:</strong>
                        {o.aiCheck?.photoCondition && <ConditionBadge condition={o.aiCheck.photoCondition} size="xs" />}
                      </div>
                      <p className="font-semibold leading-relaxed">{getSharedOfferAiConditionTitle(o)}</p>
                      {o.aiCheck?.photoConditionNotes && <p className="leading-relaxed">{o.aiCheck.photoConditionNotes}</p>}
                    </div>

                    {/* Bộ ảnh Container phục vụ Ops kiểm tra thủ công */}
                    <div
                      data-field={`offerPhotos-${o.id}`}
                      className={getFieldErrorClass(getOfferReviewErrorField(o.id, offerReviewErrors[o.id]) === `offerPhotos-${o.id}`, '')}
                    >
                      <span className="text-xs font-bold text-slate-700 block mb-2">
                        Ảnh chụp container ({o.photoUrls.length}/6 tối thiểu - Kiểm tra thủ công):
                      </span>
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                        {o.photoUrls.map((url, idx) => (
                          <div key={idx} className="h-20 rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
                            <img src={url} alt={`Ảnh ${idx + 1}`} className="w-full h-full object-cover" />
                          </div>
                        ))}
                        {o.photoUrls.length === 0 && (
                          <div className="col-span-full py-4 text-center text-slate-400 text-xs">
                            Chưa có ảnh container
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Kết luận bắt buộc trước khi Ops quyết định */}
                    {o.status === 'UNDER_REVIEW' && (
                      <>
                    <div className="pt-3 border-t border-slate-200 space-y-2">
                      <label htmlFor={`offerReviewNote-${o.id}`} className="text-xs font-bold text-slate-800 block">
                        Kết luận thẩm định Offer <RequiredMark />
                      </label>
                      <textarea
                        id={`offerReviewNote-${o.id}`}
                        data-field={`offerReviewNote-${o.id}`}
                        rows={2}
                        value={offerReviewNotes[o.id] || ''}
                        onChange={event => {
                          setOfferReviewNotes(previous => ({ ...previous, [o.id]: event.target.value }));
                          setOfferReviewErrors(previous => ({ ...previous, [o.id]: '' }));
                        }}
                        placeholder="Nhập căn cứ kiểm tra eDO, kết quả đối chiếu ảnh và kết luận Ops; có thể ghi rõ đã kiểm tra thủ công khi AI chưa có kết quả..."
                        aria-invalid={Boolean(offerReviewErrors[o.id])}
                        className={getFieldErrorClass(Boolean(offerReviewErrors[o.id]), 'w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-emerald-500 bg-white')}
                      />
                      <FieldError message={offerReviewErrors[o.id]} />
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleOfferReview(o.id, 'REJECT')}
                            className="px-3.5 py-2 rounded-xl border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 text-xs font-semibold"
                          >
                            Từ chối
                          </button>
                          <button
                            onClick={() => handleOfferReview(o.id, 'REQUEST_CHANGES')}
                            className="px-3.5 py-2 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 text-xs font-semibold"
                          >
                            Yêu cầu bổ sung
                          </button>
                          <button
                            onClick={() => handleOfferReview(o.id, 'APPROVE')}
                            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm"
                          >
                            Phê duyệt Offer (AVAILABLE)
                          </button>
                        </div>
                      </div>
                    </div>
                      </>
                    )}
                    {o.status === 'AVAILABLE' && (
                      <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50 text-xs text-emerald-800">
                        Offer đã được Ops duyệt và đang sẵn sàng để ghép lệnh. Thông tin này chỉ hiển thị trong hàng đợi để Ops tra cứu.
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Request Reviews */}
        {activeTab === 'requests' && (
          <div className="p-5 space-y-4">
            {underReviewRequests.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                Không có Booking nào đang chờ xác minh.
              </div>
            ) : (
              <div className="space-y-4">
                {underReviewRequests.map((r) => (
                  <div
                    key={r.id}
                    className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900">{r.id}</span>
                        <RequestStatusBadge status={r.status} size="xs" />
                        <span className="font-mono text-cyan-700 font-semibold">Booking: {r.bookingNumber}</span>
                        <span className="text-slate-500 text-xs">· Hãng {r.carrierCode} ({r.containerType})</span>
                      </div>
                      <span className="text-xs text-slate-500">{companies.find(company => company.id === r.companyId)?.companyName || r.companyName}</span>
                    </div>

                    <div className="text-xs text-slate-600 grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>Điểm giao hàng: <strong>{r.deliveryLocationName}</strong></div>
                      <div>Hạn Cut-off: <strong>{formatDate(r.cutOffTime)}</strong></div>
                      <div>Cước lấy baseline của đơn vị cần vỏ: <strong>{formatVnd(r.baselinePickupCostVnd)}</strong></div>
                    </div>

                    <div className={`rounded-xl border px-3 py-2 text-xs ${r.bookingAiCheck?.status === 'VALID' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
                      <strong>File Booking:</strong> {r.bookingFileName || 'Chưa có file'}
                      <span className="ml-2">· AI: {r.bookingAiCheck?.status === 'VALID' ? 'hợp lệ' : r.bookingAiCheck?.status === 'INVALID' || r.bookingAiCheck?.status === 'ANOMALY' ? 'có cảnh báo' : 'chờ Ops kiểm tra thủ công'}</span>
                      {r.bookingAiCheck?.summary && <p className="mt-1">{r.bookingAiCheck.summary}</p>}
                    </div>

                    <div className="pt-2 border-t border-slate-200 space-y-2">
                      <label htmlFor={`requestReviewNote-${r.id}`} className="text-xs font-bold text-slate-800 block">
                        Kết luận xác minh Booking <RequiredMark />
                      </label>
                      <textarea
                        id={`requestReviewNote-${r.id}`}
                        data-field={`requestReviewNote-${r.id}`}
                        rows={2}
                        value={requestReviewNotes[r.id] || ''}
                        onChange={event => {
                          setRequestReviewNotes(previous => ({ ...previous, [r.id]: event.target.value }));
                          setRequestReviewErrors(previous => ({ ...previous, [r.id]: '' }));
                        }}
                        placeholder="Nhập kết quả đối chiếu Booking với hãng tàu..."
                        aria-invalid={Boolean(requestReviewErrors[r.id])}
                        className={getFieldErrorClass(Boolean(requestReviewErrors[r.id]), 'w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-emerald-500 bg-white')}
                      />
                      <FieldError message={requestReviewErrors[r.id]} />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleRequestReview(r.id, 'REJECT')}
                        className="px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 text-xs font-semibold"
                      >
                        Từ chối
                      </button>
                      <button
                        onClick={() => handleRequestReview(r.id, 'APPROVE')}
                        className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm"
                      >
                        Xác nhận Booking (OPEN)
                      </button>
                    </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab: AI image review queue */}
        {activeTab === 'ai-inspection' && (
          <div className="p-5 space-y-4">
            {aiReviewAssets.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">Không có container nào đang chờ Ops kiểm tra ảnh.</div>
            ) : (
              <div className="space-y-4">
                {aiReviewAssets.map(asset => (
                  <div key={asset.id} className="p-5 rounded-2xl border border-violet-200 bg-violet-50/30 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900">{asset.containerNumber}</span>
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">AI cần Ops</span>
                        <span className="text-xs text-slate-500">{asset.carrierCode} · {asset.containerType}</span>
                      </div>
                      <span className="text-xs text-slate-500">Chủ quản lý: {asset.currentCustodianName}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-slate-700">
                      <div>Bộ ảnh: <strong>{asset.photos.length}/6 tối thiểu</strong></div>
                      <div>Điểm AI: <strong>{asset.aiInspection?.score == null ? 'Không có' : `${asset.aiInspection.score}/100`}</strong></div>
                      <div>Thời điểm: <strong>{asset.aiInspection?.inspectedAt ? formatDateTime(asset.aiInspection.inspectedAt) : '—'}</strong></div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-700">
                      <strong>Tình trạng thực tế AI phân loại:</strong>
                      {asset.aiInspection?.condition
                        ? <ConditionBadge condition={asset.aiInspection.condition} size="xs" />
                        : <span className="text-amber-700">Chưa có phân loại</span>}
                    </div>
                    <div className="rounded-xl border border-violet-200 bg-white p-3">
                      <span className="text-xs font-bold text-slate-700 block mb-2">Toàn bộ ảnh container để Ops đối chiếu:</span>
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                        {asset.photos.map((url, index) => (
                          <div key={`${asset.id}-photo-${index}`} className="h-20 rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
                            <img src={url} alt={`Ảnh container ${index + 1}`} className="w-full h-full object-cover" />
                          </div>
                        ))}
                        {asset.photos.length === 0 && <div className="col-span-full text-xs text-slate-400">Chưa có ảnh container.</div>}
                      </div>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-slate-200 text-xs text-slate-700">
                      <strong>Nhận định AI:</strong> {asset.aiInspection?.summary}
                      {asset.aiInspection?.details?.length ? <ul className="list-disc pl-5 mt-1">{asset.aiInspection.details.map((detail, index) => <li key={index}>{detail}</li>)}</ul> : null}
                    </div>
                    <label htmlFor={`assetReviewNote-${asset.id}`} className="block text-xs font-semibold text-slate-700">Kết luận kiểm tra của Ops <RequiredMark /></label>
                    <textarea
                      id={`assetReviewNote-${asset.id}`}
                      data-field={`assetReviewNote-${asset.id}`}
                      value={assetReviewNotes[asset.id] || ''}
                      onChange={e => { setAssetReviewNotes(prev => ({ ...prev, [asset.id]: e.target.value })); setAssetReviewErrors(prev => ({ ...prev, [asset.id]: '' })); }}
                      placeholder="Ops ghi kết luận: đã xem đủ ảnh, tình trạng thực tế, yêu cầu bổ sung nếu có..."
                      rows={2}
                      aria-invalid={Boolean(assetReviewErrors[asset.id])}
                      className={getFieldErrorClass(Boolean(assetReviewErrors[asset.id]), 'w-full px-3 py-2 rounded-xl border border-slate-200 text-xs outline-none focus:ring-2 focus:ring-violet-500')}
                    />
                    <FieldError message={assetReviewErrors[asset.id]} />
                    <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                      <button
                        onClick={() => handleAssetReview(asset.id, 'REJECT')}
                        className="px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 text-xs font-semibold"
                      >
                        Từ chối / kiểm tra lại
                      </button>
                      <button
                        onClick={() => handleAssetReview(asset.id, 'APPROVE')}
                        className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm"
                      >
                        Ops xác nhận
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Dispute Cases */}
        {activeTab === 'cases' && (
          <div className="p-5 space-y-4">
            {cases.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                Không có sự cố nào được ghi nhận.
              </div>
            ) : (
              <div className="space-y-4">
                {cases.map((c) => (
                  <div
                    key={c.id}
                    className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900">{c.id}</span>
                        <CaseStatusBadge status={c.status} size="xs" />
                        <span className="font-semibold text-slate-800 text-xs">{c.title}</span>
                      </div>
                      <span className="text-xs text-slate-500">Mở bởi: {c.openedByCompanyName} ({formatRelativeTime(c.createdAt)})</span>
                    </div>

                    <p className="text-xs text-slate-600 bg-white p-3 rounded-xl border border-slate-200">
                      {c.description}
                    </p>

                    {c.resolution && (
                      <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
                        <strong>Kết luận của Ops:</strong> {c.resolution.summary} (Lỗi thuộc: {c.resolution.faultParty})
                      </div>
                    )}

                    <div className="flex justify-between items-center pt-2 border-t border-slate-200 text-xs">
                      <span className="text-slate-500">
                        {c.transactionId && `Giao dịch liên quan: ${c.transactionId}`}
                      </span>
                      {c.status !== 'RESOLVED' && c.status !== 'CLOSED' && (
                        <button
                          onClick={() => {
                            setCaseModalId(c.id);
                            setCaseSummary('');
                            setCaseErrors({});
                          }}
                          className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm"
                        >
                          Kết luận giải quyết Case
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 5: Companies */}
        {activeTab === 'companies' && (
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-semibold">Danh sách {companies.length} doanh nghiệp thành viên</span>
              <button
                onClick={() => {
                  setCompanyForm({ businessType: 'FORWARDER', verificationStatus: 'VERIFIED' });
                  setCompanyErrors({});
                  setEditingCompany(null);
                  setShowAddCompanyModal(true);
                }}
                className="px-3.5 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm Doanh Nghiệp Mới</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {companies.map((co) => (
                <div
                  key={co.id}
                  className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3 text-xs text-slate-700 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-900 text-sm">{co.shortName}</span>
                        <span className="text-slate-500 block text-xs">{co.companyName}</span>
                      </div>
                      <CompanyStatusBadge status={co.verificationStatus} size="xs" />
                    </div>
                    <div>Mã số thuế: <strong className="font-mono text-slate-800">{co.taxCode}</strong> · Loại hình: <strong>{co.businessType}</strong></div>
                    <div>Địa chỉ: {co.address}</div>
                    <div>Đại diện: {co.representativeName} ({co.representativeEmail} · {co.representativePhone})</div>
                  </div>

                  {/* Actions: Edit, Status, Delete */}
                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-2 flex-wrap">
                    {/* Status switcher for Ops */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-slate-500 font-medium">Trạng thái:</span>
                      <select
                        value={co.verificationStatus}
                        onChange={e => {
                          updateCompany(co.id, { 
                            verificationStatus: e.target.value as CompanyStatus,
                            verifiedAt: e.target.value === 'VERIFIED' ? new Date().toISOString() : undefined
                          });
                        }}
                        className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-semibold outline-none"
                      >
                        <option value="VERIFIED">VERIFIED</option>
                        <option value="PENDING_VERIFICATION">PENDING</option>
                        <option value="NEEDS_INFO">NEEDS_INFO</option>
                        <option value="SUSPENDED">SUSPENDED</option>
                        <option value="REJECTED">REJECTED</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditingCompany(co);
                          setCompanyForm(co);
                          setCompanyErrors({});
                        }}
                        className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600"
                        title="Chỉnh sửa doanh nghiệp"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Xóa doanh nghiệp "${co.shortName}"?`)) {
                            const res = deleteCompany(co.id);
                            alert(res.message);
                          }
                        }}
                        className="p-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-600"
                        title="Xóa doanh nghiệp"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal Add / Edit Company */}
      {(showAddCompanyModal || editingCompany) && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {editingCompany ? `Sửa Doanh Nghiệp: ${editingCompany.shortName}` : 'Thêm Doanh Nghiệp Mới'}
              </h3>
              <button 
                onClick={() => { setShowAddCompanyModal(false); setEditingCompany(null); }} 
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <FormErrorSummary errors={companyErrors} />
              <div>
                <label htmlFor="companyName" className="text-slate-700 font-semibold block mb-1">Tên đầy đủ công ty <RequiredMark /></label>
                <input
                  id="companyName"
                  data-field="companyName"
                  type="text"
                  value={companyForm.companyName || ''}
                  onChange={e => { setCompanyForm(p => ({ ...p, companyName: e.target.value })); setCompanyErrors(p => ({ ...p, companyName: '' })); }}
                  placeholder="Công ty Cổ phần Vận tải Toàn Cầu..."
                  className={getFieldErrorClass(Boolean(companyErrors.companyName), 'w-full p-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-500')}
                  aria-invalid={Boolean(companyErrors.companyName)}
                />
                <FieldError message={companyErrors.companyName} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="shortName" className="text-slate-700 font-semibold block mb-1">Tên viết tắt <RequiredMark /></label>
                  <input
                    id="shortName"
                    data-field="shortName"
                    type="text"
                    value={companyForm.shortName || ''}
                    onChange={e => { setCompanyForm(p => ({ ...p, shortName: e.target.value })); setCompanyErrors(p => ({ ...p, shortName: '' })); }}
                    placeholder="Logistics Toàn Cầu"
                    className={getFieldErrorClass(Boolean(companyErrors.shortName), 'w-full p-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-500')}
                    aria-invalid={Boolean(companyErrors.shortName)}
                  />
                  <FieldError message={companyErrors.shortName} />
                </div>
                <div>
                  <label htmlFor="taxCode" className="text-slate-700 font-semibold block mb-1">Mã số thuế <RequiredMark /></label>
                  <input
                    id="taxCode"
                    data-field="taxCode"
                    type="text"
                    value={companyForm.taxCode || ''}
                    onChange={e => { setCompanyForm(p => ({ ...p, taxCode: e.target.value })); setCompanyErrors(p => ({ ...p, taxCode: '' })); }}
                    placeholder="0312345678"
                    className={getFieldErrorClass(Boolean(companyErrors.taxCode), 'w-full p-2.5 rounded-xl border border-slate-200 font-mono outline-none focus:ring-2 focus:ring-brand-500')}
                    aria-invalid={Boolean(companyErrors.taxCode)}
                  />
                  <FieldError message={companyErrors.taxCode} />
                </div>
              </div>

              <div>
                <label htmlFor="companyAddress" className="text-slate-700 font-semibold block mb-1">Địa chỉ trụ sở <RequiredMark /></label>
                <input
                  id="companyAddress"
                  data-field="address"
                  type="text"
                  value={companyForm.address || ''}
                  onChange={e => { setCompanyForm(p => ({ ...p, address: e.target.value })); setCompanyErrors(p => ({ ...p, address: '' })); }}
                  placeholder="Số 10 Mai Chí Thọ, TP. Thủ Đức..."
                  className={getFieldErrorClass(Boolean(companyErrors.address), 'w-full p-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-500')}
                  aria-invalid={Boolean(companyErrors.address)}
                />
                <FieldError message={companyErrors.address} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="representativeName" className="text-slate-700 font-semibold block mb-1">Người đại diện <RequiredMark /></label>
                  <input
                    id="representativeName"
                    data-field="representativeName"
                    type="text"
                    value={companyForm.representativeName || ''}
                    onChange={e => { setCompanyForm(p => ({ ...p, representativeName: e.target.value })); setCompanyErrors(p => ({ ...p, representativeName: '' })); }}
                    className={getFieldErrorClass(Boolean(companyErrors.representativeName), 'w-full p-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-500')}
                    aria-invalid={Boolean(companyErrors.representativeName)}
                  />
                  <FieldError message={companyErrors.representativeName} />
                </div>
                <div>
                  <label htmlFor="representativePhone" className="text-slate-700 font-semibold block mb-1">Số điện thoại <RequiredMark /></label>
                  <input
                    id="representativePhone"
                    data-field="representativePhone"
                    type="text"
                    value={companyForm.representativePhone || ''}
                    onChange={e => { setCompanyForm(p => ({ ...p, representativePhone: e.target.value })); setCompanyErrors(p => ({ ...p, representativePhone: '' })); }}
                    className={getFieldErrorClass(Boolean(companyErrors.representativePhone), 'w-full p-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-500')}
                    aria-invalid={Boolean(companyErrors.representativePhone)}
                  />
                  <FieldError message={companyErrors.representativePhone} />
                </div>
              </div>

              <div>
                <label htmlFor="representativeEmail" className="text-slate-700 font-semibold block mb-1">Email liên hệ <RequiredMark /></label>
                <input
                  id="representativeEmail"
                  data-field="representativeEmail"
                  type="email"
                  value={companyForm.representativeEmail || ''}
                  onChange={e => { setCompanyForm(p => ({ ...p, representativeEmail: e.target.value })); setCompanyErrors(p => ({ ...p, representativeEmail: '' })); }}
                  className={getFieldErrorClass(Boolean(companyErrors.representativeEmail), 'w-full p-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-500')}
                  aria-invalid={Boolean(companyErrors.representativeEmail)}
                />
                <FieldError message={companyErrors.representativeEmail} />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => { setShowAddCompanyModal(false); setEditingCompany(null); setCompanyErrors({}); }}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Hủy
              </button>
              <button
                onClick={handleSaveCompany}
                className="px-4 py-2 text-xs font-bold bg-brand-600 hover:bg-brand-500 text-white rounded-xl shadow-sm"
              >
                {editingCompany ? 'Lưu Thay Đổi' : 'Tạo Doanh Nghiệp'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Carrier Approval */}
      {carrierModalTxnId && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Tiếp nhận RU Hãng tàu: {carrierModalTxnId}</h3>
              <button onClick={() => setCarrierModalTxnId(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <FormErrorSummary errors={carrierErrors} />
              <div>
                <label htmlFor="carrierRef" className="text-slate-700 font-semibold block mb-1">Số văn bản RU của Hãng tàu <RequiredMark /></label>
                <input
                  id="carrierRef"
                  data-field="carrierRef"
                  type="text"
                  value={carrierRef}
                  onChange={e => { setCarrierRef(e.target.value); setCarrierErrors(p => ({ ...p, carrierRef: '' })); }}
                  className={getFieldErrorClass(Boolean(carrierErrors.carrierRef), 'w-full p-2.5 rounded-lg border border-slate-200 font-mono uppercase outline-none focus:ring-2 focus:ring-brand-500')}
                  aria-invalid={Boolean(carrierErrors.carrierRef)}
                />
                <FieldError message={carrierErrors.carrierRef} />
              </div>
              <div>
                <label htmlFor="evidenceFile" className="text-slate-700 font-semibold block mb-1">Tên file công văn đính kèm <RequiredMark /></label>
                <input
                  id="evidenceFile"
                  data-field="evidenceFile"
                  type="text"
                  value={evidenceFile}
                  onChange={e => { setEvidenceFile(e.target.value); setCarrierErrors(p => ({ ...p, evidenceFile: '' })); }}
                  className={getFieldErrorClass(Boolean(carrierErrors.evidenceFile), 'w-full p-2.5 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-brand-500')}
                  aria-invalid={Boolean(carrierErrors.evidenceFile)}
                />
                <FieldError message={carrierErrors.evidenceFile} />
              </div>
              <div>
                <label htmlFor="validUntil" className="text-slate-700 font-semibold block mb-1">Thời hạn hiệu lực <RequiredMark /></label>
                <DateTimeInput
                  id="validUntil"
                  data-field="validUntil"
                  value={validUntil}
                  onChange={v => { setValidUntil(v); setCarrierErrors(p => ({ ...p, validUntil: '' })); }}
                  className={getFieldErrorClass(Boolean(carrierErrors.validUntil), 'w-full p-2.5 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-brand-500')}
                  aria-invalid={Boolean(carrierErrors.validUntil)}
                />
                <FieldError message={carrierErrors.validUntil} />
              </div>
            </div>
            <div className="flex justify-between gap-2 pt-2">
              <button
                onClick={() => handleCarrierSubmit('reject')}
                className="px-4 py-2 rounded-lg text-xs font-semibold border border-red-200 text-red-700 hover:bg-red-50"
              >
                Hãng từ chối RU
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => setCarrierModalTxnId(null)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Hủy
                </button>
                <button
                  onClick={() => handleCarrierSubmit('approve')}
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white"
                >
                  Xác nhận RU Hợp lệ
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Resolve Case */}
      {caseModalId && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Kết luận xử lý Case: {caseModalId}</h3>
              <button onClick={() => setCaseModalId(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <FormErrorSummary errors={caseErrors} />
              <div>
                <label htmlFor="faultParty" className="text-slate-700 font-semibold block mb-1">Xác định lỗi thuộc bên <RequiredMark /></label>
                <select
                  id="faultParty"
                  data-field="faultParty"
                  value={faultParty}
                  onChange={e => setFaultParty(e.target.value as typeof faultParty)}
                  className="w-full p-2.5 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="NONE">Không có lỗi / Hai bên hòa giải</option>
                  <option value="PARTY_A">Nhà cung cấp Container</option>
                  <option value="PARTY_B">Đơn vị Cần vỏ Container</option>
                  <option value="CARRIER">Hãng tàu</option>
                  <option value="PLATFORM">Hệ thống ECont</option>
                </select>
              </div>
              <div>
                <label htmlFor="caseSummary" className="text-slate-700 font-semibold block mb-1">Tóm tắt kết luận của Ops <RequiredMark /></label>
                <textarea
                  id="caseSummary"
                  data-field="caseSummary"
                  value={caseSummary}
                  onChange={e => { setCaseSummary(e.target.value); setCaseErrors(p => ({ ...p, caseSummary: '' })); }}
                  placeholder="Mô tả phương án xử lý, bồi hoàn hoặc kết thúc tranh chấp..."
                  className={getFieldErrorClass(Boolean(caseErrors.caseSummary), 'w-full p-3 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-brand-500')}
                  aria-invalid={Boolean(caseErrors.caseSummary)}
                  rows={3}
                />
                <FieldError message={caseErrors.caseSummary} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setCaseModalId(null)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Hủy
              </button>
              <button
                onClick={handleResolveCaseSubmit}
                className="px-4 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                Chốt kết luận Case
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
