const request = require('supertest');
const jwt = require('jsonwebtoken');
const { createApp } = require('../../src/app');
const { Roles } = require('../../src/models/constants');
const { hashPassword } = require('../../src/utils/passwordHasher');

const ids = {
  northBranch:'11111111-1111-4111-8111-111111111111',
  centralBranch:'22222222-2222-4222-8222-222222222222',
  studentUser:'abababab-abab-4aba-8bab-abababababab',
  teacherUser:'acacacac-acac-4aca-8cac-acacacacacac',
  student:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  teacher:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  classGroup:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  classSession:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
};

function googleToken({ sub, email, name }) {
  return jwt.sign({ sub, email, name, aud:'test-google-client-id' }, 'actor-flow-secret');
}

async function loginWithGoogle(app, user) {
  const response = await request(app)
    .post('/api/v1/auth/google')
    .send({ idToken:googleToken(user) })
    .expect(200);
  return {
    cookie:response.headers['set-cookie'][0],
    token:response.body.data.sessionToken,
    user:response.body.data.user,
  };
}

async function loginWithPassword(app, email, password) {
  const response = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password })
    .expect(200);
  return {
    cookie:response.headers['set-cookie'][0],
    token:response.body.data.sessionToken,
    user:response.body.data.user,
  };
}

function createPasswordUser(app, data) {
  return app.locals.db.users.create({
    active:true,
    mustChangePassword:false,
    ...data,
    passwordHash:hashPassword(data.password || 'actorFlowALC2026*'),
  });
}

describe('actor flow verification', () => {
  test('Visitor flow: public academy access, enrollment request and protected-route rejection', async () => {
    const app = createApp();

    await request(app).get('/').expect(200);
    const config = await request(app).get('/api/v1/auth/config').expect(200);
    expect(config.headers['cache-control']).toContain('public');

    await request(app)
      .post('/api/v1/enrollment-requests')
      .send({ fullName:'Visitor Prospect', email:'visitor.prospect@alc.test', preferredBranch:'Norte', styleInterest:'Salsa' })
      .expect(201);

    await request(app)
      .post('/api/v1/enrollment-requests')
      .send({ fullName:'No', email:'invalid-email' })
      .expect(422);

    await request(app).get('/api/v1/enrollment-requests').expect(401);
    await request(app).get('/private/dashboard.html').expect('Location', '/login.html?session=expired').expect(302);
    await request(app)
      .post('/api/v1/auth/google')
      .send({ idToken:googleToken({ sub:'visitor-google', email:'visitor.google@alc.test', name:'Visitor Google' }) })
      .expect(401);
  });

  test('Student flow: first password change, own academic data and denied restricted actions', async () => {
    const app = createApp();
    app.locals.db.users.update(ids.studentUser, {
      passwordHash:hashPassword('studentTempALC2026*'),
      mustChangePassword:true,
    });

    const firstLogin = await loginWithPassword(app, 'student@alc.edu', 'studentTempALC2026*');
    expect(firstLogin.user.mustChangePassword).toBe(true);

    await request(app)
      .get('/api/v1/students')
      .set('Authorization', `Bearer ${firstLogin.token}`)
      .expect(403);

    await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${firstLogin.token}`)
      .send({ currentPassword:'studentTempALC2026*', newPassword:'studentPrivateALC2027*' })
      .expect(200);

    const ownStudents = await request(app)
      .get('/api/v1/students')
      .set('Authorization', `Bearer ${firstLogin.token}`)
      .expect(200);
    expect(ownStudents.body.data.map((student) => student.id)).toEqual([ids.student]);

    const ownBranches = await request(app)
      .get('/api/v1/branches')
      .set('Authorization', `Bearer ${firstLogin.token}`)
      .expect(200);
    expect(ownBranches.body.data.map((branch) => branch.id)).toEqual([ids.northBranch]);

    const ownAttendance = app.locals.db.studentAttendance.create({
      studentId:ids.student,
      classSessionId:ids.classSession,
      status:'absent',
    });
    const otherStudent = app.locals.db.students.create({
      branchId:ids.centralBranch,
      fullName:'Other Student',
      level:'B1',
      active:true,
    });
    const otherAttendance = app.locals.db.studentAttendance.create({
      studentId:otherStudent.id,
      classSessionId:ids.classSession,
      status:'absent',
    });

    await request(app)
      .post('/api/v1/absence-justifications')
      .set('Authorization', `Bearer ${firstLogin.token}`)
      .send({ attendanceRecordId:ownAttendance.id, reason:'Medical appointment for own absence.' })
      .expect(201);

    await request(app)
      .post('/api/v1/absence-justifications')
      .set('Authorization', `Bearer ${firstLogin.token}`)
      .send({ attendanceRecordId:otherAttendance.id, reason:'Trying to justify someone else.' })
      .expect(403);

    await request(app)
      .post('/api/v1/student-attendance')
      .set('Authorization', `Bearer ${firstLogin.token}`)
      .send({ studentId:ids.student, classSessionId:ids.classSession, status:'present' })
      .expect(403);
    await request(app).get('/api/v1/reports/branches/summary').set('Authorization', `Bearer ${firstLogin.token}`).expect(403);
    await request(app).get('/api/v1/users').set('Authorization', `Bearer ${firstLogin.token}`).expect(403);
  });

  test('Teacher flow: own classes, attendance work and restricted administration', async () => {
    const app = createApp();
    const teacher = await loginWithGoogle(app, {
      sub:'test-teacher',
      email:'teacher@alc.edu',
      name:'Demo Teacher User',
    });

    const ownTeachers = await request(app).get('/api/v1/teachers').set('Cookie', teacher.cookie).expect(200);
    expect(ownTeachers.body.data.map((row) => row.id)).toEqual([ids.teacher]);

    const ownGroups = await request(app).get('/api/v1/class-groups').set('Cookie', teacher.cookie).expect(200);
    expect(ownGroups.body.data.map((row) => row.id)).toEqual([ids.classGroup]);

    const checkIn = await request(app)
      .post('/api/v1/teacher-attendance/check-in')
      .set('Cookie', teacher.cookie)
      .send({ teacherId:ids.teacher, classSessionId:ids.classSession })
      .expect(201);

    await request(app)
      .post('/api/v1/teacher-attendance/check-in')
      .set('Cookie', teacher.cookie)
      .send({ teacherId:ids.teacher, classSessionId:ids.classSession })
      .expect(409);

    await request(app)
      .patch(`/api/v1/teacher-attendance/${checkIn.body.data.id}/check-out`)
      .set('Cookie', teacher.cookie)
      .expect(200);

    await request(app)
      .patch(`/api/v1/teacher-attendance/${checkIn.body.data.id}/check-out`)
      .set('Cookie', teacher.cookie)
      .expect(409);

    await request(app)
      .post('/api/v1/student-attendance')
      .set('Cookie', teacher.cookie)
      .send({ studentId:ids.student, classSessionId:ids.classSession, status:'present' })
      .expect(201);

    const otherTeacher = app.locals.db.teachers.create({
      branchId:ids.northBranch,
      fullName:'Other Teacher',
      active:true,
      hourlyRate:12.5,
    });
    await request(app)
      .post('/api/v1/teacher-attendance/check-in')
      .set('Cookie', teacher.cookie)
      .send({ teacherId:otherTeacher.id })
      .expect(403);

    await request(app).get('/api/v1/reports/branches/summary').set('Cookie', teacher.cookie).expect(403);
    await request(app).get('/api/v1/users').set('Cookie', teacher.cookie).expect(403);
    await request(app).get('/api/v1/audit-logs').set('Cookie', teacher.cookie).expect(403);
  });

  test('BranchDirector flow: assigned branch management and cross-branch denial', async () => {
    const app = createApp();
    const directorUser = app.locals.db.users.create({
      email:'branch.director.flow@alc.test',
      name:'Branch Director Flow',
      role:Roles.BRANCH_DIRECTOR,
      googleSub:'branch-director-flow',
      active:true,
      mustChangePassword:false,
    });
    app.locals.db.userBranchAccess.replaceForUser(directorUser.id, [ids.northBranch]);

    const director = await loginWithGoogle(app, {
      sub:'branch-director-flow',
      email:'branch.director.flow@alc.test',
      name:'Branch Director Flow',
    });

    const branches = await request(app).get('/api/v1/branches').set('Cookie', director.cookie).expect(200);
    expect(branches.body.data.map((branch) => branch.id)).toEqual([ids.northBranch]);

    await request(app)
      .post('/api/v1/students')
      .set('Cookie', director.cookie)
      .send({ branchId:ids.northBranch, fullName:'Branch Student', level:'B1', active:true })
      .expect(201);

    await request(app)
      .post('/api/v1/students')
      .set('Cookie', director.cookie)
      .send({ branchId:ids.centralBranch, fullName:'Wrong Branch Student', level:'B1', active:true })
      .expect(403);

    const summary = await request(app).get('/api/v1/reports/branches/summary').set('Cookie', director.cookie).expect(200);
    expect(summary.body.data.branches.map((branch) => branch.id)).toEqual([ids.northBranch]);

    const attendance = app.locals.db.studentAttendance.create({
      studentId:ids.student,
      classSessionId:ids.classSession,
      status:'absent',
    });
    const justification = await request(app)
      .post('/api/v1/absence-justifications')
      .set('Cookie', director.cookie)
      .send({ attendanceRecordId:attendance.id, reason:'Parent reported illness.' })
      .expect(201);

    await request(app)
      .patch(`/api/v1/absence-justifications/${justification.body.data.id}/review`)
      .set('Cookie', director.cookie)
      .send({ status:'approved', reviewNotes:'Accepted by branch.' })
      .expect(200);
    expect(app.locals.db.studentAttendance.findById(attendance.id).status).toBe('justified');

    await request(app).get('/api/v1/users').set('Cookie', director.cookie).expect(403);
    await request(app).get('/api/v1/audit-logs').set('Cookie', director.cookie).expect(403);
  });

  test('GeneralDirector flow: academy account creation, branch access and global reports', async () => {
    const app = createApp();
    createPasswordUser(app, {
      email:'general.director.flow@alc.test',
      name:'General Director Flow',
      role:Roles.GENERAL_DIRECTOR,
      password:'generalDirectorALC2026*',
    });
    const generalDirector = await loginWithPassword(app, 'general.director.flow@alc.test', 'generalDirectorALC2026*');

    await request(app).get('/api/v1/users').set('Cookie', generalDirector.cookie).expect(200);
    await request(app).get('/api/v1/permissions').set('Cookie', generalDirector.cookie).expect(200);
    const summary = await request(app).get('/api/v1/reports/branches/summary').set('Cookie', generalDirector.cookie).expect(200);
    expect(summary.body.data.branches.length).toBeGreaterThan(1);

    await request(app)
      .post('/api/v1/users')
      .set('Cookie', generalDirector.cookie)
      .send({ email:'admin.created.by.gd@alc.test', name:'Invalid Admin', role:Roles.ADMIN })
      .expect(403);

    const createdStudent = await request(app)
      .post('/api/v1/users')
      .set('Cookie', generalDirector.cookie)
      .send({
        email:'student.created.by.gd@alc.test',
        name:'Student Created By GD',
        role:Roles.STUDENT,
        studentProfile:{ branchId:ids.northBranch, level:'B1' },
      })
      .expect(201);
    expect(createdStudent.body.data.profile).toMatchObject({ userId:createdStudent.body.data.user.id, branchId:ids.northBranch });

    const studentLogin = await loginWithPassword(app, 'student.created.by.gd@alc.test', createdStudent.body.data.temporaryPassword);
    await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${studentLogin.token}`)
      .send({ currentPassword:createdStudent.body.data.temporaryPassword, newPassword:'studentCreatedALC2027*' })
      .expect(200);
    const ownProfile = await request(app)
      .get('/api/v1/students')
      .set('Authorization', `Bearer ${studentLogin.token}`)
      .expect(200);
    expect(ownProfile.body.data.map((student) => student.id)).toEqual([createdStudent.body.data.profile.id]);

    await request(app)
      .post('/api/v1/users')
      .set('Cookie', generalDirector.cookie)
      .send({ email:'branch.director.no.branch@alc.test', name:'No Branch Director', role:Roles.BRANCH_DIRECTOR })
      .expect(422);

    const created = await request(app)
      .post('/api/v1/users')
      .set('Cookie', generalDirector.cookie)
      .send({
        email:'branch.director.created@alc.test',
        name:'Created Branch Director',
        role:Roles.BRANCH_DIRECTOR,
        branchIds:[ids.northBranch],
      })
      .expect(201);
    expect(created.body.data.temporaryPassword).toMatch(/^ALC-/);

    const access = await request(app)
      .get(`/api/v1/users/${created.body.data.user.id}/branch-access`)
      .set('Cookie', generalDirector.cookie)
      .expect(200);
    expect(access.body.data.map((row) => row.branchId)).toEqual([ids.northBranch]);

    await request(app)
      .patch(`/api/v1/users/${created.body.data.user.id}/branch-access`)
      .set('Cookie', generalDirector.cookie)
      .send({ branchIds:[ids.northBranch, ids.centralBranch] })
      .expect(200);

    await request(app)
      .patch(`/api/v1/users/${created.body.data.user.id}/role`)
      .set('Cookie', generalDirector.cookie)
      .send({ role:Roles.TEACHER })
      .expect(403);
  });

  test('Admin flow: role governance, branch access governance and full audit visibility', async () => {
    const app = createApp();
    const admin = await loginWithPassword(app, 'admin@alc.edu', 'AmericanLatin2026!');
    const targetUser = app.locals.db.users.create({
      email:'admin.target@alc.test',
      name:'Admin Target',
      role:Roles.STUDENT,
      active:true,
      mustChangePassword:false,
    });

    await request(app)
      .patch(`/api/v1/users/${targetUser.id}/role`)
      .set('Cookie', admin.cookie)
      .send({ role:Roles.BRANCH_DIRECTOR })
      .expect(422);

    const teacherProfile = app.locals.db.teachers.create({
      userId:targetUser.id,
      branchId:ids.northBranch,
      fullName:'Admin Target Teacher',
      active:true,
      hourlyRate:12.5,
    });
    await request(app)
      .patch(`/api/v1/users/${targetUser.id}/role`)
      .set('Cookie', admin.cookie)
      .send({ role:Roles.TEACHER })
      .expect(200);

    await request(app)
      .patch(`/api/v1/users/${targetUser.id}/branch-access`)
      .set('Cookie', admin.cookie)
      .send({ branchIds:[ids.northBranch] })
      .expect(422);
    expect(teacherProfile.userId).toBe(targetUser.id);

    await request(app)
      .post('/api/v1/branches')
      .set('Cookie', admin.cookie)
      .send({ name:'Admin Flow Branch', city:'Quito', active:true })
      .expect(201);

    await request(app).get('/api/v1/audit-logs').set('Cookie', admin.cookie).expect(200);
    await request(app).get('/api/v1/users').set('Cookie', admin.cookie).expect(200);
  });
});
