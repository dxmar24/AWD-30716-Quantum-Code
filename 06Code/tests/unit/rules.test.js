const { DatabaseContext } = require('../../src/repositories/DatabaseContext');
const { AuditService } = require('../../src/services/AuditService');
const { AttendanceService } = require('../../src/services/AttendanceService');
const { RulesService } = require('../../src/services/RulesService');

function buildRules() {
  const db = new DatabaseContext();
  const attendance = new AttendanceService(db, new AuditService(db));
  return { db, rules: new RulesService(db, attendance) };
}

test('scholarship candidate requires at least 90 percent attendance', async () => {
  const { db, rules } = buildRules();
  const studentId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  db.studentAttendance.create({ studentId, classSessionId:'11111111-2222-4333-8444-555555555555', status:'present' });
  db.studentAttendance.create({ studentId, classSessionId:'11111111-2222-4333-8444-666666666666', status:'present' });
  db.studentAttendance.create({ studentId, classSessionId:'11111111-2222-4333-8444-777777777777', status:'absent' });

  await expect(rules.scholarshipCandidate(studentId)).resolves.toMatchObject({ candidate:false });

  db.studentAttendance.update(db.studentAttendance.all()[2].id, { status:'present' });
  await expect(rules.scholarshipCandidate(studentId)).resolves.toMatchObject({ candidate:true });
});

test('promotion candidate requires B1 student and attendance evidence', async () => {
  const { db, rules } = buildRules();
  const studentId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  db.studentAttendance.create({ studentId, classSessionId:'11111111-2222-4333-8444-555555555555', status:'present' });
  db.studentAttendance.create({ studentId, classSessionId:'11111111-2222-4333-8444-666666666666', status:'late' });

  await expect(rules.promotionCandidate(studentId)).resolves.toMatchObject({ candidate:true });
  db.students.update(studentId, { level:'B2' });
  await expect(rules.promotionCandidate(studentId)).resolves.toMatchObject({ candidate:false });
});

test('teacher payment uses checked out worked hours', async () => {
  const { db, rules } = buildRules();
  const teacherId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

  db.teacherAttendance.create({ teacherId, checkInAt:'2026-06-01T10:00:00.000Z', checkOutAt:'2026-06-01T12:00:00.000Z' });
  await expect(rules.teacherPayment(teacherId)).resolves.toMatchObject({ hours:2, amount:25 });
});
