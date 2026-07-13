const { PrismaClient } = require('@prisma/client');

require('dotenv').config();

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log('Skipping Prisma smoke test because DATABASE_URL is not set.');
    return;
  }

  const prisma = new PrismaClient();
  try {
    const [branchCount, roleCount, styleCount, scholarshipRuleCount] = await Promise.all([
      prisma.branch.count(),
      prisma.role.count(),
      prisma.danceStyle.count(),
      prisma.scholarshipRule.count(),
    ]);
    console.log(JSON.stringify({ branchCount, roleCount, styleCount, scholarshipRuleCount }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
