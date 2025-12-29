import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { extractApiKey, validateApiKey, getSupabaseClient } from "../_shared/apiKeyAuth.ts";
import { checkRateLimit, getRateLimitHeaders } from "../_shared/rateLimiter.ts";
import { createRequestContext, finalizeRequest, RequestContext } from "../_shared/requestLogger.ts";
import { submitLead, LeadSubmissionRequest } from "../_shared/leadSubmission.ts";

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = getSupabaseClient();
  const context = createRequestContext(req, '/submit-lead-api');

  try {
    // Only accept POST requests
    if (req.method !== 'POST') {
      const response = {
        error: 'method_not_allowed',
        message: 'Only POST requests are allowed',
        request_id: context.requestId
      };
      await finalizeRequest(supabase, context, {
        status: 405,
        body: response,
        errorCode: 'method_not_allowed'
      });
      return new Response(JSON.stringify(response), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Extract and validate API key
    const apiKey = extractApiKey(req);
    if (!apiKey) {
      const response = {
        error: 'missing_api_key',
        message: 'X-API-Key header is required',
        request_id: context.requestId
      };
      await finalizeRequest(supabase, context, {
        status: 401,
        body: response,
        errorCode: 'missing_api_key'
      });
      return new Response(JSON.stringify(response), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const keyValidation = await validateApiKey(apiKey, supabase);
    if (!keyValidation.isValid) {
      const response = {
        error: keyValidation.errorCode,
        message: keyValidation.error,
        request_id: context.requestId
      };
      await finalizeRequest(supabase, context, {
        status: 401,
        body: response,
        errorCode: keyValidation.errorCode
      });
      return new Response(JSON.stringify(response), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Update context with auth info
    context.apiKeyId = keyValidation.apiKeyId!;
    context.professionalId = keyValidation.professionalId!;

    // Check rate limits
    const rateLimitResult = await checkRateLimit(
      supabase,
      keyValidation.apiKeyId!,
      keyValidation.professionalId!
    );

    const rateLimitHeaders = getRateLimitHeaders(rateLimitResult);

    if (!rateLimitResult.allowed) {
      const response = {
        error: 'rate_limit_exceeded',
        message: 'Rate limit exceeded. Please wait before making more requests.',
        retry_after: rateLimitResult.retryAfter,
        limits: {
          minute: { remaining: rateLimitResult.remaining.minute, reset: rateLimitResult.reset.minute },
          hour: { remaining: rateLimitResult.remaining.hour, reset: rateLimitResult.reset.hour },
          day: { remaining: rateLimitResult.remaining.day, reset: rateLimitResult.reset.day }
        },
        request_id: context.requestId
      };
      await finalizeRequest(supabase, context, {
        status: 429,
        body: response,
        errorCode: 'rate_limit_exceeded'
      });
      return new Response(JSON.stringify(response), {
        status: 429,
        headers: {
          ...corsHeaders,
          ...rateLimitHeaders,
          'Content-Type': 'application/json',
          'Retry-After': String(rateLimitResult.retryAfter)
        }
      });
    }

    // Parse request body
    let requestBody: LeadSubmissionRequest;
    try {
      requestBody = await req.json();
      context.requestBody = requestBody as Record<string, unknown>;
    } catch {
      const response = {
        error: 'invalid_json',
        message: 'Request body must be valid JSON',
        request_id: context.requestId
      };
      await finalizeRequest(supabase, context, {
        status: 400,
        body: response,
        errorCode: 'invalid_json'
      });
      return new Response(JSON.stringify(response), {
        status: 400,
        headers: { ...corsHeaders, ...rateLimitHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Submit the lead
    const result = await submitLead(supabase, keyValidation.professionalId!, requestBody);

    if (!result.success) {
      const response = {
        error: result.errorCode,
        message: result.error,
        field: result.field,
        request_id: context.requestId
      };
      await finalizeRequest(supabase, context, {
        status: 400,
        body: response,
        errorCode: result.errorCode
      });
      return new Response(JSON.stringify(response), {
        status: 400,
        headers: { ...corsHeaders, ...rateLimitHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Success response
    const response = {
      success: true,
      lead_id: result.leadId,
      request_id: context.requestId
    };
    await finalizeRequest(supabase, context, {
      status: 201,
      body: response,
      leadId: result.leadId
    });
    return new Response(JSON.stringify(response), {
      status: 201,
      headers: { ...corsHeaders, ...rateLimitHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    const response = {
      error: 'internal_error',
      message: 'An unexpected error occurred',
      request_id: context.requestId
    };
    await finalizeRequest(supabase, context, {
      status: 500,
      body: response,
      errorCode: 'internal_error',
      errorMessage: error instanceof Error ? error.message : 'Unknown error'
    });
    return new Response(JSON.stringify(response), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
