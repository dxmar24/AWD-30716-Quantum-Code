# Postman Manual Verification

Import these two files into Postman:
- `American-Latin-Class.postman_environment.json`
- `American-Latin-Class-API.postman_collection.json`

The environment now includes real RDS verification IDs from seed `REAL-20260624154645`; the old dummy fixture IDs were removed.

Manual order:
1. Select the `American Latin Class - AWS` environment.
2. In Google Console, add `https://18-217-255-109.sslip.io` as an Authorized JavaScript origin.
3. Run `Auth & Session / Auth Config`.
4. Open the frontend login page in the browser and sign in with Google, or paste a real Google ID token into `google_id_token`.
5. Run `Auth & Session / Google Login - Real Token` in Postman. Postman stores `session_token` from `data.sessionToken` and should also store the `alc_session` cookie automatically.
6. Run `Auth & Session / Current Session` and `Auth & Session / Current Session - Bearer Token`.
7. If the user is new, promote that user to `Admin` in the database before running admin/director requests. The API intentionally creates new Google users as `Student`.
8. Run the remaining folders in order: Public Enrollment, Identity And RBAC, Catalog CRUD, Attendance And Absences, Reports And Evaluations.
9. Run `Session Teardown / Logout` and then `Session Teardown / Current Session - After Logout`; the same token must return `401`.

Notes:
- Do not commit real Google ID tokens, database passwords or session cookies.
- `google_id_token` is intentionally blank in the environment file.
- `session_token` is intentionally blank in the environment file and is filled by the Google login request.
- The collection uses `{{base_url}}` for API calls and `{{site_url}}` for private page checks.
- The collection is configured with Bearer auth using `{{session_token}}`, while the browser flow still uses the `alc_session` cookie.
- Create/update requests save generated IDs back into the active Postman environment.
- Existing environment IDs point to records already loaded in AWS RDS; they can be used immediately for read/report tests.
