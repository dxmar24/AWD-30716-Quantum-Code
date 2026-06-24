# Postman Manual Verification

Import these two files into Postman:
- `American-Latin-Class.postman_environment.json`
- `American-Latin-Class-API.postman_collection.json`

Manual order:
1. Select the `American Latin Class - AWS` environment.
2. Run `Auth & Session / Auth Config`.
3. Open the frontend login page in the browser and sign in with Google, or paste a real Google ID token into `google_id_token`.
4. Run `Auth & Session / Google Login - Real Token` in Postman. Postman should store the `alc_session` cookie automatically.
5. Run `Auth & Session / Current Session`.
6. If the user is new, promote that user to `Admin` in the database before running admin/director requests. The API intentionally creates new Google users as `Student`.
7. Run the remaining folders in order: Public Enrollment, Identity And RBAC, Catalog CRUD, Attendance And Absences, Reports And Evaluations.
8. Run `Auth & Session / Logout` at the end.

Notes:
- Do not commit real Google ID tokens, database passwords or session cookies.
- `google_id_token` is intentionally blank in the environment file.
- The collection uses `{{base_url}}` for API calls and `{{site_url}}` for private page checks.
- Create/update requests save generated IDs back into the active Postman environment.
