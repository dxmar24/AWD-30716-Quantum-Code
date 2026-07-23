# Account Invitation Email

## Purpose

Academy accounts are created by an authorized director. A temporary password is a secret, so it must not appear in the director dashboard, an API response, a screenshot, a log or a chat message. The system now delivers that password only to the email address registered for the account.

## User Flow

1. Admin or General Director enters the person's name, email, role and required academic assignment.
2. The backend validates the role, branch and profile relationships.
3. The account and linked Student or Teacher profile are created inactive with `mustChangePassword = true`.
4. `EmailService` generates a branded HTML and plain-text invitation containing the email, temporary password, login link and first-login instructions.
5. SMTP confirms delivery to the configured mail server.
6. The backend activates the account and writes `USER_INVITATION_SENT` to the audit log.
7. The director sees only the recipient and delivery confirmation.
8. The invited person signs in and must replace the temporary password before using protected academic modules.

If delivery fails, the account remains inactive and `USER_INVITATION_DELIVERY_FAILED` is audited. Admin or General Director can use the account directory action backed by `POST /api/v1/users/{id}/resend-invitation`.

## Implementation Map

| Responsibility | File |
| --- | --- |
| SMTP/capture transport and branded template | `06Code/backend/src/services/EmailService.js` |
| Inactive-create, send, activate and resend workflow | `06Code/backend/src/services/AcademicService.js` |
| Environment validation | `06Code/backend/src/config/env.js` |
| User routes | `06Code/backend/src/routes/api.js` |
| Director confirmation UI | `06Code/frontend/src/main.jsx` |
| Directory resend/reset UI | `06Code/frontend/src/components/accounts/UserDirectoryPanel.jsx` |
| Local inbox service | `06Code/docker-compose.yml` |

## Email Design

The template uses inline email-compatible styles:

- Yellow `#ffe600` for the brand strip and primary action.
- Dark gray `#171717` for the header and primary text.
- White and light gray for the message body and credential block.
- A plain-text fallback for clients that do not render HTML.

Dynamic values are HTML-escaped before interpolation. The service does not log the temporary password.

## Local Evidence With Mailpit

1. From `06Code`, run `npm run db:local:up`.
2. Start the Node application with `npm start`.
3. Sign in as General Director and open **Cuentas**.
4. Create a new account or choose **Gestionar** and **Reenviar invitación**.
5. Confirm that the panel shows only “Invitación enviada” and the recipient address.
6. Open `http://127.0.0.1:8025`.
7. Open the newest message titled **Tu acceso a American Latin Class**.
8. Show the yellow, gray and white layout, temporary credential, login link and mandatory password-change instructions.
9. In Postman, verify that the create/resend response has `invitation.status = "sent"` and no `temporaryPassword` property.

Mailpit captures messages locally. Staging and production must use a real transactional SMTP provider through `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM` and HTTPS `APP_PUBLIC_URL`.

## Automated Evidence

- `tests/auth/auth.test.js` proves creation sends the invitation, omits the password from HTTP and permits login with the mailbox credential.
- `tests/integration/actor-flows.test.js` verifies General Director creation and Admin reset flows.
- `tests/auth/security-config.test.js` rejects production without SMTP and HTTPS public URL.
- `npm run test:api:validation` validates the same contract in the full API scenario suite.
- The Postman collection includes local Mailpit requests that extract the credential only from the captured email before testing first login.
