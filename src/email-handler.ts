import { Env } from './types';
import { loadState, saveState, todayKey, iso } from './state';
import { splitCandidateLines, fuzzyMatchToMenu, loadMenuItems } from './fuzzy';
import { mistralOcrImageBytes } from './ocr';
import PostalMime from 'postal-mime';

// Email Worker handler for Cloudflare Email Routing
// This handles incoming emails sent via Cloudflare Email Routing

// Check if sender is allowed
function senderAllowed(fromHeader: string, allowedSenders: string): boolean {
  if (!allowedSenders) return true;

  const allowed = allowedSenders.split(',').map((s) => s.trim().toLowerCase());
  const from = fromHeader.toLowerCase();

  return allowed.some((a) => from.includes(a));
}

// Check if subject matches baking-related keywords
function subjectMatches(subject: string, env: Env): boolean {
  const normalized = subject.toLowerCase();

  // Recognize any of these variations (case-insensitive)
  const keywords = ['bakeplan', 'bake plan', 'baking plan', 'baking'];

  return keywords.some(keyword => normalized.includes(keyword));
}

// Main email handler for Cloudflare Email Routing
export async function handleEmail(message: any, env: Env): Promise<void> {
  try {
    console.log('Email received via Cloudflare Email Routing');
    console.log('Message object keys:', Object.keys(message));

    // Get email metadata - Cloudflare Email Message format
    const from = message.from || '';
    const to = message.to || '';

    // Try different ways to get subject
    let subject = '';
    try {
      if (message.headers && typeof message.headers.get === 'function') {
        subject = message.headers.get('subject') || '';
      } else if (message.headers && message.headers.subject) {
        subject = message.headers.subject;
      }
    } catch (e) {
      console.error('Error getting subject:', e);
    }

    console.log(`From: ${from}, Subject: ${subject}, To: ${to}`);

    // Check sender allowlist
    if (!senderAllowed(from, env.ALLOWED_SENDERS || '')) {
      console.warn(`Sender not allowed: ${from}`);
      return;
    }

    // Check subject for baking keywords
    if (!subjectMatches(subject, env)) {
      console.log(`Subject doesn't contain baking keywords: ${subject}`);
      return;
    }

    console.log('Email passed validation, parsing email...');

    // Parse email with postal-mime
    const parser = new PostalMime();
    const parsedEmail = await parser.parse(message.raw);

    console.log(`Email has ${parsedEmail.attachments.length} attachment(s)`);

    // Find first image attachment
    const imageAttachment = parsedEmail.attachments.find((att: any) =>
      att.mimeType?.startsWith('image/')
    );

    if (!imageAttachment) {
      console.warn('No image attachment found in email');
      return;
    }

    console.log(`Found image attachment: ${imageAttachment.filename} (${imageAttachment.content.byteLength} bytes), running OCR...`);

    const imageBytes = imageAttachment.content;

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
    state.last_bake_time = iso(); // Track when bake items were updated
    await saveState(env.KV, state);

    console.log(`✓ Updated bake items from email: ${plan.length} items`);
  } catch (error) {
    console.error('Email processing failed:', error);
    console.error('Error details:', error instanceof Error ? error.stack : String(error));
    // Don't throw - we don't want to bounce/drop emails on errors
    // Just log and return
  }
}
