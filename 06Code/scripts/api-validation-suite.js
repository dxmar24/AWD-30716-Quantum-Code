process.env.NODE_ENV = 'test';
process.env.DB_DRIVER = 'memory';
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
process.env.ALLOW_MOCK_GOOGLE_TOKENS = 'true';
process.env.CORS_ORIGINS = 'http://localhost:8080';
process.env.POSTMAN_LOGIN_ENABLED = 'true';
process.env.POSTMAN_LOGIN_EMAIL = 'admin@alc.edu';
process.env.POSTMAN_LOGIN_PASSWORD = 'AmericanLatin2026!';

const fs = require('fs');
const path = require('path');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { createApp } = require('../src/app');
const { Roles } = require('../src/models/constants');

const apiPrefix = '/api/v1';
const rootDir = path.join(__dirname, '..', '..');
const reportPath = path.join(rootDir, '03Documentation', 'api-validation-report.md');
const jsonPath = path.join(rootDir, '07Other', 'api-validation-results.json');

const seed = {
  adminUserId: 'd8c025f6-bcd0-4f25-a6b1-1486338678e7',
  branchId: '0c8675f1-9c30-430a-8b2c-c4dd1ec88b09',
  studentId: '85f4bbe9-5d5f-4126-89b6-ddd9de432885',
  teacherId: '01c99342-ad47-4c4e-a094-6cab138d98e5',
  classSessionId: '76f37581-dbbc-4201-bb13-67fbc86f6d60',
};

function nowToken() {
  return String(Date.now());
}

function googleToken(sub, email, name) {
  return jwt.sign({ sub, email, name, aud: process.env.GOOGLE_CLIENT_ID }, 'validation-secret');
}

function titleCaseMethod(method) {
  return method.toUpperCase();
}

function escapeMarkdown(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function addHours(date, hours) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000).toISOString();
}

async function main() {
  const app = createApp();
  const results = [];

  async function runCase({ name, method, route, client = request(app), headers = {}, body, expectedStatus, assert }) {
    const startedAt = Date.now();
    let response;

    try {
      const call = client[method.toLowerCase()](route);
      Object.entries(headers).forEach(([key, value]) => call.set(key, value));
      response = body === undefined ? await call : await call.send(body);
      const expected = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];
      if (!expected.includes(response.status)) {
        throw new Error(`Expected HTTP ${expected.join(' or ')}, received ${response.status}`);
      }
      if (assert) await assert(response);
      results.push({
        name,
        method: titleCaseMethod(method),
        route,
        expectedStatus: expected.join(', '),
        actualStatus: response.status,
        passed: true,
        message: response.body?.message || response.headers.location || 'OK',
        durationMs: Date.now() - startedAt,
      });
      return response;
    } catch (error) {
      results.push({
        name,
        method: titleCaseMethod(method),
        route,
        expectedStatus: Array.isArray(expectedStatus) ? expectedStatus.join(', ') : expectedStatus,
        actualStatus: response?.status || 'n/a',
        passed: false,
        message: error.message,
        durationMs: Date.now() - startedAt,
      });
      return response;
    }
  }

  function requireSuccess(response, label) {
    if (!response || response.status >= 400) {
      throw new Error(`${label} failed; cannot continue dependent API validation.`);
    }
    return response.body.data;
  }

  async function loginAs(role, email, sub, name) {
    const agent = request.agent(app);
    const response = await runCase({
      name: `Google login creates session for ${role}`,
      method: 'post',
      route: `${apiPrefix}/auth/google`,
      client: agent,
      body: { idToken: googleToken(sub, email, name) },
      expectedStatus: 200,
      assert: (res) => {
        if (!res.headers['set-cookie']?.some((cookie) => cookie.startsWith('alc_session='))) {
          throw new Error('Session cookie was not issued.');
        }
        if (!res.body.data.sessionToken || res.body.data.sessionToken.split('.').length !== 3) {
          throw new Error('JWT session token was not returned.');
        }
        if (res.body.data.tokenType !== 'Bearer') throw new Error('Unexpected token type.');
      },
    });
    const data = requireSuccess(response, `Login as ${role}`);
    await app.locals.db.users.update(data.user.id, { role });
    return { agent, sessionToken: data.sessionToken, user: { ...data.user, role } };
  }

  await runCase({
    name: 'Auth config exposes Google client id',
    method: 'get',
    route: `${apiPrefix}/auth/config`,
    expectedStatus: 200,
    assert: (res) => {
      if (res.body.data.googleClientId !== process.env.GOOGLE_CLIENT_ID) throw new Error('Unexpected Google client id.');
    },
  });

  await runCase({
    name: 'Malformed Google token is rejected',
    method: 'post',
    route: `${apiPrefix}/auth/google`,
    body: { idToken: 'not-a-valid-google-token' },
    expectedStatus: 401,
  });

  await runCase({
    name: 'Postman password login rejects invalid credentials',
    method: 'post',
    route: `${apiPrefix}/auth/login`,
    body: { email: 'admin@alc.edu', password: 'wrong-password' },
    expectedStatus: 401,
  });

  await runCase({
    name: 'Logout without an active session is harmless',
    method: 'post',
    route: `${apiPrefix}/auth/logout`,
    expectedStatus: 200,
  });

  await runCase({
    name: 'Private dashboard redirects anonymous users to login',
    method: 'get',
    route: '/private/dashboard.html',
    expectedStatus: 302,
    assert: (res) => {
      if (res.headers.location !== '/login.html?session=expired') throw new Error(`Unexpected redirect: ${res.headers.location}`);
    },
  });

  await runCase({
    name: 'Login page is served publicly',
    method: 'get',
    route: '/login.html',
    expectedStatus: 200,
    assert: (res) => {
      if (!res.text.includes('id="root"')) throw new Error('React root was not present.');
    },
  });

  const protectedSamples = [
    ['get', `${apiPrefix}/auth/me`],
    ['get', `${apiPrefix}/enrollment-requests`],
    ['get', `${apiPrefix}/users`],
    ['patch', `${apiPrefix}/users/${seed.adminUserId}/role`, { role: Roles.TEACHER }],
    ['get', `${apiPrefix}/roles`],
    ['get', `${apiPrefix}/permissions`],
    ['get', `${apiPrefix}/branches`],
    ['get', `${apiPrefix}/branches/${seed.branchId}`],
    ['post', `${apiPrefix}/branches`, { name: 'No Auth Branch' }],
    ['get', `${apiPrefix}/students`],
    ['post', `${apiPrefix}/students`, { branchId: seed.branchId, fullName: 'No Auth Student', level: 'B1' }],
    ['get', `${apiPrefix}/teachers`],
    ['post', `${apiPrefix}/teachers`, { fullName: 'No Auth Teacher' }],
    ['get', `${apiPrefix}/dance-categories`],
    ['post', `${apiPrefix}/dance-categories`, { name: 'No Auth Category' }],
    ['get', `${apiPrefix}/dance-styles`],
    ['get', `${apiPrefix}/class-groups`],
    ['get', `${apiPrefix}/class-sessions`],
    ['post', `${apiPrefix}/student-attendance`, { studentId: seed.studentId, classSessionId: seed.classSessionId, status: 'present' }],
    ['post', `${apiPrefix}/teacher-attendance/check-in`, { teacherId: seed.teacherId }],
    ['patch', `${apiPrefix}/teacher-attendance/${seed.teacherId}/check-out`],
    ['get', `${apiPrefix}/absence-justifications`],
    ['get', `${apiPrefix}/reports/branches/summary`],
    ['get', `${apiPrefix}/reports/scholarships/${seed.studentId}/candidate`],
    ['get', `${apiPrefix}/reports/level-promotions/${seed.studentId}/candidate`],
    ['get', `${apiPrefix}/reports/teachers/${seed.teacherId}/payment`],
    ['get', `${apiPrefix}/scholarship-evaluations`],
    ['get', `${apiPrefix}/level-promotion-evaluations`],
    ['get', `${apiPrefix}/audit-logs`],
  ];

  for (const [method, route, body] of protectedSamples) {
    await runCase({
      name: `Anonymous request blocked: ${titleCaseMethod(method)} ${route}`,
      method,
      route,
      body,
      expectedStatus: 401,
    });
  }

  await runCase({
    name: 'Enrollment validation rejects invalid email',
    method: 'post',
    route: `${apiPrefix}/enrollment-requests`,
    body: { fullName: 'A', email: 'invalid' },
    expectedStatus: 422,
  });

  const validEnrollment = requireSuccess(await runCase({
    name: 'Public enrollment request is accepted',
    method: 'post',
    route: `${apiPrefix}/enrollment-requests`,
    body: {
      fullName: 'Validation Student Prospect',
      email: `prospect-${nowToken()}@example.com`,
      preferredBranch: 'Norte',
      styleInterest: 'Salsa',
      message: 'API validation enrollment request.',
    },
    expectedStatus: 201,
  }), 'Public enrollment');

  const postmanLogin = requireSuccess(await runCase({
    name: 'Postman password login returns JWT session token',
    method: 'post',
    route: `${apiPrefix}/auth/login`,
    body: { email: 'admin@alc.edu', password: 'AmericanLatin2026!' },
    expectedStatus: 200,
    assert: (res) => {
      if (!res.body.data.sessionToken || res.body.data.sessionToken.split('.').length !== 3) {
        throw new Error('JWT session token was not returned.');
      }
      if (res.body.data.tokenType !== 'Bearer') throw new Error('Unexpected token type.');
    },
  }), 'Postman password login');

  await runCase({
    name: 'Postman bearer token can read current session',
    method: 'get',
    route: `${apiPrefix}/auth/me`,
    headers: { Authorization: `Bearer ${postmanLogin.sessionToken}` },
    expectedStatus: 200,
    assert: (res) => {
      if (res.body.data.user.email !== 'admin@alc.edu') throw new Error('Unexpected Postman login user.');
    },
  });

  await runCase({
    name: 'Postman logout revokes bearer token',
    method: 'post',
    route: `${apiPrefix}/auth/logout`,
    headers: { Authorization: `Bearer ${postmanLogin.sessionToken}` },
    expectedStatus: 200,
  });

  await runCase({
    name: 'Postman revoked bearer token is rejected',
    method: 'get',
    route: `${apiPrefix}/auth/me`,
    headers: { Authorization: `Bearer ${postmanLogin.sessionToken}` },
    expectedStatus: 401,
  });

  const limited = await loginAs(Roles.STUDENT, `student-${nowToken()}@alc.test`, `student-${nowToken()}`, 'Validation Student User');

  await runCase({
    name: 'Student role cannot access consolidated branch report',
    method: 'get',
    route: `${apiPrefix}/reports/branches/summary`,
    client: limited.agent,
    expectedStatus: 403,
  });

  await runCase({
    name: 'Authenticated user can read current session',
    method: 'get',
    route: `${apiPrefix}/auth/me`,
    client: limited.agent,
    expectedStatus: 200,
    assert: (res) => {
      if (res.body.data.user.email !== limited.user.email) throw new Error('Unexpected session user.');
    },
  });

  await runCase({
    name: 'Bearer session token can read current session',
    method: 'get',
    route: `${apiPrefix}/auth/me`,
    headers: { Authorization: `Bearer ${limited.sessionToken}` },
    expectedStatus: 200,
    assert: (res) => {
      if (res.body.data.user.email !== limited.user.email) throw new Error('Unexpected bearer session user.');
    },
  });

  await runCase({
    name: 'Logout revokes student session',
    method: 'post',
    route: `${apiPrefix}/auth/logout`,
    client: limited.agent,
    expectedStatus: 200,
  });

  await runCase({
    name: 'Revoked session cannot access /auth/me',
    method: 'get',
    route: `${apiPrefix}/auth/me`,
    client: limited.agent,
    expectedStatus: 401,
  });

  await runCase({
    name: 'Revoked bearer token cannot access /auth/me',
    method: 'get',
    route: `${apiPrefix}/auth/me`,
    headers: { Authorization: `Bearer ${limited.sessionToken}` },
    expectedStatus: 401,
  });

  const admin = await loginAs(Roles.ADMIN, `admin-${nowToken()}@alc.test`, `admin-${nowToken()}`, 'Validation Admin');
  const timestamp = nowToken();

  await runCase({ name: 'Admin lists enrollment requests', method: 'get', route: `${apiPrefix}/enrollment-requests`, client: admin.agent, expectedStatus: 200 });
  await runCase({ name: 'Admin lists users', method: 'get', route: `${apiPrefix}/users`, client: admin.agent, expectedStatus: 200 });
  await runCase({ name: 'Admin lists roles', method: 'get', route: `${apiPrefix}/roles`, client: admin.agent, expectedStatus: 200 });
  await runCase({ name: 'Admin lists permissions', method: 'get', route: `${apiPrefix}/permissions`, client: admin.agent, expectedStatus: 200 });

  await runCase({
    name: 'Admin updates a user role',
    method: 'patch',
    route: `${apiPrefix}/users/${admin.user.id}/role`,
    client: admin.agent,
    body: { role: Roles.ADMIN },
    expectedStatus: 200,
  });

  const branch = requireSuccess(await runCase({
    name: 'Admin creates branch',
    method: 'post',
    route: `${apiPrefix}/branches`,
    client: admin.agent,
    body: { name: `Validation Branch ${timestamp}`, city: 'Quito', active: true },
    expectedStatus: 201,
  }), 'Branch create');

  await runCase({ name: 'Admin lists branches', method: 'get', route: `${apiPrefix}/branches`, client: admin.agent, expectedStatus: 200 });
  await runCase({ name: 'Admin reads branch by id', method: 'get', route: `${apiPrefix}/branches/${branch.id}`, client: admin.agent, expectedStatus: 200 });
  await runCase({
    name: 'Admin updates branch',
    method: 'patch',
    route: `${apiPrefix}/branches/${branch.id}`,
    client: admin.agent,
    body: { city: 'Quito Norte' },
    expectedStatus: 200,
  });

  const student = requireSuccess(await runCase({
    name: 'Admin creates student',
    method: 'post',
    route: `${apiPrefix}/students`,
    client: admin.agent,
    body: { branchId: branch.id, fullName: `Validation Student ${timestamp}`, level: 'B1', active: true },
    expectedStatus: 201,
  }), 'Student create');

  await runCase({ name: 'Admin lists students', method: 'get', route: `${apiPrefix}/students`, client: admin.agent, expectedStatus: 200 });
  await runCase({ name: 'Admin reads student by id', method: 'get', route: `${apiPrefix}/students/${student.id}`, client: admin.agent, expectedStatus: 200 });
  await runCase({
    name: 'Admin updates student',
    method: 'patch',
    route: `${apiPrefix}/students/${student.id}`,
    client: admin.agent,
    body: { fullName: `${student.fullName} Updated` },
    expectedStatus: 200,
  });

  const teacher = requireSuccess(await runCase({
    name: 'Admin creates teacher',
    method: 'post',
    route: `${apiPrefix}/teachers`,
    client: admin.agent,
    body: { branchId: branch.id, fullName: `Validation Teacher ${timestamp}`, hourlyRate: 15, active: true },
    expectedStatus: 201,
  }), 'Teacher create');

  await runCase({ name: 'Admin lists teachers', method: 'get', route: `${apiPrefix}/teachers`, client: admin.agent, expectedStatus: 200 });
  await runCase({ name: 'Admin reads teacher by id', method: 'get', route: `${apiPrefix}/teachers/${teacher.id}`, client: admin.agent, expectedStatus: 200 });
  await runCase({
    name: 'Admin updates teacher',
    method: 'patch',
    route: `${apiPrefix}/teachers/${teacher.id}`,
    client: admin.agent,
    body: { hourlyRate: 16 },
    expectedStatus: 200,
  });

  const category = requireSuccess(await runCase({
    name: 'Admin creates dance category',
    method: 'post',
    route: `${apiPrefix}/dance-categories`,
    client: admin.agent,
    body: { name: `Validation Category ${timestamp}` },
    expectedStatus: 201,
  }), 'Dance category create');

  await runCase({ name: 'Admin lists dance categories', method: 'get', route: `${apiPrefix}/dance-categories`, client: admin.agent, expectedStatus: 200 });
  await runCase({ name: 'Admin reads dance category by id', method: 'get', route: `${apiPrefix}/dance-categories/${category.id}`, client: admin.agent, expectedStatus: 200 });
  await runCase({
    name: 'Admin updates dance category',
    method: 'patch',
    route: `${apiPrefix}/dance-categories/${category.id}`,
    client: admin.agent,
    body: { name: `${category.name} Updated` },
    expectedStatus: 200,
  });

  const style = requireSuccess(await runCase({
    name: 'Admin creates dance style',
    method: 'post',
    route: `${apiPrefix}/dance-styles`,
    client: admin.agent,
    body: { categoryId: category.id, name: `Validation Style ${timestamp}` },
    expectedStatus: 201,
  }), 'Dance style create');

  await runCase({ name: 'Admin lists dance styles', method: 'get', route: `${apiPrefix}/dance-styles`, client: admin.agent, expectedStatus: 200 });
  await runCase({ name: 'Admin reads dance style by id', method: 'get', route: `${apiPrefix}/dance-styles/${style.id}`, client: admin.agent, expectedStatus: 200 });
  await runCase({
    name: 'Admin updates dance style',
    method: 'patch',
    route: `${apiPrefix}/dance-styles/${style.id}`,
    client: admin.agent,
    body: { name: `${style.name} Updated` },
    expectedStatus: 200,
  });

  const classGroup = requireSuccess(await runCase({
    name: 'Admin creates class group',
    method: 'post',
    route: `${apiPrefix}/class-groups`,
    client: admin.agent,
    body: { branchId: branch.id, styleId: style.id, teacherId: teacher.id, name: `Validation Group ${timestamp}`, level: 'B1', active: true },
    expectedStatus: 201,
  }), 'Class group create');

  await runCase({ name: 'Admin lists class groups', method: 'get', route: `${apiPrefix}/class-groups`, client: admin.agent, expectedStatus: 200 });
  await runCase({ name: 'Admin reads class group by id', method: 'get', route: `${apiPrefix}/class-groups/${classGroup.id}`, client: admin.agent, expectedStatus: 200 });
  await runCase({
    name: 'Admin updates class group',
    method: 'patch',
    route: `${apiPrefix}/class-groups/${classGroup.id}`,
    client: admin.agent,
    body: { name: `${classGroup.name} Updated` },
    expectedStatus: 200,
  });

  const sessionStart = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const classSession = requireSuccess(await runCase({
    name: 'Admin creates class session',
    method: 'post',
    route: `${apiPrefix}/class-sessions`,
    client: admin.agent,
    body: { classGroupId: classGroup.id, startsAt: sessionStart.toISOString(), endsAt: addHours(sessionStart, 2), status: 'scheduled' },
    expectedStatus: 201,
  }), 'Class session create');

  const absenceSession = requireSuccess(await runCase({
    name: 'Admin creates absence validation class session',
    method: 'post',
    route: `${apiPrefix}/class-sessions`,
    client: admin.agent,
    body: { classGroupId: classGroup.id, startsAt: addHours(sessionStart, 3), endsAt: addHours(sessionStart, 5), status: 'scheduled' },
    expectedStatus: 201,
  }), 'Absence class session create');

  await runCase({ name: 'Admin lists class sessions', method: 'get', route: `${apiPrefix}/class-sessions`, client: admin.agent, expectedStatus: 200 });
  await runCase({ name: 'Admin reads class session by id', method: 'get', route: `${apiPrefix}/class-sessions/${classSession.id}`, client: admin.agent, expectedStatus: 200 });
  await runCase({
    name: 'Admin updates class session',
    method: 'patch',
    route: `${apiPrefix}/class-sessions/${classSession.id}`,
    client: admin.agent,
    body: { status: 'completed' },
    expectedStatus: 200,
  });

  const attendance = requireSuccess(await runCase({
    name: 'Admin records student attendance',
    method: 'post',
    route: `${apiPrefix}/student-attendance`,
    client: admin.agent,
    body: { studentId: student.id, classSessionId: classSession.id, status: 'present', notes: 'Validation attendance.' },
    expectedStatus: 201,
  }), 'Student attendance');

  await runCase({
    name: 'Duplicate student attendance is rejected',
    method: 'post',
    route: `${apiPrefix}/student-attendance`,
    client: admin.agent,
    body: { studentId: student.id, classSessionId: classSession.id, status: 'present' },
    expectedStatus: 409,
  });

  const absentAttendance = requireSuccess(await runCase({
    name: 'Admin records absent student attendance',
    method: 'post',
    route: `${apiPrefix}/student-attendance`,
    client: admin.agent,
    body: { studentId: student.id, classSessionId: absenceSession.id, status: 'absent', notes: 'Validation absence.' },
    expectedStatus: 201,
  }), 'Absent attendance');

  const teacherAttendance = requireSuccess(await runCase({
    name: 'Admin checks in teacher',
    method: 'post',
    route: `${apiPrefix}/teacher-attendance/check-in`,
    client: admin.agent,
    body: { teacherId: teacher.id, classSessionId: classSession.id },
    expectedStatus: 201,
  }), 'Teacher check-in');

  await runCase({
    name: 'Duplicate open teacher check-in is rejected',
    method: 'post',
    route: `${apiPrefix}/teacher-attendance/check-in`,
    client: admin.agent,
    body: { teacherId: teacher.id, classSessionId: classSession.id },
    expectedStatus: 409,
  });

  await runCase({
    name: 'Admin checks out teacher',
    method: 'patch',
    route: `${apiPrefix}/teacher-attendance/${teacherAttendance.id}/check-out`,
    client: admin.agent,
    expectedStatus: 200,
  });

  await runCase({
    name: 'Duplicate teacher checkout is rejected',
    method: 'patch',
    route: `${apiPrefix}/teacher-attendance/${teacherAttendance.id}/check-out`,
    client: admin.agent,
    expectedStatus: 409,
  });

  const justification = requireSuccess(await runCase({
    name: 'Admin creates absence justification',
    method: 'post',
    route: `${apiPrefix}/absence-justifications`,
    client: admin.agent,
    body: { attendanceRecordId: absentAttendance.id, reason: 'Medical appointment validation.' },
    expectedStatus: 201,
  }), 'Absence justification');

  await runCase({ name: 'Admin lists absence justifications', method: 'get', route: `${apiPrefix}/absence-justifications`, client: admin.agent, expectedStatus: 200 });
  await runCase({
    name: 'Admin reviews absence justification',
    method: 'patch',
    route: `${apiPrefix}/absence-justifications/${justification.id}/review`,
    client: admin.agent,
    body: { status: 'approved', reviewNotes: 'Validation approved.' },
    expectedStatus: 200,
  });

  await runCase({ name: 'Admin gets branch summary report', method: 'get', route: `${apiPrefix}/reports/branches/summary`, client: admin.agent, expectedStatus: 200 });
  await runCase({ name: 'Admin gets scholarship candidate report', method: 'get', route: `${apiPrefix}/reports/scholarships/${student.id}/candidate`, client: admin.agent, expectedStatus: 200 });
  await runCase({ name: 'Admin gets level promotion candidate report', method: 'get', route: `${apiPrefix}/reports/level-promotions/${student.id}/candidate`, client: admin.agent, expectedStatus: 200 });
  await runCase({ name: 'Admin gets teacher payment report', method: 'get', route: `${apiPrefix}/reports/teachers/${teacher.id}/payment`, client: admin.agent, expectedStatus: 200 });

  await runCase({ name: 'Admin lists scholarship evaluations', method: 'get', route: `${apiPrefix}/scholarship-evaluations`, client: admin.agent, expectedStatus: 200 });
  await runCase({
    name: 'Admin creates scholarship evaluation',
    method: 'post',
    route: `${apiPrefix}/scholarship-evaluations`,
    client: admin.agent,
    body: { studentId: student.id, percentage: 25, theoryScore: 80, practiceScore: 85, approved: false },
    expectedStatus: 201,
  });

  await runCase({ name: 'Admin lists level promotion evaluations', method: 'get', route: `${apiPrefix}/level-promotion-evaluations`, client: admin.agent, expectedStatus: 200 });
  await runCase({
    name: 'Admin creates level promotion evaluation',
    method: 'post',
    route: `${apiPrefix}/level-promotion-evaluations`,
    client: admin.agent,
    body: { studentId: student.id, consistencyScore: 82, theoryScore: 80, practiceScore: 85, approved: false },
    expectedStatus: 201,
  });

  await runCase({ name: 'Admin lists audit logs', method: 'get', route: `${apiPrefix}/audit-logs`, client: admin.agent, expectedStatus: 200 });

  const failed = results.filter((result) => !result.passed);
  const report = buildMarkdownReport(results, {
    enrollmentRequestId: validEnrollment.id,
    attendanceRecordId: attendance.id,
  });

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
  fs.writeFileSync(reportPath, report);
  fs.writeFileSync(jsonPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2)}\n`);

  console.log(`API validation completed: ${results.length - failed.length}/${results.length} passed.`);
  console.log(`Markdown report: ${path.relative(rootDir, reportPath)}`);
  console.log(`JSON results: ${path.relative(rootDir, jsonPath)}`);

  if (failed.length) {
    console.error('Failed API validation cases:');
    for (const failure of failed) console.error(`- ${failure.method} ${failure.route}: ${failure.message}`);
    process.exitCode = 1;
  }
}

function buildMarkdownReport(results, evidence) {
  const passed = results.filter((result) => result.passed).length;
  const failed = results.length - passed;
  const rows = results.map((result) => (
    `| ${escapeMarkdown(result.name)} | \`${result.method}\` | \`${escapeMarkdown(result.route)}\` | ${escapeMarkdown(result.expectedStatus)} | ${escapeMarkdown(result.actualStatus)} | ${result.passed ? 'Pass' : 'Fail'} | ${escapeMarkdown(result.message)} |`
  ));

  return `# API Validation Report

Generated: ${new Date().toISOString()}

Scope:
- Local Express application with in-memory repositories.
- Mock Google ID tokens enabled only for automated validation.
- Session cookie, JWT Bearer token, RBAC middleware, validation middleware, CRUD flows, attendance flows, reports and private page guard are exercised through HTTP requests.

Summary:
- Total cases: ${results.length}
- Passed: ${passed}
- Failed: ${failed}
- Sample enrollment request id: ${evidence.enrollmentRequestId}
- Sample attendance record id: ${evidence.attendanceRecordId}

| Case | Method | URI | Expected | Actual | Result | Message |
| --- | --- | --- | --- | --- | --- | --- |
${rows.join('\n')}
`;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
