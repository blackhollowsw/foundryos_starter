// FILE: prisma.config.ts
// Purpose: Prisma configuration — points to schema and seed script.

import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "node prisma/seed.js"
  },
  datasource: {
    // Use DATABASE_URL_DIRECT for migrations (not the pooled connection)
    url: env("DATABASE_URL_DIRECT")
  }
});
