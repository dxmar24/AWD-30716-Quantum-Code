import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { apiRequest, postJson } from './api/client';
import './styles.css';

const branches = [
  { name: 'Norte', focus: 'Clases cerca del norte de la ciudad, con grupos para iniciar o retomar el entrenamiento.' },
  { name: 'Matriz', focus: 'Sede principal para estudiantes nuevos, niveles activos y grupos de mayor continuidad.' },
  { name: 'Sur Guamaní', focus: 'Programas tropicales, urbanos y culturales para estudiantes del sur de Quito.' },
  { name: 'Tumbaco', focus: 'Entrenamientos grupales para mejorar técnica, seguridad y constancia.' },
  { name: 'Conocoto', focus: 'Espacio cercano para práctica de ritmos latinos, montaje y expresión escénica.' },
];

const branchNames = branches.map((branch) => branch.name);

const metrics = [
  ['5', 'sedes activas'],
  ['3', 'líneas de baile'],
  ['B1 - B2', 'niveles académicos'],
  ['12+', 'estilos disponibles'],
];

const dancePrograms = [
  {
    level: 'Tropical',
    title: 'Salsa',
    description: 'Ritmo, coordinación, musicalidad, trabajo en pareja y confianza social.',
  },
  {
    level: 'Tropical',
    title: 'Bachata',
    description: 'Movimiento corporal, conexión, secuencias y expresión dentro del estilo.',
  },
  {
    level: 'Urbano',
    title: 'Hip Hop',
    description: 'Grooves, coreografía, presencia escénica y entrenamiento físico.',
  },
  {
    level: 'Urbano',
    title: 'Heels',
    description: 'Líneas, balance, seguridad, actitud y puesta en escena.',
  },
  {
    level: 'Urbano',
    title: 'Afro, House y Dancehall',
    description: 'Fundamentos, resistencia, vocabulario de movimiento y freestyle.',
  },
  {
    level: 'Étnico',
    title: 'Danza tradicional ecuatoriana',
    description: 'Expresión cultural, trabajo grupal, coordinación y montaje escénico.',
  },
];

const accessItems = [
  ['Director general', 'visión general de sedes, asistencia, reportes y seguimiento académico'],
  ['Director de sede', 'control de estudiantes, profesores, clases y registros de su sede'],
  ['Profesor', 'registro de entrada, asistencia de clase y seguimiento de grupos'],
  ['Estudiante', 'información de asistencia, nivel y solicitudes académicas'],
];

const roleLabels = {
  Admin: 'Administrador',
  GeneralDirector: 'Director general',
  BranchDirector: 'Director de sede',
  Teacher: 'Profesor',
  Student: 'Estudiante',
  Visitor: 'Visitante',
};

const accountRoleOptions = [
  { value: 'Student', label: 'Estudiante' },
  { value: 'Teacher', label: 'Profesor' },
  { value: 'BranchDirector', label: 'Director de sede' },
  { value: 'GeneralDirector', label: 'Director general' },
];

const accountManagerRoles = new Set(['Admin', 'GeneralDirector']);

const studentOptions = [
  {
    value: '85f4bbe9-5d5f-4126-89b6-ddd9de432885',
    label: 'Camila Rojas - Salsa B1',
  },
];

const teacherOptions = [
  {
    value: '01c99342-ad47-4c4e-a094-6cab138d98e5',
    label: 'Isabella Torres - Profesora de salsa',
  },
];

const classSessionOptions = [
  {
    value: '76f37581-dbbc-4201-bb13-67fbc86f6d60',
    label: 'Salsa B1 - Matriz - 18:00',
  },
];

function LandingPage() {
  return (
    <>
      <header className="site-hero">
        <div className="promo-bar">Inscripciones abiertas para Salsa, Bachata, Hip Hop, Heels y Danza tradicional ecuatoriana.</div>
        <nav className="topbar" aria-label="Navegación principal">
          <a className="brand" href="/">
            <span className="brand-mark">ALC</span>
            <span>American Latin Class</span>
          </a>
          <div className="nav-links">
            <a href="#programs">Programas</a>
            <a href="#branches">Sedes</a>
            <a href="#enroll">Inscripción</a>
            <a className="nav-cta" href="/login.html">Ingresar</a>
          </div>
        </nav>

        <section className="hero-content" aria-label="Academia de baile American Latin Class">
          <span className="pill-link">Academia de baile urbano, tropical y étnico</span>
          <h1>Muévete con técnica, ritmo y propósito</h1>
          <p>
            American Latin Class acompaña a estudiantes, profesores y sedes con una experiencia clara:
            clases organizadas, niveles definidos y seguimiento académico sin complicaciones.
          </p>
          <div className="hero-actions">
            <a className="primary-link" href="#enroll">Solicitar inscripción</a>
            <a className="secondary-button" href="#programs">Ver programas</a>
          </div>
          <span className="hero-note">Formación para nuevos estudiantes, bailarines en proceso y grupos de presentación.</span>
        </section>
      </header>

      <main>
        <MetricsBand />
        <ProgramsSection />
        <AccessSection />
        <BranchesSection />
        <EnrollmentForm />
      </main>
      <SiteFooter />
    </>
  );
}

function LoginPage() {
  const buttonRef = useRef(null);
  const [status, setStatus] = useState('Cargando ingreso con Google...');
  const [passwordStatus, setPasswordStatus] = useState('');

  async function submitPasswordLogin(event) {
    event.preventDefault();
    setPasswordStatus('Verificando datos...');
    try {
      const form = Object.fromEntries(new FormData(event.currentTarget).entries());
      await postJson('/auth/login', form);
      window.location.href = '/private/dashboard.html';
    } catch {
      setPasswordStatus('No se pudo iniciar sesión. Revisa el correo y la contraseña.');
    }
  }

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
            setStatus('Iniciando sesión...');
            try {
              await postJson('/auth/google', { idToken: response.credential });
              window.location.href = '/private/dashboard.html';
            } catch {
              setStatus('No se pudo iniciar sesión con Google. El correo debe estar registrado en la academia.');
            }
          },
        });

        window.google.accounts.id.renderButton(buttonRef.current, {
          theme: 'outline',
          size: 'large',
          type: 'standard',
          width: 280,
        });
        setStatus(new URLSearchParams(window.location.search).has('session') ? 'Tu sesión terminó. Ingresa nuevamente.' : '');
      } catch {
        setStatus('El ingreso con Google no está disponible por el momento.');
      }
    }

    loadGoogleSignIn();
    return () => { mounted = false; };
  }, []);

  return (
    <main className="login-page">
      <nav className="floating-nav" aria-label="Navegación de ingreso">
        <a className="brand" href="/">
          <span className="brand-mark">ALC</span>
          <span>American Latin Class</span>
        </a>
        <a className="secondary-button compact" href="/">Volver al inicio</a>
      </nav>
      <section className="login-panel" aria-label="Ingreso al panel interno">
        <p className="eyebrow">Panel interno</p>
        <h1>Ingreso del equipo ALC</h1>
        <p className="login-copy">Accede con el correo registrado por la academia y tu contraseña.</p>
        <form className="password-login-form" onSubmit={submitPasswordLogin}>
          <label>Correo electrónico<input name="email" type="email" autoComplete="email" required /></label>
          <label>Contraseña<input name="password" type="password" autoComplete="current-password" required /></label>
          <button type="submit">Ingresar al panel</button>
          <p className="form-status" aria-live="polite">{passwordStatus}</p>
        </form>
        <div className="login-divider"><span>o continúa con Google</span></div>
        <div className="google-button" ref={buttonRef} />
        <p className="form-status" aria-live="polite">{status}</p>
      </section>
    </main>
  );
}

function MetricsBand() {
  return (
    <section className="metrics-band" aria-label="Resumen de la academia">
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
    <section className="content-band programs-band" id="programs">
      <div className="section-heading centered">
        <p className="eyebrow">Programas</p>
        <h2>Elige tu línea de baile</h2>
        <p>Los programas se presentan de forma simple para que cada estudiante encuentre su estilo, sede y nivel.</p>
      </div>
      <div className="program-list">
        {dancePrograms.map((program) => <ProgramRow key={program.title} program={program} />)}
      </div>
    </section>
  );
}

function ProgramRow({ program }) {
  return (
    <article className="program-row">
      <span>{program.level}</span>
      <h3>{program.title}</h3>
      <p>{program.description}</p>
      <a href="#enroll">Consultar</a>
    </article>
  );
}

function AccessSection() {
  return (
    <section className="feature-row" aria-label="Acceso por tipo de usuario">
      <div className="section-heading">
        <p className="eyebrow">Panel académico</p>
        <h2>Información visible según cada rol</h2>
      </div>
      <div className="access-list">
        {accessItems.map(([role, copy]) => (
          <article key={role}>
            <strong>{role}</strong>
            <p>{copy}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function BranchesSection() {
  return (
    <section className="content-band split-section" id="branches">
      <div className="section-heading">
        <p className="eyebrow">Sedes</p>
        <h2>Cinco ubicaciones para entrenar más cerca de ti</h2>
        <p>
          Norte, Matriz, Sur Guamaní, Tumbaco y Conocoto reciben estudiantes que buscan
          entrenamiento constante, grupos organizados y una comunidad activa de baile.
        </p>
      </div>
      <div className="branch-list">
        {branches.map((branch) => (
          <article key={branch.name}>
            <span>{branch.name}</span>
            <p>{branch.focus}</p>
          </article>
        ))}
      </div>
      <div className="program-panel">
        <div>
          <strong>Urbano</strong>
          <span>Hip Hop, House, Locking, Popping, Waacking, Dancehall, Fem y Heels.</span>
        </div>
        <div>
          <strong>Tropical</strong>
          <span>Salsa y Bachata para ritmo, trabajo en pareja y confianza social.</span>
        </div>
        <div>
          <strong>Étnico</strong>
          <span>Danza tradicional ecuatoriana para expresión cultural y montaje grupal.</span>
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
      setStatus('Solicitud registrada. El equipo de la academia se comunicará contigo.');
    } catch {
      setStatus('No se pudo registrar la solicitud. Intenta nuevamente.');
    }
  }

  return (
    <section className="enrollment-band" id="enroll">
      <div className="enrollment-copy">
        <p className="eyebrow">Inscripción</p>
        <h2>Cuéntanos qué quieres bailar</h2>
        <p>Envía tus datos para recibir información sobre sedes, horarios, niveles y programas disponibles.</p>
      </div>
      <form onSubmit={submit} className="enrollment-form">
        <label>Nombre completo<input name="fullName" autoComplete="name" required /></label>
        <label>Correo electrónico<input name="email" type="email" autoComplete="email" required /></label>
        <label>Sede de preferencia<select name="preferredBranch">{branchNames.map((branch) => <option key={branch}>{branch}</option>)}</select></label>
        <label>Estilo de interés<input name="styleInterest" placeholder="Salsa, Hip Hop, Bachata" /></label>
        <button type="submit">Enviar solicitud</button>
        <p className="form-status" aria-live="polite">{status}</p>
      </form>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="site-footer">
      <strong>American Latin Class</strong>
      <span>Academia de baile urbano, tropical y étnico en cinco sedes.</span>
      <a href="/login.html">Ingresar al panel</a>
    </footer>
  );
}

function AuthStatus({ user }) {
  return <p className="session-line">{user ? `${user.name} · ${roleLabels[user.role] || 'Usuario autorizado'}` : 'Verificando sesión...'}</p>;
}

function LogoutButton() {
  async function logout(event) {
    event.preventDefault();
    await apiRequest('/auth/logout', { method: 'POST' }).catch(() => null);
    window.location.href = '/login.html?session=logout';
  }

  return <a href="/login.html" onClick={logout}>Cerrar sesión</a>;
}

function FriendlyOutput({ output }) {
  if (!output) {
    return <p className="result-box">Aquí aparecerá la confirmación de la última acción realizada.</p>;
  }

  const success = output.success !== false;
  const message = output.message || (success ? 'La acción se completó correctamente.' : 'No se pudo completar la acción.');

  return (
    <div className={`result-box ${success ? 'success' : 'error'}`} aria-live="polite">
      <strong>{success ? 'Listo' : 'Revisar'}</strong>
      <p>{message}</p>
    </div>
  );
}

async function submitAcademicAction(event, onOutput, path, successMessage) {
  event.preventDefault();
  try {
    await postJson(path, Object.fromEntries(new FormData(event.currentTarget).entries()));
    onOutput({ success: true, message: successMessage });
  } catch {
    onOutput({ success: false, message: 'No se pudo completar la acción. Revisa los datos e intenta nuevamente.' });
  }
}

function StudentAttendanceForm({ onOutput }) {
  return (
    <form
      onSubmit={(event) => submitAcademicAction(event, onOutput, '/student-attendance', 'Asistencia registrada correctamente.')}
      className="academic-panel"
    >
      <p className="eyebrow">Asistencia</p>
      <h2>Registrar estudiante</h2>
      <label>Estudiante<select name="studentId" required>{studentOptions.map((student) => <option key={student.value} value={student.value}>{student.label}</option>)}</select></label>
      <label>Clase<select name="classSessionId" required>{classSessionOptions.map((session) => <option key={session.value} value={session.value}>{session.label}</option>)}</select></label>
      <label>Estado<select name="status"><option value="present">Presente</option><option value="absent">Ausente</option><option value="justified">Justificado</option><option value="late">Atraso</option></select></label>
      <button type="submit">Guardar asistencia</button>
    </form>
  );
}

function TeacherCheckInForm({ onOutput }) {
  return (
    <form
      onSubmit={(event) => submitAcademicAction(event, onOutput, '/teacher-attendance/check-in', 'Entrada del profesor registrada correctamente.')}
      className="academic-panel"
    >
      <p className="eyebrow">Profesores</p>
      <h2>Marcar entrada</h2>
      <label>Profesor<select name="teacherId" required>{teacherOptions.map((teacher) => <option key={teacher.value} value={teacher.value}>{teacher.label}</option>)}</select></label>
      <label>Clase<select name="classSessionId">{classSessionOptions.map((session) => <option key={session.value} value={session.value}>{session.label}</option>)}</select></label>
      <button type="submit">Registrar entrada</button>
    </form>
  );
}

function ReportsPanel({ output, onOutput }) {
  return (
    <div className="academic-panel reports-panel">
      <p className="eyebrow">Reportes</p>
      <h2>Resumen por sede</h2>
      <p>Consulta el estado general de las sedes para revisar asistencia y seguimiento académico.</p>
      <button type="button" onClick={async () => {
        try {
          await apiRequest('/reports/branches/summary');
          onOutput({ success: true, message: 'Resumen de sedes actualizado para revisión académica.' });
        } catch {
          onOutput({ success: false, message: 'No se pudo cargar el resumen. Intenta nuevamente.' });
        }
      }}>
        Cargar resumen
      </button>
      <FriendlyOutput output={output} />
    </div>
  );
}

function AccountCreationPanel() {
  const [status, setStatus] = useState('');
  const [createdAccount, setCreatedAccount] = useState(null);
  const [selectedRole, setSelectedRole] = useState('Student');
  const [availableBranches, setAvailableBranches] = useState([]);

  useEffect(() => {
    apiRequest('/branches')
      .then((payload) => setAvailableBranches(payload.data || []))
      .catch(() => setAvailableBranches([]));
  }, []);

  async function submit(event) {
    event.preventDefault();
    setStatus('');
    setCreatedAccount(null);
    const formData = new FormData(event.currentTarget);
    const form = Object.fromEntries(formData.entries());
    const body = {
      name:form.name,
      email:form.email,
      role:form.role,
    };
    if (form.temporaryPassword) body.temporaryPassword = form.temporaryPassword;
    if (form.role === 'BranchDirector') body.branchIds = formData.getAll('branchIds');

    try {
      const payload = await postJson('/users', body);
      setCreatedAccount(payload.data);
      setStatus('Cuenta creada correctamente.');
      event.currentTarget.reset();
      setSelectedRole('Student');
    } catch {
      setStatus('No se pudo crear la cuenta. Revisa el correo, el rol y las sedes asignadas.');
    }
  }

  return (
    <section className="academic-panel account-panel" aria-label="Creación de cuentas">
      <div>
        <p className="eyebrow">Cuentas</p>
        <h2>Crear cuenta de academia</h2>
        <p>Registra a una persona autorizada y entrega la contraseña temporal por el canal de la academia.</p>
      </div>
      <form className="account-form" onSubmit={submit}>
        <label>Nombre completo<input name="name" autoComplete="name" required /></label>
        <label>Correo electrónico<input name="email" type="email" autoComplete="email" required /></label>
        <label>Rol<select name="role" value={selectedRole} onChange={(event) => setSelectedRole(event.target.value)} required>{accountRoleOptions.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}</select></label>
        <label>Contraseña temporal opcional<input name="temporaryPassword" type="password" autoComplete="new-password" placeholder="La academia puede generarla" /></label>
        {selectedRole === 'BranchDirector' && (
          <fieldset className="branch-checkbox-list">
            <legend>Sedes asignadas</legend>
            {availableBranches.length ? availableBranches.map((branch) => (
              <label key={branch.id}>
                <input name="branchIds" type="checkbox" value={branch.id} />
                <span>{branch.name}</span>
              </label>
            )) : <p>No se pudieron cargar las sedes. Intenta nuevamente más tarde.</p>}
          </fieldset>
        )}
        <button type="submit">Crear cuenta</button>
      </form>
      {createdAccount && (
        <div className="credential-box" aria-live="polite">
          <span>Contraseña temporal</span>
          <strong>{createdAccount.temporaryPassword}</strong>
          <p>Esta contraseña se muestra una sola vez. La persona deberá cambiarla en su primer ingreso.</p>
        </div>
      )}
      <p className="form-status" aria-live="polite">{status}</p>
    </section>
  );
}

function PasswordChangeRequired({ user, onChanged }) {
  const [status, setStatus] = useState('');

  async function submit(event) {
    event.preventDefault();
    setStatus('');
    const form = Object.fromEntries(new FormData(event.currentTarget).entries());
    if (form.newPassword !== form.confirmPassword) {
      setStatus('La nueva contraseña y la confirmación no coinciden.');
      return;
    }
    try {
      const payload = await postJson('/auth/change-password', {
        currentPassword:form.currentPassword,
        newPassword:form.newPassword,
      });
      onChanged(payload.data.user);
    } catch {
      setStatus('No se pudo actualizar la contraseña. Revisa la contraseña temporal e intenta nuevamente.');
    }
  }

  return (
    <section className="password-required-panel" aria-label="Cambio obligatorio de contraseña">
      <div>
        <p className="eyebrow">Primer ingreso</p>
        <h1>Actualiza tu contraseña</h1>
        <p className="dashboard-copy">
          Hola, {user.name}. Para proteger tu cuenta debes cambiar la contraseña temporal antes de usar el panel privado.
        </p>
      </div>
      <form className="password-change-form" onSubmit={submit}>
        <label>Contraseña temporal<input name="currentPassword" type="password" autoComplete="current-password" required /></label>
        <label>Nueva contraseña<input name="newPassword" type="password" autoComplete="new-password" required /></label>
        <label>Confirmar nueva contraseña<input name="confirmPassword" type="password" autoComplete="new-password" required /></label>
        <button type="submit">Guardar nueva contraseña</button>
        <p className="form-status" aria-live="polite">{status}</p>
      </form>
    </section>
  );
}

function PrivateDashboard() {
  const [output, setOutput] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    apiRequest('/auth/me')
      .then((payload) => {
        setCurrentUser(payload.data.user);
        setSessionReady(true);
      })
      .catch(() => {
        window.location.href = '/login.html?session=expired';
      });
  }, []);

  return (
    <div className="dashboard-shell">
      <div className="promo-bar">Panel interno de American Latin Class</div>
      <header className="dashboard-header">
        <nav className="topbar" aria-label="Navegación del panel">
          <a className="brand" href="/">
            <span className="brand-mark">ALC</span>
            <span>American Latin Class</span>
          </a>
          <div className="nav-links">
            <a href="/">Inicio</a>
            <LogoutButton />
          </div>
        </nav>
      </header>
      <main className="dashboard-main">
        {!sessionReady && (
          <section className="dashboard-hero">
            <div>
              <p className="eyebrow">Panel académico</p>
              <h1>Verificando sesión</h1>
              <p className="dashboard-copy">Estamos preparando tu acceso privado.</p>
            </div>
          </section>
        )}

        {sessionReady && currentUser?.mustChangePassword && (
          <PasswordChangeRequired user={currentUser} onChanged={setCurrentUser} />
        )}

        {sessionReady && currentUser && !currentUser.mustChangePassword && (
          <>
          <section className="dashboard-hero">
          <div>
            <p className="eyebrow">Gestión académica</p>
            <h1>Panel académico</h1>
            <p className="dashboard-copy">Registra asistencia, revisa sedes y mantén el seguimiento de clases en un solo lugar.</p>
            <AuthStatus user={currentUser} />
          </div>
          <div className="dashboard-badge">
            <span>Sesión activa</span>
            <strong>Acceso autorizado</strong>
          </div>
        </section>

        <section className="overview-list" aria-label="Opciones del panel">
          <article><span>Estudiantes</span><p>Asistencia, estados y seguimiento académico.</p></article>
          <article><span>Profesores</span><p>Entradas, clases asignadas y horas registradas.</p></article>
          <article><span>Sedes</span><p>Resumen de actividad por ubicación.</p></article>
          <article><span>Solicitudes</span><p>Becas, justificaciones y promociones de nivel.</p></article>
        </section>

        <section className="attendance-grid" aria-label="Acciones de asistencia">
          {accountManagerRoles.has(currentUser.role) && <AccountCreationPanel />}
          <StudentAttendanceForm onOutput={setOutput} />
          <TeacherCheckInForm onOutput={setOutput} />
          <ReportsPanel output={output} onOutput={setOutput} />
        </section>
          </>
        )}
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
