-- Fix: push-reminders Edge Function returns 500
--   {"error":"permission denied for table reminder_schedule"}
-- Run once in Supabase Dashboard → SQL Editor.
--
-- Tables were created with RLS for signed-in users, but the Edge Function uses the
-- service_role key (bypasses RLS) and still needs explicit table privileges.

grant usage on schema public to service_role;

grant select, insert, update, delete on table public.reminder_schedule to service_role;
grant select, insert, update, delete on table public.push_subscriptions to service_role;
