# Village Roaster Kiosk

Tiny Render deploy: a single Python web service that powers the TV display.

## Structure
- `app.py` – Flask app + background Gmail IMAP worker that OCRs the latest whiteboard photo via Mistral, fuzzy-matches against the menu, and keeps in-memory roast/bake state.
- `templates/index.html` – Playfair Display-powered display that polls `/api/state` and renders the roasted coffee + baking plan with gentle scrolling.
- `generate_mailto_qr.py` – helper that produces a QR code which opens a pre-filled BAKEPLAN email (TO + subject passcode) for kitchen staff.
- `requirements.txt` – pinned dependencies for Flask, Gunicorn, Dotenv, Mistral, OCR image helpers, and QR generation.
- `.env.example` – environment variables for timezone, Gmail App Password, allowed senders/passcodes, and Mistral credentials.

## Deploy
1. Copy `.env.example` to `.env` with your real secrets (see “Email authentication” below).
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Run locally via `python app.py`, or in Render use `gunicorn app:app`.
4. Point the kiosk browser at the deployed URL. No manual refresh needed; it polls every ~10 seconds.
5. Optional QR roast updates: hit `/api/roast?item=Item%20Name` or send a POST JSON with `{"item":"Item Name"}` to update the roasting column.

## Email authentication (subject passcode)
- `EMAIL_SUBJECT_TRIGGER` defaults to `BAKEPLAN`.
- `EMAIL_SUBJECT_PASSCODE` enforces an 8-character token (e.g. `BAKE2025`). A subject must contain **both** the trigger and the passcode to be processed. Rotate this code anytime and regenerate the QR sign.
- `ALLOWED_SENDERS` can be left blank to accept any sender. Keep it populated if you want an additional allowlist.

## Kitchen QR workflow
Generate a QR that opens the staffer’s default mail client with the proper TO + subject string:
```bash
python generate_mailto_qr.py --email bakingatvillageroaster.z6mbz32@gmail.com --subject "BAKEPLAN BAKE2025" --output mailto_qr.png
```
Print the resulting `mailto_qr.png` and post it near the whiteboard. Update the subject argument whenever you rotate the passcode.

## Local OCR sanity check
Before testing Gmail, confirm the Mistral pipeline works with a local photo:
```bash
python ocr_local_test.py path/to/whiteboard.jpg
```
Pass `--api-key` if the `MISTRAL_API_KEY` env var isn’t exported.
