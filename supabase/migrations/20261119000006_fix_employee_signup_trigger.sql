-- Fix: Supabase Auth's admin.createUser() INSERTs the auth.users row first and
-- writes custom app_metadata in a later UPDATE. The original insert trigger
-- therefore saw no business_id and treated server-created employees as public
-- signups (creating a new business owned by the employee).
--
-- New rules:
--  * INSERT with app_metadata.business_id         -> employee profile
--  * INSERT with user_metadata.business_name       -> public signup: business + owner
--  * INSERT with neither                           -> no profile (sees nothing)
--  * UPDATE that adds app_metadata.business_id to a
--    user without a profile                        -> employee profile
-- app_metadata is only writable with the service role, so end users can never
-- attach themselves to an existing business.

create or replace function private.create_profile_for_user(
  p_user_id uuid, p_email text, p_app jsonb, p_user jsonb)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_business_id uuid := nullif(p_app ->> 'business_id', '')::uuid;
  v_full_name   text := coalesce(
                          nullif(trim(p_user ->> 'full_name'), ''),
                          nullif(trim(p_app ->> 'full_name'), ''),
                          split_part(p_email, '@', 1));
  v_biz_name    text := nullif(trim(p_user ->> 'business_name'), '');
  v_role        text := 'employee';
begin
  if exists (select 1 from public.profiles where id = p_user_id) then
    return;
  end if;

  if v_business_id is not null then
    if not exists (select 1 from public.businesses where id = v_business_id) then
      raise exception 'UNKNOWN_BUSINESS';
    end if;
    -- Only the server (service role) can set app_metadata.role.
    v_role := case when p_app ->> 'role' = 'owner' then 'owner' else 'employee' end;
  elsif v_biz_name is not null then
    insert into public.businesses (name) values (v_biz_name) returning id into v_business_id;
    v_role := 'owner';
  else
    return;
  end if;

  insert into public.profiles (id, business_id, full_name, email, role)
  values (p_user_id, v_business_id, v_full_name, coalesce(p_email, ''), v_role);
end $$;

create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  perform private.create_profile_for_user(new.id, new.email, new.raw_app_meta_data, new.raw_user_meta_data);
  return new;
end $$;

create or replace function private.handle_user_app_metadata()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if (new.raw_app_meta_data ->> 'business_id') is not null
     and (old.raw_app_meta_data ->> 'business_id') is distinct from (new.raw_app_meta_data ->> 'business_id') then
    perform private.create_profile_for_user(new.id, new.email, new.raw_app_meta_data, new.raw_user_meta_data);
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_app_metadata on auth.users;
create trigger on_auth_user_app_metadata
  after update of raw_app_meta_data on auth.users
  for each row execute function private.handle_user_app_metadata();

revoke execute on all functions in schema private from public, anon, authenticated;
