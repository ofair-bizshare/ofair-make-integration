# Make.com Integration Setup Guide

This guide explains how to set up Make.com (formerly Integromat) to automatically submit leads to Ofair from your CRM or other systems.

## Prerequisites

1. An active Ofair Pro account
2. A Make.com account
3. An API key from Ofair (see below)

## Step 1: Generate an API Key

1. Open the Ofair Pro app
2. Go to **Settings** → **API Keys**
3. Click **Create New API Key**
4. Enter a name like "Make.com Integration"
5. **Copy the API key immediately** - it will only be shown once!
6. Store it securely (e.g., in a password manager)

## Step 2: Create a Make.com Scenario

### 2.1 Create New Scenario

1. Log in to Make.com
2. Click **Create a new scenario**
3. Add your trigger module (e.g., Google Sheets, CRM webhook, etc.)

### 2.2 Add HTTP Module

1. Click the **+** button to add a module
2. Search for **HTTP**
3. Select **Make a request**

### 2.3 Configure the HTTP Module

**URL:**
```
https://erlfsougrkzbgonumhoa.supabase.co/functions/v1/submit-lead-api
```

**Method:** POST

**Headers:**

| Key | Value |
|-----|-------|
| X-API-Key | `ofair_pk_your_api_key_here` |
| Content-Type | `application/json` |

**Body Type:** Raw

**Content Type:** JSON (application/json)

**Request Content:**
```json
{
  "description": "{{1.description}}",
  "location": "{{1.city}}",
  "profession": ["{{1.profession}}"],
  "client_name": "{{1.client_name}}",
  "client_phone": "{{1.client_phone}}",
  "budget": {{1.budget}},
  "includes_vat": true,
  "share_percentage": 10,
  "work_timeframe": "מיידי"
}
```

Replace `{{1.field_name}}` with the actual field mappings from your trigger.

### 2.4 Handle Response

Add a **Router** module after the HTTP request to handle success and error cases:

**Route 1: Success (Status = 201)**
- Filter: `{{2.statusCode}}` equals `201`
- Action: Log success, update CRM status, etc.

**Route 2: Error**
- Filter: `{{2.statusCode}}` not equals `201`
- Action: Send alert email, log error, etc.

## Step 3: Field Mapping Reference

### Required Fields

| Make.com Variable | Ofair Field | Example |
|-------------------|-------------|---------|
| `{{trigger.description}}` | description | "צריך שיפוץ מטבח" |
| `{{trigger.city}}` | location | "תל אביב" |
| `{{trigger.profession}}` | profession | ["שיפוצים"] |
| `{{trigger.client_name}}` | client_name | "ישראל ישראלי" |
| `{{trigger.client_phone}}` | client_phone | "0501234567" |

### Optional Fields

| Make.com Variable | Ofair Field | Default |
|-------------------|-------------|---------|
| `{{trigger.budget}}` | budget | null |
| `{{trigger.vat_included}}` | includes_vat | false |
| `{{trigger.commission}}` | share_percentage | 10 |
| `{{trigger.work_date}}` | work_date | null |
| `{{trigger.work_time}}` | work_time | null |
| `{{trigger.timeframe}}` | work_timeframe | "מיידי" |
| `{{trigger.notes}}` | constraints | null |

## Step 4: Testing

1. Click **Run once** in Make.com
2. Trigger a test event from your source system
3. Check the HTTP module output for:
   - `statusCode: 201` = Success
   - `body.lead_id` = The created lead ID

## Example Scenarios

### Google Sheets → Ofair

Trigger: New row added to Google Sheet

```json
{
  "description": "{{1.A}} - {{1.B}}",
  "location": "{{1.C}}",
  "profession": ["{{1.D}}"],
  "client_name": "{{1.E}}",
  "client_phone": "{{1.F}}",
  "budget": {{if(1.G; 1.G; "null")}},
  "work_timeframe": "{{1.H}}"
}
```

### Monday.com → Ofair

Trigger: Item status changed to "Ready for Ofair"

```json
{
  "description": "{{1.name}} - {{1.column_values.text}}",
  "location": "{{1.column_values.location.city}}",
  "profession": ["{{1.column_values.dropdown.labels}}"],
  "client_name": "{{1.column_values.text0}}",
  "client_phone": "{{1.column_values.phone}}",
  "budget": {{1.column_values.numbers}}
}
```

### HubSpot → Ofair

Trigger: Deal moved to "Submit Lead" stage

```json
{
  "description": "{{1.properties.dealname}}",
  "location": "{{1.properties.city}}",
  "profession": ["{{1.properties.service_type}}"],
  "client_name": "{{1.associations.contacts[0].properties.firstname}} {{1.associations.contacts[0].properties.lastname}}",
  "client_phone": "{{1.associations.contacts[0].properties.phone}}",
  "budget": {{1.properties.amount}}
}
```

## Troubleshooting

### Error: "missing_api_key"
- Ensure X-API-Key header is set correctly
- Check for extra spaces in the header value

### Error: "invalid_api_key"
- Verify the API key is correct and hasn't been revoked
- Generate a new key if needed

### Error: "validation_error"
- Check the `field` property in the error response
- Ensure required fields are not empty
- Phone must be Israeli format (0501234567)

### Error: "rate_limit_exceeded"
- Add a delay between requests
- Check `retry_after` value and wait accordingly
- Consider batching requests

## Support

For issues with the API integration:
- Check the API request logs in Make.com
- Use the `request_id` from error responses when contacting support
- Email: support@ofair.co.il
