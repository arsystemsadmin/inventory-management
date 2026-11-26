-- User settings: a saved default store, and a safe way for anyone (owner or
-- employee) to update their own name and default store. Everything else on
-- the profile stays owner-only.
alter table public.profiles
  add column if not exists default_store_id uuid references public.stores (id) on delete set null;

create or replace function public.update_my_settings(p_full_name text, p_default_store_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '42501';
  end if;
  if p_default_store_id is not null and not public.can_access_store(p_default_store_id) then
    raise exception 'STORE_NOT_ACCESSIBLE' using errcode = '42501';
  end if;
  update public.profiles
     set full_name = trim(p_full_name),
         default_store_id = p_default_store_id
   where id = auth.uid();
end $$;

revoke all on function public.update_my_settings(text, uuid) from public, anon;
grant execute on function public.update_my_settings(text, uuid) to authenticated;
