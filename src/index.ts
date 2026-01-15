import { Env } from './types';
import {
  loadState,
  saveState,
  ensureDailyReset,
  todayKey,
  iso,
  computeBakeWindow,
  isDisplayMode,
  getBakingDisplayMode,
} from './state';
import { splitCandidateLines, fuzzyMatchToMenu, loadMenuItems } from './fuzzy';
import { mistralOcrImageBytes, normalizeImageBytes } from './ocr';
import { handleEmail } from './email-handler';

// HTML template for the display
const HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="refresh" content="300" />
  <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
  <meta http-equiv="Pragma" content="no-cache" />
  <meta http-equiv="Expires" content="0" />
  <title>Village Roaster Display</title>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700;800;900&family=Raleway:wght@400;500;600;700;800;900&display=swap" />
  <style>
    :root{--bg: #2B1712;--fg: #F4F1EA;--muted: rgba(244,241,234,.82);--muted2: rgba(244,241,234,.66);}
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {width: 100%;height: 100%;background: var(--bg);color: var(--fg);overflow: hidden;font-family: "Playfair Display", serif;}
    .wrap{width: 100vw;height: 100vh;padding: 4vw;display: grid;grid-template-columns: 1fr 1fr;gap: 6vw;}
    .col{display: flex;flex-direction: column;min-width: 0;padding: 0 2vw;}
    .title{font-weight: 700;letter-spacing: -0.02em;line-height: 1.05;font-size: clamp(53px, 6.24vw, 110px);margin-bottom: 1.5vw;padding-bottom: 1.5vw;border-bottom: 2px solid rgba(244,241,234,.35);}
    .current{font-family: "Raleway", sans-serif;font-weight: 900;letter-spacing: -0.01em;line-height: 1.02;font-size: clamp(82px, 9.3vw, 180px);margin-bottom: 2.8vw;margin-top: 1.5vw;word-break: break-word;hyphens: auto;}
    .subline{font-weight: 600;font-size: clamp(29px, 3.12vw, 53px);color: var(--muted2);margin-top: 2.5vw;margin-bottom: 1.2vw;}
    .bake-now-list{font-family: "Raleway", sans-serif;font-weight: 800;font-size: clamp(43px, 5.04vw, 86px);line-height: 1.25;margin-bottom: 2.5vw;margin-top: 1.5vw;letter-spacing: -0.01em;}
    .bake-now-list div{margin-bottom: 0.8vw;}
    .coming-soon{font-family: "Raleway", sans-serif;font-weight: 600;font-size: clamp(34px, 3.84vw, 67px);color: var(--muted2);opacity: 0.75;line-height: 1.35;margin-top: 1vw;letter-spacing: -0.005em;}
    .roast-previous{font-family: "Raleway", sans-serif;font-weight: 700;font-size: clamp(38px, 4.56vw, 82px);color: var(--muted);line-height: 1.3;margin-top: 1.5vw;letter-spacing: -0.01em;}
    .roast-previous div{margin-bottom: 0.8vw;}
    .divider{position: absolute;left: 50%;top: 5vw;bottom: 5vw;width: 2px;background: rgba(244,241,234,.35);transform: translateX(-2.5vw);pointer-events: none;display: none;}
    @media (min-width: 900px){.divider{ display: block; }}
    @media (max-width: 900px){.wrap{grid-template-columns: 1fr;gap: 6vw;}.divider{ display: none; }}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="col">
      <div class="title" id="roastTitle">Roasting Now:</div>
      <div class="current" id="roastCurrent">—</div>
      <div class="roast-previous" id="roastPrevious"></div>
    </div>
    <div class="col">
      <div class="title" id="bakeTitle">Baking Now:</div>
      <div class="bake-now-list" id="bakeNow">—</div>
      <div class="subline" id="soonHeader">Coming Up Soon:</div>
      <div class="coming-soon" id="bakeSoon">—</div>
      <div class="subline" id="freshHeader" style="margin-top: 2.5vw;">Fresh Baked:</div>
      <div class="coming-soon" id="bakeFresh">—</div>
    </div>
  </div>
  <div class="divider"></div>
  <script>
    const POLL_SECONDS = {{POLL_SECONDS}} || 10;
    // Only escape < and > to prevent HTML injection, leave & as-is for proper display
    function esc(s){return (s ?? "").toString().replaceAll("<","&lt;").replaceAll(">","&gt;");}

    // Dynamically adjust font size for current roast based on text length
    function adjustRoastFontSize(element, text) {
      if (!text || text === "—") {
        element.style.fontSize = "";
        return;
      }

      const length = text.length;
      let fontSize;

      // Adjust font size based on character count
      if (length <= 15) {
        fontSize = "clamp(82px, 9.3vw, 180px)"; // Original size
      } else if (length <= 20) {
        fontSize = "clamp(70px, 8vw, 150px)";
      } else if (length <= 25) {
        fontSize = "clamp(60px, 7vw, 130px)";
      } else if (length <= 30) {
        fontSize = "clamp(50px, 6vw, 110px)";
      } else {
        fontSize = "clamp(45px, 5.5vw, 100px)";
      }

      element.style.fontSize = fontSize;
    }

    async function tick(){
      try{
        const r = await fetch("/api/state", { cache: "no-store" });
        const s = await r.json();

        // Handle display mode vs roasting mode
        const displayMode = s.display_mode || false;
        const roastTitleEl = document.getElementById("roastTitle");
        const roastCurrentEl = document.getElementById("roastCurrent");
        const prevRoastsEl = document.getElementById("roastPrevious");

        if (displayMode) {
          // Display mode: Show "Fresh Roasted:" and all roasts
          roastTitleEl.textContent = "Fresh Roasted:";
          roastCurrentEl.style.display = "none";
          const allRoasts = s.roasts_today || [];
          if (allRoasts.length > 0) {
            prevRoastsEl.innerHTML = allRoasts.map(esc).map(r => \`<div>\${r}</div>\`).join('');
          } else {
            prevRoastsEl.innerHTML = "";
          }
        } else {
          // Roasting mode: Show "Roasting Now:" and current roast
          roastTitleEl.textContent = "Roasting Now:";
          roastCurrentEl.style.display = "block";
          const currentRoast = s.roast_current || "—";
          roastCurrentEl.textContent = currentRoast;
          adjustRoastFontSize(roastCurrentEl, currentRoast);
          const prevRoasts = s.roasts_today || [];
          if (prevRoasts.length > 0) {
            prevRoastsEl.innerHTML = prevRoasts.map(esc).map(r => \`<div>\${r}</div>\`).join('');
          } else {
            prevRoastsEl.innerHTML = "";
          }
        }

        // Handle baking display mode
        const bakingMode = s.baking_display_mode || 'baking';
        const bakeTitleEl = document.getElementById("bakeTitle");
        const bakeItems = s.bake_items || [];
        const bakeCurrentIndex = s.bake_current_index || 0;
        const nowEl = document.getElementById("bakeNow");
        const soonEl = document.getElementById("bakeSoon");
        const freshEl = document.getElementById("bakeFresh");
        const soonHeader = document.getElementById("soonHeader");
        const freshHeader = document.getElementById("freshHeader");

        // Set title based on baking mode
        if (bakingMode === 'fresh_baked') {
          bakeTitleEl.textContent = "Fresh Baked:";
        } else if (bakingMode === 'baked_today') {
          bakeTitleEl.textContent = "Baked Today:";
        } else {
          bakeTitleEl.textContent = "Baking Now:";
        }

        if (bakeItems.length === 0) {
          nowEl.textContent = "—";
          soonEl.textContent = "—";
          freshEl.textContent = "—";
          soonHeader.style.display = "block";
          freshHeader.style.display = "block";
        } else if (bakingMode === 'baked_today' || bakingMode === 'fresh_baked') {
          // End of day mode: show all items in one larger list
          soonHeader.style.display = "none";
          soonEl.style.display = "none";
          freshHeader.style.display = "none";
          freshEl.style.display = "none";

          // Show all items in the main list with larger font
          nowEl.style.fontSize = "clamp(28px, 3.5vw, 50px)";
          nowEl.innerHTML = bakeItems.map(esc).map(item => \`<div>\${item}</div>\`).join('');
        } else {
          // Active baking mode: show sections
          soonHeader.style.display = "block";
          soonEl.style.display = "block";
          freshHeader.style.display = "block";
          freshEl.style.display = "block";
          nowEl.style.fontSize = "";

          // Always show at least 1 item in "Baking Now", 2+ in "Coming Up Soon" if available
          let adjustedIndex = bakeCurrentIndex;
          const remainingAfterCurrent = bakeItems.length - adjustedIndex - 1;

          // If we don't have at least 2 items after current, adjust index back
          if (remainingAfterCurrent < 2 && adjustedIndex > 0) {
            adjustedIndex = Math.max(0, bakeItems.length - 3);
          }

          // Baking Now: show current item
          const currentItems = bakeItems.slice(adjustedIndex, adjustedIndex + 1).map(esc);
          if (currentItems.length > 0) {
            nowEl.innerHTML = currentItems.map(item => \`<div>\${item}</div>\`).join('');
          } else {
            nowEl.textContent = "—";
          }

          // Coming Up Soon: show next 2+ items
          const upcomingItems = bakeItems.slice(adjustedIndex + 1).map(esc);
          if (upcomingItems.length > 0) {
            soonEl.textContent = upcomingItems.join(", ");
          } else {
            soonEl.textContent = "—";
          }

          // Fresh Baked: show items that have already been displayed
          const completedItems = bakeItems.slice(0, adjustedIndex).map(esc);
          if (completedItems.length > 0) {
            freshEl.textContent = completedItems.join(", ");
          } else {
            freshEl.textContent = "—";
          }
        }
      }catch(_e){}
    }
    tick();
    setInterval(tick, Math.max(5, POLL_SECONDS) * 1000);
  </script>
</body>
</html>`;

// Main Worker export
export default {
  // HTTP request handler
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Serve homepage
    if (url.pathname === '/') {
      const html = HTML_TEMPLATE.replace(
        '{{POLL_SECONDS}}',
        env.STATE_POLL_SECONDS || '10'
      );
      return new Response(html, {
        headers: {
          'Content-Type': 'text/html',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      });
    }

    // Health check
    if (url.pathname === '/health') {
      return new Response('ok', { status: 200 });
    }

    // API: Get current state
    if (url.pathname === '/api/state') {
      await ensureDailyReset(env);
      const state = await loadState(env.KV);
      const bakeCurrentIndex = computeBakeWindow(state.bake_items, env);
      const displayMode = isDisplayMode(state, env.APP_TZ);
      const bakingDisplayMode = getBakingDisplayMode(state, env.APP_TZ);

      return new Response(
        JSON.stringify({
          date: state.date,
          roast_current: state.roast_current,
          roasts_today: state.roasts_today,
          bake_items: state.bake_items,
          bake_current_index: bakeCurrentIndex,
          updated_at: state.updated_at,
          display_mode: displayMode, // true = "Fresh Roasted", false = "Roasting Now"
          baking_display_mode: bakingDisplayMode, // "baking" | "baked_today" | "fresh_baked"
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // API: Update roast
    if (url.pathname === '/api/roast') {
      await ensureDailyReset(env);

      let item = '';
      if (request.method === 'GET') {
        item = url.searchParams.get('item') || '';
      } else if (request.method === 'POST') {
        try {
          const body = await request.json();
          item = (body as any).item || '';
        } catch (e) {
          return new Response(
            JSON.stringify({ ok: false, error: 'Invalid JSON' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }
      } else {
        return new Response('Method not allowed', { status: 405 });
      }

      item = item.trim();
      if (!item) {
        return new Response(
          JSON.stringify({ ok: false, error: 'missing item' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const state = await loadState(env.KV);
      state.date = todayKey(env.APP_TZ);
      state.roast_current = item;

      if (
        state.roasts_today.length === 0 ||
        state.roasts_today[state.roasts_today.length - 1] !== item
      ) {
        state.roasts_today.push(item);
        const maxRoasts = parseInt(env.ROASTS_MAX || '30', 10);
        state.roasts_today = state.roasts_today.slice(-maxRoasts);
      }

      state.updated_at = iso();
      state.last_roast_time = iso(); // Track when we last roasted
      await saveState(env.KV, state);

      return new Response(JSON.stringify({ ok: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // API: Update bake items
    if (url.pathname === '/api/bake' && request.method === 'POST') {
      await ensureDailyReset(env);

      let body: any;
      try {
        body = await request.json();
      } catch (e) {
        return new Response(
          JSON.stringify({ ok: false, error: 'Invalid JSON' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const items = body.items;
      if (!Array.isArray(items)) {
        return new Response(
          JSON.stringify({ ok: false, error: 'items must be a list' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const cleanItems = items
        .map((x) => String(x).trim())
        .filter((x) => x)
        .slice(0, 200);

      if (cleanItems.length === 0) {
        return new Response(
          JSON.stringify({ ok: false, error: 'no valid items provided' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const state = await loadState(env.KV);
      state.date = todayKey(env.APP_TZ);
      state.bake_items = cleanItems;
      state.bake_source = body.source || 'API';
      state.updated_at = iso();
      state.last_bake_time = iso(); // Track when bake items were updated
      await saveState(env.KV, state);

      return new Response(
        JSON.stringify({ ok: true, count: cleanItems.length }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    // API: Debug endpoint
    if (url.pathname === '/api/debug') {
      const state = await loadState(env.KV);
      return new Response(JSON.stringify({ state }, null, 2), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('Not found', { status: 404 });
  },

  // Scheduled (cron) handler - can be used for daily resets or other tasks
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    console.log('Cron triggered:', new Date().toISOString());

    try {
      // Ensure daily reset happens
      await ensureDailyReset(env);
      console.log('Daily reset check completed');

      // Email processing is now handled by Cloudflare Email Routing (email handler above)
      // This cron can be used for other scheduled tasks if needed
    } catch (error) {
      console.error('Cron job failed:', error);
    }
  },

  // Email handler for Cloudflare Email Routing
  async email(message: any, env: Env, ctx: ExecutionContext) {
    try {
      await handleEmail(message, env);
    } catch (error) {
      console.error('Email handler failed:', error);
      // Don't throw - we don't want to bounce emails on errors
    }
  },
};
