const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

const APP_URL = process.env.UI_EVIDENCE_BASE_URL || 'http://127.0.0.1:3005';
const CHROME_PATH = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUTPUT_DIR = path.resolve(__dirname, '..', '..', '07Other', 'visual-evidence', 'defense');

const accounts = {
  admin:{ email:process.env.SEED_ADMIN_EMAIL, password:process.env.SEED_ADMIN_PASSWORD },
  generalDirector:{ email:process.env.SEED_GENERAL_DIRECTOR_EMAIL, password:process.env.SEED_GENERAL_DIRECTOR_PASSWORD },
  branchDirector:{ email:process.env.SEED_BRANCH_DIRECTOR_NORTH_EMAIL || process.env.SEED_BRANCH_DIRECTOR_EMAIL, password:process.env.SEED_BRANCH_DIRECTOR_PASSWORD },
  teacher:{ email:process.env.SEED_TEACHER_EMAIL, password:process.env.SEED_TEACHER_PASSWORD },
  student:{ email:process.env.SEED_STUDENT_EMAIL, password:process.env.SEED_STUDENT_PASSWORD },
};

const supplementalModules = {
  admin:[
    ['Academia', 'academy'],
    ['Eventos', 'events'],
    ['Solicitudes', 'requests'],
    ['Seguridad', 'security'],
    ['Auditoría', 'audit'],
  ],
  generalDirector:[
    ['Operación', 'operations'],
    ['Eventos', 'events'],
    ['Solicitudes', 'requests'],
    ['Auditoría', 'audit'],
  ],
  branchDirector:[
    ['Operación', 'operations'],
    ['Eventos', 'events'],
    ['Solicitudes', 'requests'],
  ],
  teacher:[
    ['Asistencia', 'attendance'],
    ['Mi entrada', 'check-in'],
  ],
  student:[
    ['Perfil', 'profile'],
    ['Asistencia', 'attendance'],
    ['Justificaciones', 'justifications'],
    ['Pagos', 'payments'],
    ['Eventos', 'events'],
  ],
};

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

class CdpClient {
  constructor(webSocketUrl) {
    this.socket = new WebSocket(webSocketUrl);
    this.sequence = 0;
    this.pending = new Map();
  }

  async connect() {
    await new Promise((resolve, reject) => {
      this.socket.addEventListener('open', resolve, { once:true });
      this.socket.addEventListener('error', reject, { once:true });
    });
    this.socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (!message.id || !this.pending.has(message.id)) return;
      const { resolve, reject } = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result || {});
    });
  }

  send(method, params = {}) {
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.socket.close();
  }
}

async function waitForJson(url, attempts = 80) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
    } catch {
      // Chrome may need a moment to expose its debugging endpoint.
    }
    await delay(100);
  }
  throw new Error(`Chrome debugging endpoint did not start: ${url}`);
}

async function launchBrowser() {
  if (!fs.existsSync(CHROME_PATH)) throw new Error(`Chrome was not found at ${CHROME_PATH}`);
  const port = 10000 + crypto.randomInt(20000);
  const profilePath = path.join(os.tmpdir(), `alc-ui-evidence-${crypto.randomUUID()}`);
  const processHandle = spawn(CHROME_PATH, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--no-first-run',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profilePath}`,
    'about:blank',
  ], { stdio:'ignore', windowsHide:true });
  await waitForJson(`http://127.0.0.1:${port}/json/version`);
  const targetResponse = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent('about:blank')}`, { method:'PUT' });
  if (!targetResponse.ok) throw new Error('Chrome could not create a page target.');
  const target = await targetResponse.json();
  const client = new CdpClient(target.webSocketDebuggerUrl);
  await client.connect();
  await client.send('Page.enable');
  await client.send('Runtime.enable');
  await client.send('Network.enable');
  return { client, processHandle };
}

async function stopBrowser(browser) {
  try {
    await browser.client.send('Browser.close');
  } catch {
    browser.processHandle.kill();
  } finally {
    browser.client.close();
  }
}

async function setViewport(client, width, height, mobile = false) {
  await client.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor:1,
    mobile,
    screenWidth:width,
    screenHeight:height,
  });
}

async function navigate(client, url, waitMilliseconds = 1600) {
  await client.send('Page.navigate', { url });
  await delay(waitMilliseconds);
}

async function evaluate(client, expression) {
  const response = await client.send('Runtime.evaluate', {
    expression,
    awaitPromise:true,
    returnByValue:true,
  });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text || 'Browser evaluation failed.');
  return response.result?.value;
}

async function screenshot(client, filename) {
  const image = await client.send('Page.captureScreenshot', {
    format:'png',
    fromSurface:true,
    captureBeyondViewport:false,
  });
  fs.writeFileSync(path.join(OUTPUT_DIR, filename), Buffer.from(image.data, 'base64'));
}

async function waitFor(client, expression, description, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await evaluate(client, `Boolean(${expression})`)) return;
    await delay(250);
  }
  throw new Error(`Timed out waiting for ${description}`);
}

async function waitForDashboard(client) {
  const readyExpression = "document.querySelector('.dashboard-layout') && document.querySelector('.dashboard-main[aria-busy=\"false\"] .summary-strip') && !document.querySelector('.dashboard-loading')";
  await waitFor(client, readyExpression, 'the academic dashboard to finish loading', 25000);
  await delay(800);
  await waitFor(client, readyExpression, 'the academic dashboard to remain ready', 25000);
}

async function waitForReport(client) {
  await waitFor(
    client,
    "document.querySelector('.reports-panel') && !document.querySelector('.reports-panel .loading-state') && (document.querySelector('.reports-panel .report-freshness') || document.querySelector('.reports-panel .inline-alert.error'))",
    'the report to finish generating',
    25000,
  );
}

async function clickButton(client, label) {
  const buttonExpression = `[...document.querySelectorAll('button')]
    .find((item) => item.textContent.trim() === ${JSON.stringify(label)})`;
  await waitFor(client, buttonExpression, `button '${label}'`);
  await evaluate(client, `(${buttonExpression}).click()`);
}

async function clickButtonContaining(client, label) {
  const buttonExpression = `[...document.querySelectorAll('button')]
    .find((item) => item.textContent.includes(${JSON.stringify(label)}))`;
  await waitFor(client, buttonExpression, `button containing '${label}'`);
  await evaluate(client, `(${buttonExpression}).click()`);
}

async function login(account) {
  if (!account.email || !account.password) throw new Error('A seed account is missing from 06Code/.env.');
  const response = await fetch(`${APP_URL}/api/v1/auth/login`, {
    method:'POST',
    headers:{ 'Content-Type':'application/json' },
    body:JSON.stringify(account),
  });
  if (!response.ok) throw new Error(`Login failed for ${account.email}: ${response.status}`);
  const setCookie = response.headers.getSetCookie?.()[0] || response.headers.get('set-cookie');
  if (!setCookie) throw new Error(`The login response did not set a session cookie for ${account.email}.`);
  const [nameValue] = setCookie.split(';');
  const separator = nameValue.indexOf('=');
  return { name:nameValue.slice(0, separator), value:nameValue.slice(separator + 1) };
}

async function capturePublicPages() {
  const browser = await launchBrowser();
  try {
    await setViewport(browser.client, 1440, 900);
    await navigate(browser.client, `${APP_URL}/`);
    await waitFor(browser.client, "document.querySelector('.cyber-hero-media video')?.readyState >= 2 && !document.querySelector('.cyber-hero-media video')?.paused", 'the hero video to start');
    await screenshot(browser.client, 'visitor-home-desktop.png');
    for (const [section, filename] of [
      ['programs', 'visitor-programs-desktop.png'],
      ['branches', 'visitor-branches-desktop.png'],
      ['enroll', 'visitor-enrollment-desktop.png'],
    ]) {
      await evaluate(browser.client, `document.getElementById(${JSON.stringify(section)})?.scrollIntoView({ block:'start' })`);
      await delay(section === 'branches' ? 5000 : 500);
      if (section === 'programs') {
        await waitFor(browser.client, "document.querySelector('.cyber-hero-media video')?.paused", 'the off-screen hero video to pause');
      }
      await screenshot(browser.client, filename);
      if (section === 'branches') {
        for (const [index, branchName] of ['norte', 'quitumbe', 'tumbaco', 'conocoto'].entries()) {
          await evaluate(browser.client, `document.querySelectorAll('.cyber-branch-item')[${index + 1}]?.click()`);
          await delay(3000);
          await screenshot(browser.client, `visitor-branches-${branchName}-desktop.png`);
        }
      }
    }
    await navigate(browser.client, `${APP_URL}/login`);
    await screenshot(browser.client, 'login-desktop.png');
    const backButtonCenter = await evaluate(browser.client, `(() => {
      const button = document.querySelector('.login-page .secondary-button');
      if (!button) return null;
      const rect = button.getBoundingClientRect();
      return { x:rect.left + rect.width / 2, y:rect.top + rect.height / 2 };
    })()`);
    if (backButtonCenter) {
      await browser.client.send('Input.dispatchMouseEvent', { type:'mouseMoved', ...backButtonCenter });
      await delay(300);
      await screenshot(browser.client, 'login-back-button-hover-desktop.png');
    }
    await setViewport(browser.client, 390, 844, true);
    await navigate(browser.client, `${APP_URL}/`);
    if (process.env.DEBUG_UI_EVIDENCE === 'true') {
      const heroDebug = await evaluate(browser.client, `(() => {
        const grid = document.querySelector('.cyber-hero-grid');
        const media = document.querySelector('.cyber-hero-media');
        const video = document.querySelector('.cyber-hero-media video');
        const describe = (element) => element ? {
          rect:element.getBoundingClientRect().toJSON(),
          display:getComputedStyle(element).display,
          position:getComputedStyle(element).position,
          zIndex:getComputedStyle(element).zIndex,
          opacity:getComputedStyle(element).opacity,
        } : null;
        return { grid:describe(grid), media:describe(media), video:{ ...describe(video), readyState:video?.readyState, paused:video?.paused, currentSrc:video?.currentSrc } };
      })()`);
      process.stdout.write(`Hero mobile debug: ${JSON.stringify(heroDebug)}\n`);
    }
    await screenshot(browser.client, 'visitor-home-mobile.png');
    await evaluate(browser.client, "document.getElementById('branches')?.scrollIntoView({ block:'start' })");
    await delay(5000);
    await screenshot(browser.client, 'visitor-branches-mobile.png');
    await evaluate(browser.client, "document.querySelector('.cyber-branches-side')?.scrollIntoView({ block:'start' })");
    await delay(300);
    await screenshot(browser.client, 'visitor-branch-selector-mobile.png');
    await navigate(browser.client, `${APP_URL}/login`);
    await screenshot(browser.client, 'login-mobile.png');
  } finally {
    await stopBrowser(browser);
  }
}

async function captureRole(roleName, account) {
  const cookie = await login(account);
  const browser = await launchBrowser();
  try {
    await setViewport(browser.client, 1440, 900);
    await browser.client.send('Network.setCookie', {
      name:cookie.name,
      value:cookie.value,
      url:APP_URL,
      path:'/',
      httpOnly:true,
    });
    await navigate(browser.client, `${APP_URL}/private/dashboard.html`, 1800);
    await screenshot(browser.client, `${roleName}-welcome.png`);
    await waitForDashboard(browser.client);
    await delay(4200);
    if (process.env.DEBUG_UI_EVIDENCE === 'true') {
      const desktopDashboardDebug = await evaluate(browser.client, `(() => {
        const describe = (selector) => {
          const element = document.querySelector(selector);
          return element ? { rect:element.getBoundingClientRect().toJSON(), scrollTop:element.scrollTop } : null;
        };
        return {
          windowScrollY:window.scrollY,
          documentHeight:document.documentElement.scrollHeight,
          sidebar:describe('.dashboard-sidebar'),
          header:describe('.sidebar-header'),
          profile:describe('.sidebar-profile'),
          main:describe('.dashboard-main'),
          summary:describe('.summary-strip'),
        };
      })()`);
      process.stdout.write(`Dashboard desktop debug: ${JSON.stringify(desktopDashboardDebug)}\n`);
    }
    await screenshot(browser.client, `${roleName}-dashboard.png`);

    if (['admin', 'generalDirector'].includes(roleName)) {
      await clickButton(browser.client, 'Cuentas');
      await delay(1000);
      await screenshot(browser.client, `${roleName}-accounts.png`);
    }

    if (['admin', 'generalDirector', 'branchDirector'].includes(roleName)) {
      await clickButton(browser.client, 'Reportes');
      await delay(300);
      await screenshot(browser.client, `${roleName}-reports-index.png`);
      await clickButtonContaining(browser.client, 'Reporte financiero');
      await waitForReport(browser.client);
      await delay(300);
      await screenshot(browser.client, `${roleName}-reports-overview.png`);
      await clickButton(browser.client, 'Volver al índice de reportes');
      await clickButtonContaining(browser.client, 'Reporte de asistencia');
      await delay(100);
      await waitForReport(browser.client);
      await delay(300);
      await evaluate(browser.client, `window.scrollTo({ top:0, left:0, behavior:'instant' })`);
      await screenshot(browser.client, `${roleName}-reports-attendance.png`);
    }

    for (const [label, filename] of supplementalModules[roleName] || []) {
      await clickButton(browser.client, label);
      await delay(700);
      await screenshot(browser.client, `${roleName}-${filename}.png`);
      if (filename === 'operations') {
        await clickButton(browser.client, 'Nueva matrícula');
        await delay(250);
        await screenshot(browser.client, `${roleName}-operations-new-enrollment-modal.png`);
        await evaluate(browser.client, "document.querySelector('.modal-dialog .icon-close-button')?.click()");
      }
      if (filename === 'events') {
        await clickButton(browser.client, 'Nuevo evento');
        await delay(250);
        await screenshot(browser.client, `${roleName}-events-new-modal.png`);
        await evaluate(browser.client, "document.querySelector('.modal-dialog .icon-close-button')?.click()");
      }
    }

    await setViewport(browser.client, 390, 844, true);
    await navigate(browser.client, `${APP_URL}/private/dashboard.html?evidence=mobile-${roleName}`, 1800);
    await waitForDashboard(browser.client);
    await delay(4200);
    await evaluate(browser.client, `window.scrollTo({ top:0, left:0, behavior:'auto' }); document.querySelector('.dashboard-sidebar')?.scrollTo({ top:0, left:0, behavior:'auto' })`);
    if (process.env.DEBUG_UI_EVIDENCE === 'true') {
      const mobileDashboardDebug = await evaluate(browser.client, `(() => {
        const rect = (selector) => document.querySelector(selector)?.getBoundingClientRect().toJSON();
        return { windowScrollY:window.scrollY, sidebarScrollTop:document.querySelector('.dashboard-sidebar')?.scrollTop, location:window.location.href, sidebar:rect('.dashboard-sidebar'), header:rect('.sidebar-header'), brand:rect('.sidebar-header .brand'), profile:rect('.sidebar-profile') };
      })()`);
      process.stdout.write(`Dashboard mobile debug: ${JSON.stringify(mobileDashboardDebug)}\n`);
    }
    await screenshot(browser.client, `${roleName}-dashboard-mobile.png`);
    if (['admin', 'generalDirector', 'branchDirector'].includes(roleName)) {
      await clickButton(browser.client, 'Operación');
      await delay(500);
      await evaluate(browser.client, "document.querySelector('.operations-panel')?.scrollIntoView({ block:'start' })");
      await screenshot(browser.client, `${roleName}-operations-mobile.png`);
      await clickButton(browser.client, 'Nueva matrícula');
      await delay(250);
      await screenshot(browser.client, `${roleName}-operations-modal-mobile.png`);
      await evaluate(browser.client, "document.querySelector('.modal-dialog .icon-close-button')?.click()");
    }
  } finally {
    await stopBrowser(browser);
  }
}

async function main() {
  if (typeof WebSocket === 'undefined') throw new Error('This script requires Node.js 22 or newer for its built-in WebSocket client.');
  fs.mkdirSync(OUTPUT_DIR, { recursive:true });
  const requested = process.argv[2] || 'all';
  if (requested === 'public' || requested === 'all') await capturePublicPages();
  const selectedAccounts = requested === 'all'
    ? Object.entries(accounts)
    : Object.entries(accounts).filter(([name]) => name === requested);
  if (requested !== 'public' && !selectedAccounts.length) {
    throw new Error(`Unknown role '${requested}'. Use public, all, ${Object.keys(accounts).join(', ')}.`);
  }
  for (const [name, account] of selectedAccounts) await captureRole(name, account);
  process.stdout.write(`UI evidence saved in ${OUTPUT_DIR}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
