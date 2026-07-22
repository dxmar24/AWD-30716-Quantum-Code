const { DatabaseContext } = require('../../src/repositories/DatabaseContext');
const { AuditService } = require('../../src/services/AuditService');
const { AttendanceService } = require('../../src/services/AttendanceService');
const { RulesService } = require('../../src/services/RulesService');

const STUDENT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const GROUP_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

function buildRules() {
  const db = new DatabaseContext();
  const attendance = new AttendanceService(db, new AuditService(db));
  return { db, attendance, rules:new RulesService(db, attendance) };
}

function finalizedAttendance(db, statuses, firstDay = 1) {
  return statuses.map((status, index) => {
    const startsAt = new Date(Date.UTC(2026, 5, firstDay + index, 18, 0, 0));
    const session = db.classSessions.create({
      classGroupId:GROUP_ID,
      startsAt:startsAt.toISOString(),
      endsAt:new Date(startsAt.getTime() + 3600000).toISOString(),
      status:'completed',
      attendanceState:'finalized',
    });
    const record = db.studentAttendance.create({ studentId:STUDENT_ID, classSessionId:session.id, status, version:1 });
    return { session, record };
  });
}

test('scholarship candidate uses the active rule and requires its minimum finalized sessions', async () => {
  const { db, rules } = buildRules();
  const rows = finalizedAttendance(db, ['present','present','present','present','present','present','present','absent']);

  await expect(rules.scholarshipCandidate(STUDENT_ID)).resolves.toMatchObject({
    candidate:false,
    countedSessions:8,
    minimumSessions:8,
    attendanceRate:0.875,
  });

  db.studentAttendance.update(rows[7].record.id, { status:'present' });
  await expect(rules.scholarshipCandidate(STUDENT_ID)).resolves.toMatchObject({
    candidate:true,
    countedSessions:8,
    attendanceRate:1,
  });
});

test('promotion candidate requires active B1 student and at least eight counted finalized sessions', async () => {
  const { db, rules } = buildRules();
  finalizedAttendance(db, ['present','late','present','present','present','present','present']);
  await expect(rules.promotionCandidate(STUDENT_ID)).resolves.toMatchObject({ candidate:false, countedSessions:7 });

  finalizedAttendance(db, ['present'], 10);
  await expect(rules.promotionCandidate(STUDENT_ID)).resolves.toMatchObject({ candidate:true, countedSessions:8 });
  db.students.update(STUDENT_ID, { level:'B2' });
  await expect(rules.promotionCandidate(STUDENT_ID)).resolves.toMatchObject({ candidate:false });
});

test('approved absence justification excludes the absence from the attendance denominator without changing status', async () => {
  const { db, attendance } = buildRules();
  const rows = finalizedAttendance(db, ['present','absent','late']);
  db.absenceJustifications.create({ attendanceRecordId:rows[1].record.id, reason:'Medical leave', status:'approved' });

  await expect(attendance.attendanceMetrics(STUDENT_ID)).resolves.toMatchObject({
    totalFinalizedSessions:3,
    countedSessions:2,
    excusedSessions:1,
    attendedSessions:2,
    attendanceRate:1,
  });
  expect(db.studentAttendance.findById(rows[1].record.id).status).toBe('absent');
});

test('teacher payment uses checked out worked hours and preserves a zero hourly rate', async () => {
  const { db, rules } = buildRules();
  const teacherId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  db.teachers.update(teacherId, { hourlyRate:0 });
  db.teacherAttendance.create({ teacherId, checkInAt:'2026-06-01T10:00:00.000Z', checkOutAt:'2026-06-01T12:00:00.000Z' });
  await expect(rules.teacherPayment(teacherId)).resolves.toMatchObject({ hours:2, hourlyRate:0, amount:0 });
});

test('attendance metrics use finalized class session dates instead of entry creation dates', async () => {
  const { db, attendance } = buildRules();
  const startsAt = '2026-05-01T18:00:00.000Z';
  const session = db.classSessions.create({
    classGroupId:GROUP_ID,
    startsAt,
    endsAt:'2026-05-01T20:00:00.000Z',
    status:'completed',
    attendanceState:'finalized',
  });
  db.studentAttendance.create({
    studentId:STUDENT_ID,
    classSessionId:session.id,
    status:'present',
    createdAt:'2026-07-01T10:00:00.000Z',
  });

  await expect(attendance.attendanceMetrics(
    STUDENT_ID,
    '2026-06-01T00:00:00.000Z',
    '2026-08-01T00:00:00.000Z',
  )).resolves.toMatchObject({ totalFinalizedSessions:0, attendanceRate:0 });
});
