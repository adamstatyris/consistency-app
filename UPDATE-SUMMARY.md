# Consistency — update summary (Web Push–only reminders)

## Release focus (this drop)

### Notifications: Web Push only
- **Removed** the best-effort path: **Periodic Background Sync**, service-worker **reminder snapshot** cache, and **in-tab** `showNotification` flows for habit / Sunday / grace nudges and per-minute exact-time pings.
- **All** of those reminders are now modeled as **rows in `reminder_schedule`** and sent by the existing Supabase **`push-reminders`** Edge Function when cron calls it with `x-cron-secret`.
- The **service worker** (`sw.js`) is now **fetch + push + notification click** only (cache name bumped to `consistency-sw-v7`).

### What gets scheduled on the server (when VAPID is set and user is signed in)
- **Exact habit times** (same rules as before; still **skipped in kid mode** on the client schedule).
- **Grace Sunday** and **Sunday week-close** messages at **fixed local times** (9:00 / 16:00 / 21:00 for grace; 10:00–20:00 spread for the five Sunday bands).
- **`habits_day`** at **14:00 local**: one generic nudge when **any core or growth** habit for today is still unlogged (replaces the old **growth-only** “pot” copy).
- Optional dev row **`_tempPush2350`** if `CONSISTENCY_TEMP_PUSH_TEST_2350` remains enabled.

### Product / copy
- The former **`growth_day`** push was **app-coded** to growth tier only; it is now **`habits_day`** with neutral copy so it matches **core or growth** (and reads as “habits” generally).

### Ops / README
- README **Web Push** section updated: no more “local SW reminders” fallback; documents that **VAPID public in `index.html`** is required for cron-side delivery.

### Cloud backup (prior fix, still in tree)
- `user_state_history` **`saved_at`** on archive uses the **same wall-clock instant as the upload** (aligned with `user_state.updated_at`), and prune keeps **today + yesterday + two days ago** so “Revert to yesterday” matches calendar expectations. *(Unrelated to push, but part of recent mainline work.)*

---

**Deploy:** push `main`; ensure Supabase cron + secrets + `CONSISTENCY_VAPID_PUBLIC_KEY` are configured so users actually receive pushes.
