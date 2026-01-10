// Environment bindings for Cloudflare Worker
export interface Env {
  KV: KVNamespace;

  // Configuration
  APP_TZ: string;
  RESET_HOUR: string;
  SHIFT_START_HOUR: string;
  SHIFT_END_HOUR: string;
  STATE_POLL_SECONDS: string;
  EMAIL_POLL_SECONDS: string;
  ROASTS_MAX: string;

  // Secrets
  GMAIL_USER: string;
  GMAIL_APP_PASSWORD: string;
  MISTRAL_API_KEY: string;
  ALLOWED_SENDERS: string;
  MENU_ITEMS: string;

  // Email security
  EMAIL_SUBJECT_TRIGGER: string;
  EMAIL_SUBJECT_PASSCODE: string;
}

// Application state
export interface State {
  date: string | null;
  roast_current: string;
  roasts_today: string[];
  bake_items: string[];
  bake_source: string;
  updated_at: string | null;
}

// Mail tracking state
export interface MailState {
  last_uid: string | null;
}

// Email metadata
export interface EmailMeta {
  from: string;
  subject: string;
  filename: string;
  content_type: string;
}

// Mistral API response
export interface MistralResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}
