# Cloudflare Email Routing Setup

This guide shows how to set up email-based bake plan updates using **Cloudflare Email Routing** with your domain `sandland.us`.

## How It Works

1. Staff takes whiteboard photo on phone
2. Sends email to `baking@sandland.us` (or any address you choose)
3. Cloudflare Email Routing receives email
4. Routes to your Worker instantly (push-based, no polling!)
5. Worker extracts image, runs OCR, updates bake plan
6. Display updates within seconds

## Benefits Over IMAP Polling

✅ **Instant** - Email triggers Worker immediately (push vs pull)
✅ **Reliable** - No polling failures or authentication issues
✅ **Native** - Built into Cloudflare, no external services
✅ **Free** - Included with your Cloudflare account
✅ **Simple** - Just send an email, no apps needed

## Setup Steps

### 1. Enable Email Routing for sandland.us

```bash
# Via Cloudflare Dashboard (Recommended):
```

1. Go to https://dash.cloudflare.com
2. Select your domain: **sandland.us**
3. Click **Email** in left sidebar
4. Click **Get started** or **Enable Email Routing**
5. Follow prompts to verify your domain (if not already verified)

### 2. Create Destination Address

In the Email Routing dashboard:

1. Click **Destination addresses** tab
2. Click **Create address**
3. Choose **Send to Worker**
4. Name: `Village Roaster Baking Updates`
5. Select Worker: `village-roaster-sign`
6. Click **Create**

### 3. Set Up Routing Rule

In the Email Routing dashboard:

1. Click **Routing rules** tab
2. Click **Create address**
3. Enter custom address: `baking` (creates `baking@sandland.us`)
4. Or use: **Catch-all** to handle any email to your domain
5. Select action: **Send to Worker: village-roaster-sign**
6. Click **Save**

**Recommended addresses:**
- `baking@sandland.us` - Primary baking updates
- `bakery@sandland.us` - Alternative
- Or use catch-all: `*@sandland.us` routes everything to Worker

### 4. Configure Email Security (Optional but Recommended)

Keep your current security settings in `wrangler.toml`:

```toml
EMAIL_SUBJECT_TRIGGER = "BAKEPLAN"
EMAIL_SUBJECT_PASSCODE = "BAKE2025"
```

Or set via secrets:
```bash
npx wrangler secret put EMAIL_SUBJECT_TRIGGER
# Enter: BAKEPLAN

npx wrangler secret put EMAIL_SUBJECT_PASSCODE
# Enter: BAKE2025
```

If set, emails MUST include both in subject line:
- ✅ Subject: "BAKEPLAN BAKE2025" → Processed
- ✅ Subject: "Today's baking BAKEPLAN BAKE2025" → Processed
- ❌ Subject: "Baking today" → Ignored

Set both to empty strings to accept all emails (not recommended).

### 5. Set Allowed Senders (Optional)

Restrict who can send updates:

```bash
npx wrangler secret put ALLOWED_SENDERS
# Enter: eric@thebakkens.net,staff@villageroaster.com
```

Leave empty to allow anyone to send.

### 6. Deploy Your Worker

```bash
npm run deploy
```

The Worker now has email handling enabled!

### 7. Test Email Sending

Send a test email:

**To:** `baking@sandland.us`
**Subject:** `BAKEPLAN BAKE2025` (or whatever you configured)
**Attachment:** Whiteboard photo (JPG, PNG, HEIC)

Within seconds:
1. Worker receives email
2. Extracts image from attachment
3. Runs OCR via Mistral
4. Fuzzy matches items to menu
5. Updates display

**Check logs:**
```bash
npm run tail
```

You should see:
```
Email received via Cloudflare Email Routing
From: your@email.com, Subject: BAKEPLAN BAKE2025
Email passed validation, extracting image...
Found image attachment (1234567 bytes), running OCR...
OCR successful, extracting items...
Extracted 12 candidates from OCR
Matched 8 items to menu
✓ Updated bake items from email: 8 items
```

## Creating QR Code for Email (Optional)

Generate a QR code that opens email app pre-filled:

```bash
python python-legacy/generate_mailto_qr.py \
  --email baking@sandland.us \
  --subject "BAKEPLAN BAKE2025" \
  --output mailto_baking_qr.png
```

Print and post near whiteboard. Staff:
1. Take photo of whiteboard
2. Scan QR code
3. Attach photo
4. Send email

Done! Display updates instantly.

## Email Routing Dashboard

Monitor email delivery:

1. Go to https://dash.cloudflare.com
2. Select **sandland.us**
3. Click **Email** → **Overview**

See:
- Total emails received
- Emails forwarded to Worker
- Rejected emails
- Processing errors

## Troubleshooting

### Email not updating display

**Check Worker logs:**
```bash
npm run tail
```

**Common issues:**

1. **"Sender not allowed"**
   - Add sender to `ALLOWED_SENDERS`
   - Or set to empty string to allow all

2. **"Subject doesn't match trigger/passcode"**
   - Check subject includes both `EMAIL_SUBJECT_TRIGGER` and `EMAIL_SUBJECT_PASSCODE`
   - Or disable by setting both to empty strings

3. **"No image attachment found"**
   - Ensure photo is attached (not inline)
   - Supported formats: JPG, PNG, HEIC, GIF

4. **"OCR returned empty text"**
   - Image quality too low
   - Try clearer photo with better lighting
   - Check Mistral API key is valid

### Emails not reaching Worker

**Check Email Routing dashboard:**
- Verify routing rule is active
- Check destination Worker is correct
- Look for rejected emails in overview

**Verify DNS:**
- MX records should be set by Cloudflare Email Routing
- Check DNS tab shows Email Routing MX records

### Worker deployment issues

**Redeploy with email handler:**
```bash
npm run deploy
```

**Verify email binding:**
Check deployment output shows:
```
✨ Your Worker has access to the following bindings:
- email (Email Routing)
```

## Email Format Tips

**Best practices:**

1. **Photo quality:**
   - Good lighting
   - Clear handwriting
   - Close-up shot of whiteboard
   - Avoid shadows/glare

2. **Subject line:**
   - Include trigger and passcode
   - Example: "BAKEPLAN BAKE2025 Today's items"

3. **Attachment:**
   - Attach photo directly (don't paste inline)
   - One photo per email
   - Most recent email wins if multiple sent

## Alternative: Catch-All Routing

Want to handle ALL emails to sandland.us?

1. In Email Routing → Routing rules
2. Create catch-all rule: `*@sandland.us`
3. Route to Worker: `village-roaster-sign`

Now ANY email to ANY address at sandland.us triggers the Worker.

Examples that would work:
- `baking@sandland.us`
- `bakery@sandland.us`
- `whiteboard@sandland.us`
- `anything@sandland.us`

Still filtered by subject trigger/passcode if configured.

## Cost

**Cloudflare Email Routing:** FREE
- Unlimited emails
- Unlimited routing rules
- Unlimited Workers triggers

**Worker Executions:** FREE TIER
- 100,000 requests/day
- Email triggers count as requests
- Well within limits (even with spam)

## Security Considerations

**Recommended settings:**

1. ✅ Use `EMAIL_SUBJECT_PASSCODE` (prevents spam from updating display)
2. ✅ Set `ALLOWED_SENDERS` (restricts to known emails)
3. ✅ Use specific address (not catch-all) for production
4. ✅ Rotate passcode periodically

**Avoid:**
- ❌ Empty passcode with catch-all (anyone could update)
- ❌ Sharing passcode publicly
- ❌ Using predictable passcode like "BAKE1234"

## Migration from Gmail IMAP

If you were using Gmail polling before:

**Old way (IMAP):**
- Worker polls Gmail every 60 seconds
- Pulls unread messages
- Marks as read after processing
- Required: Gmail App Password

**New way (Email Routing):**
- Email arrives → Worker triggered instantly
- No polling, no credentials needed
- Cloudflare handles everything
- Simpler, faster, more reliable

**No Gmail credentials needed!** You can remove:
- `GMAIL_USER`
- `GMAIL_APP_PASSWORD`

Just keep `MISTRAL_API_KEY` and `MENU_ITEMS`.

## Next Steps

1. ✅ Enable Email Routing for sandland.us
2. ✅ Create routing rule: `baking@sandland.us` → Worker
3. ✅ Deploy Worker: `npm run deploy`
4. ✅ Test with whiteboard photo email
5. ✅ Generate QR code for staff
6. ✅ Monitor logs: `npm run tail`

---

**Setup completed:** Configure Email Routing in Cloudflare Dashboard
**Email address:** `baking@sandland.us` (or your choice)
**Worker:** `village-roaster-sign` (email handler enabled)
