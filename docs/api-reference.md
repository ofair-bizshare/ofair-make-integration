# Ofair Lead Submission API Reference

## Overview

The Ofair Lead Submission API allows professionals to programmatically submit leads from external systems like Make.com, Zapier, or custom CRM integrations.

## Base URL

```
https://erlfsougrkzbgonumhoa.supabase.co/functions/v1
```

## Authentication

All API requests require an API key passed in the `X-API-Key` header.

```
X-API-Key: ofair_pk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Getting an API Key

API keys can be generated from the Ofair Pro app settings page or via the API:

```http
POST /create-api-key
Authorization: Bearer <your_auth_token>
Content-Type: application/json

{
  "name": "My Make.com Integration"
}
```

---

## Endpoints

### Submit Lead

Submit a new lead to the Ofair platform.

```http
POST /submit-lead-api
```

#### Headers

| Header | Required | Description |
|--------|----------|-------------|
| `X-API-Key` | Yes | Your API key |
| `Content-Type` | Yes | Must be `application/json` |

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `description` | string | Yes | Lead description (min 10 chars) |
| `location` | string | Yes | City name in Hebrew |
| `profession` | string[] | Yes | Array of professions (1-5) |
| `client_name` | string | Yes | Client's name |
| `client_phone` | string | Yes | Israeli phone format (e.g., 0501234567) |
| `budget` | number | No | Agreed price in ILS |
| `includes_vat` | boolean | No | Whether budget includes 18% VAT |
| `share_percentage` | number | No | Commission percentage (5-40, default: 10) |
| `work_date` | string | No | Work date (YYYY-MM-DD format) |
| `work_time` | string | No | Work time (HH:MM format) |
| `work_timeframe` | string | No | One of: "מיידי", "יומיים הקרובים", "בשבוע הקרוב", "עד חודש", "חודש או יותר" |
| `constraints` | string | No | Special requirements or constraints |
| `media_urls` | string[] | No | Array of image/video URLs |
| `latitude` | number | No | GPS latitude (auto-geocoded if not provided) |
| `longitude` | number | No | GPS longitude (auto-geocoded if not provided) |

#### Example Request

```json
{
  "description": "צריך שיפוץ מטבח כולל החלפת ארונות והתקנת אי",
  "location": "תל אביב",
  "profession": ["שיפוצים", "נגרות"],
  "client_name": "ישראל ישראלי",
  "client_phone": "0501234567",
  "budget": 15000,
  "includes_vat": true,
  "share_percentage": 10,
  "work_timeframe": "בשבוע הקרוב",
  "constraints": "רק בשעות הבוקר"
}
```

#### Success Response (201)

```json
{
  "success": true,
  "lead_id": "550e8400-e29b-41d4-a716-446655440000",
  "request_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7"
}
```

#### Error Response (400)

```json
{
  "error": "validation_error",
  "message": "client_phone must be valid Israeli format (e.g., 0501234567)",
  "field": "client_phone",
  "request_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7"
}
```

---

### Create API Key

Generate a new API key for your account.

```http
POST /create-api-key
```

#### Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Yes | Bearer token from app login |
| `Content-Type` | Yes | `application/json` |

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | No | Friendly name for the key |

#### Success Response (201)

```json
{
  "success": true,
  "api_key": "ofair_pk_7K9mX2nP4qR6sT8vW1xY3zA5bC7dE9fG",
  "key_id": "550e8400-e29b-41d4-a716-446655440000",
  "key_prefix": "ofair_pk",
  "name": "My Integration",
  "message": "Store this API key securely. It will not be shown again."
}
```

> **Important**: The full API key is only shown once. Store it securely.

---

### List API Keys

Get all API keys for your account.

```http
GET /list-api-keys
```

#### Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Yes | Bearer token from app login |

#### Success Response (200)

```json
{
  "success": true,
  "keys": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "key_display": "ofair_pk_****",
      "name": "Make.com Production",
      "is_active": true,
      "created_at": "2025-01-15T10:30:00Z",
      "last_used_at": "2025-01-15T12:45:00Z",
      "expires_at": null,
      "revoked_at": null
    }
  ]
}
```

---

### Revoke API Key

Deactivate an API key.

```http
POST /revoke-api-key
```

#### Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Yes | Bearer token from app login |
| `Content-Type` | Yes | `application/json` |

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `key_id` | string | Yes | UUID of the key to revoke |
| `reason` | string | No | Reason for revocation |

#### Success Response (200)

```json
{
  "success": true,
  "message": "API key revoked successfully"
}
```

---

## Rate Limiting

API requests are rate-limited to prevent abuse:

| Window | Default Limit |
|--------|---------------|
| Per Minute | 60 requests |
| Per Hour | 1,000 requests |
| Per Day | 10,000 requests |

### Rate Limit Headers

All responses include rate limit information:

```
X-RateLimit-Limit-Minute: 60
X-RateLimit-Remaining-Minute: 45
X-RateLimit-Reset-Minute: 2025-01-15T10:31:00Z
X-RateLimit-Limit-Hour: 1000
X-RateLimit-Remaining-Hour: 850
```

### Rate Limit Exceeded (429)

```json
{
  "error": "rate_limit_exceeded",
  "message": "Rate limit exceeded. Please wait before making more requests.",
  "retry_after": 30,
  "limits": {
    "minute": { "remaining": 0, "reset": "2025-01-15T10:31:00Z" }
  },
  "request_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7"
}
```

---

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `missing_api_key` | 401 | X-API-Key header not provided |
| `invalid_api_key` | 401 | API key not found |
| `invalid_api_key_format` | 401 | API key format is incorrect |
| `expired_api_key` | 401 | API key has expired |
| `revoked_api_key` | 401 | API key was revoked |
| `rate_limit_exceeded` | 429 | Too many requests |
| `validation_error` | 400 | Request body validation failed |
| `professional_not_found` | 400 | Associated professional account not found |
| `database_error` | 500 | Database operation failed |
| `internal_error` | 500 | Unexpected server error |

---

## Best Practices

1. **Store API keys securely** - Never commit keys to version control
2. **Use descriptive names** - Name keys by integration (e.g., "Make.com Production")
3. **Rotate keys periodically** - Create new keys and revoke old ones regularly
4. **Handle rate limits** - Implement exponential backoff on 429 responses
5. **Log request IDs** - Store `request_id` for debugging with Ofair support
