const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const collectionPath = path.join(root, 'postman', 'American-Latin-Class-API.postman_collection.json');
const environmentPath = path.join(root, 'postman', 'American-Latin-Class.postman_environment.json');
const collection = JSON.parse(fs.readFileSync(collectionPath, 'utf8'));
const environment = JSON.parse(fs.readFileSync(environmentPath, 'utf8'));

function tests(lines) {
  return [{ listen:'test', script:{ type:'text/javascript', exec:lines } }];
}

function jsonItem(name, method, url, body, testLines, options = {}) {
  const request = {
    method,
    header:body === undefined ? [] : [{ key:'Content-Type', value:'application/json' }],
    url,
    description:options.description,
  };
  if (body !== undefined) {
    request.body = { mode:'raw', raw:typeof body === 'string' ? body : JSON.stringify(body, null, 2), options:{ raw:{ language:'json' } } };
  }
  const item = { name, request, event:tests(testLines) };
  if (options.noauth) item.auth = { type:'noauth' };
  return item;
}

function getFolder(name) {
  let result = collection.item.find((item) => item.name === name);
  if (!result) {
    result = { name, item:[] };
    collection.item.push(result);
  }
  return result;
}

function upsert(folderName, item, beforeName = null) {
  const folder = getFolder(folderName);
  const existingIndex = folder.item.findIndex((candidate) => candidate.name === item.name);
  if (existingIndex >= 0) folder.item.splice(existingIndex, 1);
  const beforeIndex = beforeName ? folder.item.findIndex((candidate) => candidate.name === beforeName) : -1;
  folder.item.splice(beforeIndex >= 0 ? beforeIndex : folder.item.length, 0, item);
}

function orderFolderItems(folderName, orderedNames) {
  const folder = getFolder(folderName);
  const order = new Map(orderedNames.map((name, index) => [name, index]));
  folder.item.sort((left, right) => (
    (order.get(left.name) ?? orderedNames.length) - (order.get(right.name) ?? orderedNames.length)
  ));
}

function existingItem(name) {
  for (const folder of collection.item) {
    const item = folder.item?.find((candidate) => candidate.name === name);
    if (item) return item;
  }
  throw new Error(`Postman item not found: ${name}`);
}

function setRawBody(name, body) {
  existingItem(name).request.body.raw = typeof body === 'string' ? body : JSON.stringify(body, null, 2);
}

function ensureEnvironmentValue(key, value = '', type = 'default') {
  const existing = environment.values.find((item) => item.key === key);
  if (existing) Object.assign(existing, { value, type, enabled:true });
  else environment.values.push({ key, value, type, enabled:true });
}

collection.info.description = 'Defense-ready manual verification collection for American Latin Class. It covers authentication, authorization, catalogs, academic enrollment, attendance, payments, events, reports, account governance and student self-service with executable Postman tests.';
collection.event = (collection.event || []).filter((event) => event.listen !== 'prerequest');
collection.event.unshift({
  listen:'prerequest',
  script:{
    type:'text/javascript',
    exec:[
      'const now = Date.now();',
      "pm.environment.set('session_start', new Date(now - 30 * 60 * 1000).toISOString());",
      "pm.environment.set('session_end', new Date(now + 90 * 60 * 1000).toISOString());",
      "pm.environment.set('absence_session_start', new Date(now - 4 * 60 * 60 * 1000).toISOString());",
      "pm.environment.set('absence_session_end', new Date(now - 2 * 60 * 60 * 1000).toISOString());",
      "pm.environment.set('enrollment_start', new Date(now - 24 * 60 * 60 * 1000).toISOString());",
      "pm.environment.set('event_start', new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString());",
      "pm.environment.set('event_end', new Date(now + 7 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString());",
      "pm.environment.set('report_from', new Date(now - 90 * 24 * 60 * 60 * 1000).toISOString());",
      "pm.environment.set('report_to', new Date(now).toISOString());",
      "pm.environment.set('payment_period', new Date(now).toISOString().slice(0, 7));",
      "pm.environment.set('payment_paid_at', new Date(now).toISOString());",
      "pm.environment.set('payment_due_at', new Date(now + 5 * 24 * 60 * 60 * 1000).toISOString());",
    ],
  },
});

upsert('Health And Public', jsonItem('Liveness', 'GET', '{{base_url}}/health/live', undefined, [
  "pm.test('HTTP 200', () => pm.response.to.have.status(200));",
  "pm.test('Process is alive', () => pm.expect(pm.response.json().status).to.eql('ok'));",
], { noauth:true }));
upsert('Health And Public', jsonItem('Readiness', 'GET', '{{base_url}}/health/ready', undefined, [
  "pm.test('HTTP 200', () => pm.response.to.have.status(200));",
  "pm.test('Database is ready', () => pm.expect(pm.response.json().dependencies.database).to.eql('up'));",
], { noauth:true }));
upsert('Health And Public', jsonItem('Public Branches', 'GET', '{{base_url}}/public/branches', undefined, [
  "pm.test('HTTP 200', () => pm.response.to.have.status(200));",
  "pm.test('Active branches returned', () => pm.expect(pm.response.json().data).to.be.an('array').that.is.not.empty);",
  "pm.test('Public cache policy visible', () => pm.expect(pm.response.headers.get('Cache-Control')).to.include('public'));",
], { noauth:true }));

setRawBody('Create Class Session', {
  classGroupId:'{{class_group_id}}',
  name:'Postman active class',
  startsAt:'{{session_start}}',
  endsAt:'{{session_end}}',
  status:'scheduled',
});
setRawBody('Create Absence Class Session', {
  classGroupId:'{{class_group_id}}',
  name:'Postman completed attendance window',
  startsAt:'{{absence_session_start}}',
  endsAt:'{{absence_session_end}}',
  status:'scheduled',
});
setRawBody('Update Class Session', { name:'Postman active class updated' });
setRawBody('Update Student', { fullName:'Postman Student Updated' });

upsert('Catalog CRUD', jsonItem('Enroll Student In Class Group', 'POST', '{{base_url}}/class-group-enrollments', {
  studentId:'{{student_id}}',
  classGroupId:'{{class_group_id}}',
  status:'active',
  startsAt:'{{enrollment_start}}',
}, [
  "pm.test('HTTP 201', () => pm.response.to.have.status(201));",
  "pm.environment.set('class_group_enrollment_id', pm.response.json().data.id);",
]), 'Create Class Session');
upsert('Catalog CRUD', jsonItem('List Class Group Enrollments', 'GET', '{{base_url}}/class-group-enrollments', undefined, [
  "pm.test('HTTP 200', () => pm.response.to.have.status(200));",
  "pm.test('Enrollments returned', () => pm.expect(pm.response.json().data).to.be.an('array'));",
]), 'Create Class Session');
upsert('Catalog CRUD', jsonItem('Update Class Group Enrollment', 'PATCH', '{{base_url}}/class-group-enrollments/{{class_group_enrollment_id}}', {
  status:'active',
}, ["pm.test('HTTP 200', () => pm.response.to.have.status(200));"]), 'Create Class Session');

upsert('Attendance And Absences', jsonItem('List Student Attendance', 'GET', '{{base_url}}/student-attendance', undefined, [
  "pm.test('HTTP 200', () => pm.response.to.have.status(200));",
  "pm.test('Attendance list returned', () => pm.expect(pm.response.json().data).to.be.an('array'));",
]), 'Record Student Attendance');
upsert('Attendance And Absences', jsonItem('Load Session Roster', 'GET', '{{base_url}}/class-sessions/{{class_session_id}}/roster', undefined, [
  "pm.test('HTTP 200', () => pm.response.to.have.status(200));",
  'const roster = pm.response.json().data.roster;',
  "pm.test('Roster has enrolled student', () => pm.expect(roster).to.be.an('array').that.is.not.empty);",
  "pm.environment.set('roster_records', JSON.stringify(roster.map((row) => ({ studentId: row.student.id, status: 'present', notes: 'Postman batch draft' }))));",
]), 'Record Student Attendance');
upsert('Attendance And Absences', jsonItem('Save Session Attendance Draft', 'PUT', '{{base_url}}/class-sessions/{{class_session_id}}/attendance', '{\n  "state": "draft",\n  "records": {{roster_records}}\n}', [
  "pm.test('HTTP 200', () => pm.response.to.have.status(200));",
  "pm.test('Draft state returned', () => pm.expect(pm.response.json().data.attendanceState).to.eql('draft'));",
]), 'Record Absent Attendance');
upsert('Attendance And Absences', jsonItem('List Teacher Attendance', 'GET', '{{base_url}}/teacher-attendance', undefined, [
  "pm.test('HTTP 200', () => pm.response.to.have.status(200));",
  "pm.test('Teacher attendance list returned', () => pm.expect(pm.response.json().data).to.be.an('array'));",
]), 'Teacher Check In');

upsert('Public Enrollment', jsonItem('Update Enrollment Request Status', 'PATCH', '{{base_url}}/enrollment-requests/{{enrollment_request_id}}/status', {
  status:'contacted',
  notes:'Contacted during Postman verification.',
}, ["pm.test('HTTP 200', () => pm.response.to.have.status(200));"]));

upsert('Identity And RBAC', jsonItem('Create Managed Branch Director Account', 'POST', '{{base_url}}/users', {
  email:'postman.director.{{$timestamp}}@example.com',
  name:'Postman Branch Director',
  role:'BranchDirector',
  branchIds:['{{branch_id}}'],
}, [
  "pm.test('HTTP 201', () => pm.response.to.have.status(201));",
  'const managedAccount = pm.response.json().data;',
  "pm.environment.set('managed_user_id', managedAccount.user.id);",
  "pm.environment.set('managed_user_email', managedAccount.user.email);",
  "pm.test('Invitation sent without exposing password', () => { pm.expect(managedAccount.invitation.status).to.eql('sent'); pm.expect(managedAccount.temporaryPassword).to.be.undefined; });",
]), 'Assign User Role');
upsert('Identity And RBAC', jsonItem('Capture Managed Invitation From Mailpit', 'GET', '{{mailpit_url}}/api/v1/messages', undefined, [
  'const mailbox = pm.response.json();',
  "const recipient = pm.environment.get('managed_user_email');",
  "const invitation = mailbox.messages.find((message) => (message.To || []).some((address) => address.Address === recipient));",
  "pm.test('Invitation reached local mailbox', () => pm.expect(invitation).to.exist);",
  "if (invitation) pm.environment.set('managed_message_id', invitation.ID);",
], { noauth:true }));
upsert('Identity And RBAC', jsonItem('Read Managed Invitation Detail', 'GET', '{{mailpit_url}}/api/v1/message/{{managed_message_id}}', undefined, [
  'const invitation = pm.response.json();',
  "const match = String(invitation.Text || '').match(/Contraseña temporal:\\s*([^\\r\\n]+)/);",
  "pm.test('Branded invitation contains a temporary credential', () => { pm.expect(invitation.Subject).to.eql('Tu acceso a American Latin Class'); pm.expect(match).to.exist; });",
  "if (match) pm.environment.set('managed_temporary_password', match[1].trim());",
], { noauth:true }));
upsert('Identity And RBAC', jsonItem('Managed Account First Login', 'POST', '{{base_url}}/auth/login', {
  email:'{{managed_user_email}}',
  password:'{{managed_temporary_password}}',
}, [
  "pm.test('HTTP 200', () => pm.response.to.have.status(200));",
  "pm.test('Password change is required', () => pm.expect(pm.response.json().data.user.mustChangePassword).to.be.true);",
  "pm.environment.set('admin_session_token', pm.environment.get('session_token'));",
  "pm.environment.set('session_token', pm.response.json().data.sessionToken);",
], { noauth:true }), 'Assign User Role');
upsert('Identity And RBAC', jsonItem('Managed Account Changes Temporary Password', 'POST', '{{base_url}}/auth/change-password', {
  currentPassword:'{{managed_temporary_password}}',
  newPassword:'ManagedDirector2026!',
}, [
  "pm.test('HTTP 200', () => pm.response.to.have.status(200));",
  "pm.test('Password change requirement cleared', () => pm.expect(pm.response.json().data.user.mustChangePassword).to.be.false);",
  "pm.environment.set('session_token', pm.environment.get('admin_session_token'));",
]), 'Assign User Role');
const assignRole = existingItem('Assign User Role');
assignRole.request.url = '{{base_url}}/users/{{managed_user_id}}/role';
assignRole.request.body.raw = JSON.stringify({ role:'BranchDirector' }, null, 2);
upsert('Identity And RBAC', jsonItem('Read User Branch Access', 'GET', '{{base_url}}/users/{{managed_user_id}}/branch-access', undefined, [
  "pm.test('HTTP 200', () => pm.response.to.have.status(200));",
  "pm.test('Assigned branch returned', () => pm.expect(pm.response.json().data.map((row) => row.branchId)).to.include(pm.environment.get('branch_id')));",
]));
upsert('Identity And RBAC', jsonItem('Update User Branch Access', 'PATCH', '{{base_url}}/users/{{managed_user_id}}/branch-access', {
  branchIds:['{{branch_id}}'],
}, ["pm.test('HTTP 200', () => pm.response.to.have.status(200));"]));
upsert('Identity And RBAC', jsonItem('Reset Managed User Password', 'POST', '{{base_url}}/users/{{managed_user_id}}/reset-password', undefined, [
  "pm.test('HTTP 200', () => pm.response.to.have.status(200));",
  "pm.test('Reset email sent without exposing password', () => { const data = pm.response.json().data; pm.expect(data.user.mustChangePassword).to.be.true; pm.expect(data.invitation.status).to.eql('sent'); pm.expect(data.temporaryPassword).to.be.undefined; });",
]));
upsert('Identity And RBAC', jsonItem('Resend Managed User Invitation', 'POST', '{{base_url}}/users/{{managed_user_id}}/resend-invitation', undefined, [
  "pm.test('HTTP 200', () => pm.response.to.have.status(200));",
  "pm.test('Invitation resent without exposing password', () => { const data = pm.response.json().data; pm.expect(data.invitation.status).to.eql('sent'); pm.expect(data.temporaryPassword).to.be.undefined; });",
]));
upsert('Identity And RBAC', jsonItem('Deactivate Managed User', 'PATCH', '{{base_url}}/users/{{managed_user_id}}/status', { active:false }, [
  "pm.test('HTTP 200', () => pm.response.to.have.status(200));",
  "pm.test('User is inactive', () => pm.expect(pm.response.json().data.active).to.be.false);",
]));
upsert('Identity And RBAC', jsonItem('Reactivate Managed User', 'PATCH', '{{base_url}}/users/{{managed_user_id}}/status', { active:true }, [
  "pm.test('HTTP 200', () => pm.response.to.have.status(200));",
  "pm.test('User is active', () => pm.expect(pm.response.json().data.active).to.be.true);",
]));
orderFolderItems('Identity And RBAC', [
  'List Users',
  'Create Managed Branch Director Account',
  'Capture Managed Invitation From Mailpit',
  'Read Managed Invitation Detail',
  'Managed Account First Login',
  'Managed Account Changes Temporary Password',
  'Assign User Role',
  'List Roles',
  'List Permissions',
  'List Audit Logs',
  'Read User Branch Access',
  'Update User Branch Access',
  'Reset Managed User Password',
  'Resend Managed User Invitation',
  'Deactivate Managed User',
  'Reactivate Managed User',
]);

upsert('Attendance And Absences', jsonItem('Reject Enrollment Deletion With Attendance History', 'DELETE', '{{base_url}}/class-group-enrollments/{{class_group_enrollment_id}}', undefined, [
  "pm.test('HTTP 409 protects attendance history', () => pm.response.to.have.status(409));",
  "pm.test('Business rule is explicit', () => pm.expect(pm.response.json().details.code).to.eql('ENROLLMENT_HAS_ATTENDANCE_HISTORY'));",
]));
upsert('Attendance And Absences', jsonItem('Read Missing Absence Evidence', 'GET', '{{base_url}}/absence-justifications/{{absence_justification_id}}/evidence', undefined, [
  "pm.test('HTTP 404 when no file was uploaded', () => pm.response.to.have.status(404));",
]));

upsert('Academy Events', jsonItem('Create Academy Event', 'POST', '{{base_url}}/academy-events', {
  branchId:'{{branch_id}}',
  title:'Postman Dance Showcase',
  description:'Event created during defense verification.',
  level:'ALL',
  startsAt:'{{event_start}}',
  endsAt:'{{event_end}}',
  location:'American Latin Class',
  showIncome:250,
  active:true,
}, [
  "pm.test('HTTP 201', () => pm.response.to.have.status(201));",
  "pm.environment.set('academy_event_id', pm.response.json().data.id);",
]));
upsert('Academy Events', jsonItem('List Academy Events', 'GET', '{{base_url}}/academy-events', undefined, ["pm.test('HTTP 200', () => pm.response.to.have.status(200));"]));
upsert('Academy Events', jsonItem('Read Academy Event', 'GET', '{{base_url}}/academy-events/{{academy_event_id}}', undefined, [
  "pm.test('HTTP 200', () => pm.response.to.have.status(200));",
  "pm.test('Created event returned', () => pm.expect(pm.response.json().data.id).to.eql(pm.environment.get('academy_event_id')));",
]), 'Update Academy Event');
upsert('Academy Events', jsonItem('Update Academy Event', 'PATCH', '{{base_url}}/academy-events/{{academy_event_id}}', { showIncome:300 }, ["pm.test('HTTP 200', () => pm.response.to.have.status(200));"]));
upsert('Academy Events', jsonItem('Remove Academy Event', 'DELETE', '{{base_url}}/academy-events/{{academy_event_id}}', undefined, ["pm.test('HTTP 200', () => pm.response.to.have.status(200));"]));
orderFolderItems('Academy Events', [
  'Create Academy Event',
  'List Academy Events',
  'Read Academy Event',
  'Update Academy Event',
  'Remove Academy Event',
]);

upsert('Payments', jsonItem('Create Student Payment', 'POST', '{{base_url}}/student-payments', {
  studentId:'{{student_id}}',
  branchId:'{{branch_id}}',
  amount:45,
  concept:'Monthly tuition',
  period:'{{payment_period}}',
  status:'pending',
  dueAt:'{{payment_due_at}}',
  notes:'Postman defense verification.',
}, [
  "pm.test('HTTP 201', () => pm.response.to.have.status(201));",
  "pm.environment.set('student_payment_id', pm.response.json().data.id);",
]));
upsert('Payments', jsonItem('List Student Payments', 'GET', '{{base_url}}/student-payments', undefined, ["pm.test('HTTP 200', () => pm.response.to.have.status(200));"]));
upsert('Payments', jsonItem('Read Student Payment', 'GET', '{{base_url}}/student-payments/{{student_payment_id}}', undefined, ["pm.test('HTTP 200', () => pm.response.to.have.status(200));"]));
upsert('Payments', jsonItem('Update Student Payment', 'PATCH', '{{base_url}}/student-payments/{{student_payment_id}}', {
  status:'paid',
  paidAt:'{{payment_paid_at}}',
  notes:'Payment collected during Postman verification.',
  correctionReason:'Defense verification payment',
}, ["pm.test('HTTP 200', () => pm.response.to.have.status(200));"]));
upsert('Payments', jsonItem('Reverse Student Payment', 'POST', '{{base_url}}/student-payments/{{student_payment_id}}/reversal', {
  reason:'Postman defense reversal test',
}, ["pm.test('HTTP 201', () => pm.response.to.have.status(201));"]));

upsert('Reports And Evaluations', jsonItem('General Report With Filters', 'GET', '{{base_url}}/reports/general?from={{report_from}}&to={{report_to}}&level=B1', undefined, [
  "pm.test('HTTP 200', () => pm.response.to.have.status(200));",
  "pm.test('General report totals returned', () => pm.expect(pm.response.json().data.totals).to.be.an('object'));",
]));
upsert('Reports And Evaluations', jsonItem('Branch Detail Report', 'GET', '{{base_url}}/reports/branches/{{branch_id}}/detail?from={{report_from}}&to={{report_to}}', undefined, [
  "pm.test('HTTP 200', () => pm.response.to.have.status(200));",
  "pm.test('Branch report returned', () => pm.expect(pm.response.json().data.branch).to.be.an('object'));",
]));
upsert('Reports And Evaluations', jsonItem('Detailed Attendance Report', 'GET', '{{base_url}}/reports/attendance?from={{report_from}}&to={{report_to}}&level=B1', undefined, [
  "pm.test('HTTP 200', () => pm.response.to.have.status(200));",
  "pm.test('Attendance dimensions returned', () => { const data = pm.response.json().data; pm.expect(data.byStudent).to.be.an('array'); pm.expect(data.byClassGroup).to.be.an('array'); pm.expect(data.byBranch).to.be.an('array'); });",
]));

upsert('Student Self Service', jsonItem('Student Password Login', 'POST', '{{base_url}}/auth/login', {
  email:'{{student_login_email}}',
  password:'{{student_login_password}}',
}, [
  "pm.test('HTTP 200', () => pm.response.to.have.status(200));",
  "pm.environment.set('admin_session_token', pm.environment.get('session_token'));",
  "pm.environment.set('session_token', pm.response.json().data.sessionToken);",
], { noauth:true, description:'Set student_login_email and student_login_password in the environment before running this folder.' }));
upsert('Student Self Service', jsonItem('Student Reads Own Attendance', 'GET', '{{base_url}}/student-attendance', undefined, ["pm.test('HTTP 200', () => pm.response.to.have.status(200));"]));
upsert('Student Self Service', jsonItem('Student Reads Own Payments', 'GET', '{{base_url}}/student-payments', undefined, ["pm.test('HTTP 200', () => pm.response.to.have.status(200));"]));
upsert('Student Self Service', jsonItem('Student Reads Available Events', 'GET', '{{base_url}}/academy-events', undefined, ["pm.test('HTTP 200', () => pm.response.to.have.status(200));"]));
upsert('Student Self Service', jsonItem('Student Uploads Profile Photo', 'PATCH', '{{base_url}}/students/me/profile-photo', {
  profilePhotoUrl:'data:image/png;base64,iVBORw0KGgo=',
}, ["pm.test('HTTP 200', () => pm.response.to.have.status(200));"]));
upsert('Student Self Service', jsonItem('Student Removes Profile Photo', 'DELETE', '{{base_url}}/students/me/profile-photo', undefined, [
  "pm.test('HTTP 200', () => pm.response.to.have.status(200));",
  "pm.environment.set('session_token', pm.environment.get('admin_session_token'));",
]));

const folderOrder = [
  'Health And Public', 'Auth & Session', 'Public Enrollment', 'Catalog CRUD', 'Identity And RBAC',
  'Attendance And Absences', 'Academy Events', 'Payments', 'Reports And Evaluations',
  'Student Self Service', 'Session Teardown',
];
collection.item.sort((left, right) => folderOrder.indexOf(left.name) - folderOrder.indexOf(right.name));

ensureEnvironmentValue('site_url', 'http://127.0.0.1:3005');
ensureEnvironmentValue('base_url', 'http://127.0.0.1:3005/api/v1');
ensureEnvironmentValue('analytics_base_url', 'http://127.0.0.1:8005/api/analytics/v1');
ensureEnvironmentValue('mailpit_url', 'http://127.0.0.1:8025');
ensureEnvironmentValue('student_login_email', '', 'secret');
ensureEnvironmentValue('student_login_password', '', 'secret');
for (const key of [
  'managed_user_id', 'managed_user_email', 'managed_temporary_password', 'managed_message_id', 'class_group_enrollment_id', 'roster_records',
  'academy_event_id', 'student_payment_id', 'admin_session_token',
]) ensureEnvironmentValue(key, '', key.includes('password') || key.includes('token') ? 'secret' : 'default');

fs.writeFileSync(collectionPath, `${JSON.stringify(collection, null, 2)}\n`);
fs.writeFileSync(environmentPath, `${JSON.stringify(environment, null, 2)}\n`);
console.log(`Postman collection synchronized: ${collectionPath}`);
