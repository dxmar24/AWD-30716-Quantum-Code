require('dotenv').config();

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function compactTimestamp(date) {
  return date.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
}

function addHours(date, hours) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

async function getOrCreateReferenceData(prefix) {
  let branch = await prisma.branch.findFirst({
    where: { active: true },
    orderBy: { name: 'asc' },
  });

  if (!branch) {
    branch = await prisma.branch.create({
      data: {
        name: `${prefix} Main Branch`,
        city: 'Santo Domingo',
        active: true,
      },
    });
  }

  let category = await prisma.danceCategory.findFirst({
    orderBy: { name: 'asc' },
  });

  if (!category) {
    category = await prisma.danceCategory.create({
      data: { name: `${prefix} Tropical` },
    });
  }

  let style = await prisma.danceStyle.findFirst({
    orderBy: { name: 'asc' },
  });

  if (!style) {
    style = await prisma.danceStyle.create({
      data: {
        name: `${prefix} Salsa`,
        categoryId: category.id,
      },
    });
  }

  const adminRole = await prisma.role.upsert({
    where: { name: 'Admin' },
    update: {},
    create: { name: 'Admin' },
  });

  const admin = await prisma.user.upsert({
    where: { email: 'business-rule-demo-admin@alc.test' },
    update: {
      name: 'Business Rule Demo Admin',
      active: true,
      roleId: adminRole.id,
      googleSub: 'business-rule-demo-admin',
    },
    create: {
      email: 'business-rule-demo-admin@alc.test',
      name: 'Business Rule Demo Admin',
      active: true,
      roleId: adminRole.id,
      googleSub: 'business-rule-demo-admin',
    },
  });

  return { branch, category, style, admin };
}

async function createEnrollmentRequests(prefix, branch) {
  return Promise.all(
    Array.from({ length: 8 }, (_, index) =>
      prisma.enrollmentRequest.create({
        data: {
          fullName: `${prefix} Enrollment ${index + 1}`,
          email: `${prefix.toLowerCase()}-enrollment-${index + 1}@alc.test`,
          phone: `809-555-${String(2100 + index).padStart(4, '0')}`,
          branchId: branch.id,
          preferredBranch: branch.name,
          styleInterest: index % 2 === 0 ? 'Salsa' : 'Bachata',
          message: 'Business rule demo enrollment request.',
          status: 'pending',
        },
      }),
    ),
  );
}

async function createStudents(prefix, branch) {
  const levels = ['B1', 'B1', 'B1', 'B2', 'B1', 'B1'];

  return Promise.all(
    levels.map((level, index) =>
      prisma.student.create({
        data: {
          branchId: branch.id,
          fullName: `${prefix} Student ${index + 1}`,
          level,
          active: true,
        },
      }),
    ),
  );
}

async function createTeachers(prefix, branch) {
  return Promise.all(
    Array.from({ length: 3 }, (_, index) =>
      prisma.teacher.create({
        data: {
          branchId: branch.id,
          fullName: `${prefix} Teacher ${index + 1}`,
          hourlyRate: String(18 + index * 2),
          active: true,
        },
      }),
    ),
  );
}

async function createGroups(prefix, branch, style, teachers) {
  return Promise.all(
    teachers.map((teacher, index) =>
      prisma.classGroup.create({
        data: {
          branchId: branch.id,
          styleId: style.id,
          teacherId: teacher.id,
          name: `${prefix} Group ${index + 1}`,
          level: index === 2 ? 'B2' : 'B1',
          active: true,
        },
      }),
    ),
  );
}

async function createSessions(groups) {
  const baseDate = addDays(new Date(), -18);
  const sessions = [];

  for (let index = 0; index < 10; index += 1) {
    const startsAt = addHours(addDays(baseDate, index * 2), 18);

    sessions.push(
      await prisma.classSession.create({
        data: {
          classGroupId: groups[index % groups.length].id,
          startsAt,
          endsAt: addHours(startsAt, 2),
          status: index < 8 ? 'completed' : 'scheduled',
        },
      }),
    );
  }

  return sessions;
}

async function createStudentAttendance(students, sessions) {
  const attendanceRows = [];
  const firstStudentStatuses = [
    'present',
    'present',
    'present',
    'late',
    'present',
    'justified',
    'present',
    'present',
    'present',
    'absent',
  ];

  for (let index = 0; index < firstStudentStatuses.length; index += 1) {
    attendanceRows.push({
      studentId: students[0].id,
      classSessionId: sessions[index].id,
      status: firstStudentStatuses[index],
      notes: 'Business rule demo scholarship/promotion attendance.',
    });
  }

  attendanceRows.push(
    { studentId: students[1].id, classSessionId: sessions[0].id, status: 'present', notes: 'Demo attendance.' },
    { studentId: students[1].id, classSessionId: sessions[1].id, status: 'absent', notes: 'Demo absence for justification.' },
    { studentId: students[1].id, classSessionId: sessions[2].id, status: 'justified', notes: 'Demo justified absence.' },
    { studentId: students[2].id, classSessionId: sessions[0].id, status: 'present', notes: 'Demo attendance.' },
    { studentId: students[2].id, classSessionId: sessions[1].id, status: 'present', notes: 'Demo attendance.' },
    { studentId: students[2].id, classSessionId: sessions[2].id, status: 'present', notes: 'Demo attendance.' },
    { studentId: students[3].id, classSessionId: sessions[0].id, status: 'late', notes: 'Demo attendance.' },
    { studentId: students[4].id, classSessionId: sessions[1].id, status: 'present', notes: 'Demo attendance.' },
    { studentId: students[5].id, classSessionId: sessions[2].id, status: 'present', notes: 'Demo attendance.' },
  );

  return Promise.all(
    attendanceRows.map((row) =>
      prisma.studentAttendanceRecord.create({
        data: row,
      }),
    ),
  );
}

async function createTeacherAttendance(teachers, sessions) {
  return Promise.all(
    teachers.map((teacher, index) => {
      const checkInAt = addHours(sessions[index].startsAt, -1);

      return prisma.teacherAttendanceRecord.create({
        data: {
          teacherId: teacher.id,
          classSessionId: sessions[index].id,
          checkInAt,
          checkOutAt: addHours(checkInAt, 3),
        },
      });
    }),
  );
}

async function createAcademicReviews(admin, students, attendanceRecords) {
  const absentRecords = attendanceRecords.filter((record) => record.status === 'absent');

  const absenceJustifications = await Promise.all(
    absentRecords.slice(0, 2).map((record, index) =>
      prisma.absenceJustification.create({
        data: {
          attendanceRecordId: record.id,
          reason: `Business rule demo justification ${index + 1}.`,
          evidenceUrl: 'https://example.com/evidence/business-rule-demo',
          status: index === 0 ? 'approved' : 'pending',
          reviewedBy: index === 0 ? admin.id : null,
          reviewNotes: index === 0 ? 'Demo approval for documented absence.' : null,
          reviewedAt: index === 0 ? new Date() : null,
        },
      }),
    ),
  );

  const scholarshipEvaluations = await Promise.all([
    prisma.scholarshipEvaluation.create({
      data: {
        studentId: students[0].id,
        percentage: 50,
        attendanceRate: '90.00',
        theoryScore: '86.00',
        practiceScore: '91.00',
        approved: true,
        evaluatedBy: admin.id,
        evaluatedAt: new Date(),
      },
    }),
    prisma.scholarshipEvaluation.create({
      data: {
        studentId: students[1].id,
        percentage: 25,
        attendanceRate: '66.67',
        theoryScore: '70.00',
        practiceScore: '74.00',
        approved: false,
        evaluatedBy: admin.id,
        evaluatedAt: new Date(),
      },
    }),
  ]);

  const levelPromotionEvaluations = await Promise.all([
    prisma.levelPromotionEvaluation.create({
      data: {
        studentId: students[0].id,
        fromLevel: 'B1',
        toLevel: 'B2',
        attendanceRate: '90.00',
        consistencyScore: '88.00',
        theoryScore: '82.00',
        practiceScore: '87.00',
        approved: false,
        evaluatedBy: admin.id,
        evaluatedAt: new Date(),
      },
    }),
    prisma.levelPromotionEvaluation.create({
      data: {
        studentId: students[2].id,
        fromLevel: 'B1',
        toLevel: 'B2',
        attendanceRate: '100.00',
        consistencyScore: '78.00',
        theoryScore: '76.00',
        practiceScore: '80.00',
        approved: false,
        evaluatedBy: admin.id,
        evaluatedAt: new Date(),
      },
    }),
  ]);

  return {
    absenceJustifications,
    scholarshipEvaluations,
    levelPromotionEvaluations,
  };
}

async function createAuditLogs(prefix, admin, students) {
  return Promise.all([
    prisma.auditLog.create({
      data: {
        actorUserId: admin.id,
        action: 'business_rule_demo_seed',
        entity: 'student_attendance_records',
        entityId: students[0].id,
        metadata: { prefix, purpose: 'attendance rule evidence' },
      },
    }),
    prisma.auditLog.create({
      data: {
        actorUserId: admin.id,
        action: 'business_rule_demo_seed',
        entity: 'scholarship_evaluations',
        entityId: students[0].id,
        metadata: { prefix, purpose: 'scholarship rule evidence' },
      },
    }),
    prisma.auditLog.create({
      data: {
        actorUserId: admin.id,
        action: 'business_rule_demo_seed',
        entity: 'level_promotion_evaluations',
        entityId: students[2].id,
        metadata: { prefix, purpose: 'promotion rule evidence' },
      },
    }),
  ]);
}

async function getTableCounts() {
  const [
    enrollmentRequests,
    users,
    students,
    teachers,
    classGroups,
    classSessions,
    studentAttendanceRecords,
    teacherAttendanceRecords,
    absenceJustifications,
    scholarshipEvaluations,
    levelPromotionEvaluations,
    auditLogs,
  ] = await Promise.all([
    prisma.enrollmentRequest.count(),
    prisma.user.count(),
    prisma.student.count(),
    prisma.teacher.count(),
    prisma.classGroup.count(),
    prisma.classSession.count(),
    prisma.studentAttendanceRecord.count(),
    prisma.teacherAttendanceRecord.count(),
    prisma.absenceJustification.count(),
    prisma.scholarshipEvaluation.count(),
    prisma.levelPromotionEvaluation.count(),
    prisma.auditLog.count(),
  ]);

  return {
    enrollmentRequests,
    users,
    students,
    teachers,
    classGroups,
    classSessions,
    studentAttendanceRecords,
    teacherAttendanceRecords,
    absenceJustifications,
    scholarshipEvaluations,
    levelPromotionEvaluations,
    auditLogs,
  };
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required to seed business rule demo data.');
  }

  const startedAt = new Date();
  const prefix = `BRDEMO-${compactTimestamp(startedAt)}`;
  const { branch, style, admin } = await getOrCreateReferenceData(prefix);

  const enrollmentRequests = await createEnrollmentRequests(prefix, branch);
  const students = await createStudents(prefix, branch);
  const teachers = await createTeachers(prefix, branch);
  const groups = await createGroups(prefix, branch, style, teachers);
  const sessions = await createSessions(groups);
  const studentAttendanceRecords = await createStudentAttendance(students, sessions);
  const teacherAttendanceRecords = await createTeacherAttendance(teachers, sessions);
  const academicReviews = await createAcademicReviews(admin, students, studentAttendanceRecords);
  const auditLogs = await createAuditLogs(prefix, admin, students);

  const created = {
    enrollmentRequests: enrollmentRequests.length,
    students: students.length,
    teachers: teachers.length,
    classGroups: groups.length,
    classSessions: sessions.length,
    studentAttendanceRecords: studentAttendanceRecords.length,
    teacherAttendanceRecords: teacherAttendanceRecords.length,
    absenceJustifications: academicReviews.absenceJustifications.length,
    scholarshipEvaluations: academicReviews.scholarshipEvaluations.length,
    levelPromotionEvaluations: academicReviews.levelPromotionEvaluations.length,
    auditLogs: auditLogs.length,
  };

  const createdTotal = Object.values(created).reduce((sum, value) => sum + value, 0);
  const tableCounts = await getTableCounts();

  console.log(
    JSON.stringify(
      {
        prefix,
        databaseUrlConfigured: true,
        created,
        createdTotal,
        tableCounts,
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
