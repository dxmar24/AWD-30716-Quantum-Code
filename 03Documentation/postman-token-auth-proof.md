# Postman Token Authentication Proof

This document describes the manual backend-only Postman proof for JWT authentication.

## Environment

Use the Postman environment:

- `site_url`: `https://18-217-255-109.sslip.io`
- `base_url`: `https://18-217-255-109.sslip.io/api/v1`
- `login_email`: `verification-admin-real-20260624154645@alc.test`
- `login_password`: academic demo password configured for `POSTMAN_LOGIN_PASSWORD`
- `session_token`: blank before login; filled automatically by the login request

## 1. Protected URI Without Token

Method: `GET`

URI:
```text
{{base_url}}/auth/me
```

Authorization:
```text
No Auth
```

Expected response:

| HTTP | Message |
| --- | --- |
| `401 Unauthorized` | `{ "success": false, "message": "Authentication required" }` |

Postman request:
```text
Auth & Session / Current Session - No Token
```

## 2. Login To Receive JWT Token

Method: `POST`

URI:
```text
{{base_url}}/auth/login
```

JSON body:
```json
{
  "email": "{{login_email}}",
  "password": "{{login_password}}"
}
```

Expected response:

| HTTP | Message |
| --- | --- |
| `200 OK` | Response includes `data.sessionToken`, `data.tokenType = "Bearer"` and `data.user`. |

Postman request:
```text
Auth & Session / Password Login - Demo
```

The Postman test script stores:
```text
session_token = data.sessionToken
```

## 3. Protected URI With Bearer Token

Method: `GET`

URI:
```text
{{base_url}}/auth/me
```

Authorization:
```text
Type: Bearer Token
Token: {{session_token}}
```

Expected response:

| HTTP | Message |
| --- | --- |
| `200 OK` | Response includes the authenticated user object. |

Postman request:
```text
Auth & Session / Current Session - Bearer Token
```

## 4. Logout Revokes Token

Method: `POST`

URI:
```text
{{base_url}}/auth/logout
```

Authorization:
```text
Type: Bearer Token
Token: {{session_token}}
```

Expected response:

| HTTP | Message |
| --- | --- |
| `200 OK` | `Logout successful` |

Postman request:
```text
Session Teardown / Logout
```

## 5. Same Token After Logout

Method: `GET`

URI:
```text
{{base_url}}/auth/me
```

Authorization:
```text
Type: Bearer Token
Token: the same token returned by login
```

Expected response:

| HTTP | Message |
| --- | --- |
| `401 Unauthorized` | `{ "success": false, "message": "Authentication required" }` |

Postman request:
```text
Session Teardown / Current Session - After Logout
```

## Automated Evidence

Latest Newman evidence:

| Metric | Result |
| --- | --- |
| Requests | `67 executed, 0 failed` |
| Assertions | `78 executed, 0 failed` |
| API validation | `114/114 passed` |
| Jest tests | `24 passed` |
