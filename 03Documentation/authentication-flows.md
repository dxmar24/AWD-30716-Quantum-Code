# Authentication And Account Lifecycle

## Product Decision
American Latin Class owns every private account. The account email is the username for email/password sign-in and the same email may be linked to Google Sign-In.

Google is an alternate sign-in method, not a self-registration method. A Google account can enter only when its email already exists in the academy user table.

## Account Creation
1. Admin or GeneralDirector creates the user with `POST /api/v1/users`.
2. The request includes `email`, `name`, `role` and the profile/branch data required by that role.
3. The private dashboard exposes the same flow as "Send access invitation" for Admin and GeneralDirector users.
4. The backend generates the temporary password internally and never returns it in an HTTP response.
5. Student accounts must include `studentProfile` with branch and level, and Teacher accounts must include `teacherProfile` with branch data.
6. The backend validates profile branches and assigned branches before creating the user, so invalid assignments do not leave partial accounts.
7. BranchDirector accounts must include at least one assigned branch.
8. Only Admin can create Admin accounts.
9. The backend first stores the account without active access and stores only `password_hash`.
10. The branded email service sends the temporary password and first-login instructions to the registered address.
11. After confirmed delivery, the account is activated with `must_change_password = true`; the director sees only the delivery confirmation.
12. A delivery failure leaves the account inactive and audited. Admin or GeneralDirector can use `POST /users/{id}/resend-invitation`.

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
11. The login page renders the official Google Identity Services button with supported rectangular, dark-theme options so Google branding remains compliant with the ALC interface.

## Returning To The Landing Page
1. The public React header checks `GET /api/v1/auth/me` when the landing page loads or is restored from browser history.
2. An anonymous visitor sees **Ingresar**.
3. An authenticated user sees their full name and profile image; users without an uploaded photo receive the institutional user icon.
4. Selecting the authenticated identity opens `/private/dashboard.html` instead of returning to the login form.
5. Student profile data is read only after session validation so the private photo is never requested for an anonymous visitor.

## Alternate And Failure Flows
- Unknown email/password returns `401`.
- Inactive account returns `401`.
- Google token with unregistered email returns `401`.
- Google token with unverified email returns `401 GOOGLE_EMAIL_NOT_VERIFIED`.
- Google sign-in never links inactive accounts.
- Temporary-password users can view `/auth/me`, logout, and change password, but cannot use protected academic endpoints.
- Password change requires the current password and a new password that satisfies the password policy.
- Temporary passwords are delivered only to the registered mailbox and never appear in API responses, logs or the director dashboard.
- BranchDirector account creation without branch access returns `422 BRANCH_ACCESS_REQUIRED`.
- Student or Teacher account creation without the corresponding academic profile returns `422`.

## Role Expectations
- Visitor: public landing and enrollment request only.
- Student: own academic profile and allowed self-service requests after first password change.
- Teacher: own teacher profile, assigned sessions and attendance work after first password change.
- BranchDirector: only assigned branches through `user_branch_access`.
- GeneralDirector/Admin: global academic and account administration.
