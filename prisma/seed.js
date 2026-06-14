// FILE: prisma/seed.js
// Purpose: Seeds reference / lookup data. Safe to run multiple times (upsert throughout).
// Run with: npm run db:seed

const { PrismaClient } = require("@prisma/client");
const { PrismaPg }     = require("@prisma/adapter-pg");

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma  = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding reference data...");

  // ── Add your seed data below ──────────────────────────────────────────────
  // Example:
  // await prisma.account.upsert({
  //   where:  { account_name: "Demo Account" },
  //   update: {},
  //   create: { account_name: "Demo Account", status: "active" }
  // });

  console.log("  ✓ Done — add your seed data above");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
