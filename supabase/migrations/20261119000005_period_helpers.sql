-- Start of the current day/week in the caller's business timezone.
create or replace function public.business_period_start(p_period text)
returns timestamptz
language sql stable security invoker set search_path = ''
as $$
  select (date_trunc(
            case when p_period = 'week' then 'week' else 'day' end,
            now() at time zone b.timezone)
         ) at time zone b.timezone
  from public.businesses b
  where b.id = public.current_business_id()
$$;

create or replace function public.business_timezone()
returns text
language sql stable security invoker set search_path = ''
as $$
  select b.timezone from public.businesses b where b.id = public.current_business_id()
$$;

revoke execute on function public.business_period_start(text), public.business_timezone() from public, anon;
grant execute on function public.business_period_start(text), public.business_timezone() to authenticated;
