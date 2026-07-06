import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { apiRequest, postJson } from './api/client';
import './styles.css';

const branches = [
  { name: 'Norte', focus: 'Branch enrollment and attendance control' },
  { name: 'Matriz', focus: 'General direction and consolidated reports' },
  { name: 'Sur Guamani', focus: 'Student progress and group tracking' },
  { name: 'Tumbaco', focus: 'Teacher check-in and workload review' },
  { name: 'Conocoto', focus: 'Scholarship and promotion evidence' },
];

const branchNames = branches.map((branch) => branch.name);

const metrics = [
  ['5', 'active branches'],
  ['B1-B2', 'academic levels'],
  ['90%', 'scholarship threshold'],
  ['24/7', 'role-based access'],
];

const academyModules = [
  {
    level: 'Core',
    reward: 'daily ops',
    title: 'Attendance Control',
    description: 'Teachers and directors register student attendance with duplicate protection and audit evidence.',
    visual: 'attendance',
  },
  {
    level: 'Secure',
    reward: 'roles',
    title: 'Private Access',
    description: 'Google sessions, seeded role testing and scoped permissions for each school role.',
    visual: 'access',
  },
  {
    level: 'Director',
    reward: 'reports',
    title: 'Branch Reports',
    description: 'Compare branch activity, active students and operational progress from one dashboard.',
    visual: 'reports',
  },
  {
    level: 'Academic',
    reward: 'rules',
    title: 'Scholarships',
    description: 'Evaluate scholarship candidates with attendance thresholds and director approval evidence.',
    visual: 'scholarship',
  },
  {
    level: 'Growth',
    reward: 'levels',
    title: 'Level Promotion',
    description: 'Move B1 students toward B2 using consistency, theory, practice and attendance evidence.',
    visual: 'levels',
  },
  {
    level: 'Finance',
    reward: 'hours',
    title: 'Teacher Hours',
    description: 'Track check-in, check-out, completed hours and teacher payment calculations.',
    visual: 'hours',
  },
];

const featureItems = [
  ['Designed for directors', 'A restrained operational interface for school leadership, branch control and academic decisions.'],
  ['Evidence ready', 'Tests, Postman, AWS deployment, cache headers and PDFs are connected to the same product experience.'],
  ['Scoped by role', 'Admin, GeneralDirector, BranchDirector, Teacher and Student flows are separated by access policy.'],
];

const tiles = ['Student attendance', 'Teacher check-in', 'Scholarships', 'Level promotion', 'Reports', 'Audit logs'];

function LandingPage() {
  return (
    <>
      <header className="site-hero">
        <div className="promo-bar">Academic system deployed on AWS with HTTPS, JWT sessions and controlled cache evidence.</div>
        <nav className="topbar" aria-label="Main navigation">
          <a className="brand" href="/">
            <span className="brand-mark">ALC</span>
            <span>American Latin Class</span>
          </a>
          <div className="nav-links">
            <a href="#modules">Modules</a>
            <a href="#branches">Branches</a>
            <a href="#enroll">Enrollment</a>
            <a className="nav-cta" href="/login.html">Private system</a>
          </div>
        </nav>

        <section className="hero-content" aria-label="American Latin Class academic platform">
          <a className="pill-link" href="#modules">Academic operations platform</a>
          <h1>Run every dance academy branch from one polished system</h1>
          <p>
            A modern control center for attendance, teacher hours, scholarships, level promotion,
            branch reports and role-based academic workflows.
          </p>
          <div className="hero-actions">
            <a className="primary-link" href="#enroll">Request enrollment -&gt;</a>
            <a className="secondary-button" href="/login.html">Open private system</a>
          </div>
          <span className="hero-note">Built for directors who need fast evidence, clear permissions and clean operational data.</span>
        </section>

        <section className="module-strip" aria-label="Highlighted system modules">
          {academyModules.slice(0, 4).map((module) => <ModuleCard key={module.title} module={module} />)}
        </section>
      </header>

      <main>
        <MetricsBand />
        <ModulesSection />
        <FeatureHighlights />
        <BranchesSection />
        <EnrollmentForm />
      </main>
      <SiteFooter />
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
      <nav className="floating-nav" aria-label="Login navigation">
        <a className="brand" href="/">
          <span className="brand-mark">ALC</span>
          <span>American Latin Class</span>
        </a>
        <a className="secondary-button compact" href="/">Back to landing</a>
      </nav>
      <section className="login-panel" aria-label="Private system login">
        <p className="eyebrow">Private system</p>
        <h1>Sign in to the academic control center</h1>
        <p className="login-copy">Access attendance, reports, roles and director workflows with a protected session.</p>
        <div className="google-button" ref={buttonRef} />
        <p className="form-status" aria-live="polite">{status}</p>
      </section>
    </main>
  );
}

function MetricsBand() {
  return (
    <section className="metrics-band" aria-label="Academy summary">
      {metrics.map(([value, label]) => (
        <article key={label}>
          <span>{value}</span>
          <p>{label}</p>
        </article>
      ))}
    </section>
  );
}

function ModulesSection() {
  return (
    <section className="content-band" id="modules">
      <div className="section-heading centered">
        <p className="eyebrow">System modules</p>
        <h2>Everything a director needs to operate the school</h2>
        <p>Each module maps to a real API workflow, role permission and validation evidence.</p>
      </div>
      <div className="project-grid">
        {academyModules.map((module) => <ModuleCard key={module.title} module={module} />)}
      </div>
    </section>
  );
}

function ModuleCard({ module }) {
  return (
    <article className="module-card">
      <PreviewGraphic type={module.visual} />
      <div className="card-body">
        <div className="card-meta">
          <span>{module.level}</span>
          <span>{module.reward}</span>
        </div>
        <h3>{module.title}</h3>
        <p>{module.description}</p>
        <a href="/login.html">Go to module -&gt;</a>
      </div>
    </article>
  );
}

function PreviewGraphic({ type }) {
  return (
    <div className={`preview-graphic preview-${type}`} aria-hidden="true">
      <span />
      <span />
      <span />
      <span />
    </div>
  );
}

function FeatureHighlights() {
  return (
    <section className="feature-row" aria-label="Platform highlights">
      {featureItems.map(([title, copy]) => (
        <article key={title}>
          <div className="feature-icon">+</div>
          <h3>{title}</h3>
          <p>{copy}</p>
        </article>
      ))}
    </section>
  );
}

function BranchesSection() {
  return (
    <section className="content-band split-section" id="branches">
      <div className="section-heading">
        <p className="eyebrow">Branches and programs</p>
        <h2>Five locations, one academic operating rhythm</h2>
        <p>
          Norte, Matriz, Sur Guamani, Tumbaco and Conocoto share the same workflows for
          students, teachers, schedules, attendance and director reporting.
        </p>
      </div>
      <div className="branch-grid">
        {branches.map((branch) => (
          <article key={branch.name}>
            <span>{branch.name}</span>
            <p>{branch.focus}</p>
          </article>
        ))}
      </div>
      <div className="program-panel">
        <div>
          <strong>Urban</strong>
          <span>Hip hop, House, Locking, Popping, Waacking, Dancehall, Fem and Heels.</span>
        </div>
        <div>
          <strong>Tropical</strong>
          <span>Salsa and Bachata programs with attendance and progression evidence.</span>
        </div>
        <div>
          <strong>Ethnic</strong>
          <span>Traditional Ecuadorian dance classes tracked by branch and group.</span>
        </div>
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
    <section className="enrollment-band" id="enroll">
      <div className="enrollment-copy">
        <p className="eyebrow">Enrollment request</p>
        <h2>Start with a clean public request, then manage it privately</h2>
        <p>Visitors submit the form here. Directors review each request from the protected API workflow.</p>
      </div>
      <form onSubmit={submit} className="enrollment-form">
        <label>Full name<input name="fullName" autoComplete="name" required /></label>
        <label>Email<input name="email" type="email" autoComplete="email" required /></label>
        <label>Preferred branch<select name="preferredBranch">{branchNames.map((branch) => <option key={branch}>{branch}</option>)}</select></label>
        <label>Style interest<input name="styleInterest" placeholder="Salsa, Hip hop, Bachata" /></label>
        <button type="submit">Submit request -&gt;</button>
        <p className="form-status" aria-live="polite">{status}</p>
      </form>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="site-footer">
      <strong>American Latin Class</strong>
      <span>Attendance, roles, reports, analytics and evidence-ready academic operations.</span>
      <a href="/login.html">Private system -&gt;</a>
    </footer>
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

  return <p className="session-line">{text}</p>;
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
  return <pre>{output ? JSON.stringify(output, null, 2) : 'Run a workflow to see the API response here.'}</pre>;
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
      <p className="eyebrow">Workflow</p>
      <h2>Student attendance</h2>
      <label>Student ID<input name="studentId" defaultValue="85f4bbe9-5d5f-4126-89b6-ddd9de432885" required /></label>
      <label>Class session ID<input name="classSessionId" defaultValue="76f37581-dbbc-4201-bb13-67fbc86f6d60" required /></label>
      <label>Status<select name="status"><option value="present">Present</option><option value="absent">Absent</option><option value="justified">Justified</option><option value="late">Late</option></select></label>
      <button type="submit">Record attendance</button>
    </form>
  );
}

function TeacherCheckInWorkflow({ onOutput }) {
  return (
    <form onSubmit={(event) => submitWorkflow(event, onOutput, '/teacher-attendance/check-in')} className="workflow-panel">
      <p className="eyebrow">Workflow</p>
      <h2>Teacher check-in</h2>
      <label>Teacher ID<input name="teacherId" defaultValue="01c99342-ad47-4c4e-a094-6cab138d98e5" required /></label>
      <label>Class session ID<input name="classSessionId" defaultValue="76f37581-dbbc-4201-bb13-67fbc86f6d60" /></label>
      <button type="submit">Check in</button>
    </form>
  );
}

function ReportsPanel({ output, onOutput }) {
  return (
    <div className="workflow-panel">
      <p className="eyebrow">Live report</p>
      <h2>Branch summary</h2>
      <button type="button" onClick={async () => {
        try {
          onOutput(await apiRequest('/reports/branches/summary'));
        } catch (error) {
          onOutput({ success: false, message: error.message });
        }
      }}>
        Load report
      </button>
      <WorkflowOutput output={output} />
    </div>
  );
}

function PrivateDashboard() {
  const [output, setOutput] = useState(null);

  return (
    <div className="dashboard-shell">
      <div className="promo-bar">Private academic system: authenticated API workflows and branch-scoped data.</div>
      <header className="dashboard-header">
        <nav className="topbar" aria-label="Dashboard navigation">
          <a className="brand" href="/">
            <span className="brand-mark">ALC</span>
            <span>American Latin Class</span>
          </a>
          <div className="nav-links">
            <a href="/">Landing</a>
            <LogoutButton />
          </div>
        </nav>
      </header>
      <main className="dashboard-main">
        <section className="dashboard-hero">
          <div>
            <p className="eyebrow">Private system</p>
            <h1>Academic operations</h1>
            <AuthStatus />
          </div>
          <div className="dashboard-badge">
            <span>Secured</span>
            <strong>JWT + RBAC</strong>
          </div>
        </section>

        <section className="dashboard-grid" aria-label="Private modules">
          {tiles.map((tile) => (
            <article className="dashboard-tile" key={tile}>
              <span>{tile}</span>
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
