export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname.includes('fixhubtech.com')
    ? 'https://api.shaliach.fixhubtech.com'
    : 'http://localhost:3001');

export function getAssetUrl(path?: string | null): string | null {
  if (!path) return null;
  // If previously saved with frontend domain instead of api domain, redirect to API
  if (path.includes('shaliach.fixhubtech.com/api/') && !path.includes('api.shaliach.fixhubtech.com')) {
    return path.replace('shaliach.fixhubtech.com/api/', 'api.shaliach.fixhubtech.com/api/');
  }
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path;
  }
  return `${API_URL.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

export class ApiError extends Error {
  statusCode: number;
  code: string;
  details?: any;

  constructor(message: string, statusCode: number, code: string, details?: any) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export async function apiFetch<T = any>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_URL.replace(/\/+$/, '')}/${endpoint.replace(/^\/+/, '')}`;

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.headers as Record<string, string>),
  };

  // Only set application/json if not multipart form data
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include', // Includes HTTP-only session cookie
  });

  const contentType = response.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');

  if (!response.ok) {
    let errorData: any = {};
    if (isJson) {
      try {
        errorData = await response.json();
      } catch {}
    }
    throw new ApiError(
      errorData.message || `API request failed with status ${response.status}`,
      response.status,
      errorData.code || 'API_ERROR',
      errorData.details,
    );
  }

  if (isJson) {
    return response.json();
  }

  return response.text() as unknown as T;
}
