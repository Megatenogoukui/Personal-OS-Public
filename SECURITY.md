# Security policy

Personal OS handles financial, health, and work data. Treat every deployment as private infrastructure.

## Deployment requirements

- Set `PERSONAL_OS_ACCESS_PASSWORD` and a separate `PERSONAL_OS_SECRET_KEY` before adding real data.
- Use different values for `PERSONAL_OS_ADMIN_SECRET` and `FINANCE_IMPORT_SECRET`.
- Restrict MongoDB network access and create a database user scoped to the Personal OS database.
- Keep environment files, exports, message samples, and database backups out of Git.
- Rotate any credential that appears in logs, screenshots, issues, or chat transcripts.
- Use HTTPS in production.

## Reporting a vulnerability

Do not open a public issue containing exploit details or private records. Use GitHub's private vulnerability reporting feature for this repository. Include the affected route or module, impact, reproduction steps, and a proposed mitigation when possible.
