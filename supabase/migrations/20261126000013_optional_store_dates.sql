-- Pop-up dates are optional. When both are given, the end must be after the start.
alter table public.stores drop constraint if exists popup_needs_dates;
alter table public.stores add constraint store_dates_order
  check (starts_at is null or ends_at is null or ends_at > starts_at);
