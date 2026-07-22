require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const { Roles } = require('../backend/src/models/constants');
const { hashPassword } = require('../backend/src/utils/passwordHasher');
const { assertLocalDevelopmentSeed, requiredSeedValue } = require('./seed-safety');

const prisma = new PrismaClient();

const roleCredentials = [
  {
    role: Roles.ADMIN,
    email: requiredSeedValue('SEED_ADMIN_EMAIL'),
    name: 'ALC Admin',
    googleSub: 'role-test-admin',
    password: requiredSeedValue('SEED_ADMIN_PASSWORD', 12),
    scope: 'global',
  },
  {
    role: Roles.GENERAL_DIRECTOR,
    email: requiredSeedValue('SEED_GENERAL_DIRECTOR_EMAIL'),
    name: 'ALC General Director',
    googleSub: 'role-test-general-director',
    password: requiredSeedValue('SEED_GENERAL_DIRECTOR_PASSWORD', 12),
    scope: 'all branches',
  },
  {
    role: Roles.BRANCH_DIRECTOR,
    email: requiredSeedValue('SEED_BRANCH_DIRECTOR_EMAIL'),
    name: 'ALC Branch Director',
    googleSub: 'role-test-branch-director',
    password: requiredSeedValue('SEED_BRANCH_DIRECTOR_PASSWORD', 12),
    scope: 'ALC Santo Domingo Norte only',
  },
  {
    role: Roles.TEACHER,
    email: requiredSeedValue('SEED_TEACHER_EMAIL'),
    name: 'ALC Teacher',
    googleSub: 'role-test-teacher',
    password: requiredSeedValue('SEED_TEACHER_PASSWORD', 12),
    scope: 'own teacher profile and sessions',
  },
  {
    role: Roles.STUDENT,
    email: requiredSeedValue('SEED_STUDENT_EMAIL'),
    name: 'ALC Student',
    googleSub: 'role-test-student',
    password: requiredSeedValue('SEED_STUDENT_PASSWORD', 12),
    scope: 'own student profile',
  },
];

const permissionsByRole = {
  [Roles.ADMIN]: [
    'attendance.record',
    'teacher.check',
    'academic.manage',
    'reports.branch',
    'reports.consolidated',
    'audit.view',
    'users.manage_roles',
    'users.assign_branch_access',
  ],
  [Roles.GENERAL_DIRECTOR]: [
    'academic.manage',
    'reports.branch',
    'reports.consolidated',
    'audit.view',
  ],
  [Roles.BRANCH_DIRECTOR]: [
    'attendance.record',
    'teacher.check',
    'academic.manage',
    'reports.branch',
  ],
  [Roles.TEACHER]: [
    'attendance.record',
    'teacher.check',
  ],
  [Roles.STUDENT]: [
    'self.view',
    'absence.justify',
  ],
};

const permissionDescriptions = {
  'attendance.record': 'Record student attendance',
  'teacher.check': 'Teacher check-in and check-out',
  'academic.manage': 'Manage branches, students, teachers, styles and schedules',
  'reports.branch': 'View branch reports',
  'reports.consolidated': 'View consolidated reports',
  'audit.view': 'View audit logs',
  'users.manage_roles': 'Assign internal application roles',
  'users.assign_branch_access': 'Assign branch access to branch-scoped users',
  'self.view': 'View own academic profile',
  'absence.justify': 'Submit own absence justification',
};

function assertSafeEnvironment() {
  assertLocalDevelopmentSeed('Role test seed');
}

async function upsertRole(name) {
  return prisma.role.upsert({
    where: { name },
    update: {},
    create: { name },
  });
}

async function upsertPermission(code) {
  return prisma.permission.upsert({
    where: { code },
    update: { description: permissionDescriptions[code] },
    create: { code, description: permissionDescriptions[code] },
  });
}

async function grantPermissions(roles, permissions) {
  for (const [roleName, codes] of Object.entries(permissionsByRole)) {
    const role = roles[roleName];
    for (const code of codes) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permissions[code].id,
          },
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId: permissions[code].id,
        },
      });
    }
  }
}

async function seedCatalog() {
  const roles = {};
  for (const roleName of Object.values(Roles)) {
    roles[roleName] = await upsertRole(roleName);
  }

  const permissions = {};
  for (const code of Object.keys(permissionDescriptions)) {
    permissions[code] = await upsertPermission(code);
  }
  await grantPermissions(roles, permissions);

  const [northBranch, centralBranch] = await Promise.all([
    prisma.branch.upsert({
      where: { name: 'ALC Santo Domingo Norte' },
      update: { city: 'Santo Domingo', active: true },
      create: { name: 'ALC Santo Domingo Norte', city: 'Santo Domingo', active: true },
    }),
    prisma.branch.upsert({
      where: { name: 'ALC Santo Domingo Central' },
      update: { city: 'Santo Domingo', active: true },
      create: { name: 'ALC Santo Domingo Central', city: 'Santo Domingo', active: true },
    }),
  ]);

  const category = await prisma.danceCategory.upsert({
    where: { name: 'Tropical' },
    update: {},
    create: { name: 'Tropical' },
  });

  const style = await prisma.danceStyle.upsert({
    where: { name: 'Salsa' },
    update: { categoryId: category.id },
    create: { name: 'Salsa', categoryId: category.id },
  });

  const scholarshipRule = await prisma.scholarshipRule.findFirst({ where: { active: true } })
    || await prisma.scholarshipRule.create({ data: { minAttendancePercent: '90.00', periodMonths: 2, active: true } });

  return { roles, northBranch, centralBranch, style, scholarshipRule };
}

async function upsertUser(roles, credential) {
  const passwordHash = hashPassword(credential.password);
  return prisma.user.upsert({
    where: { email: credential.email },
    update: {
      googleSub: credential.googleSub,
      name: credential.name,
      passwordHash,
      mustChangePassword: true,
      passwordChangedAt: null,
      active: true,
      roleId: roles[credential.role].id,
    },
    create: {
      googleSub: credential.googleSub,
      email: credential.email,
      name: credential.name,
      passwordHash,
      mustChangePassword: true,
      passwordChangedAt: null,
      active: true,
      roleId: roles[credential.role].id,
    },
  });
}

async function replaceBranchAccess(userId, branchIds) {
  await prisma.userBranchAccess.deleteMany({ where: { userId } });
  for (const branchId of branchIds) {
    await prisma.userBranchAccess.create({ data: { userId, branchId } });
  }
}

async function upsertTeacher(user, branch, style) {
  const existing = await prisma.teacher.findFirst({ where: { userId: user.id } });
  const data = {
    userId: user.id,
    branchId: branch.id,
    fullName: user.name,
    hourlyRate: '22.50',
    active: true,
  };
  const teacher = existing
    ? await prisma.teacher.update({ where: { id: existing.id }, data })
    : await prisma.teacher.create({ data });

  await prisma.teacherStyle.upsert({
    where: {
      teacherId_styleId: {
        teacherId: teacher.id,
        styleId: style.id,
      },
    },
    update: {},
    create: {
      teacherId: teacher.id,
      styleId: style.id,
    },
  });

  return teacher;
}

async function upsertStudent(user, branch) {
  const existing = await prisma.student.findFirst({ where: { userId: user.id } });
  const data = {
    userId: user.id,
    branchId: branch.id,
    fullName: user.name,
    level: 'B1',
    active: true,
  };
  return existing
    ? prisma.student.update({ where: { id: existing.id }, data })
    : prisma.student.create({ data });
}

async function upsertClassGroup(branch, style, teacher) {
  const name = 'Role Test B1 Salsa Norte';
  const existing = await prisma.classGroup.findFirst({ where: { name } });
  const data = {
    branchId: branch.id,
    styleId: style.id,
    teacherId: teacher.id,
    name,
    level: 'B1',
    active: true,
  };
  return existing
    ? prisma.classGroup.update({ where: { id: existing.id }, data })
    : prisma.classGroup.create({ data });
}

async function upsertSessions(classGroup) {
  const starts = [
    '2026-07-01T18:00:00.000Z',
    '2026-07-03T18:00:00.000Z',
    '2026-07-06T18:00:00.000Z',
    '2026-07-08T18:00:00.000Z',
  ];
  const sessions = [];

  for (const [index, startsAt] of starts.entries()) {
    const existing = await prisma.classSession.findFirst({
      where: {
        classGroupId: classGroup.id,
        startsAt: new Date(startsAt),
      },
    });
    const data = {
      classGroupId: classGroup.id,
      startsAt: new Date(startsAt),
      endsAt: new Date(new Date(startsAt).getTime() + 2 * 60 * 60 * 1000),
      status: index < 3 ? 'completed' : 'scheduled',
    };
    sessions.push(existing
      ? await prisma.classSession.update({ where: { id: existing.id }, data })
      : await prisma.classSession.create({ data }));
  }

  return sessions;
}

async function upsertAttendance(student, teacher, sessions) {
  const statuses = ['present', 'late', 'present'];
  for (const [index, session] of sessions.slice(0, 3).entries()) {
    const existing = await prisma.studentAttendanceRecord.findFirst({
      where: {
        studentId: student.id,
        classSessionId: session.id,
      },
    });
    const data = {
      studentId: student.id,
      classSessionId: session.id,
      status: statuses[index],
      notes: 'Role test seed attendance.',
    };
    if (existing) await prisma.studentAttendanceRecord.update({ where: { id: existing.id }, data });
    else await prisma.studentAttendanceRecord.create({ data });
  }

  const firstSession = sessions[0];
  const teacherAttendance = await prisma.teacherAttendanceRecord.findFirst({
    where: {
      teacherId: teacher.id,
      classSessionId: firstSession.id,
    },
  });
  const checkInAt = new Date(firstSession.startsAt.getTime() - 30 * 60 * 1000);
  const data = {
    teacherId: teacher.id,
    classSessionId: firstSession.id,
    checkInAt,
    checkOutAt: new Date(checkInAt.getTime() + 2.5 * 60 * 60 * 1000),
  };
  if (teacherAttendance) await prisma.teacherAttendanceRecord.update({ where: { id: teacherAttendance.id }, data });
  else await prisma.teacherAttendanceRecord.create({ data });
}

async function main() {
  assertSafeEnvironment();

  const catalog = await seedCatalog();
  const users = {};
  for (const credential of roleCredentials) {
    users[credential.role] = await upsertUser(catalog.roles, credential);
  }

  await replaceBranchAccess(users[Roles.BRANCH_DIRECTOR].id, [catalog.northBranch.id]);

  const teacher = await upsertTeacher(users[Roles.TEACHER], catalog.northBranch, catalog.style);
  const student = await upsertStudent(users[Roles.STUDENT], catalog.northBranch);
  const classGroup = await upsertClassGroup(catalog.northBranch, catalog.style, teacher);
  const sessions = await upsertSessions(classGroup);
  await upsertAttendance(student, teacher, sessions);

  console.log(JSON.stringify({
    message: 'Role test seed ready',
    accounts: roleCredentials.map(({ role, scope }) => ({ role, scope, mustChangePassword:true })),
    ids: {
      branches: {
        assignedToBranchDirector: catalog.northBranch.id,
        unassignedForNegativeTests: catalog.centralBranch.id,
      },
      users: Object.fromEntries(Object.entries(users).map(([role, user]) => [role, user.id])),
      teacher: teacher.id,
      student: student.id,
      classGroup: classGroup.id,
      classSessions: sessions.map((session) => session.id),
    },
    notes: [
      'Credentials are intentionally omitted from output and must come from a local secret source.',
      'This seed is technically blocked outside an explicitly opted-in localhost development database.',
    ],
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
