const sessionUser = document.querySelector('#sessionUser');
const logoutLink = document.querySelector('#logoutLink');
const output = document.querySelector('#workflowOutput');

function showOutput(payload) {
  if (output) output.textContent = JSON.stringify(payload, null, 2);
}

async function sendJson(uri, body) {
  const response = await fetch(uri, {
    method:'POST',
    credentials:'include',
    headers:{ 'Content-Type':'application/json' },
    body:JSON.stringify(body),
  });
  const payload = await response.json();
  showOutput(payload);
  return payload;
}

async function loadSession() {
  const response = await fetch('/api/v1/auth/me', { credentials:'include' });
  if (!response.ok) {
    window.location.href = '/index.html?session=expired';
    return;
  }
  const payload = await response.json();
  const user = payload.data.user;
  sessionUser.textContent = `${user.name} | ${user.email} | ${user.role}`;
}

logoutLink.addEventListener('click', async (event) => {
  event.preventDefault();
  await fetch('/api/v1/auth/logout', { method:'POST', credentials:'include' });
  window.location.href = '/index.html?session=logout';
});

document.querySelector('#studentAttendanceForm')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  await sendJson('/api/v1/student-attendance', Object.fromEntries(new FormData(event.currentTarget).entries()));
});

document.querySelector('#teacherCheckInForm')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  await sendJson('/api/v1/teacher-attendance/check-in', Object.fromEntries(new FormData(event.currentTarget).entries()));
});

document.querySelector('#branchReportButton')?.addEventListener('click', async () => {
  const response = await fetch('/api/v1/reports/branches/summary', { credentials:'include' });
  showOutput(await response.json());
});

loadSession();
