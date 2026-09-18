// ECont AI service
//
// Tất cả xử lý AI thật đi qua ECont API. Secret của nhà cung cấp AI chỉ được
// giữ ở backend; trình duyệt không nhận, lưu hoặc gửi API key trực tiếp.

import { CarrierCode, ContainerType, AiInspectionResult, PhysicalCondition } from '../types';
import { calculateCheckDigit, validateContainerNumber } from './iso6346';
import { ApiClientError, isApiConfigured, postApi } from './apiClient';

export interface ExtractedEdoData {
  containerNumber: string;
  carrierCode: CarrierCode;
  edoNumber: string;
  returnDepot: string;
  expiryDate: string;
  consignee: string;
  containerType: ContainerType;
  sealNumber?: string;
  confidenceScore: number;
  source?: 'BACKEND_API' | 'DEMO_SAMPLE';
  verification?: EdoVerificationResult;
}

export interface EdoVerificationResult {
  success: boolean;
  status: 'VALID' | 'INVALID' | 'ANOMALY' | 'MANUAL_REVIEW' | 'ERROR';
  isLegal: boolean;
  hasAnomaly: boolean;
  score?: number;
  summary: string;
  details: string[];
  anomalyReason?: string;
  requiresOpsReview: boolean;
  error?: string;
}

export interface ContainerPhotoVerificationResult {
  success: boolean;
  status: 'MATCHED' | 'MISMATCH' | 'MANUAL_REVIEW' | 'ERROR';
  matchesRegistration: boolean;
  score?: number;
  actualContainerNumber?: string;
  actualContainerType?: ContainerType;
  actualCarrierCode?: string;
  actualCondition?: PhysicalCondition;
  actualConditionNotes?: string;
  mismatchDetails: string[];
  summary: string;
  requiresOpsReview: boolean;
  error?: string;
}

/** Sinh số container ISO 6346 hợp lệ để dùng trong dữ liệu demo. */
export function generateValidIsoContainerNumber(prefix4 = 'MSKU'): string {
  const pfx = prefix4.toUpperCase().slice(0, 4);
  const serial6 = Math.floor(100000 + Math.random() * 900000).toString();
  const first10 = `${pfx}${serial6}`;
  const checkDigit = calculateCheckDigit(first10) ?? 0;
  return `${first10}${checkDigit}`;
}

/** Chuẩn hóa số container ISO 6346. */
export function normalizeIsoContainerNumber(raw: string, carrier: CarrierCode = 'MAERSK'): string {
  const clean = (raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (clean.length === 11) {
    const val = validateContainerNumber(clean);
    if (val.isValid) return clean;
    const expected = calculateCheckDigit(clean.slice(0, 10));
    if (expected !== null) return `${clean.slice(0, 10)}${expected}`;
  }
  if (clean.length === 10) {
    const expected = calculateCheckDigit(clean);
    if (expected !== null) return `${clean}${expected}`;
  }
  const prefixes: Record<string, string> = {
    MAERSK: 'MSKU', CMA_CGM: 'CMAU', ONE: 'ONEY', COSCO: 'COSU',
    EVERGREEN: 'EMCU', MSC: 'MSCU', HAPAG_LLOYD: 'HLCU', OTHER: 'TCKU'
  };
  return generateValidIsoContainerNumber(prefixes[carrier] || 'TCKU');
}

/** Chuyển đổi File sang Base64 để gửi qua ECont API. */
export function fileToBase64(file: File): Promise<{ mimeType: string; data: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const separator = result.indexOf(',');
      if (separator < 0) return reject(new Error('Không đọc được nội dung tệp.'));
      resolve({
        mimeType: file.type || 'application/octet-stream',
        data: result.slice(separator + 1),
      });
    };
    reader.onerror = () => reject(new Error('Không đọc được tệp tải lên.'));
    reader.readAsDataURL(file);
  });
}

function unwrapApiPayload(payload: any): any {
  return payload?.data || payload?.result || payload?.verification || payload || {};
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(item => String(item || '').trim()).filter(Boolean);
}

function normalizeCondition(value: unknown): PhysicalCondition | undefined {
  const normalized = String(value || '').toUpperCase();
  if (normalized === 'GOOD' || normalized === 'CLEAN' || normalized === 'NEW') return 'GOOD';
  if (normalized === 'MINOR_DAMAGE' || normalized === 'MINOR' || normalized === 'USED') return 'MINOR_DAMAGE';
  if (normalized === 'MAJOR_DAMAGE' || normalized === 'MAJOR' || normalized === 'DAMAGED') return 'MAJOR_DAMAGE';
  return undefined;
}

function fallbackApiMessage(error: unknown): string {
  const message = error instanceof ApiClientError
    ? error.message
    : error instanceof Error ? error.message : 'Lỗi khi gọi dịch vụ AI.';
  if (/failed to fetch|networkerror|load failed|err_connection_refused|econnrefused|connection refused|proxy error/i.test(message)) {
    return 'Máy chủ ECont AI chưa sẵn sàng. File đã được chuyển Ops kiểm tra thủ công.';
  }
  return message;
}

/** OCR eDO. API thật trả dữ liệu trích xuất; secret chỉ nằm ở backend. */
export async function extractEdoWithAI(file: File): Promise<{ success: boolean; data?: ExtractedEdoData; error?: string }> {
  try {
    if (isApiConfigured) {
      const document = await fileToBase64(file);
      const response = unwrapApiPayload(await postApi<any>('/api/ai/edo/scan', {
        task: 'EDO_EXTRACTION',
        document: { fileName: file.name, ...document },
      }));
      const carrierCode = asString(response.carrierCode, 'OTHER') as CarrierCode;
      const rawNumber = asString(response.containerNumber);
      if (!rawNumber) throw new Error('API không nhận diện được số container từ eDO.');
      const compactNumber = rawNumber.toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (!/^[A-Z]{4}\d{7}$/.test(compactNumber)) throw new Error('Số container AI trả về không đúng định dạng ISO 6346.');
      return {
        success: true,
        data: {
          containerNumber: normalizeIsoContainerNumber(compactNumber, carrierCode),
          carrierCode,
          edoNumber: asString(response.edoNumber || response.bookingNumber),
          returnDepot: asString(response.returnDepot || response.depot),
          expiryDate: asString(response.expiryDate || response.freeTimeEnd),
          consignee: asString(response.consignee || response.consigneeName),
          containerType: String(response.containerType || '40HC').toUpperCase() === '20GP' ? '20GP' : '40HC',
          sealNumber: asString(response.sealNumber) || undefined,
          confidenceScore: Number(response.confidenceScore ?? response.confidence ?? 0),
          source: 'BACKEND_API',
        },
      };
    }

    return {
      success: false,
      error: 'Chưa cấu hình ECont AI API. Không tự tạo dữ liệu eDO khi chưa có kết quả từ API.',
    };
  } catch (error) {
    return { success: false, error: fallbackApiMessage(error) };
  }
}

/** Xác minh eDO hợp pháp/bất thường. Không có kết quả API thì chuyển Ops kiểm tra thủ công. */
export async function verifyEdoWithAI(file: File, extracted?: Partial<ExtractedEdoData>): Promise<EdoVerificationResult> {
  if (!isApiConfigured) {
    return {
      success: true,
      status: 'MANUAL_REVIEW',
      isLegal: false,
      hasAnomaly: true,
      summary: 'Chưa có máy chủ ECont AI; file eDO đã được chuyển Ops kiểm tra thủ công.',
      details: ['Kết quả pháp lý chưa được xác nhận tự động.'],
      requiresOpsReview: true,
      error: 'Chưa cấu hình máy chủ ECont AI.',
    };
  }

  try {
    const document = await fileToBase64(file);
    const response = unwrapApiPayload(await postApi<any>('/api/ai/edo/verify', {
      task: 'EDO_LEGALITY_AND_ANOMALY_CHECK',
      document: { fileName: file.name, ...document },
      extracted,
    }));
    const hasLegalValue = typeof response.isLegal === 'boolean'
      || typeof response.isValid === 'boolean'
      || typeof response.legal === 'boolean'
      || typeof response.valid === 'boolean'
      || typeof response.isValidEdo === 'boolean'
      || ['VALID', 'LEGAL', 'APPROVED', 'INVALID', 'ILLEGAL', 'REJECTED'].includes(String(response.status || '').toUpperCase());
    if (!hasLegalValue) {
      return {
        success: true,
        status: 'MANUAL_REVIEW',
        isLegal: false,
        hasAnomaly: true,
        summary: 'API chưa trả về kết quả pháp lý rõ ràng; cần Ops xác minh thủ công.',
        details: ['Thiếu trường isLegal/isValid trong phản hồi API.'],
        requiresOpsReview: true,
      };
    }
    const statusValue = String(response.status || '').toUpperCase();
    const statusImpliesLegal = ['VALID', 'LEGAL', 'APPROVED'].includes(statusValue);
    const statusImpliesInvalid = ['INVALID', 'ILLEGAL', 'REJECTED'].includes(statusValue);
    const isLegal = response.isLegal ?? response.isValid ?? response.legal ?? response.valid ?? response.isValidEdo ?? (statusImpliesLegal ? true : statusImpliesInvalid ? false : false);
    const hasAnomaly = Boolean(response.hasAnomaly ?? response.anomaly ?? response.suspicious);
    const details = asStringArray(response.details || response.findings || response.anomalies);
    const status = !isLegal ? 'INVALID' : hasAnomaly ? 'ANOMALY' : 'VALID';
    return {
      success: true,
      status,
      isLegal,
      hasAnomaly,
      score: Number(response.score ?? response.confidence ?? 0) || undefined,
      summary: asString(response.summary || response.message, isLegal ? 'eDO hợp lệ theo kết quả AI.' : 'eDO không hợp lệ theo kết quả AI.'),
      details,
      anomalyReason: asString(response.anomalyReason || response.reason) || undefined,
      requiresOpsReview: Boolean(response.requiresOpsReview ?? (hasAnomaly || !isLegal)),
    };
  } catch (error) {
    return {
      success: true,
      status: 'MANUAL_REVIEW',
      isLegal: false,
      hasAnomaly: true,
      summary: 'Không nhận được kết quả xác minh eDO từ AI; đã chuyển Ops kiểm tra thủ công.',
      details: [fallbackApiMessage(error)],
      requiresOpsReview: true,
      error: fallbackApiMessage(error),
    };
  }
}

/** Giám định tình trạng ảnh container. Kết quả API phải trả tình trạng thực tế và chi tiết phát hiện. */
export async function inspectContainerWithAI(photos: string[]): Promise<AiInspectionResult> {
  if (photos.length < 6) {
    return { success: false, status: 'ERROR', requiresOpsReview: true, error: 'Cần tải đủ tối thiểu 6 ảnh container để giám định.' };
  }
  if (!isApiConfigured) {
    return { success: false, status: 'ERROR', requiresOpsReview: true, error: 'Chưa cấu hình ECont AI API. Không được tự đánh dấu ảnh đạt khi chưa có kết quả AI.' };
  }
  try {
    const response = unwrapApiPayload(await postApi<any>('/api/ai/container/inspect', {
      task: 'CONTAINER_PHYSICAL_CONDITION', photos, requiredPhotoCount: 6,
    }));
    const condition = normalizeCondition(response.condition || response.actualCondition);
    const details = asStringArray(response.details || response.findings);
    const requiresOpsReview = Boolean(response.requiresOpsReview ?? response.hasAnomaly ?? response.status === 'ANOMALY');
    return {
      success: true,
      status: response.status === 'ANOMALY' || requiresOpsReview ? 'ANOMALY' : 'CLEAN',
      score: Number(response.score ?? response.confidence ?? 0) || undefined,
      condition,
      summary: asString(response.summary || response.conditionNotes, 'AI đã phân tích ảnh container.'),
      details,
      requiresOpsReview,
    };
  } catch (error) {
    return { success: false, status: 'ERROR', requiresOpsReview: true, error: fallbackApiMessage(error) };
  }
}

/** Đối chiếu 6 ảnh thực tế với số cont, loại, hãng và tình trạng đã khai báo. */
export async function verifyContainerPhotosWithAI(
  photos: string[],
  expected: { containerNumber: string; containerType: ContainerType; carrierCode: string; declaredCondition: PhysicalCondition }
): Promise<ContainerPhotoVerificationResult> {
  if (photos.length < 6) {
    return {
      success: false, status: 'ERROR', matchesRegistration: false,
      mismatchDetails: ['Cần tải đủ tối thiểu 6 ảnh container (6 góc) để đối chiếu.'],
      summary: 'Chưa đủ ảnh container để kiểm tra.', requiresOpsReview: true,
      error: 'Tối thiểu 6 ảnh container là bắt buộc.',
    };
  }

  if (!isApiConfigured) {
    return {
      success: true, status: 'MANUAL_REVIEW', matchesRegistration: false, mismatchDetails: [],
      summary: 'Chưa có máy chủ ECont AI; bộ ảnh đã được chuyển Ops kiểm tra thủ công.',
      requiresOpsReview: true,
    };
  }

  try {
    const response = unwrapApiPayload(await postApi<any>('/api/ai/container/verify', {
      task: 'CONTAINER_IDENTITY_AND_PHYSICAL_CONDITION', photos, expected, requiredPhotoCount: 6,
    }));
    const mismatchDetails = asStringArray(response.mismatchDetails || response.mismatches || response.errors);
    const actualContainerNumber = asString(response.actualContainerNumber || response.detectedContainerNumber) || undefined;
    const actualTypeValue = String(response.actualContainerType || response.detectedContainerType || '').toUpperCase();
    const actualContainerType = actualTypeValue === '20GP' ? '20GP' : actualTypeValue === '40HC' ? '40HC' : undefined;
    const actualCarrierCode = asString(response.actualCarrierCode || response.detectedCarrierCode) || undefined;
    const actualCondition = normalizeCondition(response.actualCondition || response.detectedCondition || response.condition);
    const responseDetails = asStringArray(response.details || response.findings || response.conditionDetails);
    const actualConditionNotes = asString(response.actualConditionNotes || response.conditionNotes || response.physicalSummary) || responseDetails.join(' ') || undefined;

    if (actualContainerNumber && actualContainerNumber !== expected.containerNumber) mismatchDetails.push(`Ảnh nhận diện số cont ${actualContainerNumber}, không khớp ${expected.containerNumber}.`);
    if (actualContainerType && actualContainerType !== expected.containerType) mismatchDetails.push(`Ảnh nhận diện loại ${actualContainerType}, không khớp ${expected.containerType}.`);
    if (actualCarrierCode && actualCarrierCode !== expected.carrierCode) mismatchDetails.push(`Ảnh nhận diện hãng ${actualCarrierCode}, không khớp ${expected.carrierCode}.`);
    if (actualCondition && actualCondition !== expected.declaredCondition) mismatchDetails.push(`Tình trạng thực tế (${actualCondition}) khác tình trạng khai báo (${expected.declaredCondition}).`);

    const explicitStatus = String(response.status || '').toUpperCase();
    const explicitMatch = response.matchesRegistration ?? response.identityMatch ?? response.matches;
    const matchesRegistration = (explicitMatch === undefined
      ? explicitStatus === 'MATCHED' && mismatchDetails.length === 0
      : Boolean(explicitMatch)) && mismatchDetails.length === 0;
    const isMismatch = explicitStatus === 'MISMATCH' || !matchesRegistration;
    const status = explicitStatus === 'MANUAL_REVIEW' || response.requiresOpsReview ? 'MANUAL_REVIEW' : isMismatch ? 'MISMATCH' : 'MATCHED';
    return {
      success: true, status, matchesRegistration,
      score: Number(response.score ?? response.confidence ?? 0) || undefined,
      actualContainerNumber, actualContainerType, actualCarrierCode, actualCondition, actualConditionNotes,
      mismatchDetails,
      summary: asString(response.summary || response.message, isMismatch ? 'Ảnh chưa khớp đầy đủ với thông tin đăng ký.' : 'Ảnh khớp với thông tin container đã đăng ký.'),
      requiresOpsReview: Boolean(response.requiresOpsReview ?? status !== 'MATCHED'),
      error: asString(response.error) || undefined,
    };
  } catch (error) {
    return {
      success: true, status: 'MANUAL_REVIEW', matchesRegistration: false,
      mismatchDetails: [fallbackApiMessage(error)],
      summary: 'Không nhận được kết quả đối chiếu ảnh; đã chuyển Ops kiểm tra thủ công.',
      requiresOpsReview: true, error: fallbackApiMessage(error),
    };
  }
}
