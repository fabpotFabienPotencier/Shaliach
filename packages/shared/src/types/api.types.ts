/**
 * Standard API response wrapper.
 */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

/**
 * Paginated API response using cursor-based pagination.
 */
export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: CursorPagination;
}

/**
 * Cursor-based pagination metadata.
 */
export interface CursorPagination {
  /** Cursor pointing to the next page */
  nextCursor: string | null;
  /** Cursor pointing to the previous page */
  previousCursor: string | null;
  /** Whether there are more results */
  hasMore: boolean;
  /** Total count (optional — only included when not expensive) */
  totalCount?: number;
}

/**
 * Cursor pagination query parameters.
 */
export interface CursorPaginationParams {
  /** Cursor from previous response */
  cursor?: string;
  /** Number of items to return */
  limit?: number;
  /** Sort field */
  sortBy?: string;
  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Standard API error response.
 */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    statusCode: number;
  };
}

/**
 * Webhook event payload from Resend.
 */
export interface WebhookEventPayload {
  type: string;
  data: {
    email_id: string;
    to: string[];
    from: string;
    subject: string;
    created_at: string;
    [key: string]: unknown;
  };
  created_at: string;
}
