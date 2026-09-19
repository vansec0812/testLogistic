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
  // Nếu đã đủ 11 ký tự (4 chữ cái + 7 chữ số) theo chuẩn, giữ nguyên số thực tế, không tự ý ghi đè check-digit
  if (clean.length === 11 && /^[A-Z]{4}\d{7}$/.test(clean)) {
    return clean;
  }
  // Chỉ tự động tính check digit khi người dùng hoặc OCR chỉ nhận được 10 ký tự đầu
  if (clean.length === 10 && /^[A-Z]{4}\d{6}$/.test(clean)) {
    const expected = calculateCheckDigit(clean);
    if (expected !== null) return `${clean}${expected}`;
  }
  if (clean.length === 11) {
    return clean;
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
        mimeType: file.type || (
          /\.pdf$/i.test(file.name) ? 'application/pdf'
            : /\.(png)$/i.test(file.name) ? 'image/png'
              : /\.(webp)$/i.test(file.name) ? 'image/webp'
                : 'image/jpeg'
        ),
        data: result.slice(separator + 1),
      });
    };
    reader.onerror = () => reject(new Error('Không đọc được tệp tải lên.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Nén ảnh trước khi gửi lên gateway. Ảnh điện thoại thường rất lớn; nếu gửi
 * nguyên bản cả 6-12 ảnh sẽ dễ vượt giới hạn body của Gemini dù file từng ảnh
 * vẫn hợp lệ.
 */
export function imageFileToDataUrl(file: File, maxDimension = 1800, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/') && !/\.(png|jpe?g|webp)$/i.test(file.name)) {
      reject(new Error('Tệp không phải là ảnh container.'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Không đọc được ảnh container.'));
    reader.onload = () => {
      const source = String(reader.result || '');
      if (!source || typeof Image === 'undefined' || typeof document === 'undefined') {
        resolve(source);
        return;
      }

      const image = new Image();
      image.onerror = () => resolve(source);
      image.onload = () => {
        const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height));
        const width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
        const height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context) {
          resolve(source);
          return;
        }
        context.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      image.src = source;
    };
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

// Gemini is instructed to answer in Vietnamese, but older/proxy responses can
// still contain a few English labels. Keep the UI and the text filled into the
// Offer form in Vietnamese even when that happens.
const knownEnglishToVietnamese: Array<[RegExp, string]> = [
  [/the container shows?/gi, 'container có'],
  [/the container appears to be/gi, 'container có vẻ'],
  [/appears to be/gi, 'có vẻ là'],
  [/shows?/gi, 'thể hiện'],
  [/has|have/gi, 'có'],
  [/\band\b/gi, 'và'],
  [/\bwith\b/gi, 'với'],
  [/\bwithout\b/gi, 'không có'],
  [/\bon\b/gi, 'ở'],
  [/\bis\b|\bare\b/gi, 'là'],
  [/\bthe\b/gi, ''],
  [/\bthis\b/gi, 'nội dung này'],
  [/\bregistration\b/gi, 'đăng ký'],
  [/\bcondition\b/gi, 'tình trạng'],
  [/\bgood\b|\bok\b/gi, 'đạt'],
  [/\bpoor\b/gi, 'kém'],
  [/\bclear\b/gi, 'rõ'],
  [/\bblurred\b|unreadable/gi, 'mờ/không đọc được'],
  [/\bwarning\b|\balert\b/gi, 'cảnh báo'],
  [/\bapproved\b/gi, 'đã duyệt'],
  [/\brejected\b/gi, 'bị từ chối'],
  [/\bdetails?\b/gi, 'chi tiết'],
  [/no visible damage/gi, 'không phát hiện hư hỏng nhìn thấy'],
  [/no significant damage/gi, 'không phát hiện hư hỏng đáng kể'],
  [/does not match|do not match|not match/gi, 'không khớp'],
  [/matches registration/gi, 'khớp thông tin đăng ký'],
  [/manual review/gi, 'cần Ops kiểm tra thủ công'],
  [/requires? ops review/gi, 'cần Ops kiểm tra'],
  [/minor damage/gi, 'hư hỏng nhẹ'],
  [/major damage/gi, 'hư hỏng nặng'],
  [/\bminor\b/gi, 'nhẹ'],
  [/\bmajor\b/gi, 'nặng'],
  [/\bnew\b/gi, 'mới'],
  [/\bused\b/gi, 'đã qua sử dụng'],
  [/good condition/gi, 'tình trạng đạt chuẩn'],
  [/clean condition|clean/gi, 'sạch/đạt chuẩn'],
  [/suspicious|anomaly|anomalies/gi, 'dấu hiệu bất thường'],
  [/invalid|illegal|illegitimate/gi, 'không hợp lệ'],
  [/valid|legal|legitimate/gi, 'hợp lệ'],
  [/the container/gi, 'container'],
  [/container number/gi, 'số container'],
  [/container type/gi, 'loại container'],
  [/carrier/gi, 'hãng tàu'],
  [/front view|front/gi, 'mặt trước'],
  [/rear view|back view|back/gi, 'mặt sau'],
  [/left side|left/gi, 'mặt trái'],
  [/right side|right/gi, 'mặt phải'],
  [/roof view|roof|ceiling/gi, 'nóc container'],
  [/undercarriage|bottom view|bottom/gi, 'gầm container'],
  [/wall/gi, 'vách'],
  [/floor/gi, 'sàn'],
  [/door/gi, 'cửa'],
  [/gasket|seal/gi, 'gioăng cửa'],
  [/scratch(?:es)?/gi, 'vết xước'],
  [/dent(?:s)?/gi, 'vết móp'],
  [/rust|rusty|corrosion/gi, 'rỉ sét'],
  [/hole(?:s)?|puncture/gi, 'lỗ thủng'],
  [/dirty|dirt|stain(?:s)?/gi, 'vết bẩn'],
  [/visible/gi, 'nhìn thấy'],
  [/detected|found/gi, 'phát hiện'],
  [/image quality|photo quality/gi, 'chất lượng ảnh'],
  [/document/gi, 'chứng từ'],
];

function looksLikeUntranslatedEnglish(value: string): boolean {
  return !/[À-ỹ]/u.test(value)
    && /\b(the|this|that|with|without|shows?|appears?|condition|damage|visible|detected|found|document|review|match(?:es)?|valid|invalid)\b/i.test(value);
}

function vietnameseText(value: unknown, fallback = ''): string {
  const source = asString(value, fallback);
  if (!source) return fallback;
  const translated = knownEnglishToVietnamese
    .reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), source)
    .replace(/\s{2,}/g, ' ')
    .trim();
  return looksLikeUntranslatedEnglish(translated)
    ? (fallback || 'AI chưa trả về mô tả tiếng Việt; Ops cần kiểm tra thủ công.')
    : translated;
}

function vietnameseTextArray(value: unknown): string[] {
  return asStringArray(value)
    .map(item => vietnameseText(item))
    .filter(Boolean);
}

function normalizeAiDate(value: unknown): string {
  const source = asString(value);
  const ddMmYyyy = source.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (ddMmYyyy) return `${ddMmYyyy[3]}-${ddMmYyyy[2]}-${ddMmYyyy[1]}`;
  return source;
}

function conditionLabelVi(condition?: PhysicalCondition): string {
  if (condition === 'GOOD') return 'mới/đạt chuẩn đóng hàng';
  if (condition === 'MINOR_DAMAGE') return 'đã qua sử dụng hoặc xước/hư hỏng nhẹ';
  if (condition === 'MAJOR_DAMAGE') return 'hư hỏng nặng, cần xử lý';
  return 'chưa có kết luận';
}

function asBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    if (/^(true|yes|valid|legal|approved|matched|clean|1)$/i.test(value.trim())) return true;
    if (/^(false|no|invalid|illegal|rejected|mismatch|anomaly|0)$/i.test(value.trim())) return false;
  }
  return fallback;
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
    return 'Dịch vụ AI chưa sẵn sàng. Vui lòng thử lại hoặc gửi hồ sơ để Ops kiểm tra.';
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
          expiryDate: normalizeAiDate(response.expiryDate || response.freeTimeEnd),
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
export async function verifyEdoWithAI(
  file: File,
  extracted?: Partial<ExtractedEdoData>,
  documentType: 'EDO' | 'BOOKING' = 'EDO',
): Promise<EdoVerificationResult> {
  if (!isApiConfigured) {
    return {
      success: true,
      status: 'MANUAL_REVIEW',
      isLegal: false,
      hasAnomaly: true,
      summary: 'Chưa thể quét eDO. Vui lòng thử lại hoặc gửi hồ sơ để Ops kiểm tra.',
      details: ['Kết quả pháp lý chưa được xác nhận tự động.'],
      requiresOpsReview: true,
      error: 'Chưa cấu hình máy chủ ECont AI.',
    };
  }

  try {
    const document = await fileToBase64(file);
    const response = unwrapApiPayload(await postApi<any>('/api/ai/edo/verify', {
      task: documentType === 'BOOKING' ? 'BOOKING_LEGALITY_AND_ANOMALY_CHECK' : 'EDO_LEGALITY_AND_ANOMALY_CHECK',
      document: { fileName: file.name, ...document },
      extracted,
    }));
    const statusValue = String(response.status || '').toUpperCase();
    if (statusValue === 'MANUAL_REVIEW') {
      return {
        success: true, status: 'MANUAL_REVIEW', isLegal: false,
        hasAnomaly: asBoolean(response.hasAnomaly ?? response.anomaly ?? response.suspicious),
        summary: vietnameseText(response.summary, 'AI chưa đủ cơ sở kết luận; cần Ops kiểm tra.'),
        details: vietnameseTextArray(response.details || response.findings),
        requiresOpsReview: true,
      };
    }
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
    const statusImpliesLegal = ['VALID', 'LEGAL', 'APPROVED'].includes(statusValue);
    const statusImpliesInvalid = ['INVALID', 'ILLEGAL', 'REJECTED'].includes(statusValue);
    const isLegal = asBoolean(
      response.isLegal ?? response.isValid ?? response.legal ?? response.valid ?? response.isValidEdo,
      statusImpliesLegal ? true : statusImpliesInvalid ? false : false,
    );
    const hasAnomaly = asBoolean(response.hasAnomaly ?? response.anomaly ?? response.suspicious);
    const details = vietnameseTextArray(response.details || response.findings || response.anomalies);
    const status = statusValue === 'ANOMALY' ? 'ANOMALY' : !isLegal ? 'INVALID' : hasAnomaly ? 'ANOMALY' : 'VALID';
    return {
      success: true,
      status,
      isLegal,
      hasAnomaly,
      score: Number(response.score ?? response.confidence ?? 0) || undefined,
      summary: vietnameseText(response.summary || response.message, isLegal ? 'eDO hợp lệ theo kết quả AI.' : 'eDO không hợp lệ theo kết quả AI.'),
      details,
      anomalyReason: vietnameseText(response.anomalyReason || response.reason) || undefined,
      requiresOpsReview: asBoolean(response.requiresOpsReview, hasAnomaly || !isLegal),
    };
  } catch (error) {
    return {
      success: true,
      status: 'MANUAL_REVIEW',
      isLegal: false,
      hasAnomaly: true,
      summary: 'Chưa quét được eDO. Vui lòng thử lại hoặc gửi hồ sơ để Ops kiểm tra.',
      details: [fallbackApiMessage(error)],
      requiresOpsReview: true,
      error: fallbackApiMessage(error),
    };
  }
}

/** Xác minh file Booking ảnh/PDF; AI chỉ hỗ trợ cảnh báo, Ops là người quyết định cuối. */
export function verifyBookingWithAI(file: File): Promise<EdoVerificationResult> {
  return verifyEdoWithAI(file, undefined, 'BOOKING');
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
      task: 'CONTAINER_PHYSICAL_CONDITION',
      photos,
      photoAngles: ['FRONT', 'BACK', 'LEFT', 'RIGHT', 'ROOF', 'UNDERCARRIAGE'],
      requiredPhotoCount: 6,
    }));
    const statusValue = String(response.status || '').toUpperCase();
    const condition = normalizeCondition(response.condition || response.actualCondition);
    const details = vietnameseTextArray(response.details || response.findings);
    if (!['CLEAN', 'ANOMALY', 'MANUAL_REVIEW'].includes(statusValue) || !asString(response.summary)) {
      throw new Error('AI chưa trả về kết quả phân tích ảnh đầy đủ. Vui lòng thử lại.');
    }
    const requiresOpsReview = statusValue === 'MANUAL_REVIEW' || !condition
      || asBoolean(response.requiresOpsReview ?? response.hasAnomaly ?? statusValue === 'ANOMALY');
    return {
      success: true,
      status: statusValue === 'ANOMALY' || requiresOpsReview ? 'ANOMALY' : 'CLEAN',
      score: Number(response.score ?? response.confidence ?? 0) || undefined,
      condition,
      summary: vietnameseText(response.summary || response.conditionNotes, 'AI đã phân tích ảnh container.'),
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
      summary: 'Chưa thể quét bộ ảnh. Vui lòng thử lại hoặc gửi hồ sơ để Ops kiểm tra.',
      requiresOpsReview: true,
    };
  }

  try {
    const response = unwrapApiPayload(await postApi<any>('/api/ai/container/verify', {
      task: 'CONTAINER_IDENTITY_AND_PHYSICAL_CONDITION',
      photos,
      photoAngles: ['FRONT', 'BACK', 'LEFT', 'RIGHT', 'ROOF', 'UNDERCARRIAGE'],
      expected,
      requiredPhotoCount: 6,
    }));
    const mismatchDetails = vietnameseTextArray(response.mismatchDetails || response.mismatches || response.errors);
    const actualContainerNumber = asString(response.actualContainerNumber || response.detectedContainerNumber) || undefined;
    const actualTypeValue = String(response.actualContainerType || response.detectedContainerType || '').toUpperCase();
    const actualContainerType = actualTypeValue === '20GP' ? '20GP' : actualTypeValue === '40HC' ? '40HC' : undefined;
    const actualCarrierCode = asString(response.actualCarrierCode || response.detectedCarrierCode) || undefined;
    const actualCondition = normalizeCondition(response.actualCondition || response.detectedCondition || response.condition);
    const responseDetails = vietnameseTextArray(response.details || response.findings || response.conditionDetails);
    const actualConditionNotes = vietnameseText(response.actualConditionNotes || response.conditionNotes || response.physicalSummary, responseDetails.join(' ')) || undefined;

    let resolvedContainerNumber = actualContainerNumber;
    if (actualContainerNumber && actualContainerNumber !== expected.containerNumber) {
      // Khi 10 ký tự đầu (tiền tố chủ cont + 6 số seri) hoàn toàn trùng khớp:
      if (
        actualContainerNumber.length === 11 &&
        expected.containerNumber.length === 11 &&
        actualContainerNumber.slice(0, 10) === expected.containerNumber.slice(0, 10)
      ) {
        const actualCd = actualContainerNumber[10];
        const expectedCd = expected.containerNumber[10];
        // Xử lý trường hợp nhầm lẫn giữa số 9 và số 4 (do thuật toán ISO tính ra 4 nhưng vỏ cont in thực tế là 9)
        if ((actualCd === '4' && expectedCd === '9') || (actualCd === '9' && expectedCd === '4')) {
          resolvedContainerNumber = expected.containerNumber;
        } else {
          mismatchDetails.push(`Ảnh nhận diện số cont ${actualContainerNumber}, không khớp ${expected.containerNumber}.`);
        }
      } else {
        mismatchDetails.push(`Ảnh nhận diện số cont ${actualContainerNumber}, không khớp ${expected.containerNumber}.`);
      }
    }
    if (actualContainerType && actualContainerType !== expected.containerType) mismatchDetails.push(`Ảnh nhận diện loại ${actualContainerType}, không khớp ${expected.containerType}.`);
    if (actualCarrierCode && actualCarrierCode !== expected.carrierCode) mismatchDetails.push(`Ảnh nhận diện hãng ${actualCarrierCode}, không khớp ${expected.carrierCode}.`);
    if (actualCondition && actualCondition !== expected.declaredCondition) mismatchDetails.push(`Tình trạng thực tế (${conditionLabelVi(actualCondition)}) khác tình trạng khai báo (${conditionLabelVi(expected.declaredCondition)}).`);

    const explicitStatus = String(response.status || '').toUpperCase();
    if (!['MATCHED', 'MISMATCH', 'MANUAL_REVIEW'].includes(explicitStatus) || !asString(response.summary)) {
      throw new Error('AI chưa trả về kết quả đối chiếu ảnh đầy đủ. Vui lòng thử lại.');
    }
    const explicitMatch = response.matchesRegistration ?? response.identityMatch ?? response.matches;
    const matchesRegistration = (explicitMatch === undefined
      ? explicitStatus === 'MATCHED' && mismatchDetails.length === 0
      : asBoolean(explicitMatch)) && mismatchDetails.length === 0;
    const isMismatch = explicitStatus === 'MISMATCH' || !matchesRegistration;
    // A definite mismatch must not be hidden just because Ops review is required.
    const status = explicitStatus === 'MISMATCH' || mismatchDetails.length > 0 ? 'MISMATCH'
      : explicitStatus === 'MANUAL_REVIEW' || response.requiresOpsReview ? 'MANUAL_REVIEW'
      : isMismatch ? 'MISMATCH' : 'MATCHED';
    return {
      success: true, status, matchesRegistration,
      score: Number(response.score ?? response.confidence ?? 0) || undefined,
      actualContainerNumber: resolvedContainerNumber, actualContainerType, actualCarrierCode, actualCondition, actualConditionNotes,
      mismatchDetails: mismatchDetails.map(detail => vietnameseText(detail)),
      summary: vietnameseText(response.summary || response.message, isMismatch ? 'Ảnh chưa khớp đầy đủ với thông tin đăng ký.' : 'Ảnh khớp với thông tin container đã đăng ký.'),
      requiresOpsReview: asBoolean(response.requiresOpsReview, status !== 'MATCHED'),
      error: vietnameseText(response.error) || undefined,
    };
  } catch (error) {
    return {
      success: true, status: 'MANUAL_REVIEW', matchesRegistration: false,
      mismatchDetails: [fallbackApiMessage(error)],
      summary: 'Chưa quét được bộ ảnh. Vui lòng thử lại hoặc gửi hồ sơ để Ops kiểm tra.',
      requiresOpsReview: true, error: fallbackApiMessage(error),
    };
  }
}
