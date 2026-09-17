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
