# Private Database Inspection

## Security decision

The production PostgreSQL database and every administration interface must remain private. The public Nginx template returns `404` for `/db-admin` and does not proxy Adminer, pgAdmin, or any comparable tool.

Approved access paths are:

- AWS Systems Manager Session Manager port forwarding from an authorized identity.
- A company VPN or zero-trust private network.
- A short-lived SSH tunnel through a hardened bastion when SSM is unavailable.

Use a dedicated read-only database account, require MFA at the identity layer, record access centrally, and rotate credentials through the organization secret manager. Never store endpoints, usernames, passwords, private-key paths, screenshots containing personal data, or connection exports in Git.

## Reference flow

```text
Authorized operator -> MFA/SSM or VPN -> private database endpoint -> read-only role
```

The database security group should accept PostgreSQL only from the application security group and the approved private administration path. It must never accept `0.0.0.0/0` or `::/0`.

## Local inspection

For disposable development data, start the local container and connect only through its loopback binding:

```bash
cd 06Code
POSTGRES_PASSWORD='<local-secret>' docker compose up -d postgres
```

Then connect to `localhost:5432`. The password belongs in a local ignored `.env` or secret store, not in documentation or terminal captures.

## Evidence checklist

- Public `/db-admin` responds with `404`.
- Database port is not reachable from the public internet.
- The inspection identity has read-only grants.
- The access event appears in centralized audit logs.
- Captures redact endpoints, account identifiers, tokens, personal data, and secrets.
