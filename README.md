# Consistency

A habit and goal tracker built around weekly consistency, gentle scoring, and weekly treats. Single-file PWA — installable on Android and iOS.

## Status

Closed beta (**v1.2beta**). **Auth:** Supabase (Google + email magic link). **Cloud sync:** signed-in users sync the full multi-profile `ROOT` to Supabase (`user_state`) from **Settings → Account**. **Automatic cloud archives:** these are **not** manual uploads. After you run the SQL in [`supabase/schema.sql`](supabase/schema.sql) (see [Supabase setup](#supabase-setup-cloud-sync--backups)), the app keeps a **`user_state_pending`** row per account: every sync overwrites that row for the **current local calendar day**. When the local date advances (next open, next edit, or while the tab stays open past midnight), the **previous day’s** pending snapshot is appended to **`user_state_history`** with `saved_at` = **23:59:59.999 local** on that day; the client prunes to **at most 2** history rows. **You do not need the app open at midnight**—finalization runs on the next successful sync after the day changes. **Settings → Account → Automatic cloud archives** lists them as backups (newest first) for restore if live data looks wrong.

## Repository layout

```
.
├── index.html              # Entire app (HTML + CSS + JS in one file)
├── manifest.webmanifest    # PWA manifest
├── sw.js                   # Minimal service worker (pass-through, enables installability)
├── _headers                # Cloudflare Pages cache rules
├── supabase/
│   └── schema.sql          # `user_state` + `user_state_pending` + `user_state_history` + RLS (run / re-run in Supabase SQL Editor)
├── icons/                  # PWA icons (192, 512, apple-touch)
└── README.md
```

## Supabase setup (cloud sync + backups)

Do this in the [Supabase Dashboard](https://supabase.com/dashboard) for **the same project** your app uses (Project URL + anon key in the frontend).

1. Open your project → **SQL Editor** (left sidebar) → **New query**.
2. Open [`supabase/schema.sql`](supabase/schema.sql) in this repo and **copy the entire file** into the editor.  
   - **New project:** run the full script once.  
   - **Already migrated `user_state`:** if the editor reports errors such as *policy already exists* for `user_state_*`, do **not** re-run those lines — copy only the block in `schema.sql` from `-- Previous cloud payloads` through the last `user_state_pending` policy and run **that** once to add rolling daily archives.
3. Click **Run** (or **Ctrl+Enter**). You should see success; no rows returned is normal.
4. Quick check: **Table Editor** → confirm tables **`user_state`**, **`user_state_pending`**, and **`user_state_history`** exist and RLS is enabled (shield icon).
5. Deploy or refresh the app; sign in and change something (or use **Sync now**). **Automatic cloud archives** on the Account tab should list backups after your local calendar day rolls over and you sync again (or open the app the next day).

Rolling archives are optional: if `user_state_history` / `user_state_pending` are missing, live `user_state` uploads still work; the app just cannot list or restore older cloud copies until you run the new SQL block.

## Local preview

Any static-file server works. Two easy options:

```powershell
# Option 1: Python (pre-installed on most systems)
cd consistency-app
python -m http.server 8080

# Option 2: Node (if installed)
npx --yes serve -l 8080 .
```

Then open <http://localhost:8080>.

PWA install only works on `https://` or `localhost`. The service worker explicitly checks for this before registering.

## Deploy

Hosted on Cloudflare Pages. Every push to `main` auto-deploys.

- Production: `https://<project>.pages.dev` (closed beta)
- Preview branches: `https://<branch>.<project>.pages.dev`

## Development workflow

1. Edit `index.html`.
2. Test locally (see above) or in Cursor's preview.
3. Commit and push. Cloudflare Pages picks up the push and rebuilds.

```powershell
git add .
git commit -m "Short description of the change"
git push
```

## Conventions

- Single-file architecture is intentional for now (deploy simplicity, easy backups).
- Persistent state lives in `localStorage` under key `consistency-app-v4`.
- Per-profile data is namespaced inside `ROOT.profiles`.
- All UI strings have an adult voice and a kid voice (ages 0–8) — keep both in sync when editing.
- Onboarding follows "Approach D": short intro → milestone steppers triggered by user actions.

## Auth notes (Supabase)

- **Google account picker says “Log in to” + a long random-looking string** — That text is **not** controlled in `index.html`. Google takes it from the **OAuth consent screen** (and the OAuth client) backing your sign-in. To show a friendly name (e.g. **Consistency app**):
  1. In [Google Cloud Console](https://console.cloud.google.com/) use the **same Google Cloud project** where the **Web client ID** is registered that you entered in Supabase (see next bullet).
  2. Go to **APIs & Services → OAuth consent screen**.
  3. Set **App name** to `Consistency app` (or `Consistency`). Save.  
     Optional: add **App logo**, **support email**, and **developer contact** — required if you move beyond “Testing” or widen audience.
  4. In [Supabase](https://supabase.com/dashboard) open **Authentication → Providers → Google**: use your own **Client ID** and **Client Secret** from that Cloud project (see [Google sign-in with Supabase](https://supabase.com/docs/guides/auth/social-login/auth-google)). If you only use Supabase’s pre-filled Google keys, branding is limited; **custom credentials** + consent screen above are what make the picker show your name.
- **Sign-in** uses [Supabase Auth](https://supabase.com/docs/guides/auth) with `flowType: 'implicit'` so **magic-link emails work when opened from another device or mail app** (PKCE requires the same browser session that requested the link).
- **Email “From” (e.g. “Supabase Auth”)** — On the default host, Supabase sends from their infrastructure. To show **“Consistency”** or **“S-Sence Labs”** as the sender, add **custom SMTP** in the Supabase dashboard (**Project → Settings → Auth → SMTP Settings**), then set your **sender name** and **from address** (use a domain you control, e.g. `noreply@yourdomain.com`, with SPF/DKIM as your provider requires). You can also edit **Authentication → Email Templates** for subject/body copy.
- **Redirect URLs** must include your production site and local dev (e.g. `https://your-project.pages.dev/**` and `http://localhost:*/**`).
- **Magic link email (centered layout)** — In **Authentication → Email Templates**, open the **Magic Link** template and replace the body with HTML like below. Put **`{{ .ConfirmationURL }}`** only in the `href` of the button and in the fallback line (Supabase expands it to the full verify URL). The layout uses nested tables so it stays centered in Gmail and Outlook.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width">
  <title>Sign in</title>
</head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f0f2f5;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,.08);">
          <tr>
            <td align="center" style="padding:28px 24px 8px;font-size:20px;font-weight:600;color:#111827;">
              Sign in to Consistency
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:12px 24px 24px;font-size:15px;line-height:1.5;color:#4b5563;">
              You asked for a one-tap link to your account. Use the button below.
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:0 24px 28px;">
              <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:14px 28px;background:#2563eb;color:#ffffff !important;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">
                Open Consistency
              </a>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:0 24px 28px;font-size:13px;line-height:1.55;color:#6b7280;">
              Button not working? Paste this link into your browser:<br>
              <span style="word-break:break-all;color:#2563eb;">{{ .ConfirmationURL }}</span>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:0 24px 32px;font-size:12px;line-height:1.5;color:#9ca3af;">
              If you didn’t request this email, you can ignore it. This link will expire after a short time for your security.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

- **Magic link “rate limit”** — Supabase caps how many OTP/magic-link emails can be sent per hour (see [Auth rate limits](https://supabase.com/docs/guides/auth/rate-limits)). Heavy testing triggers this quickly; wait ~1 hour, use Google sign-in, or raise limits / use **custom SMTP** on a paid tier.
- **Link opens the site but you stay logged out** — The fragment `#access_token=…` must stay on the URL until the Supabase client ingests it. Older builds stripped it too early (a race with `getSession()`). Current `index.html` retries session detection briefly and only then clears the address bar; redeploy if you still see this after clicking **Open Consistency**.

## Cloud sync (Phase D)

1. In the Supabase dashboard, open **SQL** → **New query**, paste `supabase/schema.sql`, and run it once. That creates `public.user_state` (`user_id`, `payload` jsonb, `updated_at`) with RLS so each user can only read/write their own row.
2. In the app, **Settings → Account**: turn **Sync this device with the cloud** on (default), edit data as usual — uploads are debounced (~2s after each save). **Sync now** forces an immediate upsert.
3. **Conflict model (MVP):** last-write-wins using `ROOT._sync.editAt` (local, bumped on every normal save) versus `user_state.updated_at` from the server. After sign-in or session recovery, if the remote copy is newer the app replaces local `ROOT` with the migrated remote payload (then saves locally without bumping `editAt` for merge); if local is newer (or the cloud row is empty), the app pushes. Identical timestamps skip a redundant merge.

## License

All rights reserved. Personal beta — please do not redistribute.
