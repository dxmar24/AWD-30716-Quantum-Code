const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const jwt = require('jsonwebtoken');

const codeDir = path.join(__dirname, '..');
const repoRoot = path.join(codeDir, '..');
const evidenceDir = path.join(repoRoot, 'postman', 'evidence');
const tmpDir = path.join(evidenceDir, '.tmp');
const collectionPath = path.join(repoRoot, 'postman', 'American-Latin-Class-API.postman_collection.json');
const rawJsonPath = path.join(tmpDir, 'newman-raw-report.json');
const tempEnvironmentPath = path.join(tmpDir, 'local-jwt-environment.postman_environment.json');
const evidenceJsonPath = path.join(evidenceDir, 'postman-local-jwt-auth-evidence.json');
const evidenceMarkdownPath = path.join(evidenceDir, 'postman-local-jwt-auth-evidence.md');
const port = Number(process.env.POSTMAN_EVIDENCE_PORT || 4010);
const baseUrl = `http://127.0.0.1:${port}/api/v1`;
const siteUrl = `http://127.0.0.1:${port}`;

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(url, timeoutMs = 15000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }

    await sleep(300);
  }

  throw new Error(`Server did not become ready at ${url}`);
}

function writeLocalEnvironment() {
  const googleIdToken = jwt.sign(
    {
      sub: 'test-admin',
      email: 'admin@alc.edu',
      name: 'Postman Evidence Admin',
      aud: 'test-google-client-id',
    },
    'local-postman-google-token',
    { expiresIn: '10m' },
  );

  const environment = {
    id: 'local-jwt-evidence',
    name: 'American Latin Class - Local JWT Evidence',
    values: [
      { key: 'site_url', value: siteUrl, type: 'default', enabled: true },
      { key: 'base_url', value: baseUrl, type: 'default', enabled: true },
      { key: 'google_id_token', value: googleIdToken, type: 'secret', enabled: true },
      { key: 'session_token', value: '', type: 'secret', enabled: true },
      { key: 'user_id', value: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', type: 'default', enabled: true },
      { key: 'branch_id', value: '11111111-1111-4111-8111-111111111111', type: 'default', enabled: true },
      { key: 'student_id', value: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', type: 'default', enabled: true },
      { key: 'teacher_id', value: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', type: 'default', enabled: true },
      { key: 'dance_category_id', value: '10000000-0000-4000-8000-000000000001', type: 'default', enabled: true },
      { key: 'dance_style_id', value: '', type: 'default', enabled: true },
      { key: 'class_group_id', value: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', type: 'default', enabled: true },
      { key: 'class_session_id', value: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', type: 'default', enabled: true },
      { key: 'absence_class_session_id', value: '', type: 'default', enabled: true },
      { key: 'attendance_record_id', value: '', type: 'default', enabled: true },
      { key: 'absence_attendance_record_id', value: '', type: 'default', enabled: true },
      { key: 'teacher_attendance_id', value: '', type: 'default', enabled: true },
      { key: 'absence_justification_id', value: '', type: 'default', enabled: true },
      { key: 'enrollment_request_id', value: '', type: 'default', enabled: true },
    ],
    _postman_variable_scope: 'environment',
    _postman_exported_using: 'Codex local evidence runner',
  };

  fs.writeFileSync(tempEnvironmentPath, JSON.stringify(environment, null, 2), 'utf8');
}

function startServer() {
  const env = {
    ...process.env,
    NODE_ENV: 'test',
    DB_DRIVER: 'memory',
    PORT: String(port),
    GOOGLE_CLIENT_ID: 'test-google-client-id',
    ALLOW_MOCK_GOOGLE_TOKENS: 'true',
    SESSION_SECRET: 'local-postman-session-secret',
    SESSION_TTL_MINUTES: '120',
    CORS_ORIGINS: siteUrl,
    AUTH_RATE_LIMIT_MAX: '200',
  };

  const server = spawn(process.execPath, ['src/server.js'], {
    cwd: codeDir,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  server.stdout.on('data', (chunk) => process.stdout.write(chunk));
  server.stderr.on('data', (chunk) => process.stderr.write(chunk));

  return server;
}

function runNewman() {
  const npx = 'npx';
  const collectionArg = path.relative(repoRoot, collectionPath);
  const environmentArg = path.relative(repoRoot, tempEnvironmentPath);
  const jsonExportArg = path.relative(repoRoot, rawJsonPath);
  const result = spawnSync(
    npx,
    [
      '--yes',
      'newman',
      'run',
      collectionArg,
      '-e',
      environmentArg,
      '--reporters',
      'cli,json',
      '--reporter-json-export',
      jsonExportArg,
      '--insecure',
    ],
    {
      cwd: repoRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        npm_config_strict_ssl: 'false',
      },
      shell: process.platform === 'win32',
      timeout: 180000,
    },
  );

  if (result.error) {
    throw result.error;
  }

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  if (result.status !== 0) {
    throw new Error(`Newman failed with exit code ${result.status}`);
  }
}

function pickAuthenticationAssertions(executions) {
  const wanted = [
    'JWT session token returned',
    'Bearer token type returned',
    'Session cookie issued',
    'HTTP 200 with bearer token',
    'HTTP 401 after logout',
  ];

  return executions
    .flatMap((execution) =>
      (execution.assertions || []).map((assertion) => ({
        request: execution.item?.name,
        assertion: assertion.assertion,
        passed: !assertion.error,
      })),
    )
    .filter((assertion) => wanted.includes(assertion.assertion));
}

function writeEvidence() {
  const report = JSON.parse(fs.readFileSync(rawJsonPath, 'utf8'));
  const stats = report.run.stats;
  const failures = report.run.failures || [];
  const authenticationChecks = pickAuthenticationAssertions(report.run.executions || []);

  const evidence = {
    generatedAt: new Date().toISOString(),
    tool: 'Newman/Postman collection runner',
    collection: 'postman/American-Latin-Class-API.postman_collection.json',
    environment: 'Generated local JWT evidence environment',
    target: {
      site_url: siteUrl,
      base_url: baseUrl,
      node_env: 'test',
      db_driver: 'memory',
      google_token_mode: 'mock Google ID token for existing Admin user',
    },
    stats: {
      requests: stats.requests,
      assertions: stats.assertions,
      testScripts: stats.testScripts,
      prerequestScripts: stats.prerequestScripts,
    },
    authenticationChecks,
    failures: failures.map((failure) => ({
      source: failure.source?.name,
      error: failure.error?.message,
      assertion: failure.error?.test,
    })),
  };

  fs.writeFileSync(evidenceJsonPath, JSON.stringify(evidence, null, 2), 'utf8');

  const checkRows = authenticationChecks
    .map((check) => `| ${check.request} | ${check.assertion} | ${check.passed ? 'Pass' : 'Fail'} |`)
    .join('\n');

  const failureRows = evidence.failures.length
    ? evidence.failures.map((failure) => `| ${failure.source || ''} | ${failure.assertion || ''} | ${failure.error || ''} |`).join('\n')
    : '| None | None | None |';

  fs.writeFileSync(
    evidenceMarkdownPath,
    `# Postman JWT Authentication Evidence

Generated: ${evidence.generatedAt}

## Scope

This evidence was generated by running the repository Postman collection with Newman against a local Express server in test mode. The run uses a mock Google ID token for the seeded Admin user and validates the same Postman flow required for manual testing: login, JWT session token capture, Bearer-authenticated request, logout and rejected access after logout.

## Target

- Site URL: \`${siteUrl}\`
- Base URL: \`${baseUrl}\`
- Runtime: \`NODE_ENV=test\`, \`DB_DRIVER=memory\`
- Google token mode: mock Google ID token for existing Admin user

## Summary

| Metric | Total | Failed |
| --- | ---: | ---: |
| Requests | ${stats.requests.total} | ${stats.requests.failed} |
| Assertions | ${stats.assertions.total} | ${stats.assertions.failed} |
| Test scripts | ${stats.testScripts.total} | ${stats.testScripts.failed} |

## Authentication Checks

| Request | Assertion | Result |
| --- | --- | --- |
${checkRows}

## Failures

| Request | Assertion | Error |
| --- | --- | --- |
${failureRows}

## Evidence Files

- Sanitized JSON summary: \`postman/evidence/postman-local-jwt-auth-evidence.json\`
- Source collection: \`postman/American-Latin-Class-API.postman_collection.json\`
- Source environment for AWS/manual testing: \`postman/American-Latin-Class.postman_environment.json\`
`,
    'utf8',
  );
}

async function main() {
  ensureDir(tmpDir);
  writeLocalEnvironment();

  const server = startServer();

  try {
    await waitForServer(`${baseUrl}/auth/config`);
    runNewman();
    writeEvidence();
  } finally {
    server.kill();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  console.log(`Postman JWT evidence written to ${path.relative(repoRoot, evidenceMarkdownPath)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
