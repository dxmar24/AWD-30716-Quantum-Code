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

async function createReferenceData(prefix) {
  const branch = await prisma.branch.create({
    data: {
      name: `Santo Domingo Central ${prefix}`,
      city: 'Santo Domingo',
      active: true,
    },
  });

  const category = await prisma.danceCategory.create({
    data: {
      name: `Tropical Verification ${prefix}`,
    },
  });

  const salsa = await prisma.danceStyle.create({
    data: {
      categoryId: category.id,
      name: `Salsa Verification ${prefix}`,
    },
  });

  const bachata = await prisma.danceStyle.create({
    data: {
      categoryId: category.id,
      name: `Bachata Verification ${prefix}`,
    },
  });

  const adminRole = await prisma.role.upsert({
    where: { name: 'Admin' },
    update: {},
    create: { name: 'Admin' },
  });

  const admin = await prisma.user.create({
    data: {
      email: `verification-admin-${prefix.toLowerCase()}@alc.test`,
      name: 'Verification Admin',
      roleId: adminRole.id,
      googleSub: `verification-admin-${prefix}`,
      active: true,
    },
  });

  return { branch, category, salsa, bachata, admin };
}

async function createEnrollmentRequests(prefix, branch) {
  const prospects = [
    ['Ana Martinez', 'Salsa'],
    ['Daniel Perez', 'Bachata'],
    ['Laura Gomez', 'Salsa'],
    ['Jose Ramirez', 'Bachata'],
    ['Maria Fernandez', 'Salsa'],
  ];

  return Promise.all(
    prospects.map(([name, style], index) =>
      prisma.enrollmentRequest.create({
        data: {
          fullName: name,
          email: `prospect-${index + 1}-${prefix.toLowerCase()}@alc.test`,
          phone: `809-555-${String(3100 + index).padStart(4, '0')}`,
          branchId: branch.id,
          preferredBranch: branch.name,
          styleInterest: style,
          message: 'Postman verification enrollment record.',
          status: 'pending',
        },
      }),
    ),
  );
}

async function createStudents(prefix, branch) {
  const students = [
    ['Camila Rojas', 'B1'],
    ['Mateo Garcia', 'B1'],
    ['Valeria Santos', 'B1'],
    ['Sebastian Diaz', 'B2'],
    ['Lucia Hernandez', 'B1'],
    ['Andres Morales', 'B2'],
  ];

  return Promise.all(
    students.map(([fullName, level]) =>
      prisma.student.create({
        data: {
          branchId: branch.id,
          fullName: `${fullName} ${prefix}`,
          level,
          active: true,
        },
      }),
    ),
  );
}

async function createTeachers(prefix, branch) {
  const teachers = [
    ['Isabella Torres', '22.50'],
    ['Carlos Medina', '20.00'],
    ['Natalia Vargas', '24.00'],
  ];

  return Promise.all(
    teachers.map(([fullName, hourlyRate]) =>
      prisma.teacher.create({
        data: {
          branchId: branch.id,
          fullName: `${fullName} ${prefix}`,
          hourlyRate,
          active: true,
        },
      }),
    ),
  );
}

async function createGroups(prefix, branch, styles, teachers) {
  return Promise.all([
    prisma.classGroup.create({
      data: {
        branchId: branch.id,
        styleId: styles.salsa.id,
        teacherId: teachers[0].id,
        name: `B1 Salsa Verification ${prefix}`,
        level: 'B1',
        active: true,
      },
    }),
    prisma.classGroup.create({
      data: {
        branchId: branch.id,
        styleId: styles.bachata.id,
        teacherId: teachers[1].id,
        name: `B2 Bachata Verification ${prefix}`,
        level: 'B2',
        active: true,
      },
    }),
  ]);
}

async function createSessions(groups) {
  const baseDate = addDays(new Date(), -12);
  const sessions = [];

  for (let index = 0; index < 6; index += 1) {
    const startsAt = addHours(addDays(baseDate, index * 2), 18);

    sessions.push(
      await prisma.classSession.create({
        data: {
          classGroupId: groups[index % groups.length].id,
          startsAt,
          endsAt: addHours(startsAt, 2),
          status: index < 5 ? 'completed' : 'scheduled',
        },
      }),
    );
  }

  return sessions;
}

async function createStudentAttendance(students, sessions) {
  const rows = [
    [students[0], sessions[0], 'present', 'Verification attendance 1.'],
    [students[0], sessions[1], 'present', 'Verification attendance 2.'],
    [students[0], sessions[2], 'late', 'Verification attendance 3.'],
    [students[0], sessions[3], 'present', 'Verification attendance 4.'],
    [students[0], sessions[4], 'justified', 'Verification attendance 5.'],
    [students[0], sessions[5], 'present', 'Verification attendance 6.'],
    [students[1], sessions[0], 'present', 'Verification attendance 7.'],
    [students[1], sessions[1], 'absent', 'Verification absence for justification.'],
    [students[2], sessions[0], 'present', 'Verification attendance 8.'],
    [students[3], sessions[1], 'late', 'Verification attendance 9.'],
  ];

  const records = [];

  for (const [student, session, status, notes] of rows) {
    records.push(
      await prisma.studentAttendanceRecord.create({
        data: {
          studentId: student.id,
          classSessionId: session.id,
          status,
          notes,
        },
      }),
    );
  }

  return records;
}

async function createTeacherAttendance(teachers, sessions) {
  const rows = [
    [teachers[0], sessions[0], 3],
    [teachers[1], sessions[1], 2.5],
  ];

  return Promise.all(
    rows.map(([teacher, session, hours]) => {
      const checkInAt = addHours(session.startsAt, -0.5);

      return prisma.teacherAttendanceRecord.create({
        data: {
          teacherId: teacher.id,
          classSessionId: session.id,
          checkInAt,
          checkOutAt: addHours(checkInAt, hours),
        },
      });
    }),
  );
}

async function createReviews(prefix, admin, students, attendanceRecords) {
  const absenceAttendance = attendanceRecords.find((record) => record.status === 'absent');

  const absenceJustification = await prisma.absenceJustification.create({
    data: {
      attendanceRecordId: absenceAttendance.id,
      reason: 'Medical appointment documented for verification data.',
      evidenceUrl: 'https://example.com/evidence/verification-medical-note',
      status: 'approved',
      reviewedBy: admin.id,
      reviewNotes: 'Approved verification absence.',
      reviewedAt: new Date(),
    },
  });

  const scholarshipEvaluation = await prisma.scholarshipEvaluation.create({
    data: {
      studentId: students[0].id,
      percentage: 50,
      attendanceRate: '100.00',
      theoryScore: '88.00',
      practiceScore: '92.00',
      approved: true,
      evaluatedBy: admin.id,
      evaluatedAt: new Date(),
    },
  });

  const levelPromotionEvaluation = await prisma.levelPromotionEvaluation.create({
    data: {
      studentId: students[0].id,
      fromLevel: 'B1',
      toLevel: 'B2',
      attendanceRate: '100.00',
      consistencyScore: '90.00',
      theoryScore: '86.00',
      practiceScore: '91.00',
      approved: false,
      evaluatedBy: admin.id,
      evaluatedAt: new Date(),
    },
  });

  const auditLogs = await Promise.all([
    prisma.auditLog.create({
      data: {
        actorUserId: admin.id,
        action: 'real_verification_seed',
        entity: 'students',
        entityId: students[0].id,
        metadata: { prefix, purpose: 'Postman real ID verification' },
      },
    }),
    prisma.auditLog.create({
      data: {
        actorUserId: admin.id,
        action: 'real_verification_seed',
        entity: 'attendance',
        entityId: attendanceRecords[0].id,
        metadata: { prefix, purpose: 'API rule verification' },
      },
    }),
  ]);

  return {
    absenceAttendance,
    absenceJustification,
    scholarshipEvaluation,
    levelPromotionEvaluation,
    auditLogs,
  };
}

async function getTableCounts() {
  const [
    branches,
    users,
    danceCategories,
    danceStyles,
    enrollmentRequests,
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
    prisma.branch.count(),
    prisma.user.count(),
    prisma.danceCategory.count(),
    prisma.danceStyle.count(),
    prisma.enrollmentRequest.count(),
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
    branches,
    users,
    danceCategories,
    danceStyles,
    enrollmentRequests,
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
    throw new Error('DATABASE_URL is required to seed real verification data.');
  }

  const prefix = `REAL-${compactTimestamp(new Date())}`;
  const { branch, category, salsa, bachata, admin } = await createReferenceData(prefix);
  const enrollmentRequests = await createEnrollmentRequests(prefix, branch);
  const students = await createStudents(prefix, branch);
  const teachers = await createTeachers(prefix, branch);
  const groups = await createGroups(prefix, branch, { salsa, bachata }, teachers);
  const sessions = await createSessions(groups);
  const studentAttendanceRecords = await createStudentAttendance(students, sessions);
  const teacherAttendanceRecords = await createTeacherAttendance(teachers, sessions);
  const reviews = await createReviews(prefix, admin, students, studentAttendanceRecords);

  const created = {
    branches: 1,
    users: 1,
    danceCategories: 1,
    danceStyles: 2,
    enrollmentRequests: enrollmentRequests.length,
    students: students.length,
    teachers: teachers.length,
    classGroups: groups.length,
    classSessions: sessions.length,
    studentAttendanceRecords: studentAttendanceRecords.length,
    teacherAttendanceRecords: teacherAttendanceRecords.length,
    absenceJustifications: 1,
    scholarshipEvaluations: 1,
    levelPromotionEvaluations: 1,
    auditLogs: reviews.auditLogs.length,
  };

  const postmanEnvironment = {
    user_id: admin.id,
    branch_id: branch.id,
    student_id: students[0].id,
    teacher_id: teachers[0].id,
    dance_category_id: category.id,
    dance_style_id: salsa.id,
    class_group_id: groups[0].id,
    class_session_id: sessions[0].id,
    absence_class_session_id: sessions[1].id,
    attendance_record_id: studentAttendanceRecords[0].id,
    absence_attendance_record_id: reviews.absenceAttendance.id,
    teacher_attendance_id: teacherAttendanceRecords[0].id,
    absence_justification_id: reviews.absenceJustification.id,
    enrollment_request_id: enrollmentRequests[0].id,
  };

  const createdTotal = Object.values(created).reduce((total, count) => total + count, 0);
  const tableCounts = await getTableCounts();

  console.log(
    JSON.stringify(
      {
        prefix,
        databaseUrlConfigured: true,
        created,
        createdTotal,
        postmanEnvironment,
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
