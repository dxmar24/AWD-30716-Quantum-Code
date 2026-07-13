import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { apiRequest, patchJson, postJson, putJson } from './api/client';
import './styles.css';

const branches = [
  {
    name: 'Matriz',
    color: '#facc15',
    short: 'Sede principal',
    focus: 'Punto central para nuevos estudiantes, grupos activos y procesos de mayor continuidad.',
  },
  {
    name: 'Norte',
    color: '#60a5fa',
    short: 'Entrenamiento cercano',
    focus: 'Clases cerca del norte de la ciudad para iniciar, retomar o fortalecer el entrenamiento.',
  },
  {
    name: 'Sur Guamaní',
    color: '#fb923c',
    short: 'Movimiento del sur',
    focus: 'Programas tropicales, urbanos y culturales para estudiantes del sur de Quito.',
  },
  {
    name: 'Tumbaco',
    color: '#a78bfa',
    short: 'Constancia y técnica',
    focus: 'Entrenamientos grupales para mejorar técnica, seguridad y disciplina escénica.',
  },
  {
    name: 'Conocoto',
    color: '#f472b6',
    short: 'Comunidad y práctica',
    focus: 'Espacio cercano para ritmos latinos, montaje, práctica y expresión escénica.',
  },
];

const heroPhotos = [
  '/assets/hero-dance-1.jpg',
  '/assets/hero-dance-2.jpg',
  '/assets/hero-dance-3.jpg',
  '/assets/hero-dance-4.jpg',
];

const metrics = [
  { value: '5', label: 'sedes activas', icon: 'branches' },
  { value: '3', label: 'líneas de baile', icon: 'programs' },
  { value: 'B1 - B2', label: 'niveles académicos', icon: 'levels' },
  { value: '12+', label: 'estilos disponibles', icon: 'styles' },
];

const dancePrograms = [
  {
    level: 'Tropical',
    title: 'Salsa',
    image: '/assets/program-salsa.jpg',
    description: 'Ritmo, coordinación, musicalidad, trabajo en pareja y confianza social.',
  },
  {
    level: 'Tropical',
    title: 'Bachata',
    image: '/assets/program-bachata.jpg',
    description: 'Movimiento corporal, conexión, secuencias y expresión dentro del estilo.',
  },
  {
    level: 'Urbano',
    title: 'Hip Hop',
    image: '/assets/program-hiphop.jpg',
    description: 'Grooves, coreografía, presencia escénica y entrenamiento físico.',
  },
  {
    level: 'Urbano',
    title: 'Heels',
    image: '/assets/program-heels.jpg',
    description: 'Líneas, balance, seguridad, actitud y puesta en escena.',
  },
  {
    level: 'Urbano',
    title: 'Afro, House y Dancehall',
    image: '/assets/program-afro.jpg',
    description: 'Fundamentos, resistencia, vocabulario de movimiento y freestyle.',
  },
  {
    level: 'Étnico',
    title: 'Danza tradicional ecuatoriana',
    image: '/assets/program-ecuador.jpg',
    description: 'Expresión cultural, trabajo grupal, coordinación y montaje escénico.',
  },
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
    { id:'indicadores', label:'Indicadores' },
    { id:'cuentas', label:'Cuentas' },
    { id:'academia', label:'Academia' },
    { id:'eventos', label:'Eventos' },
    { id:'solicitudes', label:'Solicitudes' },
    { id:'reportes', label:'Reportes' },
    { id:'seguridad', label:'Seguridad' },
    { id:'auditoria', label:'Auditoría' },
  ],
  GeneralDirector: [
    { id:'indicadores', label:'Indicadores' },
    { id:'cuentas', label:'Cuentas' },
    { id:'academia', label:'Operación' },
    { id:'eventos', label:'Eventos' },
    { id:'solicitudes', label:'Solicitudes' },
    { id:'reportes', label:'Reportes' },
    { id:'auditoria', label:'Auditoría' },
  ],
  BranchDirector: [
    { id:'sede', label:'Mi sede' },
    { id:'academia', label:'Operación' },
    { id:'eventos', label:'Eventos' },
    { id:'solicitudes', label:'Solicitudes' },
    { id:'reportes', label:'Reportes' },
  ],
  Teacher: [
    { id:'clase', label:'Clase de hoy' },
    { id:'asistencia', label:'Asistencia' },
    { id:'entrada', label:'Mi entrada' },
  ],
  Student: [
    { id:'inicio', label:'Inicio' },
    { id:'perfil', label:'Perfil' },
    { id:'asistencia', label:'Asistencia' },
    { id:'justificaciones', label:'Justificaciones' },
    { id:'pagos', label:'Pagos' },
    { id:'eventos', label:'Eventos' },
  ],
};

const ACADEMY_TIME_ZONE = 'America/Guayaquil';
const ATTENDANCE_OPTIONS = [
  { value:'present', label:'Presente' },
  { value:'late', label:'Atraso' },
  { value:'absent', label:'Ausente' },
];
const LEAD_STATUS_OPTIONS = [
  { value:'pending', label:'Pendiente' },
  { value:'contacted', label:'Contactado' },
  { value:'trial_scheduled', label:'Clase de prueba' },
  { value:'enrolled', label:'Inscrito' },
  { value:'lost', label:'No continúa' },
];
const LEAD_TRANSITIONS = {
  pending:['pending', 'contacted', 'lost'],
  contacted:['contacted', 'trial_scheduled', 'enrolled', 'lost'],
  trial_scheduled:['trial_scheduled', 'contacted', 'enrolled', 'lost'],
  enrolled:['enrolled'],
  lost:['lost'],
};

function errorMessage(error, fallback = 'No se pudo completar la acción.') {
  if (error?.status === 404) return 'Esta función todavía no está disponible en el servidor. No se modificó ningún dato.';
  if (error?.status === 409) return error.message || 'El registro cambió o ya fue procesado. Actualiza la información antes de intentar nuevamente.';
  if (error?.status === 403) return 'Tu cuenta no tiene permiso para realizar esta acción.';
  return error?.message || fallback;
}

function usePrefersReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  ));

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!media) return undefined;
    const update = () => setReducedMotion(media.matches);
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);

  return reducedMotion;
}

function LandingPage() {
  const heroRef = useRef(null);
  const [heroInView, setHeroInView] = useState(true);

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero || typeof IntersectionObserver === 'undefined') return undefined;

    const observer = new IntersectionObserver(([entry]) => {
      setHeroInView(entry.isIntersecting && entry.intersectionRatio > 0.35);
    }, { threshold: [0, 0.35, 0.7] });

    observer.observe(hero);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <a className="skip-link" href="#main-content">Saltar al contenido principal</a>
      <header className={`site-hero ${heroInView ? 'hero-playing' : 'hero-paused'}`} ref={heroRef}>
        <div className="hero-slider" aria-hidden="true">
          <div className="hero-track">
            {heroPhotos.map((photo) => <div className="hero-frame" key={photo} style={{ backgroundImage:`url(${photo})` }} />)}
          </div>
        </div>

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

      <main id="main-content">
        <MetricsBand />
        <ProgramsSection />
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
  const [submitting, setSubmitting] = useState(false);

  async function submitPasswordLogin(event) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setPasswordStatus('Verificando datos...');
    try {
      const form = Object.fromEntries(new FormData(event.currentTarget).entries());
      await postJson('/auth/login', form);
      window.location.href = '/private/dashboard.html';
    } catch (error) {
      setPasswordStatus(error?.status === 401
        ? 'No se pudo iniciar sesión. Revisa el correo y la contraseña.'
        : errorMessage(error, 'No se pudo iniciar sesión.'));
    } finally {
      setSubmitting(false);
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
    <main className="login-page" id="main-content" aria-busy={submitting}>
      <a className="skip-link" href="#login-form">Saltar al formulario de ingreso</a>
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
        <form className="password-login-form" id="login-form" onSubmit={submitPasswordLogin}>
          <label>Correo electrónico<input name="email" type="email" autoComplete="email" required /></label>
          <label>Contraseña<input name="password" type="password" autoComplete="current-password" required /></label>
          <button type="submit" disabled={submitting}>{submitting ? 'Ingresando...' : 'Ingresar al panel'}</button>
          <p className="form-status" role="status" aria-live="polite">{passwordStatus}</p>
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
      {metrics.map(({ value, label, icon }) => (
        <article key={label}>
          <div className="metric-symbol">
            <MetricIcon type={icon} />
          </div>
          <div>
            <span>{value}</span>
            <p>{label}</p>
          </div>
        </article>
      ))}
    </section>
  );
}

function MetricIcon({ type }) {
  const paths = {
    branches: (
      <>
        <path d="M12 21s6-5.4 6-11a6 6 0 0 0-12 0c0 5.6 6 11 6 11Z" />
        <circle cx="12" cy="10" r="2.2" />
      </>
    ),
    programs: (
      <>
        <path d="M4 15c3.2-5.4 6.1-5.4 9.3 0 2.1 3.5 4.2 3.5 6.7 0" />
        <path d="M4 9c3.2-5.4 6.1-5.4 9.3 0 2.1 3.5 4.2 3.5 6.7 0" />
      </>
    ),
    levels: (
      <>
        <path d="M7 20V4" />
        <path d="M17 20V4" />
        <path d="M7 8h10" />
        <path d="M7 13h10" />
        <path d="M7 18h10" />
      </>
    ),
    styles: (
      <>
        <path d="M12 3l1.6 5.1L19 10l-5.4 1.9L12 17l-1.6-5.1L5 10l5.4-1.9L12 3Z" />
        <path d="M5 15l.8 2.2L8 18l-2.2.8L5 21l-.8-2.2L2 18l2.2-.8L5 15Z" />
        <path d="M19 14l.6 1.7 1.7.6-1.7.6L19 19l-.6-1.7-1.7-.6 1.7-.6L19 14Z" />
      </>
    ),
  };

  return (
    <svg className="metric-icon" viewBox="0 0 24 24" aria-hidden="true">
      {paths[type]}
    </svg>
  );
}

function ProgramsSection() {
  const scrollingPrograms = [...dancePrograms, ...dancePrograms];
  return (
    <section className="content-band programs-band" id="programs">
      <div className="section-heading centered">
        <p className="eyebrow">Programas</p>
        <h2>Ritmos que se sienten en movimiento</h2>
        <p>Explora líneas urbanas, tropicales y étnicas con clases para empezar, crecer y presentarte.</p>
      </div>
      <div className="program-marquee" aria-label="Programas de baile">
        <div className="program-track">
          {scrollingPrograms.map((program, index) => (
            <ProgramCard
              key={`${program.title}-${index}`}
              program={program}
              duplicate={index >= dancePrograms.length}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function ProgramCard({ program, duplicate = false }) {
  return (
    <article className="program-card" aria-hidden={duplicate}>
      <img src={program.image} alt="" loading="lazy" />
      <div>
        <span>{program.level}</span>
        <h3>{program.title}</h3>
        <p>{program.description}</p>
        <a href="#enroll" tabIndex={duplicate ? -1 : undefined}>Consultar</a>
      </div>
    </article>
  );
}

function BranchesSection() {
  return (
    <section className="content-band branches-showcase" id="branches">
      <div className="section-heading centered">
        <p className="eyebrow">Sedes</p>
        <h2>Cinco ubicaciones para entrenar más cerca de ti</h2>
        <p>
          Cada sede mantiene la misma energía ALC, con grupos organizados y una identidad propia.
        </p>
      </div>
      <div className="branch-logo-grid">
        {branches.map((branch) => (
          <article className="branch-card" key={branch.name} style={{ '--branch-color':branch.color }} tabIndex="0">
            <BranchLogo />
            <h3>{branch.name}</h3>
            <span>{branch.short}</span>
            <p>{branch.focus}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function BranchLogo() {
  return (
    <svg className="branch-logo" viewBox="0 0 96 96" aria-hidden="true">
      <path d="M48 10 84 78 59 69 48 42 37 69 12 78 48 10Z" />
      <path d="M48 23 68 67 57 63 48 50 39 63 28 67 48 23Z" />
    </svg>
  );
}

function EnrollmentForm() {
  const [status, setStatus] = useState('');
  const [availableBranches, setAvailableBranches] = useState([]);
  const [branchesState, setBranchesState] = useState('loading');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiRequest('/public/branches')
      .then((payload) => {
        setAvailableBranches(payload.data || []);
        setBranchesState('ready');
      })
      .catch(() => {
        setAvailableBranches([]);
        setBranchesState('error');
      });
  }, []);

  async function submit(event) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
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
    } catch (error) {
      setStatus(errorMessage(error, 'No se pudo registrar la solicitud. Intenta nuevamente.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="enrollment-band" id="enroll">
      <div className="enrollment-copy">
        <p className="eyebrow">Inscripción</p>
        <h2>Cuéntanos qué quieres bailar</h2>
        <p>Envía tus datos para recibir información sobre sedes, horarios, niveles y programas disponibles.</p>
      </div>
      <form onSubmit={submit} className="enrollment-form" aria-busy={submitting}>
        <label>Nombre completo<input name="fullName" autoComplete="name" required /></label>
        <label>Correo electrónico<input name="email" type="email" autoComplete="email" required /></label>
        <label>Sede de preferencia
          {branchesState === 'ready' && availableBranches.length ? (
            <select name="branchId" defaultValue=""><option value="">Sin preferencia</option>{availableBranches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select>
          ) : branchesState === 'loading' ? (
            <select disabled aria-label="Cargando sedes"><option>Cargando sedes...</option></select>
          ) : (
            <input name="preferredBranch" placeholder="Norte, Matriz, Tumbaco" />
          )}
        </label>
        {branchesState === 'error' && <p className="field-help warning-text">No pudimos cargar las sedes. Puedes escribir tu preferencia y procesaremos la solicitud manualmente.</p>}
        <label>Estilo de interés<input name="styleInterest" placeholder="Salsa, Hip Hop, Bachata" /></label>
        <button type="submit" disabled={submitting}>{submitting ? 'Enviando...' : 'Enviar solicitud'}</button>
        <p className="form-status" role="status" aria-live="polite">{status}</p>
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

function LogoutButton() {
  async function logout(event) {
    event.preventDefault();
    await apiRequest('/auth/logout', { method: 'POST' }).catch(() => null);
    window.location.href = '/login.html?session=logout';
  }

  return <a href="/login.html" data-short="CS" onClick={logout}><span>Cerrar sesión</span></a>;
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
    pending:'Pendiente',
    approved:'Aprobada',
    rejected:'Rechazada',
    paid:'Pagado',
    overdue:'Vencido',
    contacted:'Contactado',
    trial_scheduled:'Clase de prueba',
    enrolled:'Inscrito',
    lost:'No continúa',
    cancelled:'Cancelado',
    scheduled:'Programada',
    completed:'Completada',
    active:'Activa',
    trial:'Prueba',
    waitlisted:'Lista de espera',
    frozen:'Congelada',
    withdrawn:'Retirada',
  }[status] || 'Registrado';
}

function displayUserName(user) {
  return cleanDisplayText(user?.name, roleLabels[user?.role] || 'Usuario');
}

function sessionLabel(session) {
  const startsAt = session.startsAt ? new Date(session.startsAt) : null;
  const time = startsAt && !Number.isNaN(startsAt.getTime())
    ? startsAt.toLocaleString('es-EC', { dateStyle:'short', timeStyle:'short', timeZone:ACADEMY_TIME_ZONE })
    : 'Horario pendiente';
  return `${cleanDisplayText(session.name, 'Clase programada')} - ${time}`;
}

function formatDateTime(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime())
    ? date.toLocaleString('es-EC', { dateStyle:'medium', timeStyle:'short', timeZone:ACADEMY_TIME_ZONE })
    : 'Fecha pendiente';
}

function toAcademyDateTimeLocal(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone:ACADEMY_TIME_ZONE,
    year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit',
    hourCycle:'h23',
  }).formatToParts(date).reduce((result, part) => ({ ...result, [part.type]:part.value }), {});
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

function academyLocalToIso(value) {
  if (!value) return undefined;
  const date = new Date(`${value}:00-05:00`);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

const MAX_PROFILE_PHOTO_DATA_URL_LENGTH = 90000;

async function optimizeProfilePhoto(file) {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const candidate = new Image();
      candidate.onload = () => resolve(candidate);
      candidate.onerror = () => reject(new Error('La imagen no se pudo leer.'));
      candidate.src = objectUrl;
    });
    const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
    if (!sourceSize) throw new Error('La imagen no tiene dimensiones válidas.');
    const sourceX = Math.max((image.naturalWidth - sourceSize) / 2, 0);
    const sourceY = Math.max((image.naturalHeight - sourceSize) / 2, 0);

    for (const targetSize of [320, 256, 192]) {
      const size = Math.min(targetSize, sourceSize);
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('El navegador no puede procesar la imagen.');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, size, size);
      context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, size, size);

      for (const quality of [0.82, 0.7, 0.58, 0.46]) {
        const webp = canvas.toDataURL('image/webp', quality);
        const candidate = webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', quality);
        if (candidate.length <= MAX_PROFILE_PHOTO_DATA_URL_LENGTH) return candidate;
      }
    }
    throw new Error('La imagen sigue siendo demasiado pesada después de optimizarla.');
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function formatDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime())
    ? date.toLocaleDateString('es-EC', { dateStyle:'medium', timeZone:ACADEMY_TIME_ZONE })
    : 'Fecha no disponible';
}

function formatMoney(value) {
  return new Intl.NumberFormat('es-EC', { style:'currency', currency:'USD' }).format(Number(value || 0));
}

function studentProfile(data) {
  return data.students[0] || null;
}

function studentActiveEnrollments(data) {
  const student = studentProfile(data);
  if (!student) return [];
  return data.classGroupEnrollments.filter((enrollment) => (
    enrollment.studentId === student.id && ['active', 'trial'].includes(enrollment.status)
  ));
}

function studentUpcomingSessions(data) {
  const groupIds = new Set(studentActiveEnrollments(data).map((enrollment) => enrollment.classGroupId));
  const now = Date.now();
  return data.classSessions
    .filter((session) => groupIds.has(session.classGroupId) && new Date(session.startsAt).getTime() >= now && session.status !== 'cancelled')
    .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
}

function outstandingStudentPayments(data) {
  const student = studentProfile(data);
  return data.studentPayments.filter((payment) => (
    (!student || payment.studentId === student.id) && ['pending', 'overdue'].includes(payment.status)
  ));
}

function TeacherAttendanceSheet({ classSessions, onOutput, onDataUpdated, canCorrectFinalized = false }) {
  const [classSessionId, setClassSessionId] = useState('');
  const [statuses, setStatuses] = useState({});
  const [rosterRows, setRosterRows] = useState([]);
  const [attendanceState, setAttendanceState] = useState('draft');
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [rosterError, setRosterError] = useState('');
  const [saving, setSaving] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [correctionMode, setCorrectionMode] = useState(false);
  const [correctionReason, setCorrectionReason] = useState('');
  const finalized = attendanceState === 'finalized';
  const markedCount = rosterRows.filter(({ student }) => Boolean(statuses[student.id])).length;
  const editableCount = rosterRows.filter(({ attendance }) => attendance?.status !== 'justified').length;
  const disabled = !rosterRows.length || !classSessionId || loadingRoster || saving;

  useEffect(() => {
    if (!classSessionId && classSessions.length) setClassSessionId(classSessions[0].id);
  }, [classSessionId, classSessions]);

  useEffect(() => {
    if (!classSessionId) {
      setRosterRows([]);
      setStatuses({});
      return undefined;
    }
    let mounted = true;
    setLoadingRoster(true);
    setRosterError('');
    setReviewing(false);
    setCorrectionMode(false);
    setCorrectionReason('');
    apiRequest(`/class-sessions/${classSessionId}/roster`)
      .then((payload) => {
        if (!mounted) return;
        const data = payload.data || {};
        const rows = Array.isArray(data.roster) ? data.roster.filter((row) => row?.student?.id) : [];
        setRosterRows(rows);
        setAttendanceState(data.attendanceState || data.session?.attendanceState || 'draft');
        setStatuses(Object.fromEntries(rows.map((row) => [row.student.id, row.attendance?.status || ''])));
      })
      .catch((error) => {
        if (!mounted) return;
        setRosterRows([]);
        setStatuses({});
        setRosterError(errorMessage(error, 'No se pudo cargar el roster de esta clase.'));
      })
      .finally(() => { if (mounted) setLoadingRoster(false); });
    return () => { mounted = false; };
  }, [classSessionId]);

  function updateStatus(studentId, status) {
    setStatuses((current) => ({ ...current, [studentId]:status }));
    setReviewing(false);
  }

  function beginFinalReview(event) {
    event.preventDefault();
    if (disabled) return;
    const missing = rosterRows.filter(({ student, attendance }) => attendance?.status !== 'justified' && !statuses[student.id]);
    if (missing.length) {
      onOutput({ success:false, message:`Falta marcar a ${missing.length} estudiante${missing.length === 1 ? '' : 's'}. La clase no fue finalizada.` });
      return;
    }
    if (finalized && correctionMode && correctionReason.trim().length < 5) {
      onOutput({ success:false, message:'Explica el motivo de la corrección con al menos 5 caracteres.' });
      return;
    }
    setReviewing(true);
  }

  async function saveBatch(targetState) {
    if (disabled) return;
    const records = rosterRows
      .map(({ student, attendance }) => ({ studentId:student.id, status:statuses[student.id], locked:attendance?.status === 'justified' }))
      .filter((record) => record.status && !record.locked)
      .map(({ studentId, status }) => ({ studentId, status }));
    if (!records.length) {
      onOutput({ success:false, message:'Marca al menos un estudiante antes de guardar.' });
      return;
    }
    setSaving(true);
    try {
      const payload = await putJson(`/class-sessions/${classSessionId}/attendance`, {
        state:targetState,
        records,
        ...(finalized || correctionMode ? { correctionReason:correctionReason.trim() } : {}),
      });
      const data = payload.data || {};
      setAttendanceState(data.attendanceState || targetState);
      if (data.session) {
        onDataUpdated('classSessions', (current) => current.map((session) => (
          session.id === data.session.id ? data.session : session
        )));
      }
      if (Array.isArray(data.records)) {
        setStatuses((current) => ({ ...current, ...Object.fromEntries(data.records.map((record) => [record.studentId, record.status])) }));
      }
      setReviewing(false);
      setCorrectionMode(false);
      setCorrectionReason('');
      onOutput({ success:true, message:targetState === 'finalized'
        ? `Asistencia finalizada para ${rosterRows.length} estudiantes.`
        : `Borrador guardado con ${records.length} estudiantes marcados.` });
    } catch (error) {
      onOutput({ success:false, message:errorMessage(error, 'No se pudo guardar la asistencia de la clase.') });
    } finally {
      setSaving(false);
    }
  }

  function retryRoster() {
    const selected = classSessionId;
    setClassSessionId('');
    window.setTimeout(() => setClassSessionId(selected), 0);
  }

  return (
    <form className="academic-panel attendance-sheet" id="asistencia" onSubmit={beginFinalReview} aria-busy={loadingRoster || saving}>
      <p className="eyebrow">Asistencia</p>
      <div className="panel-heading-row">
        <div><h2>Roster de la clase</h2><p>Solo aparecen matrículas activas o de prueba vinculadas al grupo.</p></div>
        <span className={`status-chip ${finalized ? 'success' : 'warning'}`}>{finalized ? 'Finalizada' : 'Borrador'}</span>
      </div>
      <label>Clase<select value={classSessionId} onChange={(event) => setClassSessionId(event.target.value)} disabled={!classSessions.length || saving}>{classSessions.map((session) => <option key={session.id} value={session.id}>{sessionLabel(session)}</option>)}</select></label>
      {!classSessions.length && <p className="empty-state">No hay sesiones asignadas. Solicita al director que revise tu horario.</p>}
      {loadingRoster && <p className="loading-state" role="status">Cargando roster y asistencia existente...</p>}
      {rosterError && <div className="inline-alert error" role="alert"><strong>Roster no disponible</strong><span>{rosterError}</span><button type="button" className="text-action" onClick={retryRoster}>Reintentar</button></div>}
      {!loadingRoster && !rosterError && classSessionId && !rosterRows.length && <p className="empty-state">Esta sesión no tiene estudiantes matriculados. No se enviará asistencia.</p>}
      {!!rosterRows.length && <div className="attendance-progress"><div><strong>{markedCount} de {rosterRows.length}</strong><span>estudiantes marcados</span></div><progress max={rosterRows.length} value={markedCount}>{markedCount} de {rosterRows.length}</progress></div>}
      <div className="attendance-toolbar">
        <button type="button" className="secondary-action" disabled={disabled || (finalized && !correctionMode)} onClick={() => setStatuses((current) => ({ ...current, ...Object.fromEntries(rosterRows.filter((row) => row.attendance?.status !== 'justified').map((row) => [row.student.id, 'present'])) }))}>Marcar todos presentes</button>
        <span>{editableCount} editables · {rosterRows.length - editableCount} justificados por dirección</span>
      </div>
      <ul className="attendance-list">
        {rosterRows.map(({ student, enrollment, attendance }) => (
          <li key={student.id} className={statuses[student.id] ? `attendance-${statuses[student.id]}` : ''}>
            <div><strong>{cleanDisplayText(student.fullName, 'Estudiante')}</strong><span>{enrollment?.status === 'trial' ? 'Clase de prueba' : `Nivel ${student.level || 'pendiente'}`}</span></div>
            <select aria-label={`Asistencia de ${cleanDisplayText(student.fullName, 'estudiante')}`} value={statuses[student.id] || ''} disabled={saving || (finalized && !correctionMode) || attendance?.status === 'justified'} onChange={(event) => updateStatus(student.id, event.target.value)}>
              <option value="">Sin marcar</option>
              {ATTENDANCE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              {attendance?.status === 'justified' && <option value="justified">Justificado por dirección</option>}
            </select>
          </li>
        ))}
      </ul>
      {finalized && canCorrectFinalized && !correctionMode && <button type="button" className="secondary-action" disabled={!rosterRows.length} onClick={() => setCorrectionMode(true)}>Corregir asistencia finalizada</button>}
      {correctionMode && <label>Motivo obligatorio de corrección<textarea value={correctionReason} minLength="5" maxLength="500" onChange={(event) => setCorrectionReason(event.target.value)} placeholder="Explica por qué debe cambiarse el registro auditado" required /></label>}
      {!finalized || correctionMode ? <div className="button-row responsive-actions">{!finalized && <button type="button" className="secondary-action" disabled={disabled || !markedCount} onClick={() => saveBatch('draft')}>{saving ? 'Guardando...' : 'Guardar borrador'}</button>}<button type="submit" disabled={disabled || reviewing}>{finalized ? 'Revisar corrección' : 'Revisar y finalizar'}</button>{correctionMode && <button type="button" className="text-action" onClick={() => { setCorrectionMode(false); setCorrectionReason(''); }}>Cancelar corrección</button>}</div> : null}
      {reviewing && <div className="confirmation-card" role="alertdialog" aria-labelledby="attendance-confirm-title" aria-describedby="attendance-confirm-copy"><strong id="attendance-confirm-title">Confirma antes de finalizar</strong><p id="attendance-confirm-copy">Se guardarán {rosterRows.length} registros: {rosterRows.filter(({ student }) => statuses[student.id] === 'present').length} presentes, {rosterRows.filter(({ student }) => statuses[student.id] === 'late').length} atrasos y {rosterRows.filter(({ student }) => statuses[student.id] === 'absent').length} ausencias.</p><div className="button-row responsive-actions"><button type="button" onClick={() => saveBatch('finalized')} disabled={saving}>{saving ? 'Finalizando...' : 'Confirmar y finalizar'}</button><button type="button" className="secondary-action" onClick={() => setReviewing(false)} disabled={saving}>Volver a revisar</button></div></div>}
    </form>
  );
}

function TeacherCheckInForm({ teacher, classSessions, initialRecords, recordsUnavailable, onOutput, onDataUpdated }) {
  const records = initialRecords || [];
  const [busy, setBusy] = useState(false);
  const openRecord = records.find((record) => record.teacherId === teacher?.id && !record.checkOutAt);

  async function checkIn(event) {
    event.preventDefault();
    if (!teacher || busy || recordsUnavailable || openRecord) return;
    const form = Object.fromEntries(new FormData(event.currentTarget).entries());
    setBusy(true);
    try {
      const payload = await postJson('/teacher-attendance/check-in', {
        teacherId:teacher.id,
        ...(form.classSessionId ? { classSessionId:form.classSessionId } : {}),
      });
      onDataUpdated('teacherAttendance', (current) => [payload.data, ...current]);
      onOutput({ success:true, message:`Entrada registrada: ${formatDateTime(payload.data?.checkInAt)}.` });
    } catch (error) {
      onOutput({ success:false, message:errorMessage(error, 'No se pudo registrar tu entrada.') });
    } finally {
      setBusy(false);
    }
  }

  async function checkOut() {
    if (!openRecord || busy) return;
    setBusy(true);
    try {
      const payload = await apiRequest(`/teacher-attendance/${openRecord.id}/check-out`, { method:'PATCH' });
      onDataUpdated('teacherAttendance', (current) => current.map((record) => record.id === openRecord.id ? payload.data : record));
      onOutput({ success:true, message:`Salida registrada: ${formatDateTime(payload.data?.checkOutAt)}.` });
    } catch (error) {
      onOutput({ success:false, message:errorMessage(error, 'No se pudo cerrar tu jornada.') });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={checkIn} className="academic-panel teacher-shift-panel" aria-busy={busy}>
      <p className="eyebrow">Profesores</p>
      <h2>Mi jornada</h2>
      {recordsUnavailable && <div className="inline-alert error" role="alert"><strong>Control de jornada no disponible</strong><span>No pudimos verificar si tienes una entrada abierta. Por seguridad no habilitamos otra entrada.</span></div>}
      {!teacher && <p className="empty-state">Tu cuenta no tiene un perfil docente vinculado.</p>}
      {openRecord ? (
        <div className="shift-active-card">
          <span className="status-chip success">Jornada abierta</span>
          <strong>Entrada: {formatDateTime(openRecord.checkInAt)}</strong>
          <span>{classSessions.find((session) => session.id === openRecord.classSessionId)?.name || 'Sin clase asociada'}</span>
          <button type="button" onClick={checkOut} disabled={busy}>{busy ? 'Registrando salida...' : 'Registrar mi salida'}</button>
        </div>
      ) : (
        <>
          <p>Registrarás la entrada de <strong>{cleanDisplayText(teacher?.fullName, 'tu perfil docente')}</strong>. No puedes seleccionar a otro profesor.</p>
          <label>Clase opcional<select name="classSessionId" defaultValue="" disabled={!classSessions.length || busy}><option value="">Sin clase asociada</option>{classSessions.map((session) => <option key={session.id} value={session.id}>{sessionLabel(session)}</option>)}</select></label>
          <button type="submit" disabled={!teacher || busy || recordsUnavailable}>{busy ? 'Registrando...' : 'Registrar mi entrada'}</button>
        </>
      )}
    </form>
  );
}

function StudentAttendanceHistory({ attendanceRecords, classSessions }) {
  const sessionsById = new Map(classSessions.map((session) => [session.id, session]));
  const recent = [...attendanceRecords].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 12);
  return (
    <div className="academic-panel" id="asistencia">
      <p className="eyebrow">Mi asistencia</p>
      <h2>Historial reciente</h2>
      {recent.length ? (
        <ul className="simple-list">
          {recent.map((record) => {
            const session = sessionsById.get(record.classSessionId);
            return (
            <li key={record.id}>
              <div className="list-heading-row"><strong>{statusLabel(record.status)}</strong><span className={`status-chip attendance-${record.status}`}>{statusLabel(record.status)}</span></div>
              <span>{session ? sessionLabel(session) : formatDateTime(record.createdAt)}</span>
              {record.notes && <span>{cleanAttendanceNote(record.notes)}</span>}
            </li>
          );})}
        </ul>
      ) : (
        <p className="empty-state">Todavía no tienes registros de asistencia visibles.</p>
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
    } catch (error) {
      onOutput({ success:false, message:errorMessage(error, 'No se pudo enviar la justificación. Verifica que la ausencia siga pendiente.') });
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
          <label>Ausencia<select name="attendanceRecordId" required>{absences.map((record) => <option key={record.id} value={record.id}>{formatDateTime(record.createdAt)} · {cleanAttendanceNote(record.notes)}</option>)}</select></label>
          <label>Motivo<textarea name="reason" minLength="5" maxLength="500" required placeholder="Explica brevemente el motivo de la ausencia" /></label>
          <label>Evidencia opcional<input name="evidenceUrl" type="url" pattern="https://.*" placeholder="https://..." /><span className="field-help">Usa un enlace HTTPS accesible para Dirección.</span></label>
          <button type="submit" disabled={submitting}>{submitting ? 'Enviando...' : 'Enviar justificación'}</button>
        </>
      ) : (
        <p className="panel-note">No tienes ausencias pendientes para justificar.</p>
      )}
    </form>
  );
}

function StudentHomePanel({ data }) {
  const upcoming = studentUpcomingSessions(data);
  const nextSession = upcoming[0];
  const enrollments = studentActiveEnrollments(data);
  const outstanding = outstandingStudentPayments(data);
  const outstandingAmount = outstanding.reduce((total, payment) => total + Number(payment.amount || 0), 0);
  return (
    <section className="academic-panel" id="inicio">
      <p className="eyebrow">Inicio</p>
      <h2>Tu seguimiento académico</h2>
      <ul className="simple-list">
        <li><strong>{nextSession ? 'Próxima clase' : 'Horario pendiente'}</strong><span>{nextSession ? sessionLabel(nextSession) : enrollments.length ? 'No hay próximas sesiones programadas para tus grupos.' : 'Aún no tienes una matrícula activa vinculada.'}</span></li>
        <li><strong>{enrollments.length} {enrollments.length === 1 ? 'grupo activo' : 'grupos activos'}</strong><span>{upcoming.length} próximas sesiones visibles.</span></li>
        <li><strong>{outstanding.length ? formatMoney(outstandingAmount) : 'Al día'}</strong><span>{outstanding.length ? `${outstanding.length} pago${outstanding.length === 1 ? '' : 's'} pendiente${outstanding.length === 1 ? '' : 's'}.` : 'No tienes cartera pendiente visible.'}</span></li>
        <li><strong>Nivel académico</strong><span>{data.students[0]?.level ? `Tu nivel actual es ${data.students[0].level}.` : 'Tu nivel se mostrará cuando la sede complete tu perfil.'}</span></li>
      </ul>
    </section>
  );
}

function StudentPaymentsPanel({ data }) {
  const payments = [...data.studentPayments].sort((a, b) => String(b.period || '').localeCompare(String(a.period || '')));
  const outstanding = outstandingStudentPayments(data);
  const outstandingAmount = outstanding.reduce((total, payment) => total + Number(payment.amount || 0), 0);
  return (
    <section className="academic-panel" id="pagos">
      <p className="eyebrow">Pagos</p>
      <h2>Mi estado de cuenta</h2>
      <div className="finance-summary"><div><strong>{formatMoney(outstandingAmount)}</strong><span>Saldo pendiente visible</span></div><div><strong>{outstanding.length}</strong><span>Obligaciones pendientes o vencidas</span></div></div>
      {payments.length ? <ul className="simple-list payment-list">{payments.map((payment) => <li key={payment.id}><div className="list-heading-row"><strong>{cleanDisplayText(payment.concept, 'Mensualidad')} · {payment.period}</strong><span className={`status-chip payment-${payment.status}`}>{statusLabel(payment.status)}</span></div><span>{formatMoney(payment.amount)}{payment.dueAt ? ` · vence ${formatDate(payment.dueAt)}` : ''}</span></li>)}</ul> : <p className="empty-state">No hay pagos publicados en tu estado de cuenta.</p>}
      <p className="panel-note">Si detectas una diferencia, comunícate con tu sede antes de realizar un nuevo pago.</p>
    </section>
  );
}

function StudentProfilePanel({ data, onOutput, onProfileUpdated }) {
  const student = studentProfile(data);
  const [preview, setPreview] = useState(student?.profilePhotoUrl || '');
  const [saving, setSaving] = useState(false);
  const [processingPhoto, setProcessingPhoto] = useState(false);

  useEffect(() => {
    setPreview(student?.profilePhotoUrl || '');
  }, [student?.profilePhotoUrl]);

  async function readPhoto(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      onOutput({ success:false, message:'Selecciona una imagen PNG, JPEG o WebP.' });
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      onOutput({ success:false, message:'La imagen original no puede superar 8 MB.' });
      return;
    }
    setProcessingPhoto(true);
    try {
      setPreview(await optimizeProfilePhoto(file));
      onOutput({ success:true, message:'Imagen recortada y optimizada. Revisa la vista previa antes de guardarla.' });
    } catch (error) {
      setPreview(student?.profilePhotoUrl || '');
      onOutput({ success:false, message:errorMessage(error, 'No se pudo preparar la imagen seleccionada.') });
    } finally {
      setProcessingPhoto(false);
      event.target.value = '';
    }
  }

  async function savePhoto() {
    if (!preview || saving) return;
    setSaving(true);
    try {
      const payload = await patchJson('/students/me/profile-photo', { profilePhotoUrl:preview });
      onProfileUpdated(payload.data);
      onOutput({ success:true, message:'Tu foto de perfil fue actualizada.' });
    } catch (error) {
      onOutput({ success:false, message:errorMessage(error, 'No se pudo actualizar la foto. Intenta con una imagen más liviana.') });
    } finally {
      setSaving(false);
    }
  }

  async function removePhoto() {
    if (saving) return;
    setSaving(true);
    try {
      const payload = await apiRequest('/students/me/profile-photo', { method:'DELETE' });
      setPreview('');
      onProfileUpdated(payload.data);
      onOutput({ success:true, message:'Tu foto de perfil fue eliminada.' });
    } catch (error) {
      onOutput({ success:false, message:errorMessage(error, 'No se pudo eliminar la foto de perfil.') });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="academic-panel profile-panel" id="perfil">
      <div>
        <p className="eyebrow">Perfil</p>
        <h2>Foto de estudiante</h2>
        <p>Sube, actualiza o elimina la imagen que se mostrará en tu panel académico.</p>
      </div>
      <div className="profile-photo-row">
        <div className="user-avatar large">
          {preview ? (
            <img src={preview} alt="Foto de perfil del estudiante" />
          ) : (
            <svg aria-hidden="true" viewBox="0 0 128 128">
              <circle cx="64" cy="43" r="28" />
              <path d="M20 116c5-28 22-42 44-42s39 14 44 42" />
            </svg>
          )}
        </div>
        <div className="profile-actions">
          <label>Seleccionar imagen<input type="file" accept="image/png,image/jpeg,image/webp" onChange={readPhoto} disabled={saving || processingPhoto} /></label>
          <p className="field-help">Se recorta a formato cuadrado y se optimiza localmente; la imagen original puede pesar hasta 8 MB.</p>
          <div className="button-row">
            <button type="button" onClick={savePhoto} disabled={!preview || saving || processingPhoto}>{processingPhoto ? 'Optimizando...' : saving ? 'Guardando...' : 'Guardar foto'}</button>
            <button type="button" className="secondary-action" onClick={removePhoto} disabled={saving || processingPhoto || !student?.profilePhotoUrl}>Eliminar foto</button>
          </div>
        </div>
      </div>
    </section>
  );
}

function StudentEventsPanel({ events }) {
  return (
    <section className="academic-panel" id="eventos">
      <p className="eyebrow">Eventos</p>
      <h2>Eventos de la academia</h2>
      {events.length ? (
        <ul className="simple-list event-list">
          {events.map((event) => (
            <li key={event.id}>
              <strong>{cleanDisplayText(event.title, 'Evento académico')}</strong>
              <span>{event.level === 'ALL' ? 'Todos los niveles' : `Nivel ${event.level}`} · {formatDateTime(event.startsAt)}</span>
              {event.location && <span>{event.location}</span>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="panel-note">No hay eventos visibles para tu nivel por el momento.</p>
      )}
    </section>
  );
}

function TeacherClassPanel({ data }) {
  const upcoming = [...data.classSessions].filter((session) => new Date(session.endsAt || session.startsAt) >= new Date() && session.status !== 'cancelled').sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
  const pendingAttendance = data.classSessions.filter((session) => session.attendanceState !== 'finalized' && session.status !== 'cancelled');
  return (
    <section className="academic-panel" id="clase">
      <p className="eyebrow">Clase de hoy</p>
      <h2>Preparación de clase</h2>
      <ul className="simple-list">
        <li><strong>{upcoming[0] ? cleanDisplayText(upcoming[0].name, 'Próxima clase') : 'Sin próxima clase'}</strong><span>{upcoming[0] ? formatDateTime(upcoming[0].startsAt) : 'No hay próximas sesiones programadas.'}</span></li>
        <li><strong>{pendingAttendance.length} asistencias por cerrar</strong><span>Abre Asistencia para cargar el roster real de cada sesión.</span></li>
        <li><strong>Jornada docente</strong><span>Registra tu entrada y salida desde Mi entrada para calcular horas correctamente.</span></li>
      </ul>
    </section>
  );
}

function EventsManagerPanel({ data, onOutput, onDataUpdated }) {
  const events = data.academyEvents || [];
  const [branches, setBranches] = useState(data.branches || []);
  const [editingEvent, setEditingEvent] = useState(null);
  const [saving, setSaving] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState('');
  const [deletingId, setDeletingId] = useState('');

  useEffect(() => {
    if (!branches.length) {
      fetchList('/branches').then(setBranches).catch(() => setBranches([]));
    }
  }, []);

  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    const form = Object.fromEntries(new FormData(event.currentTarget).entries());
    const startsAt = academyLocalToIso(form.startsAt);
    const endsAt = academyLocalToIso(form.endsAt);
    if (!startsAt || (endsAt && new Date(endsAt) <= new Date(startsAt))) {
      onOutput({ success:false, message:'La fecha de fin debe ser posterior al inicio del evento.' });
      return;
    }
    const body = {
      branchId:form.branchId,
      title:form.title,
      description:form.description || undefined,
      level:form.level,
      startsAt,
      endsAt,
      location:form.location || undefined,
      showIncome:Number(form.showIncome || 0),
      active:true,
    };
    setSaving(true);
    try {
      const payload = editingEvent
        ? await patchJson(`/academy-events/${editingEvent.id}`, body)
        : await postJson('/academy-events', body);
      onDataUpdated('academyEvents', (current) => {
        const others = current.filter((item) => item.id !== payload.data.id);
        return [payload.data, ...others].sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
      });
      setEditingEvent(null);
      event.currentTarget.reset();
      onOutput({ success:true, message:editingEvent ? 'Evento actualizado.' : 'Evento creado.' });
    } catch (error) {
      onOutput({ success:false, message:errorMessage(error, 'No se pudo guardar el evento. Revisa sede, nivel y fecha.') });
    } finally {
      setSaving(false);
    }
  }

  async function removeEvent(eventId) {
    if (deletingId) return;
    setDeletingId(eventId);
    try {
      await apiRequest(`/academy-events/${eventId}`, { method:'DELETE' });
      onDataUpdated('academyEvents', (current) => current.filter((item) => item.id !== eventId));
      setPendingDeleteId('');
      onOutput({ success:true, message:'Evento eliminado del calendario visible.' });
    } catch (error) {
      onOutput({ success:false, message:errorMessage(error, 'No se pudo eliminar el evento.') });
    } finally {
      setDeletingId('');
    }
  }

  return (
    <section className="academic-panel events-manager" id="eventos">
      <div>
        <p className="eyebrow">Eventos</p>
        <h2>Calendario académico</h2>
        <p>Crea eventos por sede y nivel para que cada estudiante vea únicamente lo que le corresponde.</p>
      </div>
      <form key={editingEvent?.id || 'new-event'} className="event-form" onSubmit={submit} aria-busy={saving}>
        <label>Sede<select name="branchId" required defaultValue={editingEvent?.branchId || ''}>
          <option value="">Selecciona una sede</option>
          {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
        </select></label>
        <label>Nivel<select name="level" required defaultValue={editingEvent?.level || 'ALL'}>
          <option value="ALL">Todos</option>
          <option value="B1">B1</option>
          <option value="B2">B2</option>
        </select></label>
        <label>Título<input name="title" required defaultValue={editingEvent?.title || ''} placeholder="Showcase Urbano B1" /></label>
        <label>Lugar<input name="location" defaultValue={editingEvent?.location || ''} placeholder="Sede Norte" /></label>
        <label>Inicio <span className="label-hint">Hora de Quito</span><input name="startsAt" type="datetime-local" required defaultValue={toAcademyDateTimeLocal(editingEvent?.startsAt)} /></label>
        <label>Fin <span className="label-hint">Hora de Quito</span><input name="endsAt" type="datetime-local" defaultValue={toAcademyDateTimeLocal(editingEvent?.endsAt)} /></label>
        <label>Ingreso por show<input name="showIncome" type="number" min="0" step="0.01" defaultValue={editingEvent?.showIncome || 0} /></label>
        <label>Descripción<textarea name="description" maxLength="1000" defaultValue={editingEvent?.description || ''} /></label>
        <div className="button-row">
          <button type="submit" disabled={saving}>{saving ? 'Guardando...' : editingEvent ? 'Actualizar evento' : 'Crear evento'}</button>
          {editingEvent && <button type="button" className="secondary-action" onClick={() => setEditingEvent(null)}>Cancelar edición</button>}
        </div>
      </form>
      <ul className="simple-list event-list">
        {events.length ? events.map((event) => (
          <li key={event.id}>
            <strong>{cleanDisplayText(event.title, 'Evento académico')}</strong>
            <span>{event.level === 'ALL' ? 'Todos los niveles' : event.level} · {formatDateTime(event.startsAt)} · Show {formatMoney(event.showIncome)}</span>
            <div className="button-row compact">
              <button type="button" className="secondary-action" onClick={() => setEditingEvent(event)}>Editar</button>
              <button type="button" className="secondary-action danger-action" onClick={() => setPendingDeleteId(event.id)} disabled={deletingId === event.id}>Eliminar</button>
            </div>
            {pendingDeleteId === event.id && <div className="delete-confirmation" role="alert"><span>El evento dejará de ser visible. ¿Confirmas?</span><div className="button-row compact"><button type="button" className="danger-action" onClick={() => removeEvent(event.id)} disabled={deletingId === event.id}>{deletingId === event.id ? 'Eliminando...' : 'Sí, eliminar'}</button><button type="button" className="secondary-action" onClick={() => setPendingDeleteId('')}>Cancelar</button></div></div>}
          </li>
        )) : <li><span>No hay eventos registrados todavía.</span></li>}
      </ul>
    </section>
  );
}

function DirectorRequestsPanel({ data, onOutput, onDataUpdated }) {
  const justifications = data.absenceJustifications || [];
  const leads = data.enrollmentRequests || [];
  const [reviewNotes, setReviewNotes] = useState({});
  const [busyId, setBusyId] = useState('');
  const [leadFilter, setLeadFilter] = useState('open');
  const [leadDrafts, setLeadDrafts] = useState({});

  const pendingJustifications = [...justifications]
    .filter((request) => request.status === 'pending')
    .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
  const visibleLeads = [...leads]
    .filter((lead) => leadFilter === 'all' || (leadFilter === 'open' ? !['enrolled', 'lost'].includes(lead.status) : lead.status === leadFilter))
    .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));

  async function reviewJustification(request, status) {
    if (busyId) return;
    setBusyId(request.id);
    try {
      const payload = await patchJson(`/absence-justifications/${request.id}/review`, {
        status,
        ...(reviewNotes[request.id]?.trim() ? { reviewNotes:reviewNotes[request.id].trim() } : {}),
      });
      onDataUpdated('absenceJustifications', (current) => current.map((item) => item.id === request.id ? payload.data : item));
      onOutput({ success:true, message:`Justificación ${status === 'approved' ? 'aprobada' : 'rechazada'} y registrada en auditoría.` });
    } catch (error) {
      onOutput({ success:false, message:errorMessage(error, 'No se pudo revisar la justificación.') });
    } finally {
      setBusyId('');
    }
  }

  async function updateLeadStatus(lead) {
    const draft = leadDrafts[lead.id] || { status:lead.status || 'pending' };
    const status = draft.status;
    if (busyId || status === lead.status) return;
    setBusyId(lead.id);
    try {
      const requestBody = {
        status,
        ...(draft.notes?.trim() ? { notes:draft.notes.trim() } : {}),
        ...(status === 'trial_scheduled' && draft.followUpAt ? { followUpAt:academyLocalToIso(draft.followUpAt) } : {}),
      };
      const payload = await patchJson(`/enrollment-requests/${lead.id}/status`, requestBody);
      onDataUpdated('enrollmentRequests', (current) => current.map((item) => item.id === lead.id ? payload.data : item));
      setLeadDrafts((current) => {
        const next = { ...current };
        delete next[lead.id];
        return next;
      });
      onOutput({ success:true, message:`Solicitud de ${cleanDisplayText(lead.fullName, 'prospecto')} actualizada a ${statusLabel(status)}.` });
    } catch (error) {
      onOutput({ success:false, message:errorMessage(error, 'No se pudo actualizar la solicitud de inscripción.') });
    } finally {
      setBusyId('');
    }
  }

  return (
    <section className="academic-panel requests-panel" id="solicitudes" aria-busy={Boolean(busyId)}>
      <p className="eyebrow">Solicitudes</p>
      <h2>Cola operativa</h2>
      <div className="request-columns">
        <section aria-labelledby="justification-queue-title">
          <div className="section-title-row"><div><h3 id="justification-queue-title">Justificaciones</h3><p>Revisa evidencia y deja una decisión trazable.</p></div><span className="count-badge">{pendingJustifications.length}</span></div>
          {pendingJustifications.length ? <ul className="request-list">{pendingJustifications.map((request) => <li key={request.id}><div className="list-heading-row"><strong>{cleanDisplayText(request.studentName || request.student?.fullName, 'Estudiante')}</strong><span className="status-chip warning">Pendiente</span></div><span>{formatDateTime(request.createdAt)} · {cleanDisplayText(request.reason, 'Sin motivo visible')}</span>{request.evidenceUrl && <a href={request.evidenceUrl} target="_blank" rel="noreferrer">Abrir evidencia adjunta</a>}<label>Nota de revisión<textarea value={reviewNotes[request.id] || ''} maxLength="500" onChange={(event) => setReviewNotes((current) => ({ ...current, [request.id]:event.target.value }))} placeholder="Motivo de aprobación o rechazo" /></label><div className="button-row responsive-actions"><button type="button" onClick={() => reviewJustification(request, 'approved')} disabled={busyId === request.id}>{busyId === request.id ? 'Procesando...' : 'Aprobar'}</button><button type="button" className="secondary-action danger-action" onClick={() => reviewJustification(request, 'rejected')} disabled={busyId === request.id}>Rechazar</button></div></li>)}</ul> : <p className="empty-state">No hay justificaciones pendientes.</p>}
        </section>
        <section aria-labelledby="lead-queue-title">
          <div className="section-title-row"><div><h3 id="lead-queue-title">Prospectos de inscripción</h3><p>Evita que una solicitud quede sin seguimiento.</p></div><span className="count-badge">{visibleLeads.length}</span></div>
          <label>Filtrar solicitudes<select value={leadFilter} onChange={(event) => setLeadFilter(event.target.value)}><option value="open">Abiertas</option><option value="all">Todas</option>{LEAD_STATUS_OPTIONS.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select></label>
          {visibleLeads.length ? <ul className="request-list">{visibleLeads.map((lead) => {
            const draft = leadDrafts[lead.id] || { status:lead.status || 'pending', notes:'', followUpAt:'' };
            const allowedStatuses = LEAD_TRANSITIONS[lead.status || 'pending'] || [lead.status || 'pending'];
            const isTerminal = ['enrolled', 'lost'].includes(lead.status);
            return (
              <li key={lead.id}>
                <div className="list-heading-row"><strong>{cleanDisplayText(lead.fullName, 'Prospecto')}</strong><span className={`status-chip lead-${lead.status}`}>{statusLabel(lead.status)}</span></div>
                <span>Recibida {formatDateTime(lead.createdAt)}{lead.styleInterest ? ` · ${lead.styleInterest}` : ''}</span>
                <span>{lead.preferredBranch || lead.branchName || 'Sede por definir'}</span>
                <a href={`mailto:${lead.email}`}>{lead.email}</a>
                {lead.phone && <a href={`tel:${lead.phone}`}>{lead.phone}</a>}
                <label>Estado<select value={draft.status} onChange={(event) => setLeadDrafts((current) => ({ ...current, [lead.id]:{ ...draft, status:event.target.value } }))} disabled={busyId === lead.id || isTerminal}>{LEAD_STATUS_OPTIONS.filter((status) => allowedStatuses.includes(status.value)).map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select></label>
                {draft.status === 'trial_scheduled' && draft.status !== lead.status && <label>Fecha y hora de la clase de prueba<input type="datetime-local" value={draft.followUpAt} min={toAcademyDateTimeLocal(new Date())} onChange={(event) => setLeadDrafts((current) => ({ ...current, [lead.id]:{ ...draft, followUpAt:event.target.value } }))} required /></label>}
                {draft.status === 'lost' && draft.status !== lead.status && <label>Motivo por el que no continúa<textarea value={draft.notes} minLength="5" maxLength="500" onChange={(event) => setLeadDrafts((current) => ({ ...current, [lead.id]:{ ...draft, notes:event.target.value } }))} required /></label>}
                {draft.status === 'enrolled' && draft.status !== lead.status && <p className="field-help">Antes de confirmar, crea la cuenta activa del estudiante con este mismo correo y en la sede solicitada.</p>}
                {!isTerminal && draft.status !== lead.status && <button type="button" onClick={() => updateLeadStatus(lead)} disabled={busyId === lead.id || (draft.status === 'trial_scheduled' && !draft.followUpAt) || (draft.status === 'lost' && (draft.notes?.trim().length || 0) < 5)}>{busyId === lead.id ? 'Guardando...' : 'Guardar cambio de estado'}</button>}
              </li>
            );
          })}</ul> : <p className="empty-state">No hay solicitudes en este filtro.</p>}
        </section>
      </div>
    </section>
  );
}

function ReportMetricList({ report }) {
  const totals = report?.totals || report?.branch || {};
  const value = (key, formatter = (item) => item) => totals[key] === undefined || totals[key] === null ? '—' : formatter(totals[key]);
  const metrics = [
    [value('totalIncome', formatMoney), 'Ingreso total'],
    [value('grossCollectedIncome', formatMoney), 'Cobro bruto'],
    [value('reversedAmount', formatMoney), 'Reversos'],
    [value('tuitionIncome', formatMoney), 'Mensualidades cobradas'],
    [value('showIncome', formatMoney), 'Shows y eventos'],
    [value('pendingAmount', formatMoney), 'Cartera pendiente'],
    [value('overdueAmount', formatMoney), 'Cartera vencida'],
    [value('activeStudents'), 'Alumnos activos'],
    [value('pendingPayments'), 'Pagos pendientes'],
    [value('retiredStudents'), 'Retirados'],
    [value('attendanceRate', (item) => `${item}%`), 'Asistencia'],
    [totals.b1Students === undefined && totals.b2Students === undefined ? '—' : `${totals.b1Students || 0} / ${totals.b2Students || 0}`, 'B1 / B2'],
    [value('occupancyRate', (item) => `${item}%`), 'Ocupación'],
  ];
  return (
    <div className="report-metrics">
      {metrics.map(([metricValue, label]) => <div key={label}><strong>{metricValue}</strong><span>{label}</span></div>)}
    </div>
  );
}

function AccessibleBarChart({ title, items, valueFormatter = (value) => String(value) }) {
  const safeItems = items.filter((item) => Number.isFinite(Number(item.value))).slice(0, 10);
  if (!safeItems.length) return <p className="empty-state">No hay datos suficientes para esta gráfica.</p>;
  const max = Math.max(...safeItems.map((item) => Number(item.value)), 1);
  const rowHeight = 38;
  const height = 42 + safeItems.length * rowHeight;
  return (
    <div className="accessible-chart">
      <svg viewBox={`0 0 680 ${height}`} role="img" aria-label={title}>
        <title>{title}</title>
        {safeItems.map((item, index) => {
          const y = 28 + index * rowHeight;
          const width = Math.max((Number(item.value) / max) * 390, Number(item.value) ? 3 : 0);
          return <g key={`${item.label}-${index}`}><text x="0" y={y + 15}>{String(item.label).slice(0, 24)}</text><rect x="190" y={y} width="390" height="22" rx="7" className="chart-track" /><rect x="190" y={y} width={width} height="22" rx="7" className="chart-bar"><title>{item.label}: {valueFormatter(item.value)}</title></rect><text x="590" y={y + 15} className="chart-value">{valueFormatter(item.value)}</text></g>;
        })}
      </svg>
      <details className="chart-data-fallback"><summary>Ver datos de la gráfica</summary><table><thead><tr><th>Elemento</th><th>Valor</th></tr></thead><tbody>{safeItems.map((item) => <tr key={item.label}><td>{item.label}</td><td>{valueFormatter(item.value)}</td></tr>)}</tbody></table></details>
    </div>
  );
}

function normalizeSeries(source, valueKeys = ['value']) {
  const rows = Array.isArray(source) ? source : [];
  return rows.map((item, index) => ({
    label:item.label || item.period || item.date || item.name || `Dato ${index + 1}`,
    value:Number(valueKeys.map((key) => item[key]).find((candidate) => candidate !== undefined) ?? 0),
  }));
}

function ReportVisuals({ report }) {
  const branches = Array.isArray(report?.branches) ? report.branches : [];
  const attendanceTrendSource = Array.isArray(report?.trends) ? report.trends : report?.trends?.attendance;
  const attendanceTrend = normalizeSeries(attendanceTrendSource, ['attendanceRate', 'rate', 'value']);
  const distributions = report?.distributions && !Array.isArray(report.distributions)
    ? Object.entries(report.distributions).flatMap(([category, values]) => (
      values && typeof values === 'object'
        ? Object.entries(values).map(([label, value]) => ({ label:`${category}: ${label}`, value:Number(value) }))
        : [{ label:category, value:Number(values) }]
    ))
    : normalizeSeries(report?.distributions, ['count', 'value']);
  const funnel = report?.funnel && !Array.isArray(report.funnel)
    ? Object.entries(report.funnel).map(([label, value]) => ({ label, value:Number(value) }))
    : normalizeSeries(report?.funnel, ['count', 'value']);
  const alerts = Array.isArray(report?.qualityAlerts) ? report.qualityAlerts : [];
  const hasCharts = branches.length || attendanceTrend.length || distributions.length || funnel.length;
  return (
    <>
      {hasCharts ? <div className="report-chart-grid">
        {!!branches.length && <section className="chart-card"><h3>Asistencia por sede</h3><AccessibleBarChart title="Porcentaje de asistencia por sede" items={branches.map((branch) => ({ label:branch.name, value:Number(branch.attendanceRate || 0) }))} valueFormatter={(value) => `${value}%`} /></section>}
        {!!branches.length && <section className="chart-card"><h3>Ingresos por sede</h3><AccessibleBarChart title="Ingreso total por sede" items={branches.map((branch) => ({ label:branch.name, value:Number(branch.totalIncome || 0) }))} valueFormatter={formatMoney} /></section>}
        {!!attendanceTrend.length && <section className="chart-card"><h3>Tendencia de asistencia</h3><AccessibleBarChart title="Tendencia de asistencia por periodo" items={attendanceTrend} valueFormatter={(value) => `${value}%`} /></section>}
        {!!distributions.length && <section className="chart-card"><h3>Distribución académica</h3><AccessibleBarChart title="Distribución académica" items={distributions} /></section>}
        {!!funnel.length && <section className="chart-card"><h3>Embudo de inscripción</h3><AccessibleBarChart title="Embudo de solicitudes de inscripción" items={funnel} /></section>}
      </div> : <p className="empty-state">El servidor devolvió los indicadores, pero todavía no publicó series para gráficas.</p>}
      {!!alerts.length && <section className="quality-alerts" aria-labelledby="quality-alerts-title"><h3 id="quality-alerts-title">Alertas que requieren atención</h3><ul>{alerts.map((alert, index) => <li key={alert.id || alert.code || index} data-severity={alert.severity || 'medium'}><strong>{alert.title || alert.type || (alert.code ? alert.code.replaceAll('_', ' ') : 'Alerta operativa')}{alert.count ? ` · ${alert.count}` : ''}</strong><span>{alert.message || alert.description || String(alert)}</span></li>)}</ul></section>}
    </>
  );
}

function ReportsPanel({ data, role, onOutput }) {
  const canUseGeneralReport = ['Admin', 'GeneralDirector'].includes(role);
  const [reportMode, setReportMode] = useState(canUseGeneralReport ? 'general' : 'branch');
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const today = toAcademyDateTimeLocal(new Date()).slice(0, 10);
  const thirtyDaysAgo = toAcademyDateTimeLocal(new Date(Date.now() - (29 * 86400000))).slice(0, 10);
  const [dateRange, setDateRange] = useState({ from:thirtyDaysAgo, to:today });
  const [appliedRange, setAppliedRange] = useState({ from:thirtyDaysAgo, to:today });
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [reportError, setReportError] = useState('');
  const initialLoadStarted = useRef(false);

  useEffect(() => {
    if (!selectedBranchId && data.branches.length) setSelectedBranchId(data.branches[0].id);
  }, [selectedBranchId, data.branches]);

  useEffect(() => {
    const branchReady = reportMode !== 'branch' || selectedBranchId || data.branches[0]?.id;
    if (!initialLoadStarted.current && branchReady) {
      initialLoadStarted.current = true;
      loadReport(reportMode, appliedRange, selectedBranchId || data.branches[0]?.id, false);
    }
  }, [selectedBranchId, data.branches]);

  async function loadReport(mode = reportMode, range = appliedRange, branchOverride = selectedBranchId, announce = true) {
    const branchId = branchOverride || data.branches[0]?.id;
    if ((mode === 'branch' || !canUseGeneralReport) && !branchId) {
      setReport(null);
      setReportError('No hay una sede disponible para generar el reporte.');
      return;
    }
    setReport(null);
    setReportError('');
    setLoading(true);
    try {
      const basePath = mode === 'branch' || !canUseGeneralReport ? `/reports/branches/${branchId}/detail` : '/reports/general';
      const query = new URLSearchParams({ from:`${range.from}T00:00:00-05:00`, to:`${range.to}T23:59:59-05:00` });
      const payload = await apiRequest(`${basePath}?${query}`);
      setReport(payload.data);
      if (announce) onOutput({ success:true, message:mode === 'branch' ? 'Reporte por sede actualizado.' : 'Reporte general actualizado.' });
    } catch (error) {
      const message = errorMessage(error, 'No se pudo cargar el reporte. Revisa tu rol o la sede seleccionada.');
      setReportError(message);
      if (announce) onOutput({ success:false, message });
    } finally {
      setLoading(false);
    }
  }

  function switchMode(mode) {
    setReportMode(mode);
    loadReport(mode, appliedRange, selectedBranchId || data.branches[0]?.id, false);
  }

  function applyFilters(event) {
    event.preventDefault();
    if (!dateRange.from || !dateRange.to || dateRange.from > dateRange.to) {
      setReportError('La fecha inicial debe ser anterior o igual a la fecha final.');
      return;
    }
    setAppliedRange(dateRange);
    loadReport(reportMode, dateRange);
  }

  return (
    <div className="academic-panel reports-panel" aria-busy={loading}>
      <p className="eyebrow">Reportes</p>
      <h2>{reportMode === 'branch' ? 'Reporte por sede' : 'Reporte general'}</h2>
      <p>Compara indicadores dentro de un periodo explícito. Los valores “—” significan que el servidor no publicó esa métrica.</p>
      <div className="report-controls">
        {canUseGeneralReport && <button type="button" aria-pressed={reportMode === 'general'} className={reportMode === 'general' ? '' : 'secondary-action'} onClick={() => switchMode('general')}>Reporte general</button>}
        <button type="button" aria-pressed={reportMode === 'branch'} className={reportMode === 'branch' ? '' : 'secondary-action'} onClick={() => switchMode('branch')}>Reporte por sede</button>
        {reportMode === 'branch' && (
          <label>Sede<select value={selectedBranchId} onChange={(event) => { setSelectedBranchId(event.target.value); setReport(null); setReportError('Seleccionaste otra sede. Actualiza para cargar sus datos.'); }}>
            {data.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
          </select></label>
        )}
      </div>
      <form className="report-filter-form" onSubmit={applyFilters}><label>Desde<input type="date" value={dateRange.from} max={dateRange.to || today} onChange={(event) => setDateRange((current) => ({ ...current, from:event.target.value }))} /></label><label>Hasta<input type="date" value={dateRange.to} min={dateRange.from} max={today} onChange={(event) => setDateRange((current) => ({ ...current, to:event.target.value }))} /></label><button type="submit" disabled={loading}>{loading ? 'Generando...' : 'Aplicar periodo'}</button><button type="button" className="secondary-action" onClick={() => loadReport()} disabled={loading}>Actualizar</button></form>
      <p className="report-period">Periodo: {formatDate(`${appliedRange.from}T12:00:00-05:00`)} — {formatDate(`${appliedRange.to}T12:00:00-05:00`)}</p>
      {loading && <div className="loading-state" role="status">Calculando indicadores del periodo...</div>}
      {reportError && <div className="inline-alert error" role="alert"><strong>Reporte no disponible</strong><span>{reportError}</span></div>}
      {report ? (
        <>
          <div className="report-freshness"><span>Actualizado</span><strong>{report.generatedAt ? formatDateTime(report.generatedAt) : 'Fecha no publicada por el servidor'}</strong></div>
          <ReportMetricList report={report} />
          <ReportVisuals report={report} />
          {Array.isArray(report.branches) && report.branches.length > 0 && (
            <ul className="simple-list branch-report-list">
              {report.branches.map((branch) => (
                <li key={branch.id}>
                  <strong>{branch.name}</strong>
                  <span>{branch.activeStudents ?? '—'} activos · {branch.totalIncome === undefined ? 'Ingreso no publicado' : `${formatMoney(branch.totalIncome)} ingreso total`} · {branch.attendanceRate ?? '—'}% asistencia</span>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : !loading && !reportError ? <p className="empty-state">Aplica un periodo para visualizar indicadores de dirección.</p> : null}
    </div>
  );
}

function createEmptyDashboardData() {
  return {
    students:[], teachers:[], classGroups:[], classSessions:[], classGroupEnrollments:[],
    attendanceRecords:[], teacherAttendance:[], absenceJustifications:[], enrollmentRequests:[],
    academyEvents:[], branches:[], studentPayments:[], users:[], auditLogs:[],
    resourceErrors:{}, loadedResources:[],
  };
}

async function fetchList(path) {
  const payload = await apiRequest(path);
  if (!Array.isArray(payload.data)) throw new Error('El servidor devolvió un formato de lista inesperado.');
  return payload.data;
}

async function loadDashboardData(role) {
  const data = createEmptyDashboardData();
  const resources = new Map();
  const add = (key, path) => resources.set(key, path);

  if (attendanceWriterRoles.has(role)) {
    add('teachers', '/teachers');
    add('classSessions', '/class-sessions');
    add('teacherAttendance', '/teacher-attendance');
  }

  if (directorRoles.has(role)) {
    add('branches', '/branches');
    add('students', '/students');
    add('teachers', '/teachers');
    add('classGroups', '/class-groups');
    add('classSessions', '/class-sessions');
    add('classGroupEnrollments', '/class-group-enrollments');
    add('academyEvents', '/academy-events');
    add('studentPayments', '/student-payments');
    add('absenceJustifications', '/absence-justifications');
    add('enrollmentRequests', '/enrollment-requests');
  }

  if (accountManagerRoles.has(role)) {
    add('users', '/users');
    add('auditLogs', '/audit-logs');
  }

  if (role === 'Student') {
    add('students', '/students');
    add('attendanceRecords', '/student-attendance');
    add('academyEvents', '/academy-events');
    add('branches', '/branches');
    add('studentPayments', '/student-payments');
    add('classGroupEnrollments', '/class-group-enrollments');
    add('classSessions', '/class-sessions');
  }

  await Promise.all([...resources.entries()].map(async ([key, path]) => {
    try {
      data[key] = await fetchList(path);
      data.loadedResources.push(key);
    } catch (error) {
      data.resourceErrors[key] = {
        status:error?.status || 0,
        message:errorMessage(error, `No se pudo cargar ${key}.`),
      };
    }
  }));
  return data;
}

const resourceLabels = {
  students:'estudiantes', teachers:'profesores', classGroups:'grupos', classSessions:'sesiones',
  classGroupEnrollments:'matrículas', attendanceRecords:'asistencia', teacherAttendance:'jornada docente',
  absenceJustifications:'justificaciones', enrollmentRequests:'solicitudes de inscripción',
  academyEvents:'eventos', branches:'sedes', studentPayments:'pagos', users:'usuarios', auditLogs:'auditoría',
};

function DataHealthBanner({ errors, onRetry }) {
  const entries = Object.entries(errors || {});
  if (!entries.length) return null;
  return <section className="data-health-banner" role="alert"><div><strong>Información parcial</strong><p>No mostramos ceros para los módulos que no pudieron cargarse.</p></div><ul>{entries.map(([key, error]) => <li key={key}><strong>{resourceLabels[key] || key}:</strong> {error.message}</li>)}</ul><button type="button" className="secondary-action" onClick={onRetry}>Reintentar cargas</button></section>;
}

function firstDashboardModule(role) {
  return (roleModuleLinks[role] || [{ id:'inicio' }])[0].id;
}

function profileImageUrl(user, profile = null) {
  return profile?.profilePhotoUrl || user?.photoUrl || user?.avatarUrl || user?.picture || user?.imageUrl || '';
}

function UserAvatar({ user, profile = null }) {
  const imageUrl = profileImageUrl(user, profile);
  const label = `Foto de ${displayUserName(user)}`;
  return (
    <div className="user-avatar" aria-label={label} title={label}>
      {imageUrl ? (
        <img src={imageUrl} alt={label} />
      ) : (
        <svg aria-hidden="true" viewBox="0 0 128 128">
          <circle cx="64" cy="43" r="28" />
          <path d="M20 116c5-28 22-42 44-42s39 14 44 42" />
        </svg>
      )}
    </div>
  );
}

function ModuleNavigation({ role, activeModule, onChange }) {
  const links = roleModuleLinks[role] || [{ id:'inicio', label:'Inicio' }];
  const shortLabels = {
    Indicadores:'IN',
    Cuentas:'CU',
    Academia:'AC',
    Eventos:'EV',
    Solicitudes:'SO',
    Reportes:'RE',
    Seguridad:'SE',
    Auditoría:'AU',
    'Mi sede':'SE',
    'Clase de hoy':'CL',
    Asistencia:'AS',
    'Mi entrada':'EN',
    Perfil:'PE',
    Justificaciones:'JU',
    Pagos:'PA',
    Inicio:'IN',
  };
  return (
    <nav className="module-nav" aria-label="Módulos del panel">
      {links.map((link) => (
        <button
          key={link.id}
          type="button"
          className={activeModule === link.id ? 'active' : ''}
          aria-pressed={activeModule === link.id}
          data-short={shortLabels[link.label] || link.label.slice(0, 2).toUpperCase()}
          title={link.label}
          onClick={() => onChange(link.id)}
        >
          <span>{link.label}</span>
        </button>
      ))}
    </nav>
  );
}

function DashboardIntro({ user, data, visible = true, onDismiss }) {
  const student = data.students[0];
  const teacher = data.teachers[0];
  const profile = user.role === 'Student' ? student : user.role === 'Teacher' ? teacher : null;
  const detail = profile
    ? [roleLabels[user.role], profile.level ? `Nivel ${profile.level}` : null].filter(Boolean).join(' · ')
    : roleLabels[user.role] || 'Usuario autorizado';
  const hour = Number(new Intl.DateTimeFormat('es-EC', { hour:'2-digit', hourCycle:'h23', timeZone:ACADEMY_TIME_ZONE }).format(new Date()));
  const greeting = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';

  return (
    <section className={`dashboard-hero compact welcome-card ${visible ? 'intro-visible' : 'intro-hidden'}`} id="panel-bienvenida" aria-hidden={!visible}>
      <div>
        <p className="eyebrow">Panel académico</p>
        <h1>{greeting}, {displayUserName(user)}</h1>
        <p className="dashboard-copy">{detail}</p>
      </div>
      <UserAvatar user={user} profile={profile} />
      <button type="button" className="welcome-dismiss" aria-label="Cerrar bienvenida" onClick={onDismiss}>×</button>
    </section>
  );
}

function SummaryStrip({ items }) {
  return (
    <section className="summary-strip" aria-label="Indicadores principales">
      {items.map(([value, label]) => (
        <div key={label}>
          <strong>{value}</strong>
          <span>{label}</span>
        </div>
      ))}
    </section>
  );
}

function RoleSummary({ role, data }) {
  const unavailable = (key) => Boolean(data.resourceErrors?.[key]);
  if (role === 'Student') {
    const absences = data.attendanceRecords.filter((record) => record.status === 'absent').length;
    const attended = data.attendanceRecords.filter((record) => ['present', 'late', 'justified'].includes(record.status)).length;
    const rate = data.attendanceRecords.length ? Math.round((attended / data.attendanceRecords.length) * 100) : 0;
    const next = studentUpcomingSessions(data)[0];
    const scheduleUnavailable = unavailable('classSessions') || unavailable('classGroupEnrollments');
    return <SummaryStrip items={[[scheduleUnavailable ? 'No disponible' : next ? formatDate(next.startsAt) : 'Pendiente', 'Próxima clase'], [unavailable('attendanceRecords') ? 'No disponible' : data.attendanceRecords.length ? `${rate}%` : 'Sin datos', 'Asistencia visible'], [unavailable('attendanceRecords') ? 'No disponible' : absences, 'Ausencias registradas']]} />;
  }
  if (role === 'Teacher') {
    const ownTeacher = data.teachers[0];
    const openShift = data.teacherAttendance.some((record) => record.teacherId === ownTeacher?.id && !record.checkOutAt);
    return <SummaryStrip items={[[unavailable('classSessions') ? 'No disponible' : data.classSessions.length, 'Clases visibles'], [unavailable('classSessions') ? 'No disponible' : data.classSessions.filter((session) => session.attendanceState !== 'finalized').length, 'Asistencias por cerrar'], [unavailable('teacherAttendance') ? 'No disponible' : openShift ? 'Abierta' : 'Cerrada', 'Jornada docente']]} />;
  }
  if (role === 'BranchDirector') {
    return <SummaryStrip items={[[unavailable('students') ? 'No disponible' : data.students.length, data.branches.length > 1 ? 'Estudiantes asignados' : 'Estudiantes de sede'], [unavailable('teachers') ? 'No disponible' : data.teachers.length, 'Profesores visibles'], [unavailable('absenceJustifications') ? 'No disponible' : data.absenceJustifications.filter((item) => item.status === 'pending').length, 'Justificaciones pendientes']]} />;
  }
  if (role === 'GeneralDirector') {
    return <SummaryStrip items={[[unavailable('students') ? 'No disponible' : data.students.filter((student) => student.active !== false).length, 'Estudiantes activos'], [unavailable('enrollmentRequests') ? 'No disponible' : data.enrollmentRequests.filter((lead) => !['enrolled', 'lost'].includes(lead.status)).length, 'Prospectos abiertos'], [unavailable('absenceJustifications') ? 'No disponible' : data.absenceJustifications.filter((item) => item.status === 'pending').length, 'Justificaciones pendientes']]} />;
  }
  if (role === 'Admin') {
    return <SummaryStrip items={[[unavailable('users') ? 'No disponible' : data.users.filter((user) => user.active !== false).length, 'Usuarios activos'], [unavailable('students') ? 'No disponible' : data.students.length, 'Perfiles académicos'], [unavailable('auditLogs') ? 'No disponible' : data.auditLogs.length, 'Eventos auditados visibles']]} />;
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
      <h2>Gestión de accesos</h2>
      <ul className="simple-list">
        <li><strong>{data.users.length} usuarios activos</strong><span>Controla quién puede ingresar al sistema académico.</span></li>
        <li><strong>Permisos por rol</strong><span>Cada persona ve únicamente las funciones que corresponden a su responsabilidad.</span></li>
        <li><strong>Recuperación de acceso</strong><span>Las cuentas nuevas reciben una clave temporal para activar su ingreso privado.</span></li>
      </ul>
    </section>
  );
}

function AdminAuditPanel({ data }) {
  const [query, setQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const actions = [...new Set(data.auditLogs.map((log) => log.action).filter(Boolean))].sort();
  const visibleLogs = [...data.auditLogs]
    .filter((log) => actionFilter === 'all' || log.action === actionFilter)
    .filter((log) => !query.trim() || JSON.stringify([log.action, log.entityType, log.entityId, log.actorName, log.userName]).toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => new Date(b.createdAt || b.timestamp || 0) - new Date(a.createdAt || a.timestamp || 0))
    .slice(0, 100);
  return (
    <section className="academic-panel audit-panel" id="auditoria">
      <p className="eyebrow">Auditoría</p>
      <h2>Seguimiento de cambios</h2>
      <p>Consulta quién ejecutó una acción sensible, sobre qué registro y cuándo ocurrió.</p>
      <div className="audit-filters"><label>Buscar<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Acción, responsable o registro" /></label><label>Tipo de acción<select value={actionFilter} onChange={(event) => setActionFilter(event.target.value)}><option value="all">Todas</option>{actions.map((action) => <option key={action} value={action}>{action.replaceAll('_', ' ')}</option>)}</select></label></div>
      {visibleLogs.length ? <div className="table-scroll"><table className="data-table"><caption>Últimos {visibleLogs.length} eventos que coinciden con los filtros</caption><thead><tr><th>Fecha</th><th>Acción</th><th>Responsable</th><th>Recurso</th></tr></thead><tbody>{visibleLogs.map((log) => <tr key={log.id}><td>{formatDateTime(log.createdAt || log.timestamp)}</td><td><strong>{String(log.action || 'ACTIVIDAD').replaceAll('_', ' ')}</strong></td><td>{cleanDisplayText(log.actorName || log.userName || log.actorEmail, log.actorId ? `Usuario ${String(log.actorId).slice(0, 8)}` : 'Sistema')}</td><td>{log.entityType || log.resourceType || 'registro'}{log.entityId ? ` · ${String(log.entityId).slice(0, 8)}` : ''}</td></tr>)}</tbody></table></div> : <p className="empty-state">No hay eventos de auditoría para los filtros seleccionados.</p>}
    </section>
  );
}

function AcademyOperationsPanel({ data, role, onOutput, onDataUpdated }) {
  const [section, setSection] = useState('enrollments');
  const groups = data.classGroups || [];
  const sessions = data.classSessions || [];
  const enrollments = data.classGroupEnrollments || [];
  const payments = data.studentPayments || [];
  const [busy, setBusy] = useState('');
  const [enrollmentDrafts, setEnrollmentDrafts] = useState({});
  const [sessionReasons, setSessionReasons] = useState({});
  const [paymentReasons, setPaymentReasons] = useState({});

  const branchName = (id) => data.branches.find((branch) => branch.id === id)?.name || 'Sede';
  const studentName = (id) => data.students.find((student) => student.id === id)?.fullName || 'Estudiante';
  const teacherName = (id) => data.teachers.find((teacher) => teacher.id === id)?.fullName || 'Sin profesor';
  const groupName = (id) => groups.find((group) => group.id === id)?.name || 'Grupo';
  const enrollmentTransitions = {
    active:['active', 'frozen', 'withdrawn', 'completed'],
    trial:['trial', 'active', 'waitlisted', 'withdrawn', 'completed'],
    waitlisted:['waitlisted', 'active', 'trial', 'withdrawn'],
    frozen:['frozen', 'active', 'withdrawn'],
    withdrawn:['withdrawn'],
    completed:['completed'],
  };

  async function createGroup(event) {
    event.preventDefault();
    if (busy) return;
    const form = Object.fromEntries(new FormData(event.currentTarget).entries());
    setBusy('group');
    try {
      const payload = await postJson('/class-groups', {
        branchId:form.branchId,
        name:form.name,
        level:form.level,
        capacity:Number(form.capacity),
        teacherId:form.teacherId || null,
        active:true,
      });
      onDataUpdated('classGroups', (current) => [...current, payload.data]);
      event.currentTarget.reset();
      onOutput({ success:true, message:'Grupo creado con sede, nivel y cupo controlados.' });
    } catch (error) {
      onOutput({ success:false, message:errorMessage(error, 'No se pudo crear el grupo.') });
    } finally { setBusy(''); }
  }

  async function createSession(event) {
    event.preventDefault();
    if (busy) return;
    const form = Object.fromEntries(new FormData(event.currentTarget).entries());
    setBusy('session');
    try {
      const payload = await postJson('/class-sessions', {
        classGroupId:form.classGroupId,
        ...(form.name?.trim() ? { name:form.name.trim() } : {}),
        startsAt:academyLocalToIso(form.startsAt),
        endsAt:academyLocalToIso(form.endsAt),
        status:'scheduled',
      });
      onDataUpdated('classSessions', (current) => [...current, payload.data]);
      event.currentTarget.reset();
      onOutput({ success:true, message:'Clase programada sin conflictos de grupo o profesor.' });
    } catch (error) {
      onOutput({ success:false, message:errorMessage(error, 'No se pudo programar la clase.') });
    } finally { setBusy(''); }
  }

  async function createEnrollment(event) {
    event.preventDefault();
    if (busy) return;
    const form = Object.fromEntries(new FormData(event.currentTarget).entries());
    setBusy('enrollment');
    try {
      const payload = await postJson('/class-group-enrollments', {
        studentId:form.studentId,
        classGroupId:form.classGroupId,
        status:form.status,
      });
      onDataUpdated('classGroupEnrollments', (current) => [...current, payload.data]);
      event.currentTarget.reset();
      onOutput({ success:true, message:payload.data.status === 'waitlisted' ? 'El grupo está lleno; la matrícula quedó en lista de espera.' : 'Matrícula creada correctamente.' });
    } catch (error) {
      onOutput({ success:false, message:errorMessage(error, 'No se pudo crear la matrícula.') });
    } finally { setBusy(''); }
  }

  async function updateEnrollment(enrollment) {
    const draft = enrollmentDrafts[enrollment.id] || { status:enrollment.status, reason:'' };
    if (busy || draft.status === enrollment.status) return;
    setBusy(enrollment.id);
    try {
      const payload = await patchJson(`/class-group-enrollments/${enrollment.id}`, {
        status:draft.status,
        ...(draft.status === 'withdrawn' ? { withdrawalReason:draft.reason.trim() } : {}),
      });
      onDataUpdated('classGroupEnrollments', (current) => current.map((item) => item.id === enrollment.id ? payload.data : item));
      setEnrollmentDrafts((current) => ({ ...current, [enrollment.id]:{ status:payload.data.status, reason:'' } }));
      onOutput({ success:true, message:payload.data.status === 'waitlisted' && draft.status !== 'waitlisted' ? 'No había cupo; el estudiante permanece en lista de espera.' : 'Estado de matrícula actualizado.' });
    } catch (error) {
      onOutput({ success:false, message:errorMessage(error, 'No se pudo actualizar la matrícula.') });
    } finally { setBusy(''); }
  }

  async function cancelSession(session) {
    const reason = sessionReasons[session.id]?.trim() || '';
    if (busy || reason.length < 5) return;
    setBusy(session.id);
    try {
      const payload = await patchJson(`/class-sessions/${session.id}`, { status:'cancelled', cancellationReason:reason });
      onDataUpdated('classSessions', (current) => current.map((item) => item.id === session.id ? payload.data : item));
      onOutput({ success:true, message:'Clase cancelada con motivo y responsable auditados.' });
    } catch (error) {
      onOutput({ success:false, message:errorMessage(error, 'No se pudo cancelar la clase.') });
    } finally { setBusy(''); }
  }

  async function createCharge(event) {
    event.preventDefault();
    if (busy) return;
    const form = Object.fromEntries(new FormData(event.currentTarget).entries());
    setBusy('payment');
    try {
      const payload = await postJson('/student-payments', {
        studentId:form.studentId,
        concept:form.concept,
        period:form.period,
        amount:Number(form.amount),
        status:form.status,
        ...(form.dueAt ? { dueAt:academyLocalToIso(form.dueAt) } : {}),
      });
      onDataUpdated('studentPayments', (current) => [...current, payload.data]);
      event.currentTarget.reset();
      onOutput({ success:true, message:form.status === 'paid' ? 'Cobro registrado y conciliado.' : 'Obligación agregada al estado de cuenta.' });
    } catch (error) {
      onOutput({ success:false, message:errorMessage(error, 'No se pudo registrar el movimiento financiero.') });
    } finally { setBusy(''); }
  }

  async function updatePayment(payment, action) {
    const reason = paymentReasons[payment.id]?.trim() || '';
    if (busy || ((action === 'cancel' || action === 'reverse') && reason.length < 5)) return;
    setBusy(payment.id);
    try {
      if (action === 'reverse') {
        const payload = await postJson(`/student-payments/${payment.id}/reversal`, { reason });
        onDataUpdated('studentPayments', (current) => [...current, payload.data]);
        onOutput({ success:true, message:'Reverso contable creado; el movimiento original se conservó.' });
      } else {
        const payload = await patchJson(`/student-payments/${payment.id}`, action === 'paid'
          ? { status:'paid' }
          : { status:'cancelled', correctionReason:reason });
        onDataUpdated('studentPayments', (current) => current.map((item) => item.id === payment.id ? payload.data : item));
        onOutput({ success:true, message:action === 'paid' ? 'Pago marcado como cobrado.' : 'Obligación cancelada con motivo.' });
      }
      setPaymentReasons((current) => ({ ...current, [payment.id]:'' }));
    } catch (error) {
      onOutput({ success:false, message:errorMessage(error, 'No se pudo actualizar el movimiento financiero.') });
    } finally { setBusy(''); }
  }

  const tabs = [
    ['enrollments', 'Matrículas'],
    ['groups', 'Grupos'],
    ['sessions', 'Agenda'],
    ['payments', 'Cartera'],
  ];
  const nowLocal = toAcademyDateTimeLocal(new Date());

  return (
    <section className="academic-panel operations-panel" id="academia">
      <p className="eyebrow">Operación académica</p>
      <h2>Control diario de la academia</h2>
      <p>Cada cambio valida sede, nivel, cupo, horario y trazabilidad antes de guardarse.</p>
      <div className="module-tabs" role="tablist" aria-label="Áreas operativas">{tabs.map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={section === id} className={section === id ? 'active' : 'secondary-action'} onClick={() => setSection(id)}>{label}</button>)}</div>

      {section === 'enrollments' && <div className="operations-layout"><form className="operations-form" onSubmit={createEnrollment}><h3>Nueva matrícula</h3><label>Estudiante<select name="studentId" required><option value="">Selecciona</option>{data.students.filter((student) => student.active !== false).map((student) => <option key={student.id} value={student.id}>{student.fullName} · {student.level} · {branchName(student.branchId)}</option>)}</select></label><label>Grupo<select name="classGroupId" required><option value="">Selecciona</option>{groups.filter((group) => group.active !== false).map((group) => <option key={group.id} value={group.id}>{group.name} · {group.level} · {branchName(group.branchId)}</option>)}</select></label><label>Tipo<select name="status" defaultValue="active"><option value="active">Regular</option><option value="trial">Prueba</option><option value="waitlisted">Lista de espera</option></select></label><button disabled={Boolean(busy)}>{busy === 'enrollment' ? 'Guardando...' : 'Crear matrícula'}</button></form><div><h3>Matrículas visibles</h3>{enrollments.length ? <ul className="simple-list compact-list">{enrollments.map((enrollment) => { const draft = enrollmentDrafts[enrollment.id] || { status:enrollment.status, reason:'' }; const terminal = ['withdrawn', 'completed'].includes(enrollment.status); return <li key={enrollment.id}><strong>{studentName(enrollment.studentId)}</strong><span>{groupName(enrollment.classGroupId)} · {statusLabel(enrollment.status)}</span>{!terminal && <><label>Nuevo estado<select value={draft.status} onChange={(event) => setEnrollmentDrafts((current) => ({ ...current, [enrollment.id]:{ ...draft, status:event.target.value } }))}>{(enrollmentTransitions[enrollment.status] || [enrollment.status]).map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}</select></label>{draft.status === 'withdrawn' && <label>Motivo de retiro<textarea value={draft.reason} minLength="3" maxLength="500" onChange={(event) => setEnrollmentDrafts((current) => ({ ...current, [enrollment.id]:{ ...draft, reason:event.target.value } }))} /></label>}{draft.status !== enrollment.status && <button type="button" onClick={() => updateEnrollment(enrollment)} disabled={busy === enrollment.id || (draft.status === 'withdrawn' && draft.reason.trim().length < 3)}>Aplicar estado</button>}</>}</li>; })}</ul> : <p className="empty-state">No hay matrículas visibles.</p>}</div></div>}

      {section === 'groups' && <div className="operations-layout"><form className="operations-form" onSubmit={createGroup}><h3>Crear grupo</h3><label>Sede<select name="branchId" required><option value="">Selecciona</option>{data.branches.filter((branch) => branch.active !== false).map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label><label>Nombre<input name="name" minLength="2" maxLength="120" required /></label><label>Nivel<select name="level" defaultValue="B1"><option>B1</option><option>B2</option></select></label><label>Cupo<input name="capacity" type="number" min="1" max="200" defaultValue="30" required /></label><label>Profesor<select name="teacherId"><option value="">Por asignar</option>{data.teachers.filter((teacher) => teacher.active !== false).map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.fullName} · {branchName(teacher.branchId)}</option>)}</select></label><button disabled={Boolean(busy)}>{busy === 'group' ? 'Creando...' : 'Crear grupo'}</button></form><div><h3>Grupos activos</h3>{groups.length ? <ul className="simple-list compact-list">{groups.map((group) => { const occupied = enrollments.filter((enrollment) => enrollment.classGroupId === group.id && ['active', 'trial'].includes(enrollment.status)).length; return <li key={group.id}><strong>{group.name} · {group.level}</strong><span>{branchName(group.branchId)} · {teacherName(group.teacherId)}</span><span>{occupied} de {group.capacity || 30} cupos ocupados</span></li>; })}</ul> : <p className="empty-state">No hay grupos visibles.</p>}</div></div>}

      {section === 'sessions' && <div className="operations-layout"><form className="operations-form" onSubmit={createSession}><h3>Programar clase</h3><label>Grupo<select name="classGroupId" required><option value="">Selecciona</option>{groups.filter((group) => group.active !== false).map((group) => <option key={group.id} value={group.id}>{group.name} · {teacherName(group.teacherId)}</option>)}</select></label><label>Nombre opcional<input name="name" minLength="2" maxLength="120" /></label><label>Inicio<input name="startsAt" type="datetime-local" min={nowLocal} required /></label><label>Fin<input name="endsAt" type="datetime-local" min={nowLocal} required /></label><button disabled={Boolean(busy)}>{busy === 'session' ? 'Programando...' : 'Programar clase'}</button></form><div><h3>Agenda visible</h3>{sessions.length ? <ul className="simple-list compact-list">{[...sessions].sort((a, b) => new Date(b.startsAt) - new Date(a.startsAt)).slice(0, 20).map((session) => <li key={session.id}><strong>{session.name || groupName(session.classGroupId)}</strong><span>{formatDateTime(session.startsAt)} · {statusLabel(session.status)}</span>{session.status === 'scheduled' && <><label>Motivo para cancelar<textarea value={sessionReasons[session.id] || ''} minLength="5" maxLength="500" onChange={(event) => setSessionReasons((current) => ({ ...current, [session.id]:event.target.value }))} /></label><button type="button" className="secondary-action danger-action" onClick={() => cancelSession(session)} disabled={busy === session.id || (sessionReasons[session.id]?.trim().length || 0) < 5}>Cancelar clase</button></>}</li>)}</ul> : <p className="empty-state">No hay clases visibles.</p>}</div></div>}

      {section === 'payments' && <div className="operations-layout"><form className="operations-form" onSubmit={createCharge}><h3>Registrar obligación o cobro</h3><label>Estudiante<select name="studentId" required><option value="">Selecciona</option>{data.students.filter((student) => student.active !== false).map((student) => <option key={student.id} value={student.id}>{student.fullName} · {branchName(student.branchId)}</option>)}</select></label><label>Concepto<input name="concept" minLength="3" maxLength="100" defaultValue="Mensualidad" required /></label><label>Periodo<input name="period" type="month" defaultValue={nowLocal.slice(0, 7)} required /></label><label>Valor<input name="amount" type="number" min="0.01" max="100000000" step="0.01" required /></label><label>Vencimiento<input name="dueAt" type="datetime-local" /></label><label>Estado<select name="status" defaultValue="pending"><option value="pending">Pendiente</option><option value="paid">Cobrado</option></select></label><button disabled={Boolean(busy)}>{busy === 'payment' ? 'Registrando...' : 'Registrar movimiento'}</button></form><div><h3>Últimos movimientos</h3>{payments.length ? <ul className="simple-list compact-list">{[...payments].sort((a, b) => new Date(b.createdAt || b.paidAt || 0) - new Date(a.createdAt || a.paidAt || 0)).slice(0, 30).map((payment) => <li key={payment.id}><div className="list-heading-row"><strong>{studentName(payment.studentId)} · {payment.concept}</strong><span className={`status-chip payment-${payment.status}`}>{statusLabel(payment.status)}</span></div><span>{formatMoney(payment.amount)} · {payment.period}</span>{['pending', 'overdue'].includes(payment.status) && <div className="button-row compact"><button type="button" onClick={() => updatePayment(payment, 'paid')} disabled={busy === payment.id}>Marcar cobrado</button></div>}{(['pending', 'overdue'].includes(payment.status) || (payment.status === 'paid' && role !== 'BranchDirector' && payment.transactionType !== 'reversal')) && <label>{payment.status === 'paid' ? 'Motivo del reverso' : 'Motivo de cancelación'}<textarea value={paymentReasons[payment.id] || ''} minLength="5" maxLength="500" onChange={(event) => setPaymentReasons((current) => ({ ...current, [payment.id]:event.target.value }))} /></label>}{['pending', 'overdue'].includes(payment.status) && <button type="button" className="secondary-action danger-action" onClick={() => updatePayment(payment, 'cancel')} disabled={busy === payment.id || (paymentReasons[payment.id]?.trim().length || 0) < 5}>Cancelar obligación</button>}{payment.status === 'paid' && role !== 'BranchDirector' && payment.transactionType !== 'reversal' && <button type="button" className="secondary-action danger-action" onClick={() => updatePayment(payment, 'reverse')} disabled={busy === payment.id || (paymentReasons[payment.id]?.trim().length || 0) < 5}>Crear reverso</button>}</li>)}</ul> : <p className="empty-state">No hay movimientos financieros visibles.</p>}</div></div>}
    </section>
  );
}

function AdminOverviewPanel({ data }) {
  return (
    <section className="academic-panel admin-overview-panel" id="indicadores">
      <p className="eyebrow">Administración general</p>
      <h2>Control completo de American Latin Class</h2>
      <p>El administrador puede acompañar cuentas, sedes, estudiantes, profesores, eventos, solicitudes, reportes y seguridad institucional.</p>
      <div className="admin-control-grid">
        <article>
          <strong>{data.users.length}</strong>
          <span>Cuentas registradas</span>
          <p>Usuarios internos con acceso al panel académico.</p>
        </article>
        <article>
          <strong>{data.branches.length}</strong>
          <span>Sedes visibles</span>
          <p>Base operativa para estudiantes, profesores y reportes.</p>
        </article>
        <article>
          <strong>{data.students.length}</strong>
          <span>Estudiantes</span>
          <p>Perfiles académicos activos o retirados.</p>
        </article>
        <article>
          <strong>{data.teachers.length}</strong>
          <span>Profesores</span>
          <p>Equipo docente asociado a sedes y clases.</p>
        </article>
      </div>
    </section>
  );
}

function AccountCreationPanel({ role = 'Admin' }) {
  const [status, setStatus] = useState('');
  const [createdAccount, setCreatedAccount] = useState(null);
  const [selectedRole, setSelectedRole] = useState('Student');
  const [availableBranches, setAvailableBranches] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const visibleRoleOptions = role === 'Admin'
    ? accountRoleOptions
    : accountRoleOptions.filter((option) => option.value !== 'GeneralDirector');

  useEffect(() => {
    apiRequest('/branches')
      .then((payload) => setAvailableBranches(payload.data || []))
      .catch(() => setAvailableBranches([]));
  }, []);

  async function submit(event) {
    event.preventDefault();
    if (submitting) return;
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
    if (form.role === 'BranchDirector' && !body.branchIds.length) {
      setStatus('Selecciona al menos una sede para el director de sede.');
      return;
    }
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

    setSubmitting(true);
    try {
      const payload = await postJson('/users', body);
      setCreatedAccount(payload.data);
      setStatus('Cuenta creada correctamente.');
      event.currentTarget.reset();
      setSelectedRole('Student');
    } catch (error) {
      setStatus(errorMessage(error, 'No se pudo crear la cuenta. Revisa el correo, el rol y las sedes asignadas.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="academic-panel account-panel" id="cuentas" aria-label="Creación de cuentas">
      <div>
        <p className="eyebrow">Cuentas</p>
        <h2>Enviar invitación de acceso</h2>
        <p>Registra a una persona autorizada. El sistema generará una clave temporal de un solo uso para su primer ingreso.</p>
      </div>
      <form className="account-form" onSubmit={submit} aria-busy={submitting}>
        <label>Nombre completo<input name="name" autoComplete="name" required /></label>
        <label>Correo electrónico<input name="email" type="email" autoComplete="email" required /></label>
        <label>Rol<select name="role" value={selectedRole} onChange={(event) => setSelectedRole(event.target.value)} required>{visibleRoleOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
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
        <button type="submit" disabled={submitting}>{submitting ? 'Generando...' : 'Generar invitación'}</button>
      </form>
      {createdAccount && (
        <div className="credential-box" aria-live="polite">
          <span>Clave temporal generada</span>
          <strong>{createdAccount.temporaryPassword}</strong>
          <p>Esta clave se muestra una sola vez. La persona deberá cambiarla en su primer ingreso.</p>
          <button type="button" className="secondary-action" onClick={async () => { try { await navigator.clipboard.writeText(createdAccount.temporaryPassword); setStatus('Clave temporal copiada. Compártela por un canal seguro.'); } catch { setStatus('No se pudo copiar automáticamente. Selecciona la clave y cópiala manualmente.'); } }}>Copiar clave temporal</button>
        </div>
      )}
      <p className="form-status" aria-live="polite">{status}</p>
    </section>
  );
}

function PasswordChangeRequired({ user, onChanged }) {
  const [status, setStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (submitting) return;
    setStatus('');
    const form = Object.fromEntries(new FormData(event.currentTarget).entries());
    if (form.newPassword !== form.confirmPassword) {
      setStatus('La nueva contraseña y la confirmación no coinciden.');
      return;
    }
    setSubmitting(true);
    try {
      const payload = await postJson('/auth/change-password', {
        currentPassword:form.currentPassword,
        newPassword:form.newPassword,
      });
      onChanged(payload.data.user);
    } catch (error) {
      setStatus(errorMessage(error, 'No se pudo actualizar la contraseña. Revisa la contraseña temporal e intenta nuevamente.'));
    } finally {
      setSubmitting(false);
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
      <form className="password-change-form" onSubmit={submit} aria-busy={submitting}>
        <label>Contraseña temporal<input name="currentPassword" type="password" autoComplete="current-password" minLength="8" required /></label>
        <label>Nueva contraseña<input name="newPassword" type="password" autoComplete="new-password" minLength="10" pattern="(?=.*[A-Za-z])(?=.*[0-9]).{10,}" aria-describedby="password-requirements" required /></label>
        <p className="field-help" id="password-requirements">Usa al menos 10 caracteres e incluye letras y números.</p>
        <label>Confirmar nueva contraseña<input name="confirmPassword" type="password" autoComplete="new-password" minLength="10" required /></label>
        <button type="submit" disabled={submitting}>{submitting ? 'Guardando...' : 'Guardar nueva contraseña'}</button>
        <p className="form-status" aria-live="polite">{status}</p>
      </form>
    </section>
  );
}

function DashboardModuleContent({ role, activeModule, data, onOutput, onProfileUpdated, onDataUpdated }) {
  if (role === 'Student') {
    if (activeModule === 'perfil') return <StudentProfilePanel data={data} onOutput={onOutput} onProfileUpdated={onProfileUpdated} />;
    if (activeModule === 'asistencia') return <StudentAttendanceHistory attendanceRecords={data.attendanceRecords} classSessions={data.classSessions} />;
    if (activeModule === 'justificaciones') return <StudentJustificationPanel attendanceRecords={data.attendanceRecords} onOutput={onOutput} />;
    if (activeModule === 'pagos') return <StudentPaymentsPanel data={data} />;
    if (activeModule === 'eventos') return <StudentEventsPanel events={data.academyEvents} />;
    return <StudentHomePanel data={data} />;
  }

  if (role === 'Teacher') {
    if (activeModule === 'asistencia') return <TeacherAttendanceSheet classSessions={data.classSessions} onOutput={onOutput} onDataUpdated={onDataUpdated} />;
    if (activeModule === 'entrada') return <TeacherCheckInForm teacher={data.teachers[0]} classSessions={data.classSessions} initialRecords={data.teacherAttendance} recordsUnavailable={Boolean(data.resourceErrors.teacherAttendance)} onOutput={onOutput} onDataUpdated={onDataUpdated} />;
    return <TeacherClassPanel data={data} />;
  }

  if (role === 'BranchDirector') {
    if (activeModule === 'academia') return <AcademyOperationsPanel data={data} role={role} onOutput={onOutput} onDataUpdated={onDataUpdated} />;
    if (activeModule === 'eventos') return <EventsManagerPanel data={data} onOutput={onOutput} onDataUpdated={onDataUpdated} />;
    if (activeModule === 'solicitudes') return <DirectorRequestsPanel data={data} onOutput={onOutput} onDataUpdated={onDataUpdated} />;
    if (activeModule === 'reportes') return <ReportsPanel data={data} role={role} onOutput={onOutput} />;
    return <SupervisorPanel role={role} data={data} />;
  }

  if (role === 'GeneralDirector') {
    if (activeModule === 'academia') return <AcademyOperationsPanel data={data} role={role} onOutput={onOutput} onDataUpdated={onDataUpdated} />;
    if (activeModule === 'cuentas') return <AccountCreationPanel role={role} />;
    if (activeModule === 'eventos') return <EventsManagerPanel data={data} onOutput={onOutput} onDataUpdated={onDataUpdated} />;
    if (activeModule === 'solicitudes') return <DirectorRequestsPanel data={data} onOutput={onOutput} onDataUpdated={onDataUpdated} />;
    if (activeModule === 'reportes') return <ReportsPanel data={data} role={role} onOutput={onOutput} />;
    if (activeModule === 'auditoria') return <AdminAuditPanel data={data} />;
    return <SupervisorPanel role={role} data={data} />;
  }

  if (role === 'Admin') {
    if (activeModule === 'indicadores') return <AdminOverviewPanel data={data} />;
    if (activeModule === 'seguridad') return <AdminSecurityPanel data={data} />;
    if (activeModule === 'auditoria') return <AdminAuditPanel data={data} />;
    if (activeModule === 'academia') return <AcademyOperationsPanel data={data} role={role} onOutput={onOutput} onDataUpdated={onDataUpdated} />;
    if (activeModule === 'eventos') return <EventsManagerPanel data={data} onOutput={onOutput} onDataUpdated={onDataUpdated} />;
    if (activeModule === 'solicitudes') return <DirectorRequestsPanel data={data} onOutput={onOutput} onDataUpdated={onDataUpdated} />;
    if (activeModule === 'reportes') return <ReportsPanel data={data} role={role} onOutput={onOutput} />;
    return <AccountCreationPanel role={role} />;
  }

  return (
    <section className="academic-panel">
      <p className="eyebrow">Panel académico</p>
      <h2>Resumen</h2>
      <p>Tu información estará disponible cuando la cuenta tenga un rol asignado.</p>
    </section>
  );
}

function PrivateDashboard() {
  const [output, setOutput] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [dashboardData, setDashboardData] = useState(() => createEmptyDashboardData());
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [activeModule, setActiveModule] = useState('inicio');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [introVisible, setIntroVisible] = useState(true);
  const reducedMotion = usePrefersReducedMotion();

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
    setDashboardData(createEmptyDashboardData());
    setDashboardLoading(true);
    loadDashboardData(currentUser.role)
      .then((data) => {
        if (mounted) setDashboardData(data);
      })
      .finally(() => {
        if (mounted) setDashboardLoading(false);
      });
    return () => { mounted = false; };
  }, [sessionReady, currentUser?.role, currentUser?.mustChangePassword, reloadKey]);

  useEffect(() => {
    if (currentUser?.role) {
      setActiveModule(firstDashboardModule(currentUser.role));
      setOutput(null);
    }
  }, [currentUser?.role]);

  useEffect(() => {
    if (!sessionReady || !currentUser || currentUser.mustChangePassword) return undefined;
    setIntroVisible(true);
    if (reducedMotion) return undefined;
    const timer = setTimeout(() => setIntroVisible(false), 4200);
    return () => clearTimeout(timer);
  }, [sessionReady, currentUser?.id, currentUser?.mustChangePassword, reducedMotion]);

  function changeModule(moduleId) {
    setActiveModule(moduleId);
    setOutput(null);
    window.setTimeout(() => document.querySelector('.dashboard-workspace')?.focus(), 0);
  }

  function updateStudentProfile(profile) {
    setDashboardData((current) => ({
      ...current,
      students:current.students.map((student) => (student.id === profile.id ? profile : student)),
    }));
  }

  function updateDashboardCollection(key, updater) {
    setDashboardData((current) => ({
      ...current,
      [key]:typeof updater === 'function' ? updater(current[key] || []) : updater,
    }));
  }

  const selectedModule = currentUser?.role && (roleModuleLinks[currentUser.role] || []).some((link) => link.id === activeModule)
    ? activeModule
    : firstDashboardModule(currentUser?.role);

  return (
    <div className="dashboard-shell">
      <a className="skip-link" href="#main-content">Saltar al contenido principal</a>
      <div className={`dashboard-layout ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        {sessionReady && currentUser && !currentUser.mustChangePassword && (
          <aside className="dashboard-sidebar" aria-label="Menú del panel">
            <div className="sidebar-header">
              <a className="brand" href="/">
                <span className="brand-mark">ALC</span>
                <span className="brand-text">American Latin Class</span>
              </a>
              <button
                type="button"
                className="sidebar-toggle"
                aria-label={sidebarCollapsed ? 'Mostrar menú lateral' : 'Ocultar menú lateral'}
                aria-pressed={sidebarCollapsed}
                onClick={() => setSidebarCollapsed((current) => !current)}
              >
                <span />
                <span />
              </button>
            </div>
            <div className={`sidebar-profile ${introVisible && !reducedMotion ? 'waiting-avatar' : 'avatar-ready'}`}>
              <UserAvatar user={currentUser} profile={currentUser.role === 'Student' ? studentProfile(dashboardData) : null} />
              <strong>{displayUserName(currentUser)}</strong>
              <span>{roleLabels[currentUser.role] || 'Usuario'}</span>
            </div>
            <ModuleNavigation role={currentUser.role} activeModule={selectedModule} onChange={changeModule} />
            <div className="sidebar-actions">
              <a href="/" data-short="IN"><span>Inicio</span></a>
              <LogoutButton />
            </div>
          </aside>
        )}
        <main className="dashboard-main" id="main-content" tabIndex="-1" aria-busy={dashboardLoading}>
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
            <DashboardIntro user={currentUser} data={dashboardData} visible={introVisible} onDismiss={() => setIntroVisible(false)} />
            <section className="dashboard-workspace" aria-label="Contenido del módulo activo" tabIndex="-1">
              {dashboardLoading ? <div className="dashboard-loading" role="status"><span className="loading-spinner" aria-hidden="true" /><div><strong>Cargando información académica</strong><p>Validamos cada fuente antes de mostrar indicadores.</p></div></div> : <><DataHealthBanner errors={dashboardData.resourceErrors} onRetry={() => setReloadKey((current) => current + 1)} /><RoleSummary role={currentUser.role} data={dashboardData} /><DashboardModuleContent role={currentUser.role} activeModule={selectedModule} data={dashboardData} onOutput={setOutput} onProfileUpdated={updateStudentProfile} onDataUpdated={updateDashboardCollection} /><FriendlyOutput output={output} /></>}
            </section>
          </>
        )}
        </main>
      </div>
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
