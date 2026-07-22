require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const { Roles } = require('../backend/src/models/constants');
const { hashPassword } = require('../backend/src/utils/passwordHasher');
const { assertAcademicDemoSeed, requiredSeedValue } = require('./seed-safety');

const prisma = new PrismaClient();

const passwords = {
  admin:requiredSeedValue('SEED_ADMIN_PASSWORD', 12),
  generalDirector:requiredSeedValue('SEED_GENERAL_DIRECTOR_PASSWORD', 12),
  branchDirector:requiredSeedValue('SEED_BRANCH_DIRECTOR_PASSWORD', 12),
  teacher:requiredSeedValue('SEED_TEACHER_PASSWORD', 12),
  student:requiredSeedValue('SEED_STUDENT_PASSWORD', 12),
};

const branches = [
  { key:'matriz', name:'ALC Matriz Sur', legacyName:'ALC Matriz', city:'Quito', director:'María Fernanda Cevallos', email:'direccion.matriz@americanlatinclass.ec' },
  { key:'norte', name:'ALC Norte', city:'Quito', director:'Santiago Herrera', email:requiredSeedValue('SEED_BRANCH_DIRECTOR_NORTH_EMAIL') },
  { key:'sur', name:'ALC Quitumbe', legacyName:'ALC Sur', city:'Quito', director:'Paola Benítez', email:'direccion.sur@americanlatinclass.ec' },
  { key:'conocoto', name:'ALC Conocoto', city:'Quito', director:'Ricardo Almeida', email:'direccion.conocoto@americanlatinclass.ec' },
  { key:'tumbaco', name:'ALC Tumbaco', city:'Quito', director:'Carolina Vallejo', email:'direccion.tumbaco@americanlatinclass.ec' },
];

const classCatalog = [
  { group:'Afro Foundation', style:'Afro', category:'Urban', level:'B1', teacher:'Valentina Paredes', email:'valentina.paredes@americanlatinclass.ec', branch:'matriz', rate:'18.00' },
  { group:'Salsa Level 1', style:'Salsa', category:'Tropical', level:'B1', teacher:'Andrés Molina', email:'andres.molina@americanlatinclass.ec', branch:'matriz', rate:'18.50' },
  { group:'Bachata Intermediate', style:'Bachata', category:'Tropical', level:'B2', teacher:'Daniela Vega', email:'daniela.vega@americanlatinclass.ec', branch:'matriz', rate:'19.50' },
  { group:'Hip Hop Foundation', style:'Hip Hop', category:'Urban', level:'B1', teacher:'Mateo Rivera', email:'mateo.rivera@americanlatinclass.ec', branch:'norte', rate:'18.00' },
  { group:'Heels Technique', style:'Heels', category:'Urban', level:'B2', teacher:'Camila Torres', email:'camila.torres@americanlatinclass.ec', branch:'norte', rate:'20.00' },
  { group:'Danza Tradicional Inicial', style:'Danza Tradicional Ecuatoriana', category:'Ethnic', level:'B1', teacher:'Elena Cevallos', email:'elena.cevallos@americanlatinclass.ec', branch:'sur', rate:'18.00' },
  { group:'Dancehall Skanking', style:'Dancehall', category:'Urban', level:'B2', teacher:'Sebastián Ortiz', email:'sebastian.ortiz@americanlatinclass.ec', branch:'sur', rate:'19.50' },
  { group:'Popping Basics', style:'Popping', category:'Urban', level:'B1', teacher:'Luciana Zambrano', email:'luciana.zambrano@americanlatinclass.ec', branch:'conocoto', rate:'18.00' },
  { group:'Bachata Sensual', style:'Bachata Sensual', category:'Tropical', level:'B2', teacher:'Nicolás Guerrero', email:'nicolas.guerrero@americanlatinclass.ec', branch:'conocoto', rate:'19.50' },
  { group:'House Fundamentals', style:'House', category:'Urban', level:'B1', teacher:'Sofía Salazar', email:'sofia.salazar@americanlatinclass.ec', branch:'tumbaco', rate:'18.50' },
  { group:'Salsa On2', style:'Salsa On2', category:'Tropical', level:'B2', teacher:'Gabriel Mena', email:'gabriel.mena@americanlatinclass.ec', branch:'tumbaco', rate:'20.00' },
];

const studentNames = [
  'Camila Andrade', 'Martín Salazar', 'Renata Vélez', 'Emilio Vera', 'Paula Guerrero',
  'Mateo Zambrano', 'Sofía Hidalgo', 'David Loor', 'Valentina Solórzano', 'Julián Moreira',
  'Ana Belén Paredes', 'Gabriel Muñoz', 'Isabella Zamora', 'Tomás Cárdenas', 'Elena Mora',
  'Mía Alcívar', 'Sebastián Rosero', 'Luciana Bravo', 'Daniela Arias', 'Nicolás Viteri',
  'Alejandra Naranjo', 'Felipe Villacís', 'Carla Jaramillo', 'Bruno Estévez', 'Mariana Pazmiño',
];

function emailForName(name) {
  return `${name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '')}@americanlatinclass.ec`;
}

async function rolesByName() {
  const result = {};
  for (const name of Object.values(Roles)) {
    result[name] = await prisma.role.upsert({ where:{ name }, update:{}, create:{ name } });
  }
  return result;
}

async function upsertUser(roles, { email, name, role, password, active = true }) {
  const data = {
    name,
    passwordHash:hashPassword(password),
    mustChangePassword:false,
    passwordChangedAt:new Date('2026-07-01T12:00:00.000Z'),
    active,
    roleId:roles[role].id,
  };
  return prisma.user.upsert({ where:{ email }, update:data, create:{ email, ...data } });
}

async function replaceBranchAccess(userId, branchIds) {
  await prisma.userBranchAccess.deleteMany({ where:{ userId } });
  await prisma.userBranchAccess.createMany({ data:branchIds.map((branchId) => ({ userId, branchId })) });
}

async function removeAccidentalTestAccounts() {
  await prisma.enrollmentRequest.deleteMany({ where:{ email:{ endsWith:'@alc.test' } } });
  const testUsers = await prisma.user.findMany({
    where:{ email:{ endsWith:'@alc.test' } },
    select:{ id:true, student:{ select:{ id:true } }, teacher:{ select:{ id:true } } },
  });
  const disposableIds = testUsers
    .filter((user) => !user.student && !user.teacher)
    .map((user) => user.id);
  if (!disposableIds.length) return;
  await prisma.$transaction([
    prisma.session.deleteMany({ where:{ userId:{ in:disposableIds } } }),
    prisma.userBranchAccess.deleteMany({ where:{ userId:{ in:disposableIds } } }),
    prisma.auditLog.deleteMany({ where:{ actorUserId:{ in:disposableIds } } }),
    prisma.user.deleteMany({ where:{ id:{ in:disposableIds } } }),
  ]);
}

async function upsertBranch(item) {
  const names = [item.name, item.legacyName].filter(Boolean);
  const existing = await prisma.branch.findFirst({ where:{ name:{ in:names } } });
  if (existing) {
    return prisma.branch.update({
      where:{ id:existing.id },
      data:{ name:item.name, city:item.city, active:true },
    });
  }
  return prisma.branch.create({ data:{ name:item.name, city:item.city, active:true } });
}

async function upsertCategory(name) {
  return prisma.danceCategory.upsert({ where:{ name }, update:{}, create:{ name } });
}

async function upsertStyle(name, categoryId) {
  return prisma.danceStyle.upsert({
    where:{ name },
    update:{ categoryId },
    create:{ name, categoryId },
  });
}

async function upsertTeacher(roles, item, branch, style) {
  const user = await upsertUser(roles, {
    email:item.email,
    name:item.teacher,
    role:Roles.TEACHER,
    password:passwords.teacher,
  });
  const existing = await prisma.teacher.findFirst({ where:{ userId:user.id } });
  const data = { userId:user.id, branchId:branch.id, fullName:item.teacher, hourlyRate:item.rate, active:true };
  const teacher = existing
    ? await prisma.teacher.update({ where:{ id:existing.id }, data })
    : await prisma.teacher.create({ data });
  await prisma.teacherStyle.upsert({
    where:{ teacherId_styleId:{ teacherId:teacher.id, styleId:style.id } },
    update:{},
    create:{ teacherId:teacher.id, styleId:style.id },
  });
  return teacher;
}

async function upsertClassGroup(item, branch, style, teacher) {
  const existing = await prisma.classGroup.findFirst({ where:{ name:item.group, branchId:branch.id } });
  const data = {
    branchId:branch.id,
    styleId:style.id,
    teacherId:teacher.id,
    name:item.group,
    level:item.level,
    active:true,
    capacity:20,
  };
  return existing
    ? prisma.classGroup.update({ where:{ id:existing.id }, data })
    : prisma.classGroup.create({ data });
}

async function upsertClassSession(group, teacher, finalizerId, weekIndex, groupIndex) {
  const startsAt = new Date(Date.UTC(2026, 5, 8 + weekIndex * 7 + (groupIndex % 5), 22 + (groupIndex % 2), 0, 0));
  const endsAt = new Date(startsAt.getTime() + 90 * 60 * 1000);
  const existing = await prisma.classSession.findFirst({ where:{ classGroupId:group.id, startsAt } });
  const data = {
    classGroupId:group.id,
    startsAt,
    endsAt,
    name:group.name,
    status:'completed',
    attendanceState:'finalized',
    attendanceFinalizedAt:endsAt,
    attendanceFinalizedBy:finalizerId,
    completedAt:endsAt,
    completedBy:finalizerId,
  };
  const session = existing
    ? await prisma.classSession.update({ where:{ id:existing.id }, data })
    : await prisma.classSession.create({ data });

  const teacherAttendance = await prisma.teacherAttendanceRecord.findFirst({
    where:{ teacherId:teacher.id, classSessionId:session.id },
  });
  const attendanceData = {
    teacherId:teacher.id,
    classSessionId:session.id,
    checkInAt:new Date(startsAt.getTime() - 10 * 60 * 1000),
    checkOutAt:endsAt,
    hourlyRateSnapshot:teacher.hourlyRate,
    payableMinutes:90,
  };
  if (teacherAttendance) {
    await prisma.teacherAttendanceRecord.update({ where:{ id:teacherAttendance.id }, data:attendanceData });
  } else {
    await prisma.teacherAttendanceRecord.create({ data:attendanceData });
  }
  return session;
}

async function upsertUpcomingClassSession(group, groupIndex) {
  const startsAt = new Date(Date.UTC(2026, 6, 22 + (groupIndex % 5), 22 + (groupIndex % 2), 0, 0));
  const endsAt = new Date(startsAt.getTime() + 90 * 60 * 1000);
  const existing = await prisma.classSession.findFirst({ where:{ classGroupId:group.id, startsAt } });
  const data = {
    classGroupId:group.id,
    startsAt,
    endsAt,
    name:group.name,
    status:'scheduled',
    attendanceState:'draft',
    attendanceFinalizedAt:null,
    attendanceFinalizedBy:null,
    completedAt:null,
    completedBy:null,
  };
  return existing
    ? prisma.classSession.update({ where:{ id:existing.id }, data })
    : prisma.classSession.create({ data });
}

async function upsertStudent(roles, name, index, branch) {
  const retired = [22, 24].includes(index);
  const user = await upsertUser(roles, {
    email:emailForName(name),
    name,
    role:Roles.STUDENT,
    password:passwords.student,
  });
  const existing = await prisma.student.findFirst({ where:{ userId:user.id } });
  const data = {
    userId:user.id,
    branchId:branch.id,
    fullName:name,
    level:index % 5 < 3 ? 'B1' : 'B2',
    active:!retired,
  };
  const student = existing
    ? await prisma.student.update({ where:{ id:existing.id }, data })
    : await prisma.student.create({ data });
  return { ...student, retired };
}

async function upsertEnrollment(student, group, creatorId) {
  const existing = await prisma.classGroupEnrollment.findFirst({
    where:{ studentId:student.id, classGroupId:group.id, startsAt:new Date('2026-05-01T00:00:00.000Z') },
  });
  const data = {
    studentId:student.id,
    classGroupId:group.id,
    status:student.retired ? 'withdrawn' : 'active',
    startsAt:new Date('2026-05-01T00:00:00.000Z'),
    endsAt:student.retired ? new Date('2026-06-15T23:59:59.000Z') : null,
    enrolledAt:new Date('2026-05-01T00:00:00.000Z'),
    withdrawalReason:student.retired ? 'Retiro voluntario por cambio de horario' : null,
    createdBy:creatorId,
  };
  return existing
    ? prisma.classGroupEnrollment.update({ where:{ id:existing.id }, data })
    : prisma.classGroupEnrollment.create({ data });
}

async function upsertPayment(student, period, concept, amount, status, index, creatorId) {
  const existing = await prisma.studentPayment.findFirst({ where:{ studentId:student.id, period, concept } });
  const month = Number(period.slice(5, 7));
  const paidAt = status === 'paid' ? new Date(Date.UTC(2026, month - 1, 3 + (index % 8), 15, 0, 0)) : null;
  const data = {
    studentId:student.id,
    branchId:student.branchId,
    amount,
    concept,
    period,
    status,
    paidAt,
    dueAt:new Date(Date.UTC(2026, month - 1, 10, 23, 59, 0)),
    notes:status === 'paid' ? 'Pago confirmado en caja' : 'Pendiente de seguimiento',
    transactionType:'charge',
    createdBy:creatorId,
    updatedBy:creatorId,
  };
  return existing
    ? prisma.studentPayment.update({ where:{ id:existing.id }, data })
    : prisma.studentPayment.create({ data });
}

async function seedStudentAttendance(student, sessions, studentIndex, recorderId) {
  for (const [weekIndex, session] of sessions.entries()) {
    if (student.retired && session.startsAt > new Date('2026-06-15T23:59:59.000Z')) continue;
    const marker = (studentIndex + weekIndex) % 8;
    const status = marker === 0 ? 'absent' : marker === 3 ? 'late' : 'present';
    const existing = await prisma.studentAttendanceRecord.findFirst({
      where:{ studentId:student.id, classSessionId:session.id },
    });
    const data = {
      studentId:student.id,
      classSessionId:session.id,
      status,
      notes:`Asistencia registrada para ${session.name}`,
      recordedBy:recorderId,
      updatedBy:recorderId,
    };
    const attendance = existing
      ? await prisma.studentAttendanceRecord.update({ where:{ id:existing.id }, data })
      : await prisma.studentAttendanceRecord.create({ data });

    const shouldJustify = status === 'absent' && (studentIndex + weekIndex) % 16 === 0;
    if (shouldJustify) {
      const justification = await prisma.absenceJustification.findFirst({
        where:{ attendanceRecordId:attendance.id },
      });
      const justificationData = {
        attendanceRecordId:attendance.id,
        reason:'Cita médica previamente informada',
        status:'approved',
        reviewedBy:recorderId,
        reviewNotes:'Justificación validada por dirección de sede',
        reviewedAt:new Date(session.endsAt.getTime() + 24 * 60 * 60 * 1000),
      };
      if (justification) {
        await prisma.absenceJustification.update({ where:{ id:justification.id }, data:justificationData });
      } else {
        await prisma.absenceJustification.create({ data:justificationData });
      }
    } else {
      await prisma.absenceJustification.deleteMany({ where:{ attendanceRecordId:attendance.id } });
    }
  }
}

async function upsertEvent(branch, item) {
  const startsAt = new Date(item.startsAt);
  const existing = await prisma.academyEvent.findFirst({ where:{ branchId:branch.id, title:item.title, startsAt } });
  const data = {
    branchId:branch.id,
    title:item.title,
    description:item.description,
    level:item.level,
    startsAt,
    endsAt:new Date(item.endsAt),
    location:item.location,
    showIncome:item.showIncome,
    active:true,
  };
  return existing
    ? prisma.academyEvent.update({ where:{ id:existing.id }, data })
    : prisma.academyEvent.create({ data });
}

async function seedProspects(branchRows) {
  const prospects = [
    ['Andrea Bustamante', 'andrea.bustamante@gmail.com', '+593 98 412 7635', 'Salsa', 'matriz', 'contacted'],
    ['Joaquín Freire', 'joaquin.freire@gmail.com', '+593 99 624 1857', 'Hip Hop', 'norte', 'trial_scheduled'],
    ['Fernanda Lara', 'fernanda.lara@gmail.com', '+593 96 358 7421', 'Dancehall', 'sur', 'pending'],
    ['Kevin Narváez', 'kevin.narvaez@gmail.com', '+593 97 531 8462', 'Bachata', 'conocoto', 'pending'],
    ['Adriana Ponce', 'adriana.ponce@gmail.com', '+593 98 746 2193', 'House', 'tumbaco', 'contacted'],
  ];
  for (const [fullName, email, phone, styleInterest, branchKey, status] of prospects) {
    const existing = await prisma.enrollmentRequest.findFirst({ where:{ email } });
    const branch = branchRows[branchKey];
    const data = {
      fullName,
      email,
      phone,
      branchId:branch.id,
      preferredBranch:branch.name,
      styleInterest,
      status,
      statusNotes:'Seguimiento de admisión académica',
      followUpAt:status === 'trial_scheduled' ? new Date('2026-07-23T22:00:00.000Z') : null,
    };
    if (existing) await prisma.enrollmentRequest.update({ where:{ id:existing.id }, data });
    else await prisma.enrollmentRequest.create({ data });
  }
}

async function main() {
  assertAcademicDemoSeed('Academic defense seed');
  await removeAccidentalTestAccounts();
  const roles = await rolesByName();
  const branchRows = {};
  for (const item of branches) branchRows[item.key] = await upsertBranch(item);

  await upsertUser(roles, {
    email:requiredSeedValue('SEED_ADMIN_EMAIL'),
    name:'Administración ALC',
    role:Roles.ADMIN,
    password:passwords.admin,
  });
  const generalDirector = await upsertUser(roles, {
    email:requiredSeedValue('SEED_GENERAL_DIRECTOR_EMAIL'),
    name:'Juan Pablo Hidalgo',
    role:Roles.GENERAL_DIRECTOR,
    password:passwords.generalDirector,
  });

  for (const item of branches) {
    const director = await upsertUser(roles, {
      email:item.email,
      name:item.director,
      role:Roles.BRANCH_DIRECTOR,
      password:passwords.branchDirector,
    });
    await replaceBranchAccess(director.id, [branchRows[item.key].id]);
  }

  const groups = [];
  for (const [groupIndex, item] of classCatalog.entries()) {
    const category = await upsertCategory(item.category);
    const style = await upsertStyle(item.style, category.id);
    const branch = branchRows[item.branch];
    const teacher = await upsertTeacher(roles, item, branch, style);
    const group = await upsertClassGroup(item, branch, style, teacher);
    const sessions = [];
    for (let weekIndex = 0; weekIndex < 6; weekIndex += 1) {
      sessions.push(await upsertClassSession(group, teacher, generalDirector.id, weekIndex, groupIndex));
    }
    await upsertUpcomingClassSession(group, groupIndex);
    groups.push({ ...group, branchKey:item.branch, sessions });
  }

  const students = [];
  for (const [index, name] of studentNames.entries()) {
    const branchItem = branches[Math.floor(index / 5)];
    const student = await upsertStudent(roles, name, index, branchRows[branchItem.key]);
    const matchingGroups = groups.filter((group) => group.branchKey === branchItem.key && group.level === student.level);
    const group = matchingGroups[index % matchingGroups.length];
    await upsertEnrollment(student, group, generalDirector.id);
    await seedStudentAttendance(student, group.sessions, index, generalDirector.id);

    await upsertPayment(student, '2026-05', 'Mensualidad', '45.00', 'paid', index, generalDirector.id);
    await upsertPayment(student, '2026-06', 'Mensualidad', '45.00', index % 9 === 0 ? 'overdue' : 'paid', index, generalDirector.id);
    if (!student.retired) {
      const julyStatus = index % 6 === 0 ? 'overdue' : index % 5 === 0 ? 'pending' : 'paid';
      await upsertPayment(student, '2026-07', 'Mensualidad', '45.00', julyStatus, index, generalDirector.id);
      if (index % 4 === 0) await upsertPayment(student, '2026-07', 'Uniforme', '28.00', 'paid', index, generalDirector.id);
    }
    students.push(student);
  }

  const events = [
    ['matriz', 'Noche Tropical ALC', 'Muestra de Salsa y Bachata para familias.', 'ALL', '2026-07-18T23:00:00.000Z', '2026-07-19T02:00:00.000Z', 'Teatro ALC Matriz', '420.00'],
    ['norte', 'Showcase Urbano B1', 'Presentación de Hip Hop Foundation.', 'B1', '2026-07-25T22:00:00.000Z', '2026-07-26T00:00:00.000Z', 'ALC Norte', '180.00'],
    ['sur', 'Encuentro de Danza Ecuatoriana', 'Presentación cultural abierta a la comunidad.', 'ALL', '2026-08-01T20:00:00.000Z', '2026-08-01T23:00:00.000Z', 'Casa Barrial Sur', '260.00'],
    ['conocoto', 'Bachata Social B2', 'Práctica guiada para estudiantes B2.', 'B2', '2026-07-29T23:00:00.000Z', '2026-07-30T01:00:00.000Z', 'ALC Conocoto', '140.00'],
    ['tumbaco', 'House Open Training', 'Entrenamiento abierto y muestra de proceso.', 'B1', '2026-08-08T21:00:00.000Z', '2026-08-08T23:00:00.000Z', 'ALC Tumbaco', '120.00'],
  ];
  for (const [branchKey, title, description, level, startsAt, endsAt, location, showIncome] of events) {
    await upsertEvent(branchRows[branchKey], { title, description, level, startsAt, endsAt, location, showIncome });
  }
  await seedProspects(branchRows);

  const summary = {
    branches:await prisma.branch.count(),
    students:await prisma.student.count(),
    activeStudents:await prisma.student.count({ where:{ active:true } }),
    teachers:await prisma.teacher.count(),
    groups:await prisma.classGroup.count(),
    finalizedSessions:await prisma.classSession.count({ where:{ attendanceState:'finalized' } }),
    upcomingSessions:await prisma.classSession.count({ where:{ status:'scheduled', attendanceState:'draft' } }),
    attendanceRecords:await prisma.studentAttendanceRecord.count(),
    payments:await prisma.studentPayment.count(),
    events:await prisma.academyEvent.count(),
    prospects:await prisma.enrollmentRequest.count(),
  };
  console.log(JSON.stringify({ message:'Academic defense seed completed', summary }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
