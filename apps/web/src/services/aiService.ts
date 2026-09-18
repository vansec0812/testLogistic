// ECont AI services: OCR eDO/Booking và hỗ trợ giám định ảnh container.
// Kết quả AI chỉ là đề xuất; Ops vẫn là bên quyết định đối với hồ sơ bất thường.

import { CarrierCode, ContainerType, AiInspectionResult } from '../types';
import { isApiConfigured, postApi } from './apiClient';

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
  source?: 'AI_API' | 'DEMO_SAMPLE';
}

export interface ContainerPhotoVerificationResult {
  success: boolean;
  status: 'MATCHED' | 'MISMATCH' | 'MANUAL_REVIEW' | 'ERROR';
  matchesRegistration: boolean;
  score?: number;
  actualContainerNumber?: string;
  actualContainerType?: ContainerType;
  actualCarrierCode?: string;
  actualCondition?: 'GOOD' | 'MINOR_DAMAGE' | 'MAJOR_DAMAGE';
  mismatchDetails: string[];
  summary: string;
  requiresOpsReview: boolean;
  error?: string;
}

const validCarriers = ['MAERSK', 'CMA_CGM', 'ONE', 'COSCO', 'EVERGREEN', 'HAPAG_LLOYD', 'MSC', 'OTHER'];

export function fileToBase64(file: File): Promise<{ mimeType: string; data: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const separator = result.indexOf(',');
      if (separator < 0) return reject(new Error('Không đọc được nội dung tệp.'));
      resolve({ mimeType: file.type || 'application/octet-stream', data: result.slice(separator + 1) });
    };
    reader.onerror = () => reject(new Error('Không đọc được tệp tải lên.'));
    reader.readAsDataURL(file);
  });
}

function parseJsonPayload(value: unknown): any {
  if (typeof value === 'object' && value !== null) return value;
  const text = String(value || '').trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  return JSON.parse(text);
}

function normalizeEdoData(input: any): ExtractedEdoData {
  const containerNumber = String(input?.containerNumber || '').replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z]{4}\d{7}$/.test(containerNumber)) {
    throw new Error('AI chưa nhận diện được số container hợp lệ theo ISO 6346.');
  }
  const carrierCode = validCarriers.includes(String(input?.carrierCode || '').toUpperCase())
    ? String(input.carrierCode).toUpperCase()
    : 'OTHER';
  const containerType = input?.containerType === '20GP' ? '20GP' : '40HC';
  const confidenceScore = Math.min(100, Math.max(0, Number(input?.confidenceScore) || 0));
  if (!input?.edoNumber || !input?.returnDepot || !input?.expiryDate) {
    throw new Error('Kết quả AI còn thiếu mã eDO/Booking, depot hoặc hạn hiệu lực.');
  }
  return {
    containerNumber,
    carrierCode,
    edoNumber: String(input.edoNumber),
    returnDepot: String(input.returnDepot),
    expiryDate: String(input.expiryDate),
    consignee: String(input.consignee || ''),
    containerType,
    sealNumber: input.sealNumber ? String(input.sealNumber) : undefined,
    confidenceScore,
    source: 'AI_API',
  };
}

export async function extractEdoWithAI(file: File): Promise<{ success: boolean; data?: ExtractedEdoData; error?: string }> {
  if (!isApiConfigured) {
    return { success: false, error: 'Chưa cấu hình ECont API OCR. Có thể chọn chứng từ mẫu để xem demo.' };
  }
  try {
    const { mimeType, data } = await fileToBase64(file);
    const response = await postApi<any>('/api/ai/edo/scan', {
      fileName: file.name,
      mimeType,
      base64Data: data,
      requestedFields: ['containerNumber', 'carrierCode', 'edoNumber', 'returnDepot', 'expiryDate', 'consignee', 'containerType', 'sealNumber'],
    });
    return { success: true, data: normalizeEdoData(response?.data || response) };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Không thể hoàn tất OCR chứng từ.' };
  }
}

export async function inspectContainerWithAI(photos: string[]): Promise<AiInspectionResult> {
  if (photos.length === 0) {
    return { success: false, status: 'ERROR', requiresOpsReview: true, error: 'Cần tải ảnh container trước khi quét.' };
  }
  if (!isApiConfigured) {
    return {
      success: true,
      status: 'ANOMALY',
      score: undefined,
      condition: 'MINOR_DAMAGE',
      summary: 'Chưa kết nối AI API; chuyển Ops kiểm tra thủ công trước khi công bố Offer.',
      details: ['Kết quả chưa được tự động xác minh', 'Cần Ops đối chiếu đủ 6 góc ảnh và tình trạng thực tế'],
      requiresOpsReview: true,
    };
  }
  try {
    const response = await postApi<any>('/api/ai/container/inspect', { photos });
    const result = response?.data || response;
    const requiresOpsReview = Boolean(result?.requiresOpsReview) || Number(result?.score) < 85 || result?.condition === 'MAJOR_DAMAGE';
    return {
      success: true,
      status: requiresOpsReview ? 'ANOMALY' : 'CLEAN',
      score: Number.isFinite(Number(result?.score)) ? Number(result.score) : undefined,
      condition: result?.condition || 'GOOD',
      summary: String(result?.summary || 'Đã hoàn tất phân tích ảnh.'),
      details: Array.isArray(result?.details) ? result.details.map(String) : [],
      requiresOpsReview,
    };
  } catch (error: any) {
    return { success: false, status: 'ERROR', requiresOpsReview: true, error: error?.message || 'Không thể hoàn tất kiểm tra ảnh.' };
  }
}

/**
 * Đối chiếu ảnh cont với thông tin A khai báo trước khi lưu tài sản.
 * API production cần trả về matchesRegistration=false khi nhận diện sai số cont,
 * loại cont, hãng tàu hoặc tình trạng thực tế khác với khai báo.
 */
export async function verifyContainerPhotosWithAI(
  photos: string[],
  expected: {
    containerNumber: string;
    containerType: ContainerType;
    carrierCode: string;
    declaredCondition: 'GOOD' | 'MINOR_DAMAGE' | 'MAJOR_DAMAGE';
  },
): Promise<ContainerPhotoVerificationResult> {
  if (photos.length < 6) {
    return {
      success: false,
      status: 'ERROR',
      matchesRegistration: false,
      mismatchDetails: ['Cần tối thiểu 6 ảnh container trước khi đối chiếu AI.'],
      summary: 'Bộ ảnh chưa đủ 6 góc bắt buộc.',
      requiresOpsReview: true,
      error: 'Cần tải tối thiểu 6 ảnh container.',
    };
  }

  if (!isApiConfigured) {
    return {
      success: true,
      status: 'MANUAL_REVIEW',
      matchesRegistration: false,
      mismatchDetails: ['Chưa cấu hình ECont AI API để nhận diện số cont và tình trạng thực tế.'],
      summary: 'Ảnh đã nhận đủ; Ops phải kiểm tra thủ công trước khi Offer được publish.',
      requiresOpsReview: true,
    };
  }

  try {
    const response = await postApi<any>('/api/ai/container/verify', {
      photos,
      expected,
      checks: ['container_number', 'container_type', 'carrier', 'declared_condition', 'physical_damage'],
    });
    const result = response?.data || response;
    const actualContainerNumber = result?.actualContainerNumber || result?.detectedContainerNumber || result?.containerNumber
      ? String(result.actualContainerNumber || result.detectedContainerNumber || result.containerNumber).replace(/\s+/g, '').toUpperCase()
      : undefined;
    const detectedType = result?.actualContainerType || result?.detectedContainerType || result?.containerType;
    const actualContainerType = detectedType === '20GP' ? '20GP' : detectedType === '40HC' ? '40HC' : undefined;
    const actualCarrierCode = result?.actualCarrierCode || result?.detectedCarrierCode || result?.carrierCode
      ? String(result.actualCarrierCode || result.detectedCarrierCode || result.carrierCode).toUpperCase()
      : undefined;
    const detectedCondition = result?.actualCondition || result?.physicalCondition || result?.detectedCondition || result?.condition;
    const actualCondition = ['GOOD', 'MINOR_DAMAGE', 'MAJOR_DAMAGE'].includes(detectedCondition) ? detectedCondition as 'GOOD' | 'MINOR_DAMAGE' | 'MAJOR_DAMAGE' : undefined;
    const mismatchDetails = Array.isArray(result?.mismatchDetails)
      ? result.mismatchDetails.map(String)
      : Array.isArray(result?.mismatches)
        ? result.mismatches.map(String)
        : [];
    if (actualContainerNumber && actualContainerNumber !== expected.containerNumber.toUpperCase()) {
      mismatchDetails.push(`Ảnh nhận diện số cont ${actualContainerNumber}, khác số đăng ký ${expected.containerNumber.toUpperCase()}.`);
    }
    if (actualContainerType && actualContainerType !== expected.containerType) {
      mismatchDetails.push(`Ảnh nhận diện loại cont ${actualContainerType}, khác loại đăng ký ${expected.containerType}.`);
    }
    if (actualCarrierCode && actualCarrierCode !== expected.carrierCode.toUpperCase()) {
      mismatchDetails.push(`Ảnh nhận diện hãng ${actualCarrierCode}, khác hãng đăng ký ${expected.carrierCode.toUpperCase()}.`);
    }
    if (actualCondition && actualCondition !== expected.declaredCondition) {
      mismatchDetails.push(`Tình trạng thực tế trên ảnh là ${actualCondition}, khác tình trạng khai báo ${expected.declaredCondition}.`);
    }
    if (result?.matchesRegistration === false || result?.identityMatch === false) {
      mismatchDetails.push(String(result?.summary || 'AI xác định ảnh không khớp với thông tin đăng ký.'));
    }
    const matchesRegistration = mismatchDetails.length === 0 && (
      result?.matchesRegistration === true
      || result?.identityMatch === true
      || result?.matchesRegistration === undefined
    );
    const status = matchesRegistration ? 'MATCHED' : 'MISMATCH';

    return {
      success: true,
      status,
      matchesRegistration,
      score: Number.isFinite(Number(result?.score)) ? Number(result.score) : undefined,
      actualContainerNumber,
      actualContainerType,
      actualCarrierCode,
      actualCondition,
      mismatchDetails,
      summary: String(result?.summary || (matchesRegistration ? 'Ảnh khớp với thông tin container đã đăng ký.' : 'Ảnh không khớp với thông tin container đã đăng ký.')),
      requiresOpsReview: Boolean(result?.requiresOpsReview) || !matchesRegistration,
    };
  } catch (error: any) {
    return {
      success: false,
      status: 'ERROR',
      matchesRegistration: false,
      mismatchDetails: [],
      summary: 'Không thể hoàn tất đối chiếu ảnh bằng AI.',
      requiresOpsReview: true,
      error: error?.message || 'Không thể kết nối dịch vụ AI đối chiếu ảnh.',
    };
  }
}
