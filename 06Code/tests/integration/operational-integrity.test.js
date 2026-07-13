const request = require('supertest');
const jwt = require('jsonwebtoken');
const { createApp } = require('../../src/app');

const IDS = Object.freeze({
  branch:'11111111-1111-4111-8111-111111111111',
  otherBranch:'22222222-2222-4222-8222-222222222222',
  student:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  teacher:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  group:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  session:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
});

async function login(app, sub, email, name) {
  const idToken = jwt.sign({ sub, email, name, aud:'test-google-client-id' }, 'x');
  const response = await request(app).post('/api/v1/auth/google').send({ idToken }).expect(200);
  return response.headers['set-cookie'][0];
}

const adminCookie = (app) => login(app, 'test-admin', 'admin@alc.edu', 'Admin User');
const teacherCookie = (app) => login(app, 'test-teacher', 'teacher@alc.edu', 'Demo Teacher User');

test('financial ledger derives branch, rejects duplicates and preserves a paid charge through a reversal', async () => {
  const app = createApp();
  const admin = await adminCookie(app);
  const period = new Date().toISOString().slice(0, 7);

  await request(app)
    .post('/api/v1/student-payments')
    .set('Cookie', admin)
    .send({ studentId:IDS.student, branchId:IDS.otherBranch, amount:50, concept:'Mensualidad', period, status:'paid' })
    .expect(422);

  const charge = await request(app)
    .post('/api/v1/student-payments')
    .set('Cookie', admin)
    .send({ studentId:IDS.student, amount:50, concept:'Mensualidad', period, status:'paid' })
    .expect(201);
  expect(charge.body.data).toMatchObject({ branchId:IDS.branch, amount:50, status:'paid', transactionType:'charge' });

  await request(app)
    .post('/api/v1/student-payments')
    .set('Cookie', admin)
    .send({ studentId:IDS.student, amount:50, concept:'  mensualidad  ', period, status:'pending' })
    .expect(409);

  const reversal = await request(app)
    .post(`/api/v1/student-payments/${charge.body.data.id}/reversal`)
    .set('Cookie', admin)
    .send({ reason:'Duplicate bank settlement.' })
    .expect(201);
  expect(reversal.body.data).toMatchObject({ amount:-50, status:'paid', transactionType:'reversal', reversalOfId:charge.body.data.id });

  await request(app)
    .post(`/api/v1/student-payments/${charge.body.data.id}/reversal`)
    .set('Cookie', admin)
    .send({ reason:'Attempting a second reversal.' })
    .expect(409);

  const report = await request(app).get('/api/v1/reports/general').set('Cookie', admin).expect(200);
  expect(report.body.data.totals.tuitionIncome).toBe(0);
});

test('posting a pending charge after a student transfer preserves its accounting branch', async () => {
  const app = createApp();
  const admin = await adminCookie(app);
  const period = new Date().toISOString().slice(0, 7);

  const historical = await request(app)
    .post('/api/v1/student-payments')
    .set('Cookie', admin)
    .send({ studentId:IDS.student, amount:65, concept:'Mensualidad historica', period, status:'pending' })
    .expect(201);
  const corrected = await request(app)
    .post('/api/v1/student-payments')
    .set('Cookie', admin)
    .send({ studentId:IDS.student, amount:25, concept:'Material historico', period, status:'pending' })
    .expect(201);

  app.locals.db.students.update(IDS.student, { branchId:IDS.otherBranch });

  await request(app)
    .patch(`/api/v1/student-payments/${corrected.body.data.id}`)
    .set('Cookie', admin)
    .send({ branchId:IDS.otherBranch })
    .expect(422);

  const posted = await request(app)
    .patch(`/api/v1/student-payments/${historical.body.data.id}`)
    .set('Cookie', admin)
    // Full-form clients may echo the recorded historical branch. Sending that
    // unchanged value is not a correction and must remain valid after transfer.
    .send({ status:'paid', branchId:IDS.branch })
    .expect(200);
  expect(posted.body.data).toMatchObject({ branchId:IDS.branch, status:'paid' });

  const explicitlyCorrected = await request(app)
    .patch(`/api/v1/student-payments/${corrected.body.data.id}`)
    .set('Cookie', admin)
    .send({ branchId:IDS.otherBranch, status:'paid', correctionReason:'La obligacion corresponde a la sede receptora.' })
    .expect(200);
  expect(explicitlyCorrected.body.data).toMatchObject({ branchId:IDS.otherBranch, status:'paid' });
});

test('reports keep historical branch attribution and use only finalized session attendance', async () => {
  const app = createApp();
  const admin = await adminCookie(app);
  const period = new Date().toISOString().slice(0, 7);

  await request(app)
    .post('/api/v1/student-payments')
    .set('Cookie', admin)
    .send({ studentId:IDS.student, amount:77, concept:'Mensualidad traslado', period, status:'paid' })
    .expect(201);
  app.locals.db.classSessions.update(IDS.session, {
    status:'completed',
    attendanceState:'draft',
    startsAt:new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    endsAt:new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  });
  app.locals.db.studentAttendance.create({
    studentId:IDS.student,
    classSessionId:IDS.session,
    status:'present',
  });
  app.locals.db.students.update(IDS.student, { branchId:IDS.otherBranch });

  const draftReport = await request(app)
    .get('/api/v1/reports/general')
    .set('Cookie', admin)
    .expect(200);
  expect(draftReport.body.data.totals.totalSessions).toBe(0);

  app.locals.db.classSessions.update(IDS.session, { attendanceState:'finalized' });
  app.locals.cache.invalidateTags(['attendance', 'class-sessions', 'reports']);
  const report = await request(app)
    .get('/api/v1/reports/general')
    .set('Cookie', admin)
    .expect(200);
  const origin = report.body.data.branches.find((branch) => branch.id === IDS.branch);
  const destination = report.body.data.branches.find((branch) => branch.id === IDS.otherBranch);

  expect(origin).toMatchObject({ tuitionIncome:77, totalSessions:1, activeStudents:0 });
  expect(destination).toMatchObject({ tuitionIncome:0, totalSessions:0, activeStudents:1 });
  expect(report.body.data.qualityAlerts.map((alert) => alert.code)).not.toContain('PAYMENT_BRANCH_INVALID');
});

test('report cutoff never advances into the future and reversals retain out-of-period context', async () => {
  const app = createApp();
  const admin = await adminCookie(app);
  const now = new Date();
  const originalPaidAt = new Date(now.getTime() - 60 * 86400000).toISOString();
  const originalPeriod = originalPaidAt.slice(0, 7);
  const original = await request(app)
    .post('/api/v1/student-payments')
    .set('Cookie', admin)
    .send({
      studentId:IDS.student,
      amount:33,
      concept:'Mensualidad reversada',
      period:originalPeriod,
      status:'paid',
      paidAt:originalPaidAt,
    })
    .expect(201);
  await request(app)
    .post(`/api/v1/student-payments/${original.body.data.id}/reversal`)
    .set('Cookie', admin)
    .send({ reason:'Reversion para validar el corte del reporte.' })
    .expect(201);

  const from = new Date(now.getTime() - 86400000).toISOString();
  const futureTo = new Date(now.getTime() + 30 * 86400000).toISOString();
  const report = await request(app)
    .get(`/api/v1/reports/general?from=${encodeURIComponent(from)}&to=${encodeURIComponent(futureTo)}`)
    .set('Cookie', admin)
    .expect(200);

  expect(report.body.data.asOf).toBe(report.body.data.generatedAt);
  expect(report.body.data.totals.reversalTransactions).toBe(1);
  expect(report.body.data.qualityAlerts.map((alert) => alert.code)).not.toContain('ORPHAN_FINANCIAL_REVERSAL');
});

test('session scheduling blocks teacher overlaps and cancellation records its lifecycle metadata', async () => {
  const app = createApp();
  const admin = await adminCookie(app);
  const secondGroup = app.locals.db.classGroups.create({
    branchId:IDS.branch,
    teacherId:IDS.teacher,
    styleId:null,
    name:'Second Teacher Group',
    level:'B1',
    capacity:20,
    active:true,
  });
  const startsAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);

  const scheduled = await request(app)
    .post('/api/v1/class-sessions')
    .set('Cookie', admin)
    .send({ classGroupId:IDS.group, name:'Conflict controlled', startsAt:startsAt.toISOString(), endsAt:endsAt.toISOString(), status:'scheduled' })
    .expect(201);

  await request(app)
    .post('/api/v1/class-sessions')
    .set('Cookie', admin)
    .send({ classGroupId:secondGroup.id, name:'Overlapping class', startsAt:new Date(startsAt.getTime() + 15 * 60000).toISOString(), endsAt:new Date(endsAt.getTime() + 15 * 60000).toISOString(), status:'scheduled' })
    .expect(409);

  await request(app)
    .patch(`/api/v1/class-sessions/${scheduled.body.data.id}`)
    .set('Cookie', admin)
    .send({ status:'cancelled' })
    .expect(422);

  const cancelled = await request(app)
    .patch(`/api/v1/class-sessions/${scheduled.body.data.id}`)
    .set('Cookie', admin)
    .send({ status:'cancelled', cancellationReason:'Teacher reported a medical emergency.' })
    .expect(200);
  expect(cancelled.body.data).toMatchObject({ status:'cancelled', cancelledBy:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' });
  expect(cancelled.body.data.cancelledAt).toBeTruthy();
});

test('lead pipeline enforces transitions, trial date and a real converted student', async () => {
  const app = createApp();
  const admin = await adminCookie(app);
  const email = 'pipeline.student@alc.test';
  const lead = await request(app)
    .post('/api/v1/enrollment-requests')
    .send({ fullName:'Pipeline Student', email, branchId:IDS.branch, styleInterest:'Salsa' })
    .expect(201);

  await request(app)
    .patch(`/api/v1/enrollment-requests/${lead.body.data.id}/status`)
    .set('Cookie', admin)
    .send({ status:'trial_scheduled' })
    .expect(422);

  await request(app)
    .patch(`/api/v1/enrollment-requests/${lead.body.data.id}/status`)
    .set('Cookie', admin)
    .send({ status:'contacted' })
    .expect(200);

  const trial = await request(app)
    .patch(`/api/v1/enrollment-requests/${lead.body.data.id}/status`)
    .set('Cookie', admin)
    .send({ status:'trial_scheduled', followUpAt:new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() })
    .expect(200);
  expect(trial.body.data.followUpAt).toBeTruthy();

  await request(app)
    .patch(`/api/v1/enrollment-requests/${lead.body.data.id}/status`)
    .set('Cookie', admin)
    .send({ status:'enrolled' })
    .expect(422);

  const account = await request(app)
    .post('/api/v1/users')
    .set('Cookie', admin)
    .send({ email, name:'Pipeline Student', role:'Student', studentProfile:{ branchId:IDS.branch, level:'B1' } })
    .expect(201);

  const enrolled = await request(app)
    .patch(`/api/v1/enrollment-requests/${lead.body.data.id}/status`)
    .set('Cookie', admin)
    .send({ status:'enrolled' })
    .expect(200);
  expect(enrolled.body.data.convertedStudentId).toBe(account.body.data.profile.id);
});

test('teacher payroll uses the check-in rate snapshot and respects the requested period', async () => {
  const app = createApp();
  const teacher = await teacherCookie(app);
  const admin = await adminCookie(app);
  app.locals.db.classSessions.update(IDS.session, {
    startsAt:new Date(Date.now() - 5 * 60000).toISOString(),
    endsAt:new Date(Date.now() + 55 * 60000).toISOString(),
    status:'scheduled',
  });

  const checkIn = await request(app)
    .post('/api/v1/teacher-attendance/check-in')
    .set('Cookie', teacher)
    .send({ teacherId:IDS.teacher, classSessionId:IDS.session })
    .expect(201);
  expect(checkIn.body.data.hourlyRateSnapshot).toBe(12.5);

  app.locals.db.teacherAttendance.update(checkIn.body.data.id, { checkInAt:new Date(Date.now() - 30 * 60000).toISOString() });
  app.locals.db.teachers.update(IDS.teacher, { hourlyRate:100 });
  await request(app)
    .patch(`/api/v1/teacher-attendance/${checkIn.body.data.id}/check-out`)
    .set('Cookie', teacher)
    .expect(200);

  const from = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const to = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const payroll = await request(app)
    .get(`/api/v1/reports/teachers/${IDS.teacher}/payment?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
    .set('Cookie', admin)
    .expect(200);
  expect(payroll.body.data).toMatchObject({ records:1, hourlyRate:100 });
  expect(payroll.body.data.breakdown[0]).toMatchObject({ hourlyRate:12.5, usesHistoricalRate:true });
  expect(payroll.body.data.amount).toBeCloseTo(6.25, 2);
});
