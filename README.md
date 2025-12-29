# Ofair Make.com Integration

External API for Ofair lead submission, enabling professionals to integrate their CRM systems and automation tools (Make.com, Zapier, etc.) with the Ofair platform.

## Features

- **API Key Authentication**: Secure per-professional API keys
- **Lead Submission API**: Submit leads programmatically
- **Rate Limiting**: Configurable rate limits per key/professional
- **Request Logging**: Full request/response tracing for debugging
- **Self-Service Key Management**: Generate, list, and revoke API keys

## Architecture

This repository contains Supabase Edge Functions that connect to the same Supabase project as the main Ofair Pro app:

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────┐
│  Make.com /     │────▶│  submit-lead-api     │────▶│  Supabase   │
│  CRM / Zapier   │     │  (Edge Function)     │     │  Database   │
└─────────────────┘     └──────────────────────┘     └─────────────┘
        │                        │
        │                        ▼
        │               ┌──────────────────┐
        │               │  API Key Auth    │
        │               │  Rate Limiting   │
        │               │  Request Logging │
        │               └──────────────────┘
        │
        ▼
┌─────────────────┐     ┌──────────────────────┐
│  Ofair Pro App  │────▶│  API Key Management  │
│  (Settings)     │     │  (Edge Functions)    │
└─────────────────┘     └──────────────────────┘
```

## Quick Start

### 1. Deploy Edge Functions

```bash
# Link to Supabase project (uses same project as pro-ofair-app)
supabase link --project-ref erlfsougrkzbgonumhoa

# Apply database migration
supabase db push

# Deploy all functions
supabase functions deploy submit-lead-api
supabase functions deploy create-api-key
supabase functions deploy list-api-keys
supabase functions deploy revoke-api-key
```

### 2. Generate an API Key

From the Ofair Pro app settings, or via API:

```bash
curl -X POST https://erlfsougrkzbgonumhoa.supabase.co/functions/v1/create-api-key \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "My Integration"}'
```

### 3. Submit a Lead

```bash
curl -X POST https://erlfsougrkzbgonumhoa.supabase.co/functions/v1/submit-lead-api \
  -H "X-API-Key: ofair_pk_your_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "צריך שיפוץ מטבח",
    "location": "תל אביב",
    "profession": ["שיפוצים"],
    "client_name": "ישראל ישראלי",
    "client_phone": "0501234567"
  }'
```

## Documentation

- [API Reference](docs/api-reference.md) - Full endpoint documentation
- [Make.com Setup Guide](docs/make-com-setup.md) - Step-by-step Make.com integration

## Project Structure

```
supabase/
├── functions/
│   ├── _shared/
│   │   ├── cors.ts           # CORS headers
│   │   ├── apiKeyAuth.ts     # API key validation
│   │   ├── rateLimiter.ts    # Rate limiting logic
│   │   ├── requestLogger.ts  # Request logging
│   │   └── leadSubmission.ts # Lead creation logic
│   ├── submit-lead-api/      # Main lead submission endpoint
│   ├── create-api-key/       # Generate new API key
│   ├── list-api-keys/        # List professional's keys
│   └── revoke-api-key/       # Revoke an API key
├── migrations/
│   └── 001_api_integration_tables.sql
└── config.toml
```

## Database Tables

| Table | Description |
|-------|-------------|
| `api_keys` | API key storage (hashed) |
| `api_request_logs` | Request/response logging |
| `api_rate_limit_config` | Rate limit configuration |
| `api_rate_limit_tracking` | Sliding window counters |

## Rate Limits

| Window | Default Limit |
|--------|---------------|
| Per Minute | 60 requests |
| Per Hour | 1,000 requests |
| Per Day | 10,000 requests |

Limits are configurable per API key or professional via the `api_rate_limit_config` table.

## Security

- API keys are stored as SHA-256 hashes (never plaintext)
- Full key shown only once at creation
- Keys can be revoked instantly
- Request logging with sanitized data (masked phone numbers)
- Rate limiting prevents abuse

## Related Projects

- [pro-ofair-app](https://github.com/ofair-bizshare/pro-ofair-app) - Main Ofair Pro mobile app

## License

Proprietary - Ofair Ltd.
