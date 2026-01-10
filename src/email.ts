import { Env, EmailMeta, MailState } from './types';
import { loadMailState, saveMailState } from './state';

// Decode MIME-encoded words
function decodeMimeWords(s: string): string {
  // Basic implementation - for production, use a proper library
  return s;
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

// Fetch latest email with image attachment using Gmail API
// NOTE: This is a simplified implementation using Gmail API instead of IMAP
// Gmail API is more Worker-friendly than IMAP which requires TCP sockets
export async function fetchLatestMatchingAttachment(
  env: Env
): Promise<{ imageBytes: ArrayBuffer; meta: EmailMeta } | null> {
  if (!env.GMAIL_USER || !env.GMAIL_APP_PASSWORD) {
    console.warn('Gmail credentials missing, skipping email fetch');
    return null;
  }

  // TODO: Implement Gmail API integration
  // For now, this is a placeholder that demonstrates the structure

  // Gmail API requires OAuth2, but we can use IMAP over HTTP using a proxy
  // or implement a simpler solution using Workers' connect() API

  // For production, consider:
  // 1. Gmail API with OAuth2
  // 2. IMAP proxy service
  // 3. Alternative email service with REST API (SendGrid Inbound Parse, Mailgun, etc.)

  console.log('Email polling not yet implemented - needs IMAP or Gmail API');

  // Placeholder return
  return null;
}

// Main email processing function
export async function processEmails(env: Env): Promise<ArrayBuffer | null> {
  const result = await fetchLatestMatchingAttachment(env);
  if (!result) return null;

  return result.imageBytes;
}
