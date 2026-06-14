// FILE: scripts/example-sync.js
// Purpose: Template for a background sync script run from GitHub Actions or a VPS.
// This script fetches credentials from the app API, performs the sync work,
// and reports results back to the cron route.
//
// Pattern copied from scripts/ace-sync.js and scripts/bm-sync.js in Actionboard.
//
// Required env vars (set in GitHub Actions secrets or VPS environment):
//   APP_SYNC_SECRET  — matches APP_SYNC_SECRET on the Vercel app
//   DATABASE_URL     — direct DB connection (if querying DB directly)
//   APP_URL          — base URL of the deployed app

const APP_URL       = process.env.APP_URL       || "https://yourdomain.com";
const SYNC_SECRET   = process.env.APP_SYNC_SECRET;

// ── Helpers ───────────────────────────────────────────────────────────────────

async function apiFetch(path, options = {}) {
  const res = await fetch(`${APP_URL}${path}`, {
    ...options,
    headers: {
      "Authorization": `Bearer ${SYNC_SECRET}`,
      "Content-Type":  "application/json",
      ...(options.headers || {})
    }
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${path} returned ${res.status}: ${text.slice(0, 200)}`);
  }

  return res.json();
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("[example-sync] Starting...");

  // 1. Fetch credentials / config from the app API
  // const config = await apiFetch("/api/cron/example-credentials");

  // 2. Do the work (e.g. Playwright scraping, external API calls)
  // const browser = await chromium.launch({ headless: true });
  // ...

  // 3. Report results back
  // await apiFetch("/api/cron/example-sync", { method: "POST", body: JSON.stringify({ results }) });

  console.log("[example-sync] Done.");
}

main().catch((err) => {
  console.error("[example-sync] Fatal error:", err.message);
  process.exit(1);
});
