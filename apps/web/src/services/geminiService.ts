// ==============================================================================
// ECont Gemini API Service - OCR & Trích xuất chứng từ e-DO / Booking qua Google Gemini 1.5 Flash
// ==============================================================================

import { CarrierCode, ContainerType } from '../types';
import { ExtractedEdoData } from '../components/AiEdoScannerModal';

const GEMINI_API_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

/**
 * Chuyển đổi File sang Base64
 */
export async function fileToBase64(file: File): Promise<{ mimeType: string; data: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64Data = result.split(',')[1];
      resolve({
        mimeType: file.type || 'image/jpeg',
        data: base64Data,
      });
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

/**
 * Trích xuất thông tin chứng từ e-DO / Booking sử dụng Google Gemini 1.5 Flash Vision API
 */
export async function extractEdoWithGemini(
  file: File,
  customApiKey?: string
): Promise<{ success: boolean; data?: ExtractedEdoData; error?: string }> {
  const apiKey = customApiKey || (import.meta as any).env?.VITE_GEMINI_API_KEY;

  if (!apiKey) {
    return {
      success: false,
      error: 'Chưa cấu hình VITE_GEMINI_API_KEY. Vui lòng thêm khóa API trong file .env hoặc nhập trực tiếp.',
    };
  }

  try {
    const { mimeType, data: base64Data } = await fileToBase64(file);

    const prompt = `
Bạn là chuyên gia OCR và phân tích chứng từ Logistics Hàng hải quốc tế.
Nhiệm vụ của bạn là đọc hình ảnh/tài liệu Lệnh giao hàng điện tử (e-DO) hoặc Booking Note đính kèm và trích xuất chính xác các trường dữ liệu sau.

Yêu cầu trả về DUY NHẤT một chuỗi JSON hợp lệ (không kèm markdown format, không kèm giải thích) với cấu trúc sau:
{
  "containerNumber": "Chuỗi 11 ký tự gồm 4 chữ cái và 7 số theo chuẩn ISO 6346, ví dụ: MSKU8421093",
  "carrierCode": "Một trong các mã: MAERSK, CMA_CGM, ONE, COSCO, EVERGREEN, HAPAG_LLOYD, MSC, OTHER",
  "edoNumber": "Số lệnh e-DO hoặc số Booking Note",
  "returnDepot": "Tên bãi/Depot/ICD chỉ định hạ vỏ rỗng",
  "expiryDate": "Ngày hết hạn lưu bãi / hạn trả vỏ rỗng theo định dạng YYYY-MM-DD",
  "consignee": "Tên công ty nhận hàng / chủ hàng trên chứng từ",
  "containerType": "20GP hoặc 40HC",
  "sealNumber": "Số seal niêm chì nếu có",
  "confidenceScore": Số điểm độ tin cậy từ 80 đến 99.9 (ví dụ: 98.5)
}
`;

    const response = await fetch(`${GEMINI_API_ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: base64Data,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          response_mime_type: 'application/json',
        },
      }),
    });

    if (!response.ok) {
      const errorDetail = await response.text();
      return {
        success: false,
        error: `Gemini API trả về lỗi (${response.status}): ${errorDetail}`,
      };
    }

    const result = await response.json();
    const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      return {
        success: false,
        error: 'Không nhận được dữ liệu phản hồi hợp lệ từ Gemini API.',
      };
    }

    const parsedJson = JSON.parse(rawText) as ExtractedEdoData;

    // Chuẩn hóa CarrierCode
    const validCarriers: CarrierCode[] = ['MAERSK', 'CMA_CGM', 'ONE', 'COSCO', 'EVERGREEN', 'HAPAG_LLOYD', 'MSC', 'OTHER'];
    if (!validCarriers.includes(parsedJson.carrierCode)) {
      parsedJson.carrierCode = 'OTHER';
    }

    // Chuẩn hóa ContainerType
    if (parsedJson.containerType !== '20GP' && parsedJson.containerType !== '40HC') {
      parsedJson.containerType = '40HC';
    }

    if (!parsedJson.confidenceScore) {
      parsedJson.confidenceScore = 95.0;
    }

    return {
      success: true,
      data: parsedJson,
    };
  } catch (err: any) {
    return {
      success: false,
      error: `Lỗi kết nối hoặc phân tích kết quả từ Gemini: ${err?.message || err}`,
    };
  }
}
