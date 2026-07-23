# Cache Management

## Purpose

The system uses controlled cache management to improve repeated read performance without exposing private academic data. Cache behavior is explicit at three layers: HTTP response headers, an application memory cache with TTL and tag invalidation, and Nginx static asset rules for the deployed frontend.

## Cache Strategy

| Area | Policy | Evidence |
| --- | --- | --- |
| Sensitive API responses | `Cache-Control: no-store, no-cache, must-revalidate, private` | `X-Cache-Policy: sensitive-no-store` |
| Public auth configuration | `Cache-Control: public, max-age=3600, must-revalidate` | `GET /api/v1/auth/config` |
| Reference catalogs | Private HTTP cache plus memory cache | `GET /api/v1/roles`, `GET /api/v1/permissions` |
| Stable academic lists | Private HTTP cache plus memory cache | `GET /api/v1/branches`, `GET /api/v1/dance-categories`, `GET /api/v1/dance-styles` |
| Branch summary report | Private scoped memory cache, 30 second TTL | `GET /api/v1/reports/branches/summary` |
| Static frontend assets | Long-lived immutable cache | Nginx `/assets/` and Express static headers |
| HTML and login pages | Revalidate on every navigation | `Cache-Control: no-cache, must-revalidate` |
| Python analytics health | Public short cache, 60 second TTL | `GET /api/analytics/v1/health` |
| Protected Python analytics | No-store | `X-Cache-Policy: sensitive-no-store` |

## Application Memory Cache

Node.js creates a shared `CacheService` when the Express app starts. The cache stores in-process entries with:

- Key-based lookup.
- TTL expiration.
- Tag-based invalidation.
- Actor-scoped keys for role and branch-sensitive data.
- Response evidence headers: `X-Memory-Cache`, `X-Memory-Cache-Key` and `X-Memory-Cache-TTL`.

The current memory-cached resources are:

| Resource | TTL | Cache Scope | Invalidated By |
| --- | ---: | --- | --- |
| Roles catalog | 1800 seconds | Shared internal catalog | Application restart |
| Permissions catalog | 1800 seconds | Shared internal catalog | Application restart |
| Branch list | 300 seconds | Authenticated actor role/id | Branch changes and branch access changes |
| Dance categories | 600 seconds | Authenticated actor role/id | Category changes |
| Dance styles | 600 seconds | Authenticated actor role/id | Style changes |
| Branch summary report | 30 seconds | Authenticated actor role/id | Branch, student, attendance, justification, scholarship and promotion changes |

Actor-scoped cache keys prevent a BranchDirector response from being reused for another user with different branch access.

## Invalidation Rules

State-changing academic actions invalidate related tags immediately. Examples:

- Creating or updating a branch invalidates `branches` and `reports`.
- Creating or updating a student invalidates `students` and `reports`.
- Recording student attendance invalidates `attendance` and `reports`.
- Creating or reviewing an absence justification invalidates `attendance`, `justifications` and `reports`.
- Creating scholarship evaluations invalidates `evaluations` and `reports`.
- Creating level promotion evaluations invalidates `evaluations`, `students` and `reports`.
- Updating branch access invalidates `branches`, `students`, `teachers` and `reports`.

This keeps cache entries short-lived and removes affected entries as soon as business data changes.

## HTTP Header Evidence

Manual verification can be done with:

```bash
curl -I https://academy.example.invalid/api/v1/auth/config
curl -I https://academy.example.invalid/api/v1/auth/me
curl -I https://academy.example.invalid/
curl -I https://academy.example.invalid/assets/<built-asset-file>
```

Expected evidence:

- Public config includes `Cache-Control: public, max-age=3600, must-revalidate`.
- Sensitive session routes include `Cache-Control: no-store`.
- HTML includes `X-Cache-Policy: html-revalidate`.
- Versioned frontend assets include `Cache-Control: public, max-age=31536000, immutable`.

Authenticated memory cache evidence requires a valid session token:

```bash
curl -H "Authorization: Bearer <session-token>" https://academy.example.invalid/api/v1/roles
curl -H "Authorization: Bearer <session-token>" https://academy.example.invalid/api/v1/roles
```

The first request should expose `X-Memory-Cache: MISS`; the second repeated request should expose `X-Memory-Cache: HIT`.

## Automated Evidence

Automated validation is included in:

- `06Code/backend/tests/integration/cache.test.js`
- `06Code/scripts/api-validation-suite.js`
- `06Code/apis/python-analytics-api/tests/test_api.py`

Latest verified commands:

```text
cd 06Code && npm test
Result: 11 test suites passed, 91 tests passed.

cd 06Code && npm run test:api:validation
Result: 134/134 API validation cases passed.

cd 06Code/apis/python-analytics-api && .\.venv\Scripts\python.exe -m unittest discover -s tests -v
Result: 15 tests passed.
```
