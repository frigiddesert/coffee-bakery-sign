# Village Roaster Kiosk

Digital signage system for Village Roaster coffee shop, powered by **Cloudflare Workers**.

## Overview

This system displays:
- **Current roast** - What coffee is being roasted right now
- **Today's roasts** - All coffees roasted today
- **Baking plan** - Items being baked (from whiteboard photo OCR)

Staff can update the display by:
- Scanning QR codes (updates roasts instantly)
- Sending whiteboard photos via email (OCR extracts baking plan)

## Architecture

**Platform**: Cloudflare Workers (TypeScript)
**State Storage**: Cloudflare KV (persistent, globally distributed)
**OCR**: Mistral AI Vision API (pixtral-large-latest)
**Fuzzy Matching**: fuzzball (JavaScript port of Python's fuzzywuzzy)
**Email Polling**: Cron Triggers (every 60 seconds)

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Secrets
```bash
npx wrangler secret put GMAIL_USER
npx wrangler secret put GMAIL_APP_PASSWORD
npx wrangler secret put MISTRAL_API_KEY
npx wrangler secret put ALLOWED_SENDERS
npx wrangler secret put MENU_ITEMS
```

### 3. Deploy
```bash
npm run deploy
```

You'll get a URL like: `https://village-roaster-sign.your-subdomain.workers.dev`

## Configuration

Edit `wrangler.toml`:

```toml
[vars]
APP_TZ = "America/Denver"          # Timezone for daily resets
RESET_HOUR = "6"                    # Reset state at 6 AM
SHIFT_START_HOUR = "7"              # Baking shift starts
SHIFT_END_HOUR = "15"               # Baking shift ends
STATE_POLL_SECONDS = "10"           # Display refresh rate
EMAIL_POLL_SECONDS = "60"           # Email check frequency
ROASTS_MAX = "30"                   # Max roasts to track per day
EMAIL_SUBJECT_TRIGGER = "BAKEPLAN"  # Email subject must contain this
EMAIL_SUBJECT_PASSCODE = "BAKE2025" # And this passcode
```

## API Endpoints

### `GET /`
Display page (auto-refreshes every 10 seconds)

### `GET /api/state`
Returns current state:
```json
{
  "date": "2026-01-10",
  "roast_current": "Honduras",
  "roasts_today": ["Ethiopia", "Honduras"],
  "bake_items": ["Croissants", "Sourdough", "Focaccia"],
  "bake_current_index": 0,
  "updated_at": "2026-01-10T14:23:45.123Z"
}
```

### `GET/POST /api/roast?item=ItemName`
Update current roast (via QR code scan)

### `POST /api/bake`
Update baking items:
```json
{
  "items": ["Croissants", "Sourdough", "Focaccia"],
  "source": "Manual"
}
```

### `GET /health`
Health check endpoint

## Development

### Run Locally
```bash
npm run dev
# Access at http://localhost:8787
```

### View Logs
```bash
npm run tail
```

### Deploy
```bash
npm run deploy
```

## Generating QR Codes

Use the Python scripts in `python-legacy/`:

```bash
python python-legacy/generate_roast_qr.py \
  --base-url https://your-worker.workers.dev \
  --roast "Honduras" \
  --output qr_honduras.png
```

Print and post QR codes near roasting station. Staff scans to update display instantly.

## Email Integration

The email polling cron is implemented but requires IMAP/Gmail API setup:

**Current Status**: Placeholder implementation
**Options**:
1. Gmail API with OAuth2 (recommended for Workers)
2. Email webhook service (Cloudflare Email Routing, SendGrid)
3. IMAP proxy service

See `CLOUDFLARE_DEPLOYMENT.md` for implementation options.

## File Structure

```
coffee-bakery-sign/
├── src/
│   ├── index.ts      # Main Worker (HTTP + cron handlers)
│   ├── state.ts      # KV state management
│   ├── fuzzy.ts      # Fuzzy matching logic
│   ├── ocr.ts        # Mistral OCR integration
│   ├── email.ts      # Email processing (placeholder)
│   └── types.ts      # TypeScript interfaces
├── python-legacy/    # Original Python/Flask implementation
├── wrangler.toml     # Cloudflare Workers configuration
├── package.json      # Node.js dependencies
└── tsconfig.json     # TypeScript configuration
```

## Migration from Python

This project was migrated from Python/Flask on Render to TypeScript on Cloudflare Workers.

**Why migrate?**
- Persistent state storage (KV vs ephemeral filesystem)
- Global CDN distribution (sub-50ms worldwide)
- Better scaling and reliability
- Lower cost (free tier: 100k requests/day)

Original Python code is preserved in `python-legacy/` directory.

See `CLOUDFLARE_DEPLOYMENT.md` for detailed migration guide.

## Monitoring

- **Dashboard**: https://dash.cloudflare.com → Workers & Pages → village-roaster-sign
- **Real-time logs**: `npm run tail`
- **Analytics**: Cloudflare dashboard shows request volume, errors, latency

## Troubleshooting

**Display not updating?**
- Check `/api/state` endpoint returns valid JSON
- Verify browser can reach Worker URL
- Check browser console for errors

**Roast updates not working?**
- Test endpoint: `curl "https://your-worker.workers.dev/api/roast?item=Test"`
- Check logs: `npm run tail`

**Cron not running?**
- View dashboard → Triggers section
- Check logs for "Cron triggered:" messages

## Cost

**Free Tier**:
- 100,000 requests/day
- Unlimited KV reads (10,000 writes/day)

**Expected Usage**:
- ~10,000 requests/day (display + QR scans + cron)
- Well within free tier limits

## License

ISC

## Support

For Cloudflare Workers questions:
- Docs: https://developers.cloudflare.com/workers/
- Discord: https://discord.gg/cloudflaredev

For project-specific issues:
- GitHub: https://github.com/frigiddesert/coffee-bakery-sign/issues
