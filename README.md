# Pickle Rating

Pickleball rankings for the Philippines. Ratings come from confirmed matches, so there's no DUPR needed. Built with Next.js, Supabase and Vercel.

## What it does

- **Player profiles**: singles and doubles ratings, national and regional rank, rating trend, win/loss history, doubles partner stats, and a check-in QR code.
- **Match recording**: a player records a match they played; it only counts once someone on the other team confirms (or an admin settles a dispute).
- **Rankings**: national, by region (all 18 Philippine regions) and by city, for singles and doubles.
- **Clubs**: each club keeps its own ratings, calculated only from matches played inside the club.
- **Tournaments**: single-elimination brackets seeded by rating, with byes; the organizer enters results and winners move on automatically.
- **QR check-in**: scan a player's code to add them to a match, and scan a match's code to open it and confirm the score.
- **Day and night mode**: follows the phone's setting, with a switch in the header.

## How ratings work

Elo, calculated in the database (`supabase/migrations`, `apply_match_rating`), so nobody can post a rating change from their browser.

- Everyone starts at **1500**, separately for singles and doubles.
- A doubles team is rated as the average of both partners; each player then moves by their own K-factor.
- The K-factor is **32** for a player's first 20 rated matches in a format, then **16**.
- Players with fewer than 5 rated matches show as **P** (provisional).
- Club matches also update a separate club rating with the same formula.
- If an admin voids a confirmed match, that format's ratings are rebuilt from every remaining confirmed match in order.

`lib/elo.ts` is a copy of the formula used for on-screen previews, and `tests/db.test.mjs` checks the two agree.

## Setup

1. **Create a Supabase project** at [supabase.com](https://supabase.com). A region near the Philippines (Singapore) keeps it fast.
2. **Apply the database migration** with the Supabase CLI:
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   ```
3. **Configure sign-up emails** under Authentication:
   - URL Configuration: set **Site URL** to your site (for example `https://pickle-rating.vercel.app`) and add `https://<your-site>/auth/callback` (and `http://localhost:3000/auth/callback` for local work) to **Redirect URLs**.
     Use `https://<your-site>/**` so both sign-up confirmation and password-reset links (which go to `/auth/callback?next=/reset-password`) are allowed.
   - Supabase's built-in email sender is for testing only (a few emails per hour, team members only). Add an SMTP provider under Authentication → Emails → SMTP Settings. Brevo's free plan works: host `smtp-relay.brevo.com`, port `587`, your Brevo SMTP login and SMTP key.
4. **Environment variables**: copy `.env.example` to `.env.local` and fill in the project URL and publishable key (Project Settings → API).
5. **Run it**:
   ```bash
   npm install
   npm run dev
   ```
6. **Make yourself an admin** (to settle disputes), in the Supabase SQL editor:
   ```sql
   update public.players set is_admin = true where id = (select id from auth.users where email = 'you@example.com');
   ```

## Deploy to Vercel

1. Push this repository to GitHub.
2. In Vercel, **Add New → Project**, import the repository (Next.js is detected automatically).
3. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` under Environment Variables, then deploy.
4. Put the Vercel address into Supabase's Site URL and Redirect URLs (step 3 above).

## Tests

```bash
npm test          # database rules and rating math (in-process Postgres via PGlite), plus helpers
npm run typecheck
npm run lint
```

The database tests apply every migration to PGlite with stand-ins for Supabase's auth schema and roles, then act as real signed-in players: recording and confirming matches, disputes and admin voids, clubs, full singles and doubles brackets, and the security rules.
