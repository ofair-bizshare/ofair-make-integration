import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

export interface RateLimitConfig {
  requests_per_minute: number;
  requests_per_hour: number;
  requests_per_day: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: {
    minute: number;
    hour: number;
    day: number;
  };
  reset: {
    minute: string;
    hour: string;
    day: string;
  };
  retryAfter?: number;
  errorCode?: string;
}

const DEFAULT_LIMITS: RateLimitConfig = {
  requests_per_minute: 60,
  requests_per_hour: 1000,
  requests_per_day: 10000
};

/**
 * Get rate limit configuration for a specific API key or use global defaults
 */
async function getRateLimitConfig(
  supabase: SupabaseClient,
  apiKeyId: string,
  professionalId: string
): Promise<RateLimitConfig> {
  // Try to get API key specific config
  const { data: keyConfig } = await supabase
    .from('api_rate_limit_config')
    .select('requests_per_minute, requests_per_hour, requests_per_day')
    .eq('scope', 'api_key')
    .eq('scope_id', apiKeyId)
    .eq('is_active', true)
    .single();

  if (keyConfig) return keyConfig;

  // Try to get professional specific config
  const { data: proConfig } = await supabase
    .from('api_rate_limit_config')
    .select('requests_per_minute, requests_per_hour, requests_per_day')
    .eq('scope', 'professional')
    .eq('scope_id', professionalId)
    .eq('is_active', true)
    .single();

  if (proConfig) return proConfig;

  // Fall back to global config
  const { data: globalConfig } = await supabase
    .from('api_rate_limit_config')
    .select('requests_per_minute, requests_per_hour, requests_per_day')
    .eq('scope', 'global')
    .is('scope_id', null)
    .eq('is_active', true)
    .single();

  return globalConfig || DEFAULT_LIMITS;
}

/**
 * Get the start of the current time window
 */
function getWindowStart(windowType: 'minute' | 'hour' | 'day'): Date {
  const now = new Date();
  switch (windowType) {
    case 'minute':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes(), 0, 0);
    case 'hour':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0, 0);
    case 'day':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  }
}

/**
 * Get the end of the current time window (for reset time)
 */
function getWindowEnd(windowType: 'minute' | 'hour' | 'day'): Date {
  const start = getWindowStart(windowType);
  switch (windowType) {
    case 'minute':
      return new Date(start.getTime() + 60 * 1000);
    case 'hour':
      return new Date(start.getTime() + 60 * 60 * 1000);
    case 'day':
      return new Date(start.getTime() + 24 * 60 * 60 * 1000);
  }
}

/**
 * Check rate limits and increment counters if allowed
 */
export async function checkRateLimit(
  supabase: SupabaseClient,
  apiKeyId: string,
  professionalId: string
): Promise<RateLimitResult> {
  const config = await getRateLimitConfig(supabase, apiKeyId, professionalId);
  const identifier = apiKeyId;
  const identifierType = 'api_key';

  const minuteWindow = getWindowStart('minute');
  const hourWindow = getWindowStart('hour');
  const dayWindow = getWindowStart('day');

  // Get or create tracking record
  const { data: tracking, error: trackingError } = await supabase
    .from('api_rate_limit_tracking')
    .select('*')
    .eq('identifier', identifier)
    .eq('identifier_type', identifierType)
    .single();

  let minuteCount = 0;
  let hourCount = 0;
  let dayCount = 0;

  if (tracking) {
    // Reset counters if windows have passed
    if (new Date(tracking.minute_window) < minuteWindow) {
      minuteCount = 0;
    } else {
      minuteCount = tracking.minute_count;
    }

    if (new Date(tracking.hour_window) < hourWindow) {
      hourCount = 0;
    } else {
      hourCount = tracking.hour_count;
    }

    if (new Date(tracking.day_window) < dayWindow) {
      dayCount = 0;
    } else {
      dayCount = tracking.day_count;
    }
  }

  // Check if any limit is exceeded
  const minuteExceeded = minuteCount >= config.requests_per_minute;
  const hourExceeded = hourCount >= config.requests_per_hour;
  const dayExceeded = dayCount >= config.requests_per_day;

  if (minuteExceeded || hourExceeded || dayExceeded) {
    // Calculate retry after (seconds until next window)
    let retryAfter = 60; // Default to next minute
    if (dayExceeded) {
      retryAfter = Math.ceil((getWindowEnd('day').getTime() - Date.now()) / 1000);
    } else if (hourExceeded) {
      retryAfter = Math.ceil((getWindowEnd('hour').getTime() - Date.now()) / 1000);
    } else {
      retryAfter = Math.ceil((getWindowEnd('minute').getTime() - Date.now()) / 1000);
    }

    return {
      allowed: false,
      remaining: {
        minute: Math.max(0, config.requests_per_minute - minuteCount),
        hour: Math.max(0, config.requests_per_hour - hourCount),
        day: Math.max(0, config.requests_per_day - dayCount)
      },
      reset: {
        minute: getWindowEnd('minute').toISOString(),
        hour: getWindowEnd('hour').toISOString(),
        day: getWindowEnd('day').toISOString()
      },
      retryAfter,
      errorCode: 'rate_limit_exceeded'
    };
  }

  // Increment counters
  const newMinuteCount = minuteCount + 1;
  const newHourCount = hourCount + 1;
  const newDayCount = dayCount + 1;

  // Upsert tracking record
  const { error: upsertError } = await supabase
    .from('api_rate_limit_tracking')
    .upsert({
      identifier,
      identifier_type: identifierType,
      minute_window: minuteWindow.toISOString(),
      minute_count: newMinuteCount,
      hour_window: hourWindow.toISOString(),
      hour_count: newHourCount,
      day_window: dayWindow.toISOString(),
      day_count: newDayCount,
      last_request_at: new Date().toISOString()
    }, {
      onConflict: 'identifier,identifier_type'
    });

  if (upsertError) {
    console.error('Error updating rate limit tracking:', upsertError);
  }

  return {
    allowed: true,
    remaining: {
      minute: config.requests_per_minute - newMinuteCount,
      hour: config.requests_per_hour - newHourCount,
      day: config.requests_per_day - newDayCount
    },
    reset: {
      minute: getWindowEnd('minute').toISOString(),
      hour: getWindowEnd('hour').toISOString(),
      day: getWindowEnd('day').toISOString()
    }
  };
}

/**
 * Generate rate limit headers for response
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit-Minute': '60',
    'X-RateLimit-Remaining-Minute': String(result.remaining.minute),
    'X-RateLimit-Reset-Minute': result.reset.minute,
    'X-RateLimit-Limit-Hour': '1000',
    'X-RateLimit-Remaining-Hour': String(result.remaining.hour),
    'X-RateLimit-Reset-Hour': result.reset.hour,
    'X-RateLimit-Limit-Day': '10000',
    'X-RateLimit-Remaining-Day': String(result.remaining.day),
    'X-RateLimit-Reset-Day': result.reset.day
  };
}
