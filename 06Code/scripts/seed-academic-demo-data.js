require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const { Roles } = require('../src/models/constants');
const { hashPassword } = require('../src/utils/passwordHasher');

const prisma = new PrismaClient();

const passwords = {
  admin: process.env.SEED_ADMIN_PASSWORD || 'adminALC2026*',
  generalDirector: process.env.SEED_GENERAL_DIRECTOR_PASSWORD || 'generaldirectorALC2026*',
  branchDirector: process.env.SEED_BRANCH_DIRECTOR_PASSWORD || 'branchdirectorALC2026*',
  teacher: process.env.SEED_TEACHER_PASSWORD || 'teacherALC2026*',
  student: process.env.SEED_STUDENT_PASSWORD || 'studentALC2026*',
};

const branches = [
  { name:'ALC Santo Domingo Norte', city:'Santo Domingo' },
  { name:'ALC Santo Domingo Central', city:'Santo Domingo' },
];

const classCatalog = [
  { name:'Hip Hop Foundation', category:'Urban', level:'B1', teacherEmail:'teacher.hiphop@alc.edu', teacherName:'Mateo Rivera', branchName:branches[0].name, hourlyRate:'18.00' },
  { name:'Afro Foundation', category:'Urban', level:'B1', teacherEmail:'teacher.afro@alc.edu', teacherName:'Camila Torres', branchName:branches[0].name, hourlyRate:'18.00' },
  { name:'Dancehall Skanking', category:'Urban', level:'B2', teacherEmail:'teacher.dancehall@alc.edu', teacherName:'Luis Mendoza', branchName:branches[0].name, hourlyRate:'19.50' },
  { name:'Salsa Level 1', category:'Tropical', level:'B1', teacherEmail:'teacher.salsa@alc.edu', teacherName:'Valeria Cedeño', branchName:branches[1].name, hourlyRate:'18.50' },
  { name:'Bachata Sensual', category:'Tropical', level:'B2', teacherEmail:'teacher.bachata@alc.edu', teacherName:'Andrés Molina', branchName:branches[1].name, hourlyRate:'19.50' },
  { name:'Heels Technique', category:'Urban', level:'B2', teacherEmail:'teacher.heels@alc.edu', teacherName:'Daniela Vega', branchName:branches[1].name, hourlyRate:'20.00' },
];

const studentNames = [
  'Ana Belén Paredes',
  'Damaris Castillo',
  'Mateo Zambrano',
  'Sofía Guerrero',
  'Emilio Vera',
  'Paula Andrade',
  'Nicolás Cevallos',
  'Camila Reyes',
  'David Loor',
  'Mía Alcívar',
  'Julián Moreira',
  'Valentina Solórzano',
  'Sebastián Hidalgo',
  'Isabella Zamora',
  'Gabriel Muñoz',
  'Renata Vélez',
  'Martín Salazar',
  'Luciana Bravo',
  'Tomás Cárdenas',
  'Elena Mora',
];

function assertSafeEnvironment() {
  const isDeployed = ['production', 'staging'].includes(process.env.NODE_ENV);
  if (isDeployed && process.env.ALLOW_DEMO_ACADEMIC_SEED !== 'true') {
    throw new Error('Refusing to seed academic demo data in production/staging without ALLOW_DEMO_ACADEMIC_SEED=true.');
  }
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required to seed academic demo data.');
  }
}

async function upsertRole(name) {
  return prisma.role.upsert({
    where:{ name },
    update:{},
    create:{ name },
  });
}

async function roleMap() {
  const roles = {};
  for (const roleName of Object.values(Roles)) roles[roleName] = await upsertRole(roleName);
  return roles;
}

async function upsertUser(roles, { email, name, role, password, active = true }) {
  return prisma.user.upsert({
    where:{ email },
    update:{
      name,
      passwordHash:hashPassword(password),
      mustChangePassword:false,
      active,
      roleId:roles[role].id,
    },
    create:{
      email,
      name,
      passwordHash:hashPassword(password),
      mustChangePassword:false,
      active,
      roleId:roles[role].id,
    },
  });
}

async function upsertBranch(branch) {
  return prisma.branch.upsert({
    where:{ name:branch.name },
    update:{ city:branch.city, active:true },
    create:{ ...branch, active:true },
  });
}

async function upsertCategory(name) {
  return prisma.danceCategory.upsert({
    where:{ name },
    update:{},
    create:{ name },
  });
}

async function upsertStyle(name, categoryId) {
  return prisma.danceStyle.upsert({
    where:{ name },
    update:{ categoryId },
    create:{ name, categoryId },
  });
}

async function replaceBranchAccess(userId, branchIds) {
  await prisma.userBranchAccess.deleteMany({ where:{ userId } });
  for (const branchId of branchIds) {
    await prisma.userBranchAccess.create({ data:{ userId, branchId } });
  }
}

async function upsertTeacher(roles, item, branch, style) {
  const user = await upsertUser(roles, {
    email:item.teacherEmail,
    name:item.teacherName,
    role:Roles.TEACHER,
    password:passwords.teacher,
  });
  const existing = await prisma.teacher.findFirst({ where:{ userId:user.id } });
  const data = {
    userId:user.id,
    branchId:branch.id,
    fullName:item.teacherName,
    hourlyRate:item.hourlyRate,
    active:true,
  };
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
  const existing = await prisma.classGroup.findFirst({ where:{ name:item.name, branchId:branch.id } });
  const data = {
    branchId:branch.id,
    styleId:style.id,
    teacherId:teacher.id,
    name:item.name,
    level:item.level,
    active:true,
  };
  return existing
    ? prisma.classGroup.update({ where:{ id:existing.id }, data })
    : prisma.classGroup.create({ data });
}

async function upsertClassSession(classGroup, weekIndex) {
  const startsAt = new Date(Date.UTC(2026, 6, 6 + weekIndex * 7, 23, 0, 0));
  const endsAt = new Date(startsAt.getTime() + 90 * 60 * 1000);
  const existing = await prisma.classSession.findFirst({
    where:{
      classGroupId:classGroup.id,
      name:classGroup.name,
      startsAt,
    },
  });
  const data = {
    classGroupId:classGroup.id,
    name:classGroup.name,
    startsAt,
    endsAt,
    status:weekIndex < 3 ? 'completed' : 'scheduled',
  };
  return existing
    ? prisma.classSession.update({ where:{ id:existing.id }, data })
    : prisma.classSession.create({ data });
}

async function upsertStudent(roles, index, branch) {
  const padded = String(index + 1).padStart(2, '0');
  const email = `student${padded}@alc.edu`;
  const active = ![17, 18, 19].includes(index);
  const user = await upsertUser(roles, {
    email,
    name:studentNames[index],
    role:Roles.STUDENT,
    password:passwords.student,
    active:true,
  });
  const existing = await prisma.student.findFirst({ where:{ userId:user.id } });
  const data = {
    userId:user.id,
    branchId:branch.id,
    fullName:studentNames[index],
    level:index % 2 === 0 ? 'B1' : 'B2',
    active,
  };
  return existing
    ? prisma.student.update({ where:{ id:existing.id }, data })
    : prisma.student.create({ data });
}

async function upsertPayment(student, index) {
  const period = '2026-07';
  const status = index % 5 === 0 ? 'overdue' : index % 4 === 0 ? 'pending' : 'paid';
  return prisma.studentPayment.upsert({
    where:{ studentId_period_concept:{ studentId:student.id, period, concept:'Mensualidad' } },
    update:{
      branchId:student.branchId,
      amount:'45.00',
      status,
      paidAt:status === 'paid' ? new Date(Date.UTC(2026, 6, 3 + (index % 10), 15, 0, 0)) : null,
      dueAt:new Date(Date.UTC(2026, 6, 10, 23, 59, 0)),
      notes:status === 'paid' ? 'Pago mensual registrado' : 'Pago pendiente de revisión',
    },
    create:{
      studentId:student.id,
      branchId:student.branchId,
      amount:'45.00',
      concept:'Mensualidad',
      period,
      status,
      paidAt:status === 'paid' ? new Date(Date.UTC(2026, 6, 3 + (index % 10), 15, 0, 0)) : null,
      dueAt:new Date(Date.UTC(2026, 6, 10, 23, 59, 0)),
      notes:status === 'paid' ? 'Pago mensual registrado' : 'Pago pendiente de revisión',
    },
  });
}

async function seedAttendance(students, sessions) {
  for (let index = 0; index < students.length; index += 1) {
    const student = students[index];
    const studentSessions = sessions.filter((session) => session.level === student.level && session.branchId === student.branchId);
    for (const session of studentSessions.slice(0, 3)) {
      const status = (index + session.weekIndex) % 7 === 0 ? 'absent' : (index + session.weekIndex) % 5 === 0 ? 'late' : 'present';
      const existing = await prisma.studentAttendanceRecord.findFirst({
        where:{ studentId:student.id, classSessionId:session.id },
      });
      const data = {
        studentId:student.id,
        classSessionId:session.id,
        status,
        notes:`${session.name} attendance`,
      };
      if (existing) await prisma.studentAttendanceRecord.update({ where:{ id:existing.id }, data });
      else await prisma.studentAttendanceRecord.create({ data });
    }
  }
}

async function upsertEvent(branch, event) {
  const startsAt = new Date(event.startsAt);
  const existing = await prisma.academyEvent.findFirst({
    where:{ branchId:branch.id, title:event.title, startsAt },
  });
  const data = {
    branchId:branch.id,
    title:event.title,
    description:event.description,
    level:event.level,
    startsAt,
    endsAt:event.endsAt ? new Date(event.endsAt) : null,
    location:event.location,
    showIncome:event.showIncome,
    active:true,
  };
  return existing
    ? prisma.academyEvent.update({ where:{ id:existing.id }, data })
    : prisma.academyEvent.create({ data });
}

async function main() {
  assertSafeEnvironment();
  const roles = await roleMap();
  const branchRows = {};
  for (const branch of branches) branchRows[branch.name] = await upsertBranch(branch);

  const admin = await upsertUser(roles, { email:'admin@alc.edu', name:'Administrador ALC', role:Roles.ADMIN, password:passwords.admin });
  const generalDirector = await upsertUser(roles, { email:'generaldirector@alc.edu', name:'Director General ALC', role:Roles.GENERAL_DIRECTOR, password:passwords.generalDirector });
  const northDirector = await upsertUser(roles, { email:'branchdirector.norte@alc.edu', name:'Director Sede Norte', role:Roles.BRANCH_DIRECTOR, password:passwords.branchDirector });
  const centralDirector = await upsertUser(roles, { email:'branchdirector.central@alc.edu', name:'Director Sede Central', role:Roles.BRANCH_DIRECTOR, password:passwords.branchDirector });

  await replaceBranchAccess(northDirector.id, [branchRows[branches[0].name].id]);
  await replaceBranchAccess(centralDirector.id, [branchRows[branches[1].name].id]);

  const sessions = [];
  for (const item of classCatalog) {
    const category = await upsertCategory(item.category);
    const style = await upsertStyle(item.name, category.id);
    const branch = branchRows[item.branchName];
    const teacher = await upsertTeacher(roles, item, branch, style);
    const classGroup = await upsertClassGroup(item, branch, style, teacher);
    for (let weekIndex = 0; weekIndex < 4; weekIndex += 1) {
      const session = await upsertClassSession(classGroup, weekIndex);
      sessions.push({ ...session, branchId:branch.id, level:item.level, weekIndex, name:item.name });
    }
  }

  const students = [];
  for (let index = 0; index < studentNames.length; index += 1) {
    const branch = index < 10 ? branchRows[branches[0].name] : branchRows[branches[1].name];
    const student = await upsertStudent(roles, index, branch);
    students.push(student);
    await upsertPayment(student, index);
  }

  await seedAttendance(students, sessions);

  await upsertEvent(branchRows[branches[0].name], {
    title:'Showcase Urbano B1',
    description:'Presentación interna para estudiantes B1 de Hip Hop y Afro.',
    level:'B1',
    startsAt:'2026-07-25T23:00:00.000Z',
    endsAt:'2026-07-26T01:00:00.000Z',
    location:'ALC Santo Domingo Norte',
    showIncome:'180.00',
  });
  await upsertEvent(branchRows[branches[0].name], {
    title:'Dancehall Open Training B2',
    description:'Entrenamiento escénico para estudiantes B2.',
    level:'B2',
    startsAt:'2026-08-01T22:00:00.000Z',
    endsAt:'2026-08-02T00:00:00.000Z',
    location:'ALC Santo Domingo Norte',
    showIncome:'120.00',
  });
  await upsertEvent(branchRows[branches[1].name], {
    title:'Noche Tropical ALC',
    description:'Muestra de Salsa Level 1 y Bachata Sensual.',
    level:'ALL',
    startsAt:'2026-07-31T23:30:00.000Z',
    endsAt:'2026-08-01T02:00:00.000Z',
    location:'ALC Santo Domingo Central',
    showIncome:'260.00',
  });

  const teacherAccounts = classCatalog.map((item) => ({ email:item.teacherEmail, password:passwords.teacher, role:'Profesor', name:item.teacherName }));
  const studentAccounts = studentNames.map((name, index) => ({ email:`student${String(index + 1).padStart(2, '0')}@alc.edu`, password:passwords.student, role:'Estudiante', name }));

  console.log(JSON.stringify({
    summary:{
      branches:Object.values(branchRows).length,
      students:students.length,
      teachers:classCatalog.length,
      classSessions:sessions.length,
      events:3,
    },
    accounts:[
      { email:admin.email, password:passwords.admin, role:'Administrador', name:admin.name },
      { email:generalDirector.email, password:passwords.generalDirector, role:'Director general', name:generalDirector.name },
      { email:northDirector.email, password:passwords.branchDirector, role:'Director de sede', name:northDirector.name },
      { email:centralDirector.email, password:passwords.branchDirector, role:'Director de sede', name:centralDirector.name },
      ...teacherAccounts,
      ...studentAccounts,
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
