# Database backups

A GitHub Actions workflow (`.github/workflows/backup.yml`) copies the whole
Supabase database every night at 02:00 Philippine time: logins, players,
matches, ratings, clubs, tournaments and feedback. The copy is encrypted with
your passphrase before it is stored, because this repository is public.
GitHub keeps each backup for 30 days (Actions → Database backup → a run →
Artifacts).

## One-time setup

In GitHub: **Settings → Secrets and variables → Actions → New repository secret**.

| Name | Value |
|---|---|
| `SUPABASE_DB_URL` | The **Session pooler** connection string from Supabase (Connect → Session pooler), with your database password in place of `[YOUR-PASSWORD]`. |
| `BACKUP_PASSPHRASE` | A long passphrase (16+ characters). **Keep a copy in your password manager.** Without it no backup can be opened. |

Then run it once by hand: **Actions → Database backup → Run workflow**.

## Opening a backup

1. Download the artifact (a zip containing `pickle-rating-YYYY-MM-DD.tar.gz.gpg`) and unzip it.
2. Decrypt and unpack it (Git Bash on Windows has `gpg` and `tar`):
   ```bash
   gpg --decrypt pickle-rating-YYYY-MM-DD.tar.gz.gpg | tar -xz
   ```
   This creates `backup/roles.sql`, `backup/schema.sql` and `backup/data.sql`.

## Restoring into a Supabase project

Restore into a **new, empty** project (never over the live one unless you mean to
replace it). Following Supabase's restore guide, with `psql` installed:

```bash
psql --single-transaction --variable ON_ERROR_STOP=1 \
  --file backup/roles.sql \
  --file backup/schema.sql \
  --command 'SET session_replication_role = replica' \
  --file backup/data.sql \
  --dbname "<new project's session pooler connection string>"
```

Then point Vercel's `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
at the new project and redeploy.

## Good to know

- GitHub turns off scheduled workflows in a repository with no commits for 60
  days; it emails you first, and one click re-enables it.
- If a run fails, GitHub emails the repository owner. The usual causes are a
  changed database password (update `SUPABASE_DB_URL`) or a paused Supabase
  project (resume it in the dashboard).
