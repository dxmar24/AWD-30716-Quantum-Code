const request = require('supertest');
const jwt = require('jsonwebtoken');
const { createApp } = require('../../src/app');

const IDS = Object.freeze({
  admin:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  student:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  teacher:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  group:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  session:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  branch:'11111111-1111-4111-8111-111111111111',
  enrollment:'f0f0f0f0-f0f0-40f0-80f0-f0f0f0f0f0f0',
});

async function googleLogin(app, { sub, email, name }) {
  const idToken = jwt.sign({ sub, email, name, aud:'test-google-client-id' }, 'x');
  const response = await request(app).post('/api/v1/auth/google').send({ idToken }).expect(200);
  return response.headers['set-cookie'][0];
}

async function adminCookie(app) {
  return googleLogin(app, { sub:'test-admin', email:'admin@alc.edu', name:'Admin User' });
}

async function teacherCookie(app) {
  return googleLogin(app, { sub:'test-teacher', email:'teacher@alc.edu', name:'Demo Teacher User' });
}

async function studentCookie(app) {
  return googleLogin(app, { sub:'test-student', email:'student@alc.edu', name:'Demo Student User' });
}

test('enrollment enforces branch, level and capacity and promotes the waitlist when a seat opens', async () => {
  const app = createApp();
  const cookie = await adminCookie(app);
  app.locals.db.classGroups.update(IDS.group, { capacity:1 });
  const secondStudent = app.locals.db.students.create({
    branchId:IDS.branch,
    fullName:'Second B1 Student',
    level:'B1',
    active:true,
  });
  const wrongLevel = app.locals.db.students.create({
    branchId:IDS.branch,
    fullName:'B2 Student',
    level:'B2',
    active:true,
  });

  const waitlisted = await request(app)
    .post('/api/v1/class-group-enrollments')
    .set('Cookie', cookie)
    .send({ studentId:secondStudent.id, classGroupId:IDS.group, status:'active' })
    .expect(201);
  expect(waitlisted.body.data.status).toBe('waitlisted');

  await request(app)
    .post('/api/v1/class-group-enrollments')
    .set('Cookie', cookie)
    .send({ studentId:wrongLevel.id, classGroupId:IDS.group, status:'active' })
    .expect(422);

  await request(app)
    .patch(`/api/v1/class-group-enrollments/${IDS.enrollment}`)
    .set('Cookie', cookie)
    .send({ status:'withdrawn', withdrawalReason:'Student transferred to another program.' })
    .expect(200);

  const activated = await request(app)
    .patch(`/api/v1/class-group-enrollments/${waitlisted.body.data.id}`)
    .set('Cookie', cookie)
    .send({ status:'active' })
    .expect(200);
  expect(activated.body.data.status).toBe('active');

  const auditActions = app.locals.db.auditLogs.all().map((row) => row.action);
  expect(auditActions).toEqual(expect.arrayContaining([
    'CLASS_GROUP_ENROLLMENT_CREATED',
    'CLASS_GROUP_ENROLLMENT_UPDATED',
  ]));
});

test.each(['active', 'trial', 'waitlisted', 'frozen'])(
  'a %s enrollment episode blocks a duplicate current enrollment',
  async (status) => {
    const app = createApp();
    const cookie = await adminCookie(app);
    app.locals.db.classGroupEnrollments.update(IDS.enrollment, {
      status,
      endsAt:status === 'frozen' ? new Date().toISOString() : null,
    });

    const duplicate = await request(app)
      .post('/api/v1/class-group-enrollments')
      .set('Cookie', cookie)
      .send({ studentId:IDS.student, classGroupId:IDS.group, status:'active' })
      .expect(409);
    expect(duplicate.body.details).toMatchObject({ code:'ENROLLMENT_EXISTS' });
    expect(app.locals.db.classGroupEnrollments.all().filter((row) => (
      row.studentId === IDS.student && row.classGroupId === IDS.group
    ))).toHaveLength(1);
  },
);

test.each(['withdrawn', 'completed'])(
  're-enrollment after a %s episode preserves both historical rosters without overlap',
  async (terminalStatus) => {
    const app = createApp();
    const cookie = await adminCookie(app);
    const terminalPayload = terminalStatus === 'withdrawn'
      ? { status:terminalStatus, withdrawalReason:'Student ended the first enrollment cycle.' }
      : { status:terminalStatus };
    const terminal = await request(app)
      .patch(`/api/v1/class-group-enrollments/${IDS.enrollment}`)
      .set('Cookie', cookie)
      .send(terminalPayload)
      .expect(200);
    const nextStartsAt = terminal.body.data.endsAt;

    const reenrollment = await request(app)
      .post('/api/v1/class-group-enrollments')
      .set('Cookie', cookie)
      .send({
        studentId:IDS.student,
        classGroupId:IDS.group,
        status:'active',
        startsAt:nextStartsAt,
      })
      .expect(201);
    expect(reenrollment.body.data.id).not.toBe(IDS.enrollment);

    const episodes = app.locals.db.classGroupEnrollments.all().filter((row) => (
      row.studentId === IDS.student && row.classGroupId === IDS.group
    ));
    expect(episodes).toHaveLength(2);
    expect(episodes.map((row) => row.status).sort()).toEqual(['active', terminalStatus].sort());

    const historicalRoster = await request(app)
      .get(`/api/v1/class-sessions/${IDS.session}/roster`)
      .set('Cookie', cookie)
      .expect(200);
    expect(historicalRoster.body.data.roster[0].enrollment.id).toBe(IDS.enrollment);

    const futureStart = new Date(new Date(nextStartsAt).getTime() + 60 * 60 * 1000);
    const nextSession = app.locals.db.classSessions.create({
      classGroupId:IDS.group,
      startsAt:futureStart.toISOString(),
      endsAt:new Date(futureStart.getTime() + 60 * 60 * 1000).toISOString(),
      status:'scheduled',
      attendanceState:'draft',
    });
    const currentRoster = await request(app)
      .get(`/api/v1/class-sessions/${nextSession.id}/roster`)
      .set('Cookie', cookie)
      .expect(200);
    expect(currentRoster.body.data.roster[0].enrollment.id).toBe(reenrollment.body.data.id);

    const overlap = await request(app)
      .patch(`/api/v1/class-group-enrollments/${IDS.enrollment}`)
      .set('Cookie', cookie)
      .send({ endsAt:new Date(futureStart.getTime() + 60 * 1000).toISOString() })
      .expect(409);
    expect(overlap.body.details.code).toBe('ENROLLMENT_EPISODE_OVERLAP');

    await request(app)
      .post('/api/v1/class-group-enrollments')
      .set('Cookie', cookie)
      .send({ studentId:IDS.student, classGroupId:IDS.group, status:'active' })
      .expect(409);

    const creationAudit = app.locals.db.auditLogs.all().find((row) => (
      row.action === 'CLASS_GROUP_ENROLLMENT_CREATED' && row.entityId === reenrollment.body.data.id
    ));
    expect(creationAudit.metadata).toMatchObject({
      episodeNumber:2,
      previousEnrollmentIds:[IDS.enrollment],
    });
  },
);

test('teacher and student visibility is derived from enrollments rather than branch membership', async () => {
  const app = createApp();
  const teacher = await teacherCookie(app);
  const student = await studentCookie(app);
  const unrelated = app.locals.db.students.create({
    branchId:IDS.branch,
    fullName:'Unrelated Branch Student',
    level:'B1',
    active:true,
  });

  const teacherStudents = await request(app).get('/api/v1/students').set('Cookie', teacher).expect(200);
  expect(teacherStudents.body.data.map((row) => row.id)).toEqual([IDS.student]);
  expect(teacherStudents.body.data.map((row) => row.id)).not.toContain(unrelated.id);

  const teacherGroups = await request(app).get('/api/v1/class-groups').set('Cookie', teacher).expect(200);
  expect(teacherGroups.body.data.map((row) => row.id)).toEqual([IDS.group]);

  const studentGroups = await request(app).get('/api/v1/class-groups').set('Cookie', student).expect(200);
  expect(studentGroups.body.data.map((row) => row.id)).toEqual([IDS.group]);
  const studentSessions = await request(app).get('/api/v1/class-sessions').set('Cookie', student).expect(200);
  expect(studentSessions.body.data.map((row) => row.id)).toEqual([IDS.session]);

  const teacherEnrollments = await request(app).get('/api/v1/class-group-enrollments').set('Cookie', teacher).expect(200);
  expect(teacherEnrollments.body.data.map((row) => row.id)).toEqual([IDS.enrollment]);
  const studentEnrollments = await request(app).get('/api/v1/class-group-enrollments').set('Cookie', student).expect(200);
  expect(studentEnrollments.body.data.map((row) => row.id)).toEqual([IDS.enrollment]);
});

test('session roster and batch attendance are atomic, idempotent and require an exact roster to finalize', async () => {
  const app = createApp();
  const admin = await adminCookie(app);
  const teacher = await teacherCookie(app);
  const unrelated = app.locals.db.students.create({
    branchId:IDS.branch,
    fullName:'Not Enrolled',
    level:'B1',
    active:true,
  });

  const roster = await request(app)
    .get(`/api/v1/class-sessions/${IDS.session}/roster`)
    .set('Cookie', teacher)
    .expect(200);
  expect(roster.body.data).toMatchObject({
    attendanceState:'draft',
    session:{ id:IDS.session },
    classGroup:{ id:IDS.group },
  });
  expect(roster.body.data.roster.map((row) => row.student.id)).toEqual([IDS.student]);

  await request(app)
    .put(`/api/v1/class-sessions/${IDS.session}/attendance`)
    .set('Cookie', teacher)
    .send({
      state:'draft',
      records:[
        { studentId:IDS.student, status:'present' },
        { studentId:unrelated.id, status:'present' },
      ],
    })
    .expect(422);
  expect(app.locals.db.studentAttendance.all()).toHaveLength(0);

  await request(app)
    .put(`/api/v1/class-sessions/${IDS.session}/attendance`)
    .set('Cookie', teacher)
    .send({ state:'draft', records:[{ studentId:IDS.student, status:'present' }] })
    .expect(200);
  const firstRecord = app.locals.db.studentAttendance.all()[0];
  expect(firstRecord.version).toBe(1);

  await request(app)
    .put(`/api/v1/class-sessions/${IDS.session}/attendance`)
    .set('Cookie', teacher)
    .send({ state:'draft', records:[{ studentId:IDS.student, status:'present' }] })
    .expect(200);
  expect(app.locals.db.studentAttendance.findById(firstRecord.id).version).toBe(1);

  const finalized = await request(app)
    .put(`/api/v1/class-sessions/${IDS.session}/attendance`)
    .set('Cookie', teacher)
    .send({ state:'finalized', records:[{ studentId:IDS.student, status:'present' }] })
    .expect(200);
  expect(finalized.body.data).toMatchObject({ attendanceState:'finalized', session:{ status:'completed' } });

  await request(app)
    .put(`/api/v1/class-sessions/${IDS.session}/attendance`)
    .set('Cookie', teacher)
    .send({ state:'finalized', records:[{ studentId:IDS.student, status:'late' }], correctionReason:'Teacher correction attempt.' })
    .expect(403);

  await request(app)
    .put(`/api/v1/class-sessions/${IDS.session}/attendance`)
    .set('Cookie', admin)
    .send({ state:'finalized', records:[{ studentId:IDS.student, status:'late' }] })
    .expect(422);

  const corrected = await request(app)
    .put(`/api/v1/class-sessions/${IDS.session}/attendance`)
    .set('Cookie', admin)
    .send({
      state:'finalized',
      records:[{ studentId:IDS.student, status:'late' }],
      correctionReason:'Director verified the signed paper roster.',
    })
    .expect(200);
  expect(corrected.body.data.records[0]).toMatchObject({ status:'late', version:2 });
});

test('a class session can only be completed with finalized attendance and coherent finalization metadata', async () => {
  const app = createApp();
  const admin = await adminCookie(app);

  const notFinalized = await request(app)
    .patch(`/api/v1/class-sessions/${IDS.session}`)
    .set('Cookie', admin)
    .send({ status:'completed' })
    .expect(422);
  expect(notFinalized.body.details.code).toBe('ATTENDANCE_NOT_FINALIZED');
  expect(app.locals.db.classSessions.findById(IDS.session).status).toBe('scheduled');

  app.locals.db.classSessions.update(IDS.session, { attendanceState:'finalized' });
  const missingMetadata = await request(app)
    .patch(`/api/v1/class-sessions/${IDS.session}`)
    .set('Cookie', admin)
    .send({ status:'completed' })
    .expect(422);
  expect(missingMetadata.body.details.code).toBe('ATTENDANCE_FINALIZATION_METADATA_REQUIRED');

  app.locals.db.classSessions.update(IDS.session, {
    attendanceState:'finalized',
    attendanceFinalizedAt:'2026-06-01T20:01:00.000Z',
    attendanceFinalizedBy:IDS.admin,
  });
  const completed = await request(app)
    .patch(`/api/v1/class-sessions/${IDS.session}`)
    .set('Cookie', admin)
    .send({ status:'completed' })
    .expect(200);
  expect(completed.body.data).toMatchObject({
    status:'completed',
    attendanceState:'finalized',
    attendanceFinalizedBy:IDS.admin,
    completedBy:IDS.admin,
  });
  expect(completed.body.data.completedAt).toBeTruthy();
});

test('attendance drafts may be saved after class starts but finalization and correction wait until it ends', async () => {
  const app = createApp();
  const admin = await adminCookie(app);
  const now = Date.now();
  const activeSession = app.locals.db.classSessions.create({
    classGroupId:IDS.group,
    startsAt:new Date(now - 30 * 60 * 1000).toISOString(),
    endsAt:new Date(now + 30 * 60 * 1000).toISOString(),
    status:'scheduled',
    attendanceState:'draft',
  });

  await request(app)
    .put(`/api/v1/class-sessions/${activeSession.id}/attendance`)
    .set('Cookie', admin)
    .send({ state:'draft', records:[{ studentId:IDS.student, status:'present' }] })
    .expect(200);

  const earlyFinalization = await request(app)
    .put(`/api/v1/class-sessions/${activeSession.id}/attendance`)
    .set('Cookie', admin)
    .send({ state:'finalized', records:[{ studentId:IDS.student, status:'present' }] })
    .expect(422);
  expect(earlyFinalization.body.details.code).toBe('SESSION_NOT_ENDED');
  expect(app.locals.db.classSessions.findById(activeSession.id)).toMatchObject({
    status:'scheduled',
    attendanceState:'draft',
  });

  app.locals.db.classSessions.update(activeSession.id, {
    status:'completed',
    attendanceState:'finalized',
    attendanceFinalizedAt:new Date().toISOString(),
    attendanceFinalizedBy:IDS.admin,
  });
  const earlyCorrection = await request(app)
    .post('/api/v1/student-attendance')
    .set('Cookie', admin)
    .send({
      studentId:IDS.student,
      classSessionId:activeSession.id,
      status:'late',
      correctionReason:'Attempted correction before scheduled class end.',
    })
    .expect(422);
  expect(earlyCorrection.body.details.code).toBe('SESSION_NOT_ENDED');
  expect(app.locals.db.studentAttendance.findByFields({
    studentId:IDS.student,
    classSessionId:activeSession.id,
  }).status).toBe('present');
});

test('attendance rejects future, cancelled, inactive and directly justified records', async () => {
  const app = createApp();
  const admin = await adminCookie(app);
  const futureStart = new Date(Date.now() + 86400000);
  const futureSession = app.locals.db.classSessions.create({
    classGroupId:IDS.group,
    startsAt:futureStart.toISOString(),
    endsAt:new Date(futureStart.getTime() + 3600000).toISOString(),
    status:'scheduled',
    attendanceState:'draft',
  });
  const cancelledSession = app.locals.db.classSessions.create({
    classGroupId:IDS.group,
    startsAt:'2026-06-10T18:00:00.000Z',
    endsAt:'2026-06-10T19:00:00.000Z',
    status:'cancelled',
    attendanceState:'draft',
  });

  await request(app)
    .put(`/api/v1/class-sessions/${futureSession.id}/attendance`)
    .set('Cookie', admin)
    .send({ state:'finalized', records:[{ studentId:IDS.student, status:'present' }] })
    .expect(422);
  await request(app)
    .put(`/api/v1/class-sessions/${cancelledSession.id}/attendance`)
    .set('Cookie', admin)
    .send({ state:'finalized', records:[{ studentId:IDS.student, status:'present' }] })
    .expect(409);
  await request(app)
    .post('/api/v1/student-attendance')
    .set('Cookie', admin)
    .send({ studentId:IDS.student, classSessionId:IDS.session, status:'justified' })
    .expect(422);

  app.locals.db.students.update(IDS.student, { active:false });
  await request(app)
    .post('/api/v1/student-attendance')
    .set('Cookie', admin)
    .send({ studentId:IDS.student, classSessionId:IDS.session, status:'present' })
    .expect(422);
});

test('approved justification remains separate from absence and duplicate active requests are rejected', async () => {
  const app = createApp();
  const admin = await adminCookie(app);
  const attendance = await request(app)
    .post('/api/v1/student-attendance')
    .set('Cookie', admin)
    .send({ studentId:IDS.student, classSessionId:IDS.session, status:'absent' })
    .expect(201);
  const justification = await request(app)
    .post('/api/v1/absence-justifications')
    .set('Cookie', admin)
    .send({ attendanceRecordId:attendance.body.data.id, reason:'Documented medical appointment.' })
    .expect(201);

  await request(app)
    .post('/api/v1/absence-justifications')
    .set('Cookie', admin)
    .send({ attendanceRecordId:attendance.body.data.id, reason:'Duplicate medical appointment.' })
    .expect(409);
  await request(app)
    .patch(`/api/v1/absence-justifications/${justification.body.data.id}/review`)
    .set('Cookie', admin)
    .send({ status:'approved', reviewNotes:'Evidence accepted.' })
    .expect(200);

  expect(app.locals.db.studentAttendance.findById(attendance.body.data.id).status).toBe('absent');
  await request(app)
    .post('/api/v1/absence-justifications')
    .set('Cookie', admin)
    .send({ attendanceRecordId:attendance.body.data.id, reason:'Another duplicate after approval.' })
    .expect(409);
});

test('teacher attendance list is scoped and exposes the open record needed for checkout', async () => {
  const app = createApp();
  app.locals.db.classSessions.update(IDS.session, {
    startsAt:new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    endsAt:new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    status:'scheduled',
  });
  const teacher = await teacherCookie(app);
  const otherTeacher = app.locals.db.teachers.create({
    branchId:IDS.branch,
    fullName:'Other Teacher',
    active:true,
    hourlyRate:15,
  });
  app.locals.db.teacherAttendance.create({
    teacherId:otherTeacher.id,
    checkInAt:'2026-06-01T10:00:00.000Z',
    checkOutAt:null,
  });

  const checkIn = await request(app)
    .post('/api/v1/teacher-attendance/check-in')
    .set('Cookie', teacher)
    .send({ teacherId:IDS.teacher, classSessionId:IDS.session })
    .expect(201);
  const list = await request(app).get('/api/v1/teacher-attendance').set('Cookie', teacher).expect(200);
  expect(list.body.data).toHaveLength(1);
  expect(list.body.data[0]).toMatchObject({ id:checkIn.body.data.id, teacherId:IDS.teacher, checkOutAt:null });
});
