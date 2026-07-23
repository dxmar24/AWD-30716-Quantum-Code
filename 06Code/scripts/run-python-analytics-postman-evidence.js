const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
require('dotenv').config({ path:path.join(__dirname, '..', '.env') });

const root = path.join(__dirname, '..', '..');
const collectionPath = path.join(root, 'postman', 'American-Latin-Class-Analytics-API.postman_collection.json');
const evidenceDir = path.join(root, 'postman', 'evidence');
const tmpDir = path.join(evidenceDir, '.tmp-analytics');
const environmentPath = path.join(tmpDir, 'analytics-local.postman_environment.json');
const rawReportPath = path.join(tmpDir, 'analytics-newman.json');
const evidenceJsonPath = path.join(evidenceDir, 'python-analytics-api-evidence.json');
const evidenceMarkdownPath = path.join(evidenceDir, 'python-analytics-api-evidence.md');
const nodeBaseUrl = process.env.LOCAL_NODE_API_URL || 'http://127.0.0.1:3005/api/v1';
const analyticsBaseUrl = process.env.LOCAL_ANALYTICS_API_URL || 'http://127.0.0.1:8005/api/analytics/v1';

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}: ${body.message || body.detail || 'Unknown error'}`);
  return body;
}

async function authenticatedList(pathname, token) {
  const body = await fetchJson(`${nodeBaseUrl}${pathname}`, { headers:{ Authorization:`Bearer ${token}` } });
  if (!Array.isArray(body.data) || !body.data.length) throw new Error(`No records available at ${pathname}`);
  return body.data;
}

function runNewman() {
  const npxCommand = process.platform === 'win32' ? process.execPath : 'npx';
  const npxArguments = process.platform === 'win32'
    ? [path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npx-cli.js')]
    : [];
  const result = spawnSync(npxCommand, [
    ...npxArguments, '--yes', 'newman', 'run', path.relative(root, collectionPath),
    '-e', path.relative(root, environmentPath),
    '--reporters', 'cli,json',
    '--reporter-json-export', path.relative(root, rawReportPath),
  ], {
    cwd:root,
    encoding:'utf8',
    timeout:120000,
    shell:false,
    env:{
      ...process.env,
      NODE_OPTIONS:[process.env.NODE_OPTIONS, '--no-deprecation'].filter(Boolean).join(' '),
    },
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Analytics Newman run failed with exit code ${result.status}`);
}

function writeEvidence(ids) {
  const raw = JSON.parse(fs.readFileSync(rawReportPath, 'utf8'));
  const stats = raw.run.stats;
  const failures = (raw.run.failures || []).map((failure) => ({
    request:failure.source?.name || null,
    assertion:failure.error?.test || null,
    message:failure.error?.message || null,
  }));
  const evidence = {
    generatedAt:new Date().toISOString(),
    collection:'postman/American-Latin-Class-Analytics-API.postman_collection.json',
    target:{ nodeApi:nodeBaseUrl, analyticsApi:analyticsBaseUrl, database:'local PostgreSQL' },
    selectedRecords:ids,
    stats:{
      requests:stats.requests,
      assertions:stats.assertions,
      testScripts:stats.testScripts,
      prerequestScripts:stats.prerequestScripts,
    },
    failures,
    security:'A real Node session token was used in memory and removed with the temporary environment.',
  };
  fs.writeFileSync(evidenceJsonPath, `${JSON.stringify(evidence, null, 2)}\n`);
  fs.writeFileSync(evidenceMarkdownPath, `# Python Analytics API Evidence

Generated: ${evidence.generatedAt}

## Purpose

This evidence proves that the FastAPI analytics microservice runs against the same local PostgreSQL data as the Node application and accepts a real session token issued by the Node authentication service.

## Automated Flow

1. Authenticate as the General Director through the Node API.
2. Discover an existing student, branch and teacher from PostgreSQL through protected Node endpoints.
3. Run the analytics Postman collection with Newman.
4. Verify anonymous rejection, student risk, scholarship readiness, branch performance and teacher workload.
5. Delete the temporary environment containing the session token.

## Result

| Metric | Total | Failed |
| --- | ---: | ---: |
| Requests | ${stats.requests.total} | ${stats.requests.failed} |
| Assertions | ${stats.assertions.total} | ${stats.assertions.failed} |
| Test scripts | ${stats.testScripts.total} | ${stats.testScripts.failed} |

Selected persisted records:

- Student: \`${ids.studentId}\`
- Branch: \`${ids.branchId}\`
- Teacher: \`${ids.teacherId}\`

No token or password is stored in this evidence.
`);
}

async function main() {
  const email = process.env.SEED_GENERAL_DIRECTOR_EMAIL;
  const password = process.env.SEED_GENERAL_DIRECTOR_PASSWORD;
  if (!email || !password) throw new Error('General Director local seed credentials are missing from 06Code/.env');

  const login = await fetchJson(`${nodeBaseUrl}/auth/login`, {
    method:'POST',
    headers:{ 'Content-Type':'application/json' },
    body:JSON.stringify({ email, password }),
  });
  const token = login.data?.sessionToken;
  if (!token) throw new Error('Node login did not return a session token. Enable EXPOSE_SESSION_TOKEN locally.');

  const [students, branches, teachers] = await Promise.all([
    authenticatedList('/students', token),
    authenticatedList('/branches', token),
    authenticatedList('/teachers', token),
  ]);
  const ids = {
    studentId:(students.find((row) => row.active !== false) || students[0]).id,
    branchId:(branches.find((row) => row.active !== false) || branches[0]).id,
    teacherId:(teachers.find((row) => row.active !== false) || teachers[0]).id,
  };

  fs.mkdirSync(tmpDir, { recursive:true });
  fs.writeFileSync(environmentPath, `${JSON.stringify({
    id:'analytics-local-evidence',
    name:'Analytics Local Evidence',
    values:[
      { key:'analytics_base_url', value:analyticsBaseUrl, type:'default', enabled:true },
      { key:'session_token', value:token, type:'secret', enabled:true },
      { key:'student_id', value:ids.studentId, type:'default', enabled:true },
      { key:'branch_id', value:ids.branchId, type:'default', enabled:true },
      { key:'teacher_id', value:ids.teacherId, type:'default', enabled:true },
    ],
    _postman_variable_scope:'environment',
  }, null, 2)}\n`);

  try {
    runNewman();
    writeEvidence(ids);
  } finally {
    fs.rmSync(tmpDir, { recursive:true, force:true });
  }
  console.log(`Python analytics evidence written to ${path.relative(root, evidenceMarkdownPath)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
