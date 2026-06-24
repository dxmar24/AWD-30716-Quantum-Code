# OAuth And Session Documentation

## Google OAuth Strategy
1. Browser obtains a Google ID token from Google Sign-In.
2. Browser sends the ID token to `POST /api/v1/auth/google`.
3. Backend verifies the ID token with Google in production using `google-auth-library`.
4. Backend validates `sub`, `email` and configured audience `GOOGLE_CLIENT_ID`.
5. Backend links `google_sub` to an internal user record.
6. If the user is new, the default internal role is `Student`.
7. Internal roles are assigned only through the application, mainly `PATCH /api/v1/users/{id}/role`.

## Test/Development Mode
`ALLOW_MOCK_GOOGLE_TOKENS=true` or `NODE_ENV=test` allows signed mock JWT payloads for automated tests. Production must keep mock tokens disabled.

## Session Strategy
- The application issues its own signed session token after Google verification.
- The token is sent in cookie `alc_session`.
- Cookie options: HttpOnly, SameSite strict, Secure in production.
- Server persistence stores only a SHA-256 token hash, not the raw token.
- Session expiration defaults to `SESSION_TTL_MINUTES=120`.
- Logout revokes the server-side session hash and clears the cookie.

## Back Button And Expiration Controls
- API and private pages send `Cache-Control: no-store`.
- `/private/*` is protected by session middleware.
- Missing/expired session redirects private HTML pages to `/index.html?session=expired`.
- Expired API sessions return `401`.

## Required Environment Variables
- `GOOGLE_CLIENT_ID`
- `SESSION_SECRET`
- `SESSION_TTL_MINUTES`
- `ALLOW_MOCK_GOOGLE_TOKENS`
- `CORS_ORIGINS`
