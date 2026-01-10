# Deployment Checklist

Your Village Roaster sign is ready to deploy to Cloudflare Workers with Email Routing!

## ✅ Completed

- [x] Migrated from Python/Flask to TypeScript/Workers
- [x] Set up Cloudflare KV for persistent state
- [x] Implemented all API endpoints (state, roast, bake)
- [x] Preserved display design (identical HTML/CSS)
- [x] Integrated Mistral OCR for whiteboard photos
- [x] Ported fuzzy matching logic
- [x] Added Cloudflare Email Routing handler
- [x] Created comprehensive documentation
- [x] Tested Worker build (92.87 KB, builds successfully)
- [x] Wrangler authenticated (eric@thebakkens.net)
- [x] KV namespace created (35352ae010ec4a6792aedc0d37a426b6)

## 📋 Ready to Deploy

### Step 1: Set Up Secrets (5 minutes)

You need to set these secrets once:

```bash
# Mistral API key (for OCR)
npx wrangler secret put MISTRAL_API_KEY
# Enter: [your Mistral API key]

# Menu items (for fuzzy matching)
npx wrangler secret put MENU_ITEMS
# Enter: ["Croissants","Sourdough","Focaccia","Espresso Cake","Cinnamon Rolls"]
# (customize with your actual menu)

# Optional: Sender allowlist (leave empty to allow all)
npx wrangler secret put ALLOWED_SENDERS
# Enter: eric@thebakkens.net,staff@villageroaster.com
# Or press Enter to skip (allows anyone)

# Optional: Gmail credentials (only if you want IMAP backup - NOT needed for Email Routing)
# npx wrangler secret put GMAIL_USER
# npx wrangler secret put GMAIL_APP_PASSWORD
```

**Note:** `EMAIL_SUBJECT_TRIGGER` and `EMAIL_SUBJECT_PASSCODE` are already set in `wrangler.toml` as "BAKEPLAN" and "BAKE2025". You can change them there or override with secrets.

### Step 2: Deploy to Cloudflare (1 minute)

```bash
npm run deploy
```

You'll get a URL like:
```
https://village-roaster-sign.your-subdomain.workers.dev
```

Save this URL - you'll need it for the display and QR codes!

### Step 3: Set Up Email Routing (5 minutes)

Follow the guide in `EMAIL_ROUTING_SETUP.md`:

1. Go to Cloudflare Dashboard → sandland.us → Email
2. Enable Email Routing (if not already enabled)
3. Create routing rule: `baking@sandland.us` → `village-roaster-sign` Worker
4. Test by sending email with photo to `baking@sandland.us`

**Quick test:**
- Subject: `BAKEPLAN BAKE2025`
- Attach: Photo of whiteboard
- Send to: `baking@sandland.us`
- Check logs: `npm run tail`

### Step 4: Configure Display (2 minutes)

Point your digital sign browser to your Worker URL:
```
https://village-roaster-sign.your-subdomain.workers.dev
```

The display will auto-refresh every 10 seconds.

### Step 5: Generate QR Codes (5 minutes)

For roast updates:
```bash
python python-legacy/generate_roast_qr.py \
  --base-url https://village-roaster-sign.your-subdomain.workers.dev \
  --roast "Honduras" \
  --output qr_honduras.png
```

For email baking updates:
```bash
python python-legacy/generate_mailto_qr.py \
  --email baking@sandland.us \
  --subject "BAKEPLAN BAKE2025" \
  --output mailto_baking_qr.png
```

Print and post these QR codes!

## 📊 What You're Getting

### Current State (Python on Render)
- ❌ State lost on every deployment
- ❌ 30-second wake-up time (free tier sleeps)
- ❌ IMAP polling every 60 seconds (slow, unreliable)
- ❌ Single region deployment
- 💰 Free tier (with limitations)

### New State (TypeScript on Cloudflare)
- ✅ Persistent state (survives everything)
- ✅ Always instant response (no cold starts)
- ✅ Instant email processing (push-based)
- ✅ Global CDN (20+ regions worldwide)
- 💰 Free tier (better limits: 100k requests/day)

### Cost Comparison

**Render:**
- Free: 750 hours/month (sleeps after 15min)
- Paid: $7/month (always on)

**Cloudflare Workers:**
- Free: 100,000 requests/day
- Paid: $5 per 10M requests (unlikely to ever need)

**Your expected usage:** ~10,000 requests/day
**Recommendation:** Stay on free tier ✅

## 🔍 Testing Checklist

After deployment, test these:

### Display
- [ ] Visit Worker URL in browser
- [ ] See "Roasting Now" and "Baking Now" sections
- [ ] Display shows "—" (empty state on first load)

### Roast Updates
- [ ] Scan QR code or visit: `/api/roast?item=Honduras`
- [ ] Display updates within 10 seconds
- [ ] Current roast shows "Honduras"

### Email Updates
- [ ] Send email to `baking@sandland.us`
- [ ] Subject: `BAKEPLAN BAKE2025`
- [ ] Attach whiteboard photo
- [ ] Check logs: `npm run tail`
- [ ] Display updates with baking items

### API Endpoints
```bash
# Get current state
curl https://your-worker.workers.dev/api/state

# Update roast
curl "https://your-worker.workers.dev/api/roast?item=Test"

# Health check
curl https://your-worker.workers.dev/health
```

## 📚 Documentation Reference

- `README.md` - Quick start and API reference
- `CLOUDFLARE_DEPLOYMENT.md` - General deployment guide
- `EMAIL_ROUTING_SETUP.md` - Email routing configuration
- `python-legacy/` - Original Python code (archived)

## 🆘 Troubleshooting

### Worker won't deploy
```bash
# Check authentication
npx wrangler whoami

# Check build
npx wrangler deploy --dry-run
```

### Email not working
```bash
# Check logs
npm run tail

# Common issues in EMAIL_ROUTING_SETUP.md
```

### Display not updating
- Check `/api/state` returns valid JSON
- Verify browser has network access
- Clear browser cache

## 🚀 Next Steps After Deployment

1. Monitor for a few days
   - Use `npm run tail` to watch logs
   - Check Cloudflare Dashboard analytics

2. Rotate passcode monthly
   - Update `EMAIL_SUBJECT_PASSCODE` in wrangler.toml
   - Regenerate QR codes
   - Deploy: `npm run deploy`

3. Adjust display timing (optional)
   - Edit `STATE_POLL_SECONDS` in wrangler.toml
   - Edit `SHIFT_START_HOUR` / `SHIFT_END_HOUR` for baking window

4. Push to GitHub
   ```bash
   git push origin master
   ```

---

**Ready to deploy?** Run: `npm run deploy`

**Questions?** Check the docs or run: `npm run tail` to see logs
