// ECont AI service
//
// Tất cả xử lý AI thật đi qua ECont API. Secret của nhà cung cấp AI chỉ được
// giữ ở backend; trình duyệt không nhận, lưu hoặc gửi API key trực tiếp.

import {
  CarrierCode,
  ContainerType,
  AiInspectionResult,
  PhysicalCondition,
} from "../types";
import { calculateCheckDigit, validateContainerNumber } from "./iso6346";
import { ApiClientError, isApiConfigured, postApi } from "./apiClient";
import {
  OFFER_PHOTO_ANGLE_LABELS,
  OFFER_PHOTO_ANGLES,
} from "./qaRules";

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
  source?: "BACKEND_API" | "DEMO_SAMPLE";
  verification?: EdoVerificationResult;
}

export interface EdoVerificationResult {
  success: boolean;
  status: "VALID" | "INVALID" | "ANOMALY" | "MANUAL_REVIEW" | "ERROR";
  isLegal: boolean;
  hasAnomaly: boolean;
  score?: number;
  summary: string;
  details: string[];
  anomalyReason?: string;
  requiresOpsReview: boolean;
  error?: string;
  documentVerification?: EdoVerificationResult;
  documentType?: "EDO" | "BOOKING" | "OTHER" | "UNKNOWN";
  matchesRegistration?: boolean;
  comparisonStatus?: "MATCHED" | "MISMATCH" | "PENDING";
  actualContainerNumber?: string;
  actualCarrierCode?: string;
  actualContainerType?: string;
  mismatchDetails?: string[];
  mismatchedFields?: Array<
    "CONTAINER_NUMBER" | "CARRIER_CODE" | "CONTAINER_TYPE"
  >;
  sourceReportedMismatch?: boolean;
  sourceMismatchDetails?: string[];
}

export interface EdoRegistrationData {
  containerNumber?: string;
  carrierCode?: CarrierCode;
  containerType?: ContainerType;
}

export interface BookingRegistrationData {
  bookingNumber?: string;
  carrierCode?: string;
  containerType?: string;
  cutOffTime?: string;
}

export interface BookingVerificationResult extends Omit<
  EdoVerificationResult,
  "mismatchedFields"
> {
  actualBookingNumber?: string;
  actualCutOffDate?: string;
  mismatchedFields?: Array<
    "BOOKING_NUMBER" | "CARRIER_CODE" | "CONTAINER_TYPE" | "CUT_OFF_TIME"
  >;
}

export interface ContainerPhotoVerificationResult {
  success: boolean;
  status:
    | "MATCHED"
    | "MISMATCH"
    | "MANUAL_REVIEW"
    | "INSPECTION_INCOMPLETE"
    | "ERROR";
  matchesRegistration: boolean;
  score?: number;
  actualContainerNumber?: string;
  actualContainerType?: ContainerType;
  actualCarrierCode?: string;
  actualCondition?: PhysicalCondition;
  actualConditionNotes?: string;
  mismatchDetails: string[];
  missingAngles?: string[];
  summary: string;
  requiresOpsReview: boolean;
  error?: string;
}

/** Sinh số container ISO 6346 hợp lệ để dùng trong dữ liệu demo. */
export function generateValidIsoContainerNumber(prefix4 = "MSKU"): string {
  const pfx = prefix4.toUpperCase().slice(0, 4);
  const serial6 = Math.floor(100000 + Math.random() * 900000).toString();
  const first10 = `${pfx}${serial6}`;
  const checkDigit = calculateCheckDigit(first10) ?? 0;
  return `${first10}${checkDigit}`;
}

/** Chuẩn hóa số container ISO 6346. */
export function normalizeIsoContainerNumber(
  raw: string,
  carrier: CarrierCode = "MAERSK",
): string {
  const clean = (raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
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
    MAERSK: "MSKU",
    CMA_CGM: "CMAU",
    ONE: "ONEY",
    COSCO: "COSU",
    EVERGREEN: "EMCU",
    MSC: "MSCU",
    HAPAG_LLOYD: "HLCU",
    OTHER: "TCKU",
  };
  return generateValidIsoContainerNumber(prefixes[carrier] || "TCKU");
}

/** Chuyển đổi File sang Base64 để gửi qua ECont API. */
export function fileToBase64(
  file: File,
): Promise<{ mimeType: string; data: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const separator = result.indexOf(",");
      if (separator < 0)
        return reject(new Error("Không đọc được nội dung tệp."));
      resolve({
        mimeType:
          file.type ||
          (/\.pdf$/i.test(file.name)
            ? "application/pdf"
            : /\.(png)$/i.test(file.name)
              ? "image/png"
              : /\.(webp)$/i.test(file.name)
                ? "image/webp"
                : "image/jpeg"),
        data: result.slice(separator + 1),
      });
    };
    reader.onerror = () => reject(new Error("Không đọc được tệp tải lên."));
    reader.readAsDataURL(file);
  });
}

const MAX_AI_DOCUMENT_BASE64_CHARS = 3_600_000;
const MAX_AI_PHOTO_BASE64_CHARS = 3_600_000;

function assertAiDocumentSize(document: { data: string }): void {
  if (document.data.length > MAX_AI_DOCUMENT_BASE64_CHARS) {
    throw new Error(
      "Tệp quá lớn cho phiên quét AI trên Vercel. Vui lòng nén tệp xuống khoảng 2,5 MB rồi thử lại.",
    );
  }
}

function assertAiPhotoSize(photos: string[]): void {
  const encodedChars = photos.reduce((total, photo) => {
    const separator = photo.indexOf(",");
    return (
      total + (separator >= 0 ? photo.length - separator - 1 : photo.length)
    );
  }, 0);
  if (encodedChars > MAX_AI_PHOTO_BASE64_CHARS) {
    throw new Error(
      "Tổng dung lượng bộ ảnh quá lớn cho phiên quét AI trên Vercel. Vui lòng chọn ảnh nhẹ hơn.",
    );
  }
}

async function fileToAiDocument(
  file: File,
): Promise<{ mimeType: string; data: string }> {
  if (
    file.type.startsWith("image/") ||
    /\.(png|jpe?g|webp)$/i.test(file.name)
  ) {
    const dataUrl = await imageFileToDataUrl(file);
    const separator = dataUrl.indexOf(",");
    if (separator >= 0) {
      const mimeType = dataUrl.slice(5, dataUrl.indexOf(";")) || "image/jpeg";
      const document = { mimeType, data: dataUrl.slice(separator + 1) };
      assertAiDocumentSize(document);
      return document;
    }
  }
  const document = await fileToBase64(file);
  assertAiDocumentSize(document);
  return document;
}

/**
 * Nén ảnh trước khi gửi lên gateway. Ảnh điện thoại thường rất lớn; nếu gửi
 * nguyên bản cả 6-12 ảnh sẽ dễ vượt giới hạn body của Gemini dù file từng ảnh
 * vẫn hợp lệ.
 */
export function imageFileToDataUrl(
  file: File,
  maxDimension = 1400,
  quality = 0.75,
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (
      !file.type.startsWith("image/") &&
      !/\.(png|jpe?g|webp)$/i.test(file.name)
    ) {
      reject(new Error("Tệp không phải là ảnh container."));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Không đọc được ảnh container."));
    reader.onload = () => {
      const source = String(reader.result || "");
      if (
        !source ||
        typeof Image === "undefined" ||
        typeof document === "undefined"
      ) {
        resolve(source);
        return;
      }

      const image = new Image();
      image.onerror = () =>
        reject(
          new Error(
            "Không mở được ảnh. Vui lòng chọn ảnh JPEG, PNG hoặc WebP hợp lệ.",
          ),
        );
      image.onload = () => {
        const originalWidth = image.naturalWidth || image.width;
        const originalHeight = image.naturalHeight || image.height;
        if (
          Math.min(originalWidth, originalHeight) < 160 ||
          Math.max(originalWidth, originalHeight) < 320
        ) {
          reject(
            new Error(
              "Ảnh có độ phân giải quá thấp. Vui lòng tải ảnh gốc rõ nét.",
            ),
          );
          return;
        }
        const scale = Math.min(
          1,
          maxDimension /
            Math.max(
              image.naturalWidth || image.width,
              image.naturalHeight || image.height,
            ),
        );
        const width = Math.max(
          1,
          Math.round((image.naturalWidth || image.width) * scale),
        );
        const height = Math.max(
          1,
          Math.round((image.naturalHeight || image.height) * scale),
        );
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        if (!context) {
          resolve(source);
          return;
        }
        context.drawImage(image, 0, 0, width, height);
        // Validate a small sample so a blank image never gets a fabricated OCR verdict.
        const sample = document.createElement("canvas");
        sample.width = 64;
        sample.height = 64;
        const sampleContext = sample.getContext("2d");
        if (sampleContext) {
          sampleContext.drawImage(image, 0, 0, 64, 64);
          if (
            isBlankImagePixels(sampleContext.getImageData(0, 0, 64, 64).data)
          ) {
            reject(
              new Error(
                "Ảnh trống hoặc không thấy nội dung. Vui lòng tải lại ảnh rõ nét.",
              ),
            );
            return;
          }
        }
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      image.src = source;
    };
    reader.readAsDataURL(file);
  });
}

function unwrapApiPayload(payload: any): any {
  return (
    payload?.data || payload?.result || payload?.verification || payload || {}
  );
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || "").trim()).filter(Boolean);
}

// Gemini is instructed to answer in Vietnamese, but older/proxy responses can
// still contain a few English labels. Keep the UI and the text filled into the
// Offer form in Vietnamese even when that happens.
const knownEnglishToVietnamese: Array<[RegExp, string]> = [
  [/the container shows?/gi, "container có"],
  [/the container appears to be/gi, "container có vẻ"],
  [/appears to be/gi, "có vẻ là"],
  [/shows?/gi, "thể hiện"],
  [/has|have/gi, "có"],
  [/\band\b/gi, "và"],
  [/\bwith\b/gi, "với"],
  [/\bwithout\b/gi, "không có"],
  [/\bon\b/gi, "ở"],
  [/\bis\b|\bare\b/gi, "là"],
  [/\bthe\b/gi, ""],
  [/\bthis\b/gi, "nội dung này"],
  [/\bregistration\b/gi, "đăng ký"],
  [/\bcondition\b/gi, "tình trạng"],
  [/\bgood\b|\bok\b/gi, "đạt"],
  [/\bpoor\b/gi, "kém"],
  [/\bclear\b/gi, "rõ"],
  [/\bblurred\b|unreadable/gi, "mờ/không đọc được"],
  [/\bwarning\b|\balert\b/gi, "cảnh báo"],
  [/\bapproved\b/gi, "đã duyệt"],
  [/\brejected\b/gi, "bị từ chối"],
  [/\bdetails?\b/gi, "chi tiết"],
  [/no visible damage/gi, "không phát hiện hư hỏng nhìn thấy"],
  [/no significant damage/gi, "không phát hiện hư hỏng đáng kể"],
  [/does not match|do not match|not match/gi, "không khớp"],
  [/matches registration/gi, "khớp thông tin đăng ký"],
  [/manual review/gi, "cần Ops kiểm tra thủ công"],
  [/requires? ops review/gi, "cần Ops kiểm tra"],
  [/minor damage/gi, "hư hỏng nhẹ"],
  [/major damage/gi, "hư hỏng nặng"],
  [/\bminor\b/gi, "nhẹ"],
  [/\bmajor\b/gi, "nặng"],
  [/\bnew\b/gi, "mới"],
  [/\bused\b/gi, "đã qua sử dụng"],
  [/good condition/gi, "tình trạng đạt chuẩn"],
  [/clean condition|clean/gi, "sạch/đạt chuẩn"],
  [/suspicious|anomaly|anomalies/gi, "dấu hiệu bất thường"],
  [/invalid|illegal|illegitimate/gi, "không hợp lệ"],
  [/valid|legal|legitimate/gi, "hợp lệ"],
  [/the container/gi, "container"],
  [/container number/gi, "số container"],
  [/container type/gi, "loại container"],
  [/carrier/gi, "hãng tàu"],
  [/front view|front/gi, "mặt trước"],
  [/rear view|back view|back/gi, "mặt sau"],
  [/left side|left/gi, "mặt trái"],
  [/right side|right/gi, "mặt phải"],
  [/roof view|roof|ceiling/gi, "nóc container"],
  [/undercarriage|bottom view|bottom/gi, "gầm container"],
  [/wall/gi, "vách"],
  [/floor/gi, "sàn"],
  [/door/gi, "cửa"],
  [/gasket|seal/gi, "gioăng cửa"],
  [/scratch(?:es)?/gi, "vết xước"],
  [/dent(?:s)?/gi, "vết móp"],
  [/rust|rusty|corrosion/gi, "rỉ sét"],
  [/hole(?:s)?|puncture/gi, "lỗ thủng"],
  [/dirty|dirt|stain(?:s)?/gi, "vết bẩn"],
  [/visible/gi, "nhìn thấy"],
  [/detected|found/gi, "phát hiện"],
  [/image quality|photo quality/gi, "chất lượng ảnh"],
  [/document/gi, "chứng từ"],
];

function looksLikeUntranslatedEnglish(value: string): boolean {
  return (
    !/[À-ỹ]/u.test(value) &&
    /\b(the|this|that|with|without|shows?|appears?|condition|damage|visible|detected|found|document|review|match(?:es)?|valid|invalid)\b/i.test(
      value,
    )
  );
}

function vietnameseText(value: unknown, fallback = ""): string {
  const source = asString(value, fallback);
  if (!source) return fallback;
  const translated = knownEnglishToVietnamese
    .reduce(
      (text, [pattern, replacement]) => text.replace(pattern, replacement),
      source,
    )
    .replace(/\s{2,}/g, " ")
    .trim();
  return looksLikeUntranslatedEnglish(translated)
    ? fallback || "AI chưa trả về mô tả tiếng Việt; Ops cần kiểm tra thủ công."
    : translated;
}

function vietnameseTextArray(value: unknown): string[] {
  return asStringArray(value)
    .map((item) => vietnameseText(item))
    .filter(Boolean);
}

function normalizeAiDate(value: unknown): string {
  const source = asString(value);
  const ddMmYyyy = source.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (ddMmYyyy) return `${ddMmYyyy[3]}-${ddMmYyyy[2]}-${ddMmYyyy[1]}`;
  return source;
}

function conditionLabelVi(condition?: PhysicalCondition): string {
  if (condition === "GOOD") return "mới/đạt chuẩn đóng hàng";
  if (condition === "MINOR_DAMAGE")
    return "đã qua sử dụng hoặc xước/hư hỏng nhẹ";
  if (condition === "MAJOR_DAMAGE") return "hư hỏng nặng, cần xử lý";
  return "chưa có kết luận";
}

function asBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    if (/^(true|yes|valid|legal|approved|matched|clean|1)$/i.test(value.trim()))
      return true;
    if (
      /^(false|no|invalid|illegal|rejected|mismatch|anomaly|0)$/i.test(
        value.trim(),
      )
    )
      return false;
  }
  return fallback;
}

function normalizeCondition(value: unknown): PhysicalCondition | undefined {
  const normalized = String(value || "").toUpperCase();
  if (normalized === "GOOD" || normalized === "CLEAN" || normalized === "NEW")
    return "GOOD";
  if (
    normalized === "MINOR_DAMAGE" ||
    normalized === "MINOR" ||
    normalized === "USED"
  )
    return "MINOR_DAMAGE";
  if (
    normalized === "MAJOR_DAMAGE" ||
    normalized === "MAJOR" ||
    normalized === "DAMAGED"
  )
    return "MAJOR_DAMAGE";
  return undefined;
}

function fallbackApiMessage(error: unknown): string {
  const message =
    error instanceof ApiClientError
      ? error.message
      : error instanceof Error
        ? error.message
        : "Lỗi khi gọi dịch vụ AI.";
  if (
    /failed to fetch|networkerror|load failed|err_connection_refused|econnrefused|connection refused|proxy error/i.test(
      message,
    )
  ) {
    return "Dịch vụ AI chưa sẵn sàng. Vui lòng thử lại hoặc gửi hồ sơ để Ops kiểm tra.";
  }
  return message;
}

function mapDocumentVerificationResponse(
  response: any,
  label: string,
): EdoVerificationResult {
  const statusValue = String(response.status || "").toUpperCase();
  if (statusValue === "MANUAL_REVIEW") {
    return {
      success: true,
      status: "MANUAL_REVIEW",
      isLegal: false,
      hasAnomaly: asBoolean(
        response.hasAnomaly ?? response.anomaly ?? response.suspicious,
      ),
      summary: vietnameseText(
        response.summary,
        "AI chưa đủ cơ sở kết luận; cần Ops kiểm tra.",
      ),
      details: vietnameseTextArray(response.details || response.findings),
      requiresOpsReview: true,
    };
  }

  const hasLegalValue =
    typeof response.isLegal === "boolean" ||
    typeof response.isValid === "boolean" ||
    typeof response.legal === "boolean" ||
    typeof response.valid === "boolean" ||
    typeof response.isValidEdo === "boolean";
  if (!hasLegalValue) {
    return {
      success: true,
      status: "MANUAL_REVIEW",
      isLegal: false,
      hasAnomaly: true,
      summary:
        "API chưa trả về kết quả pháp lý rõ ràng; cần Ops xác minh thủ công.",
      details: ["Thiếu trường isLegal/isValid trong phản hồi API."],
      requiresOpsReview: true,
    };
  }

  const statusImpliesLegal = ["VALID", "LEGAL", "APPROVED"].includes(
    statusValue,
  );
  const statusImpliesInvalid = ["INVALID", "ILLEGAL", "REJECTED"].includes(
    statusValue,
  );
  const reportedLegal = asBoolean(
    response.isLegal ??
      response.isValid ??
      response.legal ??
      response.valid ??
      response.isValidEdo,
    statusImpliesLegal ? true : statusImpliesInvalid ? false : false,
  );
  const hasAnomaly = asBoolean(
    response.hasAnomaly ?? response.anomaly ?? response.suspicious,
  );
  const details = vietnameseTextArray(
    response.details || response.findings || response.anomalies,
  );
  const incompleteVerdict =
    typeof response.requiresOpsReview !== "boolean" ||
    typeof (response.hasAnomaly ?? response.anomaly ?? response.suspicious) !==
      "boolean" ||
    !asString(response.summary || response.message);
  if (incompleteVerdict)
    details.push(
      "Kết quả AI thiếu thông tin kết luận/cảnh báo; cần Ops kiểm tra.",
    );
  const providerNeedsReview =
    incompleteVerdict || asBoolean(response.requiresOpsReview);
  const conflictingVerdict =
    (statusImpliesInvalid && reportedLegal) ||
    (statusImpliesLegal && !reportedLegal);
  const status = statusImpliesInvalid
    ? "INVALID"
    : statusValue === "ANOMALY" || hasAnomaly
      ? "ANOMALY"
      : conflictingVerdict || providerNeedsReview
        ? "MANUAL_REVIEW"
        : reportedLegal
          ? "VALID"
          : "INVALID";
  const isLegal = status === "VALID";
  return {
    success: true,
    status,
    isLegal,
    hasAnomaly,
    score: Number(response.score ?? response.confidence ?? 0) || undefined,
    summary: vietnameseText(
      response.summary || response.message,
      isLegal
        ? `${label} hợp lệ theo kết quả AI.`
        : `${label} cần Ops xác minh.`,
    ),
    details,
    anomalyReason:
      vietnameseText(response.anomalyReason || response.reason) || undefined,
    requiresOpsReview: status !== "VALID",
  };
}

function normalizeBookingCarrier(value: unknown): string {
  const normalized = asString(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  if (!normalized) return "";
  if (normalized === "MSK" || normalized.startsWith("MAERSK")) return "MSK";
  if (normalized === "CMA" || normalized.startsWith("CMACGM")) return "CMA";
  if (
    normalized === "ONE" ||
    normalized === "ONELINE" ||
    normalized.includes("OCEANNETWORKEXPRESS")
  )
    return "ONE";
  if (normalized === "EMC" || normalized.startsWith("EVERGREEN")) return "EMC";
  if (normalized.startsWith("COSCO")) return "COSCO";
  return normalized;
}

function uniqueText(items: string[]): string[] {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
}

function normalizeEdoContainerNumber(value: unknown): string {
  return asString(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function normalizePhotoAngleToken(value: unknown): string {
  return asString(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeMissingPhotoAngles(value: unknown): string[] {
  const values = Array.isArray(value)
    ? value.flatMap((item) =>
        item && typeof item === "object"
          ? [
              (item as { angle?: unknown }).angle,
              (item as { name?: unknown }).name,
              (item as { view?: unknown }).view,
            ]
          : [item],
      )
    : typeof value === "string"
      ? value.split(/[,;|\n]+/)
      : [];
  const normalized = new Set(
    values.map(normalizePhotoAngleToken).filter(Boolean),
  );
  const aliases: Record<string, string[]> = {
    front: [
      "front",
      "front_view",
      "mat_truoc",
      "mat_truoc_container",
      "mat_vach_dau",
    ],
    back_door: [
      "back_door",
      "backdoor",
      "back_view",
      "rear",
      "rear_view",
      "cua_sau",
      "cua_sau_container",
      "mat_sau",
    ],
    left_side: [
      "left_side",
      "left",
      "left_view",
      "vach_trai",
      "vach_trai_container",
      "mat_trai",
    ],
    right_side: [
      "right_side",
      "right",
      "right_view",
      "vach_phai",
      "vach_phai_container",
      "mat_phai",
    ],
    inside: [
      "inside",
      "interior",
      "inside_container",
      "ben_trong",
      "ben_trong_container",
    ],
    floor: [
      "floor",
      "floor_view",
      "san",
      "san_container",
      "san_cont",
      "bottom",
      "bottom_view",
      "undercarriage",
    ],
    container_number_plate: [
      "container_number_plate",
      "container_plate",
      "number_plate",
      "csc_plate",
      "plate",
      "tem_so",
      "tem_so_container",
      "tem_so_container_csc_plate",
    ],
  };
  return OFFER_PHOTO_ANGLES.filter((angle) => {
    const angleAliases = aliases[angle] || [angle];
    return angleAliases.some((alias) =>
      [...normalized].some(
        (token) => token === alias || token.includes(alias) || alias.includes(token),
      ),
    );
  });
}

function missingPhotoAnglesMessage(missingAngles: string[]): string {
  const labels = missingAngles.map((angle) => {
    const index = OFFER_PHOTO_ANGLES.indexOf(
      angle as (typeof OFFER_PHOTO_ANGLES)[number],
    );
    return OFFER_PHOTO_ANGLE_LABELS[index] || angle;
  });
  return labels.length > 0
    ? `Thiếu góc ảnh bắt buộc: ${labels.join(", ")}. Vui lòng bổ sung đúng từng mặt.`
    : "";
}

function normalizeEdoContainerType(value: unknown): string {
  const source = asString(value).toUpperCase().trim();
  const normalized = source
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  if (
    ["40HC", "40HQ", "40HIGHCUBE", "40FT", "40FOOT"].some((alias) =>
      normalized.startsWith(alias),
    )
  )
    return "40HC";
  if (
    ["20GP", "20DC", "20DV", "20DRY", "20FT", "20FOOT"].some((alias) =>
      normalized.startsWith(alias),
    )
  )
    return "20GP";

  const has20Foot = /(^|[^0-9])20\s*(?:'|FT|FOOT)?\s*(?:GP|DC|DV|DRY)?(?=$|[^0-9])/.test(
    source,
  );
  const has40Foot = /(^|[^0-9])40\s*(?:'|FT|FOOT)?\s*(?:HC|HQ|HIGH\s*CUBE)?(?=$|[^0-9])/.test(
    source,
  );
  if (has20Foot !== has40Foot) return has20Foot ? "20GP" : "40HC";
  return normalized;
}

function compareEdoRegistration(
  base: EdoVerificationResult,
  response: any,
  expected?: EdoRegistrationData,
): EdoVerificationResult {
  const documentTypeValue = asString(response.documentType)
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
  const documentType = (
    ["EDO", "BOOKING", "OTHER"].includes(documentTypeValue)
      ? documentTypeValue
      : "UNKNOWN"
  ) as EdoVerificationResult["documentType"];
  const actualContainerNumber =
    asString(response.actualContainerNumber ?? response.containerNumber) ||
    undefined;
  const actualCarrierCode =
    asString(response.actualCarrierCode ?? response.carrierCode) || undefined;
  const actualContainerType =
    asString(response.actualContainerType ?? response.containerType) ||
    undefined;
  const sourceMismatchDetails = vietnameseTextArray(response.mismatchDetails);

  const observed = {
    documentVerification: base,
    documentType,
    actualContainerNumber,
    actualCarrierCode,
    actualContainerType,
    sourceReportedMismatch: response.matchesRegistration === false,
    sourceMismatchDetails,
  };
  const expectedNumber = normalizeEdoContainerNumber(expected?.containerNumber);
  const expectedCarrier = normalizeBookingCarrier(expected?.carrierCode);
  const expectedType = normalizeEdoContainerType(expected?.containerType);
  const actualNumber = normalizeEdoContainerNumber(actualContainerNumber);
  const actualCarrier = normalizeBookingCarrier(actualCarrierCode);
  const actualType = normalizeEdoContainerType(actualContainerType);
  const mismatchedFields: NonNullable<
    EdoVerificationResult["mismatchedFields"]
  > = [];
  const mismatchDetails = [...sourceMismatchDetails];
  if (expectedNumber && actualNumber && expectedNumber !== actualNumber) {
    mismatchedFields.push("CONTAINER_NUMBER");
    mismatchDetails.push(
      `Số container trên eDO (${actualContainerNumber}) không khớp số đã nhập (${expected?.containerNumber}).`,
    );
  }
  if (expectedCarrier && actualCarrier && expectedCarrier !== actualCarrier) {
    mismatchedFields.push("CARRIER_CODE");
    mismatchDetails.push(
      `Hãng tàu trên eDO (${actualCarrierCode}) không khớp hãng đã chọn (${expected?.carrierCode}).`,
    );
  }
  if (expectedType && actualType && expectedType !== actualType) {
    mismatchedFields.push("CONTAINER_TYPE");
    mismatchDetails.push(
      `Loại container trên eDO (${actualContainerType}) không khớp loại đã chọn (${expected?.containerType}).`,
    );
  }

  const missingExpected =
    Boolean(expected) && (!expectedNumber || !expectedCarrier || !expectedType);
  const missingObserved = !actualNumber || !actualCarrier || !actualType;
  const hasMismatch =
    mismatchedFields.length > 0 ||
    observed.sourceReportedMismatch ||
    sourceMismatchDetails.length > 0;
  const hasWrongDocument =
    documentType === "BOOKING" || documentType === "OTHER";
  const pending =
    !hasMismatch &&
    !hasWrongDocument &&
    (missingExpected || missingObserved || documentType !== "EDO");
  const details = uniqueText([
    ...base.details,
    ...mismatchDetails,
    hasWrongDocument ? "Tệp tải lên không được AI nhận diện là eDO." : "",
    missingExpected
      ? "Offer chưa có đủ số container, hãng tàu và loại container để đối chiếu eDO."
      : "",
    missingObserved
      ? "AI chưa đọc rõ số container, hãng tàu hoặc loại container trên eDO."
      : "",
    documentType === "UNKNOWN"
      ? "AI chưa xác định rõ loại chứng từ là eDO."
      : "",
  ]);
  const status =
    hasMismatch || hasWrongDocument
      ? "ANOMALY"
      : pending && base.status === "VALID"
        ? "MANUAL_REVIEW"
        : base.status;
  const summary = hasMismatch
    ? `Thông tin eDO không khớp thông tin đăng ký. ${mismatchDetails[0] || "Ops cần kiểm tra chứng từ gốc."}`
    : hasWrongDocument
      ? "Tệp tải lên không phải chứng từ eDO; cần Ops kiểm tra."
      : pending && base.status === "VALID"
        ? missingExpected
          ? "Cần nhập đủ thông tin Offer để đối chiếu eDO."
          : "AI chưa đọc đủ thông tin eDO để xác minh; cần Ops kiểm tra."
        : status === "VALID" && expected
          ? "File eDO hợp lệ theo kết quả AI và khớp thông tin Offer."
          : base.summary;

  return {
    ...base,
    ...observed,
    status,
    isLegal: status === "VALID",
    hasAnomaly: base.hasAnomaly || hasMismatch || hasWrongDocument,
    requiresOpsReview: status !== "VALID" || base.requiresOpsReview || pending,
    summary,
    details,
    matchesRegistration: expected
      ? hasMismatch
        ? false
        : pending
          ? undefined
          : !hasWrongDocument
      : undefined,
    comparisonStatus:
      hasMismatch || hasWrongDocument
        ? "MISMATCH"
        : pending || !expected
          ? "PENDING"
          : "MATCHED",
    mismatchDetails: uniqueText(mismatchDetails),
    mismatchedFields,
  };
}

/** Recompare the AI-read eDO when Offer identity fields change after upload. */
export function reconcileEdoVerificationResult(
  result: EdoVerificationResult,
  expected: EdoRegistrationData,
): EdoVerificationResult {
  return compareEdoRegistration(
    result.documentVerification || result,
    {
      documentType: result.documentType,
      actualContainerNumber: result.actualContainerNumber,
      actualCarrierCode: result.actualCarrierCode,
      actualContainerType: result.actualContainerType,
      matchesRegistration:
        result.sourceReportedMismatch === true ? false : undefined,
      mismatchDetails: result.sourceMismatchDetails,
    },
    expected,
  );
}

/** OCR eDO. API thật trả dữ liệu trích xuất; secret chỉ nằm ở backend. */
export async function extractEdoWithAI(
  file: File,
): Promise<{ success: boolean; data?: ExtractedEdoData; error?: string }> {
  try {
    if (isApiConfigured) {
      const document = await fileToAiDocument(file);
      const response = unwrapApiPayload(
        await postApi<any>("/api/ai/edo/scan", {
          task: "EDO_EXTRACTION",
          document: { fileName: file.name, ...document },
        }),
      );
      const rawCarrierCode = asString(response.carrierCode, "OTHER");
      const carrierCode = (normalizeBookingCarrier(rawCarrierCode) ||
        rawCarrierCode) as CarrierCode;
      const rawNumber = asString(response.containerNumber);
      if (!rawNumber)
        throw new Error("API không nhận diện được số container từ eDO.");
      const compactNumber = rawNumber.toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (!/^[A-Z]{4}\d{7}$/.test(compactNumber))
        throw new Error(
          "Số container AI trả về không đúng định dạng ISO 6346.",
        );
      return {
        success: true,
        data: {
          containerNumber: normalizeIsoContainerNumber(
            compactNumber,
            carrierCode,
          ),
          carrierCode,
          edoNumber: asString(response.edoNumber || response.bookingNumber),
          returnDepot: asString(response.returnDepot || response.depot),
          expiryDate: normalizeAiDate(
            response.expiryDate || response.freeTimeEnd,
          ),
          consignee: asString(response.consignee || response.consigneeName),
          containerType:
            normalizeEdoContainerType(response.containerType) === "20GP"
              ? "20GP"
              : "40HC",
          sealNumber: asString(response.sealNumber) || undefined,
          confidenceScore: Number(
            response.confidenceScore ?? response.confidence ?? 0,
          ),
          source: "BACKEND_API",
        },
      };
    }

    return {
      success: false,
      error:
        "Chưa cấu hình ECont AI API. Không tự tạo dữ liệu eDO khi chưa có kết quả từ API.",
    };
  } catch (error) {
    return { success: false, error: fallbackApiMessage(error) };
  }
}

function failedDocumentVerification(
  error: unknown,
  label: string,
): EdoVerificationResult {
  return {
    success: false,
    status: "MANUAL_REVIEW",
    isLegal: false,
    hasAnomaly: false,
    summary: `Chưa quét được ${label}. Vui lòng thử lại hoặc gửi hồ sơ để Ops kiểm tra.`,
    details: [fallbackApiMessage(error)],
    requiresOpsReview: true,
    error: fallbackApiMessage(error),
  };
}

export function isBlankImagePixels(pixels: Uint8ClampedArray): boolean {
  let min = 255,
    max = 0;
  for (let index = 0; index < pixels.length; index += 4) {
    const alpha = pixels[index + 3] / 255;
    const luminance =
      ((pixels[index] + pixels[index + 1] + pixels[index + 2]) / 3) * alpha +
      255 * (1 - alpha);
    min = Math.min(min, luminance);
    max = Math.max(max, luminance);
  }
  return max - min < 8;
}

async function readDocumentWithAI(file: File, documentType: "EDO" | "BOOKING") {
  if (!isApiConfigured) throw new Error("Chưa cấu hình máy chủ ECont AI.");
  const document = await fileToAiDocument(file);
  return unwrapApiPayload(
    await postApi<any>("/api/ai/edo/verify", {
      task:
        documentType === "BOOKING"
          ? "BOOKING_LEGALITY_AND_FIELD_EXTRACTION"
          : "EDO_LEGALITY_AND_FIELD_EXTRACTION",
      documentType,
      document: { fileName: file.name, ...document },
    }),
  );
}

/** Đọc độc lập eDO rồi so sánh bằng chứng với thông tin hiện tại của Offer. */
export async function verifyEdoWithAI(
  file: File,
  expected?: EdoRegistrationData,
): Promise<EdoVerificationResult> {
  try {
    const response = await readDocumentWithAI(file, "EDO");
    return compareEdoRegistration(
      mapDocumentVerificationResponse(response, "eDO"),
      response,
      expected,
    );
  } catch (error) {
    return failedDocumentVerification(error, "eDO");
  }
}

function compareBookingRegistration(
  base: EdoVerificationResult,
  response: any,
  expected?: BookingRegistrationData,
): BookingVerificationResult {
  const type = asString(response.documentType)
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
  const documentType = (
    ["BOOKING", "EDO", "OTHER"].includes(type) ? type : "UNKNOWN"
  ) as EdoVerificationResult["documentType"];
  const actualBookingNumber = asString(
    response.actualBookingNumber ?? response.bookingNumber,
  );
  const actualCarrierCode = asString(
    response.actualCarrierCode ?? response.carrierCode,
  );
  const actualContainerType = asString(
    response.actualContainerType ?? response.containerType,
  );
  const actualCutOffDate = asString(
    response.actualCutOffDate ?? response.cutOffTime,
  );
  const sourceMismatchDetails = vietnameseTextArray(response.mismatchDetails);
  const sourceReportedMismatch = response.matchesRegistration === false;
  const mismatchDetails = [...sourceMismatchDetails];
  const mismatchedFields: NonNullable<
    BookingVerificationResult["mismatchedFields"]
  > = [];
  const compare = (
    field: (typeof mismatchedFields)[number],
    label: string,
    actual: string,
    input: string | undefined,
    normalize = normalizeEdoContainerNumber,
  ) => {
    if (
      normalize(actual) &&
      normalize(input) &&
      normalize(actual) !== normalize(input)
    ) {
      mismatchedFields.push(field);
      mismatchDetails.push(
        `${label} trên file Booking (${actual}) không khớp thông tin đã nhập (${input}).`,
      );
    }
  };
  compare(
    "BOOKING_NUMBER",
    "Số Booking",
    actualBookingNumber,
    expected?.bookingNumber,
  );
  compare(
    "CARRIER_CODE",
    "Hãng tàu",
    actualCarrierCode,
    expected?.carrierCode,
    normalizeBookingCarrier,
  );
  compare(
    "CONTAINER_TYPE",
    "Loại container",
    actualContainerType,
    expected?.containerType,
    normalizeEdoContainerType,
  );
  const dateKey = (value: unknown) => normalizeAiDate(value).slice(0, 10);
  compare(
    "CUT_OFF_TIME",
    "Ngày cut-off",
    actualCutOffDate,
    expected?.cutOffTime,
    dateKey,
  );
  const wrongDocument = documentType === "EDO" || documentType === "OTHER";
  const missingExpected =
    !expected?.bookingNumber ||
    !expected.carrierCode ||
    !expected.containerType;
  const missingObserved =
    !actualBookingNumber || !actualCarrierCode || !actualContainerType;
  const hasMismatch =
    mismatchedFields.length > 0 ||
    sourceReportedMismatch ||
    sourceMismatchDetails.length > 0 ||
    wrongDocument;
  const pending =
    !hasMismatch &&
    (missingExpected || missingObserved || documentType !== "BOOKING");
  const status = hasMismatch
    ? "ANOMALY"
    : pending && base.status === "VALID"
      ? "MANUAL_REVIEW"
      : base.status;
  const details = uniqueText([
    ...base.details,
    ...mismatchDetails,
    wrongDocument ? "Tệp tải lên không phải chứng từ Booking." : "",
    documentType === "UNKNOWN"
      ? "AI chưa xác định rõ loại chứng từ Booking."
      : "",
    missingExpected
      ? "Cần nhập đủ số Booking, hãng tàu và loại container để đối chiếu."
      : "",
    missingObserved
      ? "AI chưa đọc rõ số Booking, hãng tàu hoặc loại container trên file."
      : "",
    !actualCutOffDate
      ? "Chưa đọc được ngày cut-off trên file; Ops cần kiểm tra ngày đã khai báo."
      : "",
  ]);
  // Cut-off cannot be silently approved when the file does not provide evidence.
  const missingCutOff = Boolean(expected?.cutOffTime) && !actualCutOffDate;
  const requiresOpsReview =
    status !== "VALID" || base.requiresOpsReview || pending || missingCutOff;
  return {
    ...base,
    documentVerification: base,
    documentType,
    actualBookingNumber,
    actualCarrierCode,
    actualContainerType,
    actualCutOffDate,
    sourceReportedMismatch,
    sourceMismatchDetails,
    status: missingCutOff && status === "VALID" ? "MANUAL_REVIEW" : status,
    isLegal: status === "VALID" && !requiresOpsReview,
    hasAnomaly: base.hasAnomaly || hasMismatch,
    matchesRegistration: hasMismatch
      ? false
      : pending || missingCutOff
        ? undefined
        : true,
    comparisonStatus: hasMismatch
      ? "MISMATCH"
      : pending || missingCutOff
        ? "PENDING"
        : "MATCHED",
    mismatchedFields,
    mismatchDetails: uniqueText(mismatchDetails),
    details,
    requiresOpsReview,
    summary: hasMismatch
      ? mismatchDetails[0] ||
        "Tệp tải lên không phải Booking hoặc có nội dung bất thường."
      : requiresOpsReview && base.status === "VALID"
        ? "Chưa đủ thông tin đối chiếu Booking; cần Ops xác minh."
        : status === "VALID"
          ? "File Booking hợp lệ theo kết quả AI và khớp thông tin đã nhập."
          : base.summary,
  };
}

export function reconcileBookingVerificationResult(
  result: BookingVerificationResult,
  expected: BookingRegistrationData,
): BookingVerificationResult {
  const { mismatchedFields: _fields, ...base } = result;
  return compareBookingRegistration(
    result.documentVerification || base,
    {
      documentType: result.documentType,
      actualBookingNumber: result.actualBookingNumber,
      actualCarrierCode: result.actualCarrierCode,
      actualContainerType: result.actualContainerType,
      actualCutOffDate: result.actualCutOffDate,
      matchesRegistration:
        result.sourceReportedMismatch === true ? false : undefined,
      mismatchDetails: result.sourceMismatchDetails,
    },
    expected,
  );
}

/** Booking dùng cùng gateway nhưng có schema và phép đối chiếu riêng. */
export async function verifyBookingWithAI(
  file: File,
  expected?: BookingRegistrationData,
): Promise<BookingVerificationResult> {
  try {
    const response = await readDocumentWithAI(file, "BOOKING");
    return compareBookingRegistration(
      mapDocumentVerificationResponse(response, "Booking"),
      response,
      expected,
    );
  } catch (error) {
    return failedDocumentVerification(
      error,
      "Booking",
    ) as BookingVerificationResult;
  }
}

/** Giám định tình trạng ảnh container. Kết quả API phải trả tình trạng thực tế và chi tiết phát hiện. */
export async function inspectContainerWithAI(
  photos: string[],
): Promise<AiInspectionResult> {
  if (photos.length < OFFER_PHOTO_ANGLES.length) {
    const missingAngles = OFFER_PHOTO_ANGLES.slice(photos.length);
    const missingDetail = missingPhotoAnglesMessage(missingAngles);
    return {
      success: false,
      status: "INSPECTION_INCOMPLETE",
      requiresOpsReview: true,
      error: `INSPECTION_INCOMPLETE: ${missingDetail}`,
      details: [
        missingDetail,
      ],
      missingAngles,
    };
  }
  if (!isApiConfigured) {
    return {
      success: false,
      status: "ERROR",
      requiresOpsReview: true,
      error:
        "Chưa cấu hình ECont AI API. Không được tự đánh dấu ảnh đạt khi chưa có kết quả AI.",
    };
  }
  try {
    assertAiPhotoSize(photos);
    const response = unwrapApiPayload(
      await postApi<any>("/api/ai/container/inspect", {
        task: "CONTAINER_PHYSICAL_CONDITION",
        photos,
        photoAngles: [
          "front",
          "back_door",
          "left_side",
          "right_side",
          "inside",
          "floor",
          "container_number_plate",
        ],
        requiredPhotoCount: 7,
      }),
    );
    const statusValue = String(response.status || "").toUpperCase();
    const condition = normalizeCondition(
      response.condition || response.actualCondition,
    );
    const missingAngles = normalizeMissingPhotoAngles(
      response.missingAngles || response.missingAngle || response.missingViews,
    );
    const missingDetail = missingPhotoAnglesMessage(missingAngles);
    const details = uniqueText([
      ...vietnameseTextArray(response.details || response.findings),
      missingDetail,
    ]);
    if (
      !["CLEAN", "ANOMALY", "MANUAL_REVIEW", "INSPECTION_INCOMPLETE"].includes(
        statusValue,
      ) ||
      !asString(response.summary)
    ) {
      throw new Error(
        "AI chưa trả về kết quả phân tích ảnh đầy đủ. Vui lòng thử lại.",
      );
    }
    const requiresOpsReview =
      missingAngles.length > 0 ||
      statusValue === "MANUAL_REVIEW" ||
      statusValue === "INSPECTION_INCOMPLETE" ||
      !condition ||
      asBoolean(
        response.requiresOpsReview ??
          response.hasAnomaly ??
          statusValue === "ANOMALY",
      );
    return {
      success: true,
      status:
        missingAngles.length > 0 || statusValue === "INSPECTION_INCOMPLETE"
          ? "INSPECTION_INCOMPLETE"
          : statusValue === "ANOMALY" || requiresOpsReview
            ? "ANOMALY"
            : "CLEAN",
      score: Number(response.score ?? response.confidence ?? 0) || undefined,
      condition,
      summary: [
        vietnameseText(
        response.summary || response.conditionNotes,
        "AI đã phân tích ảnh container.",
        ),
        missingDetail,
      ]
        .filter(Boolean)
        .join(" "),
      details,
      requiresOpsReview,
      missingAngles,
    };
  } catch (error) {
    return {
      success: false,
      status: "ERROR",
      requiresOpsReview: true,
      error: fallbackApiMessage(error),
    };
  }
}

/** Đối chiếu 7 góc ảnh thực tế với số cont, loại, hãng và tình trạng đã khai báo. */
export async function verifyContainerPhotosWithAI(
  photos: string[],
  expected: {
    containerNumber: string;
    containerType: ContainerType;
    carrierCode: string;
    declaredCondition: PhysicalCondition;
  },
): Promise<ContainerPhotoVerificationResult> {
  if (photos.length < OFFER_PHOTO_ANGLES.length) {
    const missingAngles = OFFER_PHOTO_ANGLES.slice(photos.length);
    const missingDetail = missingPhotoAnglesMessage(missingAngles);
    return {
      success: false,
      status: "INSPECTION_INCOMPLETE",
      matchesRegistration: false,
      mismatchDetails: [`INSPECTION_INCOMPLETE: ${missingDetail}`],
      summary: `INSPECTION_INCOMPLETE: ${missingDetail}`,
      requiresOpsReview: true,
      missingAngles,
      error:
        "INSPECTION_INCOMPLETE: Cần tải đủ 7 góc ảnh container chuẩn trước khi đối chiếu.",
    };
  }

  if (!isApiConfigured) {
    return {
      success: true,
      status: "MANUAL_REVIEW",
      matchesRegistration: false,
      mismatchDetails: [],
      summary:
        "Chưa thể quét bộ ảnh. Vui lòng thử lại hoặc gửi hồ sơ để Ops kiểm tra.",
      requiresOpsReview: true,
    };
  }

  try {
    assertAiPhotoSize(photos);
    const response = unwrapApiPayload(
      await postApi<any>("/api/ai/container/verify", {
        task: "CONTAINER_IDENTITY_AND_PHYSICAL_CONDITION",
        photos,
        photoAngles: [
          "front",
          "back_door",
          "left_side",
          "right_side",
          "inside",
          "floor",
          "container_number_plate",
        ],
        expected,
        requiredPhotoCount: 7,
      }),
    );
    let mismatchDetails = vietnameseTextArray(
      response.mismatchDetails || response.mismatches || response.errors,
    );
    const missingAngles = normalizeMissingPhotoAngles(
      response.missingAngles || response.missingAngle || response.missingViews,
    );
    const missingDetail = missingPhotoAnglesMessage(missingAngles);
    if (missingDetail) mismatchDetails.unshift(missingDetail);
    const actualContainerNumber =
      asString(
        response.actualContainerNumber || response.detectedContainerNumber,
      ) || undefined;
    const actualTypeValue = normalizeEdoContainerType(
      response.actualContainerType || response.detectedContainerType,
    );
    const actualContainerType =
      actualTypeValue === "20GP"
        ? "20GP"
        : actualTypeValue === "40HC"
          ? "40HC"
          : undefined;
    const actualCarrierCode =
      asString(response.actualCarrierCode || response.detectedCarrierCode) ||
      undefined;
    const actualCondition = normalizeCondition(
      response.actualCondition ||
        response.detectedCondition ||
        response.condition,
    );
    const responseDetails = vietnameseTextArray(
      response.details || response.findings || response.conditionDetails,
    );
    const actualConditionNotes =
      vietnameseText(
        response.actualConditionNotes ||
          response.conditionNotes ||
          response.physicalSummary,
        responseDetails.join(" "),
      ) || undefined;

    const normalizedActualContainerNumber = normalizeEdoContainerNumber(
      actualContainerNumber,
    );
    const normalizedExpectedContainerNumber = normalizeEdoContainerNumber(
      expected.containerNumber,
    );
    const containerNumberMatches = Boolean(
      normalizedActualContainerNumber &&
        normalizedExpectedContainerNumber &&
        normalizedActualContainerNumber === normalizedExpectedContainerNumber,
    );
    if (containerNumberMatches) {
      mismatchDetails = mismatchDetails.filter((detail) => {
        const mentionsContainerNumber =
          /(?:số|mã)\s*(?:cont|container)|container\s*(?:number|no)/i.test(
            detail,
          );
        const saysMismatch =
          /không khớp|không chính xác|sai lệch|mismatch/i.test(detail);
        return !(mentionsContainerNumber && saysMismatch);
      });
    }
    const resolvedContainerNumber =
      /^[A-Z]{4}\d{7}$/.test(normalizedActualContainerNumber)
        ? normalizedActualContainerNumber
        : actualContainerNumber;
    if (
      actualContainerNumber &&
      normalizedActualContainerNumber !== normalizedExpectedContainerNumber
    ) {
      mismatchDetails.push(
        `Ảnh nhận diện số cont ${actualContainerNumber}, không khớp ${expected.containerNumber}.`,
      );
    }

    if (actualContainerType && actualContainerType !== expected.containerType)
      mismatchDetails.push(
        `Ảnh nhận diện loại ${actualContainerType}, không khớp ${expected.containerType}.`,
      );
    if (
      actualCarrierCode &&
      normalizeBookingCarrier(actualCarrierCode) !==
        normalizeBookingCarrier(expected.carrierCode)
    )
      mismatchDetails.push(
        `Ảnh nhận diện hãng ${actualCarrierCode}, không khớp ${expected.carrierCode}.`,
      );
    if (actualCondition && actualCondition !== expected.declaredCondition)
      mismatchDetails.push(
        `Tình trạng thực tế (${conditionLabelVi(actualCondition)}) khác tình trạng khai báo (${conditionLabelVi(expected.declaredCondition)}).`,
      );

    const explicitStatus = String(response.status || "").toUpperCase();
    if (
      ![
        "OBSERVED",
        "MATCHED",
        "MISMATCH",
        "MANUAL_REVIEW",
        "INSPECTION_INCOMPLETE",
      ].includes(
        explicitStatus,
      ) ||
      !asString(response.summary)
    ) {
      throw new Error(
        "AI chưa trả về kết quả đối chiếu ảnh đầy đủ. Vui lòng thử lại.",
      );
    }
    const hasEvidence =
      /^[A-Z]{4}\d{7}$/.test(
        normalizeEdoContainerNumber(actualContainerNumber || ""),
      ) &&
      actualContainerType &&
      actualCarrierCode &&
      actualCondition &&
      actualConditionNotes &&
      expected.containerNumber &&
      expected.carrierCode &&
      expected.containerType &&
      expected.declaredCondition;
    const providerOnlyContainerFormattingMismatch =
      containerNumberMatches &&
      response.matchesRegistration === false &&
      mismatchDetails.length === 0 &&
      missingAngles.length === 0;
    const reportedMismatch =
      (explicitStatus === "MISMATCH" &&
        !providerOnlyContainerFormattingMismatch) ||
      (response.matchesRegistration === false &&
        !providerOnlyContainerFormattingMismatch) ||
      mismatchDetails.length > 0 ||
      missingAngles.length > 0;
    const status =
      missingAngles.length > 0 || explicitStatus === "INSPECTION_INCOMPLETE"
        ? "INSPECTION_INCOMPLETE"
        : reportedMismatch
          ? "MISMATCH"
      : explicitStatus === "MANUAL_REVIEW" ||
          asBoolean(response.requiresOpsReview) ||
          !hasEvidence
        ? "MANUAL_REVIEW"
        : "MATCHED";
    const summary =
      status === "INSPECTION_INCOMPLETE"
        ? missingDetail ||
          "Bộ ảnh chưa đủ 7 góc bắt buộc; Ops cần kiểm tra và yêu cầu bổ sung."
        : status === "MATCHED"
        ? "Ảnh khớp thông tin container đã đăng ký."
        : status === "MISMATCH"
          ? mismatchDetails[0] ||
            "Bộ ảnh có dấu hiệu không khớp thông tin đăng ký; cần Ops kiểm tra."
          : !hasEvidence
            ? "AI chưa đọc đủ số container, hãng, loại hoặc tình trạng thực tế; cần Ops kiểm tra."
            : vietnameseText(response.summary, "Bộ ảnh cần Ops kiểm tra.");

    return {
      success: true,
      status,
      matchesRegistration: status === "MATCHED",
      score: Number(response.score ?? response.confidence ?? 0) || undefined,
      actualContainerNumber: resolvedContainerNumber,
      actualContainerType,
      actualCarrierCode,
      actualCondition,
      actualConditionNotes,
      mismatchDetails: uniqueText(mismatchDetails),
      missingAngles,
      summary,
      requiresOpsReview: status !== "MATCHED",
      error: vietnameseText(response.error) || undefined,
    };
  } catch (error) {
    return {
      success: true,
      status: "MANUAL_REVIEW",
      matchesRegistration: false,
      mismatchDetails: [fallbackApiMessage(error)],
      summary:
        "Chưa quét được bộ ảnh. Vui lòng thử lại hoặc gửi hồ sơ để Ops kiểm tra.",
      requiresOpsReview: true,
      error: fallbackApiMessage(error),
    };
  }
}
