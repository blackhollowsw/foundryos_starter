// FILE: src/lib/cronIncident.js
// Purpose: Reusable incident management for background job failures.
//
// Pattern:
//   recordFailure() — increments consecutive_fails; opens incident + sends alert at threshold
//   recordSuccess() — resets counter; closes incident + sends all-clear if one was open
//
// One open CronIncident per job_name at a time (closed_at IS NULL = open).
//
// ── DB adapter ────────────────────────────────────────────────────────────────
// This module is DB-agnostic. Pass a `db` object with these methods:
//
//   Prisma (default):
//     import { prisma } from "./prisma";
//     import { makeIncidentAdapter } from "./cronIncident";
//     const { recordFailure, recordSuccess } = makeIncidentAdapter(prisma);
//
//   postgres.js:
//     import sql from "./db";
//     import { makeSqlIncidentAdapter } from "./cronIncident";
//     const { recordFailure, recordSuccess } = makeSqlIncidentAdapter(sql);
//
// Or use the pre-built Prisma exports directly (backwards compatible):
//   import { recordFailure, recordSuccess } from "./cronIncident";

import { prisma }                               from "./prisma";
import { sendIncidentAlert, sendAllClearAlert }  from "./comms";

const FAILURE_THRESHOLD = 3;

// ── Prisma adapter (default) ──────────────────────────────────────────────────

export function makeIncidentAdapter(db) {
  async function recordFailure({ jobName, resourceId, jobLabel, errorMessage }) {
    try {
      let incident = await db.cronIncident.findFirst({
        where: { job_name: jobName, resource_id: resourceId ?? null, closed_at: null }
      });

      if (!incident) {
        incident = await db.cronIncident.create({
          data: { job_name: jobName, resource_id: resourceId ?? null, consecutive_fails: 0 }
        });
      }

      const newFailCount       = incident.consecutive_fails + 1;
      const shouldOpenIncident = newFailCount >= FAILURE_THRESHOLD && !incident.opened_at;
      const shouldSendAlert    = newFailCount >= FAILURE_THRESHOLD && !incident.alert_sent_at;

      await db.cronIncident.update({
        where: { incident_id: incident.incident_id },
        data: {
          consecutive_fails: newFailCount,
          last_error:        errorMessage || null,
          opened_at:         shouldOpenIncident ? new Date() : incident.opened_at
        }
      });

      if (shouldSendAlert) {
        const openIncidentCount = await db.cronIncident.count({
          where: { closed_at: null, opened_at: { not: null } }
        });

        const result = await sendIncidentAlert({ jobLabel, lastError: errorMessage, openIncidentCount });

        if (result.ok) {
          await db.cronIncident.update({
            where: { incident_id: incident.incident_id },
            data:  { alert_sent_at: new Date() }
          });
          console.log(`[incident] Alert sent for ${jobLabel}`);
        } else {
          console.error(`[incident] Alert email failed for ${jobLabel}: ${result.error}`);
        }
      }

      console.log(`[incident] Failure recorded for ${jobLabel} — consecutive: ${newFailCount}`);
    } catch (err) {
      // Never let incident tracking crash the job itself
      console.error(`[incident] recordFailure error for ${jobName}: ${err.message}`);
    }
  }

  async function recordSuccess({ jobName, resourceId, jobLabel }) {
    try {
      const incident = await db.cronIncident.findFirst({
        where: { job_name: jobName, resource_id: resourceId ?? null, closed_at: null }
      });

      if (!incident) return;

      const wasOpen      = !!incident.opened_at;
      const alertWasSent = !!incident.alert_sent_at;
      const now          = new Date();

      await db.cronIncident.update({
        where: { incident_id: incident.incident_id },
        data:  { consecutive_fails: 0, closed_at: now }
      });

      if (wasOpen && alertWasSent) {
        const result = await sendAllClearAlert({ jobLabel, openedAt: incident.opened_at });

        if (result.ok) {
          await db.cronIncident.update({
            where: { incident_id: incident.incident_id },
            data:  { allclear_sent_at: now }
          });
          console.log(`[incident] All-clear sent for ${jobLabel}`);
        } else {
          console.error(`[incident] All-clear email failed for ${jobLabel}: ${result.error}`);
        }
      }

      console.log(`[incident] Recovered — incident closed for ${jobLabel}`);
    } catch (err) {
      console.error(`[incident] recordSuccess error for ${jobName}: ${err.message}`);
    }
  }

  return { recordFailure, recordSuccess };
}

// ── postgres.js adapter ───────────────────────────────────────────────────────
// Use this when your project uses postgres.js instead of Prisma.
// Pass your sql client from src/lib/db.js.
//
// Usage:
//   import sql from "@/lib/db";
//   import { makeSqlIncidentAdapter } from "@/lib/cronIncident";
//   const { recordFailure, recordSuccess } = makeSqlIncidentAdapter(sql);

export function makeSqlIncidentAdapter(sql) {
  async function recordFailure({ jobName, resourceId, jobLabel, errorMessage }) {
    try {
      const rid = resourceId ?? null;

      let [incident] = await sql`
        SELECT * FROM cron_incidents
        WHERE job_name = ${jobName}
          AND resource_id IS NOT DISTINCT FROM ${rid}
          AND closed_at IS NULL
        LIMIT 1
      `;

      if (!incident) {
        [incident] = await sql`
          INSERT INTO cron_incidents (job_name, resource_id, consecutive_fails)
          VALUES (${jobName}, ${rid}, 0)
          RETURNING *
        `;
      }

      const newFailCount       = incident.consecutive_fails + 1;
      const shouldOpenIncident = newFailCount >= FAILURE_THRESHOLD && !incident.opened_at;
      const shouldSendAlert    = newFailCount >= FAILURE_THRESHOLD && !incident.alert_sent_at;

      await sql`
        UPDATE cron_incidents SET
          consecutive_fails = ${newFailCount},
          last_error        = ${errorMessage || null},
          opened_at         = ${shouldOpenIncident ? new Date() : incident.opened_at},
          updated_at        = NOW()
        WHERE incident_id = ${incident.incident_id}
      `;

      if (shouldSendAlert) {
        const [{ count }] = await sql`
          SELECT COUNT(*)::int AS count FROM cron_incidents
          WHERE closed_at IS NULL AND opened_at IS NOT NULL
        `;

        const result = await sendIncidentAlert({ jobLabel, lastError: errorMessage, openIncidentCount: count });

        if (result.ok) {
          await sql`
            UPDATE cron_incidents SET alert_sent_at = NOW()
            WHERE incident_id = ${incident.incident_id}
          `;
          console.log(`[incident] Alert sent for ${jobLabel}`);
        } else {
          console.error(`[incident] Alert email failed for ${jobLabel}: ${result.error}`);
        }
      }

      console.log(`[incident] Failure recorded for ${jobLabel} — consecutive: ${newFailCount}`);
    } catch (err) {
      console.error(`[incident] recordFailure error for ${jobName}: ${err.message}`);
    }
  }

  async function recordSuccess({ jobName, resourceId, jobLabel }) {
    try {
      const rid = resourceId ?? null;

      const [incident] = await sql`
        SELECT * FROM cron_incidents
        WHERE job_name = ${jobName}
          AND resource_id IS NOT DISTINCT FROM ${rid}
          AND closed_at IS NULL
        LIMIT 1
      `;

      if (!incident) return;

      const wasOpen      = !!incident.opened_at;
      const alertWasSent = !!incident.alert_sent_at;
      const now          = new Date();

      await sql`
        UPDATE cron_incidents SET
          consecutive_fails = 0,
          closed_at         = ${now},
          updated_at        = NOW()
        WHERE incident_id = ${incident.incident_id}
      `;

      if (wasOpen && alertWasSent) {
        const result = await sendAllClearAlert({ jobLabel, openedAt: incident.opened_at });

        if (result.ok) {
          await sql`
            UPDATE cron_incidents SET allclear_sent_at = ${now}
            WHERE incident_id = ${incident.incident_id}
          `;
          console.log(`[incident] All-clear sent for ${jobLabel}`);
        } else {
          console.error(`[incident] All-clear email failed for ${jobLabel}: ${result.error}`);
        }
      }

      console.log(`[incident] Recovered — incident closed for ${jobLabel}`);
    } catch (err) {
      console.error(`[incident] recordSuccess error for ${jobName}: ${err.message}`);
    }
  }

  return { recordFailure, recordSuccess };
}

// ── Default exports (Prisma) — backwards compatible ───────────────────────────
// These work out of the box for Prisma projects.
// For postgres.js projects, use makeSqlIncidentAdapter() instead.

const _default = makeIncidentAdapter(prisma);
export const recordFailure = _default.recordFailure;
export const recordSuccess = _default.recordSuccess;
