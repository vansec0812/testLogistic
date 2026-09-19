// ==============================================================================
// ECont AiEdoScannerModal - AI xác minh file Lệnh giao hàng điện tử e-DO / Booking
// Kết quả pháp lý/bất thường được lấy từ API backend; không tự kết luận khi API lỗi.
// ==============================================================================

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  FileText, Sparkles, UploadCloud, CheckCircle2, AlertCircle,
  X, Check, RefreshCw, AlertTriangle, CheckCircle
} from 'lucide-react';
import { CarrierCode, ContainerType } from '../types';
import {
  ExtractedEdoData,
  EdoVerificationResult,
  verifyEdoWithAI,
  normalizeIsoContainerNumber
} from '../services/aiService';
import { validateContainerNumber } from '../services/iso6346';
import { DateInput } from './DateInput';

export type { ExtractedEdoData } from '../services/aiService';

function displayDateDdMmYyyy(value: string): string {
  const isoMatch = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return isoMatch ? `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}` : value;
}

function parseDateDdMmYyyy(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return value.trim();
  const match = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : value;
}

interface AiEdoScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyData: (data: ExtractedEdoData) => void;
  onDocumentSelected?: (file: File) => void;
  onVerificationComplete?: (verification: EdoVerificationResult, file: File) => void;
  title?: string;
  subtitle?: string;
}

// Mẫu eDO thực tế chuẩn hóa sẵn sàng trải nghiệm ngay
const SAMPLE_EDO_DOCS: Array<{
  id: string;
  label: string;
  carrier: CarrierCode;
  fileName: string;
  data: ExtractedEdoData;
}> = [
  {
    id: 'sample-maersk',
    label: 'Lệnh e-DO Maersk Line (Nhập khẩu Cát Lái)',
    carrier: 'MAERSK',
    fileName: 'EDO_MAERSK_MSKU8421093.pdf',
    data: {
      containerNumber: 'MSKU8421093',
      carrierCode: 'MAERSK',
      edoNumber: 'EDO-MSK-2026-984210',
      returnDepot: 'ICD Transimex Thủ Đức',
      expiryDate: '2026-09-25',
      consignee: 'Hưng Thịnh Logistics Co., Ltd',
      containerType: '40HC',
      sealNumber: 'ML-VN-90821',
      confidenceScore: 99.2,
      source: 'DEMO_SAMPLE',
    },
  },
  {
    id: 'sample-cma',
    label: 'Lệnh e-DO CMA CGM (Cảng Tân Cảng)',
    carrier: 'CMA_CGM',
    fileName: 'EDO_CMA_CGM_CMAU5192834.pdf',
    data: {
      containerNumber: 'CMAU5192834',
      carrierCode: 'CMA_CGM',
      edoNumber: 'EDO-CMA-2026-771290',
      returnDepot: 'Depot Tân Cảng Suối Tiên',
      expiryDate: '2026-09-28',
      consignee: 'Toàn Cầu Export & Logistics Corp',
      containerType: '20GP',
      sealNumber: 'CMA-S-44109',
      confidenceScore: 98.6,
      source: 'DEMO_SAMPLE',
    },
  },
  {
    id: 'sample-one',
    label: 'Lệnh e-DO ONE Line (Hạ bãi Đình Vũ)',
    carrier: 'ONE',
    fileName: 'EDO_ONE_ONEY9012384.pdf',
    data: {
      containerNumber: 'ONEY9012384',
      carrierCode: 'ONE',
      edoNumber: 'EDO-ONE-2026-339182',
      returnDepot: 'Depot Đình Vũ (Hải Phòng)',
      expiryDate: '2026-09-30',
      consignee: 'Hải Phòng Maritime Services',
      containerType: '40HC',
      sealNumber: 'ONE-HPH-1120',
      confidenceScore: 97.9,
      source: 'DEMO_SAMPLE',
    },
  },
  {
    id: 'sample-evergreen',
    label: 'Lệnh e-DO Evergreen Line (ICD Phước Long)',
    carrier: 'EVERGREEN',
    fileName: 'EDO_EVERGREEN_EMCU7281930.pdf',
    data: {
      containerNumber: 'EMCU7281930',
      carrierCode: 'EVERGREEN',
      edoNumber: 'EDO-EMC-2026-518293',
      returnDepot: 'ICD Phước Long 3',
      expiryDate: '2026-10-02',
      consignee: 'Đại Lục Import Export Corp',
      containerType: '40HC',
      sealNumber: 'EMC-VN-7718',
      confidenceScore: 98.9,
      source: 'DEMO_SAMPLE',
    },
  },
];

export const AiEdoScannerModal: React.FC<AiEdoScannerModalProps> = ({
  isOpen,
  onClose,
  onApplyData,
  onDocumentSelected,
  onVerificationComplete,
  title = 'AI Xác Minh eDO / Booking từ File Upload',
  subtitle = 'Tải ảnh hoặc PDF để kiểm tra tính hợp lệ và dấu hiệu bất thường của chứng từ',
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [activeSampleId, setActiveSampleId] = useState<string>('');
  const [showSamples, setShowSamples] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStepMessage, setScanStepMessage] = useState('');
  const [scanNotice, setScanNotice] = useState('');
  
  // Dữ liệu trích xuất có thể chỉnh sửa trực tiếp trước khi áp dụng
  const [editableData, setEditableData] = useState<ExtractedEdoData | null>(null);
  const [verificationResult, setVerificationResult] = useState<EdoVerificationResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const scanTimerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (scanTimerRef.current !== null) window.clearTimeout(scanTimerRef.current);
  }, []);

  // Kiểm tra tính hợp lệ của số cont đang chỉnh sửa
  const contValidation = useMemo(() => {
    if (!editableData?.containerNumber) return null;
    return validateContainerNumber(editableData.containerNumber);
  }, [editableData?.containerNumber]);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isImage = file.type.startsWith('image/');
    if ((!isPdf && !isImage) || file.size > 20 * 1024 * 1024) {
      setScanNotice('Tệp không hợp lệ. Chỉ chấp nhận tệp hình ảnh (PNG, JPG, WebP) hoặc file PDF (tối đa 20MB).');
      return;
    }
    setSelectedFile(file);
    onDocumentSelected?.(file);
    setActiveSampleId('');
    setEditableData(null);
    setVerificationResult(null);
    setScanNotice('');

    if (isImage) {
      const reader = new FileReader();
      reader.onload = () => setFilePreviewUrl(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setFilePreviewUrl(null);
    }

    // Tệp thật được đưa vào hàng đợi quét ngay sau khi upload; người dùng vẫn
    // có thể bấm quét lại nếu muốn đối chiếu lại sau khi đổi tệp.
    window.setTimeout(() => { void runAiScan(file); }, 0);
  };

  const handleSelectSample = (sampleId: string) => {
    setActiveSampleId(sampleId);
    setSelectedFile(null);
    setFilePreviewUrl(null);
    setEditableData(null);
    setVerificationResult(null);
    setScanNotice('');
  };

  const runAiScan = async (fileOverride?: File) => {
    const fileToScan = fileOverride || selectedFile;
    if (!fileToScan && !activeSampleId) {
      setScanNotice('Vui lòng tải lên ảnh chụp hoặc file PDF chứng từ e-DO trước khi bắt đầu quét.');
      return;
    }
    setIsScanning(true);
    setScanProgress(20);
    setScanStepMessage('Đang đọc tệp và phân tích cấu trúc văn bản...');
    setEditableData(null);
    setScanNotice('');

    if (fileToScan) {
      setScanProgress(45);
      setScanStepMessage('AI đang kiểm tra trực tiếp tính hợp lệ và dấu hiệu bất thường của file eDO...');
      const verification = await verifyEdoWithAI(fileToScan);
      setScanProgress(100);
      setScanStepMessage('Hoàn tất xác minh eDO.');
      setIsScanning(false);
      setVerificationResult(verification);
      setScanNotice(verification.status === 'VALID'
        ? '✓ File eDO hợp lệ theo kết quả AI.'
        : `⚠️ eDO có kết quả ${verification.status === 'MANUAL_REVIEW' ? 'chờ Ops xác minh' : 'bất thường/không hợp lệ'}: ${verification.error || verification.summary}`);
      return;
    }

    // Chứng từ mẫu
    setScanProgress(50);
    setScanStepMessage('Đang phân tích chứng từ mẫu...');
    scanTimerRef.current = window.setTimeout(() => {
      setScanProgress(85);
      setScanStepMessage('Chuẩn hóa dữ liệu theo chuẩn ISO 6346...');
      setTimeout(() => {
        const sample = SAMPLE_EDO_DOCS.find(s => s.id === activeSampleId);
        setScanProgress(100);
        setIsScanning(false);
        if (sample) {
          setEditableData({ ...sample.data, source: 'DEMO_SAMPLE' });
          setScanNotice('✓ Đã trích xuất dữ liệu chứng từ. Bạn có thể chỉnh sửa trước khi áp dụng.');
        }
      }, 300);
    }, 400);
  };

  const handleNormalizeCont = () => {
    if (!editableData) return;
    const normalized = normalizeIsoContainerNumber(editableData.containerNumber, editableData.carrierCode);
    setEditableData(prev => prev ? ({ ...prev, containerNumber: normalized }) : null);
  };

  const handleApply = () => {
    if (verificationResult && selectedFile) {
      onVerificationComplete?.(verificationResult, selectedFile);
      onClose();
      return;
    }
    if (!editableData) return;
    if (!editableData.containerNumber.trim()) {
      setScanNotice('Vui lòng nhập số container trước khi áp dụng.');
      return;
    }
    onApplyData(editableData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-50 via-teal-50/40 to-white text-slate-900 p-5 border-b border-blue-100 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-600">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg text-slate-900 flex items-center gap-2">
                {title}
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700 border border-blue-200">
                  AI kiểm tra chứng từ
                </span>
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">{subtitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {scanNotice && (
            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs font-semibold text-blue-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-blue-600" />
              <span>{scanNotice}</span>
            </div>
          )}

          {/* Step 1: Upload Image or PDF File */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                <span>Tải ảnh chụp hoặc file PDF chứng từ e-DO / Booking</span>
              </label>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                Chỉ đăng ảnh hoặc file PDF
              </span>
            </div>

            {/* Custom file dropzone / display */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                selectedFile
                  ? 'border-blue-500 bg-blue-50/40 ring-2 ring-blue-100'
                  : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50/80 bg-white'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,image/png,image/jpeg,image/jpg,image/webp"
                onChange={handleFileUpload}
                className="hidden"
              />

              {selectedFile ? (
                <div className="space-y-3">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-100 text-blue-700 mx-auto">
                    {selectedFile.type.startsWith('image/') ? (
                      <UploadCloud className="w-6 h-6 text-blue-600" />
                    ) : (
                      <FileText className="w-6 h-6 text-blue-600" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 truncate max-w-md mx-auto">{selectedFile.name}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {selectedFile.type.startsWith('image/') ? 'Tệp hình ảnh' : 'Tệp PDF'} · {(selectedFile.size / 1024).toFixed(1)} KB · <span className="text-emerald-600 font-semibold">Đã tải lên sẵn sàng quét AI</span>
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                      className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 shadow-sm"
                    >
                      Chọn tệp khác
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFile(null);
                        setFilePreviewUrl(null);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-semibold hover:bg-red-100 shadow-sm"
                    >
                      Xóa tệp
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <UploadCloud className="w-10 h-10 text-blue-600 mx-auto" />
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      <span className="text-blue-600 font-bold hover:underline">Bấm để chọn tệp</span> hoặc kéo thả chứng từ vào đây
                    </p>
                    <p className="text-xs text-slate-500 mt-1 font-medium">
                      Hệ thống chỉ nhận định dạng hình ảnh (.png, .jpg, .webp) hoặc tài liệu .pdf (tối đa 20MB)
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Preview image */}
            {filePreviewUrl && (
              <div className="relative rounded-xl border border-slate-200 overflow-hidden max-h-48 bg-slate-100 flex items-center justify-center p-2">
                <img src={filePreviewUrl} alt="Xem trước e-DO" className="max-h-44 object-contain rounded-lg shadow-sm" />
                <div className="absolute top-3 right-3 bg-slate-900/75 text-white text-[11px] px-2.5 py-1 rounded-full backdrop-blur-sm font-semibold">
                  Xem trước ảnh e-DO
                </div>
              </div>
            )}

            {/* Collapsible Sample documents for testing */}
            <div className="pt-1">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowSamples(!showSamples)}
                  className="text-xs text-slate-500 hover:text-blue-600 font-medium flex items-center gap-1 transition-colors"
                >
                  <span>{showSamples ? '▼ Ẩn chứng từ mẫu' : '▶ Thử nghiệm nhanh với chứng từ e-DO mẫu'}</span>
                </button>
                {activeSampleId && !selectedFile && (
                  <span className="text-xs font-semibold text-blue-700">
                    Đang chọn mẫu: {SAMPLE_EDO_DOCS.find(s => s.id === activeSampleId)?.label}
                  </span>
                )}
              </div>

              {showSamples && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 pt-2 border-t border-slate-100 animate-in fade-in duration-150">
                  {SAMPLE_EDO_DOCS.map(s => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handleSelectSample(s.id)}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        activeSampleId === s.id && !selectedFile
                          ? 'border-blue-500 bg-blue-50/60 shadow-sm ring-2 ring-blue-100'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-bold font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                          {s.carrier}
                        </span>
                        {activeSampleId === s.id && !selectedFile && (
                          <Check className="w-3.5 h-3.5 text-blue-600" />
                        )}
                      </div>
                      <p className="text-xs font-semibold text-slate-900 line-clamp-1">{s.label}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5 truncate">{s.fileName}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Action: Run Scan */}
          <div>
            <button
              type="button"
              disabled={isScanning}
              onClick={() => { void runAiScan(); }}
              className={`w-full py-3.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 shadow-sm transition-all ${
                isScanning
                  ? 'bg-blue-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'
              }`}
            >
              {isScanning ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Đang quét và phân tích ({scanProgress}%)...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Xác minh tính hợp lệ eDO bằng AI</span>
                </>
              )}
            </button>
          </div>

          {/* Progress Bar */}
          {isScanning && (
            <div className="space-y-2 bg-slate-50 border border-slate-200 rounded-xl p-4">
              <div className="flex justify-between text-xs sm:text-sm font-medium text-slate-600">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
                  {scanStepMessage || 'AI Vision đang phân tích chứng từ...'}
                </span>
                <span className="font-mono font-bold text-blue-600">{scanProgress}%</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${scanProgress}%` }}
                />
              </div>
            </div>
          )}

          {verificationResult && (
            <div className={`rounded-2xl border p-4 space-y-2 animate-in fade-in duration-300 ${verificationResult.status === 'VALID' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : verificationResult.status === 'MANUAL_REVIEW' ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-red-200 bg-red-50 text-red-900'}`}>
              <div className="flex items-center gap-2 font-bold text-sm">
                {verificationResult.status === 'VALID' ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <AlertTriangle className="w-5 h-5 text-amber-600" />}
                <span>{verificationResult.status === 'VALID' ? 'eDO hợp lệ theo AI' : verificationResult.status === 'MANUAL_REVIEW' ? 'eDO cần Ops xác minh thủ công' : 'eDO không hợp lệ hoặc có dấu hiệu bất thường'}</span>
                {verificationResult.score !== undefined && <span className="ml-auto font-mono">{verificationResult.score}/100</span>}
              </div>
              <p className="text-xs">{verificationResult.summary}</p>
              {verificationResult.details.length > 0 && (
                <ul className="text-xs list-disc pl-5 space-y-0.5">
                  {verificationResult.details.map((detail, index) => <li key={index}>{detail}</li>)}
                </ul>
              )}
            </div>
          )}

          {/* Step 2: Extracted & Editable Results Form dành cho chứng từ mẫu */}
          {editableData && (
            <div className="border border-emerald-200 bg-emerald-50/40 rounded-2xl p-4 space-y-4 animate-in fade-in duration-300">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-emerald-200">
                <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span>Kết quả trích xuất AI · Kiểm tra và hiệu chỉnh</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Độ tin cậy: {editableData.confidenceScore}%
                  </span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white text-slate-600 border border-slate-200">
                    {editableData.source === 'BACKEND_API' ? 'Đã xác nhận qua API' : editableData.source === 'DEMO_SAMPLE' ? 'Dữ liệu mẫu' : 'Chưa xác minh tự động'}
                  </span>
                </div>
              </div>

              {editableData.verification && (
                <div className={`rounded-xl border px-3 py-2 text-xs ${editableData.verification.status === 'VALID' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
                  <strong>{editableData.verification.status === 'VALID' ? 'eDO hợp lệ' : editableData.verification.status === 'MANUAL_REVIEW' ? 'eDO chờ Ops xác minh' : 'eDO có dấu hiệu bất thường/không hợp lệ'}</strong>
                  <span className="ml-1">{editableData.verification.summary}</span>
                  {editableData.verification.details.length > 0 && (
                    <ul className="mt-1 list-disc pl-4 space-y-0.5">
                      {editableData.verification.details.map((detail, index) => <li key={index}>{detail}</li>)}
                    </ul>
                  )}
                </div>
              )}

              {/* Editable Fields Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs sm:text-sm">
                {/* 1. Số Container */}
                <div className="bg-white rounded-xl p-3 border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-slate-500 font-semibold">Số Container (ISO 6346)</label>
                    {contValidation && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 ${
                        contValidation.isValid 
                          ? 'bg-emerald-100 text-emerald-700' 
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {contValidation.isValid ? <CheckCircle className="w-2.5 h-2.5" /> : <AlertTriangle className="w-2.5 h-2.5" />}
                        {contValidation.isValid ? 'Chuẩn ISO' : 'Ký tự thứ 11 sai'}
                      </span>
                    )}
                  </div>
                  <input
                    value={editableData.containerNumber}
                    onChange={e => setEditableData(p => p ? ({ ...p, containerNumber: e.target.value.toUpperCase() }) : null)}
                    className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="VD: MSKU8421093"
                  />
                  {contValidation && !contValidation.isValid && (
                    <button
                      type="button"
                      onClick={handleNormalizeCont}
                      className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
                    >
                      <Sparkles className="w-3 h-3" /> Tự động sửa chuẩn ISO
                    </button>
                  )}
                </div>

                {/* 2. Loại Container */}
                <div className="bg-white rounded-xl p-3 border border-slate-200 space-y-1">
                  <label className="text-xs text-slate-500 font-semibold block">Loại Container</label>
                  <select
                    value={editableData.containerType}
                    onChange={e => setEditableData(p => p ? ({ ...p, containerType: e.target.value as ContainerType }) : null)}
                    className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  >
                    <option value="40HC">40HC (40ft Cao)</option>
                    <option value="20GP">20GP (20ft Tiêu chuẩn)</option>
                  </select>
                </div>

                {/* 3. Hãng tàu */}
                <div className="bg-white rounded-xl p-3 border border-slate-200 space-y-1">
                  <label className="text-xs text-slate-500 font-semibold block">Hãng tàu quản lý</label>
                  <select
                    value={editableData.carrierCode}
                    onChange={e => setEditableData(p => p ? ({ ...p, carrierCode: e.target.value as CarrierCode }) : null)}
                    className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-blue-700 outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  >
                    <option value="MAERSK">MAERSK Line</option>
                    <option value="CMA_CGM">CMA CGM</option>
                    <option value="ONE">ONE (Ocean Network Express)</option>
                    <option value="COSCO">COSCO Shipping</option>
                    <option value="EVERGREEN">EVERGREEN Marine</option>
                    <option value="MSC">MSC (Mediterranean)</option>
                    <option value="HAPAG_LLOYD">HAPAG-LLOYD</option>
                    <option value="OTHER">Hãng tàu khác</option>
                  </select>
                </div>

                {/* 6. Hạn Free time */}
                <div className="bg-white rounded-xl p-3 border border-slate-200 space-y-1">
                  <label className="text-xs text-slate-500 font-semibold block">Hạn Free time / Trả vỏ</label>
                  <DateInput
                    value={editableData.expiryDate}
                    onChange={v => setEditableData(p => p ? ({ ...p, expiryDate: v ? v.split('T')[0] : '' }) : null)}
                    className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono font-semibold text-amber-800 outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* 7. Chủ hàng / Đơn vị nhận */}
                <div className="bg-white rounded-xl p-3 border border-slate-200 space-y-1 sm:col-span-2">
                  <label className="text-xs text-slate-500 font-semibold block">Chủ hàng / Đơn vị nhận vỏ</label>
                  <input
                    value={editableData.consignee}
                    onChange={e => setEditableData(p => p ? ({ ...p, consignee: e.target.value }) : null)}
                    className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* 8. Số seal niêm chì */}
                <div className="bg-white rounded-xl p-3 border border-slate-200 space-y-1">
                  <label className="text-xs text-slate-500 font-semibold block">Số Seal niêm chì</label>
                  <input
                    value={editableData.sealNumber || ''}
                    onChange={e => setEditableData(p => p ? ({ ...p, sealNumber: e.target.value }) : null)}
                    placeholder="VD: SL-ML-88192"
                    className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
          >
            Đóng
          </button>
          <button
            type="button"
            disabled={!editableData && !verificationResult}
            onClick={handleApply}
            className={`px-5 py-2.5 text-sm font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-sm ${
              editableData || verificationResult
                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <Check className="w-4 h-4" />
            <span>{verificationResult && !editableData ? 'Xác nhận kết quả eDO' : 'Áp dụng vào Form'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
