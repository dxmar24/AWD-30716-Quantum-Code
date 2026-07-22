require('dotenv').config();

const { PrismaDatabaseContext } = require('../backend/src/repositories/PrismaDatabaseContext');

const ROLLBACK = new Error('OPERATIONAL_SMOKE_ROLLBACK');

async function main() {
  if (process.env.ALLOW_OPERATIONAL_SMOKE !== 'true') {
    throw new Error('Set ALLOW_OPERATIONAL_SMOKE=true explicitly; the test always rolls its transaction back.');
  }
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
  const db = new PrismaDatabaseContext();
  try {
    await db.transaction(async (tx) => {
      const admin = (await tx.users.all()).find((user) => user.role === 'Admin');
      if (!admin) throw new Error('An Admin must exist before the operational smoke test.');
      const marker = Date.now();
      const branch = await tx.branches.create({ name:`Smoke Branch ${marker}`, city:'Test', active:true });
      const studentUser = await tx.users.create({
        email:`smoke.student.${marker}@example.invalid`,
        name:'Smoke Student',
        role:'Student',
        active:true,
        mustChangePassword:true,
      });
      const teacherUser = await tx.users.create({
        email:`smoke.teacher.${marker}@example.invalid`,
        name:'Smoke Teacher',
        role:'Teacher',
        active:true,
        mustChangePassword:true,
      });
      const student = await tx.students.create({ userId:studentUser.id, branchId:branch.id, fullName:'Smoke Student', level:'B1', active:true });
      const teacher = await tx.teachers.create({ userId:teacherUser.id, branchId:branch.id, fullName:'Smoke Teacher', hourlyRate:20, active:true });
      const group = await tx.classGroups.create({ branchId:branch.id, styleId:null, teacherId:teacher.id, name:'Smoke Group', level:'B1', capacity:10, active:true });
      const startsAt = new Date(Date.now() + 3600000).toISOString();
      const endsAt = new Date(Date.now() + 7200000).toISOString();
      const session = await tx.classSessions.create({ classGroupId:group.id, name:'Smoke Session', startsAt, endsAt, status:'scheduled', attendanceState:'draft' });
      await tx.classGroupEnrollments.create({ studentId:student.id, classGroupId:group.id, status:'active', startsAt:new Date().toISOString(), createdBy:admin.id });
      const payment = await tx.studentPayments.create({
        studentId:student.id,
        branchId:branch.id,
        amount:25,
        concept:'Smoke tuition',
        period:'2026-07',
        status:'pending',
        transactionType:'charge',
        createdBy:admin.id,
        updatedBy:admin.id,
      });
      await tx.teacherAttendance.create({
        teacherId:teacher.id,
        classSessionId:session.id,
        checkInAt:new Date().toISOString(),
        hourlyRateSnapshot:20,
      });
      const lead = await tx.enrollmentRequests.create({
        fullName:'Smoke Lead',
        email:`smoke.lead.${marker}@example.invalid`,
        branchId:branch.id,
        status:'contacted',
        statusNotes:'Smoke validation',
        updatedBy:admin.id,
      });
      await tx.auditLogs.create({ actorUserId:admin.id, action:'OPERATIONAL_SMOKE', entity:'student_payments', entityId:payment.id, metadata:{ leadId:lead.id } });
      if (!(await tx.studentPayments.findById(payment.id)) || !(await tx.enrollmentRequests.findById(lead.id))) {
        throw new Error('Operational records could not be read back.');
      }
      throw ROLLBACK;
    });
  } catch (error) {
    if (error !== ROLLBACK) throw error;
    console.log('Prisma operational smoke test passed; transaction rolled back.');
  } finally {
    await db.close();
  }
}

main().catch((error) => {
  console.error(`Prisma operational smoke failed: ${error.message}`);
  process.exit(1);
});
