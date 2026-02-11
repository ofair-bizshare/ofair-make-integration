# Ofair Make.com Custom App - Setup Guide

## Step 1: Create the App

1. Login to Make.com
2. Left menu → **Custom Apps** (might be under "More")
3. Click **Create a new app**
4. Fill in:
   - **Name:** `Ofair`
   - **Description:** `שתף עבודות ולידים לפלטפורמת אופייר - מאפשר לבעלי מקצוע להעביר לידים ישירות מה-CRM שלהם`
   - **Audience:** Private (for now)
5. Upload the Ofair logo as icon

## Step 2: Connection (Authentication)

### Parameters tab:
Copy the contents of `connection-parameters.json`

### Communication tab:
Copy the contents of `connection-communication.jsonc`

## Step 3: Base

Copy the contents of `base.jsonc`

## Step 4: Module - Submit Lead

1. Click **Create Module**
2. Fill in:
   - **Template:** Blank module
   - **Type:** Action
   - **Connection:** Ofair API Key
   - **Name:** `submitLead`
   - **Label:** `Submit a Lead`
   - **Description:** `שלח ליד (עבודה) לפלטפורמת אופייר. הליד ישויך אליך ויופץ לבעלי מקצוע רלוונטיים.`
3. Save

### Mappable Parameters tab:
Copy the contents of `module-submit-lead-parameters.json`

### Communication tab:
Copy the contents of `module-submit-lead-communication.jsonc`

### Interface tab:
Copy the contents of `module-submit-lead-interface.json`

## Step 5: Test

1. Create a new Scenario in Make
2. Add the Ofair module → Submit a Lead
3. Create a connection using your API key
4. Fill in test data (use אילת for location!)
5. Click Run once
6. Verify lead was created

## Step 6: Publish

When ready, change from Private to Public and submit for Make review.
