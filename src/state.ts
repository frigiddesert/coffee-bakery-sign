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
    last_bake_time: null,
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

// Ensure daily reset - preserves content until new data arrives
export async function ensureDailyReset(env: Env): Promise<void> {
  const state = await loadState(env.KV);
  const resetHour = parseInt(env.RESET_HOUR || '6', 10);
  const localNow = nowLocal(env.APP_TZ);
  const tkey = todayKey(env.APP_TZ);

  if (state.date !== tkey && localNow.getHours() >= resetHour) {
    console.log(`Daily reset: ${state.date} → ${tkey}`);

    // Mark as new day but PRESERVE existing content until new data arrives
    // Only clear "current" roast - keep historical data for display
    state.date = tkey;
    state.roast_current = '';  // Clear what's actively roasting
    // Keep roasts_today and bake_items - they become "yesterday's" until replaced
    state.updated_at = iso();
    // Clear timestamps so headers show "stale" mode (Fresh Roasted/Fresh Baked)
    state.last_roast_time = null;
    state.last_bake_time = null;

    await saveState(env.KV, state);
  }
}

// Determine if we're in "display mode" (Fresh Roasted) vs "roasting mode" (Roasting Now)
export function isDisplayMode(state: State, timezone: string): boolean {
  const localNow = nowLocal(timezone);
  const hour = localNow.getHours();

  // If we have roasts but NO last_roast_time, this is stale/preserved data
  // Show "Fresh Roasted" regardless of time until new QR scan
  if (state.roasts_today.length > 0 && !state.last_roast_time) {
    return true;
  }

  // If we have a last_roast_time, check if it was more than 30 minutes ago
  if (state.last_roast_time) {
    const lastRoast = new Date(state.last_roast_time);
    const nowUtc = Date.now();
    const minutesSinceLastRoast = (nowUtc - lastRoast.getTime()) / (1000 * 60);

    // Within 30 minutes of a scan → "Roasting Now"
    if (minutesSinceLastRoast <= 30) {
      return false;
    }
  }

  // After 2pm with roasts → "Fresh Roasted"
  if (hour >= 14 && state.roasts_today.length > 0) {
    return true;
  }

  // Before 2pm with recent activity → "Roasting Now"
  return false;
}

// Determine baking display mode
// Returns: "baking" | "baked_today" | "fresh_baked"
export function getBakingDisplayMode(state: State, timezone: string): string {
  const localNow = nowLocal(timezone);
  const hour = localNow.getHours();

  // If we have bake items but NO last_bake_time, this is stale/preserved data
  // Show "Fresh Baked" regardless of time until new photo is submitted
  if (state.bake_items.length > 0 && !state.last_bake_time) {
    return 'fresh_baked';
  }

  // If we recently received new bake items (within 30 minutes), always show "Baking Now"
  if (state.last_bake_time) {
    const lastBake = new Date(state.last_bake_time);
    const nowUtc = Date.now();
    const minutesSinceLastBake = (nowUtc - lastBake.getTime()) / (1000 * 60);
    if (minutesSinceLastBake <= 30) {
      return 'baking';
    }
  }

  // After 6pm: "Fresh Baked"
  if (hour >= 18) {
    return 'fresh_baked';
  }

  // After 2pm but before 6pm: "Baked Today"
  if (hour >= 14) {
    return 'baked_today';
  }

  // Before 2pm: "Baking Now" (if we have recent data)
  return 'baking';
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
