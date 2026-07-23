require('dotenv').config();

const path = require('path');
const { spawnSync } = require('child_process');
const { PrismaClient } = require('@prisma/client');
const { assertAcademicDemoSeed } = require('./seed-safety');

const prisma = new PrismaClient();

async function main() {
  assertAcademicDemoSeed('Academic defense dataset reset');

  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      branches,
      users,
      dance_categories,
      scholarship_rules
    CASCADE
  `);
  await prisma.$disconnect();

  const seed = spawnSync(process.execPath, [path.join(__dirname, 'seed-academic-demo-data.js')], {
    cwd:path.join(__dirname, '..'),
    env:process.env,
    stdio:'inherit',
  });
  if (seed.status !== 0) throw new Error(`Academic defense seed failed with exit code ${seed.status}.`);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
