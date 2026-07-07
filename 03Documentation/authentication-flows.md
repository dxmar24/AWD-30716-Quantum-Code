# Authentication And Account Lifecycle

## Product Decision
American Latin Class owns every private account. The account email is the username for email/password sign-in and the same email may be linked to Google Sign-In.

Google is an alternate sign-in method, not a self-registration method. A Google account can enter only when its email already exists in the academy user table.

## Account Creation
1. Admin or GeneralDirector creates the user with `POST /api/v1/users`.
2. The request includes `email`, `name`, `role` and optionally `temporaryPassword`.
3. The private dashboard exposes the same flow as "Create academy account" for Admin and GeneralDirector users.
4. If no temporary password is provided, the backend generates one and returns it once in the response.
5. The backend validates assigned branches before creating the user, so invalid branch assignments do not leave partial accounts.
6. The backend stores only `password_hash`.
7. New accounts default to `must_change_password = true`.
8. The director shares the temporary password through the approved academy channel.

## First Email/Password Sign-In
1. User opens `/login.html`.
2. User enters the registered email and temporary password.
3. Backend issues the normal application session.
4. The login response includes `user.mustChangePassword = true`.
5. The private app shows the mandatory password-change screen.
6. Protected academic endpoints return `403 PASSWORD_CHANGE_REQUIRED` until the password is changed.
7. User submits `POST /api/v1/auth/change-password` with current temporary password and a new password.
8. Backend stores the new hash, clears `must_change_password`, and records `password_changed_at`.

## Google Sign-In
1. User selects Google on `/login.html`.
2. Backend verifies the Google ID token.
3. The Google email must be verified.
4. Backend searches by `google_sub`.
5. If a linked Google subject exists, the current Google email must still match the academy account email.
6. If no `google_sub` is linked, backend searches by the verified Google email.
7. If the email belongs to an active internal account and has no different `google_sub`, backend links the Google subject to that account.
8. If the email is not registered, login is rejected with `401 ACCOUNT_NOT_REGISTERED`.
9. If the email is already linked to a different Google subject, login is rejected with `409 GOOGLE_ACCOUNT_MISMATCH`.
10. If the linked Google account email no longer matches the academy email, login is rejected with `409 GOOGLE_EMAIL_MISMATCH`.

## Alternate And Failure Flows
- Unknown email/password returns `401`.
- Inactive account returns `401`.
- Google token with unregistered email returns `401`.
- Google token with unverified email returns `401 GOOGLE_EMAIL_NOT_VERIFIED`.
- Google sign-in never links inactive accounts.
- Temporary-password users can view `/auth/me`, logout, and change password, but cannot use protected academic endpoints.
- Password change requires the current password and a new password that satisfies the password policy.
- Director-created temporary passwords are returned only at creation time.

## Role Expectations
- Visitor: public landing and enrollment request only.
- Student: own academic profile and allowed self-service requests after first password change.
- Teacher: own teacher profile, assigned sessions and attendance work after first password change.
- BranchDirector: only assigned branches through `user_branch_access`.
- GeneralDirector/Admin: global academic and account administration.
