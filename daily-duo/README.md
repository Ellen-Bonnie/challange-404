# Daily Duo 🐾

A mobile-first shared plank tracker for two friends, hosted under `/daily-duo/` in the existing static Netlify site.

## What is implemented

- Supabase email/password sign-in, shared duo membership and invitation code.
- One shared daily task from the existing `get_or_create_daily_task` Supabase RPC.
- Individual completion controls, shared history and streak counters.
- Supabase Realtime listening for completion and membership changes.
- Mobile blue-and-pink interface, invitation popup, share/copy actions.
- Duo display names persisted via the `duos.name` database column.

## Required database update

In Supabase Dashboard → SQL Editor, run `room-name-migration.sql` **once**. This adds `duos.name` and an owner-only update policy. Existing duo owners can then edit the name through **Запросити подругу** → **Назва вашого дуету**.

**Why this is needed:** Previous versions did not store the typed duo title at all, so older duo titles cannot be automatically recovered. After running this migration, set the desired title once in the popup.

The existing application also depends on your previously deployed duo-membership tables, row-level-security policies and `get_or_create_daily_task`, `create_duo`, and `join_duo` RPC functions. This migration does not create those earlier objects.

## Deployment

The browser-side Supabase **publishable** key and project URL live in `config.js`. Never commit a service role key or Supabase secret key.

If your Netlify site is connected to branch `main` with root publish directory, the page is served at `/daily-duo/` after Netlify deploys this commit. If not, redeploy the repository as a static site, using the repository root as the publish directory.

## Security and UX

- Only a duo's creator can rename it under the provided SQL policy.
- Supabase authorization rules must stay enabled on membership, tasks and completions; do not expose secret credentials in static JS.
- Previous static pages remain untouched.
- Daily challenges and completion history appear when each member opens the app.
