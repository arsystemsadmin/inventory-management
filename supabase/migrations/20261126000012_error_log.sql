-- Developer-only error log. Written by the server with the service-role key;
-- no policies exist, so owners and employees can neither read nor write it.
create table public.error_log (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  business_id uuid references public.businesses (id) on delete set null,
  user_id     uuid,                     -- auth user id (no FK: logs outlive accounts)
  user_email  text check (user_email is null or length(user_email) <= 320),
  user_role   text check (user_role is null or length(user_role) <= 20),
  source      text not null default 'server' check (source in ('server', 'client')),
  action      text not null check (length(action) <= 100),
  path        text check (path is null or length(path) <= 500),
  message     text check (message is null or length(message) <= 2000),
  code        text check (code is null or length(code) <= 100),
  details     jsonb,
  user_agent  text check (user_agent is null or length(user_agent) <= 400)
);

alter table public.error_log enable row level security;   -- and no policies on purpose
revoke all on public.error_log from anon, authenticated;

create index error_log_created_idx  on public.error_log (created_at desc);
create index error_log_user_idx     on public.error_log (user_id, created_at desc);
create index error_log_business_idx on public.error_log (business_id, created_at desc);
