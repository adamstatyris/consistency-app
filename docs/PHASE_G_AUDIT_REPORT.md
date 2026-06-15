# Phase G — Internal audit report (findings only)

Generated from static code review. **No behaviour changed** except items explicitly implemented in Phases A–F.

Severity: **bug** / **UX** / **cosmetic** / **dead-code**

---

## Mechanics

| Severity | Area | Finding | Suggested fix |
|----------|------|---------|---------------|
| UX | Recovery copy | Was overly long on goal cards — **fixed** this session (concise bullet list). | — |
| UX | Points goals | `pointValueCore` / `pointValueGrowth` now wire to new habits; pot field read-only on points goals. | Verify end-to-end with a fresh points goal + 2C+2G habits. |
| UX | Money goals | `weeklyBudget` not captured on money goals yet; habit defaults use fallback `60` via `computeDefaultPotValues`. | Add optional weekly budget to money goal form (Phase D follow-up). |
| cosmetic | Currency | ~22 static `£` remain in guide HTML, onboarding tours, insight library tuples. | Gradual pass via ui-copy tooling or targeted replace. |
| UX | Notifications | Delivery depends on Supabase cron (operational). | See `docs/PHASE_B_NOTIFICATIONS.md`. |

---

## Onboarding / tutorials

| Severity | Area | Finding | Suggested fix |
|----------|------|---------|---------------|
| UX | First goal tour | Still references money/savings examples; no points-goal branch. | Add kid/adult steps when `goalType` picker is used. |
| UX | Guide modal | Long recovery paragraph in Tips (`guide-block` below floor) duplicates dashboard bullets. | Shorten Tips recovery block to match new concise format. |
| cosmetic | Kid insights | Several mastery insights (`MX1`–`MX7`, `BK_SM*`) have empty kid variants. | Author kid copy or hide in kid mode. |

---

## Orphan / stale code

| Severity | Area | Finding | Suggested fix |
|----------|------|---------|---------------|
| dead-code | Recovery | Removed `simulateRecoverySnapshotAtWeekEnd`, `goalRollingPctFromWeekKeys`, `rollingExcludedWeekKeysCount`, `trackedWeeksForGoalThrough` — **no references remain**. | — |
| cosmetic | Brand | `reminder_schedule.title` default in schema still `'Consistency'`; push payloads use `'Evolve'` in client. | Align schema default if new rows matter. |
| cosmetic | ME11 insight | `sourceText` still says "Consistency app". | Optional ui-copy tweak. |

---

## Edge cases to smoke-test manually

1. True failure during recovery → pot resets; week after is **not** recovery (B2 fix).
2. Multi-week app gap → reopen → same pot/cutoff as before (deterministic timeline).
3. New profile → Saved Habits bank **empty**.
4. Existing beta goal → `recoveryBoostEnabled` false (no 1.3× retroactive).
5. New goal → `recoveryBoostEnabled` true; recovery bullets show 1.3× line.
6. Premium toggle Basic → Masteries tab blocked; Paths hidden.
7. Currency change in Settings → dashboard pot labels update.
8. Points goal → add core/growth habits → locked pot values match goal.

---

## Recommended next (user decision)

- Configure Supabase cron for `push-reminders` (Phase B).
- Shorten Tips modal recovery section to match dashboard bullets.
- Money-goal weekly budget field + realistic date correction (Phase D completion).
- Server-side entitlements + Stripe (Phase F billing — not started in code).
