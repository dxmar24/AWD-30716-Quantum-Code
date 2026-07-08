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
const directorRoles = new Set(['Admin', 'GeneralDirector', 'BranchDirector']);
const attendanceWriterRoles = new Set(['Teacher']);

const roleModuleLinks = {
  Admin: [
    ['Cuentas', '#cuentas'],
    ['Seguridad', '#seguridad'],
    ['Auditoría', '#seguridad'],
  ],
  GeneralDirector: [
    ['Indicadores', '#indicadores'],
    ['Cuentas', '#cuentas'],
    ['Reportes', '#reportes'],
  ],
  BranchDirector: [
    ['Mi sede', '#sede'],
    ['Solicitudes', '#solicitudes'],
    ['Reportes', '#reportes'],
  ],
  Teacher: [
    ['Clase de hoy', '#clase'],
    ['Asistencia', '#asistencia'],
    ['Mi entrada', '#entrada'],
  ],
  Student: [
    ['Inicio', '#inicio'],
    ['Asistencia', '#asistencia'],
    ['Justificaciones', '#justificaciones'],
  ],
};

function LandingPage() {
  return (
    <>
      <header className="site-hero">
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
  const [availableBranches, setAvailableBranches] = useState([]);

  useEffect(() => {
    apiRequest('/public/branches')
      .then((payload) => setAvailableBranches(payload.data || []))
      .catch(() => setAvailableBranches([]));
  }, []);

  async function submit(event) {
    event.preventDefault();
    setStatus('');
    try {
      const form = Object.fromEntries(new FormData(event.currentTarget).entries());
      const selectedBranch = availableBranches.find((branch) => branch.id === form.branchId);
      await postJson('/enrollment-requests', {
        fullName:form.fullName,
        email:form.email,
        branchId:form.branchId || undefined,
        preferredBranch:selectedBranch?.name || form.preferredBranch || undefined,
        styleInterest:form.styleInterest || undefined,
      });
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
        <label>Sede de preferencia
          {availableBranches.length ? (
            <select name="branchId">{availableBranches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select>
          ) : (
            <input name="preferredBranch" placeholder="Norte, Matriz, Tumbaco" />
          )}
        </label>
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
  if (!output) return null;

  const success = output.success !== false;
  const message = output.message || (success ? 'La acción se completó correctamente.' : 'No se pudo completar la acción.');

  return (
    <div className={`result-box ${success ? 'success' : 'error'}`} aria-live="polite">
      <strong>{success ? 'Listo' : 'Revisar'}</strong>
      <p>{message}</p>
    </div>
  );
}

function cleanDisplayText(value, fallback = 'Registro académico') {
  const text = String(value || '').trim();
  if (!text) return fallback;
  if (/^ALC\s+(Student|Teacher|Admin|General Director|Branch Director)$/i.test(text)) return fallback;
  return text
    .replace(/\bBRDEMO-\d+\s*/gi, '')
    .replace(/\bREAL-\d+\b/gi, '')
    .replace(/\bValidation\b/gi, '')
    .replace(/\bVerification\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim() || fallback;
}

function cleanAttendanceNote(value) {
  const text = String(value || '').trim();
  if (!text || /role test seed|verification|brdemo/i.test(text)) return 'Registro de asistencia de clase';
  return cleanDisplayText(text, 'Registro de asistencia de clase');
}

function statusLabel(status) {
  return {
    present:'Presente',
    late:'Atraso',
    justified:'Justificado',
    absent:'Ausente',
  }[status] || 'Registrado';
}

function displayUserName(user) {
  return cleanDisplayText(user?.name, roleLabels[user?.role] || 'Usuario');
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

function sessionLabel(session) {
  const startsAt = session.startsAt ? new Date(session.startsAt) : null;
  const time = startsAt && !Number.isNaN(startsAt.getTime())
    ? startsAt.toLocaleString('es-EC', { dateStyle:'short', timeStyle:'short' })
    : 'Horario pendiente';
  return `${cleanDisplayText(session.name, 'Clase programada')} - ${time}`;
}

function TeacherAttendanceSheet({ students, classSessions, onOutput }) {
  const [classSessionId, setClassSessionId] = useState('');
  const [statuses, setStatuses] = useState({});
  const [saving, setSaving] = useState(false);
  const disabled = !students.length || !classSessions.length || saving;

  useEffect(() => {
    if (!classSessionId && classSessions.length) setClassSessionId(classSessions[0].id);
  }, [classSessionId, classSessions]);

  useEffect(() => {
    setStatuses(Object.fromEntries(students.map((student) => [student.id, statuses[student.id] || 'present'])));
  }, [students]);

  function updateStatus(studentId, status) {
    setStatuses((current) => ({ ...current, [studentId]: status }));
  }

  async function submit(event) {
    event.preventDefault();
    if (disabled || !classSessionId) return;
    setSaving(true);
    try {
      let saved = 0;
      for (const student of students) {
        await postJson('/student-attendance', {
          studentId:student.id,
          classSessionId,
          status:statuses[student.id] || 'present',
        });
        saved += 1;
      }
      onOutput({ success:true, message:`Se guardó la asistencia de ${saved} estudiantes.` });
    } catch {
      onOutput({ success:false, message:'No se pudo guardar toda la lista. Revisa si la asistencia ya fue registrada o si la clase fue cerrada.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="academic-panel attendance-sheet" id="asistencia" onSubmit={submit}>
      <p className="eyebrow">Asistencia</p>
      <h2>Lista de clase</h2>
      {disabled && <p className="panel-note">No hay clase o estudiantes disponibles para registrar asistencia.</p>}
      <label>Clase<select value={classSessionId} onChange={(event) => setClassSessionId(event.target.value)} disabled={!classSessions.length}>{classSessions.map((session) => <option key={session.id} value={session.id}>{sessionLabel(session)}</option>)}</select></label>
      <div className="attendance-toolbar">
        <button type="button" className="secondary-action" disabled={!students.length || saving} onClick={() => setStatuses(Object.fromEntries(students.map((student) => [student.id, 'present'])))}>Marcar todos presentes</button>
        <span>{students.length} estudiantes</span>
      </div>
      <ul className="attendance-list">
        {students.slice(0, 28).map((student) => (
          <li key={student.id}>
            <strong>{cleanDisplayText(student.fullName, 'Estudiante')}</strong>
            <select value={statuses[student.id] || 'present'} onChange={(event) => updateStatus(student.id, event.target.value)}>
              <option value="present">Presente</option>
              <option value="late">Atraso</option>
              <option value="absent">Ausente</option>
              <option value="justified">Justificado</option>
            </select>
          </li>
        ))}
      </ul>
      <button type="submit" disabled={disabled}>{saving ? 'Guardando...' : 'Guardar asistencia de la clase'}</button>
    </form>
  );
}

function TeacherCheckInForm({ teachers, classSessions, onOutput }) {
  const disabled = !teachers.length;
  return (
    <form
      onSubmit={(event) => submitAcademicAction(event, onOutput, '/teacher-attendance/check-in', 'Entrada del profesor registrada correctamente.')}
      className="academic-panel"
    >
      <p className="eyebrow">Profesores</p>
      <h2>Mi entrada</h2>
      {disabled && <p className="panel-note">No hay profesores disponibles para registrar entrada.</p>}
      <label>Profesor<select name="teacherId" required disabled={!teachers.length}>{teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{cleanDisplayText(teacher.fullName, 'Profesor')}</option>)}</select></label>
      <label>Clase<select name="classSessionId" disabled={!classSessions.length}><option value="">Sin clase asociada</option>{classSessions.map((session) => <option key={session.id} value={session.id}>{sessionLabel(session)}</option>)}</select></label>
      <button type="submit" disabled={disabled}>Registrar entrada</button>
    </form>
  );
}

function StudentAttendanceHistory({ attendanceRecords }) {
  return (
    <div className="academic-panel" id="asistencia">
      <p className="eyebrow">Mi asistencia</p>
      <h2>Historial reciente</h2>
      {attendanceRecords.length ? (
        <ul className="simple-list">
          {attendanceRecords.slice(0, 6).map((record) => (
            <li key={record.id}>
              <strong>{statusLabel(record.status)}</strong>
              <span>{cleanAttendanceNote(record.notes)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="panel-note">Todavía no tienes registros de asistencia visibles.</p>
      )}
    </div>
  );
}

function StudentJustificationPanel({ attendanceRecords, onOutput }) {
  const absences = attendanceRecords.filter((record) => record.status === 'absent');
  const [submitting, setSubmitting] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (!absences.length || submitting) return;
    setSubmitting(true);
    const form = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      await postJson('/absence-justifications', {
        attendanceRecordId:form.attendanceRecordId,
        reason:form.reason,
        evidenceUrl:form.evidenceUrl || undefined,
      });
      event.currentTarget.reset();
      onOutput({ success:true, message:'Tu justificación fue enviada para revisión.' });
    } catch {
      onOutput({ success:false, message:'No se pudo enviar la justificación. Verifica que la ausencia siga pendiente.' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="academic-panel" id="justificaciones" onSubmit={submit}>
      <p className="eyebrow">Solicitudes</p>
      <h2>Justificar ausencia</h2>
      {absences.length ? (
        <>
          <label>Ausencia<select name="attendanceRecordId" required>{absences.map((record) => <option key={record.id} value={record.id}>{cleanAttendanceNote(record.notes)}</option>)}</select></label>
          <label>Motivo<textarea name="reason" minLength="5" maxLength="500" required placeholder="Explica brevemente el motivo de la ausencia" /></label>
          <label>Evidencia opcional<input name="evidenceUrl" type="url" placeholder="https://..." /></label>
          <button type="submit" disabled={submitting}>{submitting ? 'Enviando...' : 'Enviar justificación'}</button>
        </>
      ) : (
        <p className="panel-note">No tienes ausencias pendientes para justificar.</p>
      )}
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
    </div>
  );
}

const emptyDashboardData = {
  students:[],
  teachers:[],
  classSessions:[],
  attendanceRecords:[],
  absenceJustifications:[],
  enrollmentRequests:[],
  users:[],
};

async function fetchList(path) {
  const payload = await apiRequest(path);
  return payload.data || [];
}

async function loadDashboardData(role) {
  const data = { ...emptyDashboardData };
  const requests = [];

  if (attendanceWriterRoles.has(role)) {
    requests.push(fetchList('/students').then((rows) => { data.students = rows; }));
    requests.push(fetchList('/teachers').then((rows) => { data.teachers = rows; }));
    requests.push(fetchList('/class-sessions').then((rows) => { data.classSessions = rows; }));
  }

  if (directorRoles.has(role)) {
    requests.push(fetchList('/students').then((rows) => { data.students = rows; }));
    requests.push(fetchList('/teachers').then((rows) => { data.teachers = rows; }));
    requests.push(fetchList('/class-sessions').then((rows) => { data.classSessions = rows; }));
    requests.push(fetchList('/absence-justifications').then((rows) => { data.absenceJustifications = rows; }));
    requests.push(fetchList('/enrollment-requests').then((rows) => { data.enrollmentRequests = rows; }));
  }

  if (accountManagerRoles.has(role)) {
    requests.push(fetchList('/users').then((rows) => { data.users = rows; }));
  }

  if (role === 'Student') {
    requests.push(fetchList('/students').then((rows) => { data.students = rows; }));
    requests.push(fetchList('/student-attendance').then((rows) => { data.attendanceRecords = rows; }));
  }

  await Promise.allSettled(requests);
  return data;
}

function dashboardOverview(role) {
  if (role === 'Student') {
    return [
      ['Próxima clase', 'Horario visible según tu perfil académico.'],
      ['Asistencia', 'Consulta estados, ausencias y atrasos registrados.'],
      ['Justificaciones', 'Envía solicitudes solo sobre tus propias ausencias.'],
    ];
  }
  if (role === 'Teacher') {
    return [
      ['Clase de hoy', 'Trabaja solamente con tus clases asignadas.'],
      ['Lista completa', 'Marca la asistencia de la clase en una sola pantalla.'],
      ['Mi entrada', 'Registra tu llegada para la clase correspondiente.'],
    ];
  }
  if (role === 'BranchDirector') {
    return [
      ['Mi sede', 'Supervisa estudiantes, profesores y clases asignadas.'],
      ['Solicitudes', 'Revisa justificaciones pendientes de tu sede.'],
      ['Incidencias', 'Corrige registros solo con motivo y auditoría.'],
    ];
  }
  if (role === 'GeneralDirector') {
    return [
      ['Indicadores', 'Consulta el estado global de sedes y solicitudes.'],
      ['Cuentas', 'Crea accesos institucionales y directores de sede.'],
      ['Reportes', 'Revisa tendencias y decisiones académicas.'],
    ];
  }
  if (role === 'Admin') {
    return [
      ['Accesos', 'Gestiona usuarios, roles y recuperación de cuentas.'],
      ['Configuración', 'Mantén sedes y parámetros técnicos del sistema.'],
      ['Auditoría', 'Consulta actividad sensible para soporte.'],
    ];
  }
  return [
    ['Inicio', 'Resumen del panel académico.'],
  ];
}

function ModuleNavigation({ role }) {
  const links = roleModuleLinks[role] || [['Inicio', '#inicio']];
  return (
    <nav className="module-nav" aria-label="Módulos del panel">
      {links.map(([label, href], index) => <a key={label} className={index === 0 ? 'active' : ''} href={href}>{label}</a>)}
    </nav>
  );
}

function DashboardIntro({ user, data }) {
  const student = data.students[0];
  const teacher = data.teachers[0];
  const profile = user.role === 'Student' ? student : user.role === 'Teacher' ? teacher : null;
  const detail = profile
    ? [roleLabels[user.role], profile.level ? `Nivel ${profile.level}` : null].filter(Boolean).join(' · ')
    : roleLabels[user.role] || 'Usuario autorizado';

  return (
    <section className="dashboard-hero compact" id="inicio">
      <div>
        <p className="eyebrow">Panel académico</p>
        <h1>Buenos días, {displayUserName(user)}</h1>
        <p className="dashboard-copy">{detail}</p>
      </div>
      <div className="dashboard-status">
        <span>Sesión activa</span>
        <strong>{roleLabels[user.role] || 'Usuario'}</strong>
      </div>
    </section>
  );
}

function MetricGrid({ items }) {
  return (
    <section className="metric-grid" aria-label="Indicadores principales">
      {items.map(([value, label]) => (
        <article key={label}>
          <strong>{value}</strong>
          <span>{label}</span>
        </article>
      ))}
    </section>
  );
}

function RoleSummary({ role, data }) {
  if (role === 'Student') {
    const absences = data.attendanceRecords.filter((record) => record.status === 'absent').length;
    const attended = data.attendanceRecords.filter((record) => ['present', 'late', 'justified'].includes(record.status)).length;
    const rate = data.attendanceRecords.length ? Math.round((attended / data.attendanceRecords.length) * 100) : 0;
    return <MetricGrid items={[[data.classSessions[0] ? 'Hoy' : 'Pendiente', 'Próxima clase'], [`${rate}%`, 'Asistencia visible'], [absences, 'Ausencias sin justificar']]} />;
  }
  if (role === 'Teacher') {
    return <MetricGrid items={[[data.classSessions.length, 'Clases visibles'], [data.students.length, 'Estudiantes en lista'], [data.teachers.length ? 'Lista' : 'Pendiente', 'Entrada del profesor']]} />;
  }
  if (role === 'BranchDirector') {
    return <MetricGrid items={[[data.students.length, 'Estudiantes de sede'], [data.teachers.length, 'Profesores de sede'], [data.absenceJustifications.length, 'Justificaciones visibles']]} />;
  }
  if (role === 'GeneralDirector') {
    return <MetricGrid items={[[data.students.length, 'Estudiantes visibles'], [data.enrollmentRequests.length, 'Solicitudes de ingreso'], [data.absenceJustifications.length, 'Justificaciones']]} />;
  }
  if (role === 'Admin') {
    return <MetricGrid items={[[data.users.length, 'Usuarios del sistema'], [data.students.length, 'Perfiles académicos'], ['Activa', 'Auditoría y seguridad']]} />;
  }
  return null;
}

function SupervisorPanel({ role, data }) {
  const isBranch = role === 'BranchDirector';
  return (
    <section className="academic-panel supervisor-panel" id={isBranch ? 'sede' : 'indicadores'}>
      <p className="eyebrow">{isBranch ? 'Supervisión de sede' : 'Dirección académica'}</p>
      <h2>{isBranch ? 'Revisión operativa' : 'Indicadores institucionales'}</h2>
      <ul className="simple-list">
        <li><strong>{data.classSessions.length} clases visibles</strong><span>{isBranch ? 'Revisa clases sin asistencia cerrada y casos pendientes.' : 'Consulta tendencias antes de intervenir procesos.'}</span></li>
        <li><strong>{data.absenceJustifications.length} solicitudes</strong><span>Las aprobaciones deben conservar motivo, fecha y responsable.</span></li>
        <li><strong>Correcciones auditadas</strong><span>Las asistencias o entradas no se registran como tarea cotidiana desde este panel.</span></li>
      </ul>
    </section>
  );
}

function AdminSecurityPanel({ data }) {
  return (
    <section className="academic-panel" id="seguridad">
      <p className="eyebrow">Seguridad</p>
      <h2>Administración técnica</h2>
      <ul className="simple-list">
        <li><strong>{data.users.length} usuarios</strong><span>Gestiona accesos, roles y recuperación de cuentas.</span></li>
        <li><strong>Separación académica</strong><span>Las decisiones de asistencia, becas y promociones quedan fuera de la operación normal del administrador.</span></li>
        <li><strong>Auditoría</strong><span>Todo cambio sensible debe mantener trazabilidad institucional.</span></li>
      </ul>
    </section>
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
    if (form.role === 'BranchDirector') body.branchIds = formData.getAll('branchIds');
    if (form.role === 'Student') {
      body.studentProfile = {
        branchId:form.branchId,
        fullName:form.name,
        level:form.level || 'B1',
      };
    }
    if (form.role === 'Teacher') {
      body.teacherProfile = {
        branchId:form.branchId,
        fullName:form.name,
      };
      if (form.hourlyRate) body.teacherProfile.hourlyRate = Number(form.hourlyRate);
    }

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
    <section className="academic-panel account-panel" id="cuentas" aria-label="Creación de cuentas">
      <div>
        <p className="eyebrow">Cuentas</p>
        <h2>Enviar invitación de acceso</h2>
        <p>Registra a una persona autorizada. El sistema generará una clave temporal de un solo uso para su primer ingreso.</p>
      </div>
      <form className="account-form" onSubmit={submit}>
        <label>Nombre completo<input name="name" autoComplete="name" required /></label>
        <label>Correo electrónico<input name="email" type="email" autoComplete="email" required /></label>
        <label>Rol<select name="role" value={selectedRole} onChange={(event) => setSelectedRole(event.target.value)} required>{accountRoleOptions.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}</select></label>
        {(selectedRole === 'Student' || selectedRole === 'Teacher') && (
          <label>Sede
            <select name="branchId" required>
              <option value="">Selecciona una sede</option>
              {availableBranches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
          </label>
        )}
        {selectedRole === 'Student' && (
          <label>Nivel
            <select name="level" defaultValue="B1">
              <option value="B1">B1</option>
              <option value="B2">B2</option>
            </select>
          </label>
        )}
        {selectedRole === 'Teacher' && (
          <label>Tarifa por hora<input name="hourlyRate" type="number" min="0" step="0.01" placeholder="12.50" /></label>
        )}
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
        <button type="submit">Generar invitación</button>
      </form>
      {createdAccount && (
        <div className="credential-box" aria-live="polite">
          <span>Clave temporal generada</span>
          <strong>{createdAccount.temporaryPassword}</strong>
          <p>Esta clave se muestra una sola vez. La persona deberá cambiarla en su primer ingreso.</p>
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
  const [dashboardData, setDashboardData] = useState(emptyDashboardData);
  const [dashboardLoading, setDashboardLoading] = useState(false);

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

  useEffect(() => {
    if (!sessionReady || !currentUser || currentUser.mustChangePassword) return undefined;
    let mounted = true;
    setDashboardLoading(true);
    loadDashboardData(currentUser.role)
      .then((data) => {
        if (mounted) setDashboardData(data);
      })
      .finally(() => {
        if (mounted) setDashboardLoading(false);
      });
    return () => { mounted = false; };
  }, [sessionReady, currentUser?.role, currentUser?.mustChangePassword]);

  return (
    <div className="dashboard-shell">
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
            <DashboardIntro user={currentUser} data={dashboardData} />
            <ModuleNavigation role={currentUser.role} />
            {dashboardLoading && <p className="panel-note">Cargando información académica...</p>}
            <RoleSummary role={currentUser.role} data={dashboardData} />

            <section className="attendance-grid" aria-label="Módulos del panel">
              {currentUser.role === 'Student' && <StudentAttendanceHistory attendanceRecords={dashboardData.attendanceRecords} />}
              {currentUser.role === 'Student' && <StudentJustificationPanel attendanceRecords={dashboardData.attendanceRecords} onOutput={setOutput} />}

              {currentUser.role === 'Teacher' && (
                <TeacherAttendanceSheet students={dashboardData.students} classSessions={dashboardData.classSessions} onOutput={setOutput} />
              )}
              {currentUser.role === 'Teacher' && (
                <TeacherCheckInForm teachers={dashboardData.teachers} classSessions={dashboardData.classSessions} onOutput={setOutput} />
              )}

              {currentUser.role === 'BranchDirector' && <SupervisorPanel role={currentUser.role} data={dashboardData} />}
              {currentUser.role === 'GeneralDirector' && <SupervisorPanel role={currentUser.role} data={dashboardData} />}
              {currentUser.role === 'Admin' && <AdminSecurityPanel data={dashboardData} />}
              {accountManagerRoles.has(currentUser.role) && <AccountCreationPanel />}
              {directorRoles.has(currentUser.role) && currentUser.role !== 'Admin' && <ReportsPanel output={output} onOutput={setOutput} />}
              <FriendlyOutput output={output} />
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
