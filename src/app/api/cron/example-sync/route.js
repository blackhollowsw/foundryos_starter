// FILE: src/app/api/cron/example-sync/route.js
// Purpose: Template for a Vercel cron endpoint.
//
// HOW IT WORKS:
//   1. Vercel calls this route on the schedule defined in vercel.json.
//   2. The Bearer token must match APP_SYNC_SECRET (set in Vercel env vars).
//   3. On success, recordSuccess() closes any open incident.
//   4. On failure, recordFailure() opens an incident and sends an alert at 3 consecutive fails.
//
// TO ADD A NEW CRON JOB:
//   1. Copy this file to src/app/api/cron/your-job-name/route.js
//   2. Update JOB_NAME and JOB_LABEL constants below
//   3. Add your job logic in the try block
//   4. Add an entry to vercel.json → "crons"
//   5. If the job uses Playwright or exceeds 30s, use a GitHub Actions workflow instead

import { recordFailure, recordSuccess } from "../../../../lib/cronIncident";

const SYNC_SECRET = process.env.APP_SYNC_SECRET;
const JOB_NAME    = "example-sync";
const JOB_LABEL   = "Example Sync";

export async function GET(request) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const authHeader = request.headers.get("authorization");
  if (!authHeader || authHeader !== `Bearer ${SYNC_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Skip on preview deployments ─────────────────────────────────────────────
  if (process.env.VERCEL_ENV === "preview") {
    return Response.json({ skipped: true, reason: "Preview environment — cron disabled" });
  }

  // ── Job logic ───────────────────────────────────────────────────────────────
  try {
    // TODO: Replace with your actual job logic
    // e.g. fetch an external API, update DB records, send a digest email
    const result = { processed: 0 };

    await recordSuccess({ jobName: JOB_NAME, jobLabel: JOB_LABEL });
    return Response.json({ success: true, ...result });

  } catch (err) {
    console.error(`[${JOB_NAME}] Error: ${err.message}`);

    await recordFailure({
      jobName:      JOB_NAME,
      jobLabel:     JOB_LABEL,
      errorMessage: err.message
    });

    return Response.json({ error: err.message }, { status: 500 });
  }
}
