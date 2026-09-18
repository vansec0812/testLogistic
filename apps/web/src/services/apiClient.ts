// ECont API client
// Local Vite proxy chuyển /api tới gateway ở localhost:8000. Production có thể
// dùng cùng origin hoặc đặt VITE_API_BASE_URL tới backend riêng.

export class ApiClientError extends Error {
  constructor(message: string, public status?: number) {
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
  const body = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message = typeof body === 'object' && body !== null
      ? ((body as any).message || (body as any).error || `API lỗi HTTP ${response.status}`)
      : String(body || `API lỗi HTTP ${response.status}`);
    throw new ApiClientError(message, response.status);
  }
  return body as T;
}

export async function callApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!isApiConfigured) {
    throw new ApiClientError('Chưa cấu hình VITE_API_BASE_URL cho ECont API.');
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 30_000);
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
