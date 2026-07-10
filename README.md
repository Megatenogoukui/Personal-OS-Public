# Personal OS

Personal OS is a private, self-hosted dashboard for work, money, training, diet, reading, habits, daily planning, and weekly reviews. A fresh installation contains neutral starter structures and no personal records.

## What is included

- Work task import from provider-neutral CSV or JSON exports
- Finance accounts, cards, transactions, categories, insurance, investments, SIPs, FDs, analytics, and iPhone message import
- Progressive-overload workout logging with PRs, exercise history, body-part analytics, missed-session handling, and recovery guidance
- Flexible weekly diet planning, meal logging, shopping/preparation lists, substitutions, and adherence analytics
- Reading library, sessions, streaks, progress, notes, and insights
- Editable habits with mandatory baselines, streaks, and 7/30-day analytics
- Daily command center, practical timeline, notifications, and weekly review
- MongoDB persistence, password protection, private export, and migration tooling

## Requirements

- Node.js 20 or newer
- A MongoDB database, including the free MongoDB Atlas tier

## Quick start

```bash
git clone https://github.com/Megatenogoukui/Personal-OS-Public.git
cd Personal-OS-Public
npm install
cp .env.example .env.local
npm run dev
```

Open `http://127.0.0.1:3020`.

Configure these values in `.env.local` before adding real data:

```dotenv
PERSONAL_OS_STORE_DRIVER=mongodb
MONGODB_URI=mongodb+srv://USER:PASSWORD@CLUSTER/
MONGODB_DB=personal_os
MONGODB_COLLECTION=app_store
PERSONAL_OS_STORE_KEY=default
PERSONAL_OS_ACCESS_PASSWORD=choose-a-private-password
PERSONAL_OS_SECRET_KEY=generate-a-long-random-secret
PERSONAL_OS_ADMIN_SECRET=generate-another-random-secret
FINANCE_IMPORT_SECRET=generate-a-separate-import-secret
```

Generate secrets with:

```bash
openssl rand -base64 32
```

Never commit `.env.local`. Environment files, local data, Vercel metadata, backups, and build output are ignored by Git.

## First setup

1. Open Settings and save your display name, task identity, timezone, and currency.
2. Add accounts and categories in Finance.
3. Add or import work tasks from the Work page.
4. Add habits, books, diet logs, and workout logs.
5. Expand the advanced diet and training plan editors in Settings when you want to replace the neutral starter plans.
6. Export a private backup after configuration and periodically afterward.

## Work import format

The Work page accepts JSON arrays or CSV. Common field aliases are normalized automatically.

```csv
id,title,status,priority,deadline,assigned_to,fe_assignee,be_assignee,lead,project,client,url
TASK-101,Example task,in_progress,high,2026-08-01,Alex,Sam,Riya,Alex,Website,Acme,https://example.com/task/101
```

No project-management provider is required or named in the codebase.

## iPhone finance message import

Use an Apple Shortcuts message automation to POST JSON to:

```text
https://YOUR_DEPLOYMENT/api/finance/import-message
```

Add the `x-personal-os-secret` header with `FINANCE_IMPORT_SECRET` and send:

```json
{
  "text": "Shortcut Input",
  "sender": "Sender",
  "receivedAt": "Current Date"
}
```

Imported messages are parsed into reviewable finance transactions. Keep the import secret different from the dashboard password and admin secret.

## Storage model

The default MongoDB layout uses one document per `PERSONAL_OS_STORE_KEY` in `personal_os.app_store`. This keeps self-hosting simple and allows future tenant isolation without mixing records.

When `MONGODB_URI` is absent, local development falls back to `.local-data/store.json`. Production deployments should explicitly set `PERSONAL_OS_STORE_DRIVER=mongodb`; an invalid explicit driver fails instead of silently writing somewhere else.

## Backups and migration

Download a full private backup from Settings. The admin store API also supports authenticated import/export using the `x-personal-os-secret` header and `PERSONAL_OS_ADMIN_SECRET`.

Create a server-side MongoDB backup with:

```bash
npm run store:backup:mongodb
```

Legacy Vercel Blob installations can migrate with:

```bash
npm run store:migrate:mongodb
```

The migration reads `.env.local` and `.env.migration.local`, creates an ignored private backup, writes MongoDB, reads it back, and compares a canonical SHA-256 checksum before reporting success.

## Deploying to Vercel

Import the repository into Vercel and add the same environment variables from `.env.example`. The included `vercel.json` builds the web workspace from the monorepo root.

After deployment:

1. Confirm `/login` rejects an incorrect password.
2. Save one temporary record and confirm it survives a new deployment.
3. Test private backup export.
4. Test the finance Shortcut endpoint with a harmless sample message.

## Development

```bash
npm run typecheck
npm test
npm run build
```

The project is a small npm workspace:

- `apps/web`: Next.js application and API routes
- `packages/core`: data types, scoring, analytics, plan engines, and review logic
- `scripts`: storage migration utilities

## Privacy

This repository intentionally contains no user profile, account, transaction, health target, meal rotation, workout schedule, task-provider credentials, or imported records. Those belong in your database and environment variables.
