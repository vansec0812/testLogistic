// ECont API client
// Vite serves the local AI gateway on the web origin. Production can configure
// VITE_API_BASE_URL or route /api to the standalone backend.

export class ApiClientError extends Error {
  constructor(message: string, public status?: number, public code?: string) {
    super(message);
    this.name = 'ApiClientError';
  }
}

const runtimeEnv = (import.meta as any).env || {};
const envBaseUrl = String(runtimeEnv.VITE_API_BASE_URL || '').trim();
const defaultBaseUrl = typeof window !== 'undefined'
  ? window.location.origin
  : '';
const configuredBaseUrl = envBaseUrl || defaultBaseUrl;
export const isApiConfigured = Boolean(configuredBaseUrl);
export const apiBaseUrl = configuredBaseUrl.replace(/\/$/, '');

function normalizeNetworkError(error: unknown): string {
  const rawMessage = error instanceof Error ? error.message : String(error || '');
  if (/failed to fetch|networkerror|load failed|err_connection_refused|econnrefused|connection refused|proxy error/i.test(rawMessage)) {
    return 'Không kết nối được máy chủ ECont. Hãy kiểm tra API backend và VITE_API_BASE_URL.';
  }
  return rawMessage || 'Lỗi mạng khi gọi ECont API.';
}

async function parseResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') || '';
  const raw = await response.text();
  let body: Record<string, unknown> | undefined;
  if (contentType.includes('application/json') && raw) {
    try { body = JSON.parse(raw); } catch { /* Use the controlled error below. */ }
  }

  if (!response.ok) {
    const message = typeof body?.message === 'string' ? body.message
      : typeof body?.error === 'string' ? body.error
      : response.status >= 500 ? 'Máy chủ xử lý chưa sẵn sàng. Vui lòng thử lại sau.'
      : `Yêu cầu không thành công (HTTP ${response.status}).`;
    throw new ApiClientError(message, response.status, typeof body?.code === 'string' ? body.code : undefined);
  }
  if (!body || typeof body !== 'object') {
    throw new ApiClientError('Máy chủ trả về dữ liệu không hợp lệ. Vui lòng thử lại.', response.status, 'INVALID_API_RESPONSE');
  }
  return body as T;
}

export async function callApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!isApiConfigured) {
    throw new ApiClientError('Chưa cấu hình VITE_API_BASE_URL cho ECont API.');
  }

  const controller = new AbortController();
  // Allow uploads + image fetching + the provider's 90s inference budget.
  const timeout = window.setTimeout(() => controller.abort(), path.startsWith('/api/ai/') ? 120_000 : 30_000);
  try {
    const response = await fetch(`${apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
      signal: controller.signal,
    });
    return await parseResponse<T>(response);
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw new ApiClientError('API không phản hồi trong thời gian cho phép.');
    }
    if (error instanceof ApiClientError) throw error;
    throw new ApiClientError(normalizeNetworkError(error));
  } finally {
    window.clearTimeout(timeout);
  }
}

export function postApi<T>(path: string, payload: unknown): Promise<T> {
  return callApi<T>(path, { method: 'POST', body: JSON.stringify(payload) });
}
