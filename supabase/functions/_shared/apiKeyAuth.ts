import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

export interface ApiKeyValidationResult {
  isValid: boolean;
  professionalId?: string;
  apiKeyId?: string;
  error?: string;
  errorCode?: string;
}

/**
 * Extract API key from request headers
 */
export function extractApiKey(req: Request): string | null {
  return req.headers.get('X-API-Key') || req.headers.get('x-api-key') || null;
}

/**
 * Hash an API key using SHA-256
 */
async function hashApiKey(apiKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Validate an API key and return the associated professional ID
 */
export async function validateApiKey(
  apiKey: string,
  supabase: SupabaseClient
): Promise<ApiKeyValidationResult> {
  if (!apiKey) {
    return {
      isValid: false,
      error: 'API key is required',
      errorCode: 'missing_api_key'
    };
  }

  // Validate key format (ofair_pk_[32 chars])
  if (!apiKey.match(/^ofair_pk_[A-Za-z0-9]{32}$/)) {
    return {
      isValid: false,
      error: 'Invalid API key format',
      errorCode: 'invalid_api_key_format'
    };
  }

  try {
    // Hash the API key
    const keyHash = await hashApiKey(apiKey);

    // Look up the key in the database
    const { data, error } = await supabase
      .from('api_keys')
      .select('id, professional_id, is_active, expires_at, revoked_at')
      .eq('key_hash', keyHash)
      .single();

    if (error || !data) {
      console.error('API key lookup error:', error);
      return {
        isValid: false,
        error: 'Invalid API key',
        errorCode: 'invalid_api_key'
      };
    }

    // Check if key is active
    if (!data.is_active) {
      return {
        isValid: false,
        error: 'API key is inactive',
        errorCode: 'inactive_api_key'
      };
    }

    // Check if key was revoked
    if (data.revoked_at) {
      return {
        isValid: false,
        error: 'API key has been revoked',
        errorCode: 'revoked_api_key'
      };
    }

    // Check if key is expired
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      // Deactivate the expired key
      await supabase
        .from('api_keys')
        .update({ is_active: false })
        .eq('id', data.id);

      return {
        isValid: false,
        error: 'API key has expired',
        errorCode: 'expired_api_key'
      };
    }

    // Update last_used_at timestamp
    await supabase
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', data.id);

    return {
      isValid: true,
      professionalId: data.professional_id,
      apiKeyId: data.id
    };

  } catch (err) {
    console.error('API key validation error:', err);
    return {
      isValid: false,
      error: 'Internal error validating API key',
      errorCode: 'internal_error'
    };
  }
}

/**
 * Generate a new API key for a professional
 */
export async function generateApiKey(
  professionalId: string,
  name: string | null,
  supabase: SupabaseClient
): Promise<{ fullKey: string; keyId: string; prefix: string } | { error: string }> {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const randomPart = Array.from(
    crypto.getRandomValues(new Uint8Array(32)),
    (byte) => charset[byte % charset.length]
  ).join('');

  const fullKey = `ofair_pk_${randomPart}`;
  const prefix = 'ofair_pk';
  const keyHash = await hashApiKey(fullKey);

  // Check if name already exists for this professional
  if (name) {
    const { data: existingKey } = await supabase
      .from('api_keys')
      .select('id')
      .eq('professional_id', professionalId)
      .eq('name', name)
      .eq('is_active', true)
      .single();

    if (existingKey) {
      return { error: 'An API key with this name already exists' };
    }
  }

  // Insert the new key
  const { data, error } = await supabase
    .from('api_keys')
    .insert({
      professional_id: professionalId,
      key_prefix: prefix,
      key_hash: keyHash,
      name: name || `API Key ${new Date().toLocaleDateString('he-IL')}`,
      is_active: true
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error creating API key:', error);
    return { error: 'Failed to create API key' };
  }

  return {
    fullKey,
    keyId: data.id,
    prefix
  };
}

/**
 * Get Supabase client using service role key
 */
export function getSupabaseClient(): SupabaseClient {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Server configuration error");
  }

  return createClient(supabaseUrl, supabaseKey);
}
