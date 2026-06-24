require('dotenv').config();

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const validLevels = ['B1', 'B2'];

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required to normalize academic levels.');
  }

  const studentUpdate = await prisma.student.updateMany({
    where: {
      NOT: {
        level: {
          in: validLevels,
        },
      },
    },
    data: {
      level: 'B1',
    },
  });

  const classGroupUpdate = await prisma.classGroup.updateMany({
    where: {
      NOT: {
        level: {
          in: validLevels,
        },
      },
    },
    data: {
      level: 'B1',
    },
  });

  const invalidStudents = await prisma.student.count({
    where: {
      NOT: {
        level: {
          in: validLevels,
        },
      },
    },
  });

  const invalidClassGroups = await prisma.classGroup.count({
    where: {
      NOT: {
        level: {
          in: validLevels,
        },
      },
    },
  });

  console.log(
    JSON.stringify(
      {
        normalized: {
          students: studentUpdate.count,
          classGroups: classGroupUpdate.count,
        },
        invalidAfter: {
          students: invalidStudents,
          classGroups: invalidClassGroups,
        },
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
