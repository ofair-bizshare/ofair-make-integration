import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

export interface LeadSubmissionRequest {
  description: string;
  location: string;
  profession: string[];
  client_name: string;
  client_phone: string;
  budget?: number;
  includes_vat?: boolean;
  share_percentage?: number;
  work_date?: string;
  work_time?: string;
  work_timeframe?: string;
  constraints?: string;
  media_urls?: string[];
  latitude?: number;
  longitude?: number;
}

export interface LeadSubmissionResult {
  success: boolean;
  leadId?: string;
  error?: string;
  errorCode?: string;
  field?: string;
}

// Israeli phone format validation
const ISRAELI_PHONE_REGEX = /^0\d{1,2}-?\d{7}$|^0\d{9}$/;

// Valid work timeframes
const VALID_TIMEFRAMES = ['מיידי', 'יומיים הקרובים', 'בשבוע הקרוב', 'עד חודש', 'חודש או יותר'];

/**
 * Validate lead submission request
 */
export function validateLeadRequest(data: LeadSubmissionRequest): { valid: boolean; error?: string; field?: string } {
  // Required fields
  if (!data.description || data.description.trim().length < 10) {
    return { valid: false, error: 'Description must be at least 10 characters', field: 'description' };
  }

  if (!data.location || data.location.trim().length < 2) {
    return { valid: false, error: 'Location (city) is required', field: 'location' };
  }

  if (!data.profession || !Array.isArray(data.profession) || data.profession.length === 0) {
    return { valid: false, error: 'At least one profession is required', field: 'profession' };
  }

  if (data.profession.length > 5) {
    return { valid: false, error: 'Maximum 5 professions allowed', field: 'profession' };
  }

  if (!data.client_name || data.client_name.trim().length < 2) {
    return { valid: false, error: 'Client name is required', field: 'client_name' };
  }

  if (!data.client_phone || !ISRAELI_PHONE_REGEX.test(data.client_phone)) {
    return { valid: false, error: 'Client phone must be valid Israeli format (e.g., 0501234567)', field: 'client_phone' };
  }

  // Optional field validations
  if (data.budget !== undefined && (typeof data.budget !== 'number' || data.budget <= 0)) {
    return { valid: false, error: 'Budget must be a positive number', field: 'budget' };
  }

  if (data.share_percentage !== undefined) {
    if (typeof data.share_percentage !== 'number' || data.share_percentage < 5 || data.share_percentage > 40) {
      return { valid: false, error: 'Share percentage must be between 5 and 40', field: 'share_percentage' };
    }
  }

  if (data.work_timeframe && !VALID_TIMEFRAMES.includes(data.work_timeframe)) {
    return { valid: false, error: `Work timeframe must be one of: ${VALID_TIMEFRAMES.join(', ')}`, field: 'work_timeframe' };
  }

  if (data.work_date) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(data.work_date)) {
      return { valid: false, error: 'Work date must be in YYYY-MM-DD format', field: 'work_date' };
    }
  }

  if (data.work_time) {
    const timeRegex = /^\d{2}:\d{2}$/;
    if (!timeRegex.test(data.work_time)) {
      return { valid: false, error: 'Work time must be in HH:MM format', field: 'work_time' };
    }
  }

  return { valid: true };
}

/**
 * Process location - similar logic to main app
 */
function processLocation(location: string): string {
  const cleanLocation = location.trim();

  // Basic validation
  if (cleanLocation.length < 2) {
    return 'לא צוין';
  }

  // Remove street-like patterns
  if (cleanLocation.match(/רחוב|דרך|שדרות|street|st\.|rd\.|ave\./i)) {
    // Try to extract just the city part
    const parts = cleanLocation.split(',').map(p => p.trim());
    for (const part of parts) {
      if (!part.match(/רחוב|דרך|שדרות|street|st\.|rd\.|ave\.|^\d+$/i) && part.length > 2) {
        return part;
      }
    }
  }

  return cleanLocation;
}

/**
 * Get coordinates for a city using Google Geocoding API
 */
async function getCoordinatesForCity(cityName: string): Promise<{ lat: number; lng: number } | null> {
  const apiKey = Deno.env.get('GOOGLE_GEOCODING_API_KEY');
  if (!apiKey) {
    console.log('Google Geocoding API key not configured');
    return null;
  }

  try {
    const encodedCity = encodeURIComponent(`${cityName}, Israel`);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedCity}&key=${apiKey}&language=he`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const location = data.results[0].geometry.location;
      return { lat: location.lat, lng: location.lng };
    }
  } catch (err) {
    console.error('Geocoding error:', err);
  }

  return null;
}

/**
 * Submit a lead to the database
 */
export async function submitLead(
  supabase: SupabaseClient,
  professionalId: string,
  request: LeadSubmissionRequest
): Promise<LeadSubmissionResult> {
  // Validate request
  const validation = validateLeadRequest(request);
  if (!validation.valid) {
    return {
      success: false,
      error: validation.error,
      errorCode: 'validation_error',
      field: validation.field
    };
  }

  // Verify professional exists
  const { data: professional, error: proError } = await supabase
    .from('professionals')
    .select('id')
    .eq('id', professionalId)
    .single();

  if (proError || !professional) {
    return {
      success: false,
      error: 'Professional not found',
      errorCode: 'professional_not_found'
    };
  }

  // Process location
  const processedLocation = processLocation(request.location);

  // Get coordinates if not provided
  let latitude = request.latitude;
  let longitude = request.longitude;

  if (!latitude || !longitude) {
    const coords = await getCoordinatesForCity(processedLocation);
    if (coords) {
      latitude = coords.lat;
      longitude = coords.lng;
    }
  }

  // Calculate VAT
  const VAT_RATE = 0.18;
  const budget = request.budget;
  const includesVat = request.includes_vat || false;
  const amount_before_vat = includesVat && budget
    ? Math.round(budget / (1 + VAT_RATE))
    : budget;

  // Generate title from professions
  const title = request.profession.join(' / ');

  // Prepare lead data
  const leadData = {
    professional_id: professionalId,
    title,
    description: request.description,
    location: processedLocation,
    profession: request.profession,
    budget: request.budget || null,
    includes_vat: includesVat,
    amount_before_vat: amount_before_vat || null,
    share_percentage: request.share_percentage || 10,
    client_name: request.client_name,
    client_phone: request.client_phone,
    client_address: null,
    work_date: request.work_date || null,
    work_time: request.work_time || null,
    work_timeframe: request.work_timeframe || 'מיידי',
    constraints: request.constraints || null,
    notes: request.constraints || null,
    status: 'active',
    latitude: latitude || null,
    longitude: longitude || null,
    image_urls: request.media_urls || null
  };

  // Insert lead
  const { data: lead, error: insertError } = await supabase
    .from('leads')
    .insert([leadData])
    .select('id')
    .single();

  if (insertError) {
    console.error('Lead insertion error:', insertError);
    return {
      success: false,
      error: 'Failed to create lead',
      errorCode: 'database_error'
    };
  }

  return {
    success: true,
    leadId: lead.id
  };
}
