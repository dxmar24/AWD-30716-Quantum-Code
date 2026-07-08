# Visitor Flow Verification

Status: Passed

Verification source:
- Automated test: `06Code/tests/integration/actor-flows.test.js`
- Command: `npm test`
- Latest observed result: `6 passed, 6 total`, `38 passed, 38 total`

## Actor Goal
A visitor should learn about American Latin Class, submit an enrollment request and be prevented from entering private academic areas without an academy account.

## Preconditions
- No private session is required.
- The public React landing page and login page are available.
- Public enrollment requests are enabled.

## Main Flow
1. Visitor opens `/`.
2. System serves the public American Latin Class landing experience.
3. Visitor opens the login page through `/login.html`.
4. System serves the login page without requiring a session.
5. The public enrollment form loads active branches through `GET /api/v1/public/branches`.
6. Visitor submits an enrollment request through `POST /api/v1/enrollment-requests`.
7. System validates the name, email and selected branch when provided.
8. System stores the request with pending review status.
9. Director roles can later review the request queue.

Expected result: enrollment request returns `201`.

## Alternate Flows
- Invalid enrollment email or very short name returns `422`.
- Visitor opens `/private/dashboard.html` without a session and is redirected to `/login.html?session=expired`.
- Visitor calls a protected API such as `GET /api/v1/enrollment-requests` and receives `401`.
- Visitor tries Google Sign-In with an email that is not registered by the academy and receives `401 ACCOUNT_NOT_REGISTERED`.
- Logout without an active session is harmless and returns `200`.

## Verified Endpoints
- `GET /`
- `GET /login.html`
- `GET /api/v1/auth/config`
- `GET /api/v1/public/branches`
- `POST /api/v1/enrollment-requests`
- `GET /private/dashboard.html`
- `POST /api/v1/auth/google`

## User-Facing Evidence To Capture
- Landing page first viewport.
- Enrollment form filled and success message.
- Login page.
- Private dashboard redirect after opening it without session.
- Optional Postman evidence for invalid enrollment returning `422`.

## Notes
Visitor cannot self-register private accounts. A private user must be created by Admin or GeneralDirector before email/password or Google Sign-In can open an internal session.
