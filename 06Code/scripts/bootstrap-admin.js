require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const { hashPassword } = require('../backend/src/utils/passwordHasher');

function required(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

async function main() {
  required('DATABASE_URL');
  if (required('BOOTSTRAP_ADMIN_CONFIRM') !== 'CREATE_INITIAL_ADMIN') {
    throw new Error('BOOTSTRAP_ADMIN_CONFIRM must equal CREATE_INITIAL_ADMIN.');
  }
  const email = required('BOOTSTRAP_ADMIN_EMAIL').toLowerCase();
  const name = required('BOOTSTRAP_ADMIN_NAME');
  const password = required('BOOTSTRAP_ADMIN_PASSWORD');
  if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{14,120}$/.test(password)) {
    throw new Error('BOOTSTRAP_ADMIN_PASSWORD must be 14-120 characters with upper/lowercase, number and symbol.');
  }

  const prisma = new PrismaClient();
  try {
    await prisma.$transaction(async (tx) => {
      const role = await tx.role.findUnique({ where:{ name:'Admin' } });
      if (!role) throw new Error('Admin role is missing. Apply database migrations first.');
      if (await tx.user.count({ where:{ roleId:role.id, active:true } })) {
        throw new Error('An active Admin already exists; bootstrap is permanently disabled for this database.');
      }
      if (await tx.user.findUnique({ where:{ email } })) throw new Error('BOOTSTRAP_ADMIN_EMAIL is already registered.');
      const user = await tx.user.create({
        data:{
          email,
          name,
          passwordHash:hashPassword(password),
          mustChangePassword:true,
          passwordChangedAt:null,
          active:true,
          roleId:role.id,
        },
      });
      await tx.auditLog.create({
        data:{
          actorUserId:null,
          action:'BOOTSTRAP_ADMIN_CREATED',
          entity:'users',
          entityId:user.id,
          metadata:{ mustChangePassword:true, source:'one-time-bootstrap' },
        },
      });
    });
    console.log('Initial administrator created. Remove all BOOTSTRAP_ADMIN_* environment values now.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(`Admin bootstrap failed: ${error.message}`);
  process.exit(1);
});
