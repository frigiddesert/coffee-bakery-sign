# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a digital signage system for Village Roaster coffee shop, built on **Cloudflare Workers**. It displays current roasting and baking status on a TV screen, updated via:
- QR code scans (instant roast updates)
- Email with whiteboard photos (OCR + fuzzy matching for bake items)

**Key architectural note:** This was migrated from Python/Flask on Render to TypeScript/Cloudflare Workers. Original Python code is preserved in `python-legacy/` for reference.

## Development Commands

```bash
# Local development with hot reload
npm run dev
# Serves at http://localhost:8787

# Deploy to production
npm run deploy

# View real-time logs from production
npm run tail
```

## Configuration Management

### Wrangler Secrets (Production)
Critical secrets are stored in Cloudflare, not in code:

```bash
# Set required secrets
npx wrangler secret put MISTRAL_API_KEY
npx wrangler secret put MENU_ITEMS  # JSON array: ["Croissants","Sourdough",...]

# Optional secrets
npx wrangler secret put ALLOWED_SENDERS  # Comma-separated emails
npx wrangler secret put GMAIL_USER       # Not needed if using Email Routing
npx wrangler secret put GMAIL_APP_PASSWORD

# List configured secrets
npx wrangler secret list

# Delete a secret
npx wrangler secret delete SECRET_NAME
```

### Local Development Secrets
For local testing, create `.dev.vars` (gitignored):
```
MISTRAL_API_KEY=your-key-here
MENU_ITEMS=["Item1","Item2"]
```

### Environment Variables
Non-secret config in `wrangler.toml`:
- `APP_TZ` - Timezone for daily resets (default: America/Denver)
- `RESET_HOUR` - Hour to reset state (default: 6)
- `SHIFT_START_HOUR`, `SHIFT_END_HOUR` - For baking progress calculation
- `STATE_POLL_SECONDS` - Display refresh rate
- `EMAIL_SUBJECT_TRIGGER`, `EMAIL_SUBJECT_PASSCODE` - Email security

## Architecture

### Worker Structure
The Worker exports three handlers in `src/index.ts`:
1. **`fetch()`** - HTTP requests (display page + API endpoints)
2. **`scheduled()`** - Cron trigger (daily reset at 6 AM)
3. **`email()`** - Cloudflare Email Routing handler (push-based email processing)

### State Management
- **Storage:** Cloudflare KV (persistent, globally distributed)
- **Keys:** `STATE` (display state), `MAIL_STATE` (email tracking)
- **Structure:** See `State` interface in `src/types.ts`
- **Daily Reset:** State resets at configured hour (default 6 AM)
- **KV Namespace ID:** `35352ae010ec4a6792aedc0d37a426b6` (in wrangler.toml)

### Email Processing Flow
1. Email sent to `baking@sandland.us` (configured in Cloudflare Dashboard)
2. Cloudflare Email Routing triggers `email()` handler
3. `src/email-handler.ts` extracts image from MIME
4. Validates sender allowlist and subject trigger/passcode
5. Calls Mistral Vision API for OCR (`src/ocr.ts`)
6. Fuzzy matches extracted text to menu (`src/fuzzy.ts` using fuzzball library)
7. Updates KV state via `src/state.ts`

**Critical:** Email processing is **push-based** (instant), not polling. The cron job only handles daily resets.

### API Endpoints
- `GET /` - Display page (inlined HTML with polling JS)
- `GET /api/state` - Current state (polled by display every 10s)
- `GET/POST /api/roast?item=Name` - Update current roast (via QR scan)
- `POST /api/bake` - Bulk update bake items
- `GET /health` - Health check
- `GET /api/debug` - Debug state dump

### Frontend Architecture
The display is a **single HTML page** (no build step) embedded in `src/index.ts` as `HTML_TEMPLATE`:
- Two-column layout: Roasting (left) | Baking (right)
- Polls `/api/state` every 10 seconds
- Auto-calculates "Baking Now" (first 3) vs "Coming Up Soon" (rest)
- Responsive: stacks to single column on mobile

## Key Implementation Details

### Timezone Handling
All date/time logic respects `APP_TZ` from wrangler.toml:
```typescript
// src/state.ts
nowLocal(timezone: string): Date  // Current time in configured TZ
todayKey(timezone: string): string // YYYY-MM-DD in TZ
```

### Baking Progress Window
`computeBakeWindow()` in `src/state.ts` calculates which item should be highlighted based on:
- Current time within shift hours (SHIFT_START_HOUR to SHIFT_END_HOUR)
- Linear interpolation across the item list
- Used by display to show "Baking Now" section

### Fuzzy Matching
`src/fuzzy.ts` uses the `fuzzball` library (JavaScript port of Python's fuzzywuzzy):
- Normalizes OCR text (removes special chars, extra spaces)
- Splits on delimiters (commas, pipes, slashes)
- Fuzzy matches to `MENU_ITEMS` with 80% threshold
- Deduplicates results

### OCR Processing
`src/ocr.ts` calls Mistral Vision API:
- Model: `pixtral-large-latest`
- Input: Base64-encoded JPEG
- Output: Markdown-formatted text extraction
- Converts ArrayBuffer → base64 using `btoa()` in Workers runtime

## Email Routing Setup

**Domain:** `sandland.us` (configured in Cloudflare account)

To enable email processing:
1. Cloudflare Dashboard → sandland.us → Email
2. Enable Email Routing
3. Create routing rule: `baking@sandland.us` → Send to Worker: `village-roaster-sign`
4. Deploy Worker: `npm run deploy`
5. Test by sending email with photo attachment and subject containing trigger/passcode

See `EMAIL_ROUTING_SETUP.md` for detailed steps.

## Working with KV Storage

```bash
# List all keys in namespace
npx wrangler kv key list --namespace-id=35352ae010ec4a6792aedc0d37a426b6

# Get a specific key
npx wrangler kv key get STATE --namespace-id=35352ae010ec4a6792aedc0d37a426b6

# Put a key (testing)
npx wrangler kv key put STATE '{"date":"2026-01-10",...}' --namespace-id=35352ae010ec4a6792aedc0d37a426b6

# Delete a key
npx wrangler kv key delete STATE --namespace-id=35352ae010ec4a6792aedc0d37a426b6
```

## QR Code Generation

Python scripts in `python-legacy/` generate QR codes:

```bash
# Roast update QR (hits /api/roast?item=Name)
python python-legacy/generate_roast_qr.py \
  --base-url https://village-roaster-sign.workers.dev \
  --roast "Honduras" \
  --output qr_honduras.png

# Email QR (opens mail client with pre-filled email)
python python-legacy/generate_mailto_qr.py \
  --email baking@sandland.us \
  --subject "BAKEPLAN BAKE2025" \
  --output mailto_baking_qr.png
```

Requires: `pip install qrcode[pil]`

## Deployment Checklist

When deploying changes:
1. Test locally: `npm run dev`
2. Dry run: `npx wrangler deploy --dry-run`
3. Deploy: `npm run deploy`
4. Monitor: `npm run tail` for live logs
5. Check dashboard: https://dash.cloudflare.com → Workers & Pages → village-roaster-sign

**Note:** Secrets are preserved across deployments. Only need to set them once.

## Debugging

### Check Logs
```bash
npm run tail
# Or visit: Cloudflare Dashboard → village-roaster-sign → Logs
```

### Common Issues

**Display not updating:**
- Verify `/api/state` returns valid JSON
- Check KV state: `npx wrangler kv key get STATE --namespace-id=...`
- Ensure daily reset logic isn't clearing state unexpectedly

**Email not processing:**
- Check logs for "Email received via Cloudflare Email Routing"
- Verify sender in `ALLOWED_SENDERS` (if set)
- Verify subject contains both trigger and passcode
- Check Email Routing dashboard for rejected emails

**Secrets not working:**
- List secrets: `npx wrangler secret list`
- Secrets don't work in local dev by default (use `.dev.vars`)
- Re-set secret if needed: `npx wrangler secret put SECRET_NAME`

## TypeScript Types

Key interfaces in `src/types.ts`:
- `Env` - Worker environment bindings (KV, secrets, vars)
- `State` - Application state structure
- `MailState` - Email tracking state
- `EmailMeta` - Email metadata

## Cost & Performance

**Free Tier Limits:**
- 100,000 Worker requests/day
- Unlimited KV reads, 10,000 writes/day
- Unlimited Email Routing

**Expected Usage:**
- Display polling: ~8,640 req/day
- Roast updates: ~30 req/day
- Email triggers: varies
- **Total:** Well within free tier

## Migration Notes

This project was migrated from Python/Flask/Render. When comparing with `python-legacy/`:
- Flask routes → Worker fetch() handler
- Background IMAP thread → Email Routing (push)
- JSON file storage → Cloudflare KV
- Python rapidfuzz → JavaScript fuzzball
- All functionality preserved, architecture modernized

## Related Documentation

- `README.md` - Quick start and API reference
- `CLOUDFLARE_DEPLOYMENT.md` - Migration guide and deployment basics
- `EMAIL_ROUTING_SETUP.md` - Detailed email setup for sandland.us domain
- `DEPLOY_CHECKLIST.md` - Step-by-step production deployment guide
