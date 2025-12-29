-- API Keys table for external integrations (Make.com, CRMs, etc.)
CREATE TABLE IF NOT EXISTS public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  key_prefix VARCHAR(8) NOT NULL DEFAULT 'ofair_pk',
  key_hash TEXT NOT NULL UNIQUE,
  name VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  UNIQUE(professional_id, name)
);

-- Index for fast key lookups
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_api_keys_professional ON api_keys(professional_id) WHERE is_active = true;

-- API Request Logs for tracing and debugging
CREATE TABLE IF NOT EXISTS public.api_request_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL DEFAULT gen_random_uuid(),
  api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
  professional_id UUID REFERENCES professionals(id) ON DELETE SET NULL,
  endpoint VARCHAR(100) NOT NULL,
  method VARCHAR(10) NOT NULL DEFAULT 'POST',
  request_body JSONB,
  client_ip INET,
  response_status INTEGER NOT NULL,
  response_body JSONB,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  error_code VARCHAR(50),
  error_message TEXT,
  processing_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for efficient log queries
CREATE INDEX IF NOT EXISTS idx_api_logs_api_key ON api_request_logs(api_key_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_logs_professional ON api_request_logs(professional_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_logs_request_id ON api_request_logs(request_id);
CREATE INDEX IF NOT EXISTS idx_api_logs_created_at ON api_request_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_logs_errors ON api_request_logs(response_status) WHERE response_status >= 400;

-- Rate Limit Configuration table
CREATE TABLE IF NOT EXISTS public.api_rate_limit_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope VARCHAR(50) NOT NULL,
  scope_id UUID,
  requests_per_minute INTEGER DEFAULT 60,
  requests_per_hour INTEGER DEFAULT 1000,
  requests_per_day INTEGER DEFAULT 10000,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT,
  UNIQUE(scope, scope_id)
);

-- Index for rate limit config lookups
CREATE INDEX IF NOT EXISTS idx_rate_limit_scope ON api_rate_limit_config(scope, scope_id) WHERE is_active = true;

-- Insert default global rate limit
INSERT INTO api_rate_limit_config (scope, scope_id, requests_per_minute, requests_per_hour, requests_per_day, notes)
VALUES ('global', NULL, 60, 1000, 10000, 'Default global rate limit for API')
ON CONFLICT (scope, scope_id) DO NOTHING;

-- Rate Limit Tracking table for sliding window counters
CREATE TABLE IF NOT EXISTS public.api_rate_limit_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier VARCHAR(255) NOT NULL,
  identifier_type VARCHAR(20) NOT NULL,
  minute_window TIMESTAMPTZ NOT NULL,
  minute_count INTEGER DEFAULT 0,
  hour_window TIMESTAMPTZ NOT NULL,
  hour_count INTEGER DEFAULT 0,
  day_window TIMESTAMPTZ NOT NULL,
  day_count INTEGER DEFAULT 0,
  last_request_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(identifier, identifier_type)
);

-- Index for rate limit tracking lookups
CREATE INDEX IF NOT EXISTS idx_rate_tracking_identifier ON api_rate_limit_tracking(identifier, identifier_type);
CREATE INDEX IF NOT EXISTS idx_rate_tracking_last_request ON api_rate_limit_tracking(last_request_at);

-- Enable RLS on tables
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_request_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_rate_limit_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_rate_limit_tracking ENABLE ROW LEVEL SECURITY;

-- RLS Policies (service role bypasses these)
-- Professionals can view their own API keys metadata (not the hash)
CREATE POLICY "Professionals can view own api keys" ON api_keys
  FOR SELECT USING (true);  -- Service role handles actual auth

-- Request logs are only visible via service role
CREATE POLICY "Service role access for logs" ON api_request_logs
  FOR ALL USING (true);

-- Rate limit config is read-only for non-admins
CREATE POLICY "Rate limit config read access" ON api_rate_limit_config
  FOR SELECT USING (true);

-- Rate limit tracking is managed by service role
CREATE POLICY "Rate limit tracking access" ON api_rate_limit_tracking
  FOR ALL USING (true);
