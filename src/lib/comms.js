// FILE: src/lib/comms.js
// Purpose: Email (Resend) and SMS (Textbelt) alerting.
//
// Email types:
//   - Incident alert:  fired when consecutive_fails reaches threshold
//   - All-clear:       fired when a job recovers after an open incident
//   - Problem alert:   fired when multiple incidents are open concurrently (email + SMS)
//
// SMS fires only on problem alerts (multiple concurrent open incidents).
//
// Required env vars:
//   RESEND_API_KEY, ALERT_FROM_EMAIL, ALERT_TO_EMAIL
//   TEXTBELT_API_KEY, ALERT_PHONE_NUMBER, APP_NAME, APP_URL

const RESEND_API_KEY   = process.env.RESEND_API_KEY;
const TEXTBELT_API_KEY = process.env.TEXTBELT_API_KEY;
const ALERT_PHONE      = process.env.ALERT_PHONE_NUMBER;  // E.164: +15551234567

const ALERT_FROM = process.env.ALERT_FROM_EMAIL || "alerts@yourdomain.com";
const ALERT_TO   = process.env.ALERT_TO_EMAIL   || "you@yourdomain.com";
const APP_NAME   = process.env.APP_NAME          || "App";
const APP_URL    = process.env.APP_URL           || "https://yourdomain.com";

const FAILURE_THRESHOLD = 3;  // open incident after this many consecutive failures
const PROBLEM_THRESHOLD = 3;  // SMS + problem subject when this many incidents are open

// ── Internal helpers ──────────────────────────────────────────────────────────

async function sendEmail({ subject, html }) {
  if (!RESEND_API_KEY) {
    console.error("[comms/email] Missing RESEND_API_KEY — email not sent");
    return { ok: false, error: "Missing RESEND_API_KEY" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`
      },
      body: JSON.stringify({ from: ALERT_FROM, to: [ALERT_TO], subject, html })
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`[comms/email] HTTP ${res.status}: ${text.slice(0, 200)}`);
      return { ok: false, error: `HTTP ${res.status}` };
    }

    return { ok: true };
  } catch (err) {
    console.error(`[comms/email] Send failed: ${err.message}`);
    return { ok: false, error: err.message };
  }
}

async function sendSms(message) {
  if (!TEXTBELT_API_KEY || !ALERT_PHONE) {
    console.error("[comms/sms] Missing TEXTBELT_API_KEY or ALERT_PHONE_NUMBER — SMS not sent");
    return { ok: false, error: "Missing SMS config" };
  }

  try {
    const res = await fetch("https://textbelt.com/text", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ phone: ALERT_PHONE, message, key: TEXTBELT_API_KEY })
    });

    const data = await res.json();
    if (!data.success) {
      console.error(`[comms/sms] Failed: ${data.error}`);
      return { ok: false, error: data.error };
    }

    console.log(`[comms/sms] Sent — quota remaining: ${data.quotaRemaining}`);
    return { ok: true, quotaRemaining: data.quotaRemaining };
  } catch (err) {
    console.error(`[comms/sms] Send failed: ${err.message}`);
    return { ok: false, error: err.message };
  }
}

// ── Exported alert functions ──────────────────────────────────────────────────

/**
 * Send an incident alert email (and SMS if multiple incidents are open).
 * @param {object} opts
 * @param {string} opts.jobLabel        - Human-readable job name, e.g. "Shopify Sync / Store #12"
 * @param {string} opts.lastError       - The error message from the failing job
 * @param {number} opts.openIncidentCount - Total number of currently open incidents
 */
export async function sendIncidentAlert({ jobLabel, lastError, openIncidentCount }) {
  const isProblem = openIncidentCount >= PROBLEM_THRESHOLD;

  const subject = isProblem
    ? `⚠️ PROBLEM ALERT — ${openIncidentCount} jobs failing in ${APP_NAME}`
    : `🔴 Incident — ${jobLabel} failing`;

  const html = `
    <p><strong>Job:</strong> ${jobLabel}</p>
    <p><strong>Status:</strong> Has failed ${FAILURE_THRESHOLD} consecutive times and is now an open incident.</p>
    ${lastError ? `<p><strong>Last error:</strong> <code>${lastError}</code></p>` : ""}
    ${isProblem ? `<p><strong>Note:</strong> ${openIncidentCount} jobs are currently failing.</p>` : ""}
    <p>Log in to <a href="${APP_URL}">${APP_NAME}</a> to review.</p>
  `.trim();

  const result = await sendEmail({ subject, html });

  if (isProblem) {
    await sendSms(`${APP_NAME} PROBLEM ALERT: ${openIncidentCount} jobs are failing. Check email or log in at ${APP_URL}`);
  }

  return result;
}

/**
 * Send an all-clear email when a job recovers after an open incident.
 * @param {object} opts
 * @param {string} opts.jobLabel   - Human-readable job name
 * @param {Date}   opts.openedAt  - When the incident was opened
 */
export async function sendAllClearAlert({ jobLabel, openedAt }) {
  const subject = `✅ All Clear — ${jobLabel} recovered`;
  const openedAtStr = openedAt
    ? new Date(openedAt).toLocaleString("en-US", { timeZone: "America/Chicago" })
    : "unknown";

  const html = `
    <p><strong>Job:</strong> ${jobLabel}</p>
    <p><strong>Status:</strong> Recovered and running normally.</p>
    <p><strong>Incident opened at:</strong> ${openedAtStr} (CT)</p>
    <p>Log in to <a href="${APP_URL}">${APP_NAME}</a> to review.</p>
  `.trim();

  return sendEmail({ subject, html });
}
