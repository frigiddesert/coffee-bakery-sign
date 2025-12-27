import os
import re
import json
import time
import base64
from io import BytesIO
import threading
import imaplib
import logging
from typing import Optional, Tuple
from email import message_from_bytes
from email.header import decode_header
from email.message import Message
from datetime import datetime
from zoneinfo import ZoneInfo

import pillow_heif
from PIL import Image, UnidentifiedImageError

from dotenv import load_dotenv
from flask import Flask, jsonify, request, render_template
from rapidfuzz import fuzz, process as rf_process
from mistralai import Mistral

load_dotenv()
pillow_heif.register_heif_opener()

logging.basicConfig(
    level=logging.INFO, format="[%(asctime)s] %(levelname)s %(message)s"
)
logger = logging.getLogger("village-roaster")

APP_TZ = os.getenv("APP_TZ", "America/Denver")
RESET_HOUR = int(os.getenv("RESET_HOUR", "6"))
SHIFT_START_HOUR = int(os.getenv("SHIFT_START_HOUR", "7"))
SHIFT_END_HOUR = int(os.getenv("SHIFT_END_HOUR", "15"))
STATE_POLL_SECONDS = int(os.getenv("STATE_POLL_SECONDS", "10"))
EMAIL_POLL_SECONDS = int(os.getenv("EMAIL_POLL_SECONDS", "60"))

GMAIL_USER = os.getenv("GMAIL_USER", "").strip()
GMAIL_APP_PASSWORD = os.getenv("GMAIL_APP_PASSWORD", "").strip()
ALLOWED_SENDERS = [
    x.strip().lower() for x in os.getenv("ALLOWED_SENDERS", "").split(",") if x.strip()
]
EMAIL_SUBJECT_TRIGGER = os.getenv("EMAIL_SUBJECT_TRIGGER", "").strip()
EMAIL_SUBJECT_PASSCODE = os.getenv("EMAIL_SUBJECT_PASSCODE", "").strip()

MISTRAL_API_KEY = os.getenv("MISTRAL_API_KEY", "").strip()
MENU_ITEMS = os.getenv("MENU_ITEMS", "").strip()
MENU_ITEMS_FILE = os.getenv("MENU_ITEMS_FILE", "").strip()
ROASTS_MAX = int(os.getenv("ROASTS_MAX", "30"))

app = Flask(__name__)
lock = threading.Lock()

state = {
    "date": None,
    "roast_current": "",
    "roasts_today": [],
    "bake_items": [],
    "bake_source": "",
    "updated_at": None,
}
mail_state = {"last_uid": None}


def now_local():
    return datetime.now(tz=ZoneInfo(APP_TZ))


def today_key(dt=None):
    dt = dt or now_local()
    return dt.strftime("%Y-%m-%d")


def iso(dt=None):
    dt = dt or now_local()
    return dt.isoformat()


def ensure_daily_reset():
    with lock:
        local = now_local()
        tkey = today_key(local)
        if state["date"] != tkey and local.hour >= RESET_HOUR:
            state.update(
                {
                    "date": tkey,
                    "roast_current": "",
                    "roasts_today": [],
                    "bake_items": [],
                    "bake_source": "",
                    "updated_at": iso(local),
                }
            )


def load_menu_items():
    if MENU_ITEMS:
        try:
            arr = json.loads(MENU_ITEMS)
            if isinstance(arr, list):
                return [str(x).strip() for x in arr if str(x).strip()]
        except Exception:
            pass

    if MENU_ITEMS_FILE and os.path.exists(MENU_ITEMS_FILE):
        try:
            with open(MENU_ITEMS_FILE, "r", encoding="utf-8") as f:
                arr = json.load(f)
            if isinstance(arr, list):
                return [str(x).strip() for x in arr if str(x).strip()]
        except Exception:
            pass

    return []


def normalize_text(s: str) -> str:
    s = s.strip()
    s = s.replace("•", " ").replace("·", " ").replace("—", "-")
    s = re.sub(r"\s+", " ", s)
    return s


def split_candidate_lines(ocr_text: str) -> list[str]:
    raw_lines = []
    for line in ocr_text.splitlines():
        line = normalize_text(line)
        if not line:
            continue
        if len(line) < 2:
            continue
        raw_lines.append(line)

    out = []
    for line in raw_lines:
        parts = [p.strip() for p in re.split(r"[,|/]+", line) if p.strip()]
        out.extend(parts)

    seen = set()
    final = []
    for x in out:
        key = x.lower()
        if key in seen:
            continue
        seen.add(key)
        final.append(x)
    return final


def fuzzy_match_to_menu(candidates: list[str], menu: list[str]) -> list[str]:
    if not candidates:
        return []
    if not menu:
        return candidates

    matched = []
    used = set()
    for c in candidates:
        best = rf_process.extractOne(c, menu, scorer=fuzz.WRatio)
        if not best:
            continue
        name, score, _ = best
        if score < 80:
            continue
        key = name.lower()
        if key in used:
            continue
        used.add(key)
        matched.append(name)
    return matched


def compute_bake_window(items: list[str]) -> dict:
    local = now_local()
    if not items:
        return {"current_index": 0}

    start = local.replace(hour=SHIFT_START_HOUR, minute=0, second=0, microsecond=0)
    end = local.replace(hour=SHIFT_END_HOUR, minute=0, second=0, microsecond=0)

    if local <= start:
        return {"current_index": 0}
    if local >= end:
        return {"current_index": max(0, len(items) - 3)}

    total_minutes = int((end - start).total_seconds() // 60)
    elapsed = int((local - start).total_seconds() // 60)

    idx = int((elapsed / max(1, total_minutes)) * max(1, len(items)))
    idx = min(idx, max(0, len(items) - 1))
    return {"current_index": idx}


def normalize_image_bytes(image_bytes: bytes, filename: str = "") -> bytes:
    if not image_bytes:
        return image_bytes
    try:
        with Image.open(BytesIO(image_bytes)) as img:
            logger.info(
                "Loaded image %s (%s %dx%d %s)",
                filename or "<unnamed>",
                (img.format or "unknown"),
                img.width,
                img.height,
                img.mode,
            )
            if img.mode not in ("RGB", "RGBA"):
                img = img.convert("RGB")
            elif img.mode == "RGBA":
                img = img.convert("RGB")
            buffer = BytesIO()
            img.save(buffer, format="JPEG", quality=90)
            normalized = buffer.getvalue()
            logger.info(
                "Normalized image %s to JPEG (%d bytes)",
                filename or "<unnamed>",
                len(normalized),
            )
            return normalized
    except UnidentifiedImageError:
        logger.warning("Unrecognized image format for %s; sending raw bytes", filename)
    except Exception:
        logger.exception("Failed to normalize image %s", filename)
    return image_bytes


def mistral_ocr_image_bytes(image_bytes: bytes) -> str:
    if not MISTRAL_API_KEY:
        raise RuntimeError("MISTRAL_API_KEY missing")

    client = Mistral(api_key=MISTRAL_API_KEY)
    b64 = base64.b64encode(image_bytes).decode("utf-8")

    # Use chat completions with vision for OCR
    data_uri = f"data:image/jpeg;base64,{b64}"
    messages = [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": "Extract all text from this image and return it in markdown format. Include any lists, tables, or structured content you see."},
                {"type": "image_url", "image_url": data_uri}
            ]
        }
    ]

    resp = client.chat.complete(
        model="pixtral-large-latest",
        messages=messages
    )

    if hasattr(resp, "choices") and resp.choices:
        return resp.choices[0].message.content or ""

    return ""


def decode_mime_words(s):
    if not s:
        return ""
    parts = decode_header(s)
    out = ""
    for p, enc in parts:
        if isinstance(p, bytes):
            out += p.decode(enc or "utf-8", errors="ignore")
        else:
            out += p
    return out


def sender_allowed(from_header: str) -> bool:
    if not ALLOWED_SENDERS:
        return True
    from_header = (from_header or "").lower()
    return any(a in from_header for a in ALLOWED_SENDERS)


def subject_matches(subject: str) -> bool:
    normalized = (subject or "").upper()
    trigger = (EMAIL_SUBJECT_TRIGGER or "").upper()
    passcode = (EMAIL_SUBJECT_PASSCODE or "").upper()
    if trigger and trigger not in normalized:
        return False
    if passcode and passcode not in normalized:
        return False
    return True


def extract_first_image_attachment(msg: Message) -> Optional[Tuple[bytes, str, str]]:
    part_count = 0
    for idx, part in enumerate(msg.walk()):
        part_count += 1
        if part.is_multipart():
            logger.info("Part %d is multipart container, skipping", idx)
            continue
        ctype = part.get_content_type() or ""
        disposition = part.get("Content-Disposition") or ""
        filename = part.get_filename() or ""
        logger.info(
            "Email part %d -> type=%s disposition=%s filename=%s",
            idx,
            ctype,
            disposition or "<none>",
            filename or "<none>",
        )
        if not ctype.startswith("image/"):
            continue
        payload = part.get_payload(decode=True)
        if not isinstance(payload, (bytes, bytearray)):
            logger.warning("Image part %d missing payload", idx)
            continue
        filename = filename or f"inline-image-{idx}"
        logger.info(
            "Using image part %s (ctype=%s, %s bytes, disposition=%s)",
            filename,
            ctype,
            len(payload),
            disposition or "<none>",
        )
        return bytes(payload), filename, ctype
    logger.warning("No image attachment candidates found in %d parts examined", part_count)
    return None


def imap_fetch_latest_matching_attachment():
    if not (GMAIL_USER and GMAIL_APP_PASSWORD):
        logger.warning("Gmail credentials are missing, skipping IMAP fetch")
        return None, None

    logger.info("Connecting to Gmail IMAP for %s", GMAIL_USER)
    M = imaplib.IMAP4_SSL("imap.gmail.com", 993)
    M.login(GMAIL_USER, GMAIL_APP_PASSWORD)
    M.select("INBOX")

    typ, data = M.search(None, "(UNSEEN)")
    if typ != "OK":
        logger.warning("IMAP search failed (%s)", typ)
        M.logout()
        return None, None

    ids = data[0].split()
    logger.info("Found %d unseen messages", len(ids))
    if not ids:
        M.logout()
        return None, None

    ids = ids[-10:][::-1]

    for msg_id in ids:
        msg_ref = (
            msg_id.decode() if isinstance(msg_id, (bytes, bytearray)) else str(msg_id)
        )
        logger.info("Inspecting message %s", msg_ref)
        typ, msg_data = M.fetch(msg_ref, "(RFC822 UID)")
        if typ != "OK" or not msg_data:
            logger.warning("Failed to fetch %s (%s)", msg_ref, typ)
            continue

        entry = msg_data[0]
        if not entry or len(entry) < 2:
            continue
        raw_bytes = entry[1]
        if not isinstance(raw_bytes, (bytes, bytearray)):
            continue
        msg = message_from_bytes(raw_bytes)

        from_h = decode_mime_words(msg.get("From", ""))
        subj_h = decode_mime_words(msg.get("Subject", ""))
        logger.info(
            "Message from %s subject %s",
            from_h or "<unknown>",
            subj_h or "<no subject>",
        )

        if not sender_allowed(from_h):
            logger.warning("Sender NOT ALLOWED: %s (Allowed senders: %s)", from_h, ALLOWED_SENDERS)
            continue
        if not subject_matches(subj_h):
            logger.info(
                "Skipping email because subject missing trigger/passcode: %s",
                subj_h,
            )
            continue

        logger.info("Sender and subject OK, extracting image attachment...")
        attachment = extract_first_image_attachment(msg)
        if not attachment:
            logger.warning("No image attachment found in email: %s", subj_h)
            continue
        raw_image, filename, ctype = attachment
        prepared_image = normalize_image_bytes(raw_image, filename)

        logger.info("Found matching email %s, running OCR", msg_ref)
        M.store(msg_ref, "+FLAGS", "\\Seen")
        M.logout()
        return prepared_image, {
            "from": from_h,
            "subject": subj_h,
            "filename": filename,
            "content_type": ctype,
        }

    M.logout()
    return None, None


def email_loop():
    time.sleep(3)
    while True:
        try:
            ensure_daily_reset()

            img_bytes, meta = imap_fetch_latest_matching_attachment()
            if img_bytes:
                sender = (meta or {}).get("from", "<unknown>")
                subj = (meta or {}).get("subject", "<no subject>")
                filename = (meta or {}).get("filename", "<no filename>")
                ctype = (meta or {}).get("content_type", "<unknown>")
                logger.info(
                    "Running OCR for email from %s subject %s file %s (%s bytes, %s)",
                    sender,
                    subj,
                    filename,
                    len(img_bytes),
                    ctype,
                )
                try:
                    ocr_text = mistral_ocr_image_bytes(img_bytes)
                except Exception:
                    logger.exception("Mistral OCR failed for %s", subj)
                    time.sleep(max(10, EMAIL_POLL_SECONDS))
                    continue
                if not ocr_text.strip():
                    logger.warning("Mistral OCR returned empty text for %s", filename)
                candidates = split_candidate_lines(ocr_text)
                logger.info("OCR candidates extracted (%d entries)", len(candidates))
                menu = load_menu_items()
                plan = fuzzy_match_to_menu(candidates, menu)
                logger.info("Plan resolved (%d items): %s", len(plan), plan[:5])

                with lock:
                    state["date"] = today_key()
                    state["bake_items"] = plan[:200]
                    state["bake_source"] = ""
                    state["updated_at"] = iso()
                logger.info("✓ State updated with %d bake items at %s", len(plan), state["updated_at"])

        except Exception:
            logger.exception("Background email loop crashed")

        time.sleep(max(10, EMAIL_POLL_SECONDS))


threading.Thread(target=email_loop, daemon=True).start()


@app.route("/")
def index():
    return render_template("index.html", state_poll_seconds=STATE_POLL_SECONDS)


@app.route("/api/state")
def api_state():
    ensure_daily_reset()
    with lock:
        logger.info("API /state called - bake_items count: %d, updated_at: %s",
                   len(state.get("bake_items", [])), state.get("updated_at"))
        bake_window = compute_bake_window(state["bake_items"])
        return jsonify(
            {
                "date": state["date"],
                "roast_current": state["roast_current"],
                "roasts_today": state["roasts_today"],
                "bake_items": state["bake_items"],
                "bake_current_index": bake_window["current_index"],
                "updated_at": state["updated_at"],
            }
        )


@app.route("/api/roast", methods=["GET", "POST"])
def api_roast():
    ensure_daily_reset()
    item = ""
    if request.method == "GET":
        item = request.args.get("item", "").strip()
    else:
        data = request.get_json(silent=True) or {}
        item = str(data.get("item", "")).strip()

    if not item:
        return jsonify({"ok": False, "error": "missing item"}), 400

    with lock:
        state["date"] = today_key()
        state["roast_current"] = item
        if not state["roasts_today"] or state["roasts_today"][-1] != item:
            state["roasts_today"].append(item)
            state["roasts_today"] = state["roasts_today"][-ROASTS_MAX:]
        state["updated_at"] = iso()

    return jsonify({"ok": True})


@app.route("/health")
def health():
    return "ok", 200


@app.route("/api/debug")
def api_debug():
    with lock:
        debug_info = {
            "raw_state": dict(state),
            "state_id": id(state),
            "lock_id": id(lock),
        }
    logger.info("DEBUG: State dump: %s", debug_info)
    return jsonify(debug_info)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5000")))
