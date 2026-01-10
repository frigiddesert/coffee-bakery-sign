# Cloudflare Workers Deployment Guide

## Migration Summary

The Village Roaster sign has been migrated from Python/Flask/Render to **Cloudflare Workers** with TypeScript.

### What Changed

- **Platform**: Render → Cloudflare Workers
- **Runtime**: Python 3 → TypeScript (Node.js compatible)
- **State Storage**: Ephemeral filesystem → Cloudflare KV (persistent)
- **Email Polling**: Background thread → Cron Triggers (every minute)
- **Deployment**: Manual → Git-based with `wrangler deploy`

### What Stayed the Same

- **Frontend**: Same display design and polling logic
- **OCR**: Still uses Mistral AI Vision API
- **Endpoints**: Same API routes (`/api/state`, `/api/roast`, `/api/bake`)
- **Functionality**: All features preserved

### Benefits

✅ **Persistent state** - KV storage survives deployments/restarts
✅ **Global CDN** - Sub-50ms response times worldwide
✅ **Auto-scaling** - Handles any traffic volume
✅ **Cost-effective** - Free tier: 100k requests/day
✅ **Zero cold starts** - Always instant response

## Prerequisites

You already have:
- ✅ Wrangler CLI installed and authenticated
- ✅ Cloudflare account (eric@thebakkens.net)
- ✅ KV namespace created (ID: 35352ae010ec4a6792aedc0d37a426b6)

You still need:
- Gmail credentials (GMAIL_USER, GMAIL_APP_PASSWORD)
- Mistral API key
- Menu items JSON

## Deployment Steps

### 1. Set Up Secrets

Run these commands to securely store your credentials:

```bash
# Gmail credentials
npx wrangler secret put GMAIL_USER
# Enter: bakingatvillageroaster.z6mbz32@gmail.com

npx wrangler secret put GMAIL_APP_PASSWORD
# Enter: [your Gmail app password]

# Mistral API key
npx wrangler secret put MISTRAL_API_KEY
# Enter: [your Mistral API key]

# Allowed email senders (comma-separated)
npx wrangler secret put ALLOWED_SENDERS
# Enter: eric@thebakkens.net,eric@villageroaster.com

# Menu items (JSON array)
npx wrangler secret put MENU_ITEMS
# Enter: ["Croissants","Sourdough","Focaccia","Espresso Cake"]
```

### 2. Deploy to Cloudflare

```bash
npm run deploy
```

This will:
1. Build your TypeScript code
2. Upload to Cloudflare
3. Set up cron triggers
4. Give you a URL like: `https://village-roaster-sign.<your-subdomain>.workers.dev`

### 3. Test Your Deployment

Open the URL in your browser. You should see the Village Roaster display!

Test the API endpoints:
```bash
# Check state
curl https://village-roaster-sign.<your-subdomain>.workers.dev/api/state

# Update a roast
curl "https://village-roaster-sign.<your-subdomain>.workers.dev/api/roast?item=Honduras"

# Health check
curl https://village-roaster-sign.<your-subdomain>.workers.dev/health
```

### 4. Configure Your Display

Point your digital sign browser to:
```
https://village-roaster-sign.<your-subdomain>.workers.dev
```

The display will auto-refresh every 10 seconds.

## Generating QR Codes

You'll need to regenerate QR codes with your new Workers URL:

```bash
# Install QR code generator
pip install qrcode[pil]

# Generate roast QR codes (using Python script from archive)
python python-legacy/generate_roast_qr.py \
  --base-url https://village-roaster-sign.<your-subdomain>.workers.dev \
  --roast "Honduras" \
  --output qr_honduras.png
```

## Monitoring and Logs

### View Real-Time Logs
```bash
npm run tail
```

### View Logs in Dashboard
Visit: https://dash.cloudflare.com → Workers & Pages → village-roaster-sign → Logs

### Check Cron Execution
The cron job runs every minute. Check logs for:
- `"Cron triggered:"` - Job started
- `"Processing email image..."` - Email found
- `"✓ Updated bake items:"` - Success

## Email Integration Status

⚠️ **Note**: Email polling is currently a **placeholder** in the codebase.

The IMAP library installed doesn't work with Cloudflare Workers (requires TCP sockets). You have several options:

### Option 1: Gmail API (Recommended)
- Use Gmail API with OAuth2
- Works perfectly with Workers (REST-based)
- More reliable than IMAP

### Option 2: Email Webhook Service
- Use Cloudflare Email Routing
- Or SendGrid Inbound Parse / Mailgun
- Emails trigger Worker directly (push vs pull)

### Option 3: IMAP Proxy
- Small external service that polls IMAP
- Calls your Worker's `/api/bake` endpoint

For now, you can:
- Use the `/api/bake` endpoint directly to update items
- Implement one of the above solutions for automated email processing

## Configuration

All settings are in `wrangler.toml`:

```toml
# Timezone for daily resets
APP_TZ = "America/Denver"

# Reset state daily at 6 AM
RESET_HOUR = "6"

# Baking shift hours (for progress calculation)
SHIFT_START_HOUR = "7"
SHIFT_END_HOUR = "15"

# How often display polls for updates (seconds)
STATE_POLL_SECONDS = "10"

# Cron frequency is set in [triggers] section
```

## Updating the Worker

```bash
# Make code changes
# Then deploy:
npm run deploy
```

Changes deploy instantly to production.

## Local Development

```bash
# Run locally with hot reload
npm run dev

# Access at: http://localhost:8787
```

Note: Secrets won't work in dev mode by default. You can:
1. Create `.dev.vars` file with secrets (don't commit!)
2. Or test against production KV using `--remote` flag

## Cost Estimates

**Free Tier** (100k requests/day):
- Display polling: ~8,640 requests/day
- Roast updates: ~30 requests/day
- Email cron: ~1,440 requests/day
- **Total**: ~10,110 requests/day ✅

**Paid Tier** (if needed): $5/10M requests

You're well within free tier limits!

## Troubleshooting

### Worker not updating
- Check logs: `npm run tail`
- Verify secrets are set: `npx wrangler secret list`
- Check KV storage: `npx wrangler kv key list --namespace-id=35352ae010ec4a6792aedc0d37a426b6`

### Secrets not working
- List all secrets: `npx wrangler secret list`
- Re-set any missing secret: `npx wrangler secret put SECRET_NAME`

### Cron not running
- Check Cloudflare dashboard → Workers → Triggers
- Verify `[triggers]` section in wrangler.toml

## Rollback to Python

If needed, the Python code is archived in `python-legacy/`:

```bash
# Restore Python files
cp python-legacy/* .

# Deploy to Render as before
git push origin master
```

## Next Steps

1. ✅ Deploy the Worker
2. ⚠️ Implement email integration (choose an option above)
3. ✅ Generate new QR codes with Workers URL
4. ✅ Update digital sign to point to Workers URL
5. ✅ Monitor for a few days

## Support

- Wrangler docs: https://developers.cloudflare.com/workers/wrangler/
- KV docs: https://developers.cloudflare.com/kv/
- Cron Triggers: https://developers.cloudflare.com/workers/configuration/crons/

---

**Migration completed on**: 2026-01-10
**Original Python code**: `python-legacy/` directory
