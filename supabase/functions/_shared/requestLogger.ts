import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

export interface RequestLogData {
  requestId: string;
  apiKeyId: string | null;
  professionalId: string | null;
  endpoint: string;
  method: string;
  requestBody: Record<string, unknown> | null;
  clientIp: string | null;
}

export interface ResponseLogData {
  responseStatus: number;
  responseBody: Record<string, unknown> | null;
  leadId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  processingTimeMs: number;
}

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
  return crypto.randomUUID();
}

/**
 * Sanitize request body by masking sensitive data
 */
export function sanitizeRequestBody(body: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!body) return null;

  const sanitized = { ...body };

  // Mask phone numbers (show only last 4 digits)
  if (sanitized.client_phone && typeof sanitized.client_phone === 'string') {
    const phone = sanitized.client_phone;
    sanitized.client_phone = phone.length > 4
      ? '*'.repeat(phone.length - 4) + phone.slice(-4)
      : '****';
  }

  // Remove any potential sensitive fields
  delete sanitized.password;
  delete sanitized.token;
  delete sanitized.api_key;

  return sanitized;
}

/**
 * Extract client IP from request
 */
export function extractClientIp(req: Request): string | null {
  // Try various headers that might contain the real IP
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  const realIp = req.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  const cfConnectingIp = req.headers.get('cf-connecting-ip');
  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  return null;
}

/**
 * Log an API request
 */
export async function logRequest(
  supabase: SupabaseClient,
  data: RequestLogData & ResponseLogData
): Promise<void> {
  try {
    const { error } = await supabase
      .from('api_request_logs')
      .insert({
        request_id: data.requestId,
        api_key_id: data.apiKeyId,
        professional_id: data.professionalId,
        endpoint: data.endpoint,
        method: data.method,
        request_body: data.requestBody,
        client_ip: data.clientIp,
        response_status: data.responseStatus,
        response_body: data.responseBody,
        lead_id: data.leadId,
        error_code: data.errorCode,
        error_message: data.errorMessage,
        processing_time_ms: data.processingTimeMs
      });

    if (error) {
      console.error('Error logging request:', error);
    }
  } catch (err) {
    console.error('Failed to log request:', err);
  }
}

/**
 * Create a request context for tracking
 */
export interface RequestContext {
  requestId: string;
  startTime: number;
  apiKeyId: string | null;
  professionalId: string | null;
  endpoint: string;
  method: string;
  requestBody: Record<string, unknown> | null;
  clientIp: string | null;
}

export function createRequestContext(
  req: Request,
  endpoint: string
): RequestContext {
  return {
    requestId: generateRequestId(),
    startTime: Date.now(),
    apiKeyId: null,
    professionalId: null,
    endpoint,
    method: req.method,
    requestBody: null,
    clientIp: extractClientIp(req)
  };
}

/**
 * Finalize and log the request
 */
export async function finalizeRequest(
  supabase: SupabaseClient,
  context: RequestContext,
  response: {
    status: number;
    body: Record<string, unknown> | null;
    leadId?: string | null;
    errorCode?: string | null;
    errorMessage?: string | null;
  }
): Promise<void> {
  const processingTimeMs = Date.now() - context.startTime;

  await logRequest(supabase, {
    requestId: context.requestId,
    apiKeyId: context.apiKeyId,
    professionalId: context.professionalId,
    endpoint: context.endpoint,
    method: context.method,
    requestBody: sanitizeRequestBody(context.requestBody),
    clientIp: context.clientIp,
    responseStatus: response.status,
    responseBody: response.body,
    leadId: response.leadId || null,
    errorCode: response.errorCode || null,
    errorMessage: response.errorMessage || null,
    processingTimeMs
  });
}
