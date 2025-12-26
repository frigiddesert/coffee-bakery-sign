# Next Work Session (Dec 26)

## Priorities to tackle tomorrow
1. **Validate Gmail/Mistral pipeline end-to-end** – once the credentials are in place, run `python app.py` locally (or `gunicorn app:app`) and confirm the IMAP worker correctly marks emails seen, pulls the image, and updates `bake_items` for the frontend.
2. **Add automated deployment notes** – link to Render setup steps and include any gotchas (SSL, environment config, keeping the background thread alive) so the next deploy is smooth.
3. **Review QR roast workflow** – test hitting `/api/roast` via QR/HTTP requests, verify the UI updates within the polling window, and document the exact URL format in the README for operators.

Feel free to adjust the order based on what components are blocked by credentials or Render access.