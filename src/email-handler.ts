import { Env } from './types';
import { loadState, saveState, todayKey, iso } from './state';
import { splitCandidateLines, fuzzyMatchToMenu, loadMenuItems } from './fuzzy';
import { mistralOcrImageBytes } from './ocr';

// Email Worker handler for Cloudflare Email Routing
// This handles incoming emails sent via Cloudflare Email Routing

interface EmailAttachment {
  filename: string;
  mimeType: string;
  content: ArrayBuffer;
}

// Parse email message and extract attachments
async function parseEmailMessage(message: any): Promise<{
  from: string;
  subject: string;
  attachments: EmailAttachment[];
}> {
  const from = message.from || '';
  const subject = message.headers.get('subject') || '';
  const attachments: EmailAttachment[] = [];

  // Cloudflare Email Messages have a structured format
  // We need to iterate through parts to find images
  const rawEmail = await new Response(message.raw).text();

  // For simplicity with Cloudflare Email Routing, we'll use the structured API
  // The message object provides access to attachments

  return { from, subject, attachments };
}

// Check if sender is allowed
function senderAllowed(fromHeader: string, allowedSenders: string): boolean {
  if (!allowedSenders) return true;

  const allowed = allowedSenders.split(',').map((s) => s.trim().toLowerCase());
  const from = fromHeader.toLowerCase();

  return allowed.some((a) => from.includes(a));
}

// Check if subject matches trigger and passcode
function subjectMatches(subject: string, env: Env): boolean {
  const normalized = subject.toUpperCase();
  const trigger = env.EMAIL_SUBJECT_TRIGGER.toUpperCase();
  const passcode = env.EMAIL_SUBJECT_PASSCODE.toUpperCase();

  if (trigger && !normalized.includes(trigger)) return false;
  if (passcode && !normalized.includes(passcode)) return false;

  return true;
}

// Main email handler for Cloudflare Email Routing
export async function handleEmail(message: any, env: Env): Promise<void> {
  try {
    console.log('Email received via Cloudflare Email Routing');

    // Get email metadata
    const from = message.from || '';
    const subject = message.headers.get('subject') || '';
    const to = message.to || '';

    console.log(`From: ${from}, Subject: ${subject}, To: ${to}`);

    // Check sender allowlist
    if (!senderAllowed(from, env.ALLOWED_SENDERS || '')) {
      console.warn(`Sender not allowed: ${from}`);
      return;
    }

    // Check subject trigger/passcode
    if (!subjectMatches(subject, env)) {
      console.log(`Subject doesn't match trigger/passcode: ${subject}`);
      return;
    }

    console.log('Email passed validation, extracting image...');

    // Get raw email content
    const rawEmail = await new Response(message.raw).arrayBuffer();

    // Parse MIME to find image attachments
    const imageBytes = await extractFirstImageFromEmail(rawEmail);

    if (!imageBytes) {
      console.warn('No image attachment found in email');
      return;
    }

    console.log(`Found image attachment (${imageBytes.byteLength} bytes), running OCR...`);

    // Run OCR with Mistral
    const ocrText = await mistralOcrImageBytes(imageBytes, env.MISTRAL_API_KEY);
    if (!ocrText.trim()) {
      console.warn('OCR returned empty text');
      return;
    }

    console.log('OCR successful, extracting items...');

    // Extract and match items
    const candidates = splitCandidateLines(ocrText);
    console.log(`Extracted ${candidates.length} candidates from OCR`);

    const menu = loadMenuItems(env.MENU_ITEMS);
    const plan = fuzzyMatchToMenu(candidates, menu);
    console.log(`Matched ${plan.length} items to menu`);

    // Update state
    const state = await loadState(env.KV);
    state.date = todayKey(env.APP_TZ);
    state.bake_items = plan.slice(0, 200);
    state.bake_source = 'Email';
    state.updated_at = iso();
    await saveState(env.KV, state);

    console.log(`✓ Updated bake items from email: ${plan.length} items`);
  } catch (error) {
    console.error('Email processing failed:', error);
    throw error;
  }
}

// Extract first image attachment from raw email MIME
async function extractFirstImageFromEmail(rawEmail: ArrayBuffer): Promise<ArrayBuffer | null> {
  // Convert ArrayBuffer to string for parsing
  const decoder = new TextDecoder('utf-8');
  const emailText = decoder.decode(rawEmail);

  // Simple MIME parser to find image attachments
  // This is a basic implementation - for production, consider using a proper MIME parser

  // Look for Content-Type: image/* boundaries
  const imageTypeRegex = /Content-Type:\s*(image\/[a-zA-Z0-9+.-]+)/gi;
  const matches = emailText.match(imageTypeRegex);

  if (!matches) {
    console.log('No image content-type found in email');
    return null;
  }

  // Find base64 encoded image data
  // Typical MIME structure:
  // Content-Type: image/jpeg; name="photo.jpg"
  // Content-Transfer-Encoding: base64
  // Content-Disposition: attachment; filename="photo.jpg"
  //
  // [base64 data here]

  const base64Regex = /Content-Transfer-Encoding:\s*base64\s*\r?\n\r?\n([A-Za-z0-9+/=\r\n]+)/gi;
  const base64Match = base64Regex.exec(emailText);

  if (!base64Match || !base64Match[1]) {
    console.log('No base64 image data found in email');
    return null;
  }

  try {
    // Clean up base64 string (remove newlines and whitespace)
    const base64Clean = base64Match[1].replace(/\s/g, '');

    // Decode base64 to binary
    const binaryString = atob(base64Clean);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    console.log(`Decoded image: ${bytes.byteLength} bytes`);
    return bytes.buffer;
  } catch (error) {
    console.error('Failed to decode base64 image:', error);
    return null;
  }
}
