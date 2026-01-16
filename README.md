# Village Roaster Digital Signage

A real-time digital signage system for Village Roaster coffee shop, built on **Cloudflare Workers**. Displays current roasting and baking status on in-store TV screens, updated instantly via QR code scans and email photo submissions.

## Features

- **Live Roast Display** - Shows what coffee is being roasted right now
- **Baking Status** - Displays today's baking plan with progress tracking
- **QR Code Updates** - Staff scan codes to instantly update roast status
- **Email OCR Integration** - Send a whiteboard photo to automatically extract baking items
- **Smart Headers** - Column titles change based on time of day and data freshness
- **Data Persistence** - Content preserved until new data arrives (no blank screens)

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLOUDFLARE EDGE                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────────┐ │
│  │   Worker    │    │  KV Store   │    │   Email Routing         │ │
│  │  (TypeScript)│◄──►│  (State)    │    │   (Push-based)          │ │
│  └──────┬──────┘    └─────────────┘    └───────────┬─────────────┘ │
│         │                                          │               │
│         │  HTTP Handlers:                          │               │
│         │  • GET /           Display page          │               │
│         │  • GET /api/state  Poll state            │               │
│         │  • GET /api/roast  QR scan update        │               │
│         │  • POST /api/bake  Bulk bake update      │               │
│         │                                          │               │
│         │  Cron Handler:                           │               │
│         │  • 6 AM daily reset                      │               │
│         │                                          │               │
│         │  Email Handler:            ◄─────────────┘               │
│         │  • Parse attachment                                      │
│         │  • OCR via Mistral AI                                    │
│         │  • Fuzzy match to menu                                   │
│         │  • Update KV state                                       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
         │                              ▲
         ▼                              │
┌─────────────────┐           ┌─────────────────┐
│   TV Display    │           │  Staff Email    │
│   (Browser)     │           │  with Photo     │
│   Polls /state  │           │                 │
│   every 10s     │           │                 │
└─────────────────┘           └─────────────────┘
         ▲
         │
┌─────────────────┐
│   QR Code Scan  │
│   → /api/roast  │
└─────────────────┘
```

**Tech Stack:**
- **Platform**: Cloudflare Workers (TypeScript)
- **State Storage**: Cloudflare KV (persistent, globally distributed)
- **OCR**: Mistral AI Vision API (pixtral-large-latest)
- **Fuzzy Matching**: fuzzball library (90% threshold)
- **Email**: Cloudflare Email Routing (push-based, instant)

## Display State Logic

The sign intelligently changes its headers and layout based on time of day and data freshness.

### State Triggers

| Trigger | Endpoint | What it Updates |
|---------|----------|-----------------|
| **QR Code Scan** | `GET /api/roast?item=Name` | `roast_current`, `roasts_today[]`, `last_roast_time` |
| **Email Photo** | Cloudflare Email Routing | `bake_items[]`, `last_bake_time` |
| **6 AM Cron** | Scheduled trigger | Clears `roast_current`, preserves historical data |

### Header Logic Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          VILLAGE ROASTER SIGN                               │
│                         State & Header Logic                                │
└─────────────────────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════════════════
                              TRIGGERS
═══════════════════════════════════════════════════════════════════════════════

  ┌──────────────┐     ┌──────────────────┐     ┌─────────────────────┐
  │   QR SCAN    │     │   EMAIL PHOTO    │     │    6 AM CRON        │
  │  /api/roast  │     │  (Cloudflare)    │     │   Daily Reset       │
  └──────┬───────┘     └────────┬─────────┘     └──────────┬──────────┘
         │                      │                          │
         ▼                      ▼                          ▼
    Sets:                  Sets:                      Preserves:
    • roast_current        • bake_items[]            • roasts_today[]
    • roasts_today[]       • last_bake_time          • bake_items[]
    • last_roast_time                                Clears:
                                                     • roast_current
                                                     • last_roast_time
                                                     • last_bake_time

═══════════════════════════════════════════════════════════════════════════════
                        ROASTING COLUMN (LEFT)
═══════════════════════════════════════════════════════════════════════════════

                     ┌─────────────────────────┐
                     │ Has roasts_today data?  │
                     └───────────┬─────────────┘
                           YES   │   NO
              ┌──────────────────┴──────────────────┐
              ▼                                     ▼
    ┌─────────────────────┐               ┌─────────────────┐
    │ last_roast_time     │               │  Show: "—"      │
    │     set?            │               │  (empty)        │
    └─────────┬───────────┘               └─────────────────┘
         YES  │  NO (stale data)
              │
    ┌─────────┴──────────────────────┐
    ▼                                ▼
  ┌──────────────────┐      ┌────────────────────────┐
  │ Within 30 min?   │      │   "Fresh Roasted:"     │
  └────────┬─────────┘      │   (list all roasts)    │
      YES  │  NO            └────────────────────────┘
           │
    ┌──────┴──────────────────┐
    ▼                         ▼
┌──────────────────┐   ┌────────────────────┐
│ "Roasting Now:"  │   │  After 2pm?        │
│ (current roast)  │   └─────────┬──────────┘
│ + previous list  │        YES  │  NO
└──────────────────┘             │
                          ┌──────┴──────┐
                          ▼             ▼
              ┌────────────────┐  ┌──────────────────┐
              │"Fresh Roasted:"│  │ "Roasting Now:"  │
              │ (list all)     │  │ (waiting)        │
              └────────────────┘  └──────────────────┘

═══════════════════════════════════════════════════════════════════════════════
                         BAKING COLUMN (RIGHT)
═══════════════════════════════════════════════════════════════════════════════

                     ┌─────────────────────────┐
                     │  Has bake_items data?   │
                     └───────────┬─────────────┘
                           YES   │   NO
              ┌──────────────────┴──────────────────┐
              ▼                                     ▼
    ┌─────────────────────┐               ┌─────────────────┐
    │ last_bake_time      │               │  Show: "—"      │
    │     set?            │               │  (empty)        │
    └─────────┬───────────┘               └─────────────────┘
         YES  │  NO (stale data)
              │
    ┌─────────┴──────────────────────┐
    ▼                                ▼
  ┌──────────────────┐      ┌────────────────────────┐
  │ Within 30 min?   │      │   "Fresh Baked:"       │
  └────────┬─────────┘      │   (all items, list)    │
      YES  │  NO            └────────────────────────┘
           │
    ┌──────┴──────────────────┐
    ▼                         ▼
┌──────────────────────┐   ┌──────────────────┐
│   "Baking Now:"      │   │  What time?      │
│   • Baking Now: 1    │   └────────┬─────────┘
│   • Coming Soon: 2+  │            │
│   • Fresh Baked: done│      ┌─────┴─────┬─────────┐
└──────────────────────┘      ▼           ▼         ▼
                         Before 2pm   2pm-6pm   After 6pm
                              │           │         │
                              ▼           ▼         ▼
                        ┌──────────┐ ┌──────────┐ ┌───────────┐
                        │"Baking   │ │"Baked    │ │"Fresh     │
                        │ Now:"    │ │ Today:"  │ │ Baked:"   │
                        │(sections)│ │(all list)│ │(all list) │
                        └──────────┘ └──────────┘ └───────────┘

═══════════════════════════════════════════════════════════════════════════════
                            TIMELINE EXAMPLE
═══════════════════════════════════════════════════════════════════════════════

  6 AM        7 AM         2 PM         6 PM        Next 6 AM
    │           │            │            │             │
    ▼           ▼            ▼            ▼             ▼
 ┌─────────────────────────────────────────────────────────┐
 │ Fresh    │ QR scan → │  Fresh   │   Fresh   │ Fresh    │
 │ Roasted  │ "Roasting │  Roasted │   Roasted │ Roasted  │
 │ (stale)  │  Now:"    │  (>30min)│   (>30min)│ (kept)   │
 └─────────────────────────────────────────────────────────┘
 ┌─────────────────────────────────────────────────────────┐
 │ Fresh    │ Email  →  │  Baked   │   Fresh   │ Fresh    │
 │ Baked    │ "Baking   │  Today   │   Baked   │ Baked    │
 │ (stale)  │  Now:"    │  (>30min)│           │ (kept)   │
 └─────────────────────────────────────────────────────────┘
```

### Summary Table

| Time | Roasting Header | Baking Header | Notes |
|------|-----------------|---------------|-------|
| Morning (no new data) | Fresh Roasted: | Fresh Baked: | Shows yesterday's preserved data |
| After QR scan (<30min) | Roasting Now: | — | Active roasting indicator |
| After email photo (<30min) | — | Baking Now: | Shows sections: Now/Soon/Done |
| After 2pm (>30min since update) | Fresh Roasted: | Baked Today: | Consolidated list view |
| After 6pm | Fresh Roasted: | Fresh Baked: | End of day display |

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Secrets
```bash
npx wrangler secret put MISTRAL_API_KEY
npx wrangler secret put MENU_ITEMS  # JSON array: ["Croissants","Sourdough",...]
npx wrangler secret put ALLOWED_SENDERS  # Optional: comma-separated emails
```

### 3. Deploy
```bash
npm run deploy
```

You'll get a URL like: `https://village-roaster-sign.your-subdomain.workers.dev`

### 4. Set Up Email Routing (Optional)
See `EMAIL_ROUTING_SETUP.md` for configuring Cloudflare Email Routing to receive baking photos.

## Configuration

Edit `wrangler.toml`:

```toml
[vars]
APP_TZ = "America/Denver"          # Timezone for daily resets
RESET_HOUR = "6"                   # Reset state at 6 AM
SHIFT_START_HOUR = "7"             # Baking shift starts
SHIFT_END_HOUR = "15"              # Baking shift ends (3 PM)
STATE_POLL_SECONDS = "10"          # Display refresh rate
ROASTS_MAX = "30"                  # Max roasts to track per day
EMAIL_SUBJECT_TRIGGER = "BAKEPLAN" # Email subject must contain this
EMAIL_SUBJECT_PASSCODE = "BAKE2025" # And this passcode
```

## API Endpoints

### `GET /`
Display page (polls state every 10 seconds, full refresh every 5 minutes)

### `GET /api/state`
Returns current state with computed display modes:
```json
{
  "date": "2026-01-16",
  "roast_current": "Honduras",
  "roasts_today": ["Ethiopia Yirgacheffe", "Guatemala Antigua", "Honduras"],
  "bake_items": ["Croissants", "Sourdough", "Focaccia Sandwich"],
  "bake_current_index": 2,
  "updated_at": "2026-01-16T14:23:45.123Z",
  "display_mode": true,
  "baking_display_mode": "baked_today"
}
```

### `GET/POST /api/roast?item=ItemName`
Update current roast (via QR code scan). Sets `last_roast_time` to trigger "Roasting Now:" mode.

### `POST /api/bake`
Bulk update baking items:
```json
{
  "items": ["Croissants", "Sourdough", "Focaccia Sandwich"],
  "source": "email"
}
```

### `GET /health`
Health check endpoint

### `GET /api/debug`
Debug state dump

## Development

### Run Locally
```bash
npm run dev
# Access at http://localhost:8787
```

Create `.dev.vars` for local secrets:
```
MISTRAL_API_KEY=your-key-here
MENU_ITEMS=["Croissants","Sourdough","Focaccia Sandwich"]
```

### View Production Logs
```bash
npm run tail
```

### Deploy
```bash
npm run deploy
```

## OCR & Fuzzy Matching

When a photo is emailed:

1. **OCR**: Mistral Vision API extracts text from whiteboard photo
2. **Normalize**: Remove special characters, split on delimiters
3. **Clean**: Strip prep keywords (cut, prep, make, bake, half, etc.)
4. **Expand**: Convert abbreviations (H&C → Ham & Cheese, PB → Peanut Butter)
5. **Match**: Fuzzy match against `MENU_ITEMS` with 90% threshold
6. **Dedupe**: Remove duplicates

## QR Code Generation

Use Python scripts to generate QR codes:

```bash
# Roast update QR
uvx --from qrcode --with Pillow python3 python-legacy/generate_roast_qr.py \
  --base-url https://village-roaster-sign.eric-c5f.workers.dev \
  --roast "Honduras" \
  --output qr_codes/honduras.png
```

Print and post QR codes near roasting station. Staff scans to update display instantly.

## File Structure

```
coffee-bakery-sign/
├── src/
│   ├── index.ts        # Main Worker (HTTP + cron + email handlers)
│   ├── state.ts        # KV state management + display mode logic
│   ├── fuzzy.ts        # Fuzzy matching with fuzzball
│   ├── ocr.ts          # Mistral Vision API integration
│   ├── email-handler.ts # Email processing (Cloudflare Email Routing)
│   └── types.ts        # TypeScript interfaces
├── python-legacy/      # Original Python/Flask implementation
├── wrangler.toml       # Cloudflare Workers configuration
├── package.json        # Node.js dependencies
└── tsconfig.json       # TypeScript configuration
```

## Working with KV Storage

```bash
# List keys
npx wrangler kv key list --namespace-id=35352ae010ec4a6792aedc0d37a426b6 --remote

# Get state
npx wrangler kv key get STATE --namespace-id=35352ae010ec4a6792aedc0d37a426b6 --remote

# Manually set state (for testing)
npx wrangler kv key put STATE '{"date":"2026-01-16",...}' \
  --namespace-id=35352ae010ec4a6792aedc0d37a426b6 --remote
```

## Cost & Performance

**Free Tier Limits:**
- 100,000 Worker requests/day
- Unlimited KV reads, 10,000 writes/day
- Unlimited Email Routing

**Expected Usage:**
- Display polling: ~8,640 req/day (10s interval)
- QR scans: ~30 req/day
- Email triggers: ~5 req/day
- **Total**: Well within free tier

## Troubleshooting

**Display shows "—" for everything?**
- Check `/api/state` returns data
- Verify KV has state: `npx wrangler kv key get STATE ...`

**Headers not changing?**
- Check `display_mode` and `baking_display_mode` in `/api/state`
- Verify timezone is correct in `wrangler.toml`

**"Focaccia Sandwich half" appearing?**
- The fuzzy matcher filters "half" - redeploy if this persists

**Email not processing?**
- Check Cloudflare Email Routing is configured
- Verify subject contains trigger AND passcode
- Check sender is in ALLOWED_SENDERS (if set)

## License

ISC
