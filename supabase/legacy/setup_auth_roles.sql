-- Asegurarse de que user_profiles tenga columna role
alter table user_profiles
  add column if not exists role text default 'employee';

-- Desactivamos RLS para simplificar la lectura de rol
alter table user_profiles disable row level security;

-- Vista segura para que el frontend obtenga rol sin exponer toda la tabla
create or replace view my_profile as
  select id, role
  from user_profiles
  where id = auth.uid();

create or replace function get_my_role()
  returns text
  language sql
  security definer
as $$
  select role
  from user_profiles
  where id = auth.uid();
$$;

create or replace function ensure_my_profile(preferred_role text default 'employee')
  returns user_profiles
  language plpgsql
  security definer
as $$
declare
  current_email text := current_setting('request.jwt.claims.email', true);
begin
  insert into user_profiles (id, email, role)
    values (auth.uid(), coalesce(current_email, ''), preferred_role)
    on conflict (id) do update set email = coalesce(current_email, user_profiles.email);

  return (
    select *
    from user_profiles
    where id = auth.uid()
  );
end;
$$;
