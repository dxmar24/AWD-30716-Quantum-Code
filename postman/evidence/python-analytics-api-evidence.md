# Python Analytics API Evidence

Generated: 2026-07-22T04:55:50.886Z

## Purpose

This evidence proves that the FastAPI analytics microservice runs against the same local PostgreSQL data as the Node application and accepts a real session token issued by the Node authentication service.

## Automated Flow

1. Authenticate as the General Director through the Node API.
2. Discover an existing student, branch and teacher from PostgreSQL through protected Node endpoints.
3. Run the analytics Postman collection with Newman.
4. Verify anonymous rejection, student risk, scholarship readiness, branch performance and teacher workload.
5. Delete the temporary environment containing the session token.

## Result

| Metric | Total | Failed |
| --- | ---: | ---: |
| Requests | 6 | 0 |
| Assertions | 12 | 0 |
| Test scripts | 12 | 0 |

Selected persisted records:

- Student: `37c0e264-cef5-4a55-a351-d3958aaaf413`
- Branch: `06d1e68e-c66b-4634-8e6d-31074e4f4563`
- Teacher: `1c92ef34-02ea-4a77-ac56-5285fdb396f1`

No token or password is stored in this evidence.
