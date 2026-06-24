# Postman Manual Verification

Import these two files into Postman:
- `American-Latin-Class.postman_environment.json`
- `American-Latin-Class-API.postman_collection.json`

Manual order:
1. Select the `American Latin Class - AWS` environment.
2. In Google Console, add `https://18-217-255-109.sslip.io` as an Authorized JavaScript origin.
3. Run `Auth & Session / Auth Config`.
4. Open the frontend login page in the browser and sign in with Google, or paste a real Google ID token into `google_id_token`.
5. Run `Auth & Session / Google Login - Real Token` in Postman. Postman should store the `alc_session` cookie automatically.
6. Run `Auth & Session / Current Session`.
7. If the user is new, promote that user to `Admin` in the database before running admin/director requests. The API intentionally creates new Google users as `Student`.
8. Run the remaining folders in order: Public Enrollment, Identity And RBAC, Catalog CRUD, Attendance And Absences, Reports And Evaluations.
9. Run `Session Teardown / Logout` at the end.

Notes:
- Do not commit real Google ID tokens, database passwords or session cookies.
- `google_id_token` is intentionally blank in the environment file.
- The collection uses `{{base_url}}` for API calls and `{{site_url}}` for private page checks.
- Create/update requests save generated IDs back into the active Postman environment.
