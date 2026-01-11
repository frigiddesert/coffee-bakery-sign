import { Env, State, MailState } from './types';

const STATE_KEY = 'STATE';
const MAIL_STATE_KEY = 'MAIL_STATE';

// Get current time in configured timezone
export function nowLocal(timezone: string): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: timezone }));
}

// Get today's date key (YYYY-MM-DD)
export function todayKey(timezone: string): string {
  const now = nowLocal(timezone);
  return now.toISOString().split('T')[0];
}

// Get ISO timestamp
export function iso(): string {
  return new Date().toISOString();
}

// Load state from KV
export async function loadState(kv: KVNamespace): Promise<State> {
  const stored = await kv.get(STATE_KEY, 'json');
  if (stored) {
    return stored as State;
  }

  // Default state
  return {
    date: null,
    roast_current: '',
    roasts_today: [],
    bake_items: [],
    bake_source: '',
    updated_at: null,
    last_roast_time: null,
  };
}

// Save state to KV
export async function saveState(kv: KVNamespace, state: State): Promise<void> {
  await kv.put(STATE_KEY, JSON.stringify(state));
}

// Load mail state from KV
export async function loadMailState(kv: KVNamespace): Promise<MailState> {
  const stored = await kv.get(MAIL_STATE_KEY, 'json');
  if (stored) {
    return stored as MailState;
  }

  return { last_uid: null };
}

// Save mail state to KV
export async function saveMailState(kv: KVNamespace, mailState: MailState): Promise<void> {
  await kv.put(MAIL_STATE_KEY, JSON.stringify(mailState));
}

// Ensure daily reset
export async function ensureDailyReset(env: Env): Promise<void> {
  const state = await loadState(env.KV);
  const resetHour = parseInt(env.RESET_HOUR || '6', 10);
  const localNow = nowLocal(env.APP_TZ);
  const tkey = todayKey(env.APP_TZ);

  if (state.date !== tkey && localNow.getHours() >= resetHour) {
    console.log(`Daily reset: ${state.date} → ${tkey}`);

    state.date = tkey;
    state.roast_current = '';
    state.roasts_today = [];
    state.bake_items = [];
    state.bake_source = '';
    state.updated_at = iso();
    state.last_roast_time = null;

    await saveState(env.KV, state);
  }
}

// Determine if we're in "display mode" (Fresh Roasted) vs "roasting mode" (Roasting Now)
export function isDisplayMode(state: State, timezone: string): boolean {
  const localNow = nowLocal(timezone);
  const hour = localNow.getHours();

  // After 6pm, check if we've roasted recently
  if (hour >= 18) {
    // If no roasts today, definitely in display mode
    if (state.roasts_today.length === 0) {
      return false; // No roasts to display
    }

    // If we have a last_roast_time, check if it was more than 30 minutes ago
    if (state.last_roast_time) {
      const lastRoast = new Date(state.last_roast_time);
      const minutesSinceLastRoast = (localNow.getTime() - lastRoast.getTime()) / (1000 * 60);

      // If last roast was more than 30 minutes ago, we're in display mode
      return minutesSinceLastRoast > 30;
    }

    // If no last_roast_time but we have roasts, we're in display mode
    return true;
  }

  // Before 6pm, we're in roasting mode
  return false;
}

// Compute bake window index
export function computeBakeWindow(items: string[], env: Env): number {
  if (items.length === 0) return 0;

  const localNow = nowLocal(env.APP_TZ);
  const hour = localNow.getHours();
  const minute = localNow.getMinutes();

  const shiftStart = parseInt(env.SHIFT_START_HOUR || '7', 10);
  const shiftEnd = parseInt(env.SHIFT_END_HOUR || '15', 10);

  if (hour < shiftStart) return 0;
  if (hour >= shiftEnd) return Math.max(0, items.length - 3);

  const totalMinutes = (shiftEnd - shiftStart) * 60;
  const elapsed = (hour - shiftStart) * 60 + minute;

  const idx = Math.floor((elapsed / Math.max(1, totalMinutes)) * items.length);
  return Math.min(idx, Math.max(0, items.length - 1));
}
