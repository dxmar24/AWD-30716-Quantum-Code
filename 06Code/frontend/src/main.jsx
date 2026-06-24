import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { apiRequest, postJson } from './api/client';
import './styles.css';

const branches = ['Norte', 'Matriz', 'Sur Guamani', 'Tumbaco', 'Conocoto'];
const tiles = ['Student attendance', 'Teacher check-in', 'Scholarships', 'Level promotion', 'Reports', 'Audit logs'];

function LandingPage() {
  return (
    <>
      <header className="hero">
        <nav className="topbar" aria-label="Main navigation">
          <strong>American Latin Class</strong>
          <div>
            <a href="#enroll">Enrollment</a>
            <a href="/login.html">Private system</a>
          </div>
        </nav>
        <div className="hero-content">
          <p className="eyebrow">Attendance and academic control</p>
          <h1>American Latin Class</h1>
          <p>Centralized attendance, teacher hours, scholarship candidates, level promotion and branch reporting for a five-branch dance academy.</p>
          <a className="primary-link" href="#enroll">Request enrollment</a>
        </div>
      </header>
      <main>
        <BranchSummary />
        <StylesLevels />
        <EnrollmentForm />
      </main>
    </>
  );
}

function LoginPage() {
  const buttonRef = useRef(null);
  const [status, setStatus] = useState('Loading Google sign-in...');

  useEffect(() => {
    let mounted = true;

    async function loadGoogleSignIn() {
      try {
        const payload = await apiRequest('/auth/config');
        const clientId = payload.data.googleClientId;

        await new Promise((resolve, reject) => {
          if (window.google?.accounts?.id) return resolve();
          const existingScript = document.querySelector('script[data-google-identity]');
          if (existingScript) {
            existingScript.addEventListener('load', resolve, { once: true });
            existingScript.addEventListener('error', reject, { once: true });
            return;
          }

          const script = document.createElement('script');
          script.src = 'https://accounts.google.com/gsi/client';
          script.async = true;
          script.defer = true;
          script.dataset.googleIdentity = 'true';
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });

        if (!mounted) return;

        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: async (response) => {
            setStatus('Starting session...');
            try {
              await postJson('/auth/google', { idToken: response.credential });
              window.location.href = '/private/dashboard.html';
            } catch (error) {
              setStatus(error.message || 'Google sign-in failed.');
            }
          },
        });

        window.google.accounts.id.renderButton(buttonRef.current, {
          theme: 'outline',
          size: 'large',
          type: 'standard',
          width: 280,
        });
        setStatus(new URLSearchParams(window.location.search).has('session') ? 'Session required.' : '');
      } catch (error) {
        setStatus(error.message || 'Google sign-in is not available.');
      }
    }

    loadGoogleSignIn();
    return () => { mounted = false; };
  }, []);

  return (
    <main className="login-page">
      <section className="login-panel" aria-label="Private system login">
        <p className="eyebrow">Private system</p>
        <h1>American Latin Class</h1>
        <p className="login-copy">Sign in with Google to continue.</p>
        <div className="google-button" ref={buttonRef} />
        <p className="form-status" aria-live="polite">{status}</p>
        <a className="secondary-link" href="/">Back to landing</a>
      </section>
    </main>
  );
}

function BranchSummary() {
  return (
    <>
      <section className="summary-band" aria-label="Academy summary">
        {[
          ['5', 'Branches'],
          ['B1-B2', 'Academic levels'],
          ['90%', 'Scholarship candidate threshold'],
          ['3', 'Dance categories'],
        ].map(([value, label]) => (
          <article key={label}>
            <span>{value}</span>
            <p>{label}</p>
          </article>
        ))}
      </section>
      <section className="content-band two-column">
        <div>
          <p className="eyebrow">Branches</p>
          <h2>Centralized information for every location</h2>
          <p>Norte, Matriz, Sur Guamani, Tumbaco and Conocoto share the same attendance, teacher, student and report workflow.</p>
        </div>
        <div className="list-grid">
          {branches.map((branch) => <span key={branch}>{branch}</span>)}
        </div>
      </section>
    </>
  );
}

function StylesLevels() {
  return (
    <section className="content-band two-column">
      <div>
        <p className="eyebrow">Styles and levels</p>
        <h2>Urban, Tropical and Ethnic programs</h2>
        <p>Hip hop, Afro, House, Locking, Popping, Waacking, Dancehall, Fem, Heels, Salsa, Bachata and Traditional Ecuadorian dances.</p>
      </div>
      <div className="level-panel">
        <div><strong>B1</strong><span>Basic-intermediate</span></div>
        <div><strong>B2</strong><span>Intermediate-advanced</span></div>
      </div>
    </section>
  );
}

function EnrollmentForm() {
  const [status, setStatus] = useState('');

  async function submit(event) {
    event.preventDefault();
    setStatus('');
    try {
      await postJson('/enrollment-requests', Object.fromEntries(new FormData(event.currentTarget).entries()));
      event.currentTarget.reset();
      setStatus('Enrollment request registered.');
    } catch {
      setStatus('The request could not be registered.');
    }
  }

  return (
    <section className="content-band enrollment" id="enroll">
      <div>
        <p className="eyebrow">Enrollment request</p>
        <h2>Start from the public landing page</h2>
      </div>
      <form onSubmit={submit}>
        <label>Full name<input name="fullName" autoComplete="name" required /></label>
        <label>Email<input name="email" type="email" autoComplete="email" required /></label>
        <label>Preferred branch<select name="preferredBranch">{branches.map((branch) => <option key={branch}>{branch}</option>)}</select></label>
        <label>Style interest<input name="styleInterest" placeholder="Salsa, Hip hop, Bachata" /></label>
        <button type="submit">Submit request</button>
        <p className="form-status" aria-live="polite">{status}</p>
      </form>
    </section>
  );
}

function AuthStatus() {
  const [text, setText] = useState('Loading session...');

  useEffect(() => {
    apiRequest('/auth/me')
      .then((payload) => {
        const user = payload.data.user;
        setText(`${user.name} | ${user.email} | ${user.role}`);
      })
      .catch(() => {
        window.location.href = '/login.html?session=expired';
      });
  }, []);

  return <p>{text}</p>;
}

function LogoutButton() {
  async function logout(event) {
    event.preventDefault();
    await apiRequest('/auth/logout', { method: 'POST' }).catch(() => null);
    window.location.href = '/login.html?session=logout';
  }

  return <a href="/login.html" onClick={logout}>Logout</a>;
}

function WorkflowOutput({ output }) {
  return <pre>{output ? JSON.stringify(output, null, 2) : ''}</pre>;
}

async function submitWorkflow(event, onOutput, path) {
  event.preventDefault();
  try {
    onOutput(await postJson(path, Object.fromEntries(new FormData(event.currentTarget).entries())));
  } catch (error) {
    onOutput({ success: false, message: error.message });
  }
}

function AttendanceWorkflow({ onOutput }) {
  return (
    <form onSubmit={(event) => submitWorkflow(event, onOutput, '/student-attendance')} className="workflow-panel">
      <h2>Student attendance</h2>
      <label>Student ID<input name="studentId" defaultValue="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" required /></label>
      <label>Class session ID<input name="classSessionId" defaultValue="eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee" required /></label>
      <label>Status<select name="status"><option value="present">Present</option><option value="absent">Absent</option><option value="justified">Justified</option><option value="late">Late</option></select></label>
      <button type="submit">Record attendance</button>
    </form>
  );
}

function TeacherCheckInWorkflow({ onOutput }) {
  return (
    <form onSubmit={(event) => submitWorkflow(event, onOutput, '/teacher-attendance/check-in')} className="workflow-panel">
      <h2>Teacher check-in</h2>
      <label>Teacher ID<input name="teacherId" defaultValue="cccccccc-cccc-4ccc-8ccc-cccccccccccc" required /></label>
      <label>Class session ID<input name="classSessionId" defaultValue="eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee" /></label>
      <button type="submit">Check in</button>
    </form>
  );
}

function ReportsPanel({ output, onOutput }) {
  return (
    <div className="workflow-panel">
      <h2>Reports</h2>
      <button type="button" onClick={async () => {
        try {
          onOutput(await apiRequest('/reports/branches/summary'));
        } catch (error) {
          onOutput({ success: false, message: error.message });
        }
      }}>
        Load branch summary
      </button>
      <WorkflowOutput output={output} />
    </div>
  );
}

function PrivateDashboard() {
  const [output, setOutput] = useState(null);

  return (
    <div className="dashboard-shell">
      <header className="dashboard-topbar">
        <nav className="topbar" aria-label="Dashboard navigation">
          <strong>American Latin Class</strong>
          <div>
            <a href="/">Landing</a>
            <LogoutButton />
          </div>
        </nav>
      </header>
      <main className="dashboard-main">
        <section>
          <p className="eyebrow">Private system</p>
          <h1>Academic operations</h1>
          <AuthStatus />
        </section>
        <section className="dashboard-grid" aria-label="Private modules">
          {tiles.map((tile) => (
            <article className="dashboard-tile" key={tile}>
              <strong>{tile}</strong>
              <p>{tile === 'Reports' ? 'Compare branch performance and consolidated academic metrics.' : 'Manage academic operations with secured API workflows.'}</p>
            </article>
          ))}
        </section>
        <section className="workflow-grid" aria-label="Attendance workflows">
          <AttendanceWorkflow onOutput={setOutput} />
          <TeacherCheckInWorkflow onOutput={setOutput} />
          <ReportsPanel output={output} onOutput={setOutput} />
        </section>
      </main>
    </div>
  );
}

function App() {
  const path = window.location.pathname;
  if (path.startsWith('/private')) return <PrivateDashboard />;
  if (path === '/login.html' || path === '/login') return <LoginPage />;
  return <LandingPage />;
}

createRoot(document.getElementById('root')).render(<App />);
