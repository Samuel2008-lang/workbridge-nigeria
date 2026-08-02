# WorkBridge Supabase

## Fresh project setup

1. Create a Supabase project dedicated to WorkBridge.
2. Copy `.env.example` → `.env` and fill values (see **Required .env keys** below).
3. **Apply the full schema** (tables, RLS, triggers, RPCs, storage):

   **Option A — Dashboard (no extra secrets)**  
   Open **SQL Editor** → paste entire contents of  
   `FRESH_PROJECT_BOOTSTRAP.sql` (or `APPLY_THIS_IN_SUPABASE_SQL_EDITOR.sql`) → **Run**.

   **Option B — CLI script**  
   Add `SUPABASE_DB_PASSWORD` or `SUPABASE_ACCESS_TOKEN` to `.env`, then:

   ```bash
   npm run supabase:apply
   npm run supabase:check
   ```

## Required .env keys

| Key | Where to get it | Needed for |
|-----|-----------------|------------|
| `SUPABASE_PROJECT_ID` | Settings → General → Reference ID | Config / scripts |
| `SUPABASE_URL` | Settings → API → Project URL | App + API |
| `SUPABASE_PUBLISHABLE_KEY` | Settings → API → `anon` / publishable key | App client |
| `VITE_SUPABASE_*` (same three + `VITE_SUPABASE_ANON_KEY`) | Same as above | Vite browser build |
| `SUPABASE_DB_PASSWORD` **or** `SUPABASE_ACCESS_TOKEN` **or** `DATABASE_URL` | Database password / account token / connection URI | **Applying SQL automatically** |
| `SUPABASE_SERVICE_ROLE_KEY` | Settings → API → `service_role` | Edge Functions, wallet deposits |
| `VITE_APP_NAME` | e.g. `WorkBridge` | UI |
| `VITE_FLUTTERWAVE_PUBLIC_KEY` | Flutterwave dashboard | Client payments (optional) |

Do **not** put `SUPABASE_SERVICE_ROLE_KEY` or DB password in any `VITE_*` variable.

4. Auth (Dashboard → Authentication):
   - Enable **Email** provider
   - For local testing you may disable email confirmation
   - Set Site URL to your app origin

5. Edge Functions (payments):

   ```bash
   npx supabase functions deploy flutterwave-verify --project-ref <PROJECT_ID>
   npx supabase functions deploy flutterwave-webhook --project-ref <PROJECT_ID>
   ```

   Secrets: `FLUTTERWAVE_SECRET_KEY`, `FLUTTERWAVE_WEBHOOK_HASH`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

6. Verify:

   ```bash
   node scripts/check-supabase.mjs
   ```

   Expect `profiles`, `jobs`, and `user_settings` HTTP 200.

## Schema source of truth

- Incremental history: `migrations/`
- Single fresh bootstrap: `migrations/20260726000000_workbridge_fresh_bootstrap.sql`
