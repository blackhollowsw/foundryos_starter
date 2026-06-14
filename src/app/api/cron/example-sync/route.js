// FILE: src/app/api/cron/example-sync/route.js
// Purpose: Template cron route — copy this to add new cron jobs.
//
// TO ADD A NEW CRON JOB:
//   1. Copy this file to src/app/api/cron/your-job-name/route.js
//   2. Update JOB_NAME and JOB_LABEL constants below
//   3. Add your job logic in the try block
//   4. Add an entry to vercel.json → "crons"

import { NextResponse }           from "next/server";
import sql                        from "@/lib/db";
import { makeSqlIncidentAdapter } from "@/lib/cronIncident";

const SYNC_SECRET = process.env.APP_SYNC_SECRET;
const JOB_NAME    = "example-sync";
const JOB_LABEL   = "Example Sync";

const { recordFailure, recordSuccess } = makeSqlIncidentAdapter(sql);

export async function GET(request) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const authHeader = request.headers.get("authorization");
  if (!authHeader || authHeader !== `Bearer ${SYNC_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Skip on preview deployments ─────────────────────────────────────────────
  if (process.env.VERCEL_ENV === "preview") {
    return NextResponse.json({ skipped: true, reason: "Preview environment" });
  }

  // ── Job logic ───────────────────────────────────────────────────────────────
  try {
    // TODO: Replace with your actual job logic
    const result = { processed: 0 };

    await recordSuccess({ jobName: JOB_NAME, jobLabel: JOB_LABEL });
    return NextResponse.json({ success: true, ...result });

  } catch (err) {
    console.error(`[${JOB_NAME}] Error: ${err.message}`);

    await recordFailure({
      jobName:      JOB_NAME,
      jobLabel:     JOB_LABEL,
      errorMessage: err.message,
    });

    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}