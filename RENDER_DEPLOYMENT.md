# Render Deployment Guide

## Overview
Deploy your Village Roaster sign to Render for public access. This enables:
1. Display the sign URL on any digital display
2. Update roasting via QR codes that staff can scan
3. Email-based bake plan updates

## Prerequisites (What You Need to Set Up First)

### 1. GitHub Repository
- Push this code to a GitHub repository
- Make sure `.env` is in `.gitignore` (already configured)

### 2. Render Account
- Sign up at https://render.com (free tier works)
- Connect your GitHub account

### 3. Environment Secrets Ready
You'll need these from your `.env` file:
- `GMAIL_USER`
- `GMAIL_APP_PASSWORD`
- `MISTRAL_API_KEY`
- `ALLOWED_SENDERS`
- `MENU_ITEMS`

## Deployment Steps

### Option 1: Web UI Deployment (Easiest)

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Prepare for Render deployment"
   git push origin master
   ```

2. **Create New Web Service on Render**
   - Go to https://dashboard.render.com
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select `coffee-bakery-sign` repository

3. **Configure Service**
   - **Name**: `village-roaster-sign` (or your choice)
   - **Runtime**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn app:app`
   - **Instance Type**: Free (or paid for better performance)

4. **Add Environment Variables**
   Click "Environment" and add each variable from your `.env`:

   ```
   APP_TZ = America/Denver
   GMAIL_USER = bakingatvillageroaster.z6mbz32@gmail.com
   GMAIL_APP_PASSWORD = [your app password]
   MISTRAL_API_KEY = [your mistral key]
   ALLOWED_SENDERS = eric@thebakkens.net,eric@villageroaster.com
   EMAIL_SUBJECT_TRIGGER =
   EMAIL_SUBJECT_PASSCODE =
   MENU_ITEMS = [copy your menu items JSON]
   ```

5. **Deploy**
   - Click "Create Web Service"
   - Wait 5-10 minutes for deployment
   - You'll get a URL like: `https://village-roaster-sign.onrender.com`

### Option 2: Blueprint Deployment (Automated)

1. **Push render.yaml to GitHub**
   ```bash
   git add render.yaml
   git commit -m "Add Render blueprint"
   git push
   ```

2. **Create from Blueprint**
   - Go to https://dashboard.render.com
   - Click "New +" → "Blueprint"
   - Connect repository
   - Select `coffee-bakery-sign`
   - Render will detect `render.yaml` automatically

3. **Add Secret Environment Variables**
   The blueprint configures most settings, but you need to add secrets:
   - `GMAIL_USER`
   - `GMAIL_APP_PASSWORD`
   - `MISTRAL_API_KEY`
   - `ALLOWED_SENDERS`
   - `MENU_ITEMS`

### Option 3: CLI Deployment (Programmatic)

1. **Install Render CLI**
   ```bash
   brew install render  # macOS
   # or download from https://render.com/docs/cli
   ```

2. **Login**
   ```bash
   render login
   ```

3. **Create Service**
   ```bash
   render services create \
     --name village-roaster-sign \
     --type web \
     --repo https://github.com/YOUR_USERNAME/coffee-bakery-sign \
     --branch master \
     --runtime python \
     --build-command "pip install -r requirements.txt" \
     --start-command "gunicorn app:app"
   ```

4. **Set Environment Variables**
   ```bash
   render env set GMAIL_USER "bakingatvillageroaster.z6mbz32@gmail.com"
   render env set GMAIL_APP_PASSWORD "your-password"
   render env set MISTRAL_API_KEY "your-key"
   # ... etc
   ```

5. **Deploy**
   ```bash
   render services deploy village-roaster-sign
   ```

## After Deployment

### 1. Get Your Public URL
Your app will be at: `https://village-roaster-sign.onrender.com` (or your chosen name)

### 2. Test the Display
Open in a browser: `https://village-roaster-sign.onrender.com`

### 3. Generate QR Codes for Roasting Updates
```bash
# Honduras
python3 generate_roast_qr.py \
  --base-url https://village-roaster-sign.onrender.com \
  --roast "Honduras" \
  --output qr_honduras.png

# Kenya AA
python3 generate_roast_qr.py \
  --base-url https://village-roaster-sign.onrender.com \
  --roast "Kenya AA" \
  --output qr_kenya.png

# Mexico
python3 generate_roast_qr.py \
  --base-url https://village-roaster-sign.onrender.com \
  --roast "Mexico" \
  --output qr_mexico.png
```

### 4. Display on Digital Sign
Point your digital sign browser to: `https://village-roaster-sign.onrender.com`

### 5. Update via QR Code
- Staff scans QR code with phone
- Opens URL in browser (auto-updates the sign)
- No app installation needed!

## Continuous Deployment

Once set up, any `git push` to your repository will automatically redeploy on Render!

```bash
# Make changes locally
git add .
git commit -m "Update display styling"
git push

# Render automatically redeploys (takes ~5 minutes)
```

## Monitoring

- **Logs**: https://dashboard.render.com → Your Service → Logs
- **Health**: Your service has a `/health` endpoint
- **Metrics**: Available in Render dashboard

## Troubleshooting

### Service Won't Start
Check logs for missing environment variables or dependency issues.

### Email Not Processing
- Verify `GMAIL_APP_PASSWORD` is correct
- Check logs for IMAP errors
- Ensure `ALLOWED_SENDERS` includes your email

### Display Not Updating
- Check `/api/state` endpoint returns valid JSON
- Verify STATE_POLL_SECONDS is set
- Clear browser cache

## Cost
- **Free Tier**: Works great for this use case
  - Spins down after 15 min inactivity
  - Takes ~30s to wake up on first request

- **Paid Tier** ($7/month):
  - Always on, instant response
  - Recommended for production digital signs

## Security Notes
- Never commit `.env` to git (already in `.gitignore`)
- Use Render's secret management for sensitive data
- Consider adding `EMAIL_SUBJECT_PASSCODE` for security
- Rotate `GMAIL_APP_PASSWORD` periodically
