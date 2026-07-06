import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { apiRequest, postJson } from './api/client';
import './styles.css';

const branches = [
  { name: 'Norte', focus: 'Dance classes close to the north side of the city.' },
  { name: 'Matriz', focus: 'The central academy for new students and advanced groups.' },
  { name: 'Sur Guamani', focus: 'Urban, tropical and cultural programs for the south branch.' },
  { name: 'Tumbaco', focus: 'Group classes for students building technique and confidence.' },
  { name: 'Conocoto', focus: 'A welcoming branch for Latin rhythm and performance practice.' },
];

const branchNames = branches.map((branch) => branch.name);

const metrics = [
  ['5', 'academy branches'],
  ['3', 'dance families'],
  ['B1-B2', 'student levels'],
  ['12+', 'styles to explore'],
];

const dancePrograms = [
  {
    level: 'Tropical',
    reward: 'partner work',
    title: 'Salsa',
    description: 'Build timing, footwork, musicality and social confidence through Latin rhythm classes.',
    visual: 'attendance',
  },
  {
    level: 'Tropical',
    reward: 'flow',
    title: 'Bachata',
    description: 'Learn body movement, connection and combinations for one of the most loved Latin styles.',
    visual: 'access',
  },
  {
    level: 'Urban',
    reward: 'energy',
    title: 'Hip Hop',
    description: 'Train coordination, grooves, choreographies and stage presence in an energetic class format.',
    visual: 'reports',
  },
  {
    level: 'Urban',
    reward: 'performance',
    title: 'Heels',
    description: 'Develop confidence, lines, balance and expression through performance-focused training.',
    visual: 'scholarship',
  },
  {
    level: 'Urban',
    reward: 'technique',
    title: 'Afro, House and Dancehall',
    description: 'Explore movement foundations, rhythm, stamina and freestyle vocabulary across urban programs.',
    visual: 'levels',
  },
  {
    level: 'Ethnic',
    reward: 'culture',
    title: 'Traditional Ecuadorian Dance',
    description: 'Connect with Ecuadorian cultural expression through group practice and staged routines.',
    visual: 'hours',
  },
];

const featureItems = [
  ['Choose your rhythm', 'Start with tropical, urban or ethnic programs and grow through B1 and B2 levels.'],
  ['Train with purpose', 'Each class is designed to improve technique, confidence, musicality and stage presence.'],
  ['Join a real academy', 'Five branches make it easier to find a location and schedule that fits your routine.'],
];

const tiles = ['Student attendance', 'Teacher check-in', 'Scholarships', 'Level promotion', 'Reports', 'Audit logs'];

function LandingPage() {
  return (
    <>
      <header className="site-hero">
        <div className="promo-bar">Enrollment is open for Salsa, Bachata, Hip Hop, Heels and Ecuadorian dance programs.</div>
        <nav className="topbar" aria-label="Main navigation">
          <a className="brand" href="/">
            <span className="brand-mark">ALC</span>
            <span>American Latin Class</span>
          </a>
          <div className="nav-links">
            <a href="#programs">Programs</a>
            <a href="#branches">Branches</a>
            <a href="#enroll">Enrollment</a>
            <a className="nav-cta" href="/login.html">Staff login</a>
          </div>
        </nav>

        <section className="hero-content" aria-label="American Latin Class dance academy">
          <a className="pill-link" href="#programs">Urban, Tropical and Ethnic dance academy</a>
          <h1>American Latin Class</h1>
          <p>
            Learn salsa, bachata, urban styles and traditional Ecuadorian dance in a professional
            academy with five branches, clear levels and a community built around movement.
          </p>
          <div className="hero-actions">
            <a className="primary-link" href="#enroll">Request enrollment -&gt;</a>
            <a className="secondary-button" href="#programs">Explore programs</a>
          </div>
          <span className="hero-note">Classes for new students, returning dancers and performers ready to level up.</span>
        </section>

        <section className="module-strip" aria-label="Highlighted dance programs">
          {dancePrograms.slice(0, 4).map((program) => <ProgramCard key={program.title} program={program} />)}
        </section>
      </header>

      <main>
        <MetricsBand />
        <ProgramsSection />
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

function ProgramsSection() {
  return (
    <section className="content-band" id="programs">
      <div className="section-heading centered">
        <p className="eyebrow">Dance programs</p>
        <h2>Choose the style that moves you</h2>
        <p>American Latin Class offers tropical, urban and ethnic programs for students who want technique, rhythm and confidence.</p>
      </div>
      <div className="project-grid">
        {dancePrograms.map((program) => <ProgramCard key={program.title} program={program} />)}
      </div>
    </section>
  );
}

function ProgramCard({ program }) {
  return (
    <article className="module-card">
      <PreviewGraphic type={program.visual} />
      <div className="card-body">
        <div className="card-meta">
          <span>{program.level}</span>
          <span>{program.reward}</span>
        </div>
        <h3>{program.title}</h3>
        <p>{program.description}</p>
        <a href="#enroll">Ask about this style -&gt;</a>
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
        <h2>Five locations to start dancing closer to you</h2>
        <p>
          Norte, Matriz, Sur Guamani, Tumbaco and Conocoto welcome students who want
          structured training, friendly groups and consistent dance practice.
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
          <span>Salsa and Bachata programs for rhythm, partner work and social dance confidence.</span>
        </div>
        <div>
          <strong>Ethnic</strong>
          <span>Traditional Ecuadorian dance classes for cultural expression and group performance.</span>
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
        <h2>Tell us where and what you want to dance</h2>
        <p>Send your information and the academy team will contact you about branches, schedules, levels and available programs.</p>
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
      <span>Dance academy with Urban, Tropical and Ethnic programs across five branches.</span>
      <a href="/login.html">Staff login -&gt;</a>
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
