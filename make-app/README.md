# Ofair Make.com Custom App

This directory contains the Make.com custom app for Ofair lead submission.

## App Structure

```
make-app/
├── base.json                    # App metadata
├── connection.json              # API key authentication
└── modules/
    ├── submitLead.json          # Module definition
    └── submitLead/
        ├── parameters.json      # Input fields
        ├── communication.json   # API communication
        └── output.json          # Output fields
```

## Installation in Make.com

### Step 1: Create Custom App

1. Go to [Make.com](https://www.make.com/)
2. Navigate to **Apps** → **My Apps** → **Create a new app**
3. Enter app details:
   - Name: `Ofair`
   - Label: `Ofair Lead Submission`

### Step 2: Configure Base

Copy the content from `base.json` to the Base section.

### Step 3: Configure Connection

1. Go to **Connections** tab
2. Create new connection
3. Copy content from `connection.json`

### Step 4: Add Module

1. Go to **Modules** tab
2. Create new module: **Submit Lead**
3. Copy files:
   - `modules/submitLead.json` → Module settings
   - `modules/submitLead/parameters.json` → Parameters
   - `modules/submitLead/communication.json` → Communication
   - `modules/submitLead/output.json` → Output

### Step 5: Test

1. Create a new scenario
2. Add the Ofair module
3. Create connection with your API key
4. Test with sample data

## Getting Your API Key

1. Open the Ofair Professional app
2. Go to Settings → API Keys (coming soon)
3. Generate a new API key
4. Copy and store it securely

## Module: Submit Lead

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| description | text | Detailed work description |
| location | text | City name in Hebrew |
| profession | array | Required profession types |
| client_name | text | Client's full name |
| client_phone | text | Israeli phone number |

### Optional Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| budget | number | - | Budget in ILS |
| includes_vat | boolean | false | Budget includes VAT |
| share_percentage | number | 10 | Revenue share (5-40%) |
| work_date | date | - | Preferred work date |
| work_time | text | - | Preferred time (HH:MM) |
| work_timeframe | text | - | Urgency level |
| constraints | text | - | Special notes |

### Output

| Field | Type | Description |
|-------|------|-------------|
| success | boolean | Operation result |
| lead_id | uuid | Created lead ID |
| request_id | uuid | Request tracking ID |

## Example Scenario

```
Trigger: New CRM Contact
  ↓
Filter: Status = "New Lead"
  ↓
Ofair: Submit Lead
  - description: {{CRM.notes}}
  - location: {{CRM.city}}
  - profession: ["שיפוצים"]
  - client_name: {{CRM.full_name}}
  - client_phone: {{CRM.phone}}
```
