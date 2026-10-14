# Daily Duo 🐾

Mobile-first challenge tracker with multiple independent groups, hosted at `/daily-duo/`.

## How it works

- Create **several groups** under the same account, or join others using each group's invite code.
- Switch the active group using **МОЇ ГРУПИ** above the group name. The selected group is remembered per account on this device.
- **＋ Додати групу** at the bottom opens a popup for creating or joining a group. Existing groups stay available.
- **Запросити Bestie** shares the invite code for the **currently selected** group.
- Each group can have its own active challenges (title and description), daily checkboxes for each member, independent three-day history preview and streaks.
- **Керувати челенджами** applies **only to the selected group**. Archiving preserves earlier records, while permanent deletion cascades to that challenge's records after double confirmation.
- A group's owner can edit its name using the pencil beside the title.
- **Покинути групу** leaves just the selected group. When an owner leaves a group that has a Bestie, ownership transfers to the other member; when the owner is the only member, leaving deletes that group and its records after an extra confirmation.
- Current invite/join rules allow up to **two members per group**.

## Backend

Supabase project has the existing `duos`, `duo_members`, `duo_challenges`, `daily_tasks` and `task_completions` tables, plus `get_or_create_daily_tasks`, `create_duo`, `join_duo` and `leave_duo` RPC functions. Row-level security isolates data between groups. Changes made to the existing project have been applied through Supabase migrations. There is no requirement to execute the older `room-name-migration.sql` again.

All challenge data, checkmarks, history and statistics are scoped to the selected `duo_id`. A new group starts with **no challenges** so every group can have different ones. Older groups and their data are preserved.

## Deployment

The browser's Supabase publishable key and URL are in `config.js` (not service secrets). Do **not** store a `service_role` key or any privileged token in GitHub or browser JavaScript.

Deploy GitHub `main` with the repository root as the Netlify publish directory so `/daily-duo/` resolves correctly. Refresh the page on each device after deployment.

This project deliberately has no automatic notification delivery.
